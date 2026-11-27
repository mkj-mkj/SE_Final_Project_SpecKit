// IT-RECON-01、02（TEST_SPEC §6；E7、FR-042、SC-007）：斷線後以同 token 重連，立即取得最新狀態
import type { TeamView } from '@quiz/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANSWERS_A, flow, waitForEvent } from './flow.js';
import { startApp } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

describe('斷線重連整合測試', () => {
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

  /** 連線並回傳第一個 team:state（連線後伺服器立即送出） */
  async function connectFirst(token: string) {
    const socket = t.connect({ token });
    const first = await waitForEvent<TeamView>(socket, 'team:state');
    return { socket, first };
  }

  /** 關閉 socket 並等伺服器處理完斷線 */
  async function disconnect(socket: ReturnType<App['connect']>) {
    const before = t.io.of('/').sockets.size;
    socket.close();
    await vi.waitFor(() => expect(t.io.of('/').sockets.size).toBe(before - 1));
  }

  it('IT-RECON-01 送出並存草稿後斷線，以同 token 重連立即收到含草稿與送出（原 withdrawableUntil）的 team:state；搶答中新成員加入也一樣', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[m1]] = await f.joinMembers(s.roomCode, 1);
    await f.startQuiz(s.sessionId);

    const first = await connectFirst(m1!.token);
    const sub = await f.submit(m1!.token, s.q[3]!, ANSWERS_A[3]!);
    expect(sub.status).toBe(201);
    expect((await f.putDraft(m1!.token, s.q[2]!, ['演算法', ''])).status).toBe(204);
    await disconnect(first.socket);

    t.clock.advance(2000); // 重連時間晚於送出，withdrawableUntil 仍依原送出時間
    const re = await connectFirst(m1!.token);
    const check = (v: TeamView) => {
      expect(v.session.phase).toBe('RUNNING');
      expect(v.drafts[s.q[2]!]?.answers).toEqual(['演算法', '']);
      const mine = v.mySubmissions[s.q[3]!];
      expect(mine?.id).toBe(sub.body.submissionId);
      expect(mine?.answers).toEqual(ANSWERS_A[3]);
      expect(mine?.status).toBe('active');
      expect(mine?.serverTime).toBe(sub.body.serverTime);
      expect(mine?.withdrawableUntil).toBe(sub.body.withdrawableUntil);
      expect(mine?.withdrawableUntil).toBe(sub.body.serverTime + 10_000);
    };
    check(re.first);

    // spec 邊界情況：搶答中有新成員加入同組 → 第一個 team:state 即含本組既有草稿與送出
    const newcomer = await f.joinMember(s.roomCode, m1!.teamId, 'Newcomer');
    const nc = await connectFirst(newcomer.token);
    check(nc.first);
    expect(nc.first.team.members.map((x) => x.id)).toContain(newcomer.memberId);
  });

  it('IT-RECON-02 斷線期間老師 end，重連後收到的 team:state.session.phase === ENDED', async () => {
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2 });
    const [[m1]] = await f.joinMembers(s.roomCode, 1);
    await f.startQuiz(s.sessionId);

    const first = await connectFirst(m1!.token);
    expect(first.first.session.phase).toBe('RUNNING');
    await disconnect(first.socket);

    await f.endQuiz(s.sessionId);
    const re = await connectFirst(m1!.token);
    expect(re.first.session.phase).toBe('ENDED');
    expect(re.first.results).not.toBeNull();
  });
});
