import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';
import { seedRunning } from '../helpers/seed.js';

/** 建立活動並匯入範例 A，進入 READY（等待開始） */
async function readySession(): Promise<{ t: ReturnType<typeof makeTestService>; sessionId: string }> {
  const t = makeTestService();
  const sessionId = t.service.createSession({ teamCount: 3, fairnessMode: 'speed' }).session.id;
  await t.service.importSheet(sessionId, 'fixture-template-a');
  return { t, sessionId };
}

describe('SessionService 階段轉換（start、end、reset）', () => {
  it("UT-SVC-PHASE-01 SETUP 中（未匯入）start → AppError('INVALID_PHASE')", () => {
    const t = makeTestService();
    const sessionId = t.service.createSession({}).session.id;
    const before = t.broadcaster.calls.length;
    expect(() => t.service.start(sessionId)).toThrowError(expect.objectContaining({ code: 'INVALID_PHASE' }));
    expect(t.repo.getSession(sessionId)?.phase).toBe('SETUP');
    expect(t.broadcaster.calls.length).toBe(before);
  });

  it('UT-SVC-PHASE-02 READY 中 start → RUNNING、startedAt=now、題目全為 open、推播給全部', async () => {
    const { t, sessionId } = await readySession();
    // 先把一題設成非 open，確認 start 會重設
    const q = t.repo.listQuestions(sessionId)[0];
    t.repo.updateQuestionState(q!.id, 'settled', null);
    t.clock.advance(5000);

    const view = t.service.start(sessionId);

    expect(view.session.phase).toBe('RUNNING');
    expect(view.session.startedAt).toBe(t.clock.now());
    expect(t.repo.getSession(sessionId)?.startedAt).toBe(t.clock.now());
    expect(t.repo.listQuestions(sessionId).every((x) => x.state === 'open' && x.windowEndsAt === null)).toBe(true);
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId });
  });

  it('UT-SVC-PHASE-04 READY 中 end → INVALID_PHASE', async () => {
    const { t, sessionId } = await readySession();
    expect(() => t.service.end(sessionId)).toThrowError(expect.objectContaining({ code: 'INVALID_PHASE' }));
    // RUNNING 以外也不能 reset
    expect(() => t.service.reset(sessionId)).toThrowError(expect.objectContaining({ code: 'INVALID_PHASE' }));
    expect(t.repo.getSession(sessionId)?.phase).toBe('READY');
  });

  it('UT-SVC-PHASE-05 end → reset：READY、round 2、送出與草稿清空、成員與題目保留、題目 open、時間清空', async () => {
    const { t, sessionId } = await readySession();
    const teams = t.repo.listTeams(sessionId);
    const joined = t.service.join(t.repo.getSession(sessionId)!.roomCode, { teamId: teams[0]!.id, nickname: 'Amy' });
    t.service.start(sessionId);
    const [q1, q2] = t.repo.listQuestions(sessionId);
    t.repo.insertSubmission({
      id: 'sub_x',
      sessionId,
      questionId: q1!.id,
      teamId: joined.teamId,
      memberId: joined.memberId,
      answers: ['CPU', '作業系統'],
      serverTime: t.clock.now(),
      seq: t.repo.nextSeq(),
      status: 'active',
      orderKey: 1,
      withdrawnAt: null,
    });
    t.repo.updateQuestionState(q1!.id, 'settled', null);
    t.repo.upsertDraft({ teamId: joined.teamId, questionId: q2!.id, answers: ['演', ''], updatedBy: joined.memberId, updatedAt: 1 });

    t.clock.advance(1000);
    const ended = t.service.end(sessionId);
    expect(ended.session.phase).toBe('ENDED');
    expect(ended.session.endedAt).toBe(t.clock.now());
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId });

    const view = t.service.reset(sessionId);
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId });
    expect(view.session).toMatchObject({ phase: 'READY', round: 2, startedAt: null, endedAt: null });
    expect(t.repo.listSubmissions(sessionId)).toEqual([]);
    expect(t.repo.listDrafts(sessionId)).toEqual([]);
    expect(t.repo.listMembersBySession(sessionId).map((m) => m.id)).toEqual([joined.memberId]);
    expect(t.repo.listQuestions(sessionId)).toHaveLength(4);
    expect(t.repo.listQuestions(sessionId).every((x) => x.state === 'open' && x.windowEndsAt === null)).toBe(true);
  });

  it('UT-SVC-PHASE-03 公平模式第 3 題視窗中按 end → 先結算（A 得主）、取消排程，再 ENDED；只推播 1 次', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    expect(t.scheduler.pending()).toHaveLength(1);
    t.clock.advance(1000);
    const before = t.broadcaster.calls.length;

    const view = t.service.end(sessionId);

    expect(view.questions.find((x) => x.id === q[3])).toMatchObject({ state: 'settled', windowEndsAt: null, winnerTeamId: teamIds[0] });
    expect(t.scheduler.pending()).toEqual([]);
    expect(view.session.phase).toBe('ENDED');
    expect(view.session.endedAt).toBe(t.clock.now());
    expect(t.broadcaster.calls.length).toBe(before + 1);
    // 排程已取消：之後推進時間也不會再結算或推播
    t.scheduler.advance(5000);
    expect(t.broadcaster.calls.length).toBe(before + 1);
  });

  it('UT-SVC-PHASE-03 多題視窗中按 end → 依 (windowEndsAt, 題號) 逐題結算，前一題結果計入後一題', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t, { mode: 'fair' });
    const [A, B] = [tokens[0]![0]!, tokens[1]![0]!];
    // 同一毫秒：第 4 題先開窗；A 在兩題都較早
    t.service.submit(A, q[4]!, ['IP']);
    t.service.submit(A, q[3]!, ['0']);
    t.service.submit(B, q[4]!, ['IP']);
    t.service.submit(B, q[3]!, ['0']);
    const view = t.service.end(sessionId);
    expect(view.questions.find((x) => x.id === q[3])?.winnerTeamId).toBe(teamIds[0]);
    expect(view.questions.find((x) => x.id === q[4])?.winnerTeamId).toBe(teamIds[1]);
    expect(t.scheduler.pending()).toEqual([]);
  });
});