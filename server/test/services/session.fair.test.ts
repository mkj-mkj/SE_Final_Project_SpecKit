import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';
import { ANSWERS, seedRunning } from '../helpers/seed.js';

type T = ReturnType<typeof makeTestService>;

function questionView(t: T, sessionId: string, qid: string) {
  return t.service.getTeacherView(sessionId).questions.find((x) => x.id === qid)!;
}
function cellOf(t: T, sessionId: string, qid: string, teamId: string) {
  return t.service.getTeacherView(sessionId).cells.find((c) => c.questionId === qid && c.teamId === teamId)!.submission;
}

describe('SessionService 公平模式（視窗與結算）', () => {
  it('UT-SVC-FAIR-01 第一筆送出 → state=window、windowEndsAt=now+3000、已排程 window:<qid>', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    const now = t.clock.now();
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    expect(t.repo.getQuestion(q[3]!)).toMatchObject({ state: 'window', windowEndsAt: now + 3000 });
    expect(t.scheduler.pending()).toEqual([{ key: `window:${q[3]}`, at: now + 3000 }]);
    // 視窗中：沒有名次也沒有得主
    expect(cellOf(t, sessionId, q[3]!, teamIds[0]!)).toMatchObject({ rank: null, isWinner: false });
    expect(questionView(t, sessionId, q[3]!).winnerTeamId).toBeNull();
  });

  it('UT-SVC-FAIR-02 A 已有 2 分；第 3 題 A 在 t=0、B 在 t=1000 送出 → 結算後 B 為得主、A rank 2', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    const [A, B] = [tokens[0]![0]!, tokens[1]![0]!];
    t.service.submit(A, q[1]!, ANSWERS[1]!);
    t.scheduler.advance(3000);
    t.service.submit(A, q[2]!, ANSWERS[2]!);
    t.scheduler.advance(3000);
    expect(t.service.getTeacherView(sessionId).teams.find((x) => x.id === teamIds[0])?.score).toBe(2);

    const t0 = t.clock.now();
    t.service.submit(A, q[3]!, ['0']);
    t.clock.advance(1000);
    t.service.submit(B, q[3]!, ['0']);
    t.scheduler.advanceTo(t0 + 3000);

    expect(questionView(t, sessionId, q[3]!)).toMatchObject({ state: 'settled', windowEndsAt: null, winnerTeamId: teamIds[1] });
    expect(cellOf(t, sessionId, q[3]!, teamIds[0]!)).toMatchObject({ rank: 2, isWinner: false });
  });

  it('UT-SVC-FAIR-03 同分：A t=0、B t=500 → A 為得主', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.clock.advance(500);
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.scheduler.advance(3000);
    expect(questionView(t, sessionId, q[3]!).winnerTeamId).toBe(teamIds[0]);
    expect(cellOf(t, sessionId, q[3]!, teamIds[1]!)).toMatchObject({ rank: 2, isWinner: false });
  });

  it('UT-SVC-FAIR-04 結算後 C 送出 → rank 3、非得主（不再開窗）', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.scheduler.advance(3000);
    t.clock.advance(5000);
    t.service.submit(tokens[2]![0]!, q[3]!, ['0']);
    expect(cellOf(t, sessionId, q[3]!, teamIds[2]!)).toMatchObject({ rank: 3, isWinner: false });
    expect(t.repo.getQuestion(q[3]!)).toMatchObject({ state: 'settled', windowEndsAt: null });
    expect(t.scheduler.pending()).toEqual([]);
  });

  it('UT-SVC-FAIR-05 clock.now()===windowEndsAt、排程觸發前送出 → 列入候選並依規則排序', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    const endsAt = t.repo.getQuestion(q[3]!)!.windowEndsAt!;
    t.clock.set(endsAt); // 只推進時間，不觸發排程
    const late = t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    expect(t.repo.getSubmission(late.submissionId)?.orderKey).toBeNull();
    t.scheduler.advanceTo(endsAt);
    expect(t.repo.getSubmission(late.submissionId)?.orderKey).not.toBeNull();
    expect(cellOf(t, sessionId, q[3]!, teamIds[1]!)).toMatchObject({ rank: 2, isWinner: false });
    expect(questionView(t, sessionId, q[3]!).winnerTeamId).toBe(teamIds[0]);
  });

  it('UT-SVC-FAIR-06 windowSec=5 → windowEndsAt=now+5000', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t, { mode: 'fair', windowSec: 5 });
    const now = t.clock.now();
    t.service.submit(tokens[0]![0]!, q[4]!, ANSWERS[4]!);
    expect(t.repo.getQuestion(q[4]!)?.windowEndsAt).toBe(now + 5000);
    expect(t.scheduler.pending()).toEqual([{ key: `window:${q[4]}`, at: now + 5000 }]);
  });

  it('UT-SVC-FAIR-07 A 先在第 3 題得分；第 4 題 A 先送、B 後送 → B 為得主（使用結算當下分數）', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    const [A, B] = [tokens[0]![0]!, tokens[1]![0]!];
    t.service.submit(A, q[3]!, ['0']);
    t.scheduler.advance(3000);
    t.service.submit(A, q[4]!, ANSWERS[4]!);
    t.clock.advance(500);
    t.service.submit(B, q[4]!, ANSWERS[4]!);
    t.scheduler.advance(3000);
    expect(questionView(t, sessionId, q[4]!).winnerTeamId).toBe(teamIds[1]);
    expect(cellOf(t, sessionId, q[4]!, teamIds[0]!)).toMatchObject({ rank: 2 });
  });

  it('UT-SVC-FAIR-08 第 3、4 題視窗同時到期 → 依 (windowEndsAt, 題號) 結算：第 3 題 A、第 4 題 B', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    const [A, B] = [tokens[0]![0]!, tokens[1]![0]!];
    // 同一毫秒：先送第 4 題、再送第 3 題，使第 4 題的排程排在前面；A 在兩題都較早（seq 較小）
    t.service.submit(A, q[4]!, ANSWERS[4]!);
    t.service.submit(A, q[3]!, ['0']);
    t.service.submit(B, q[4]!, ANSWERS[4]!);
    t.service.submit(B, q[3]!, ['0']);
    expect(t.scheduler.pending().map((p) => p.key)).toEqual([`window:${q[4]}`, `window:${q[3]}`]);

    const before = t.broadcaster.calls.length;
    t.scheduler.advance(3000);

    // 第 3 題先結算：同分 0、A 較早 → A；第 4 題再結算：A 已 1 分、B 0 分 → B
    expect(questionView(t, sessionId, q[3]!).winnerTeamId).toBe(teamIds[0]);
    expect(questionView(t, sessionId, q[4]!).winnerTeamId).toBe(teamIds[1]);
    expect(t.broadcaster.calls.length).toBe(before + 2); // 每題結算各推播一次；第二個排程回呼冪等、不推播
  });

  it('UT-SVC-FAIR-08 直接呼叫 settleWindow(q4) 只結算第 4 題，第 3 題仍為 window', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[4]!, ANSWERS[4]!);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.settleWindow(q[4]!);
    expect(t.repo.getQuestion(q[4]!)?.state).toBe('settled');
    expect(t.repo.getQuestion(q[3]!)?.state).toBe('window');
  });

  it('UT-SVC-FAIR-09 對已結算的題目再呼叫 settleWindow → 送出不變、不推播', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.scheduler.advance(3000);
    const snapshot = JSON.stringify(t.repo.listSubmissions(sessionId));
    const before = t.broadcaster.calls.length;
    t.service.settleWindow(q[3]!);
    t.service.settleWindow(q[3]!);
    expect(JSON.stringify(t.repo.listSubmissions(sessionId))).toBe(snapshot);
    expect(t.broadcaster.calls.length).toBe(before);
    // 從未開窗（open）的題目也一樣不做事
    t.service.settleWindow(q[2]!);
    expect(t.repo.getQuestion(q[2]!)?.state).toBe('open');
    expect(t.broadcaster.calls.length).toBe(before);
  });
});
