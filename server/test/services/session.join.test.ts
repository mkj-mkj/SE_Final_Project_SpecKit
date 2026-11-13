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

function setup() {
  const t = makeTestService();
  const view = t.service.createSession({});
  const teamId = (index: number) => view.teams.find((x) => x.index === index)!.id;
  const memberCount = (index: number) =>
    t.service.getPublicInfo(view.session.roomCode).teams.find((x) => x.id === teamId(index))!.memberCount;
  return { ...t, view, roomCode: view.session.roomCode, sessionId: view.session.id, teamId, memberCount };
}

/** 測試需要其他階段時直接以 repo 設定（001 不實作 start／end） */
function setPhase(t: ReturnType<typeof setup>, phase: Phase): void {
  const s = t.repo.getSession(t.sessionId)!;
  t.repo.updateSession({ ...s, phase });
}

describe('SessionService.join / getPublicInfo / resolveMember / getTeamView', () => {
  it('UT-SVC-JOIN-01 正常加入回傳 token，getPublicInfo 該組 memberCount 1', () => {
    const t = setup();
    const r = t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: '小明' });
    expect(r.token).toBeTruthy();
    expect(r.teamId).toBe(t.teamId(1));
    expect(r.sessionId).toBe(t.sessionId);
    expect(r.memberId).toBeTruthy();
    expect(t.memberCount(1)).toBe(1);
    // 加入後推播給老師與該組
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId: t.sessionId, scope: { teacher: true, teamIds: [t.teamId(1)] } });
    // 公開資訊不含暱稱
    expect(JSON.stringify(t.service.getPublicInfo(t.roomCode))).not.toContain('小明');
  });

  it('UT-SVC-JOIN-02 房間碼小寫可加入', () => {
    const t = setup();
    const r = t.service.join(t.roomCode.toLowerCase(), { teamId: t.teamId(2), nickname: 'Amy' });
    expect(r.teamId).toBe(t.teamId(2));
  });

  it('UT-SVC-JOIN-03 不存在的房間碼 → SESSION_NOT_FOUND', () => {
    const t = setup();
    expect(codeOf(() => t.service.join('ZZZZZ9', { teamId: t.teamId(1), nickname: 'Amy' }))).toBe('SESSION_NOT_FOUND');
    expect(codeOf(() => t.service.getPublicInfo('ZZZZZ9'))).toBe('SESSION_NOT_FOUND');
  });

  it('UT-SVC-JOIN-04 teamId 屬於別的活動 → TEAM_NOT_FOUND', () => {
    const t = setup();
    const other = t.service.createSession({});
    expect(codeOf(() => t.service.join(t.roomCode, { teamId: other.teams[0]!.id, nickname: 'Amy' }))).toBe(
      'TEAM_NOT_FOUND',
    );
    expect(codeOf(() => t.service.join(t.roomCode, { teamId: 'team_nope', nickname: 'Amy' }))).toBe('TEAM_NOT_FOUND');
  });

  it('UT-SVC-JOIN-05 同組 Amy 後再 amy → NICKNAME_TAKEN；其他組可用 amy', () => {
    const t = setup();
    t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: 'Amy' });
    expect(codeOf(() => t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: 'amy' }))).toBe('NICKNAME_TAKEN');
    expect(t.service.join(t.roomCode, { teamId: t.teamId(2), nickname: 'amy' }).teamId).toBe(t.teamId(2));
    expect(t.memberCount(1)).toBe(1);
  });

  it('UT-SVC-JOIN-06 resolveMember("bad") → UNAUTHORIZED', () => {
    const t = setup();
    expect(codeOf(() => t.service.resolveMember('bad'))).toBe('UNAUTHORIZED');
    expect(codeOf(() => t.service.getTeamView('bad'))).toBe('UNAUTHORIZED');
  });

  it('UT-SVC-JOIN-07 RUNNING、ENDED 中加入皆成功', () => {
    const t = setup();
    setPhase(t, 'RUNNING');
    expect(t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: 'Amy' }).teamId).toBe(t.teamId(1));
    setPhase(t, 'ENDED');
    expect(t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: 'Ben' }).teamId).toBe(t.teamId(1));
    expect(t.memberCount(1)).toBe(2);
  });

  it('UT-SVC-JOIN-08 用原 token 再次 getTeamView 回到同一組、資料一致', () => {
    const t = setup();
    const r = t.service.join(t.roomCode, { teamId: t.teamId(3), nickname: '小華' });
    const first = t.service.getTeamView(r.token);
    const again = t.service.getTeamView(r.token);
    expect(again).toEqual(first);
    expect(again.team).toEqual({
      id: t.teamId(3),
      name: '第 3 組',
      members: [{ id: r.memberId, nickname: '小華', online: false }],
    });
    expect(again.session).toEqual({ roomCode: t.roomCode, phase: 'SETUP', round: 1 });
    const me = t.service.resolveMember(r.token);
    expect(me).toMatchObject({ id: r.memberId, teamId: t.teamId(3), nickname: '小華', sessionId: t.sessionId });
  });

  it('UT-SVC-JOIN-09 暱稱 小明😀 → INVALID_NICKNAME，該組 memberCount 不變', () => {
    const t = setup();
    expect(codeOf(() => t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: '小明😀' }))).toBe(
      'INVALID_NICKNAME',
    );
    expect(t.memberCount(1)).toBe(0);
  });

  it('UT-SVC-JOIN-10 同一組連續加入 25 位 → 全部成功，memberCount 25', () => {
    const t = setup();
    for (let i = 1; i <= 25; i++) {
      t.service.join(t.roomCode, { teamId: t.teamId(1), nickname: `Player${i}` });
    }
    expect(t.memberCount(1)).toBe(25);
  });
});
