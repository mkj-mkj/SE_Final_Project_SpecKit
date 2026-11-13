// Google Sheets 存取介面（TECH_SPEC §7.1）。001 只定義介面，實作由 002 提供。
import type { CellWrite, SheetSnapshot } from '@quiz/shared';

export interface SheetsGateway {
  fetchSnapshot(spreadsheetId: string): Promise<SheetSnapshot>;
  writeCells(spreadsheetId: string, writes: CellWrite[]): Promise<void>;
}
