// fixtures.ts —— 只讀取 fixtures/sheets 並產生變形版本（TEST_SPEC §3；不寫檔、不修改輸入）
import { readFileSync } from 'node:fs';
import type { ParseResult, SheetData, SheetSnapshot } from '@quiz/shared';

type FixtureName = 'template-a' | 'template-b';

// 本檔位於 server/test/helpers，往上三層為專案根目錄
const FIXTURE_DIR = new URL('../../../fixtures/sheets/', import.meta.url);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(new URL(file, FIXTURE_DIR), 'utf8')) as T;
}

/** 讀取範例快照（每次回傳新的物件＝深拷貝） */
export function loadSnapshot(name: FixtureName): SheetSnapshot {
  return readJson<SheetSnapshot>(`${name}.snapshot.json`);
}

/** 讀取範例的 ParseResult 期望值 */
export function loadExpected(name: FixtureName): ParseResult {
  return readJson<ParseResult>(`${name}.expected.json`);
}

/** 所有工作表的 values 與 merges 一起往下移 rows 列、往右移 cols 欄 */
export function shiftGrid(s: SheetSnapshot, rows: number, cols: number): SheetSnapshot {
  const out = structuredClone(s);
  for (const sheet of out.sheets) {
    const pad: string[] = Array.from({ length: cols }, () => '');
    sheet.values = [
      ...Array.from({ length: rows }, () => [] as string[]),
      ...sheet.values.map((r) => [...pad, ...r]),
    ];
    sheet.merges = sheet.merges.map((m) => ({
      ...m,
      startRowIndex: m.startRowIndex + rows,
      endRowIndex: m.endRowIndex + rows,
      startColumnIndex: m.startColumnIndex + cols,
      endColumnIndex: m.endColumnIndex + cols,
    }));
  }
  return out;
}

/** 移除所有工作表的合併資訊 */
export function removeMerges(s: SheetSnapshot): SheetSnapshot {
  const out = structuredClone(s);
  for (const sheet of out.sheets) sheet.merges = [];
  return out;
}

/** 'G5' → { row: 4, col: 6 }（0-based） */
function parseA1(a1: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!m) throw new Error(`setCell：無效的 A1 位址 ${a1}`);
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

/** 設定某格的值；列或欄不足時補空列與 '' */
export function setCell(s: SheetSnapshot, a1: string, value: string, sheetIndex = 0): SheetSnapshot {
  const out = structuredClone(s);
  const sheet = out.sheets[sheetIndex];
  if (!sheet) throw new Error(`setCell：沒有第 ${sheetIndex} 個工作表`);
  const { row, col } = parseA1(a1);
  while (sheet.values.length <= row) sheet.values.push([]);
  const r = sheet.values[row]!;
  while (r.length <= col) r.push('');
  r[col] = value;
  return out;
}

/** 在最前面插入一個工作表 */
export function prependSheet(s: SheetSnapshot, sheet: SheetData): SheetSnapshot {
  const out = structuredClone(s);
  out.sheets = [structuredClone(sheet), ...out.sheets];
  return out;
}
