// 記憶體中的試算表（TEST_SPEC §3）
import { AppError, type CellWrite, type ErrorCode, type SheetSnapshot } from '@quiz/shared';
import type { SheetsGateway } from '../../src/ports/sheetsGateway.js';

export class InMemorySheetsGateway implements SheetsGateway {
  writes: { spreadsheetId: string; writes: CellWrite[] }[] = [];
  private snapshots: Record<string, SheetSnapshot>;
  private failCode: ErrorCode | null = null;

  constructor(snapshots: Record<string, SheetSnapshot>) {
    this.snapshots = structuredClone(snapshots);
  }
  failNext(code: ErrorCode): void {
    this.failCode = code;
  }
  current(id: string): SheetSnapshot {
    const s = this.snapshots[id];
    if (!s) throw new AppError('SHEETS_NOT_FOUND');
    return s;
  }
  async fetchSnapshot(spreadsheetId: string): Promise<SheetSnapshot> {
    this.throwIfFailing();
    return structuredClone(this.current(spreadsheetId));
  }
  async writeCells(spreadsheetId: string, writes: CellWrite[]): Promise<void> {
    this.throwIfFailing();
    const snap = this.current(spreadsheetId);
    for (const w of writes) {
      const sheet = snap.sheets.find((s) => s.title === w.sheetTitle);
      if (!sheet) throw new AppError('SHEETS_ERROR');
      const { row, col } = parseA1(w.a1);
      while (sheet.values.length <= row) sheet.values.push([]);
      const r = sheet.values[row]!;
      while (r.length <= col) r.push('');
      r[col] = w.value;
    }
    this.writes.push({ spreadsheetId, writes: structuredClone(writes) });
  }
  private throwIfFailing(): void {
    if (this.failCode) {
      const code = this.failCode;
      this.failCode = null;
      throw new AppError(code);
    }
  }
}

/** 'G5' → { row: 4, col: 6 }（0-based）；僅供此替身使用 */
function parseA1(a1: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!m) throw new AppError('SHEETS_ERROR');
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}
