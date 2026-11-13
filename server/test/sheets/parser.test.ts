// UT-PARSE（TEST_SPEC §5.2）：sheets/parser.ts，以 fixtures/sheets/*.expected.json 深度比對
import { AppError, type ErrorCode, type ParseResult, type SheetSnapshot } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { parseGuidedNotes, summarize } from '../../src/sheets/parser.js';
import {
  loadExpected,
  loadSnapshot,
  prependSheet,
  removeMerges,
  setCell,
  shiftGrid,
} from '../helpers/fixtures.js';

function expectAppError(fn: () => unknown, code: ErrorCode): AppError {
  let err: unknown;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

const numbers = (r: ParseResult): number[] => r.questions.map((q) => q.number);
const a1s = (r: ParseResult): string[] => r.questions.flatMap((q) => q.slots.map((s) => s.a1));

/** 範例 B 的題號格 B5、B7…B15 依序設成 values */
function setBNumbers(s: SheetSnapshot, values: string[]): SheetSnapshot {
  return values.reduce((acc, v, i) => setCell(acc, `B${5 + i * 2}`, v), s);
}

describe('sheets/parser parseGuidedNotes', () => {
  it('UT-PARSE-01 範例 A 與 template-a.expected.json 深度相等（含 warnings: []），且不含題目敘述', () => {
    const snap = loadSnapshot('template-a');
    const result = parseGuidedNotes(snap);
    expect(result).toEqual(loadExpected('template-a'));
    expect(result.warnings).toEqual([]);
    // FR-02：結果不得含任何題目敘述文字（題目欄 C 的內容）
    const json = JSON.stringify(result);
    const statements = snap.sheets[0]!.values.map((r) => r[2] ?? '').filter((t) => t.length > 0);
    expect(statements.length).toBeGreaterThan(0);
    for (const text of statements) expect(json).not.toContain(text);
  });

  it('UT-PARSE-02 範例 B 與 template-b.expected.json 深度相等', () => {
    expect(parseGuidedNotes(loadSnapshot('template-b'))).toEqual(loadExpected('template-b'));
  });

  it('UT-PARSE-05 範例 A 下移 2 列、右移 1 欄：結構相同，作答格為 H7、H8、H10、H11、H13、H15', () => {
    const result = parseGuidedNotes(shiftGrid(loadSnapshot('template-a'), 2, 1));
    const expected = loadExpected('template-a');
    expect(result.questions.map((q) => [q.number, q.isGroup, q.slots.length])).toEqual(
      expected.questions.map((q) => [q.number, q.isGroup, q.slots.length]),
    );
    expect(a1s(result)).toEqual(['H7', 'H8', 'H10', 'H11', 'H13', 'H15']);
    expect(result.headerRow).toBe(expected.headerRow + 2);
    expect(result.numberCol).toBe(expected.numberCol + 1);
    expect(result.answerCol).toBe(expected.answerCol + 1);
  });

  it('UT-PARSE-06 前面插入無表頭的工作表「說明」：使用「學習單」，結果同 01', () => {
    const snap = prependSheet(loadSnapshot('template-a'), {
      sheetId: 99,
      title: '說明',
      values: [['本學習單使用說明'], ['請依序作答']],
      merges: [],
    });
    const result = parseGuidedNotes(snap);
    expect(result.sheetTitle).toBe('學習單');
    expect(result).toEqual(loadExpected('template-a'));
  });

  it('UT-PARSE-07 B4「題號」改為「編號」→ HEADER_NOT_FOUND', () => {
    expectAppError(() => parseGuidedNotes(setCell(loadSnapshot('template-b'), 'B4', '編號')), 'HEADER_NOT_FOUND');
  });

  it('UT-PARSE-08 範例 B 清空所有題號 → NO_QUESTIONS', () => {
    const snap = setBNumbers(loadSnapshot('template-b'), ['', '', '', '', '', '']);
    expectAppError(() => parseGuidedNotes(snap), 'NO_QUESTIONS');
  });

  it('UT-PARSE-09 範例 B 的 B9 由「3」改為「2」→ DUPLICATE_QUESTION_NUMBER，message 含「2」', () => {
    const err = expectAppError(
      () => parseGuidedNotes(setCell(loadSnapshot('template-b'), 'B9', '2')),
      'DUPLICATE_QUESTION_NUMBER',
    );
    expect(err.message).toContain('2');
  });

  it('UT-PARSE-10 範例 B 清空 B11 → 5 題（1,2,3,5,6）與 1 個 NON_CONSECUTIVE_NUMBERS 警告', () => {
    const result = parseGuidedNotes(setCell(loadSnapshot('template-b'), 'B11', ''));
    expect(numbers(result)).toEqual([1, 2, 3, 5, 6]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe('NON_CONSECUTIVE_NUMBERS');
  });

  it("UT-PARSE-11 題號 '1.0'、' 2 ' 解析為 1、2；'1a'、'一' 略過", () => {
    const snap = setBNumbers(loadSnapshot('template-b'), ['1.0', ' 2 ', '1a', '一', '5', '6']);
    const result = parseGuidedNotes(snap);
    expect(numbers(result)).toEqual([1, 2, 5, 6]);
    expect(a1s(result)).toEqual(['G5', 'G7', 'G13', 'G15']);
  });

  it('UT-PARSE-12 範例 A removeMerges：後備規則仍判定第 1、2 題為題組，結果同 01', () => {
    expect(parseGuidedNotes(removeMerges(loadSnapshot('template-a')))).toEqual(loadExpected('template-a'));
  });

  it("UT-PARSE-13 G5、G6 改為半形 (1)、(2) → prefix==='(1)'、subNo===1", () => {
    let snap = setCell(loadSnapshot('template-a'), 'G5', '(1)');
    snap = setCell(snap, 'G6', '(2)');
    const q1 = parseGuidedNotes(snap).questions[0]!;
    expect(q1.isGroup).toBe(true);
    expect(q1.slots.map((s) => [s.prefix, s.subNo])).toEqual([
      ['(1)', 1],
      ['(2)', 2],
    ]);
  });

  it("UT-PARSE-14 清空 G5、G6 → 第 1 題仍為題組（merge），subNo 1、2，prefix ''", () => {
    let snap = setCell(loadSnapshot('template-a'), 'G5', '');
    snap = setCell(snap, 'G6', '');
    const q1 = parseGuidedNotes(snap).questions[0]!;
    expect(q1.isGroup).toBe(true);
    expect(q1.slots.map((s) => [s.subNo, s.prefix])).toEqual([
      [1, ''],
      [2, ''],
    ]);
  });

  it('UT-PARSE-15 G5、G6 改為「（2）」「（1）」→ SUBNO_MISMATCH 警告，subNo 重編為 1、2', () => {
    let snap = setCell(loadSnapshot('template-a'), 'G5', '（2）');
    snap = setCell(snap, 'G6', '（1）');
    const result = parseGuidedNotes(snap);
    expect(result.questions[0]!.slots.map((s) => s.subNo)).toEqual([1, 2]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ code: 'SUBNO_MISMATCH', questionNumber: 1 });
  });

  it("UT-PARSE-16 範例 A 的 originalValue：G5 '（1）'、G11 ''", () => {
    const slots = parseGuidedNotes(loadSnapshot('template-a')).questions.flatMap((q) => q.slots);
    expect(slots.find((s) => s.a1 === 'G5')!.originalValue).toBe('（1）');
    expect(slots.find((s) => s.a1 === 'G11')!.originalValue).toBe('');
  });

  it("UT-PARSE-17 某列長度短於 answerCol → 不丟例外，originalValue ''", () => {
    const snap = setCell(loadSnapshot('template-b'), 'G5', '原本有字');
    snap.sheets[0]!.values[4] = ['', '1']; // 第 1 題那一列只剩 2 格
    const result = parseGuidedNotes(snap);
    expect(result.questions[0]!.slots[0]).toMatchObject({ a1: 'G5', originalValue: '' });
  });

  it("UT-PARSE-18 表頭含空白 ' 題號 '、'作答 ' → 正常辨識", () => {
    let snap = setCell(loadSnapshot('template-b'), 'B4', ' 題號 ');
    snap = setCell(snap, 'G4', '作答 ');
    expect(parseGuidedNotes(snap)).toEqual(loadExpected('template-b'));
  });

  it('UT-PARSE-19 第 2 題在第 1 題上方 → 依題號升冪', () => {
    let snap = setCell(loadSnapshot('template-b'), 'B5', '2');
    snap = setCell(snap, 'B7', '1');
    const result = parseGuidedNotes(snap);
    expect(numbers(result)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.questions[0]!.slots[0]!.a1).toBe('G7');
    expect(result.questions[1]!.slots[0]!.a1).toBe('G5');
  });

  it('UT-PARSE-20 只水平合併、不跨列的題號格 → 單題', () => {
    const snap = loadSnapshot('template-b');
    snap.sheets[0]!.merges.push({
      sheetId: snap.sheets[0]!.sheetId,
      startRowIndex: 4,
      endRowIndex: 5,
      startColumnIndex: 1,
      endColumnIndex: 3,
    });
    expect(parseGuidedNotes(snap)).toEqual(loadExpected('template-b'));
  });

  it('UT-PARSE-21 範例 B 的 B5 由「1」改為「0」→ 題號 0、2～6，1 個 NON_CONSECUTIVE_NUMBERS，第 0 題作答格 G5', () => {
    const result = parseGuidedNotes(setCell(loadSnapshot('template-b'), 'B5', '0'));
    expect(numbers(result)).toEqual([0, 2, 3, 4, 5, 6]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe('NON_CONSECUTIVE_NUMBERS');
    expect(result.questions[0]!.slots[0]!.a1).toBe('G5');
  });

  it("UT-PARSE-22 題號改為 '01'、'002'、'03.0' → 解析為 1、2、3，結果與 UT-PARSE-02 相同", () => {
    const snap = setBNumbers(loadSnapshot('template-b'), ['01', '002', '03.0', '4', '5', '6']);
    expect(parseGuidedNotes(snap)).toEqual(loadExpected('template-b'));
  });
});

describe('sheets/parser summarize', () => {
  it('UT-PARSE-03 summarize（範例 A）→ 4 題、2 題組、2 單題、4 子題', () => {
    expect(summarize(parseGuidedNotes(loadSnapshot('template-a')))).toEqual({
      questionCount: 4,
      groupCount: 2,
      singleCount: 2,
      subQuestionCount: 4,
      warnings: [],
    });
  });

  it('UT-PARSE-04 summarize（範例 B）→ 6 題、0 題組、6 單題、0 子題', () => {
    expect(summarize(parseGuidedNotes(loadSnapshot('template-b')))).toEqual({
      questionCount: 6,
      groupCount: 0,
      singleCount: 6,
      subQuestionCount: 0,
      warnings: [],
    });
  });
});
