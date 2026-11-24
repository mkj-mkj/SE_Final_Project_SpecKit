// 型別化的資料存取（TECH_SPEC §5）。001：sessions、teams、members；002：questions、answer_slots、import_summary；
// 003：drafts、submissions、seq、題目狀態、依階段查詢活動。全部使用參數化查詢（$name 具名參數）。
import {
  AppError,
  type AnswerSlot,
  type Draft,
  type FairnessMode,
  type ImportSummary,
  type Member,
  type Phase,
  type Question,
  type QuestionState,
  type Session,
  type Submission,
  type SubmissionStatus,
  type Team,
} from '@quiz/shared';
import type { Db } from './db.js';

type Row = Record<string, unknown>;

function toSession(r: Row): Session {
  return {
    id: r.id as string,
    roomCode: r.room_code as string,
    phase: r.phase as Phase,
    spreadsheetId: (r.spreadsheet_id as string | null) ?? null,
    sheetTitle: (r.sheet_title as string | null) ?? null,
    fairnessMode: r.fairness_mode as FairnessMode,
    windowSec: Number(r.window_sec),
    teamCount: Number(r.team_count),
    round: Number(r.round),
    createdAt: Number(r.created_at),
    startedAt: r.started_at === null ? null : Number(r.started_at),
    endedAt: r.ended_at === null ? null : Number(r.ended_at),
  };
}

function toTeam(r: Row): Team {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    index: Number(r.idx),
    name: r.name as string,
  };
}

function toMember(r: Row): Member {
  return {
    id: r.id as string,
    teamId: r.team_id as string,
    nickname: r.nickname as string,
    token: r.token as string,
    joinedAt: Number(r.joined_at),
    lastSeenAt: Number(r.last_seen_at),
  };
}

function toQuestion(r: Row): Question {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    number: Number(r.number),
    isGroup: Number(r.is_group) === 1,
    subCount: Number(r.sub_count),
    state: r.state as QuestionState,
    windowEndsAt: r.window_ends_at === null ? null : Number(r.window_ends_at),
  };
}

function toSlot(r: Row): AnswerSlot {
  return {
    id: r.id as string,
    questionId: r.question_id as string,
    subNo: Number(r.sub_no),
    sheetTitle: r.sheet_title as string,
    row: Number(r.row),
    col: Number(r.col),
    a1: r.a1 as string,
    prefix: r.prefix as string,
    originalValue: r.original_value as string,
  };
}

function toDraft(r: Row): Draft {
  return {
    teamId: r.team_id as string,
    questionId: r.question_id as string,
    answers: JSON.parse(r.answers as string) as string[],
    updatedBy: r.updated_by as string,
    updatedAt: Number(r.updated_at),
  };
}

function toSubmission(r: Row): Submission {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    questionId: r.question_id as string,
    teamId: r.team_id as string,
    memberId: r.member_id as string,
    answers: JSON.parse(r.answers as string) as string[],
    serverTime: Number(r.server_time),
    seq: Number(r.seq),
    status: r.status as SubmissionStatus,
    orderKey: r.order_key === null ? null : Number(r.order_key),
    withdrawnAt: r.withdrawn_at === null ? null : Number(r.withdrawn_at),
  };
}

/** 唯一索引 uq_sub_team_q_live(team_id, question_id) 衝突：本組該題已有 active／rejected（research R-03） */
function isLiveSubmissionConflict(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed: submissions\.team_id, submissions\.question_id/.test(e.message);
}

/** SQLite 的 UNIQUE(team_id, nickname_key) 衝突 */
function isNicknameConflict(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed: members\.team_id, members\.nickname_key/.test(e.message);
}

export class Repo {
  /** 本實例上次發出的 seq（research R-02：與資料庫 MAX(seq) 取大者再 +1，確保嚴格遞增） */
  private lastSeq = 0;

  constructor(readonly db: Db) {}

  // ---------- sessions ----------
  insertSession(s: Session): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, room_code, phase, spreadsheet_id, sheet_title, fairness_mode,
           window_sec, team_count, round, created_at, started_at, ended_at)
         VALUES ($id, $roomCode, $phase, $spreadsheetId, $sheetTitle, $fairnessMode,
           $windowSec, $teamCount, $round, $createdAt, $startedAt, $endedAt)`,
      )
      .run({ ...s });
  }

  getSession(id: string): Session | null {
    const r = this.db.prepare('SELECT * FROM sessions WHERE id = $id').get({ id }) as Row | undefined;
    return r ? toSession(r) : null;
  }

  getSessionByRoomCode(roomCode: string): Session | null {
    const r = this.db.prepare('SELECT * FROM sessions WHERE room_code = $roomCode').get({ roomCode }) as
      | Row
      | undefined;
    return r ? toSession(r) : null;
  }

  roomCodeExists(roomCode: string): boolean {
    return this.db.prepare('SELECT 1 FROM sessions WHERE room_code = $roomCode').get({ roomCode }) !== undefined;
  }

  /** 最新建立的活動；同毫秒時以 rowid 較大者為準（research R-06） */
  getLatestSession(): Session | null {
    const r = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC, rowid DESC LIMIT 1').get() as
      | Row
      | undefined;
    return r ? toSession(r) : null;
  }

  updateSession(s: Session): void {
    this.db
      .prepare(
        `UPDATE sessions SET room_code = $roomCode, phase = $phase, spreadsheet_id = $spreadsheetId,
           sheet_title = $sheetTitle, fairness_mode = $fairnessMode, window_sec = $windowSec,
           team_count = $teamCount, round = $round, created_at = $createdAt,
           started_at = $startedAt, ended_at = $endedAt
         WHERE id = $id`,
      )
      .run({ ...s });
  }

  // ---------- teams ----------
  insertTeam(t: Team): void {
    this.db
      .prepare('INSERT INTO teams (id, session_id, idx, name) VALUES ($id, $sessionId, $index, $name)')
      .run({ ...t });
  }

  /** 依組序排列 */
  listTeams(sessionId: string): Team[] {
    const rows = this.db.prepare('SELECT * FROM teams WHERE session_id = $sessionId ORDER BY idx').all({ sessionId });
    return (rows as Row[]).map(toTeam);
  }

  getTeam(id: string): Team | null {
    const r = this.db.prepare('SELECT * FROM teams WHERE id = $id').get({ id }) as Row | undefined;
    return r ? toTeam(r) : null;
  }

  deleteTeamsAbove(sessionId: string, idx: number): void {
    this.db.prepare('DELETE FROM teams WHERE session_id = $sessionId AND idx > $idx').run({ sessionId, idx });
  }

  countMembersInTeamsAbove(sessionId: string, idx: number): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM members m JOIN teams t ON t.id = m.team_id
         WHERE t.session_id = $sessionId AND t.idx > $idx`,
      )
      .get({ sessionId, idx }) as Row;
    return Number(r.n);
  }

  // ---------- members ----------
  /** nicknameKey 由呼叫端計算；組內重複（UNIQUE 衝突）時轉成 NICKNAME_TAKEN */
  insertMember(m: Member, nicknameKey: string): void {
    try {
      this.db
        .prepare(
          `INSERT INTO members (id, team_id, nickname, nickname_key, token, joined_at, last_seen_at)
           VALUES ($id, $teamId, $nickname, $nicknameKey, $token, $joinedAt, $lastSeenAt)`,
        )
        .run({ ...m, nicknameKey });
    } catch (e) {
      if (isNicknameConflict(e)) throw new AppError('NICKNAME_TAKEN');
      throw e;
    }
  }

  nicknameKeyExists(teamId: string, nicknameKey: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM members WHERE team_id = $teamId AND nickname_key = $nicknameKey')
        .get({ teamId, nicknameKey }) !== undefined
    );
  }

  getMemberByToken(token: string): Member | null {
    const r = this.db.prepare('SELECT * FROM members WHERE token = $token').get({ token }) as Row | undefined;
    return r ? toMember(r) : null;
  }

  getMember(id: string): Member | null {
    const r = this.db.prepare('SELECT * FROM members WHERE id = $id').get({ id }) as Row | undefined;
    return r ? toMember(r) : null;
  }

  /** 該活動所有成員，依加入順序 */
  listMembersBySession(sessionId: string): Member[] {
    const rows = this.db
      .prepare(
        `SELECT m.* FROM members m JOIN teams t ON t.id = m.team_id
         WHERE t.session_id = $sessionId ORDER BY m.joined_at, m.rowid`,
      )
      .all({ sessionId });
    return (rows as Row[]).map(toMember);
  }

  /** teamId → 成員數（沒有成員的組不在結果中） */
  countMembersByTeam(sessionId: string): Map<string, number> {
    const rows = this.db
      .prepare(
        `SELECT m.team_id AS teamId, COUNT(*) AS n FROM members m JOIN teams t ON t.id = m.team_id
         WHERE t.session_id = $sessionId GROUP BY m.team_id`,
      )
      .all({ sessionId }) as Row[];
    return new Map(rows.map((r) => [r.teamId as string, Number(r.n)]));
  }

  touchMember(memberId: string, lastSeenAt: number): void {
    this.db
      .prepare('UPDATE members SET last_seen_at = $lastSeenAt WHERE id = $memberId')
      .run({ memberId, lastSeenAt });
  }

  // ---------- 匯入摘要（sessions.import_summary，JSON） ----------
  /** 未匯入時為 null */
  getImportSummary(sessionId: string): ImportSummary | null {
    const r = this.db.prepare('SELECT import_summary FROM sessions WHERE id = $sessionId').get({ sessionId }) as
      | Row
      | undefined;
    const raw = r?.import_summary as string | null | undefined;
    return raw ? (JSON.parse(raw) as ImportSummary) : null;
  }

  setImportSummary(sessionId: string, summary: ImportSummary): void {
    this.db
      .prepare('UPDATE sessions SET import_summary = $summary WHERE id = $sessionId')
      .run({ sessionId, summary: JSON.stringify(summary) });
  }

  // ---------- questions、answer_slots ----------
  /** 刪除該活動所有題目；answer_slots、drafts、submissions 以 ON DELETE CASCADE 連帶刪除 */
  deleteQuestionsBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM questions WHERE session_id = $sessionId').run({ sessionId });
  }

  insertQuestion(q: Question): void {
    this.db
      .prepare(
        `INSERT INTO questions (id, session_id, number, is_group, sub_count, state, window_ends_at)
         VALUES ($id, $sessionId, $number, $isGroup, $subCount, $state, $windowEndsAt)`,
      )
      .run({ ...q, isGroup: q.isGroup ? 1 : 0 });
  }

  insertSlot(s: AnswerSlot): void {
    this.db
      .prepare(
        `INSERT INTO answer_slots (id, question_id, sub_no, sheet_title, row, col, a1, prefix, original_value)
         VALUES ($id, $questionId, $subNo, $sheetTitle, $row, $col, $a1, $prefix, $originalValue)`,
      )
      .run({ ...s });
  }

  /** 依題號升冪 */
  listQuestions(sessionId: string): Question[] {
    const rows = this.db
      .prepare('SELECT * FROM questions WHERE session_id = $sessionId ORDER BY number')
      .all({ sessionId }) as Row[];
    return rows.map(toQuestion);
  }

  /** 該活動所有作答格，依題目、子題編號排序 */
  listSlotsBySession(sessionId: string): AnswerSlot[] {
    const rows = this.db
      .prepare(
        `SELECT s.* FROM answer_slots s JOIN questions q ON q.id = s.question_id
         WHERE q.session_id = $sessionId ORDER BY q.number, s.sub_no`,
      )
      .all({ sessionId }) as Row[];
    return rows.map(toSlot);
  }

  /** 單一題目；不存在為 null */
  getQuestion(id: string): Question | null {
    const r = this.db.prepare('SELECT * FROM questions WHERE id = $id').get({ id }) as Row | undefined;
    return r ? toQuestion(r) : null;
  }

  updateQuestionState(id: string, state: QuestionState, windowEndsAt: number | null): void {
    this.db
      .prepare('UPDATE questions SET state = $state, window_ends_at = $windowEndsAt WHERE id = $id')
      .run({ id, state, windowEndsAt });
  }

  /** start、reset：該活動所有題目回到 open、清除視窗結束時間 */
  resetQuestionStates(sessionId: string): void {
    this.db
      .prepare(`UPDATE questions SET state = 'open', window_ends_at = NULL WHERE session_id = $sessionId`)
      .run({ sessionId });
  }

  /** 依階段列出活動（recover 用），依建立時間排序 */
  listSessionsByPhase(phase: Phase): Session[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions WHERE phase = $phase ORDER BY created_at, rowid')
      .all({ phase }) as Row[];
    return rows.map(toSession);
  }

  // ---------- drafts（answers 為 JSON；不 trim） ----------
  /** 整題覆蓋（spec FR-016a：後到者整份取代） */
  upsertDraft(d: Draft): void {
    this.db
      .prepare(
        `INSERT INTO drafts (team_id, question_id, answers, updated_by, updated_at)
         VALUES ($teamId, $questionId, $answers, $updatedBy, $updatedAt)
         ON CONFLICT(team_id, question_id) DO UPDATE SET
           answers = excluded.answers, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .run({ ...d, answers: JSON.stringify(d.answers) });
  }

  deleteDraft(teamId: string, questionId: string): void {
    this.db
      .prepare('DELETE FROM drafts WHERE team_id = $teamId AND question_id = $questionId')
      .run({ teamId, questionId });
  }

  listDrafts(sessionId: string): Draft[] {
    const rows = this.db
      .prepare(
        `SELECT d.* FROM drafts d JOIN teams t ON t.id = d.team_id
         WHERE t.session_id = $sessionId ORDER BY t.idx, d.question_id`,
      )
      .all({ sessionId }) as Row[];
    return rows.map(toDraft);
  }

  deleteDraftsBySession(sessionId: string): void {
    this.db
      .prepare('DELETE FROM drafts WHERE team_id IN (SELECT id FROM teams WHERE session_id = $sessionId)')
      .run({ sessionId });
  }

  // ---------- submissions（answers 為 JSON） ----------
  /** 下一個全域序號：max(本實例上次發出的值, 資料庫 MAX(seq)) + 1（重啟後也不會重複） */
  nextSeq(): number {
    const r = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM submissions').get() as Row;
    this.lastSeq = Math.max(this.lastSeq, Number(r.m)) + 1;
    return this.lastSeq;
  }

  /** 本組該題已有 active／rejected 時，唯一索引衝突轉成 ALREADY_SUBMITTED */
  insertSubmission(s: Submission): void {
    try {
      this.db
        .prepare(
          `INSERT INTO submissions (id, session_id, question_id, team_id, member_id, answers,
             server_time, seq, status, order_key, withdrawn_at)
           VALUES ($id, $sessionId, $questionId, $teamId, $memberId, $answers,
             $serverTime, $seq, $status, $orderKey, $withdrawnAt)`,
        )
        .run({ ...s, answers: JSON.stringify(s.answers) });
    } catch (e) {
      if (isLiveSubmissionConflict(e)) throw new AppError('ALREADY_SUBMITTED');
      throw e;
    }
  }

  getSubmission(id: string): Submission | null {
    const r = this.db.prepare('SELECT * FROM submissions WHERE id = $id').get({ id }) as Row | undefined;
    return r ? toSubmission(r) : null;
  }

  /** 只更新有提供的欄位 */
  updateSubmission(
    id: string,
    patch: { status?: SubmissionStatus; orderKey?: number | null; withdrawnAt?: number | null },
  ): void {
    const sets: string[] = [];
    const params: Record<string, string | number | null> = { id };
    if (patch.status !== undefined) {
      sets.push('status = $status');
      params.status = patch.status;
    }
    if (patch.orderKey !== undefined) {
      sets.push('order_key = $orderKey');
      params.orderKey = patch.orderKey;
    }
    if (patch.withdrawnAt !== undefined) {
      sets.push('withdrawn_at = $withdrawnAt');
      params.withdrawnAt = patch.withdrawnAt;
    }
    if (sets.length === 0) return;
    this.db.prepare(`UPDATE submissions SET ${sets.join(', ')} WHERE id = $id`).run(params);
  }

  /** 依 seq 升冪 */
  listSubmissions(sessionId: string): Submission[] {
    const rows = this.db
      .prepare('SELECT * FROM submissions WHERE session_id = $sessionId ORDER BY seq')
      .all({ sessionId }) as Row[];
    return rows.map(toSubmission);
  }

  /** 依 seq 升冪 */
  listSubmissionsByQuestion(questionId: string): Submission[] {
    const rows = this.db
      .prepare('SELECT * FROM submissions WHERE question_id = $questionId ORDER BY seq')
      .all({ questionId }) as Row[];
    return rows.map(toSubmission);
  }

  deleteSubmissionsBySession(sessionId: string): void {
    this.db.prepare('DELETE FROM submissions WHERE session_id = $sessionId').run({ sessionId });
  }
}