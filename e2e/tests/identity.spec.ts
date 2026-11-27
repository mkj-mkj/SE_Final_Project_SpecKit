// 001-session-and-join E2E：E2E-03（多學生加入、老師即時名單）與 E2E-18（已加入者重開 /join）
// TEST_SPEC §7：每位使用者獨立 browser.newContext()；只用 data-testid 選取；每個測試結束截圖到 e2e/artifacts/<ID>.png
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import config from '../playwright.config';

// E2E 密碼只定義在 playwright.config.ts 的 webServer env（001 T087）
const TEACHER_PASSWORD = (config.webServer as { env: Record<string, string> }).env.TEACHER_PASSWORD!;

const artifact = (id: string) => fileURLToPath(new URL(`../artifacts/${id}.png`, import.meta.url));

test.describe.configure({ mode: 'serial' });

let teacherCtx: BrowserContext;
let teacher: Page;
let roomCode = '';
const students: { ctx: BrowserContext; page: Page; team: number; nickname: string }[] = [];

async function joinAsStudent(browser: Browser, team: number, nickname: string) {
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
  students.push({ ctx, page, team, nickname });
}

test.afterAll(async () => {
  for (const s of students) await s.ctx.close();
  await teacherCtx?.close();
});

test('E2E-03 4 個學生加入（第 1 組 2 人、第 2、3 組各 1 人），老師名單人數正確', async ({ browser }) => {
  teacherCtx = await browser.newContext();
  teacher = await teacherCtx.newPage();
  await teacher.goto('/teacher/login');
  await teacher.getByTestId('teacher-password').fill(TEACHER_PASSWORD);
  await teacher.getByTestId('teacher-login-submit').click();
  await expect(teacher).toHaveURL(/\/teacher$/);
  await teacher.getByTestId('btn-create-session').click();
  await expect(teacher.getByTestId('room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  roomCode = (await teacher.getByTestId('room-code').textContent())!.trim();

  await joinAsStudent(browser, 1, 'Alice');
  await joinAsStudent(browser, 1, 'Bob');
  await joinAsStudent(browser, 2, 'Carol');
  await joinAsStudent(browser, 3, 'Dave');

  await expect(teacher.getByTestId('team-member-count-1')).toHaveText('2');
  await expect(teacher.getByTestId('team-member-count-2')).toHaveText('1');
  await expect(teacher.getByTestId('team-member-count-3')).toHaveText('1');

  await teacher.screenshot({ path: artifact('E2E-03'), fullPage: true });
});

test('E2E-18 已加入的學生在同一 context 開啟 /join → 自動導向 /play，暱稱與組人數不變', async () => {
  const s = students[0];
  const page = await s.ctx.newPage();
  await page.goto('/join');
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByTestId('my-nickname')).toHaveText(s.nickname);
  await expect(page.getByTestId('join-nickname')).toHaveCount(0);

  await expect(teacher.getByTestId('team-member-count-1')).toHaveText('2');
  await expect(teacher.getByTestId('team-member-count-2')).toHaveText('1');
  await expect(teacher.getByTestId('team-member-count-3')).toHaveText('1');

  await page.screenshot({ path: artifact('E2E-18'), fullPage: true });
  await page.close();
});
