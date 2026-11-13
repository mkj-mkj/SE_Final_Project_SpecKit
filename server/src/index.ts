// 啟動入口：讀設定 → 開資料庫 → 組裝依賴 → 監聽（001 不呼叫 recover，003 加入）
import { AppError } from '@quiz/shared';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/db.js';
import { Repo } from './db/repo.js';
import { systemClock } from './ports/clock.js';
import { cryptoIdGen } from './ports/ids.js';
import { timerScheduler } from './ports/scheduler.js';
import type { SheetsGateway } from './ports/sheetsGateway.js';
import { AuthService } from './services/authService.js';

// 001 尚未提供試算表功能（research R-03）；002 依 SHEETS_MODE 改為 fakeGateway／googleGateway
const sheetsNotAvailable: SheetsGateway = {
  fetchSnapshot: () => Promise.reject(new AppError('SHEETS_ERROR')),
  writeCells: () => Promise.reject(new AppError('SHEETS_ERROR')),
};

const config = loadConfig();
const repo = new Repo(openDb(config.dbPath));
const { httpServer } = createApp({
  repo,
  clock: systemClock,
  scheduler: timerScheduler(systemClock),
  ids: cryptoIdGen,
  sheets: sheetsNotAvailable,
  auth: new AuthService(config.teacherPassword, cryptoIdGen),
});

httpServer.listen(config.port, () => {
  console.log(`伺服器已啟動：http://localhost:${config.port}`);
});
