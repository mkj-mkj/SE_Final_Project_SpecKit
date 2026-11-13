// 示範模式的試算表閘道（TECH_SPEC §7.4，SHEETS_MODE=fake）：以專案內的 fixture 快照模擬 Google Sheets。
// 002 只實作讀取（fetchSnapshot、getSnapshot、reset）；writeCells 屬 004。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, type SheetSnapshot } from '@quiz/shared';
import type { SheetsGateway } from '../ports/sheetsGateway.js';

/** 試算表 ID 必須是 fixture-{名稱}，名稱只允許英數字、底線、連字號（避免路徑穿越，如 ../x） */
const FIXTURE_ID = /^fixture-([A-Za-z0-9_-]+)$/;

export function createFakeGateway(dir: string): SheetsGateway & {
  getSnapshot(spreadsheetId: string): SheetSnapshot;
  reset(spreadsheetId: string): void;
} {
  /** 記憶體中的副本；第一次讀取後以此為準 */
  const store = new Map<string, SheetSnapshot>();

  /** 從檔案讀取：fixture-template-a → {dir}/template-a.snapshot.json；不符或不存在 → SHEETS_NOT_FOUND */
  function loadFromFile(spreadsheetId: string): SheetSnapshot {
    const m = FIXTURE_ID.exec(spreadsheetId);
    if (!m) throw new AppError('SHEETS_NOT_FOUND');
    try {
      return JSON.parse(readFileSync(join(dir, `${m[1]}.snapshot.json`), 'utf8')) as SheetSnapshot;
    } catch {
      throw new AppError('SHEETS_NOT_FOUND');
    }
  }

  function getSnapshot(spreadsheetId: string): SheetSnapshot {
    let snap = store.get(spreadsheetId);
    if (!snap) {
      snap = loadFromFile(spreadsheetId);
      store.set(spreadsheetId, snap);
    }
    return snap;
  }

  return {
    async fetchSnapshot(spreadsheetId) {
      return structuredClone(getSnapshot(spreadsheetId));
    },
    async writeCells() {
      // 004 實作（寫回記憶體副本並輸出到 data/fake-sheets）；002 不支援寫回
      throw new AppError('SHEETS_ERROR');
    },
    getSnapshot,
    reset(spreadsheetId) {
      store.set(spreadsheetId, loadFromFile(spreadsheetId));
    },
  };
}
