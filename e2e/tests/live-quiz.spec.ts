// 003-live-quiz E2E：E2E-04～11（TEST_SPEC §7；tasks T063，斷言照 T054）
// TEST_SPEC §7：每個 spec 開始前呼叫 fake-sheets reset；每位使用者獨立 browser.newContext()；
// 只用 data-testid 選取；每個測試結束截圖到 e2e/artifacts/<ID>.png
// 系統只有一個活動：identity.spec（E2E-03）可能已建立活動並留下 6 組、import.spec（E2E-02）最後匯入範例 B，
// 因此前置步驟重新匯入 fixture-template-a 並把組數改為 3；判定模式與視窗秒數維持預設「公平、3 秒」（TECH_SPEC §3.3）。
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import config from '../playwright.config';

const TEACHER_PASSWORD = (config.webServer as { env: Record<string, string> }).env.TEACHER_PASSWORD!;

const artifact = (id: string) => fileURLToPath(new URL(`../artifacts/${id}.png`, import.meta.url));

// 「1 秒內」「3 秒內」等時間要求（TEST_SPEC §7 E2E-05、06、09）
const WITHIN_1S = { timeout: 1000 };

// 第 1 組暱稱與答案需為其他頁面不會自然出現的字串，才能以全文斷言資訊隔離（E2E-07、FR-010）
const X_NICK = 'Xena';
const Y_NICK = 'Yuri';
const G1_Q3_ANSWER = 'G1ANS0';

test.describe.configure({ mode: 'serial' });

interface Student { ctx: BrowserContext; page: Page; team: number; nickname: string }

let teacherCtx: BrowserContext;
let teacher: Page;
let roomCode = '';
let X: Student; // 第 1 組
let Y: Student; // 第 1 組
let G2: Student; // 第 2 組
let G3: Student; // 第 3 組
const students: Student[] = [];

test.beforeEach(async ({ request }) => {
  const res = await request.post('/api/dev/fake-sheets/fixture-template-a/reset');
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
  const s = { ctx, page, team, nickname };
  students.push(s);
  return s;
}

/** 學生頁的成員 token（localStorage `quiz.member`，TECH_SPEC §10.2） */
async function memberToken(page: Page): Promise<string> {
  const raw = await page.evaluate(() => window.localStorage.getItem('quiz.member'));
  return (JSON.parse(raw!) as { token: string }).token;
}

/** 所有 answer-input-* 輸入框 */
const answerInputs = (page: Page) => page.locator('[data-testid^="answer-input-"]');

test('E2E-04 開始前所有 answer-input-* disabled；直接 POST 送出 API → 409', async ({ browser }) => {
  // 前置：老師登入、活動（3 組、公平 3 秒）、匯入 fixture-template-a
  teacherCtx = await browser.newContext();
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

  await teacher.getByTestId('import-input').fill('fixture-template-a');
  await teacher.getByTestId('import-submit').click();
  await expect(teacher.getByTestId('import-question-count')).toHaveText('4');
  await expect(teacher.getByTestId('phase-badge')).toHaveText('等待開始');

  // 只改組數；判定模式與視窗秒數不動（維持預設公平 3 秒）
  await expect(teacher.getByTestId('settings-mode-fair')).toBeChecked();
  await expect(teacher.getByTestId('settings-window-sec')).toHaveValue('3');
  await teacher.getByTestId('settings-team-count').fill('3');
  await teacher.getByTestId('settings-save').click();
  await expect(teacher.getByTestId('team-row-3')).toBeVisible();
  await expect(teacher.getByTestId('team-row-4')).toHaveCount(0);

  X = await joinAsStudent(browser, 1, X_NICK);
  Y = await joinAsStudent(browser, 1, Y_NICK);
  G2 = await joinAsStudent(browser, 2, 'Mina');
  G3 = await joinAsStudent(browser, 3, 'Leon');

  // 範例 A：第 1、2 題各 2 子題，第 3、4 題單題 → 共 6 個輸入框
  for (const s of students) {
    await expect(s.page.getByTestId('phase-badge')).toHaveText('等待開始');
    await expect(answerInputs(s.page)).toHaveCount(6);
    for (const input of await answerInputs(s.page).all()) await expect(input).toBeDisabled();
    for (let n = 1; n <= 4; n++) await expect(s.page.getByTestId(`btn-submit-${n}`)).toBeDisabled();
  }

  // 繞過 UI 直接呼叫送出 API → 409 INVALID_PHASE
  const token = await memberToken(X.page);
  const stateRes = await X.page.request.get('/api/play/state', { headers: { Authorization: `Bearer ${token}` } });
  expect(stateRes.status()).toBe(200);
  const state = (await stateRes.json()) as { questions: { id: string; number: number }[] };
  const q3 = state.questions.find((q) => q.number === 3)!;
  const res = await X.page.request.post('/api/play/submissions', {
    headers: { Authorization: `Bearer ${token}` },
    data: { questionId: q3.id, answers: ['0'] },
  });
  expect(res.status()).toBe(409);
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_PHASE');

  await X.page.screenshot({ path: artifact('E2E-04'), fullPage: true });
});

test('E2E-05 老師按 btn-start → 4 個學生頁的 phase-badge 1 秒內變「搶答中」', async () => {
  await teacher.getByTestId('btn-start').click();
  await Promise.all(
    students.map((s) => expect(s.page.getByTestId('phase-badge')).toHaveText('搶答中', WITHIN_1S)),
  );
  await expect(teacher.getByTestId('phase-badge')).toHaveText('搶答中');
  await expect(teacher.getByTestId('status-grid')).toBeVisible();
  await expect(X.page.getByTestId('answer-input-3-1')).toBeEnabled();

  await teacher.screenshot({ path: artifact('E2E-05'), fullPage: true });
});

test('E2E-06 第 1 組 X 在第 3 題輸入「0」→ 1 秒內出現在 Y 的輸入框；第 2 組頁面沒有該字串', async () => {
  await X.page.getByTestId('answer-input-3-1').fill('0');
  await expect(Y.page.getByTestId('answer-input-3-1')).toHaveValue('0', WITHIN_1S);

  // 第 2 組：第 3 題輸入框維持空白，且任何輸入框都沒有該字串
  // （頁面全文會自然含有數字 0，例如時間，因此以輸入框值斷言；全文隔離斷言見 E2E-07）
  await expect(G2.page.getByTestId('answer-input-3-1')).toHaveValue('');
  for (const input of await answerInputs(G2.page).all()) expect(await input.inputValue()).not.toContain('0');

  await Y.page.screenshot({ path: artifact('E2E-06'), fullPage: true });
});

test('E2E-07 第 1 組送出第 3 題 → 老師 status-cell-3-1 顯示答案；第 2 組頁面全文不含第 1 組答案與暱稱', async () => {
  await X.page.getByTestId('answer-input-3-1').fill(G1_Q3_ANSWER);
  await expect(X.page.getByTestId('btn-submit-3')).toBeEnabled();
  await X.page.getByTestId('btn-submit-3').click();
  await expect(X.page.getByTestId('submitted-3')).toBeVisible();

  // 公平模式：視窗結算前格子顯示答案與「判定中」，只斷言答案文字
  await expect(teacher.getByTestId('status-cell-3-1')).toContainText(G1_Q3_ANSWER);

  // 第 2 組在搶答中的頁面全文（含輸入框值）不得出現第 1 組的答案與暱稱（FR-010）
  await expect(G2.page.getByTestId('answer-card-3')).toBeVisible();
  const body = G2.page.locator('body');
  await expect(body).not.toContainText(G1_Q3_ANSWER);
  await expect(body).not.toContainText(X_NICK);
  await expect(body).not.toContainText(Y_NICK);
  for (const input of await answerInputs(G2.page).all()) expect(await input.inputValue()).toBe('');

  await G2.page.screenshot({ path: artifact('E2E-07'), fullPage: true });
});

test('E2E-08 第 2 組第 1 題只填（1）→ btn-submit-1 disabled；填（2）後送出、出現 submitted-1', async () => {
  const p = G2.page;
  await p.getByTestId('answer-input-1-1').fill('CPU');
  await expect(p.getByTestId('btn-submit-1')).toBeDisabled();
  await p.getByTestId('answer-input-1-2').fill('作業系統');
  await expect(p.getByTestId('btn-submit-1')).toBeEnabled();
  await p.getByTestId('btn-submit-1').click();
  await expect(p.getByTestId('submitted-1')).toBeVisible();
  await expect(p.getByTestId('answer-input-1-1')).toBeDisabled();

  await p.screenshot({ path: artifact('E2E-08'), fullPage: true });
});

test('E2E-09 第 3 組送出第 4 題，3 秒內出現撤回倒數並撤回，修改後重送 → 老師看到「已撤回」後改為新送出', async () => {
  const p = G3.page;
  const cell = teacher.getByTestId('status-cell-4-3');

  await p.getByTestId('answer-input-4-1').fill('IP');
  await p.getByTestId('btn-submit-4').click();
  await expect(p.getByTestId('submitted-4')).toBeVisible();
  await expect(p.getByTestId('withdraw-countdown-4')).toBeVisible({ timeout: 3000 });
  await expect(p.getByTestId('withdraw-countdown-4')).toContainText(/撤回（\d+ 秒）/);
  await expect(cell).toContainText('IP');

  await p.getByTestId('btn-withdraw-4').click();
  await expect(cell).toHaveText('已撤回');
  const input = p.getByTestId('answer-input-4-1');
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('IP'); // 撤回後輸入框初始值為撤回的答案

  await input.fill('IP位址');
  await p.getByTestId('btn-submit-4').click();
  await expect(p.getByTestId('submitted-4')).toBeVisible();
  await expect(cell).toContainText('IP位址');
  await expect(cell).not.toContainText('已撤回');

  await teacher.screenshot({ path: artifact('E2E-09'), fullPage: true });
});

test('E2E-10 Y 重新整理 → my-nickname 相同、submitted-3 仍在', async () => {
  await Y.page.reload();
  await expect(Y.page).toHaveURL(/\/play$/);
  await expect(Y.page.getByTestId('my-nickname')).toHaveText(Y_NICK);
  await expect(Y.page.getByTestId('submitted-3')).toBeVisible();
  await expect(Y.page.getByTestId('answer-input-3-1')).toHaveValue(G1_Q3_ANSWER);

  await Y.page.screenshot({ path: artifact('E2E-10'), fullPage: true });
});

test('E2E-11 結束 → 重新開始 → 開始（公平 3 秒）；第 1 組先拿第 3 題，第 4 題第 1 組先送、第 2 組 1 秒後送 → 第 2 組得主', async () => {
  await teacher.getByTestId('btn-end').click();
  await expect(teacher.getByTestId('phase-badge')).toHaveText('已結束');
  await teacher.getByTestId('btn-reset').click();
  await expect(teacher.getByTestId('phase-badge')).toHaveText('等待開始');

  // 設定維持公平模式 3 秒（整個 spec 不改設定）
  await expect(teacher.getByTestId('settings-mode-fair')).toBeChecked();
  await expect(teacher.getByTestId('settings-window-sec')).toHaveValue('3');

  await teacher.getByTestId('btn-start').click();
  await expect(teacher.getByTestId('phase-badge')).toHaveText('搶答中');
  for (const s of students) await expect(s.page.getByTestId('phase-badge')).toHaveText('搶答中');
  // 新一輪：送出狀態已清空
  await expect(X.page.getByTestId('submitted-3')).toHaveCount(0);

  // 第 1 組先拿第 3 題：等視窗結算（3 秒）後成為得主，取得 1 分
  await X.page.getByTestId('answer-input-3-1').fill('0');
  await X.page.getByTestId('btn-submit-3').click();
  await expect(X.page.getByTestId('submitted-3')).toBeVisible();
  await expect(teacher.getByTestId('status-cell-3-1')).toContainText('★ 得主', { timeout: 5000 });

  // 第 4 題：第 1 組先送，第 2 組 1 秒後送（同在 3 秒視窗內）
  await X.page.getByTestId('answer-input-4-1').fill('IP');
  await G2.page.getByTestId('answer-input-4-1').fill('IP');
  await expect(G2.page.getByTestId('btn-submit-4')).toBeEnabled();
  await X.page.getByTestId('btn-submit-4').click();
  await expect(X.page.getByTestId('submitted-4')).toBeVisible();
  await G2.page.waitForTimeout(1000);
  await G2.page.getByTestId('btn-submit-4').click();
  await expect(G2.page.getByTestId('submitted-4')).toBeVisible();

  await expect(teacher.getByTestId('question-state-4')).toContainText('判定中');
  await expect(teacher.getByTestId('status-cell-4-2')).toContainText('★ 得主', { timeout: 5000 });
  await expect(teacher.getByTestId('status-cell-4-1')).not.toContainText('★ 得主');
  await expect(teacher.getByTestId('question-state-4')).not.toContainText('判定中');

  await teacher.screenshot({ path: artifact('E2E-11'), fullPage: true });
});
