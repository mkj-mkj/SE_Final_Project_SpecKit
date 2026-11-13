// UT-SVC-IMPORT（TEST_SPEC §5.4）：SessionService.importSheet
import { AppError, type Phase } from '@quiz/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadSnapshot, setCell } from '../helpers/fixtures.js';
import { makeTestService } from '../helpers/makeTestService.js';

type T = ReturnType<typeof makeTestService>;

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof AppError ? e.code : 'NOT_APP_ERROR';
  }
}

function setPhase(t: T, sessionId: string, phase: Phase): void {
  const s = t.repo.getSession(sessionId)!;
  t.repo.updateSession({ ...s, phase });
}

const SUMMARY_A = { questionCount: 4, groupCount: 2, singleCount: 2, subQuestionCount: 4, warnings: [] };

describe('SessionService.importSheet', () => {
  it('UT-SVC-IMPORT-01 匯入 fixture-template-a → READY、4 題、6 個 slot、summary 同 UT-PARSE-03、spreadsheetId 已存', async () => {
    const t = makeTestService();
    const id = t.service.createSession({}).session.id;
    t.broadcaster.calls = [];

    const { view, summary } = await t.service.importSheet(id, 'fixture-template-a');

    expect(summary).toEqual(SUMMARY_A);
    expect(view.session.phase).toBe('READY');
    const session = t.repo.getSession(id)!;
    expect(session.phase).toBe('READY');
    expect(session.spreadsheetId).toBe('fixture-template-a');
    expect(session.sheetTitle).toBe('學習單');
    expect(t.repo.listQuestions(id)).toHaveLength(4);
    expect(t.repo.listSlotsBySession(id)).toHaveLength(6);
    expect(t.broadcaster.calls).toEqual([{ sessionId: id }]);

    // FR-023：重新整理後由 TeacherView 取得摘要與題號清單
    const teacher = t.service.getTeacherView(id);
    expect(teacher.importSummary).toEqual(summary);
    expect(teacher.questions.map((q) => q.number)).toEqual([1, 2, 3, 4]);
    expect(teacher.questions[0]!.subLabels).toEqual(['（1）', '（2）']);
    expect(teacher.questions[0]!.winnerTeamId).toBeNull();

    // FR-10／原則 IV：學生只收到題號資訊，不含狀態、得主或題目敘述
    const { token } = t.service.join(view.session.roomCode, { teamId: view.teams[0]!.id, nickname: 'Amy' });
    const team = t.service.getTeamView(token);
    expect(team.questions).toHaveLength(4);
    for (const q of team.questions) {
      expect(Object.keys(q).sort()).toEqual(['id', 'isGroup', 'number', 'subCount', 'subLabels']);
    }
  });

  it('UT-SVC-IMPORT-02 READY 中再匯入 fixture-template-b → 6 題；舊題目、slot、草稿全部刪除', async () => {
    const t = makeTestService();
    const view = t.service.createSession({});
    const id = view.session.id;
    await t.service.importSheet(id, 'fixture-template-a');
    const oldQuestionIds = t.repo.listQuestions(id).map((q) => q.id);
    t.repo.db
      .prepare(
        `INSERT INTO drafts (team_id, question_id, answers, updated_by, updated_at)
         VALUES ($teamId, $questionId, '["CPU"]', 'mem-x', 0)`,
      )
      .run({ teamId: view.teams[0]!.id, questionId: oldQuestionIds[0]! });

    await t.service.importSheet(id, 'fixture-template-b');

    const questions = t.repo.listQuestions(id);
    expect(questions.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(questions.some((q) => oldQuestionIds.includes(q.id))).toBe(false);
    expect(t.repo.listSlotsBySession(id)).toHaveLength(6);
    const drafts = t.repo.db.prepare('SELECT COUNT(*) AS n FROM drafts').get() as { n: number };
    expect(Number(drafts.n)).toBe(0);
    expect(t.repo.getSession(id)!.phase).toBe('READY');
  });

  it('UT-SVC-IMPORT-03 RUNNING 中匯入 → INVALID_PHASE', async () => {
    const t = makeTestService();
    const id = t.service.createSession({}).session.id;
    setPhase(t, id, 'RUNNING');
    expect(await codeOf(t.service.importSheet(id, 'fixture-template-a'))).toBe('INVALID_PHASE');
    expect(t.repo.listQuestions(id)).toEqual([]);
  });

  it('UT-SVC-IMPORT-04 gateway failNext(SHEETS_PERMISSION_DENIED) → 丟出該錯誤；phase 與題目不變（READY 重新匯入失敗）', async () => {
    const t = makeTestService();
    const id = t.service.createSession({}).session.id;
    await t.service.importSheet(id, 'fixture-template-a');
    const before = { questions: t.repo.listQuestions(id), slots: t.repo.listSlotsBySession(id) };
    t.broadcaster.calls = [];

    t.gateway.failNext('SHEETS_PERMISSION_DENIED');
    expect(await codeOf(t.service.importSheet(id, 'fixture-template-b'))).toBe('SHEETS_PERMISSION_DENIED');

    expect(t.repo.getSession(id)!.phase).toBe('READY');
    expect(t.repo.listQuestions(id)).toEqual(before.questions);
    expect(t.repo.listSlotsBySession(id)).toEqual(before.slots);
    expect(t.repo.getImportSummary(id)).toEqual(SUMMARY_A);
    expect(t.broadcaster.calls).toEqual([]);
  });

  it("UT-SVC-IMPORT-05 輸入 'hello' → INVALID_SPREADSHEET_URL；gateway 未被呼叫", async () => {
    const t = makeTestService();
    const id = t.service.createSession({}).session.id;
    const spy = vi.spyOn(t.gateway, 'fetchSnapshot');
    expect(await codeOf(t.service.importSheet(id, 'hello'))).toBe('INVALID_SPREADSHEET_URL');
    expect(spy).not.toHaveBeenCalled();
  });

  it('UT-SVC-IMPORT-06 無表頭 snapshot → HEADER_NOT_FOUND；phase 仍為 SETUP', async () => {
    const t = makeTestService({
      snapshots: { 'fixture-no-header': setCell(loadSnapshot('template-b'), 'B4', '編號') },
    });
    const id = t.service.createSession({}).session.id;
    t.broadcaster.calls = [];
    expect(await codeOf(t.service.importSheet(id, 'fixture-no-header'))).toBe('HEADER_NOT_FOUND');
    expect(t.repo.getSession(id)!.phase).toBe('SETUP');
    expect(t.repo.listQuestions(id)).toEqual([]);
    expect(t.repo.getImportSummary(id)).toBeNull();
    expect(t.broadcaster.calls).toEqual([]);
  });
});
