// 004 結果可見性整合測試（TEST_SPEC §6）：IT-VIS-02（tasks T037）
// 接續 IT-VIS-01 的情境（自行建立）：RUNNING 中判錯不洩漏他組資料（spec SC-008、FR-10），end 後 B 看得到 A 的答案（FR-09）。
import type { TeacherView, TeamView } from '@quiz/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flow, waitForEvent } from './flow.js';
import { startApp } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

describe('004 結果可見性整合測試', () => {
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

  it('IT-VIS-02 RUNNING 中判錯 A：B 在 end 前收不到 A 的答案／rejected／id；A 看到 rejected；end 後 B 的 results 含 A 的答案', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[a], [b]] = await f.joinMembers(s.roomCode, 1);
    await f.startQuiz(s.sessionId);

    const teacher = t.connect({ token: f.teacherToken, sessionId: s.sessionId });
    await waitForEvent<TeacherView>(teacher, 'teacher:state');
    const sockA = t.connect({ token: a!.token });
    await waitForEvent<TeamView>(sockA, 'team:state');
    // B 的所有事件（含連線後第一個狀態）都記錄下來，並標記是否在 end 之前
    const sockB = t.connect({ token: b!.token });
    const bBeforeEnd: { event: string; payload: unknown }[] = [];
    let ended = false;
    sockB.onAny((event: string, payload: unknown) => {
      if (!ended) bBeforeEnd.push({ event, payload });
    });
    await waitForEvent<TeamView>(sockB, 'team:state');

    // A 先送出第 3 題（純速度 → 得主），B 隨後送出（第 2 名）
    const subA = await f.submit(a!.token, s.q[3]!, ['SECRET-A-123']);
    expect(subA.status).toBe(201);
    const subB = await f.submit(b!.token, s.q[3]!, ['B-ANSWER']);
    expect(subB.status).toBe(201);

    // RUNNING 中老師判錯 A 的第 3 題 → B 遞補
    const aSawRejected = waitForEvent<TeamView>(sockA, 'team:state', (v) => v.mySubmissions[s.q[3]!]?.status === 'rejected');
    const rej = await f.rejectWinner(f.teacherToken, s.sessionId, s.q[3]!);
    expect(rej.status).toBe(200);
    expect(rej.body.questions.find((q) => q.number === 3)!.winnerTeamId).toBe(b!.teamId);
    const aView = await aSawRejected;
    expect(aView.mySubmissions[s.q[3]!]!.status).toBe('rejected');
    expect(aView.mySubmissions[s.q[3]!]!.answers).toEqual(['SECRET-A-123']);

    // 屏障：B 自己存草稿並等到自己的 team:state；同一連線事件依序送達，先前推給 B 的事件（含判錯後的推播）都已收到
    const bBarrier = waitForEvent<TeamView>(sockB, 'team:state', (v) => JSON.stringify(v.drafts).includes('B-BARRIER'));
    expect((await f.putDraft(b!.token, s.q[4]!, ['B-BARRIER'])).status).toBe(204);
    await bBarrier;

    // B 在 end 之前收到的所有 payload 不含 A 的答案、rejected、A 的 member id 與 submission id
    expect(bBeforeEnd.length).toBeGreaterThan(0);
    const bText = JSON.stringify(bBeforeEnd);
    expect(bText).not.toContain('SECRET-A-123');
    expect(bText).not.toContain('rejected');
    expect(bText).not.toContain(a!.memberId);
    expect(bText).not.toContain(subA.body.submissionId);

    // end → B 收到的 team:state.results 含 A 的答案（FR-09）
    const bResults = waitForEvent<TeamView>(sockB, 'team:state', (v) => v.results !== null);
    ended = true;
    await f.endQuiz(s.sessionId);
    const bEnded = await bResults;
    expect(bEnded.session.phase).toBe('ENDED');
    const q3 = bEnded.results!.questions.find((q) => q.number === 3)!;
    expect(JSON.stringify(bEnded.results)).toContain('SECRET-A-123');
    expect(q3.winner!.teamId).toBe(b!.teamId);
    const aRow = q3.ranking.find((r) => r.teamId === a!.teamId)!;
    expect(aRow.answers).toEqual(['SECRET-A-123']);
    expect(aRow.status).toBe('rejected');
  });
});
