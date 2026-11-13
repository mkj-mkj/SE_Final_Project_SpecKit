// 活動服務（TECH_SPEC §7.9）。001：createSession、getCurrentSession、getTeacherView、
// updateSettings、getPublicInfo、join、resolveMember、getTeamView、setOnline；002：importSheet。
import {
  AppError,
  DEFAULT_FAIRNESS_MODE,
  DEFAULT_TEAM_COUNT,
  DEFAULT_WINDOW_SEC,
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
  type Session,
  type TeacherView,
  type TeamView,
} from '@quiz/shared';
import { z } from 'zod';
import { withTransaction } from '../db/db.js';
import type { Repo } from '../db/repo.js';
import { assertPhase, nextPhase } from '../domain/phase.js';
import { projectTeacherView, projectTeamView, type SessionAggregate } from '../domain/projections.js';
import type { Clock } from '../ports/clock.js';
import type { IdGen } from '../ports/ids.js';
import type { Scheduler } from '../ports/scheduler.js';
import type { SheetsGateway } from '../ports/sheetsGateway.js';
import type { Broadcaster } from '../realtime/broadcaster.js';
import { parseSpreadsheetInput } from '../sheets/a1.js';
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

  /** 載入活動完整資料（供投影與 broadcaster 使用）；草稿與送出紀錄由 003 補上 */
  loadAggregate(sessionId: string): SessionAggregate {
    const { repo } = this.deps;
    return {
      session: this.requireSession(sessionId),
      questions: repo.listQuestions(sessionId),
      slots: repo.listSlotsBySession(sessionId),
      teams: repo.listTeams(sessionId),
      members: repo.listMembersBySession(sessionId),
      drafts: [],
      submissions: [],
      onlineMemberIds: new Set(this.onlineMemberIds),
      importSummary: repo.getImportSummary(sessionId),
    };
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
