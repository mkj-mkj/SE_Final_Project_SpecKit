// 活動服務（TECH_SPEC §7.9）。001：createSession、getCurrentSession、getTeacherView、
// updateSettings、getPublicInfo、join、resolveMember、getTeamView、setOnline；002：importSheet；
// 003：start、end、reset、updateDraft、submit（純速度）；004：rejectWinner、exportToSheet、restoreSheet、exportCsv。
//
// 寫入一律在單一同步交易（withTransaction）中完成；排程與推播等副作用只在 COMMIT 之後執行（research R-01）。
// domain 與 service 不直接呼叫 Date.now()、setTimeout、Math.random()，一律用注入的 clock、scheduler、ids。
import {
  AppError,
  DEFAULT_FAIRNESS_MODE,
  DEFAULT_TEAM_COUNT,
  DEFAULT_WINDOW_SEC,
  MAX_ANSWER_LENGTH,
  MAX_TEAM_COUNT,
  MAX_WINDOW_SEC,
  MIN_TEAM_COUNT,
  MIN_WINDOW_SEC,
  nicknameKey,
  normalizeNickname,
  normalizeRoomCode,
  type FairnessMode,
  type ImportSummary,
  type Member,
  type PublicSessionInfo,
  type Question,
  type Session,
  type Submission,
  type TeacherView,
  type TeamView,
  type CellWrite,
  validateAnswers,
  WITHDRAW_LIMIT_MS,
} from '@quiz/shared';
import { z } from 'zod';
import { withTransaction } from '../db/db.js';
import type { Repo } from '../db/repo.js';
import { assertPhase, nextPhase } from '../domain/phase.js';
import { buildResultsCsv } from '../export/csv.js';
import { buildCsvRows, projectTeacherView, projectTeamView, type SessionAggregate } from '../domain/projections.js';
import { teamScores, winnerOf } from '../domain/ranking.js';
import { assignOrderKeys, nextOrderKey, sortFairCandidates } from '../domain/settlement.js';
import type { Clock } from '../ports/clock.js';
import type { IdGen } from '../ports/ids.js';
import type { Scheduler } from '../ports/scheduler.js';
import type { SheetsGateway } from '../ports/sheetsGateway.js';
import type { Broadcaster } from '../realtime/broadcaster.js';
import { parseSpreadsheetInput } from '../sheets/a1.js';
import { buildExportWrites, buildRestoreWrites } from '../sheets/exporter.js';
import { parseGuidedNotes, summarize } from '../sheets/parser.js';

export interface ServiceDeps {
  repo: Repo;
  clock: Clock;
  scheduler: Scheduler;
  ids: IdGen;
  sheets: SheetsGateway;
  broadcaster: Broadcaster;
}

type SettingsInput = { teamCount?: number; fairnessMode?: FairnessMode; windowSec?: number };

/** 設定欄位範圍：組數 2–20、秒數 1–10、模式 speed／fair；不符 → INVALID_INPUT */
const settingsSchema = z.object({
  teamCount: z.number().int().min(MIN_TEAM_COUNT).max(MAX_TEAM_COUNT).optional(),
  fairnessMode: z.enum(['speed', 'fair']).optional(),
  windowSec: z.number().int().min(MIN_WINDOW_SEC).max(MAX_WINDOW_SEC).optional(),
});

function parseSettings(input: SettingsInput): SettingsInput {
  const r = settingsSchema.safeParse(input);
  if (!r.success) throw new AppError('INVALID_INPUT');
  return r.data;
}

/** 房間碼與既有活動重複時重抽的最大次數（research R-05） */
const MAX_ROOM_CODE_ATTEMPTS = 10;

const teamName = (index: number): string => `第 ${index} 組`;

/** 公平模式視窗的排程鍵 */
const windowKey = (questionId: string): string => `window:${questionId}`;

/** 送出紀錄依題目分組（teamScores 用） */
function groupByQuestion(subs: Submission[]): Map<string, Submission[]> {
  const map = new Map<string, Submission[]>();
  for (const s of subs) {
    const list = map.get(s.questionId);
    if (list) list.push(s);
    else map.set(s.questionId, [s]);
  }
  return map;
}

/** 視窗結算順序：windowEndsAt 升冪 → 題號升冪（TECH_SPEC §7.9 註記） */
function sortByWindow(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => (a.windowEndsAt ?? 0) - (b.windowEndsAt ?? 0) || a.number - b.number);
}

export class SessionService {
  /** 上線中的成員（只存記憶體；伺服器重啟後為空，所有成員視為離線） */
  private readonly onlineMemberIds = new Set<string>();

  constructor(private readonly deps: ServiceDeps) {}

  // ---------- 內部工具 ----------

  private requireSession(sessionId: string): Session {
    const s = this.deps.repo.getSession(sessionId);
    if (!s) throw new AppError('SESSION_NOT_FOUND');
    return s;
  }

  /** 載入活動完整資料（供投影與 broadcaster 使用），含草稿與送出紀錄 */
  loadAggregate(sessionId: string): SessionAggregate {
    const { repo } = this.deps;
    return {
      session: this.requireSession(sessionId),
      questions: repo.listQuestions(sessionId),
      slots: repo.listSlotsBySession(sessionId),
      teams: repo.listTeams(sessionId),
      members: repo.listMembersBySession(sessionId),
      drafts: repo.listDrafts(sessionId),
      submissions: repo.listSubmissions(sessionId),
      onlineMemberIds: new Set(this.onlineMemberIds),
      importSummary: repo.getImportSummary(sessionId),
    };
  }

  /**
   * 交易後副作用機制（research R-01）：fn 在單一交易內執行，期間以 after(cb) 登記的回呼
   * 只在 COMMIT 成功後依序執行；交易丟出例外（ROLLBACK）時全部捨棄，不會推播或排程半套狀態。
   */
  private runTx<T>(fn: (after: (cb: () => void) => void) => T): T {
    const callbacks: (() => void)[] = [];
    const result = withTransaction(this.deps.repo.db, () => fn((cb) => callbacks.push(cb)));
    for (const cb of callbacks) cb();
    return result;
  }

  // ---------- 老師 ----------

  /** 建立活動與 N 個組別；房間碼重複時重抽，最多 10 次（仍重複 → INVALID_INPUT） */
  createSession(input: SettingsInput): TeacherView {
    const settings = parseSettings(input);
    const { repo, clock, ids, broadcaster } = this.deps;
    const sessionId = withTransaction(repo.db, () => {
      let roomCode: string | null = null;
      for (let i = 0; i < MAX_ROOM_CODE_ATTEMPTS && roomCode === null; i++) {
        const candidate = ids.roomCode();
        if (!repo.roomCodeExists(candidate)) roomCode = candidate;
      }
      if (roomCode === null) throw new AppError('INVALID_INPUT');

      const teamCount = settings.teamCount ?? DEFAULT_TEAM_COUNT;
      const session: Session = {
        id: ids.id('ses'),
        roomCode,
        phase: 'SETUP',
        spreadsheetId: null,
        sheetTitle: null,
        fairnessMode: settings.fairnessMode ?? DEFAULT_FAIRNESS_MODE,
        windowSec: settings.windowSec ?? DEFAULT_WINDOW_SEC,
        teamCount,
        round: 1,
        createdAt: clock.now(),
        startedAt: null,
        endedAt: null,
      };
      repo.insertSession(session);
      for (let index = 1; index <= teamCount; index++) {
        repo.insertTeam({ id: ids.id('team'), sessionId: session.id, index, name: teamName(index) });
      }
      return session.id;
    });
    broadcaster.publish(sessionId);
    return this.getTeacherView(sessionId);
  }

  /** 目前活動＝最新建立的活動；沒有任何活動時回傳 null（路由轉成 404） */
  getCurrentSession(): TeacherView | null {
    const latest = this.deps.repo.getLatestSession();
    return latest ? this.getTeacherView(latest.id) : null;
  }

  getTeacherView(sessionId: string): TeacherView {
    return projectTeacherView(this.loadAggregate(sessionId), this.deps.clock.now());
  }

  /**
   * 修改設定（research R-07），單一交易內：
   * 階段檢查 → 範圍驗證 → 減少組數時被移除的組不得有成員 → 增減組 → 更新活動。
   * 切到純速度時保留原本的視窗秒數，切回公平模式時沿用。
   */
  updateSettings(sessionId: string, input: SettingsInput): TeacherView {
    const { repo, ids, broadcaster } = this.deps;
    withTransaction(repo.db, () => {
      const session = this.requireSession(sessionId);
      assertPhase(session.phase, 'updateSettings');
      const settings = parseSettings(input);
      const oldCount = session.teamCount;
      const newCount = settings.teamCount ?? oldCount;

      if (newCount < oldCount) {
        if (repo.countMembersInTeamsAbove(sessionId, newCount) > 0) {
          throw new AppError('TEAM_HAS_MEMBERS');
        }
        repo.deleteTeamsAbove(sessionId, newCount);
      }
      for (let index = oldCount + 1; index <= newCount; index++) {
        repo.insertTeam({ id: ids.id('team'), sessionId, index, name: teamName(index) });
      }
      repo.updateSession({
        ...session,
        teamCount: newCount,
        fairnessMode: settings.fairnessMode ?? session.fairnessMode,
        windowSec: settings.windowSec ?? session.windowSec,
      });
    });
    broadcaster.publish(sessionId);
    return this.getTeacherView(sessionId);
  }

  /**
   * 匯入 Guided Notes（TECH_SPEC §7.9、research R-05；FR-01）：
   * 1) 交易外：檢查階段 → 解析網址（無效時不讀取試算表）→ 讀取快照 → 解析與摘要；
   * 2) 單一交易內：重新檢查階段（讀取期間老師可能已開始搶答）→ 刪除舊題目（作答格、草稿連帶刪除）
   *    → 寫入新題目與作答格 → 更新試算表 ID、工作表名稱與階段 → 保存摘要；
   * 3) 推播給老師與全部組。任何錯誤都不寫入、不推播（全有或全無，FR-019）。
   * 重疊的多次匯入各自在交易內整批取代，最後完成者為最終結果（FR-001a）。
   */
  async importSheet(
    sessionId: string,
    spreadsheetInput: string,
  ): Promise<{ view: TeacherView; summary: ImportSummary }> {
    const { repo, ids, sheets, broadcaster } = this.deps;
    assertPhase(this.requireSession(sessionId).phase, 'import');
    const spreadsheetId = parseSpreadsheetInput(spreadsheetInput);
    const snapshot = await sheets.fetchSnapshot(spreadsheetId);
    const result = parseGuidedNotes(snapshot);
    const summary = summarize(result);

    withTransaction(repo.db, () => {
      const session = this.requireSession(sessionId);
      const phase = nextPhase(session.phase, 'import'); // 內含 assertPhase：不允許時丟 INVALID_PHASE
      repo.deleteQuestionsBySession(sessionId);
      for (const pq of result.questions) {
        const questionId = ids.id('q');
        repo.insertQuestion({
          id: questionId,
          sessionId,
          number: pq.number,
          isGroup: pq.isGroup,
          subCount: pq.slots.length,
          state: 'open',
          windowEndsAt: null,
        });
        // 作答格位置只來自解析結果（憲章原則 V），保存原始內容供 004 還原
        for (const s of pq.slots) {
          repo.insertSlot({
            id: ids.id('slot'),
            questionId,
            subNo: s.subNo,
            sheetTitle: s.sheetTitle,
            row: s.row,
            col: s.col,
            a1: s.a1,
            prefix: s.prefix,
            originalValue: s.originalValue,
          });
        }
      }
      repo.updateSession({ ...session, spreadsheetId, sheetTitle: result.sheetTitle, phase });
      repo.setImportSummary(sessionId, summary);
    });

    broadcaster.publish(sessionId);
    return { view: this.getTeacherView(sessionId), summary };
  }

  // ---------- 搶答階段（003） ----------

  /**
   * 開始搶答：READY → RUNNING（§6）。沒有題目時拒絕（防禦性檢查：匯入已保證至少 1 題）。
   * 所有題目回到 open，記錄開始時間後推播給老師與全部組。
   */
  start(sessionId: string): TeacherView {
    const { repo, clock, broadcaster } = this.deps;
    this.runTx((after) => {
      const session = this.requireSession(sessionId);
      const phase = nextPhase(session.phase, 'start'); // 內含 assertPhase → INVALID_PHASE
      if (repo.listQuestions(sessionId).length === 0) throw new AppError('NO_QUESTIONS');
      repo.resetQuestionStates(sessionId);
      repo.updateSession({ ...session, phase, startedAt: clock.now() });
      after(() => broadcaster.publish(sessionId));
    });
    return this.getTeacherView(sessionId);
  }

  /**
   * 結束搶答：RUNNING → ENDED（TECH_SPEC §7.9 表格）。
   * 同一交易內先把所有仍在視窗中的題目依 (windowEndsAt, 題號) 逐題結算（不等視窗到期，
   * 前一題結果計入後一題分數），再進入已結束；COMMIT 後取消這些題目的排程，最後只推播一次。
   */
  end(sessionId: string): TeacherView {
    const { repo, clock, scheduler, broadcaster } = this.deps;
    this.runTx((after) => {
      const session = this.requireSession(sessionId);
      const phase = nextPhase(session.phase, 'end');
      const windows = sortByWindow(repo.listQuestions(sessionId).filter((q) => q.state === 'window'));
      for (const q of windows) this.settleInTx(q);
      repo.updateSession({ ...session, phase, endedAt: clock.now() });
      after(() => {
        for (const q of windows) scheduler.cancel(windowKey(q.id));
        broadcaster.publish(sessionId);
      });
    });
    return this.getTeacherView(sessionId);
  }

  /**
   * 重新開始一輪：ENDED → READY。清除送出與草稿，保留題目、組別與成員；
   * 題目回到 open、輪次 +1、開始與結束時間清空。
   */
  reset(sessionId: string): TeacherView {
    const { repo, broadcaster } = this.deps;
    this.runTx((after) => {
      const session = this.requireSession(sessionId);
      const phase = nextPhase(session.phase, 'reset');
      repo.deleteSubmissionsBySession(sessionId);
      repo.deleteDraftsBySession(sessionId);
      repo.resetQuestionStates(sessionId);
      repo.updateSession({ ...session, phase, round: session.round + 1, startedAt: null, endedAt: null });
      after(() => broadcaster.publish(sessionId));
    });
    return this.getTeacherView(sessionId);
  }

  /**
   * 老師判錯（PRD E5、TECH_SPEC §7.9）：把該題目前得主的送出標為 rejected，只改 status。
   * rejected 保留名次（orderKey 不變）但不能是得主，所以下一個有效送出自動遞補、原得主自動扣分，
   * 得主與分數一律由 ranking.ts（winnerOf／teamScores）推導，不另外儲存（TECH_SPEC §7.6）。
   * 搶答中與已結束都可判錯；沒有得主（無人送出、全部判錯或撤回、公平模式視窗尚未結算）→ NO_WINNER。
   * 整段在單一同步交易內完成，並發的判錯不會產生兩位得主；COMMIT 後推播給老師與全部組。
   */
  rejectWinner(sessionId: string, questionId: string): TeacherView {
    const { repo, broadcaster } = this.deps;
    this.runTx((after) => {
      const session = this.requireSession(sessionId);
      assertPhase(session.phase, 'rejectWinner');
      const q = this.requireQuestion(sessionId, questionId);
      const winner = winnerOf(repo.listSubmissionsByQuestion(q.id));
      if (!winner) throw new AppError('NO_WINNER');
      repo.updateSubmission(winner.id, { status: 'rejected' });
      after(() => broadcaster.publish(sessionId));
    });
    return this.getTeacherView(sessionId);
  }

  /**
   * 寫回 Google Sheets（FR-06、PRD §8 第 9 點）：只有已結束可寫回。
   * 每題最終得主（winnerOf，已反映判錯與撤回）的答案寫入匯入時記錄的作答格，位置只來自 answer_slots；
   * 無得主的題目原則上不寫。沒有任何寫入時不呼叫試算表 API。不推播、不寫資料庫。
   *
   * 例外（plan D1、PRD §8 第 9 點）：題目因判錯而沒有得主（winnerOf 為 null 且有 rejected 送出）時，
   * 該題作答格恢復為匯入時的原始值——先前寫回的錯誤答案會被清掉，讓試算表與「以最終得主為準」一致（E5）。
   * 從未被判錯、本來就沒人答對的題目仍不寫，保留老師可能手動填的內容。
   */
  async exportToSheet(sessionId: string): Promise<{ updatedCells: number; writes: CellWrite[] }> {
    const agg = this.loadAggregate(sessionId);
    assertPhase(agg.session.phase, 'export');
    const spreadsheetId = agg.session.spreadsheetId;
    if (!spreadsheetId) throw new AppError('INVALID_PHASE');
    const winners = new Map<string, Submission>();
    const rejectedToNone = new Set<string>();
    for (const [questionId, subs] of groupByQuestion(agg.submissions)) {
      const w = winnerOf(subs);
      if (w) winners.set(questionId, w);
      else if (subs.some((s) => s.status === 'rejected')) rejectedToNone.add(questionId);
    }
    const slotPos = new Map(agg.slots.map((s) => [`${s.sheetTitle}!${s.a1}`, s]));
    const writes = [
      ...buildExportWrites(agg.slots, agg.questions, winners),
      ...buildRestoreWrites(agg.slots.filter((s) => rejectedToNone.has(s.questionId))),
    ].sort((a, b) => {
      // 合併後依對應 slot 的工作表 → 列 → 欄排序（與 exporter 相同順序）
      const sa = slotPos.get(`${a.sheetTitle}!${a.a1}`)!;
      const sb = slotPos.get(`${b.sheetTitle}!${b.a1}`)!;
      return sa.sheetTitle.localeCompare(sb.sheetTitle) || sa.row - sb.row || sa.col - sb.col;
    });
    if (writes.length > 0) await this.deps.sheets.writeCells(spreadsheetId, writes);
    return { updatedCells: writes.length, writes };
  }

  /** 還原（PRD §8 第 10 點）：等待開始或已結束時，把所有作答格恢復成匯入時的原始值。不推播、不寫資料庫。 */
  async restoreSheet(sessionId: string): Promise<{ updatedCells: number }> {
    const session = this.requireSession(sessionId);
    assertPhase(session.phase, 'restore');
    if (!session.spreadsheetId) throw new AppError('INVALID_PHASE');
    const writes = buildRestoreWrites(this.deps.repo.listSlotsBySession(sessionId));
    if (writes.length > 0) await this.deps.sheets.writeCells(session.spreadsheetId, writes);
    return { updatedCells: writes.length };
  }

  /** 結果 CSV（PRD E2）：只有已結束可下載；每個送出（含撤回、判錯）的每個子題一列。 */
  exportCsv(sessionId: string): string {
    const agg = this.loadAggregate(sessionId);
    assertPhase(agg.session.phase, 'csv');
    return buildResultsCsv(buildCsvRows(agg));
  }

  // ---------- 學生 ----------

  /** 加入前的公開資訊：各組名稱與人數，不含任何暱稱（資訊隔離） */
  getPublicInfo(roomCode: string): PublicSessionInfo {
    const { repo } = this.deps;
    const session = repo.getSessionByRoomCode(normalizeRoomCode(roomCode));
    if (!session) throw new AppError('SESSION_NOT_FOUND');
    const counts = repo.countMembersByTeam(session.id);
    return {
      roomCode: session.roomCode,
      phase: session.phase,
      teams: repo.listTeams(session.id).map((t) => ({ id: t.id, name: t.name, memberCount: counts.get(t.id) ?? 0 })),
    };
  }

  /**
   * 加入活動（research R-08）。檢查順序：房間碼格式／活動存在 → 組別屬於該活動 → 暱稱合法 → 組內暱稱不重複。
   * 任何階段都可加入；每組人數不設上限。
   */
  join(
    roomCode: string,
    input: { teamId: string; nickname: string },
  ): { token: string; memberId: string; teamId: string; sessionId: string } {
    const { repo, clock, ids, broadcaster } = this.deps;
    const result = withTransaction(repo.db, () => {
      const session = repo.getSessionByRoomCode(normalizeRoomCode(roomCode));
      if (!session) throw new AppError('SESSION_NOT_FOUND');
      assertPhase(session.phase, 'join');
      const team = repo.getTeam(input.teamId);
      if (!team || team.sessionId !== session.id) throw new AppError('TEAM_NOT_FOUND');
      const nickname = normalizeNickname(input.nickname);
      const key = nicknameKey(nickname);
      if (repo.nicknameKeyExists(team.id, key)) throw new AppError('NICKNAME_TAKEN');

      const now = clock.now();
      const member: Member = {
        id: ids.id('mem'),
        teamId: team.id,
        nickname,
        token: ids.token(),
        joinedAt: now,
        lastSeenAt: now,
      };
      repo.insertMember(member, key);
      return { token: member.token, memberId: member.id, teamId: team.id, sessionId: session.id };
    });
    broadcaster.publish(result.sessionId, { teacher: true, teamIds: [result.teamId] });
    return result;
  }

  /** 以學生 token 找回成員與所屬活動；查無 → UNAUTHORIZED */
  resolveMember(token: string): Member & { sessionId: string } {
    const { repo } = this.deps;
    const member = repo.getMemberByToken(token);
    const team = member ? repo.getTeam(member.teamId) : null;
    if (!member || !team) throw new AppError('UNAUTHORIZED');
    return { ...member, sessionId: team.sessionId };
  }

  /** 學生所屬組的視圖（只含本組資料） */
  getTeamView(memberToken: string): TeamView {
    const member = this.resolveMember(memberToken);
    return projectTeamView(this.loadAggregate(member.sessionId), member.teamId, this.deps.clock.now());
  }

  /**
   * 更新本組草稿（spec FR-014～016a；data-model §6）：
   * 階段 RUNNING → 題目屬於活動 → 格數 = 子題數 → 每格 ≤ 200 字（不 trim、允許空字串）
   * → 本組該題還沒有有效或被判錯的送出。整題覆蓋（後到者取代），只推播給本組（老師看不到草稿）。
   */
  updateDraft(memberToken: string, questionId: string, answers: string[]): void {
    const { repo, clock, broadcaster } = this.deps;
    this.runTx((after) => {
      const member = this.resolveMember(memberToken);
      const session = this.requireSession(member.sessionId);
      assertPhase(session.phase, 'draft');
      const q = this.requireQuestion(session.id, questionId);
      if (answers.length !== q.subCount) throw new AppError('INVALID_INPUT');
      if (answers.some((a) => a.length > MAX_ANSWER_LENGTH)) throw new AppError('ANSWER_TOO_LONG');
      if (this.hasLiveSubmission(member.teamId, q.id)) throw new AppError('ALREADY_SUBMITTED');
      repo.upsertDraft({ teamId: member.teamId, questionId: q.id, answers: [...answers], updatedBy: member.id, updatedAt: clock.now() });
      after(() => broadcaster.publish(session.id, { teacher: false, teamIds: [member.teamId] }));
    });
  }

  /**
   * 送出答案（TECH_SPEC §7.9 submit 演算法；FR-07、FR-08、FR-11）。
   * 步驟 1～9 在單一同步交易中完成（中間沒有 await），因此同一題的送出會被逐筆處理，
   * 序號 seq 與名次鍵 orderKey 不會重複，同一題只會有一位得主。
   * 伺服器時間一律取 clock.now()，不採用任何客戶端時間。
   */
  submit(
    memberToken: string,
    questionId: string,
    answers: string[],
  ): { submissionId: string; serverTime: number; withdrawableUntil: number } {
    const { repo, clock, ids, scheduler, broadcaster } = this.deps;
    return this.runTx((after) => {
      // 1. 成員與所屬活動（token 無效 → UNAUTHORIZED）
      const member = this.resolveMember(memberToken);
      const session = this.requireSession(member.sessionId);
      // 2. 只有搶答中可以送出 → INVALID_PHASE
      assertPhase(session.phase, 'submit');
      // 3. 題目必須屬於該活動 → QUESTION_NOT_FOUND
      const q = this.requireQuestion(session.id, questionId);
      // 4～5. 格數、trim 後不可為空（題組 GROUP_INCOMPLETE／單題 ANSWER_REQUIRED）、每格 ≤ 200 字；回傳 trim 後的值
      const trimmed = validateAnswers(answers, q.subCount, q.isGroup);
      // 6. 本組該題已有有效或被判錯的送出 → ALREADY_SUBMITTED（唯一索引也會擋下同時送出的第二筆）
      if (this.hasLiveSubmission(member.teamId, q.id)) throw new AppError('ALREADY_SUBMITTED');
      // 7. 伺服器時間與全域序號
      const now = clock.now();
      const seq = repo.nextSeq();
      // 8. 依判定模式決定名次鍵與題目狀態
      let orderKey: number | null;
      if (session.fairnessMode === 'speed') {
        // 8a. 純速度：依送達順序直接給下一個名次鍵，題目立即判定
        orderKey = nextOrderKey(repo.listSubmissionsByQuestion(q.id));
        repo.updateQuestionState(q.id, 'settled', null);
      } else if (q.state === 'open') {
        // 8b. 公平模式、第一筆送出：開啟視窗，名次鍵待視窗結束時結算；COMMIT 後才排程
        orderKey = null;
        const windowEndsAt = now + session.windowSec * 1000;
        repo.updateQuestionState(q.id, 'window', windowEndsAt);
        after(() => scheduler.schedule(windowKey(q.id), windowEndsAt, () => this.onWindowDue(session.id)));
      } else if (q.state === 'window') {
        // 8c. 視窗中：列入候選（含 now ≥ windowEndsAt 但排程尚未觸發的情況，research R-05）
        orderKey = null;
      } else {
        // 8d. 視窗已結算：排在已判定名次之後
        orderKey = nextOrderKey(repo.listSubmissionsByQuestion(q.id));
      }
      // 9. 新增送出（status=active），並刪除本組該題草稿
      const submissionId = ids.id('sub');
      repo.insertSubmission({
        id: submissionId,
        sessionId: session.id,
        questionId: q.id,
        teamId: member.teamId,
        memberId: member.id,
        answers: trimmed,
        serverTime: now,
        seq,
        status: 'active',
        orderKey,
        withdrawnAt: null,
      });
      repo.deleteDraft(member.teamId, q.id);
      // 10. 提交交易後推播給老師與全部組
      after(() => broadcaster.publish(session.id));
      // 11. 回傳伺服器時間與可撤回期限
      return { submissionId, serverTime: now, withdrawableUntil: now + WITHDRAW_LIMIT_MS };
    });
  }

  /**
   * 撤回本組的送出（spec FR-027～032；data-model §6）：
   * 階段 RUNNING → 送出存在且屬於本組（他組或不存在一律 SUBMISSION_NOT_FOUND，不透露他組送出是否存在）
   * → 狀態為有效 → 送出後 10000 毫秒內（恰好 10000 允許）。
   * 得主撤回後不需另外處理：ranking 排除 withdrawn，下一位自動遞補、分數自動重算。
   * 公平模式視窗中若已沒有候選，題目回到 open 並取消排程，下一筆送出會重新開窗。
   */
  withdraw(memberToken: string, submissionId: string): void {
    const { repo, clock, scheduler, broadcaster } = this.deps;
    this.runTx((after) => {
      const member = this.resolveMember(memberToken);
      const session = this.requireSession(member.sessionId);
      assertPhase(session.phase, 'withdraw');
      const sub = repo.getSubmission(submissionId);
      if (!sub || sub.teamId !== member.teamId) throw new AppError('SUBMISSION_NOT_FOUND');
      if (sub.status !== 'active') throw new AppError('INVALID_STATE');
      const now = clock.now();
      if (now - sub.serverTime > WITHDRAW_LIMIT_MS) throw new AppError('WITHDRAW_WINDOW_EXPIRED');

      repo.updateSubmission(sub.id, { status: 'withdrawn', withdrawnAt: now });
      const q = repo.getQuestion(sub.questionId);
      if (q?.state === 'window') {
        const hasCandidate = repo
          .listSubmissionsByQuestion(q.id)
          .some((s) => s.status === 'active' && s.orderKey === null);
        if (!hasCandidate) {
          repo.updateQuestionState(q.id, 'open', null);
          after(() => scheduler.cancel(windowKey(q.id)));
        }
      }
      after(() => broadcaster.publish(session.id));
    });
  }

  // ---------- 公平模式視窗結算 ----------

  /**
   * 結算單一題目的視窗（TECH_SPEC §7.9 settleWindow 演算法步驟 1～8），由排程呼叫。
   * 冪等：題目已不在視窗中（已結算、或視窗被撤回關閉）時直接返回，不寫入也不推播。
   * 只結算指定的題目；多題同時到期的順序由 onWindowDue 負責。
   */
  settleWindow(questionId: string): void {
    const { repo, broadcaster } = this.deps;
    this.runTx((after) => {
      // 1. 題目不在視窗中 → 直接返回
      const q = repo.getQuestion(questionId);
      if (!q || q.state !== 'window') return;
      // 2～7. 結算（或沒有候選時回到 open）；8. COMMIT 後推播給全部
      this.settleInTx(q);
      after(() => broadcaster.publish(q.sessionId));
    });
  }

  /**
   * settleWindow 演算法步驟 2～7（必須在交易內呼叫）：
   * - 候選＝該題有效且尚未有名次鍵的送出；沒有候選（全部撤回）→ 題目回到 open。
   * - 有候選 → 依「結算當下」各組分數（其他已結算題目的得主）低者優先、較早送出、seq 小者排序，
   *   從該題下一個名次鍵開始依序配發，題目設為 settled。
   * 多題依 (windowEndsAt, 題號) 逐題呼叫時，前一題的結果會計入後一題的分數（spec FR-023）。
   */
  private settleInTx(q: Question): void {
    const { repo } = this.deps;
    const subs = repo.listSubmissionsByQuestion(q.id);
    const cands = subs.filter((s) => s.status === 'active' && s.orderKey === null);
    if (cands.length === 0) {
      repo.updateQuestionState(q.id, 'open', null);
      return;
    }
    const scores = teamScores(repo.listTeams(q.sessionId), groupByQuestion(repo.listSubmissions(q.sessionId)));
    const sorted = sortFairCandidates(cands, scores);
    for (const [id, orderKey] of assignOrderKeys(sorted, nextOrderKey(subs))) {
      repo.updateSubmission(id, { orderKey });
    }
    repo.updateQuestionState(q.id, 'settled', null);
  }

  /**
   * 視窗到期的排程回呼（research R-04、R-09）：取同活動中所有已到期的視窗，
   * 依 (windowEndsAt, 題號) 順序逐題呼叫 settleWindow——排程器對同一時間的觸發順序不一定依題號。
   * 之後輪到的其他回呼會發現題目已結算而直接返回。
   * 每題各自 try/catch：一題失敗只記錄，不影響其他題目，也不讓例外拋回計時器。
   */
  private onWindowDue(sessionId: string): void {
    const now = this.deps.clock.now();
    const due = sortByWindow(
      this.deps.repo
        .listQuestions(sessionId)
        .filter((q) => q.state === 'window' && q.windowEndsAt !== null && q.windowEndsAt <= now),
    );
    for (const q of due) {
      try {
        this.settleWindow(q.id);
      } catch (e) {
        console.error('視窗結算失敗', sessionId, q.id, e);
      }
    }
  }

  /**
   * 啟動恢復（TECH_SPEC §7.12、research R-08），由 index.ts 在 listen 前經 boot/recover.ts 呼叫：
   * - 上線狀態只存記憶體，一律重設為離線；
   * - 每個搶答中的活動：已過期的視窗依 (windowEndsAt, 題號) 立即結算（同一交易），
   *   COMMIT 後對未到期的視窗重新排程；有結算的活動推播一次。
   */
  recover(): void {
    const { repo, clock, scheduler, broadcaster } = this.deps;
    this.onlineMemberIds.clear();
    for (const session of repo.listSessionsByPhase('RUNNING')) {
      this.runTx((after) => {
        const now = clock.now();
        const windows = sortByWindow(repo.listQuestions(session.id).filter((q) => q.state === 'window'));
        const expired = windows.filter((q) => q.windowEndsAt !== null && q.windowEndsAt <= now);
        for (const q of expired) this.settleInTx(q);
        for (const q of windows) {
          if (expired.includes(q) || q.windowEndsAt === null) continue;
          const at = q.windowEndsAt;
          after(() => scheduler.schedule(windowKey(q.id), at, () => this.onWindowDue(session.id)));
        }
        if (expired.length > 0) after(() => broadcaster.publish(session.id));
      });
    }
  }

  /** 題目必須存在且屬於該活動，否則 QUESTION_NOT_FOUND（不透露別的活動的題目） */
  private requireQuestion(sessionId: string, questionId: string): Question {
    const q = this.deps.repo.getQuestion(questionId);
    if (!q || q.sessionId !== sessionId) throw new AppError('QUESTION_NOT_FOUND');
    return q;
  }

  /** 本組該題是否已有有效（active）或被判錯（rejected）的送出；撤回的不算（FR-08） */
  private hasLiveSubmission(teamId: string, questionId: string): boolean {
    return this.deps.repo
      .listSubmissionsByQuestion(questionId)
      .some((s) => s.teamId === teamId && (s.status === 'active' || s.status === 'rejected'));
  }

  // ---------- 連線狀態 ----------

  /**
   * 更新成員上線狀態（research R-09）。多分頁的連線計數由 realtime/socket.ts 負責，
   * 只在「第一個分頁連上」與「最後一個分頁斷線」時呼叫本方法。
   * 狀態沒有改變時不做任何事；有改變時更新 lastSeenAt，並只推播給老師與該成員所屬組。
   */
  setOnline(memberId: string, online: boolean): void {
    if (this.onlineMemberIds.has(memberId) === online) return;
    const { repo, clock, broadcaster } = this.deps;
    const member = repo.getMember(memberId);
    const team = member ? repo.getTeam(member.teamId) : null;
    if (!member || !team) return; // 成員已不存在（例如組別被刪除），不需推播
    if (online) this.onlineMemberIds.add(memberId);
    else this.onlineMemberIds.delete(memberId);
    repo.touchMember(memberId, clock.now());
    broadcaster.publish(team.sessionId, { teacher: true, teamIds: [team.id] });
  }
}
