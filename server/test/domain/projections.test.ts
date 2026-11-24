import type { AnswerSlot, Draft, Member, Phase, Question, Session, Submission, SubmissionStatus, Team } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import {
  buildResults,
  projectTeacherView,
  projectTeamView,
  questionInfo,
  type SessionAggregate,
} from '../../src/domain/projections.js';

const NOW = 1_700_000_000_000;

// TEST_SPEC UT-PROJ 測試資料：2 組（A、B），B 的暱稱為 SECRETNICKB
function makeAgg(onlineMemberIds: string[]): SessionAggregate {
  const session: Session = {
    id: 'ses_1',
    roomCode: 'AAAAA2',
    phase: 'RUNNING',
    spreadsheetId: null,
    sheetTitle: null,
    fairnessMode: 'fair',
    windowSec: 3,
    teamCount: 2,
    round: 1,
    createdAt: NOW,
    startedAt: NOW,
    endedAt: null,
  };
  const teams: Team[] = [
    { id: 'team_A', sessionId: 'ses_1', index: 1, name: '第 1 組' },
    { id: 'team_B', sessionId: 'ses_1', index: 2, name: '第 2 組' },
  ];
  const member = (id: string, teamId: string, nickname: string): Member => ({
    id,
    teamId,
    nickname,
    token: `tok_${id}`,
    joinedAt: NOW,
    lastSeenAt: NOW,
  });
  return {
    session,
    questions: [],
    slots: [],
    teams,
    members: [member('mem_A1', 'team_A', 'Amy'), member('mem_A2', 'team_A', 'Ben'), member('mem_B1', 'team_B', 'SECRETNICKB')],
    drafts: [],
    submissions: [],
    onlineMemberIds: new Set(onlineMemberIds),
    importSummary: null,
  };
}

const question = (id: string, number: number, isGroup: boolean, subCount: number): Question => ({
  id,
  sessionId: 'ses_1',
  number,
  isGroup,
  subCount,
  state: 'open',
  windowEndsAt: null,
});
const slot = (questionId: string, subNo: number, prefix: string): AnswerSlot => ({
  id: `slot_${questionId}_${subNo}`,
  questionId,
  subNo,
  sheetTitle: '學習單',
  row: subNo,
  col: 6,
  a1: `G${subNo + 1}`,
  prefix,
  originalValue: prefix,
});

describe('projections', () => {
  it("UT-PROJ-01 questionInfo：題組有前綴、題組無前綴、單題 → ['（1）','（2）']、['（1）','（2）']、['']", () => {
    // slots 刻意打亂順序並混入其他題目的作答格，questionInfo 只取本題並依 subNo 排序
    const slots = [
      slot('q1', 2, '（2）'),
      slot('q2', 1, ''),
      slot('q1', 1, '（1）'),
      slot('q3', 1, ''),
      slot('q2', 2, ''),
    ];
    const withPrefix = questionInfo(question('q1', 1, true, 2), slots);
    expect(withPrefix).toEqual({ id: 'q1', number: 1, isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] });
    expect(questionInfo(question('q2', 2, true, 2), slots).subLabels).toEqual(['（1）', '（2）']);
    expect(questionInfo(question('q3', 3, false, 1), slots)).toEqual({
      id: 'q3',
      number: 3,
      isGroup: false,
      subCount: 1,
      subLabels: [''],
    });
  });

  it('UT-PROJ-10 onlineMemberIds 只有 A1 → TeacherView 中 A1 online=true，其他 false', () => {
    const view = projectTeacherView(makeAgg(['mem_A1']), NOW);
    const online = Object.fromEntries(view.teams.flatMap((t) => t.members.map((m) => [m.id, m.online])));
    expect(online).toEqual({ mem_A1: true, mem_A2: false, mem_B1: false });
  });
});

// ---------- 003：作答與結果（UT-PROJ-02～08），全部以手動建構的資料，不連資料庫 ----------

// 範例 A 的前兩種題型：第 1 題題組（2 子題）、第 3 題單題
const Q1 = question('q1', 1, true, 2);
const Q3 = question('q3', 3, false, 1);
const SLOTS = [slot('q1', 1, '（1）'), slot('q1', 2, '（2）'), slot('q3', 1, '')];

function submission(
  id: string,
  questionId: string,
  teamId: string,
  memberId: string,
  answers: string[],
  opts: { status?: SubmissionStatus; orderKey?: number | null; serverTime?: number; seq: number },
): Submission {
  return {
    id,
    sessionId: 'ses_1',
    questionId,
    teamId,
    memberId,
    answers,
    serverTime: opts.serverTime ?? NOW + opts.seq * 100,
    seq: opts.seq,
    status: opts.status ?? 'active',
    orderKey: opts.orderKey === undefined ? opts.seq : opts.orderKey,
    withdrawnAt: opts.status === 'withdrawn' ? NOW + 9000 : null,
  };
}
const draft = (teamId: string, questionId: string, answers: string[], updatedBy: string): Draft => ({
  teamId,
  questionId,
  answers,
  updatedBy,
  updatedAt: NOW + 50,
});

/**
 * 2 題 × 2 組：
 * - 第 1 題：A 先送（orderKey 1，得主）、B 後送（答案 SECRET-ANS-B）
 * - 第 3 題：B 送出（得主）
 * - 草稿：A 第 3 題、B 第 1 題（SECRET-DRAFT-B）
 */
function makePlayAgg(phase: Phase): SessionAggregate {
  const agg = makeAgg(['mem_A1', 'mem_B1']);
  agg.session = { ...agg.session, phase, endedAt: phase === 'ENDED' ? NOW + 60_000 : null };
  agg.questions = [Q3, Q1]; // 刻意打亂，輸出應依題號升冪
  agg.slots = SLOTS;
  agg.submissions = [
    submission('sub_A_q1', 'q1', 'team_A', 'mem_A1', ['CPU', '作業系統'], { seq: 1 }),
    submission('sub_B_q1', 'q1', 'team_B', 'mem_B1', ['SECRET-ANS-B', 'X'], { seq: 2 }),
    submission('sub_B_q3', 'q3', 'team_B', 'mem_B1', ['SECRET-ANS-B'], { seq: 3, orderKey: 1 }),
  ];
  agg.drafts = [draft('team_A', 'q3', ['1'], 'mem_A2'), draft('team_B', 'q1', ['SECRET-DRAFT-B', ''], 'mem_B1')];
  return agg;
}

/** 遞迴收集物件中出現過的所有 key（含陣列元素內的物件） */
function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, keys);
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

describe('projections（003 作答與結果）', () => {
  it('UT-PROJ-02 projectTeacherView（2 題 × 2 組）→ cells.length===4；winnerTeamId 正確；包含 B 的答案', () => {
    const view = projectTeacherView(makePlayAgg('RUNNING'), NOW);
    expect(view.cells).toHaveLength(4);
    // 依題號升冪 → 組序升冪
    expect(view.cells.map((c) => `${c.questionId}/${c.teamId}`)).toEqual(['q1/team_A', 'q1/team_B', 'q3/team_A', 'q3/team_B']);
    expect(view.questions.map((q) => [q.number, q.winnerTeamId])).toEqual([
      [1, 'team_A'],
      [3, 'team_B'],
    ]);
    const bCell = view.cells.find((c) => c.questionId === 'q1' && c.teamId === 'team_B');
    expect(bCell?.submission).toEqual({
      id: 'sub_B_q1',
      answers: ['SECRET-ANS-B', 'X'],
      submittedBy: 'SECRETNICKB',
      serverTime: NOW + 200,
      status: 'active',
      rank: 2,
      isWinner: false,
    });
    expect(view.cells.find((c) => c.questionId === 'q1' && c.teamId === 'team_A')?.submission?.isWinner).toBe(true);
    expect(view.cells.find((c) => c.questionId === 'q3' && c.teamId === 'team_A')?.submission).toBeNull();
    expect(Object.fromEntries(view.teams.map((t) => [t.id, t.score]))).toEqual({ team_A: 1, team_B: 1 });
    // 老師視圖不含草稿（spec FR-015）
    expect(JSON.stringify(view)).not.toContain('SECRET-DRAFT-B');
  });

  it('UT-PROJ-03 同組同題有 withdrawn 後再 active → cell 取 seq 最大的一筆', () => {
    const agg = makePlayAgg('RUNNING');
    agg.submissions = [
      submission('sub_old', 'q3', 'team_A', 'mem_A1', ['9'], { seq: 1, status: 'withdrawn' }),
      submission('sub_new', 'q3', 'team_A', 'mem_A2', ['0'], { seq: 5, orderKey: null }),
    ];
    const cell = projectTeacherView(agg, NOW).cells.find((c) => c.questionId === 'q3' && c.teamId === 'team_A');
    expect(cell?.submission?.id).toBe('sub_new');
    expect(cell?.submission?.submittedBy).toBe('Ben');
    // 視窗中（orderKey null）→ rank 為 null、不是得主
    expect(cell?.submission?.rank).toBeNull();
    expect(cell?.submission?.isWinner).toBe(false);
    // 只有撤回的一筆時，cell 顯示該筆且 rank 為 null
    agg.submissions = [submission('sub_old', 'q3', 'team_A', 'mem_A1', ['9'], { seq: 1, status: 'withdrawn' })];
    const only = projectTeacherView(agg, NOW).cells.find((c) => c.questionId === 'q3' && c.teamId === 'team_A');
    expect(only?.submission).toMatchObject({ id: 'sub_old', status: 'withdrawn', rank: null, isWinner: false });
  });

  it('UT-PROJ-04 RUNNING 中 projectTeamView(agg, A) 的 JSON.stringify 不含 B 的暱稱、答案、member id、submission id', () => {
    const json = JSON.stringify(projectTeamView(makePlayAgg('RUNNING'), 'team_A', NOW));
    for (const secret of ['SECRETNICKB', 'SECRET-ANS-B', 'SECRET-DRAFT-B', 'mem_B1', 'sub_B_q1', 'sub_B_q3']) {
      expect(json).not.toContain(secret);
    }
    // 本組資料仍在
    expect(json).toContain('sub_A_q1');
    expect(json).toContain('Amy');
    // 不屬於此活動的組別不得產生視圖
    expect(() => projectTeamView(makePlayAgg('RUNNING'), 'team_X', NOW)).toThrow();
  });

  it('UT-PROJ-05 RUNNING 中 TeamView 遞迴掃描所有 key → 不存在禁止欄位；results===null', () => {
    const agg = makePlayAgg('RUNNING');
    // 讓本組也有視窗中的送出與撤回紀錄，確認各種狀態都不會帶出名次欄位
    agg.questions = [{ ...Q3, state: 'window', windowEndsAt: NOW + 3000 }, Q1];
    agg.submissions.push(submission('sub_A_q3', 'q3', 'team_A', 'mem_A1', ['0'], { seq: 4, orderKey: null }));
    for (const teamId of ['team_A', 'team_B']) {
      const view = projectTeamView(agg, teamId, NOW);
      const keys = collectKeys(view);
      for (const forbidden of ['rank', 'isWinner', 'score', 'scores', 'state', 'windowEndsAt', 'winnerTeamId', 'orderKey', 'seq', 'token']) {
        expect(keys.has(forbidden), `${teamId} 的 TeamView 不得含 ${forbidden}`).toBe(false);
      }
      expect(view.results).toBeNull();
    }
    // READY 中同樣不含結果
    expect(projectTeamView(makePlayAgg('READY'), 'team_A', NOW).results).toBeNull();
  });

  it('UT-PROJ-06 ENDED 中 TeamView → results 非 null，含所有組的 ranking 與 scores', () => {
    const view = projectTeamView(makePlayAgg('ENDED'), 'team_A', NOW);
    expect(view.results).not.toBeNull();
    expect(view.results?.questions.map((q) => q.number)).toEqual([1, 3]);
    expect(view.results?.questions[0]?.ranking.map((r) => r.teamId)).toEqual(['team_A', 'team_B']);
    expect(view.results?.scores.map((s) => s.teamId).sort()).toEqual(['team_A', 'team_B']);
  });

  it('UT-PROJ-07 active 送出 serverTime=T → withdrawableUntil===T+10000；withdrawn → null', () => {
    const T = NOW + 12_345;
    const agg = makePlayAgg('RUNNING');
    agg.submissions = [
      submission('sub_A_q3', 'q3', 'team_A', 'mem_A1', ['0'], { seq: 1, serverTime: T }),
      submission('sub_A_q1', 'q1', 'team_A', 'mem_A2', ['CPU', 'OS'], { seq: 2, serverTime: T, status: 'withdrawn' }),
    ];
    const view = projectTeamView(agg, 'team_A', NOW);
    expect(view.mySubmissions.q3).toEqual({
      id: 'sub_A_q3',
      answers: ['0'],
      submittedBy: 'Amy',
      serverTime: T,
      status: 'active',
      withdrawableUntil: T + 10_000,
    });
    expect(view.mySubmissions.q1?.status).toBe('withdrawn');
    expect(view.mySubmissions.q1?.withdrawableUntil).toBeNull();
    // 草稿只含本組
    expect(view.drafts).toEqual({ q3: { answers: ['1'], updatedBy: 'mem_A2', updatedAt: NOW + 50 } });
  });

  it('UT-PROJ-08 buildResults：得主被判錯 → winner 為遞補者；ranking 含 rejected、不含 withdrawn；scores 依分數降冪、組序升冪', () => {
    const agg = makePlayAgg('ENDED');
    agg.teams = [...agg.teams, { id: 'team_C', sessionId: 'ses_1', index: 3, name: '第 3 組' }];
    agg.members = [...agg.members, { id: 'mem_C1', teamId: 'team_C', nickname: 'Cat', token: 'tok_C1', joinedAt: NOW, lastSeenAt: NOW }];
    agg.submissions = [
      // 第 1 題：C 撤回、A 第一但被判錯、B 遞補
      submission('c1', 'q1', 'team_C', 'mem_C1', ['W', 'W'], { seq: 1, orderKey: 1, status: 'withdrawn' }),
      submission('a1', 'q1', 'team_A', 'mem_A1', ['CPU', 'X'], { seq: 2, orderKey: 2, status: 'rejected' }),
      submission('b1', 'q1', 'team_B', 'mem_B1', ['CPU', '作業系統'], { seq: 3, orderKey: 3 }),
      // 第 3 題：C 為得主
      submission('c3', 'q3', 'team_C', 'mem_C1', ['0'], { seq: 4, orderKey: 1 }),
    ];
    const results = buildResults(agg);
    const r1 = results.questions[0];
    expect(r1).toMatchObject({ questionId: 'q1', number: 1, isGroup: true, subLabels: ['（1）', '（2）'] });
    expect(r1?.winner).toEqual({ teamId: 'team_B', teamName: '第 2 組', answers: ['CPU', '作業系統'], submittedBy: 'SECRETNICKB' });
    expect(r1?.ranking).toEqual([
      { rank: 1, teamId: 'team_A', teamName: '第 1 組', answers: ['CPU', 'X'], submittedBy: 'Amy', serverTime: NOW + 200, status: 'rejected', isWinner: false },
      { rank: 2, teamId: 'team_B', teamName: '第 2 組', answers: ['CPU', '作業系統'], submittedBy: 'SECRETNICKB', serverTime: NOW + 300, status: 'active', isWinner: true },
    ]);
    expect(results.questions[1]?.winner?.teamId).toBe('team_C');
    // B、C 各 1 分（同分依組序升冪）、A 0 分
    expect(results.scores).toEqual([
      { teamId: 'team_B', teamName: '第 2 組', score: 1 },
      { teamId: 'team_C', teamName: '第 3 組', score: 1 },
      { teamId: 'team_A', teamName: '第 1 組', score: 0 },
    ]);
    // 沒有送出的題目：winner null、ranking 空
    agg.submissions = [];
    expect(buildResults(agg).questions.map((q) => [q.winner, q.ranking.length])).toEqual([
      [null, 0],
      [null, 0],
    ]);
  });
});