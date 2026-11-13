// Google 試算表閘道（TECH_SPEC §7.4，SHEETS_MODE=google）。
// client 由 index.ts 以服務帳號建立後注入（憲章原則 VIII），測試以 mock client 取代、不連網。
// 002 只實作讀取；writeCells 屬 004。
import { AppError, type GridRange, type SheetData } from '@quiz/shared';
import type { sheets_v4 } from 'googleapis';
import type { SheetsGateway } from '../ports/sheetsGateway.js';
import { quoteSheet } from './a1.js';

/** 把 Google API 錯誤轉成錯誤碼：403 → 沒有權限；404 → 找不到；其他 → 一般錯誤 */
function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = e as { code?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  const status = Number(err?.response?.status ?? err?.status ?? err?.code);
  if (status === 403) return new AppError('SHEETS_PERMISSION_DENIED');
  if (status === 404) return new AppError('SHEETS_NOT_FOUND');
  return new AppError('SHEETS_ERROR');
}

/** 欄位字母 → 0-based 欄號（'A'→0、'AA'→26） */
function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 由回傳 range（例："'學習單'!B2:H16"）取出起始儲存格的 0-based 列與欄；沒有起點時為 A1 */
function rangeStart(range: string | null | undefined): { row: number; col: number } {
  const ref = (range ?? '').split('!').pop() ?? '';
  const m = /^\$?([A-Za-z]+)\$?(\d+)/.exec(ref);
  return m ? { row: Number(m[2]) - 1, col: lettersToCol(m[1]!) } : { row: 0, col: 0 };
}

/** 把以 range 起點為原點的 values 補齊成以 A1 為原點（前面補空列、每列前面補 ''） */
function toA1Origin(values: unknown[][] | null | undefined, range: string | null | undefined): string[][] {
  const { row, col } = rangeStart(range);
  const pad: string[] = Array.from({ length: col }, () => '');
  return [
    ...Array.from({ length: row }, () => [] as string[]),
    ...(values ?? []).map((r) => [...pad, ...r.map((v) => (v == null ? '' : String(v)))]),
  ];
}

export function createGoogleGateway(client: sheets_v4.Sheets): SheetsGateway {
  return {
    async fetchSnapshot(spreadsheetId) {
      try {
        const meta = await client.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets(properties(sheetId,title),merges)',
        });
        const sheetsMeta = meta.data.sheets ?? [];
        const titles = sheetsMeta.map((s) => s.properties?.title ?? '');
        const res = await client.spreadsheets.values.batchGet({
          spreadsheetId,
          ranges: titles.map(quoteSheet),
          valueRenderOption: 'FORMATTED_VALUE',
        });
        const valueRanges = res.data.valueRanges ?? [];
        const sheets: SheetData[] = sheetsMeta.map((s, i) => ({
          sheetId: s.properties?.sheetId ?? 0,
          title: titles[i]!,
          values: toA1Origin(valueRanges[i]?.values, valueRanges[i]?.range),
          merges: (s.merges ?? []).map(
            (m): GridRange => ({
              sheetId: m.sheetId ?? s.properties?.sheetId ?? 0,
              startRowIndex: m.startRowIndex ?? 0,
              endRowIndex: m.endRowIndex ?? 0,
              startColumnIndex: m.startColumnIndex ?? 0,
              endColumnIndex: m.endColumnIndex ?? 0,
            }),
          ),
        }));
        return { spreadsheetId, sheets };
      } catch (e) {
        throw toAppError(e);
      }
    },
    async writeCells() {
      // 004 實作（values.batchUpdate，valueInputOption: 'RAW'）；002 不支援寫回
      throw new AppError('SHEETS_ERROR');
    },
  };
}
