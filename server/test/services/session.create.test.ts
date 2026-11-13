import { AppError, type Phase } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof AppError ? e.code : 'NOT_APP_ERROR';
  }
}

/** 測試需要其他階段時直接以 repo 設定（001 不實作 start／end） */
function setPhase(t: ReturnType<typeof makeTestService>, sessionId: string, phase: Phase): void {
  const s = t.repo.getSession(sessionId)!;
  t.repo.updateSession({ ...s, phase });
}

describe('SessionService.createSession / updateSettings', () => {
  it('UT-SVC-CREATE-01 createSession({}) 使用預設值', () => {
    const { service } = makeTestService();
    const view = service.createSession({});
    expect(view.session.phase).toBe('SETUP');
    expect(view.session.round).toBe(1);
    expect(view.session.fairnessMode).toBe('fair');
    expect(view.session.windowSec).toBe(3);
    expect(view.session.teamCount).toBe(6);
    expect(view.teams.map((t) => t.name)).toEqual(['第 1 組', '第 2 組', '第 3 組', '第 4 組', '第 5 組', '第 6 組']);
    expect(view.teams.map((t) => t.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('UT-SVC-CREATE-02 房間碼重複時重抽；getCurrentSession 回傳最新建立的活動', () => {
    const t = makeTestService({ roomCodes: ['AAAAA2', 'AAAAA2', 'AAAAA3'] });
    const first = t.service.createSession({});
    const second = t.service.createSession({});
    expect(first.session.roomCode).toBe('AAAAA2');
    expect(second.session.roomCode).toBe('AAAAA3');
    // 額外斷言（plan.md「驗證範圍與後續子功能」，涵蓋 FR-009）
    expect(t.service.getCurrentSession()?.session.id).toBe(second.session.id);
  });

  it('UT-SVC-CREATE-03 組數 1、21，秒數 0、11 → INVALID_INPUT（createSession 與 updateSettings）', () => {
    const { service } = makeTestService();
    const bad = [{ teamCount: 1 }, { teamCount: 21 }, { windowSec: 0 }, { windowSec: 11 }];
    for (const input of bad) {
      expect(codeOf(() => service.createSession(input)), JSON.stringify(input)).toBe('INVALID_INPUT');
    }
    const { session } = service.createSession({});
    for (const input of bad) {
      expect(codeOf(() => service.updateSettings(session.id, input)), JSON.stringify(input)).toBe('INVALID_INPUT');
    }
    expect(service.getTeacherView(session.id).teams).toHaveLength(6);
  });

  it('UT-SVC-CREATE-04 6 → 8 組，新增第 7、8 組', () => {
    const { service } = makeTestService();
    const { session } = service.createSession({});
    const view = service.updateSettings(session.id, { teamCount: 8 });
    expect(view.session.teamCount).toBe(8);
    expect(view.teams.map((t) => t.name)).toEqual([
      '第 1 組',
      '第 2 組',
      '第 3 組',
      '第 4 組',
      '第 5 組',
      '第 6 組',
      '第 7 組',
      '第 8 組',
    ]);
  });

  it('UT-SVC-CREATE-05 6 → 4 組：第 5 組有成員 → TEAM_HAS_MEMBERS；無成員時成功', () => {
    const { service } = makeTestService();
    const created = service.createSession({});
    const team5 = created.teams.find((t) => t.index === 5)!;
    const join = service.join(created.session.roomCode, { teamId: team5.id, nickname: '小明' });
    expect(codeOf(() => service.updateSettings(created.session.id, { teamCount: 4 }))).toBe('TEAM_HAS_MEMBERS');
    expect(service.getTeacherView(created.session.id).teams).toHaveLength(6);
    expect(service.getTeacherView(created.session.id).session.teamCount).toBe(6);

    const other = makeTestService();
    const s2 = other.service.createSession({});
    const view = other.service.updateSettings(s2.session.id, { teamCount: 4 });
    expect(view.teams.map((t) => t.index)).toEqual([1, 2, 3, 4]);
    expect(view.session.teamCount).toBe(4);
    expect(join.teamId).toBe(team5.id);
  });

  it('UT-SVC-CREATE-06 RUNNING 中 updateSettings → INVALID_PHASE', () => {
    const t = makeTestService();
    const { session } = t.service.createSession({});
    setPhase(t, session.id, 'RUNNING');
    expect(codeOf(() => t.service.updateSettings(session.id, { teamCount: 8 }))).toBe('INVALID_PHASE');
  });

  it('UT-SVC-CREATE-07 成功操作後 broadcaster 記錄一次 publish（預設 scope）', () => {
    const t = makeTestService();
    const { session } = t.service.createSession({});
    expect(t.broadcaster.calls).toEqual([{ sessionId: session.id }]);
    t.broadcaster.calls = [];
    t.service.updateSettings(session.id, { fairnessMode: 'speed' });
    expect(t.broadcaster.calls).toEqual([{ sessionId: session.id }]);
    // 失敗的操作不推播
    t.broadcaster.calls = [];
    codeOf(() => t.service.updateSettings(session.id, { teamCount: 99 }));
    expect(t.broadcaster.calls).toEqual([]);
  });
});
