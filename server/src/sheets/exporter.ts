// 寫回寫入清單（TECH_SPEC §7.4，FR-06、PRD §8 第 9、10 點）。全部是純函式。
//
// 禁止寫死儲存格（FR-06／憲章原則 V）：工作表名稱與 A1 位址一律取自匯入時記錄的 answer_slots，
// 換了版面不同的範本也會寫到正確的位置。
import type { AnswerSlot, CellWrite, Question, Submission } from '@quiz/shared';

/** 依工作表 → 列 → 欄排序（回傳新陣列） */
function sortSlots(slots: AnswerSlot[]): AnswerSlot[] {
  return [...slots].sort(
    (a, b) => a.sheetTitle.localeCompare(b.sheetTitle) || a.row - b.row || a.col - b.col,
  );
}

/**
 * 每個有得主的題目、每個作答格（依 subNo）寫入「前綴＋得主答案」；
 * 作答格原本沒有前綴（prefix 為 ''）時只寫答案。無得主的題目不產生寫入。
 * winners 的 key 為 questionId。
 */
export function buildExportWrites(
  slots: AnswerSlot[],
  questions: Question[],
  winners: Map<string, Submission>,
): CellWrite[] {
  const questionIds = new Set(questions.map((q) => q.id));
  const writes: CellWrite[] = [];
  for (const slot of sortSlots(slots)) {
    if (!questionIds.has(slot.questionId)) continue;
    const winner = winners.get(slot.questionId);
    if (!winner) continue;
    writes.push({
      sheetTitle: slot.sheetTitle,
      a1: slot.a1,
      value: slot.prefix + (winner.answers[slot.subNo - 1] ?? ''),
    });
  }
  return writes;
}

/** 還原：每個作答格恢復成匯入時的原始值（PRD §8 第 10 點） */
export function buildRestoreWrites(slots: AnswerSlot[]): CellWrite[] {
  return sortSlots(slots).map((s) => ({ sheetTitle: s.sheetTitle, a1: s.a1, value: s.originalValue }));
}
