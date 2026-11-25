// 時間與答案格式化（TECH_SPEC §10.4、research R-10）

/** Asia/Taipei 固定 UTC+8 且無日光節約，直接位移 8 小時後取 UTC 欄位，不依賴 Intl 時區資料 */
const TAIPEI_OFFSET_MS = 8 * 3600_000;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** HH:mm:ss（Asia/Taipei） */
export function formatClock(ms: number): string {
  const d = new Date(ms + TAIPEI_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** HH:mm:ss.SSS（Asia/Taipei） */
export function formatTime(ms: number): string {
  const d = new Date(ms + TAIPEI_OFFSET_MS);
  return `${formatClock(ms)}.${pad(d.getUTCMilliseconds(), 3)}`;
}

/** 單題直接回傳答案；題組以「／」連接「子題標籤＋答案」，例：（1）CPU／（2）作業系統 */
export function formatAnswers(answers: string[], subLabels: string[]): string {
  if (subLabels.length <= 1) return answers[0] ?? '';
  return answers.map((a, i) => `${subLabels[i] ?? ''}${a}`).join('／');
}
