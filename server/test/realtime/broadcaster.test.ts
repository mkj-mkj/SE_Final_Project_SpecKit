import { describe, expect, it } from 'vitest';
import { projectTeamView } from '../../src/domain/projections.js';
import { createSocketBroadcaster } from '../../src/realtime/broadcaster.js';
import { fakeIo } from '../helpers/fakeIo.js';
import { makeTestService } from '../helpers/makeTestService.js';

/** 3 組的活動，每組 1 位成員；回傳以 fakeIo 建立的 socket broadcaster */
function setup() {
  const t = makeTestService();
  const view = t.service.createSession({ teamCount: 3 });
  const [A, B, C] = view.teams.map((x) => x.id) as [string, string, string];
  t.service.join(view.session.roomCode, { teamId: A, nickname: 'Amy' });
  t.service.join(view.session.roomCode, { teamId: B, nickname: 'SECRETNICKB' });
  t.service.join(view.session.roomCode, { teamId: C, nickname: 'Cat' });
  const { io, emitted } = fakeIo();
  const bc = createSocketBroadcaster(io, (id) => t.service.loadAggregate(id), t.clock);
  return { ...t, sessionId: view.session.id, A, B, C, bc, emitted };
}

describe('createSocketBroadcaster', () => {
  it('UT-BC-01 publish(s)（3 組）→ 老師 room 收 1 次 teacher:state，每組 room 各收 1 次 team:state', () => {
    const t = setup();
    t.bc.publish(t.sessionId);
    const summary = t.emitted.map((e) => `${e.room}|${e.event}`).sort();
    expect(summary).toEqual(
      [`teacher:${t.sessionId}|teacher:state`, `team:${t.A}|team:state`, `team:${t.B}|team:state`, `team:${t.C}|team:state`].sort(),
    );
  });

  it('UT-BC-02 publish(s, {teacher:false, teamIds:[A]}) → 只有 team:A 收到', () => {
    const t = setup();
    t.bc.publish(t.sessionId, { teacher: false, teamIds: [t.A] });
    expect(t.emitted.map((e) => [e.room, e.event])).toEqual([[`team:${t.A}`, 'team:state']]);
  });

  it('UT-BC-03 送到 team:A 的 payload 深度等於 projectTeamView(agg, A)，且不含 cells', () => {
    const t = setup();
    t.bc.publish(t.sessionId);
    const toA = t.emitted.find((e) => e.room === `team:${t.A}`)!;
    const expected = projectTeamView(t.service.loadAggregate(t.sessionId), t.A, t.clock.now());
    expect(toA.payload).toEqual(expected);
    expect(toA.payload).not.toHaveProperty('cells');
    expect(JSON.stringify(toA.payload)).not.toContain('SECRETNICKB');
  });
});
