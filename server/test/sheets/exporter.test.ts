// UT-EXP-01～04（TEST_SPEC §5.2）：寫回寫入清單。位置一律取自匯入時記錄的 answer_slots（憲章原則 V）。
import type { AnswerSlot, Submission } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { buildExportWrites, buildRestoreWrites } from '../../src/sheets/exporter.js';
import { makeTestService } from '../helpers/makeTestService.js';

/** 匯入指定範本，回傳該活動的題目與作答格 */
async function imported(fixture: 'template-a' | 'template-b') {
  const t = makeTestService();
  const sid = t.service.createSession({ teamCount: 3 }).session.id;
  await t.service.importSheet(sid, `fixture-${fixture}`);
  const questions = t.repo.listQuestions(sid);
  const slots = t.repo.listSlotsBySession(sid);
  const byNumber = (n: number) => questions.find((q) => q.number === n)!;
  return { questions, slots, byNumber };
}

/** 只需 questionId 與 answers 正確的得主送出 */
function winner(questionId: string, answers: string[]): Submission {
  return {
    id: `w-${questionId}`,
    sessionId: 's',
    questionId,
    teamId: 't',
    memberId: 'm',
    answers,
    serverTime: 0,
    seq: 1,
    status: 'active',
    orderKey: 1,
    withdrawnAt: null,
  };
}

describe('sheets/exporter', () => {
  it('UT-EXP-01 範例 A：第 1 題得主 [CPU, 作業系統]、第 3 題得主 [0] → 恰為 G5、G6、G11 三筆，順序依列', async () => {
    const { questions, slots, byNumber } = await imported('template-a');
    const q1 = byNumber(1).id;
    const q3 = byNumber(3).id;
    const winners = new Map([
      [q1, winner(q1, ['CPU', '作業系統'])],
      [q3, winner(q3, ['0'])],
    ]);
    expect(buildExportWrites(slots, questions, winners)).toEqual([
      { sheetTitle: '學習單', a1: 'G5', value: '（1）CPU' },
      { sheetTitle: '學習單', a1: 'G6', value: '（2）作業系統' },
      { sheetTitle: '學習單', a1: 'G11', value: '0' },
    ]);
  });

  it('UT-EXP-02 沒有任何得主 → []；不屬於本次題目的 slot 不寫', async () => {
    const { questions, slots, byNumber } = await imported('template-a');
    expect(buildExportWrites(slots, questions, new Map())).toEqual([]);
    const q3 = byNumber(3).id;
    const others = questions.filter((q) => q.id !== q3);
    expect(buildExportWrites(slots, others, new Map([[q3, winner(q3, ['0'])]]))).toEqual([]);
  });

  it("UT-EXP-03 單題 prefix 為 '' → value 等於答案本身；位置取自該範本的 slot（範例 B 不同版面）", async () => {
    const a = await imported('template-a');
    const q3 = a.byNumber(3).id;
    expect(a.slots.find((s) => s.questionId === q3)!.prefix).toBe('');
    expect(buildExportWrites(a.slots, a.questions, new Map([[q3, winner(q3, ['0'])]]))).toEqual([
      { sheetTitle: '學習單', a1: 'G11', value: '0' },
    ]);

    const b = await imported('template-b');
    const single = b.questions.find((q) => !q.isGroup)!;
    const slot = b.slots.find((s) => s.questionId === single.id)!;
    const writes = buildExportWrites(b.slots, b.questions, new Map([[single.id, winner(single.id, ['答案B'])]]));
    expect(writes).toEqual([{ sheetTitle: slot.sheetTitle, a1: slot.a1, value: `${slot.prefix}答案B` }]);
  });

  it('UT-EXP-04 buildRestoreWrites → 每個 slot 一筆，value = originalValue（範例 A 共 6 筆）', async () => {
    const { slots } = await imported('template-a');
    const writes = buildRestoreWrites(slots);
    expect(writes).toHaveLength(6);
    for (const s of slots) {
      expect(writes).toContainEqual({ sheetTitle: s.sheetTitle, a1: s.a1, value: s.originalValue });
    }
    // 依列排序
    const rows = writes.map((w) => slots.find((s) => s.a1 === w.a1)!.row);
    expect(rows).toEqual([...rows].sort((x, y) => x - y));

    // 多工作表、同列不同欄：依工作表 → 列 → 欄排序（輸入順序打亂）
    const slot = (sheetTitle: string, row: number, col: number, a1: string): AnswerSlot => ({
      id: a1 + sheetTitle, questionId: 'q', subNo: 1, sheetTitle, row, col, a1, prefix: '', originalValue: a1,
    });
    const mixed = [slot('B', 0, 0, 'A1'), slot('A', 4, 7, 'H5'), slot('A', 4, 6, 'G5'), slot('A', 2, 6, 'G3')];
    expect(buildRestoreWrites(mixed).map((w) => `${w.sheetTitle}!${w.a1}`)).toEqual(['A!G3', 'A!G5', 'A!H5', 'B!A1']);
  });
});
