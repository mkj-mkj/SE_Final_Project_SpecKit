// IT-CONC-01（TEST_SPEC §6；FR-019、SC-001）：真實時鐘＋timer scheduler 下，20 組同時送出同一題，重複 50 輪
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ANSWERS_A, flow } from './flow.js';
import { startApp, type RealTimeApp } from './startApp.js';

type App = RealTimeApp;

describe('同時送出整合測試', () => {
  let t: App;
  beforeEach(async () => {
    t = await startApp({ realTime: true });
  });
  afterEach(async () => {
    await t.close();
  });

  it('IT-CONC-01 20 組各 1 人對同一題 Promise.all 同時送出，50 輪：每輪恰 1 位得主、rank 2..20 不重複、無 500', async () => {
    const f = flow(t.baseUrl);
    await f.login();
    const s = await f.createAndImport({ mode: 'speed', teamCount: 20 });
    const members = (await f.joinMembers(s.roomCode, 1)).map((row) => row[0]!);
    expect(members).toHaveLength(20);
    const qid = s.q[3]!;

    for (let round = 1; round <= 50; round++) {
      await f.startQuiz(s.sessionId);
      const responses = await Promise.all(members.map((m) => f.submit(m.token, qid, ANSWERS_A[3]!)));
      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((x) => x >= 500), `第 ${round} 輪`).toEqual([]);
      expect(statuses.every((x) => x === 201), `第 ${round} 輪：${statuses.join(',')}`).toBe(true);

      const view = await f.getTeacherView(s.sessionId);
      const subs = view.cells.filter((c) => c.questionId === qid).map((c) => c.submission!);
      expect(subs).toHaveLength(20);
      const winners = subs.filter((x) => x.isWinner);
      expect(winners, `第 ${round} 輪得主數`).toHaveLength(1);
      expect(winners[0]!.rank).toBe(1);
      const others = subs.filter((x) => !x.isWinner).map((x) => x.rank!).sort((a, b) => a - b);
      expect(others, `第 ${round} 輪名次`).toEqual(Array.from({ length: 19 }, (_, i) => i + 2));
      expect(view.questions.find((x) => x.id === qid)?.winnerTeamId).toBe(
        view.cells.find((c) => c.questionId === qid && c.submission?.isWinner)?.teamId,
      );

      await f.endQuiz(s.sessionId);
      await f.resetQuiz(s.sessionId);
    }
  }, 60_000);
});
