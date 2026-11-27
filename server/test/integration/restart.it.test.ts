// IT-RESTART-01（TEST_SPEC §6；FR-043、SC-008）：檔案 DB、公平模式送出後關閉 app；
// clock +5 秒後以同 DB、同 clock 重建，走與 index.ts 相同的 recoverOnBoot(serviceOf(app)) → 該題已結算、顯示得主
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { serviceOf } from '../../src/app.js';
import { recoverOnBoot } from '../../src/boot/recover.js';
import { FakeClock } from '../helpers/fakeClock.js';
import { ANSWERS_A, flow } from './flow.js';
import { startApp } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

describe('重啟恢復整合測試', () => {
  let dir: string | null = null;
  const apps: App[] = [];
  afterEach(async () => {
    for (const a of apps.splice(0)) await a.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('IT-RESTART-01 公平模式送出後關閉，clock +5 秒以同 DB 重啟並 recover → 該題已結算，老師 view 顯示得主', async () => {
    dir = mkdtempSync(join(tmpdir(), 'quiz-it-restart-'));
    const dbPath = join(dir, 'quiz.db');
    const clock = new FakeClock();

    // 第一次啟動：公平模式 3 秒視窗，送出後題目進入視窗
    const t1 = await startApp({ dbPath, clock });
    apps.push(t1);
    const f1 = flow(t1.baseUrl);
    await f1.login();
    const s = await f1.createAndImport({ mode: 'fair', windowSec: 3, teamCount: 2 });
    const [[m1]] = await f1.joinMembers(s.roomCode, 1);
    await f1.startQuiz(s.sessionId);
    const sub = await f1.submit(m1!.token, s.q[3]!, ANSWERS_A[3]!);
    expect(sub.status).toBe(201);
    const inWindow = await f1.getTeacherView(s.sessionId);
    expect(inWindow.questions.find((q) => q.id === s.q[3])?.state).toBe('window');
    await t1.close(); // 視窗排程隨 app 關閉而消失

    // 時間超過視窗結束後，以同 DB、同 clock 重新啟動
    clock.advance(5000);
    const t2 = await startApp({ dbPath, clock });
    apps.push(t2);
    const f2 = flow(t2.baseUrl);
    await f2.login();
    const beforeRecover = await f2.getTeacherView(s.sessionId);
    expect(beforeRecover.questions.find((q) => q.id === s.q[3])?.state).toBe('window');

    recoverOnBoot(serviceOf(t2.app)); // 與 index.ts 相同的啟動恢復流程

    const view = await f2.getTeacherView(s.sessionId);
    const q3 = view.questions.find((q) => q.id === s.q[3]);
    expect(q3?.state).toBe('settled');
    expect(q3?.winnerTeamId).toBe(m1!.teamId);
    const cell = view.cells.find((c) => c.questionId === s.q[3] && c.teamId === m1!.teamId);
    expect(cell?.submission?.id).toBe(sub.body.submissionId);
    expect(cell?.submission?.isWinner).toBe(true);
    expect(cell?.submission?.rank).toBe(1);
    expect(view.teams.find((x) => x.id === m1!.teamId)?.score).toBe(1);
  });
});
