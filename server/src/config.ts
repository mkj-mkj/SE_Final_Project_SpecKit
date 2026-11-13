// 啟動設定（TECH_SPEC §3.4、research R-02）
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * 專案根目錄：config.ts 位於 server/src 或建置後的 server/dist，往上兩層即根目錄。
 * 不使用 process.cwd()，因為 `npm run dev -w server`／`npm start -w server` 的工作目錄是 server/。
 */
export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export interface Config {
  port: number;
  teacherPassword: string;
  dbPath: string; // 絕對路徑或 ':memory:'
  sheetsMode: 'fake' | 'google';
  googleCredentials: string;
  fakeSheetsDir: string;
}

const envSchema = z.object({
  PORT: z.coerce
    .number({ invalid_type_error: '必須是數字' })
    .int('必須是整數')
    .min(1, '需介於 1–65535')
    .max(65535, '需介於 1–65535')
    .default(3000),
  TEACHER_PASSWORD: z.string({ required_error: '未設定管理密碼' }).min(1, '管理密碼不可為空'),
  DB_PATH: z.string().min(1, '不可為空').default('./data/quiz.db'),
  SHEETS_MODE: z.enum(['fake', 'google'], { errorMap: () => ({ message: '只能是 fake 或 google' }) }).default('fake'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().default('./secrets/service-account.json'),
  FAKE_SHEETS_DIR: z.string().default('./fixtures/sheets'),
});

/** 相對路徑一律以專案根目錄為基準 */
function fromRoot(p: string): string {
  return isAbsolute(p) ? p : resolve(PROJECT_ROOT, p);
}

/** 讀取根目錄 .env（不存在時沿用現有環境變數；不覆蓋已存在的變數）並驗證；失敗時印出繁中訊息並結束程序 */
export function loadConfig(): Config {
  dotenv.config({ path: join(PROJECT_ROOT, '.env') });
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}：${i.message}`).join('\n');
    console.error(`設定錯誤，請檢查專案根目錄的 .env（可參考 .env.example）：\n${details}`);
    process.exit(1);
  }
  const env = parsed.data;
  const config: Config = {
    port: env.PORT,
    teacherPassword: env.TEACHER_PASSWORD,
    dbPath: env.DB_PATH === ':memory:' ? ':memory:' : fromRoot(env.DB_PATH),
    sheetsMode: env.SHEETS_MODE,
    googleCredentials: fromRoot(env.GOOGLE_APPLICATION_CREDENTIALS),
    fakeSheetsDir: fromRoot(env.FAKE_SHEETS_DIR),
  };
  if (config.sheetsMode === 'google' && !existsSync(config.googleCredentials)) {
    console.error(`設定錯誤：SHEETS_MODE=google，但找不到服務帳號金鑰檔 ${config.googleCredentials}`);
    process.exit(1);
  }
  return config;
}
