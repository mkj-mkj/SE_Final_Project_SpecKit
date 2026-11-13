// SQLite 連線與交易（TECH_SPEC §5）。使用 Node 內建 node:sqlite，不需原生模組。
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

// 以 process.getBuiltinModule 載入：Vite 5／Vitest 2 無法解析只有 node: 前綴的內建模組 node:sqlite
const { DatabaseSync: DatabaseSyncCtor } = process.getBuiltinModule('node:sqlite');

export type Db = DatabaseSync;

/** 開啟資料庫並執行 schema.sql；path 可為 ':memory:'。檔案路徑時先建立父目錄 */
export function openDb(path: string): Db {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSyncCtor(path);
  // schema.sql 與本檔同目錄（src/db 或建置後的 dist/db，build 時會複製過去）
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
  return db;
}

// 巢狀呼叫時只由最外層開啟／提交交易
const depth = new WeakMap<Db, number>();

/** 以 BEGIN IMMEDIATE／COMMIT 包住 fn；例外時 ROLLBACK 後原樣重新丟出 */
export function withTransaction<T>(db: Db, fn: () => T): T {
  const d = depth.get(db) ?? 0;
  if (d > 0) {
    depth.set(db, d + 1);
    try {
      return fn();
    } finally {
      depth.set(db, d);
    }
  }
  db.exec('BEGIN IMMEDIATE');
  depth.set(db, 1);
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    depth.set(db, 0);
  }
}
