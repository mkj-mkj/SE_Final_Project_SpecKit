// 公平模式結算（TECH_SPEC §7.7，FR-11、E3）：純函式。
// 視窗結束時，視窗內的候選送出依「目前分數低者優先 → 較早送出 → seq 小者」排序，
// 再依序配發 orderKey；之後的名次與得主一律由 ranking.ts 依 orderKey 推導。
import type { Submission } from '@quiz/shared';

/** 公平排序：分數（scores 沒有的組視為 0）升冪 → serverTime 升冪 → seq 升冪；回傳新陣列 */
export function sortFairCandidates(cands: Submission[], scores: Map<string, number>): Submission[] {
  const scoreOf = (s: Submission): number => scores.get(s.teamId) ?? 0;
  return [...cands].sort((a, b) => scoreOf(a) - scoreOf(b) || a.serverTime - b.serverTime || a.seq - b.seq);
}

/** 依排序結果配發名次鍵：id → startAt、startAt+1… */
export function assignOrderKeys(sorted: Submission[], startAt: number): Map<string, number> {
  return new Map(sorted.map((s, i) => [s.id, startAt + i]));
}

/** 下一個名次鍵：所有送出（含 withdrawn）中 orderKey 的最大值 + 1；沒有任何已配發的鍵則為 1 */
export function nextOrderKey(subs: Submission[]): number {
  let max = 0;
  for (const s of subs) {
    if (s.orderKey !== null && s.orderKey > max) max = s.orderKey;
  }
  return max + 1;
}
