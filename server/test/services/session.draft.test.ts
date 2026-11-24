import { describe, expect, it } from 'vitest';
import { makeTestService } from '../helpers/makeTestService.js';
import { seedRunning } from '../helpers/seed.js';

const code = (c: string) => expect.objectContaining({ code: c });

describe('SessionService.updateDraft（組內共編）', () => {
  it('UT-SVC-DRAFT-01 A 組成員 1 更新第 1 題草稿 → A 組成員 2 看得到；B 組看不到', async () => {
    const t = makeTestService();
    const { tokens, q } = await seedRunning(t);
    const [a1, a2] = tokens[0]!;
    const memberA1 = t.service.resolveMember(a1!);

    t.service.updateDraft(a1!, q[1]!, ['C', '']);

    const viewA2 = t.service.getTeamView(a2!);
    expect(viewA2.drafts[q[1]!]).toEqual({ answers: ['C', ''], updatedBy: memberA1.id, updatedAt: t.clock.now() });
    const viewB = t.service.getTeamView(tokens[1]![0]!);
    expect(viewB.drafts).toEqual({});
    const jsonB = JSON.stringify(viewB);
    expect(jsonB).not.toContain('"C"');
    expect(jsonB).not.toContain(memberA1.id);
  });

  it('UT-SVC-DRAFT-02 READY 中更新 → INVALID_PHASE', async () => {
    const t = makeTestService();
    const created = t.service.createSession({ teamCount: 2 });
    await t.service.importSheet(created.session.id, 'fixture-template-a');
    const teamId = t.repo.listTeams(created.session.id)[0]!.id;
    const { token } = t.service.join(created.session.roomCode, { teamId, nickname: 'Amy' });
    const qid = t.repo.listQuestions(created.session.id)[2]!.id;
    expect(() => t.service.updateDraft(token, qid, ['0'])).toThrowError(code('INVALID_PHASE'));
    expect(t.repo.listDrafts(created.session.id)).toEqual([]);
  });

  it('UT-SVC-DRAFT-03 長度不符 → INVALID_INPUT；201 字 → ANSWER_TOO_LONG；空字串允許且不 trim', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    const a1 = tokens[0]![0]!;
    expect(() => t.service.updateDraft(a1, q[1]!, ['C'])).toThrowError(code('INVALID_INPUT'));
    expect(() => t.service.updateDraft(a1, q[1]!, ['x'.repeat(201), ''])).toThrowError(code('ANSWER_TOO_LONG'));
    expect(() => t.service.updateDraft(a1, 'q_nope', ['0'])).toThrowError(code('QUESTION_NOT_FOUND'));
    expect(() => t.service.updateDraft('tok_nope', q[1]!, ['', ''])).toThrowError(code('UNAUTHORIZED'));

    t.service.updateDraft(a1, q[1]!, ['', '']);
    expect(t.repo.listDrafts(sessionId)[0]?.answers).toEqual(['', '']);
    t.service.updateDraft(a1, q[1]!, [' a ', '']);
    t.service.updateDraft(a1, q[2]!, ['x'.repeat(200), '']);
    expect(t.repo.listDrafts(sessionId).find((d) => d.questionId === q[1])?.answers).toEqual([' a ', '']);
  });

  it('UT-SVC-DRAFT-04 本組該題已有 active 送出 → ALREADY_SUBMITTED', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    const member = t.service.resolveMember(tokens[0]![0]!);
    t.repo.insertSubmission({
      id: 'sub_x',
      sessionId,
      questionId: q[3]!,
      teamId: teamIds[0]!,
      memberId: member.id,
      answers: ['0'],
      serverTime: t.clock.now(),
      seq: t.repo.nextSeq(),
      status: 'active',
      orderKey: 1,
      withdrawnAt: null,
    });
    expect(() => t.service.updateDraft(tokens[0]![1]!, q[3]!, ['1'])).toThrowError(code('ALREADY_SUBMITTED'));
    // 其他組不受影響
    t.service.updateDraft(tokens[1]![0]!, q[3]!, ['1']);
    expect(t.repo.listDrafts(sessionId).map((d) => d.teamId)).toEqual([teamIds[1]]);
  });

  it('UT-SVC-DRAFT-05 更新成功後只推播給本組：scope { teacher: false, teamIds: [A] }', async () => {
    const t = makeTestService();
    const { sessionId, teamIds, tokens, q } = await seedRunning(t);
    const before = t.broadcaster.calls.length;
    t.service.updateDraft(tokens[0]![0]!, q[3]!, ['0']);
    expect(t.broadcaster.calls.length).toBe(before + 1);
    expect(t.broadcaster.calls.at(-1)).toEqual({ sessionId, scope: { teacher: false, teamIds: [teamIds[0]] } });
    // 失敗時不推播
    expect(() => t.service.updateDraft(tokens[0]![0]!, q[3]!, [])).toThrow();
    expect(t.broadcaster.calls.length).toBe(before + 1);
  });
});
