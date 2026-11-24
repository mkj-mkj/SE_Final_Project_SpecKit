// 示範模式的試算表閘道（TECH_SPEC §7.4，SHEETS_MODE=fake）：以專案內的 fixture 快照模擬 Google Sheets。
// 讀取（fetchSnapshot、getSnapshot、reset）屬 002；writeCells 屬 004（修改記憶體副本，並可輸出到 outDir 方便檢查）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, type SheetSnapshot } from '@quiz/shared';
import type { SheetsGateway } from '../ports/sheetsGateway.js';

/** 試算表 ID 必須是 fixture-{名稱}，名稱只允許英數字、底線、連字號（避免路徑穿越，如 ../x） */
const FIXTURE_ID = /^fixture-([A-Za-z0-9_-]+)$/;

/** 'G5' → { row: 4, col: 6 }（0-based）；不合法 → null */
function parseA1(a1: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)([1-9]\d*)$/.exec(a1);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

/**
 * dir：fixture 快照所在資料夾；outDir（可省略）：寫回後把整份快照輸出為 `${outDir}/${id}.json`，
 * 方便示範時檢查寫回結果（fake 模式由 index.ts 傳入 data/fake-sheets）。
 */
export function createFakeGateway(dir: string, outDir?: string): SheetsGateway & {
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
    /**
     * 寫回記憶體副本（FR-06）：先驗證全部寫入（工作表存在、A1 合法），任一不合法 → SHEETS_ERROR 且一筆都不套用；
     * 驗證通過後逐筆補齊列與欄再設定值，只改指定儲存格。
     */
    async writeCells(spreadsheetId, writes) {
      const snap = getSnapshot(spreadsheetId);
      const targets = writes.map((w) => {
        const sheet = snap.sheets.find((s) => s.title === w.sheetTitle);
        const pos = parseA1(w.a1);
        if (!sheet || !pos) throw new AppError('SHEETS_ERROR');
        return { sheet, ...pos, value: w.value };
      });
      for (const { sheet, row, col, value } of targets) {
        while (sheet.values.length <= row) sheet.values.push([]);
        const r = sheet.values[row]!;
        while (r.length <= col) r.push('');
        r[col] = value;
      }
      if (outDir) {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, `${spreadsheetId}.json`), JSON.stringify(snap, null, 2));
      }
    },
    getSnapshot,
    reset(spreadsheetId) {
      store.set(spreadsheetId, loadFromFile(spreadsheetId));
    },
  };
}
