// 欄位字母、A1 位址與試算表網址解析（TECH_SPEC §7.2）。
// 憲章原則 V：server/src 中的 A1 位址只能由 toA1 產生，不得寫死。
import { AppError } from '@quiz/shared';

/** 0-based 欄號 → 欄位字母：0→'A'、25→'Z'、26→'AA' */
export function colToLetters(col: number): string {
  let n = col + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** 0-based (row, col) → A1 位址：(4,6)→'G5' */
export function toA1(row: number, col: number): string {
  return `${colToLetters(col)}${row + 1}`;
}

/** 工作表名稱加上單引號；名稱內的 ' 改為 ''（Sheets API 的跳脫規則） */
export function quoteSheet(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** 工作表名稱＋A1 位址：rangeA1('學習單','G5') → "'學習單'!G5" */
export function rangeA1(sheetTitle: string, a1: string): string {
  return `${quoteSheet(sheetTitle)}!${a1}`;
}

const URL_ID = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;
const PLAIN_ID = /^[A-Za-z0-9_-]{10,}$/;

/**
 * 取出試算表 ID：
 * 1) 含 /spreadsheets/d/{id} 的網址 → id
 * 2) 符合 /^[A-Za-z0-9_-]{10,}$/ 的字串 → 原樣
 * 3) 其他 → INVALID_SPREADSHEET_URL（呼叫端不得讀取任何試算表）
 */
export function parseSpreadsheetInput(input: string): string {
  const s = input.trim();
  const m = URL_ID.exec(s);
  if (m) return m[1]!;
  if (PLAIN_ID.test(s)) return s;
  throw new AppError('INVALID_SPREADSHEET_URL');
}
