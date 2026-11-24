// 視圖投影（TECH_SPEC §7.8）：把活動的完整資料轉成老師或某一組看得到的視圖。全部是純函式。
// 001：session、teams、members；002：questionInfo、TeacherView 的 questions 與 importSummary、TeamView 的 questions；
// 003：TeacherView 的 cells、winnerTeamId、score，TeamView 的 drafts、mySubmissions、results，以及 buildResults。
// 得主、順位、分數不存資料庫，一律由 ranking.ts 從送出紀錄推導。
import { WITHDRAW_LIMIT_MS } from '@quiz/shared';
import type {
  AnswerSlot,
  Draft,
  ImportSummary,
  Member,
  Question,
  QuestionInfo,
  Results,
  Session,
  Submission,
  Team,
  TeacherCell,
  TeacherView,
  TeamView,
} from '@quiz/shared';
import { rankSubmissions, teamScores, winnerOf } from './ranking.js';
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

/** 送出紀錄依題目分組（每題各自排名，research R-13：每次投影只分組一次） */
function submissionsByQuestion(agg: SessionAggregate): Map<string, Submission[]> {
  const map = new Map<string, Submission[]>(agg.questions.map((q) => [q.id, []]));
  for (const s of agg.submissions) {
    const list = map.get(s.questionId);
    if (list) list.push(s);
  }
  return map;
}

/** 某組某題最新的一筆送出（seq 最大）；沒有則 null */
function latestOf(subs: Submission[], teamId: string): Submission | null {
  let latest: Submission | null = null;
  for (const s of subs) {
    if (s.teamId === teamId && (latest === null || s.seq > latest.seq)) latest = s;
  }
  return latest;
}

/** 查表；查無時回傳預設值（Map.get 的結果統一在此處理） */
function lookup<K, V>(map: Map<K, V>, key: K, fallback: V): V {
  return map.has(key) ? (map.get(key) as V) : fallback;
}

/** 成員 id → 暱稱（送出者顯示用） */
function nicknameMap(agg: SessionAggregate): Map<string, string> {
  return new Map(agg.members.map((m) => [m.id, m.nickname]));
}

/**
 * 老師視圖：全部組別、成員（含上線狀態）、每題 × 每組的送出狀態、得主與分數。
 * 老師視圖不含草稿（spec FR-015）。
 */
export function projectTeacherView(agg: SessionAggregate, now: number): TeacherView {
  const byQ = submissionsByQuestion(agg);
  const scores = teamScores(agg.teams, byQ);
  const nick = nicknameMap(agg);
  const teamsSorted = [...agg.teams].sort((a, b) => a.index - b.index);
  const questions = sortedQuestions(agg);

  const cells: TeacherCell[] = [];
  const winnerByQ = new Map<string, Submission | null>();
  for (const q of questions) {
    const subs = lookup(byQ, q.id, []);
    const ranked = rankSubmissions(subs);
    const rankById = new Map(ranked.map((r) => [r.id, r.rank]));
    const winner = winnerOf(subs);
    winnerByQ.set(q.id, winner);
    for (const t of teamsSorted) {
      // 同組同題可能有多筆（撤回後重送），只顯示最新一筆
      const s = latestOf(subs, t.id);
      cells.push({
        questionId: q.id,
        teamId: t.id,
        submission:
          s === null
            ? null
            : {
                id: s.id,
                answers: [...s.answers],
                submittedBy: lookup(nick, s.memberId, ''),
                serverTime: s.serverTime,
                status: s.status,
                // 視窗中（尚未結算）或撤回（rankSubmissions 已排除）沒有順位
                rank: s.orderKey === null ? null : lookup(rankById, s.id, null),
                isWinner: winner !== null && winner.id === s.id,
              },
      });
    }
  }

  return {
    session: { ...agg.session },
    questions: questions.map((q) => ({
      ...questionInfo(q, agg.slots),
      state: q.state,
      windowEndsAt: q.windowEndsAt,
      winnerTeamId: winnerByQ.get(q.id)?.teamId ?? null,
    })),
    teams: teamsSorted.map((t) => ({ ...t, score: lookup(scores, t.id, 0), members: memberList(agg, t.id) })),
    cells,
    importSummary: agg.importSummary,
    serverNow: now,
  };
}

/**
 * 某一組的視圖（資訊隔離，憲章原則 IV／FR-10）：
 * - 成員、草稿、送出一律只取 teamId 相同者，其他組的暱稱、答案、成員 id、送出 id 都不會進入視圖；
 * - mySubmissions 以白名單逐欄建立，不展開 Submission，因此不會帶出 orderKey、seq 等欄位；
 * - 不含名次、得主、分數、題目狀態與視窗時間；只有活動「已結束」時才附上 results。
 * 過濾在伺服器端完成，學生端收到的資料本身就不含他組內容。
 */
export function projectTeamView(agg: SessionAggregate, teamId: string, now: number): TeamView {
  const team = agg.teams.find((t) => t.id === teamId);
  if (!team) {
    throw new Error(`projectTeamView: team ${teamId} 不屬於此活動`);
  }
  const nick = nicknameMap(agg);
  const questions = sortedQuestions(agg);

  const drafts: TeamView['drafts'] = {};
  for (const d of agg.drafts) {
    if (d.teamId !== teamId) continue;
    drafts[d.questionId] = { answers: [...d.answers], updatedBy: d.updatedBy, updatedAt: d.updatedAt };
  }

  const ownByQ = submissionsByQuestion({ ...agg, submissions: agg.submissions.filter((s) => s.teamId === teamId) });
  const mySubmissions: TeamView['mySubmissions'] = {};
  for (const q of questions) {
    // 本組該題最新一筆（seq 最大）
    const latest = latestOf(lookup(ownByQ, q.id, []), teamId);
    if (!latest) continue;
    mySubmissions[q.id] = {
      id: latest.id,
      answers: [...latest.answers],
      submittedBy: lookup(nick, latest.memberId, ''),
      serverTime: latest.serverTime,
      status: latest.status,
      withdrawableUntil: latest.status === 'active' ? latest.serverTime + WITHDRAW_LIMIT_MS : null,
    };
  }

  return {
    session: { roomCode: agg.session.roomCode, phase: agg.session.phase, round: agg.session.round },
    team: { id: team.id, name: team.name, members: memberList(agg, team.id) },
    // 學生只收到題號資訊（不含題目狀態，FR-10）
    questions: questions.map((q) => questionInfo(q, agg.slots)),
    drafts,
    mySubmissions,
    // 結果只在活動結束後提供（FR-09、FR-10）
    results: agg.session.phase === 'ENDED' ? buildResults(agg) : null,
    serverNow: now,
  };
}

/**
 * 完整結果（FR-05、FR-09）：每題的得主與名次（含被判錯、不含撤回），以及各組分數。
 * scores 依分數降冪 → 組序升冪。
 */
export function buildResults(agg: SessionAggregate): Results {
  const byQ = submissionsByQuestion(agg);
  const nick = nicknameMap(agg);
  const teamName = new Map(agg.teams.map((t) => [t.id, t.name]));
  const scores = teamScores(agg.teams, byQ);

  const questions: Results['questions'] = sortedQuestions(agg).map((q) => {
    const subs = lookup(byQ, q.id, []);
    const winner = winnerOf(subs);
    const info = questionInfo(q, agg.slots);
    return {
      questionId: q.id,
      number: q.number,
      isGroup: q.isGroup,
      subLabels: info.subLabels,
      winner:
        winner === null
          ? null
          : {
              teamId: winner.teamId,
              teamName: lookup(teamName, winner.teamId, ''),
              answers: [...winner.answers],
              submittedBy: lookup(nick, winner.memberId, ''),
            },
      // rankSubmissions 已排除 withdrawn，剩下的狀態只有 active 與 rejected
      ranking: rankSubmissions(subs).map((r) => ({
        rank: r.rank,
        teamId: r.teamId,
        teamName: lookup(teamName, r.teamId, ''),
        answers: [...r.answers],
        submittedBy: lookup(nick, r.memberId, ''),
        serverTime: r.serverTime,
        status: r.status as 'active' | 'rejected',
        isWinner: r.isWinner,
      })),
    };
  });

  const scoreRows = [...agg.teams]
    .sort((a, b) => lookup(scores, b.id, 0) - lookup(scores, a.id, 0) || a.index - b.index)
    .map((t) => ({ teamId: t.id, teamName: t.name, score: lookup(scores, t.id, 0) }));

  return { questions, scores: scoreRows };
}