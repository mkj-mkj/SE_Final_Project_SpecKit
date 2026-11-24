// 排名與得分（TECH_SPEC §7.6，FR-05、FR-11、E5）：全部是純函式，得主、順位、分數不存資料庫，一律由送出紀錄推導。
//
// 判錯（rejected）的送出保留名次但不能是得主；撤回（withdrawn）的送出不列入名次。
// 因此得主撤回或被判錯時，下一位自動「遞補」、原得主自動「扣分」，不需要額外狀態。
import type { RankedSubmission, Submission, Team } from '@quiz/shared';

/** 送出先後的比較：orderKey 升冪（null＝視窗中尚未結算，排最後）→ serverTime 升冪 → seq 升冪 */
function compareSubmissions(a: Submission, b: Submission): number {
  if (a.orderKey !== b.orderKey) {
    if (a.orderKey === null) return 1;
    if (b.orderKey === null) return -1;
    return a.orderKey - b.orderKey;
  }
  if (a.serverTime !== b.serverTime) return a.serverTime - b.serverTime;
  return a.seq - b.seq;
}

/** 可以當得主：有效且已結算（orderKey 不是 null） */
function canWin(s: Submission): boolean {
  return s.status === 'active' && s.orderKey !== null;
}

/** 排除 withdrawn 後排序；回傳新陣列，不修改輸入 */
export function orderSubmissions(subs: Submission[]): Submission[] {
  return subs.filter((s) => s.status !== 'withdrawn').sort(compareSubmissions);
}

/** rank = 排序位置 + 1；isWinner = 排序後第一筆可以當得主的送出（rejected 保留 rank 但跳過） */
export function rankSubmissions(subs: Submission[]): RankedSubmission[] {
  const ordered = orderSubmissions(subs);
  const winner = ordered.find(canWin) ?? null;
  return ordered.map((s, i) => ({ ...s, rank: i + 1, isWinner: s === winner }));
}

/** 某題的得主；視窗中（全部 orderKey 為 null）或沒有有效送出時為 null */
export function winnerOf(subs: Submission[]): Submission | null {
  return orderSubmissions(subs).find(canWin) ?? null;
}

/** 各組分數：每題得主的組 +1；沒有得分的組為 0 */
export function teamScores(teams: Team[], subsByQuestion: Map<string, Submission[]>): Map<string, number> {
  const scores = new Map<string, number>(teams.map((t) => [t.id, 0]));
  for (const subs of subsByQuestion.values()) {
    const w = winnerOf(subs);
    if (w && scores.has(w.teamId)) {
      scores.set(w.teamId, (scores.get(w.teamId) ?? 0) + 1);
    }
  }
  return scores;
}
