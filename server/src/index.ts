// 啟動入口：讀設定 → 開資料庫 → 依 SHEETS_MODE 組裝試算表閘道 → 監聽（recover 由 003 加入）
import { google } from 'googleapis';
import { createApp, type AppDeps } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/db.js';
import { Repo } from './db/repo.js';
import { systemClock } from './ports/clock.js';
import { cryptoIdGen } from './ports/ids.js';
import { timerScheduler } from './ports/scheduler.js';
import { AuthService } from './services/authService.js';
import { createFakeGateway } from './sheets/fakeGateway.js';
import { createGoogleGateway } from './sheets/googleGateway.js';

const config = loadConfig();

/**
 * 試算表閘道（TECH_SPEC §3.4、§7.4）：
 * - fake：讀取 FAKE_SHEETS_DIR 的範例快照，並提供給 app 掛載 /api/dev
 * - google：以服務帳號金鑰（GOOGLE_APPLICATION_CREDENTIALS，只存在 secrets/）建立 client，scope 只用 spreadsheets
 */
function buildSheets(): Pick<AppDeps, 'sheets' | 'fakeSheets'> {
  if (config.sheetsMode === 'fake') {
    const fake = createFakeGateway(config.fakeSheetsDir);
    return { sheets: fake, fakeSheets: fake };
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: config.googleCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { sheets: createGoogleGateway(google.sheets({ version: 'v4', auth })) };
}

const repo = new Repo(openDb(config.dbPath));
const { httpServer } = createApp({
  repo,
  clock: systemClock,
  scheduler: timerScheduler(systemClock),
  ids: cryptoIdGen,
  ...buildSheets(),
  auth: new AuthService(config.teacherPassword, cryptoIdGen),
});

httpServer.listen(config.port, () => {
  console.log(`伺服器已啟動：http://localhost:${config.port}`);
});
