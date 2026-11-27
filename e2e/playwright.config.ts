// Playwright 設定（TEST_SPEC §7、research R-13）
// 使用系統已安裝的 Edge（channel: 'msedge'），不下載 Playwright 瀏覽器。
// TEST_SPEC §7 要求每個 spec 開始前呼叫 fake-sheets reset；該路由屬 002，001 的 spec 不呼叫（research R-13）。
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    channel: 'msedge',
    baseURL: 'http://localhost:3100',
    testIdAttribute: 'data-testid',
  },
  webServer: {
    command: 'npm run build && npm start',
    cwd: repoRoot,
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: '3100',
      DB_PATH: ':memory:',
      SHEETS_MODE: 'fake',
      TEACHER_PASSWORD: 'e2e-pass',
    },
  },
});
