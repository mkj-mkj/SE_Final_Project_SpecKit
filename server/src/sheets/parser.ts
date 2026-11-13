// Guided Notes 解析器（TECH_SPEC §7.3；FR-01、FR-02、E1；憲章原則 V 動態定位）。
// 純函式：只依表頭「題號」「作答」推得位置，作答格位址一律由 toA1(row, col) 產生，不寫死任何儲存格。
// 只讀取題號欄與作答欄，題目敘述等其他欄位不會進入結果（FR-02）。
import {
  AppError,
  type GridRange,
  type ImportSummary,
  type ParseResult,
  type ParseWarning,
  type ParsedQuestion,
  type ParsedSlot,
  type SheetData,
  type SheetSnapshot,
} from '@quiz/shared';
import { toA1 } from './a1.js';

const HEADER_NUMBER = '題號';
const HEADER_ANSWER = '作答';
/** 題號：非負整數，可接 .0（例：'1'、'01'、'1.0'）；前後空白先去除 */
const NUMBER_RE = /^\d+(\.0+)?$/;
/** 子題前綴：作答格開頭的（n）或 (n)，括號內可有空白 */
const PREFIX_RE = /^\s*[（(]\s*(\d+)\s*[）)]/;

const cell = (sheet: SheetData, row: number, col: number): string => sheet.values[row]?.[col] ?? '';

interface Header {
  sheet: SheetData;
  headerRow: number;
  numberCol: number;
  answerCol: number;
}

/** 步驟 1：依工作表順序找第一個「同一列同時有『題號』與『作答』」的工作表；同列多個時各取最左 */
function findHeader(snapshot: SheetSnapshot): Header {
  for (const sheet of snapshot.sheets) {
    for (let r = 0; r < sheet.values.length; r++) {
      const row = sheet.values[r] ?? [];
      const numberCol = row.findIndex((v) => (v ?? '').trim() === HEADER_NUMBER);
      const answerCol = row.findIndex((v) => (v ?? '').trim() === HEADER_ANSWER);
      if (numberCol >= 0 && answerCol >= 0) return { sheet, headerRow: r, numberCol, answerCol };
    }
  }
  throw new AppError('HEADER_NOT_FOUND');
}

/** 步驟 4：包含 (row, col) 的合併範圍（列與欄皆判斷） */
function findMerge(sheet: SheetData, row: number, col: number): GridRange | undefined {
  return sheet.merges.find(
    (m) =>
      m.sheetId === sheet.sheetId &&
      m.startRowIndex <= row &&
      row < m.endRowIndex &&
      m.startColumnIndex <= col &&
      col < m.endColumnIndex,
  );
}

/** 作答格的前綴編號；沒有前綴回傳 null */
function prefixOf(value: string): { prefix: string; subNo: number } | null {
  const m = PREFIX_RE.exec(value);
  return m ? { prefix: m[0], subNo: Number(m[1]) } : null;
}

export function parseGuidedNotes(snapshot: SheetSnapshot): ParseResult {
  // 步驟 1：找表頭
  const { sheet, headerRow, numberCol, answerCol } = findHeader(snapshot);
  const questions: ParsedQuestion[] = [];
  const warnings: ParseWarning[] = [];

  // 步驟 2：從表頭下一列掃到最後一列
  let r = headerRow + 1;
  while (r < sheet.values.length) {
    const raw = cell(sheet, r, numberCol).trim();
    // 步驟 3：題號欄為整數才是題目起點；空白（含間隔列）與非整數文字一律略過
    if (!NUMBER_RE.test(raw)) {
      r++;
      continue;
    }
    const number = parseInt(raw, 10);

    // 步驟 4：題號格縱向合併 n 列（n > 1）→ 題組，子題列為合併範圍內各列；否則單題
    const merge = findMerge(sheet, r, numberCol);
    let rows: number[];
    if (merge && merge.endRowIndex - merge.startRowIndex > 1) {
      rows = [];
      for (let i = merge.startRowIndex; i < merge.endRowIndex; i++) rows.push(i);
    } else {
      rows = [r];
      // 步驟 5（後備規則，合併資訊遺失時）：作答格以（1）開頭，向下吸收
      // 「題號欄空白且作答格前綴依序為（2）、（3）…」的連續列；吸收後 ≥ 2 列才是題組
      if (prefixOf(cell(sheet, r, answerCol))?.subNo === 1) {
        let next = r + 1;
        while (
          next < sheet.values.length &&
          cell(sheet, next, numberCol).trim() === '' &&
          prefixOf(cell(sheet, next, answerCol))?.subNo === rows.length + 1
        ) {
          rows.push(next);
          next++;
        }
      }
    }
    const isGroup = rows.length > 1;

    // 步驟 6：每個子題列建立作答格；保存位置、前綴與匯入當下的原始內容（供 004 寫回與還原）
    const slots: ParsedSlot[] = rows.map((row, i) => {
      const originalValue = cell(sheet, row, answerCol);
      const p = prefixOf(originalValue);
      return {
        subNo: isGroup ? (p?.subNo ?? i + 1) : 1,
        sheetTitle: sheet.title,
        row,
        col: answerCol,
        a1: toA1(row, answerCol),
        prefix: p?.prefix ?? '',
        originalValue,
      };
    });

    // 步驟 7：題組子題編號不是 1..n 遞增 → 警告並依列序重編
    if (isGroup && slots.some((s, i) => s.subNo !== i + 1)) {
      warnings.push({
        code: 'SUBNO_MISMATCH',
        message: `第 ${number} 題子題編號不是 1..n 遞增，已自動重編`,
        questionNumber: number,
      });
      slots.forEach((s, i) => (s.subNo = i + 1));
    }

    questions.push({ number, isGroup, slots });
    // 步驟 8：從該題最後一列的下一列繼續
    r = rows[rows.length - 1]! + 1;
  }

  // 步驟 9：沒有題目、題號重複 → 拒絕；不是 1..N 連續 → 只警告
  if (questions.length === 0) throw new AppError('NO_QUESTIONS');
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const q of questions) {
    if (seen.has(q.number)) duplicates.add(q.number);
    seen.add(q.number);
  }
  if (duplicates.size > 0) {
    throw new AppError('DUPLICATE_QUESTION_NUMBER', `題號重複：${[...duplicates].sort((a, b) => a - b).join('、')}`);
  }

  // 步驟 10：依題號升冪
  questions.sort((a, b) => a.number - b.number);
  const sorted = questions.map((q) => q.number);
  if (sorted.some((n, i) => n !== i + 1)) {
    warnings.push({
      code: 'NON_CONSECUTIVE_NUMBERS',
      message: `題號不是從 1 連續（實際題號：${sorted.join('、')}）`,
    });
  }

  return { sheetTitle: sheet.title, headerRow, numberCol, answerCol, questions, warnings };
}

/** 匯入摘要：題數、題組數、單題數、題組子題總數與警告 */
export function summarize(result: ParseResult): ImportSummary {
  const groups = result.questions.filter((q) => q.isGroup);
  return {
    questionCount: result.questions.length,
    groupCount: groups.length,
    singleCount: result.questions.length - groups.length,
    subQuestionCount: groups.reduce((n, q) => n + q.slots.length, 0),
    warnings: result.warnings,
  };
}
