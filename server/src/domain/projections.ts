// 視圖投影（TECH_SPEC §7.8）：把活動的完整資料轉成老師或某一組看得到的視圖。
// 001 只投影 session、teams、members；題目、作答、結果相關欄位一律回傳空值（002–004 補上）。
import type {
  AnswerSlot,
  Draft,
  Member,
  Question,
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
    questions: [],
    teams,
    cells: [],
    importSummary: null,
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
    questions: [],
    drafts: {},
    mySubmissions: {},
    results: null,
    serverNow: now,
  };
}
