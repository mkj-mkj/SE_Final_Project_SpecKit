import { describe, expect, it } from 'vitest';
import { SessionService } from '../../src/services/sessionService.js';
import { makeTestService } from '../helpers/makeTestService.js';
import { ManualScheduler } from '../helpers/manualScheduler.js';
import { RecordingBroadcaster } from '../helpers/recordingBroadcaster.js';
import { seedRunning } from '../helpers/seed.js';

/** 模擬重啟：同一個 repo 與 clock，新的 scheduler、broadcaster 與 service（記憶體狀態全部重來） */
function restart(t: ReturnType<typeof makeTestService>) {
  const scheduler = new ManualScheduler(t.clock);
  const broadcaster = new RecordingBroadcaster();
  const service = new SessionService({ repo: t.repo, clock: t.clock, scheduler, ids: t.ids, sheets: t.gateway, broadcaster });
  return { service, scheduler, broadcaster };
}

describe('SessionService.recover（啟動恢復）', () => {
  it('UT-SVC-RECOVER-01 重啟時視窗已過期 → recover 立即結算並推播', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.clock.advance(5000); // 舊程序的排程沒有觸發（已停止）

    const r = restart(t);
    r.service.recover();

    const view = r.service.getTeacherView(sessionId);
    expect(view.questions.find((x) => x.id === q[3])).toMatchObject({ state: 'settled', winnerTeamId: teamIds[0] });
    expect(r.scheduler.pending()).toEqual([]);
    expect(r.broadcaster.calls).toEqual([{ sessionId }]);
  });

  it('UT-SVC-RECOVER-02 視窗尚未到期 → 重新排程，到期後結算', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[1]![0]!, q[4]!, ['IP']);
    const endsAt = t.repo.getQuestion(q[4]!)!.windowEndsAt!;
    t.clock.advance(1000);

    const r = restart(t);
    r.service.recover();

    expect(r.scheduler.pending()).toEqual([{ key: `window:${q[4]}`, at: endsAt }]);
    expect(r.broadcaster.calls).toEqual([]); // 沒有結算的活動不推播
    r.scheduler.advanceTo(endsAt);
    const view = r.service.getTeacherView(sessionId);
    expect(view.questions.find((x) => x.id === q[4])).toMatchObject({ state: 'settled', winnerTeamId: teamIds[1] });
    expect(r.broadcaster.calls).toEqual([{ sessionId }]);
  });

  it('UT-SVC-RECOVER-03 recover 後所有成員 online=false', async () => {
    const t = makeTestService();
    const { sessionId, tokens } = await seedRunning(t, { mode: 'fair' });
    const r = restart(t);
    const memberId = r.service.resolveMember(tokens[0]![0]!).id;
    r.service.setOnline(memberId, true);
    expect(r.service.getTeacherView(sessionId).teams.flatMap((x) => x.members).find((m) => m.id === memberId)?.online).toBe(true);

    r.service.recover();

    expect(r.service.getTeacherView(sessionId).teams.flatMap((x) => x.members).every((m) => m.online === false)).toBe(true);
  });
});
