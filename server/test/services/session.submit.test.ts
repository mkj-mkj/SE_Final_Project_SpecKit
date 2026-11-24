import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';
import { ANSWERS, seedRunning } from '../helpers/seed.js';

const code = (c: string) => expect.objectContaining({ code: c });

/** 老師視圖中某題某組的格子 */
function cellOf(t: ReturnType<typeof makeTestService>, sessionId: string, questionId: string, teamId: string) {
  return t.service.getTeacherView(sessionId).cells.find((c) => c.questionId === questionId && c.teamId === teamId);
}

describe('SessionService.submit（純速度）', () => {
  it('UT-SVC-SUB-01 READY 與 ENDED 中送出 → INVALID_PHASE，且沒有新增送出', async () => {
    // READY：另建未 start 的活動
    const t = makeTestService();
    const created = t.service.createSession({ teamCount: 2, fairnessMode: 'speed' });
    await t.service.importSheet(created.session.id, 'fixture-template-a');
    const teamId = t.repo.listTeams(created.session.id)[0]!.id;
    const { token } = t.service.join(created.session.roomCode, { teamId, nickname: 'Amy' });
    const q3 = t.repo.listQuestions(created.session.id)[2]!.id;
    expect(() => t.service.submit(token, q3, ['0'])).toThrowError(code('INVALID_PHASE'));
    expect(t.repo.listSubmissions(created.session.id)).toEqual([]);

    // ENDED
    const t2 = makeTestService();
    const s = await seedRunning(t2);
    t2.service.end(s.sessionId);
    const before = t2.broadcaster.calls.length;
    expect(() => t2.service.submit(s.tokens[0]![0]!, s.q[3]!, ['0'])).toThrowError(code('INVALID_PHASE'));
    expect(t2.repo.listSubmissions(s.sessionId)).toEqual([]);
    expect(t2.broadcaster.calls.length).toBe(before);
  });

  it('UT-SVC-SUB-02 A 組在 t 送出第 3 題 → serverTime===t、A 為得主（rank 1）、題目 settled', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    t.clock.advance(1234);
    const now = t.clock.now();
    const before = t.broadcaster.calls.length;

    const res = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);

    expect(res.serverTime).toBe(now);
    const view = t.service.getTeacherView(sessionId);
    expect(view.questions.find((x) => x.id === q[3])).toMatchObject({ winnerTeamId: teamIds[0], state: 'settled' });
    expect(cellOf(t, sessionId, q[3]!, teamIds[0]!)?.submission).toMatchObject({
      id: res.submissionId,
      rank: 1,
      isWinner: true,
      status: 'active',
      serverTime: now,
    });
    // 提交後推播一次給全部
    expect(t.broadcaster.calls.length).toBe(before + 1);
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId });
  });

  it('UT-SVC-SUB-03 80 ms 後 B 組送出第 3 題 → B rank 2、非得主', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.clock.advance(80);
    t.service.submit(tokens[1]![0]!, q[3]!, ['1']);
    expect(cellOf(t, sessionId, q[3]!, teamIds[1]!)?.submission).toMatchObject({ rank: 2, isWinner: false });
    expect(cellOf(t, sessionId, q[3]!, teamIds[0]!)?.submission).toMatchObject({ rank: 1, isWinner: true });
  });

  it('UT-SVC-SUB-04 A 組另一成員再送第 3 題 → ALREADY_SUBMITTED', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    expect(() => t.service.submit(tokens[0]![1]!, q[3]!, ['1'])).toThrowError(code('ALREADY_SUBMITTED'));
    expect(t.repo.listSubmissions(sessionId)).toHaveLength(1);
  });

  it("UT-SVC-SUB-05 送出 [' 0 '] → 保存為 ['0']", async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t);
    const res = t.service.submit(tokens[0]![0]!, q[3]!, [' 0 ']);
    expect(t.repo.getSubmission(res.submissionId)?.answers).toEqual(['0']);
  });

  it("UT-SVC-SUB-06 題組送 ['CPU',''] → GROUP_INCOMPLETE；兩格都填 → 一筆送出、answers.length===2", async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    const a1 = tokens[0]![0]!;
    expect(() => t.service.submit(a1, q[1]!, ['CPU', ''])).toThrowError(code('GROUP_INCOMPLETE'));
    expect(() => t.service.submit(a1, q[3]!, ['  '])).toThrowError(code('ANSWER_REQUIRED'));
    expect(() => t.service.submit(a1, q[3]!, ['0', '1'])).toThrowError(code('INVALID_INPUT'));
    expect(() => t.service.submit(a1, q[3]!, ['x'.repeat(201)])).toThrowError(code('ANSWER_TOO_LONG'));
    expect(t.repo.listSubmissions(sessionId)).toEqual([]);
    t.service.submit(a1, q[1]!, ANSWERS[1]!);
    const subs = t.repo.listSubmissions(sessionId);
    expect(subs).toHaveLength(1);
    expect(subs[0]?.answers).toEqual(['CPU', '作業系統']);
  });

  it('UT-SVC-SUB-07 不存在的 questionId、別活動的題目 → QUESTION_NOT_FOUND', async () => {
    const t = makeTestService();
    const { tokens } = await seedRunning(t);
    const other = t.service.createSession({ teamCount: 2 });
    await t.service.importSheet(other.session.id, 'fixture-template-a');
    const otherQ = t.repo.listQuestions(other.session.id)[2]!.id;
    expect(() => t.service.submit(tokens[0]![0]!, 'q_nope', ['0'])).toThrowError(code('QUESTION_NOT_FOUND'));
    expect(() => t.service.submit(tokens[0]![0]!, otherQ, ['0'])).toThrowError(code('QUESTION_NOT_FOUND'));
    expect(() => t.service.submit('tok_nope', otherQ, ['0'])).toThrowError(code('UNAUTHORIZED'));
  });

  it('UT-SVC-SUB-08 不推進 clock，A、B 先後送出 → 先呼叫者為得主（seq 決定）', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    const b = t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    expect(a.serverTime).toBe(b.serverTime);
    const view = t.service.getTeacherView(sessionId);
    expect(view.questions.find((x) => x.id === q[3])?.winnerTeamId).toBe(teamIds[1]);
    expect(t.repo.getSubmission(b.submissionId)!.seq).toBeLessThan(t.repo.getSubmission(a.submissionId)!.seq);
  });

  it('UT-SVC-SUB-09 20 組在同一毫秒依序送出同一題 → 恰 1 位得主、rank 為 1..20 不重複', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { teams: 20, membersPerTeam: 1 });
    for (const team of tokens) t.service.submit(team[0]!, q[4]!, ANSWERS[4]!);

    const cells = t.service.getTeacherView(sessionId).cells.filter((c) => c.questionId === q[4]);
    expect(cells).toHaveLength(20);
    expect(cells.filter((c) => c.submission?.isWinner)).toHaveLength(1);
    expect(cells.find((c) => c.submission?.isWinner)?.teamId).toBe(teamIds[0]);
    const ranks = cells.map((c) => c.submission!.rank).sort((x, y) => x! - y!);
    expect(ranks).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const serverTimes = new Set(t.repo.listSubmissions(sessionId).map((s) => s.serverTime));
    expect(serverTimes.size).toBe(1);
  });

  it('UT-SVC-SUB-10 回傳 withdrawableUntil===serverTime+10000', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t);
    const res = t.service.submit(tokens[0]![0]!, q[2]!, ANSWERS[2]!);
    expect(res.withdrawableUntil).toBe(res.serverTime + 10_000);
  });

  it('UT-SVC-DRAFT-06 A 組先 updateDraft 第 3 題，再送出第 3 題 → 該草稿已刪除', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    t.service.updateDraft(tokens[0]![1]!, q[3]!, ['0']);
    t.service.updateDraft(tokens[0]![1]!, q[4]!, ['I']);
    t.service.updateDraft(tokens[1]![0]!, q[3]!, ['9']);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    const drafts = t.repo.listDrafts(sessionId).map((d) => `${d.teamId}/${d.questionId}`);
    expect(drafts).not.toContain(`${teamIds[0]}/${q[3]}`);
    expect(drafts).toEqual(expect.arrayContaining([`${teamIds[0]}/${q[4]}`, `${teamIds[1]}/${q[3]}`]));
  });
});
