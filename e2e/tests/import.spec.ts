// 002-guided-notes-import E2E：E2E-01（匯入範例 A，含匯入時間 < 2 秒）、E2E-02（重新匯入範例 B）
// TEST_SPEC §7：每個 spec 開始前呼叫 fake-sheets reset；只用 data-testid 選取；每個測試結束截圖到 e2e/artifacts/<ID>.png
// 系統只有一個活動：001 的 E2E-03 可能已在同一個 server 建立活動，因此 btn-create-session 存在才按。
import { fileURLToPath } from 'node:url';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import config from '../playwright.config';

const TEACHER_PASSWORD = (config.webServer as { env: Record<string, string> }).env.TEACHER_PASSWORD!;

const artifact = (id: string) => fileURLToPath(new URL(`../artifacts/${id}.png`, import.meta.url));

// 範例 A 第 1 題第一句題目敘述（fixtures/sheets/template-a.snapshot.json），頁面不得出現（FR-02）
const TEMPLATE_A_QUESTION_TEXT = '小明升級的電腦「大腦」硬體';

test.describe.configure({ mode: 'serial' });

let teacherCtx: BrowserContext;
let teacher: Page;

test.beforeEach(async ({ request }) => {
  for (const id of ['fixture-template-a', 'fixture-template-b']) {
    const res = await request.post(`/api/dev/fake-sheets/${id}/reset`);
    expect(res.status()).toBe(204);
  }
});

test.afterAll(async () => {
  await teacherCtx?.close();
});

async function importSheet(spreadsheet: string): Promise<number> {
  await teacher.getByTestId('import-input').fill(spreadsheet);
  const started = Date.now();
  await teacher.getByTestId('import-submit').click();
  await expect(teacher.getByTestId('import-summary')).toBeVisible();
  return Date.now() - started;
}

test('E2E-01 老師登入 → 建立活動 → 匯入 fixture-template-a：4 題、2 題組，匯入 < 2 秒', async ({ browser }) => {
  teacherCtx = await browser.newContext();
  teacher = await teacherCtx.newPage();
  await teacher.goto('/teacher/login');
  await teacher.getByTestId('teacher-password').fill(TEACHER_PASSWORD);
  await teacher.getByTestId('teacher-login-submit').click();
  await expect(teacher).toHaveURL(/\/teacher$/);

  // 等待快照載入：出現房間碼（已有活動）或建立按鈕（無活動）
  const create = teacher.getByTestId('btn-create-session');
  await expect(teacher.getByTestId('room-code').or(create)).toBeVisible();
  if (await create.isVisible()) await create.click();
  await expect(teacher.getByTestId('room-code')).toHaveText(/^[A-Z2-9]{6}$/);

  const elapsed = await importSheet('fixture-template-a');
  expect(elapsed).toBeLessThan(2000);

  await expect(teacher.getByTestId('import-question-count')).toHaveText('4');
  await expect(teacher.getByTestId('import-group-count')).toHaveText('2');
  await expect(teacher.getByTestId('import-summary')).toContainText('偵測到 4 題，其中 2 題組（共 4 子題）、2 單題');
  await expect(teacher.getByTestId('phase-badge')).toHaveText('等待開始');
  await expect(teacher.locator('body')).not.toContainText(TEMPLATE_A_QUESTION_TEXT);

  await teacher.screenshot({ path: artifact('E2E-01'), fullPage: true });
});

test('E2E-02 重新匯入 fixture-template-b：6 題、0 題組，題號清單只剩第 1～6 題', async () => {
  await importSheet('fixture-template-b');

  await expect(teacher.getByTestId('import-question-count')).toHaveText('6');
  await expect(teacher.getByTestId('import-group-count')).toHaveText('0');

  // 題號清單沒有專屬 data-testid（contracts/ui-testids.md）：取 import-summary 所在區塊文字，扣除摘要句本身後驗證
  const summary = teacher.getByTestId('import-summary');
  const blockText = await summary.locator('..').innerText();
  const listText = blockText.replace(await summary.innerText(), '');
  for (let n = 1; n <= 6; n++) expect(listText).toContain(`第 ${n} 題`);
  expect(listText).not.toContain('第 7 題');
  expect(listText).not.toContain('題組');
  await expect(teacher.getByTestId('phase-badge')).toHaveText('等待開始');

  await teacher.screenshot({ path: artifact('E2E-02'), fullPage: true });
});
