import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';
import { ANSWERS, seedRunning } from '../helpers/seed.js';

const code = (c: string) => expect.objectContaining({ code: c });

describe('SessionService.withdraw（撤回）', () => {
  it('UT-SVC-WD-01 送出後 5 秒撤回再送出 → 原筆 withdrawn；新筆排在已結算者之後', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    const first = t.service.submit(tokens[0]![0]!, q[4]!, ['IP']);
    t.clock.advance(1000);
    t.service.submit(tokens[1]![0]!, q[4]!, ['IP']);
    t.clock.advance(4000);
    const before = t.broadcaster.calls.length;

    t.service.withdraw(tokens[0]![1]!, first.submissionId); // 同組另一位成員也可撤回

    expect(t.repo.getSubmission(first.submissionId)).toMatchObject({ status: 'withdrawn', withdrawnAt: t.clock.now() });
    expect(t.broadcaster.calls.length).toBe(before + 1);
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId });

    const again = t.service.submit(tokens[0]![0]!, q[4]!, ['IP']);
    const subs = t.repo.listSubmissionsByQuestion(q[4]!);
    const newKey = subs.find((s) => s.id === again.submissionId)!.orderKey!;
    expect(subs.find((s) => s.id === again.submissionId)?.status).toBe('active');
    expect(newKey).toBeGreaterThan(Math.max(...subs.filter((s) => s.id !== again.submissionId).map((s) => s.orderKey ?? 0)));
  });

  it('UT-SVC-WD-02 送出在 T：T+10000 撤回成功；T+10001 撤回 → WITHDRAW_WINDOW_EXPIRED', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t);
    const T = t.clock.now();
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    const b = t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.clock.set(T + 10_000);
    t.service.withdraw(tokens[0]![0]!, a.submissionId);
    expect(t.repo.getSubmission(a.submissionId)?.status).toBe('withdrawn');
    t.clock.set(T + 10_001);
    expect(() => t.service.withdraw(tokens[1]![0]!, b.submissionId)).toThrowError(code('WITHDRAW_WINDOW_EXPIRED'));
    expect(t.repo.getSubmission(b.submissionId)?.status).toBe('active');
  });

  it('UT-SVC-WD-03 B 組撤回 A 組的送出、或不存在的 id → SUBMISSION_NOT_FOUND', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t);
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    expect(() => t.service.withdraw(tokens[1]![0]!, a.submissionId)).toThrowError(code('SUBMISSION_NOT_FOUND'));
    expect(() => t.service.withdraw(tokens[0]![0]!, 'sub_nope')).toThrowError(code('SUBMISSION_NOT_FOUND'));
    expect(t.repo.getSubmission(a.submissionId)?.status).toBe('active');
  });

  it('UT-SVC-WD-04 撤回已撤回的送出 → INVALID_STATE', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t);
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.withdraw(tokens[0]![0]!, a.submissionId);
    expect(() => t.service.withdraw(tokens[0]![0]!, a.submissionId)).toThrowError(code('INVALID_STATE'));
  });

  it('UT-SVC-WD-05 A 為第 3 題得主、B 第 2 名，A 撤回 → B 為得主；分數 A 0、B 1', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.clock.advance(100);
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.service.withdraw(tokens[0]![0]!, a.submissionId);
    const view = t.service.getTeacherView(sessionId);
    expect(view.questions.find((x) => x.id === q[3])?.winnerTeamId).toBe(teamIds[1]);
    const score = Object.fromEntries(view.teams.map((x) => [x.id, x.score]));
    expect(score[teamIds[0]!]).toBe(0);
    expect(score[teamIds[1]!]).toBe(1);
  });

  it('UT-SVC-WD-06 ENDED 中撤回 → INVALID_PHASE', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.end(sessionId);
    expect(() => t.service.withdraw(tokens[0]![0]!, a.submissionId)).toThrowError(code('INVALID_PHASE'));
    expect(t.repo.getSubmission(a.submissionId)?.status).toBe('active');
  });

  it('UT-SVC-FAIR-10 視窗中唯一候選撤回 → 題目回到 open、取消排程；之後 B 送出重新開窗', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t, { mode: 'fair' });
    const a = t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.clock.advance(1000);
    t.service.withdraw(tokens[0]![0]!, a.submissionId);
    expect(t.repo.getQuestion(q[3]!)).toMatchObject({ state: 'open', windowEndsAt: null });
    expect(t.scheduler.pending().map((p) => p.key)).not.toContain(`window:${q[3]}`);

    t.clock.advance(1000);
    const b = t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    expect(t.repo.getQuestion(q[3]!)).toMatchObject({ state: 'window', windowEndsAt: b.serverTime + 3000 });
    expect(t.scheduler.pending()).toEqual([{ key: `window:${q[3]}`, at: b.serverTime + 3000 }]);
  });

  it('UT-SVC-FAIR-10 視窗中還有其他候選時撤回 → 視窗維持、排程保留', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t, { mode: 'fair' });
    const a = t.service.submit(tokens[0]![0]!, q[4]!, ANSWERS[4]!);
    t.service.submit(tokens[1]![0]!, q[4]!, ANSWERS[4]!);
    t.service.withdraw(tokens[0]![0]!, a.submissionId);
    expect(t.repo.getQuestion(q[4]!)?.state).toBe('window');
    expect(t.scheduler.pending().map((p) => p.key)).toEqual([`window:${q[4]}`]);
  });
});
