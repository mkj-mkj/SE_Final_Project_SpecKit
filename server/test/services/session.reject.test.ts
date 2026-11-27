// UT-SVC-REJ-01～07（TEST_SPEC §5.6）：老師判錯與遞補（PRD E5）；
// 07 為 plan D1：判錯到無人遞補的題目，寫回時恢復該題作答格的原始值（PRD §8 第 9 點例外）。
import { AppError } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';
import { seedRunning } from '../helpers/seed.js';

type T = ReturnType<typeof makeTestService>;

/** 第 1、2、3 組依序（間隔 100 ms）送出第 3 題 ['0']、['1']、['2'] */
async function threeOnQ3(t: T, opts?: { end?: boolean }) {
  const seeded = await seedRunning(t);
  const { tokens, q } = seeded;
  ['0', '1', '2'].forEach((ans, i) => {
    t.service.submit(tokens[i]![0]!, q[3]!, [ans]);
    t.clock.advance(100);
  });
  if (opts?.end ?? true) t.service.end(seeded.sessionId);
  return seeded;
}

async function codeOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return (e as AppError).code;
  }
  throw new Error('預期丟出 AppError');
}

function subsOf(t: T, questionId: string) {
  return t.repo.listSubmissionsByQuestion(questionId);
}

describe('SessionService.rejectWinner（判錯與遞補）', () => {
  it('UT-SVC-REJ-01 A 得主、B 第 2 名，判錯 → A rejected；B 得主；分數 A−1、B+1（含搶答中與公平模式變體）', async () => {
    // ENDED
    const t = makeTestService();
    const { sessionId, teamIds, q } = await threeOnQ3(t);
    const before = subsOf(t, q[3]!).find((s) => s.teamId === teamIds[0])!;
    const view = t.service.rejectWinner(sessionId, q[3]!);
    const after = subsOf(t, q[3]!).find((s) => s.teamId === teamIds[0])!;
    expect(after.status).toBe('rejected');
    expect(after.orderKey).toBe(before.orderKey);
    expect(view.questions.find((x) => x.id === q[3])!.winnerTeamId).toBe(teamIds[1]);
    const score = (id: string) => view.teams.find((x) => x.id === id)!.score;
    expect(score(teamIds[0]!)).toBe(0);
    expect(score(teamIds[1]!)).toBe(1);
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId });

    // RUNNING：他組看不到判錯資訊，也看不到結果（FR-10）
    const r = makeTestService();
    const running = await threeOnQ3(r, { end: false });
    r.service.rejectWinner(running.sessionId, running.q[3]!);
    const firstId = subsOf(r, running.q[3]!).find((s) => s.teamId === running.teamIds[0])!.id;
    const teamB = r.service.getTeamView(running.tokens[1]![0]!);
    const json = JSON.stringify(teamB);
    expect(json).not.toContain('rejected');
    expect(json).not.toContain(firstId);
    expect(teamB.results).toBeNull();
    expect(r.service.getTeamView(running.tokens[0]![0]!).mySubmissions[running.q[3]!]!.status).toBe('rejected');

    // 公平模式（spec FR-019）：搶答中判錯後的分數立即用於之後的視窗結算
    const f = makeTestService();
    const fair = await seedRunning(f, { mode: 'fair', windowSec: 3 });
    f.service.submit(fair.tokens[0]![0]!, fair.q[1]!, ['CPU', '作業系統']);
    f.service.submit(fair.tokens[1]![0]!, fair.q[2]!, ['演算法', '堆疊']);
    f.scheduler.advance(3000); // 兩題結算：第 1、2 組各 1 分
    f.service.rejectWinner(fair.sessionId, fair.q[1]!); // 第 1 組 → 0 分
    f.service.submit(fair.tokens[1]![0]!, fair.q[4]!, ['IP']); // 第 2 組先送
    f.clock.advance(1000);
    f.service.submit(fair.tokens[0]![0]!, fair.q[4]!, ['IP']); // 第 1 組後送，但分數較低
    f.scheduler.advance(3000);
    const fv = f.service.getTeacherView(fair.sessionId);
    // 若未判錯兩組同分，應由先送的第 2 組得主；判錯後第 1 組 0 分，低分優先
    expect(fv.questions.find((x) => x.id === fair.q[4])!.winnerTeamId).toBe(fair.teamIds[0]);
  });

  it('UT-SVC-REJ-02 再判錯一次 → 第 3 名遞補', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, q } = await threeOnQ3(t);
    t.service.rejectWinner(sessionId, q[3]!);
    const view = t.service.rejectWinner(sessionId, q[3]!);
    expect(view.questions.find((x) => x.id === q[3])!.winnerTeamId).toBe(teamIds[2]);
    expect(subsOf(t, q[3]!).find((s) => s.teamId === teamIds[1])!.status).toBe('rejected');
  });

  it('UT-SVC-REJ-03 已無可遞補者再判錯 → NO_WINNER；results 該題 winner null；其他無得主情況', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await threeOnQ3(t);
    t.service.rejectWinner(sessionId, q[3]!);
    t.service.rejectWinner(sessionId, q[3]!);
    t.service.rejectWinner(sessionId, q[3]!);
    const snapshot = JSON.stringify(subsOf(t, q[3]!));
    const calls = t.broadcaster.calls.length;
    expect(await codeOf(() => t.service.rejectWinner(sessionId, q[3]!))).toBe('NO_WINNER');
    expect(JSON.stringify(subsOf(t, q[3]!))).toBe(snapshot);
    expect(t.broadcaster.calls.length).toBe(calls);
    const results = t.service.getTeamView(tokens[0]![0]!).results!;
    expect(results.questions.find((x) => x.questionId === q[3])!.winner).toBeNull();

    // 無人送出的題目、不存在的題目
    expect(await codeOf(() => t.service.rejectWinner(sessionId, q[4]!))).toBe('NO_WINNER');
    expect(await codeOf(() => t.service.rejectWinner(sessionId, 'nope'))).toBe('QUESTION_NOT_FOUND');

    // 公平模式視窗中（尚未結算）→ NO_WINNER，視窗排程不受影響
    const f = makeTestService();
    const fair = await seedRunning(f, { mode: 'fair' });
    f.service.submit(fair.tokens[0]![0]!, fair.q[3]!, ['0']);
    expect(await codeOf(() => f.service.rejectWinner(fair.sessionId, fair.q[3]!))).toBe('NO_WINNER');
    expect(f.scheduler.pending().map((p) => p.key)).toEqual([`window:${fair.q[3]}`]);
  });

  it('UT-SVC-REJ-04 READY 中判錯 → INVALID_PHASE', async () => {
    const t = makeTestService();
    const sid = t.service.createSession({ teamCount: 3 }).session.id;
    await t.service.importSheet(sid, 'fixture-template-a');
    const q3 = t.repo.listQuestions(sid).find((x) => x.number === 3)!.id;
    expect(await codeOf(() => t.service.rejectWinner(sid, q3))).toBe('INVALID_PHASE');
  });

  it('UT-SVC-REJ-05 被判錯的組再送該題 → ALREADY_SUBMITTED；撤回被判錯的送出 → INVALID_STATE', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await threeOnQ3(t, { end: false });
    t.service.rejectWinner(sessionId, q[3]!);
    expect(await codeOf(() => t.service.submit(tokens[0]![1]!, q[3]!, ['5']))).toBe('ALREADY_SUBMITTED');
    const rejected = subsOf(t, q[3]!).find((s) => s.teamId === teamIds[0])!;
    expect(await codeOf(() => t.service.withdraw(tokens[0]![0]!, rejected.id))).toBe('INVALID_STATE');
  });

  it('UT-SVC-REJ-06 ENDED 中判錯後匯出 → 寫回的是遞補者答案', async () => {
    const t = makeTestService();
    const { sessionId, q } = await threeOnQ3(t);
    t.service.rejectWinner(sessionId, q[3]!);
    await t.service.exportToSheet(sessionId);
    const writes = t.gateway.writes.at(-1)!.writes;
    expect(writes.find((w) => w.a1 === 'G11')).toEqual({ sheetTitle: '學習單', a1: 'G11', value: '1' });
  });

  it('UT-SVC-REJ-07 第 3 題唯一送出被判錯（無人遞補）後匯出 → G11 寫回 originalValue；未送出的題目不寫', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.end(sessionId);
    t.service.rejectWinner(sessionId, q[3]!);
    const g11 = t.repo.listSlotsBySession(sessionId).find((s) => s.a1 === 'G11')!;
    const result = await t.service.exportToSheet(sessionId);
    const writes = t.gateway.writes.at(-1)!.writes;
    // 只有第 3 題的作答格被恢復為匯入時的原始值；第 1、2、4 題沒有送出也沒有判錯，不產生寫入
    expect(writes).toEqual([{ sheetTitle: '學習單', a1: 'G11', value: g11.originalValue }]);
    expect(result.updatedCells).toBe(1);
    expect(result.writes).toEqual(writes);
  });
});
