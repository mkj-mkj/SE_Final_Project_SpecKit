// IT-PERF-01（TEST_SPEC §6；FR-044、SC-003）：真實時鐘，10 組 × 4 個學生 socket＋老師 socket，
// 連續 20 次送出（不同組／題目），量測「POST 送出」到老師收到含該送出的 teacher:state → p95 < 500 ms
import type { TeacherView, TeamView } from '@quiz/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ANSWERS_A, flow, waitForEvent } from './flow.js';
import { startApp, type RealTimeApp } from './startApp.js';

type App = RealTimeApp;

describe('效能整合測試', () => {
  let t: App;
  beforeEach(async () => {
    t = await startApp({ realTime: true });
  });
  afterEach(async () => {
    await t.close();
  });

  it('IT-PERF-01 40 個學生 socket＋老師，連續 20 次送出，老師收到更新的 p95 < 500 ms', async () => {
    const f = flow(t.baseUrl);
    await f.login();
    const s = await f.createAndImport({ mode: 'speed', teamCount: 10 });
    const members = await f.joinMembers(s.roomCode, 4);
    await f.startQuiz(s.sessionId);

    const teacher = t.connect({ token: f.teacherToken, sessionId: s.sessionId });
    await waitForEvent<TeacherView>(teacher, 'teacher:state');
    const students = members.flat().map((m) => t.connect({ token: m.token }));
    await Promise.all(students.map((sock) => waitForEvent<TeamView>(sock, 'team:state')));
    expect(students).toHaveLength(40);

    const latencies: number[] = [];
    for (let i = 0; i < 20; i++) {
      const team = i % 10;
      const number = Math.floor(i / 10) + 1; // 第 1、2 題（題組）
      const m = members[team]![i % 4]!;
      const qid = s.q[number]!;
      const received = waitForEvent<TeacherView>(
        teacher,
        'teacher:state',
        (v) => v.cells.some((c) => c.questionId === qid && c.teamId === m.teamId && c.submission !== null),
        5000,
      );
      const t0 = performance.now();
      const res = await f.submit(m.token, qid, ANSWERS_A[number]!);
      expect(res.status).toBe(201);
      await received;
      latencies.push(performance.now() - t0);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
    expect(p95, `latencies(ms)=${sorted.map((x) => x.toFixed(1)).join(',')}`).toBeLessThan(500);
  }, 30_000);
});
