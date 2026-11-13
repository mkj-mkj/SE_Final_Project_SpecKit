// 視圖投影（TECH_SPEC §7.8）：把活動的完整資料轉成老師或某一組看得到的視圖。
// 001：session、teams、members；002：questionInfo、TeacherView 的 questions 與 importSummary、TeamView 的 questions。
// 作答、結果相關欄位仍回傳空值（003–004 補上）。
import type {
  AnswerSlot,
  Draft,
  ImportSummary,
  Member,
  Question,
  QuestionInfo,
  Session,
  Submission,
  Team,
  TeacherView,
  TeamView,
} from '@quiz/shared';

export interface SessionAggregate {
  session: Session;
  questions: Question[];
  slots: AnswerSlot[];
  teams: Team[];
  members: Member[];
  drafts: Draft[];
  submissions: Submission[];
  onlineMemberIds: Set<string>;
  importSummary: ImportSummary | null; // 讀自 sessions.import_summary（JSON）；未匯入為 null
}

/**
 * 題目對客戶端的表示（FR-02）：只有題號、是否題組、子題數與子題標籤，不含題目敘述、作答格位置或原始內容。
 * subLabels：題組取各子題前綴，沒有前綴時為「（子題編號）」；單題為 ['']。
 */
export function questionInfo(q: Question, slots: AnswerSlot[]): QuestionInfo {
  const own = slots.filter((s) => s.questionId === q.id).sort((a, b) => a.subNo - b.subNo);
  return {
    id: q.id,
    number: q.number,
    isGroup: q.isGroup,
    subCount: q.subCount,
    subLabels: q.isGroup ? own.map((s) => s.prefix || `（${s.subNo}）`) : [''],
  };
}

/** 依題號升冪 */
function sortedQuestions(agg: SessionAggregate): Question[] {
  return [...agg.questions].sort((a, b) => a.number - b.number);
}

/** 成員清單（只含 id、暱稱、上線狀態；不含 token 等敏感欄位） */
function memberList(agg: SessionAggregate, teamId: string): { id: string; nickname: string; online: boolean }[] {
  return agg.members
    .filter((m) => m.teamId === teamId)
    .map((m) => ({ id: m.id, nickname: m.nickname, online: agg.onlineMemberIds.has(m.id) }));
}

/** 老師視圖：全部組別與成員（含上線狀態）。001 沒有作答，score 一律為 0 */
export function projectTeacherView(agg: SessionAggregate, now: number): TeacherView {
  const teams = [...agg.teams]
    .sort((a, b) => a.index - b.index)
    .map((t) => ({ ...t, score: 0, members: memberList(agg, t.id) }));
  return {
    session: { ...agg.session },
    // state、windowEndsAt 原樣帶出資料庫值，winnerTeamId 固定 null（TECH_SPEC §14.1：由 003 改寫，得主由 003 計算）
    questions: sortedQuestions(agg).map((q) => ({
      ...questionInfo(q, agg.slots),
      state: q.state,
      windowEndsAt: q.windowEndsAt,
      winnerTeamId: null,
    })),
    teams,
    cells: [],
    importSummary: agg.importSummary,
    serverNow: now,
  };
}

/**
 * 某一組的視圖（資訊隔離，憲章原則 IV／FR-10）：
 * 只從 agg 取 teamId 相同的成員，其他組的暱稱、成員 id 一律不放入；
 * 過濾在伺服器端完成，學生端收到的資料本身就不含他組內容。
 */
export function projectTeamView(agg: SessionAggregate, teamId: string, now: number): TeamView {
  const team = agg.teams.find((t) => t.id === teamId);
  if (!team) {
    throw new Error(`projectTeamView: team ${teamId} 不屬於此活動`);
  }
  return {
    session: { roomCode: agg.session.roomCode, phase: agg.session.phase, round: agg.session.round },
    team: { id: team.id, name: team.name, members: memberList(agg, team.id) },
    // 學生只收到題號資訊（不含題目狀態，FR-10）
    questions: sortedQuestions(agg).map((q) => questionInfo(q, agg.slots)),
    drafts: {},
    mySubmissions: {},
    results: null,
    serverNow: now,
  };
}
