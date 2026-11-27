// 003 搶答整合測試（TEST_SPEC §6）：IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01
import type { TeacherView, TeamView } from '@quiz/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ANSWERS_A, flow, waitForEvent } from './flow.js';
import { startApp } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

describe('003 搶答整合測試', () => {
  let t: App;
  let f: ReturnType<typeof flow>;
  beforeEach(async () => {
    t = await startApp();
    f = flow(t.baseUrl);
    await f.login();
  });
  afterEach(async () => {
    await t.close();
  });

  /** 連線並等到第一個狀態事件（收到即代表已加入 room） */
  async function connectMember(token: string) {
    const socket = t.connect({ token });
    const first = waitForEvent<TeamView>(socket, 'team:state');
    return { socket, first: await first };
  }
  async function connectTeacher(sessionId: string) {
    const socket = t.connect({ token: f.teacherToken, sessionId });
    const first = waitForEvent<TeacherView>(socket, 'teacher:state');
    return { socket, first: await first };
  }

  it('IT-PHASE-01 READY 中 POST /api/play/submissions → 409 INVALID_PHASE', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[m]] = await f.joinMembers(s.roomCode, 1);
    expect(s.view.session.phase).toBe('READY');

    const res = await f.submit(m!.token, s.q[3]!, ANSWERS_A[3]!);
    expect(res.status).toBe(409);
    expect((res.body as unknown as { error: { code: string } }).error.code).toBe('INVALID_PHASE');
  });

  it('IT-VAL-01 RUNNING 中 POST /submissions 本文缺 answers → 422 INVALID_INPUT', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[m]] = await f.joinMembers(s.roomCode, 1);
    await f.startQuiz(s.sessionId);

    const res = await f.api<{ error: { code: string } }>('POST', '/api/play/submissions', { questionId: s.q[3] }, m!.token);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('IT-VIS-01 B 組在結束前收到的 team:state 不含 A 組答案、草稿、member id、submission id；老師收到 A 的答案', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[a], [b]] = await f.joinMembers(s.roomCode, 1);
    await f.startQuiz(s.sessionId);

    const teacher = await connectTeacher(s.sessionId);
    const sockA = await connectMember(a!.token);
    // B 的所有事件（含連線後第一個狀態）都記錄下來
    const sockB = t.connect({ token: b!.token });
    const bEvents: { event: string; payload: unknown }[] = [];
    sockB.onAny((event: string, payload: unknown) => bEvents.push({ event, payload }));
    await waitForEvent<TeamView>(sockB, 'team:state');

    // A 送出第 3 題、對第 4 題存草稿
    const teacherSawSecret = waitForEvent<TeacherView>(teacher.socket, 'teacher:state', (v) =>
      JSON.stringify(v).includes('SECRET-A-123'),
    );
    const sub = await f.submit(a!.token, s.q[3]!, ['SECRET-A-123']);
    expect(sub.status).toBe(201);
    const aSawDraft = waitForEvent<TeamView>(sockA.socket, 'team:state', (v) =>
      JSON.stringify(v.drafts).includes('SECRET-DRAFT-A'),
    );
    expect((await f.putDraft(a!.token, s.q[4]!, ['SECRET-DRAFT-A'])).status).toBe(204);
    await aSawDraft; // A 的草稿已推播（確認推播確實發生過）
    await teacherSawSecret;

    // 屏障：B 自己存草稿並等到自己的 team:state；同一連線事件依序送達，先前推給 B 的事件都已收到
    const bBarrier = waitForEvent<TeamView>(sockB, 'team:state', (v) =>
      JSON.stringify(v.drafts).includes('B-BARRIER'),
    );
    expect((await f.putDraft(b!.token, s.q[1]!, ['B-BARRIER', ''])).status).toBe(204);
    await bBarrier;

    // end 之前 B 收到的全部事件
    const before = JSON.stringify(bEvents);
    expect(bEvents.filter((e) => e.event === 'team:state').length).toBeGreaterThanOrEqual(2);
    expect(bEvents.some((e) => e.event === 'teacher:state')).toBe(false);
    expect(before).not.toContain('SECRET-A-123');
    expect(before).not.toContain('SECRET-DRAFT-A');
    expect(before).not.toContain(a!.memberId);
    expect(before).not.toContain(sub.body.submissionId);

    await f.endQuiz(s.sessionId);
  });

  it('IT-SYNC-01 5 個學生 socket + 老師：start、end 後每個 socket 都收到新 phase 的狀態', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 3 });
    const members = (await f.joinMembers(s.roomCode, 2)).flat().slice(0, 5);
    expect(members).toHaveLength(5);
    const teacher = await connectTeacher(s.sessionId);
    const students = await Promise.all(members.map((m) => connectMember(m.token)));
    for (const st of students) expect(st.first.session.phase).toBe('READY');

    for (const phase of ['RUNNING', 'ENDED'] as const) {
      const waits = [
        waitForEvent<TeacherView>(teacher.socket, 'teacher:state', (v) => v.session.phase === phase),
        ...students.map((st) => waitForEvent<TeamView>(st.socket, 'team:state', (v) => v.session.phase === phase)),
      ];
      if (phase === 'RUNNING') await f.startQuiz(s.sessionId);
      else await f.endQuiz(s.sessionId);
      const got = await Promise.all(waits);
      expect(got).toHaveLength(6);
    }
  });

  it('IT-RT-01 A 送出後老師 socket 在 500 ms 內收到含該送出的 teacher:state', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[a]] = await f.joinMembers(s.roomCode, 1);
    await f.startQuiz(s.sessionId);
    const teacher = await connectTeacher(s.sessionId);

    let submissionId = '';
    const received = waitForEvent<TeacherView>(
      teacher.socket,
      'teacher:state',
      (v) => v.cells.some((c) => c.questionId === s.q[3] && c.teamId === a!.teamId && c.submission !== null),
      500,
    );
    const t0 = performance.now();
    const res = await f.submit(a!.token, s.q[3]!, ANSWERS_A[3]!);
    expect(res.status).toBe(201);
    submissionId = res.body.submissionId;
    const view = await received;
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(500);
    const cell = view.cells.find((c) => c.questionId === s.q[3] && c.teamId === a!.teamId);
    expect(cell?.submission?.id).toBe(submissionId);
    expect(cell?.submission?.answers).toEqual(ANSWERS_A[3]);
  });
});
