// 004-results-export E2E：E2E-12～17（TEST_SPEC §7；tasks T038）
// TEST_SPEC §7：每個 spec 開始前呼叫 fake-sheets reset；每位使用者獨立 browser.newContext()；
// 只用 data-testid 選取；每個測試結束截圖到 e2e/artifacts/<ID>.png
// 系統只有一個活動：live-quiz.spec（E2E-11）結束時活動仍在搶答中（公平 3 秒），
// 因此前置步驟先把活動帶回「等待開始」，再改為純速度、3 組並重新匯入 fixture-template-a。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import config from '../playwright.config';

const TEACHER_PASSWORD = (config.webServer as { env: Record<string, string> }).env.TEACHER_PASSWORD!;
const SHEET_ID = 'fixture-template-a';

const artifact = (id: string) => fileURLToPath(new URL(`../artifacts/${id}.png`, import.meta.url));

// 「1 秒內」（TEST_SPEC §7 E2E-12、13；spec SC-003）
const WITHIN_1S = { timeout: 1000 };

interface SheetSnapshot {
  sheets: { title: string; values: string[][]; merges: unknown[] }[];
}

/** fixtures/sheets/template-a.snapshot.json（每次讀取都是新物件） */
function loadFixture(): SheetSnapshot {
  const file = fileURLToPath(new URL('../../fixtures/sheets/template-a.snapshot.json', import.meta.url));
  return JSON.parse(readFileSync(file, 'utf8')) as SheetSnapshot;
}

/** 'G5' → 設定第一個工作表的該格（列或欄不足時補 ''） */
function setCell(s: SheetSnapshot, a1: string, value: string): SheetSnapshot {
  const m = /^([A-Z]+)(\d+)$/.exec(a1)!;
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = Number(m[2]) - 1;
  const values = s.sheets[0]!.values;
  while (values.length <= row) values.push([]);
  const r = values[row]!;
  while (r.length < col) r.push('');
  r[col - 1] = value;
  return s;
}

/**
 * 比較用：去除每列尾端的空字串與尾端空列（Google Sheets values API 本來就不回傳尾端空白格；
 * fake 閘道寫入時以 '' 補齊列長只是表示方式不同，見 docs/test-report.md Q-004）。merges 嚴格比對。
 */
function normalized(s: SheetSnapshot) {
  return s.sheets.map((sheet) => {
    const rows = sheet.values.map((r) => {
      const out = [...r];
      while (out.length > 0 && out[out.length - 1] === '') out.pop();
      return out;
    });
    while (rows.length > 0 && rows[rows.length - 1]!.length === 0) rows.pop();
    return { title: sheet.title, values: rows, merges: sheet.merges };
  });
}

async function getFakeSheet(page: Page): Promise<SheetSnapshot> {
  const res = await page.request.get(`/api/dev/fake-sheets/${SHEET_ID}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as SheetSnapshot;
}

test.describe.configure({ mode: 'serial' });

interface Student { ctx: BrowserContext; page: Page; team: number; nickname: string; teamName: string }

let teacherCtx: BrowserContext;
let teacher: Page;
let roomCode = '';
const students: Student[] = [];

test.beforeEach(async ({ request }) => {
  const res = await request.post(`/api/dev/fake-sheets/${SHEET_ID}/reset`);
  expect(res.status()).toBe(204);
});

test.afterAll(async () => {
  for (const s of students) await s.ctx.close();
  await teacherCtx?.close();
});

async function joinAsStudent(browser: Browser, team: number, nickname: string): Promise<Student> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/join');
  await page.getByTestId('join-room').fill(roomCode);
  await page.getByTestId('join-room-next').click();
  await page.getByTestId(`join-team-${team}`).click();
  await page.getByTestId('join-nickname').fill(nickname);
  await page.getByTestId('join-submit').click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByTestId('my-nickname')).toHaveText(nickname);
  const teamName = (await page.getByTestId('team-name').textContent())!.trim();
  const s = { ctx, page, team, nickname, teamName };
  students.push(s);
  return s;
}

/** 前置：老師登入、活動（3 組、純速度）、匯入 fixture-template-a、3 組各 1 人、開始並作答 */
async function setup(browser: Browser): Promise<void> {
  teacherCtx = await browser.newContext({ acceptDownloads: true });
  teacher = await teacherCtx.newPage();
  await teacher.goto('/teacher/login');
  await teacher.getByTestId('teacher-password').fill(TEACHER_PASSWORD);
  await teacher.getByTestId('teacher-login-submit').click();
  await expect(teacher).toHaveURL(/\/teacher$/);

  const create = teacher.getByTestId('btn-create-session');
  await expect(teacher.getByTestId('room-code').or(create)).toBeVisible();
  if (await create.isVisible()) await create.click();
  await expect(teacher.getByTestId('room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  roomCode = (await teacher.getByTestId('room-code').textContent())!.trim();

  // 新活動為「準備中」（尚未匯入）；先前的 spec 可能留下搶答中或已結束的活動 → 帶回等待開始
  const badge = teacher.getByTestId('phase-badge');
  await expect(badge).toHaveText(/準備中|等待開始|搶答中|已結束/);
  if ((await badge.textContent()) === '搶答中') {
    await teacher.getByTestId('btn-end').click();
    await expect(badge).toHaveText('已結束');
  }
  if ((await badge.textContent()) === '已結束') {
    await teacher.getByTestId('btn-reset').click();
    await expect(badge).toHaveText('等待開始');
  }

  // 純速度（得主立即判定）、3 組
  await teacher.getByTestId('settings-mode-speed').check();
  await teacher.getByTestId('settings-team-count').fill('3');
  await teacher.getByTestId('settings-save').click();
  await expect(teacher.getByTestId('settings-mode-speed')).toBeChecked();
  await expect(teacher.getByTestId('team-row-3')).toBeVisible();
  await expect(teacher.getByTestId('team-row-4')).toHaveCount(0);

  await teacher.getByTestId('import-input').fill(SHEET_ID);
  await teacher.getByTestId('import-submit').click();
  await expect(teacher.getByTestId('import-question-count')).toHaveText('4');
  await expect(teacher.getByTestId('import-group-count')).toHaveText('2');

  const g1 = await joinAsStudent(browser, 1, 'Rina');
  const g2 = await joinAsStudent(browser, 2, 'Sora');
  await joinAsStudent(browser, 3, 'Taro');

  await teacher.getByTestId('btn-start').click();
  await expect(badge).toHaveText('搶答中');
  for (const s of students) await expect(s.page.getByTestId('phase-badge')).toHaveText('搶答中');

  // 第 1 組送第 1 題（CPU、作業系統）與第 3 題「0」；第 2 組送第 3 題「1」
  await g1.page.getByTestId('answer-input-1-1').fill('CPU');
  await g1.page.getByTestId('answer-input-1-2').fill('作業系統');
  await g1.page.getByTestId('btn-submit-1').click();
  await expect(g1.page.getByTestId('submitted-1')).toBeVisible();
  await g1.page.getByTestId('answer-input-3-1').fill('0');
  await g1.page.getByTestId('btn-submit-3').click();
  await expect(g1.page.getByTestId('submitted-3')).toBeVisible();
  await g2.page.getByTestId('answer-input-3-1').fill('1');
  await g2.page.getByTestId('btn-submit-3').click();
  await expect(g2.page.getByTestId('submitted-3')).toBeVisible();

  // 純速度：老師端立即看到第 1 組為第 1、3 題得主
  await expect(teacher.getByTestId('status-cell-1-1')).toContainText('★ 得主');
  await expect(teacher.getByTestId('status-cell-3-1')).toContainText('★ 得主');
}

test('E2E-12 老師 btn-end → 學生頁 1 秒內顯示 student-results；老師顯示 results-table 與分數', async ({ browser }) => {
  await setup(browser);

  await teacher.getByTestId('btn-end').click();
  await Promise.all(
    students.map((s) => expect(s.page.getByTestId('student-results')).toBeVisible(WITHIN_1S)),
  );
  for (const s of students) {
    await expect(s.page.locator('[data-testid^="answer-card-"]')).toHaveCount(0);
    await expect(s.page.getByTestId('student-result-1')).toContainText('第 1 組');
    await expect(s.page.getByTestId('student-result-3')).toContainText('第 1 組');
  }

  await expect(teacher.getByTestId('phase-badge')).toHaveText('已結束');
  await expect(teacher.getByTestId('results-table')).toBeVisible();
  await expect(teacher.getByTestId('result-winner-1')).toHaveText('第 1 組');
  await expect(teacher.getByTestId('result-winner-3')).toHaveText('第 1 組');
  await expect(teacher.getByTestId('result-winner-2')).toHaveText('無');
  await expect(teacher.getByTestId('score-1')).toHaveText('2');
  await expect(teacher.getByTestId('score-2')).toHaveText('0');
  await expect(teacher.getByTestId('score-3')).toHaveText('0');

  await teacher.screenshot({ path: artifact('E2E-12'), fullPage: true });
});

test('E2E-13 老師按 btn-reject-3 → result-winner-3 1 秒內變第 2 組；學生 student-result-3 同步', async () => {
  await teacher.getByTestId('btn-reject-3').click();
  await expect(teacher.getByTestId('result-winner-3')).toHaveText('第 2 組', WITHIN_1S);
  await Promise.all(
    students.map((s) => expect(s.page.getByTestId('student-result-3')).toContainText('得主：第 2 組', WITHIN_1S)),
  );
  await expect(students[0]!.page.getByTestId('student-result-3')).toContainText('（判錯）');
  await expect(teacher.getByTestId('score-1')).toHaveText('1');
  await expect(teacher.getByTestId('score-2')).toHaveText('1');

  await students[0]!.page.screenshot({ path: artifact('E2E-13'), fullPage: true });
});

test('E2E-14 老師 btn-export-sheet → export-result「已寫回 3 格」（< 2 秒）；fake sheet G5、G6、G11 為前綴＋答案，其他格不變', async () => {
  const t0 = Date.now();
  await teacher.getByTestId('btn-export-sheet').click();
  await expect(teacher.getByTestId('export-result')).toHaveText('已寫回 3 格', { timeout: 2000 });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(2000);

  const sheet = await getFakeSheet(teacher);
  const values = sheet.sheets[0]!.values;
  expect(values[4]![6]).toBe('（1）CPU');
  expect(values[5]![6]).toBe('（2）作業系統');
  expect(values[10]![6]).toBe('1');
  let expected = setCell(loadFixture(), 'G5', '（1）CPU');
  expected = setCell(expected, 'G6', '（2）作業系統');
  expected = setCell(expected, 'G11', '1');
  expect(normalized(sheet)).toEqual(normalized(expected));

  await teacher.screenshot({ path: artifact('E2E-14'), fullPage: true });
});

test('E2E-15 老師 btn-restore-sheet → export-result「已還原 6 格」；fake sheet 與 fixture 相同', async () => {
  // beforeEach 已重設 fake sheet；先寫回一次，讓還原有內容可以恢復
  await teacher.getByTestId('btn-export-sheet').click();
  await expect(teacher.getByTestId('export-result')).toHaveText('已寫回 3 格');
  expect((await getFakeSheet(teacher)).sheets[0]!.values[4]![6]).toBe('（1）CPU');

  await teacher.getByTestId('btn-restore-sheet').click();
  await expect(teacher.getByTestId('export-result')).toHaveText('已還原 6 格');
  expect(normalized(await getFakeSheet(teacher))).toEqual(normalized(loadFixture()));

  await teacher.screenshot({ path: artifact('E2E-15'), fullPage: true });
});

test('E2E-16 老師 btn-download-csv → 檔名含房間碼與輪次（單獨執行時為 r1），內容以 BOM 開頭、4 筆資料列＋表頭', async () => {
  // 系統只有一個活動：前面的 spec（E2E-11）與本 spec 前置的 reset 會讓輪次大於 1；
  // 以老師 API 取得目前輪次（單獨執行本 spec 且無既有活動時為 1）
  const raw = await teacher.evaluate(() => window.sessionStorage.getItem('quiz.teacher'));
  const { token } = JSON.parse(raw!) as { token: string };
  const cur = await teacher.request.get('/api/teacher/sessions/current', { headers: { Authorization: `Bearer ${token}` } });
  expect(cur.status()).toBe(200);
  const { round } = ((await cur.json()) as { session: { round: number } }).session;

  const [download] = await Promise.all([
    teacher.waitForEvent('download'),
    teacher.getByTestId('btn-download-csv').click(),
  ]);
  const name = download.suggestedFilename();
  expect(name).toBe(`results-${roomCode}-r${round}.csv`);
  const path = await download.path();
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(readFileSync(path));
  expect(text.startsWith('﻿')).toBe(true);
  const lines = text.slice(1).split(/\r?\n/).filter((l) => l.length > 0);
  // 第 1 題（第 1 組 2 個子題）2 列＋第 3 題（第 1、2 組）2 列＋表頭
  expect(lines).toHaveLength(5);

  await teacher.screenshot({ path: artifact('E2E-16'), fullPage: true });
});

test('E2E-17 老師 btn-reset → 等待開始；學生頁沒有 student-results、submitted-* 消失、team-name 不變', async () => {
  await teacher.getByTestId('btn-reset').click();
  await expect(teacher.getByTestId('phase-badge')).toHaveText('等待開始');
  for (const s of students) {
    await expect(s.page.getByTestId('phase-badge')).toHaveText('等待開始');
    await expect(s.page.getByTestId('student-results')).toHaveCount(0);
    await expect(s.page.locator('[data-testid^="submitted-"]')).toHaveCount(0);
    await expect(s.page.getByTestId('team-name')).toHaveText(s.teamName);
    await expect(s.page.getByTestId('my-nickname')).toHaveText(s.nickname);
  }

  await students[0]!.page.screenshot({ path: artifact('E2E-17'), fullPage: true });
});
