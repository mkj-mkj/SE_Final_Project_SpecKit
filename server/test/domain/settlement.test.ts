import type { Submission } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { assignOrderKeys, nextOrderKey, sortFairCandidates } from '../../src/domain/settlement.js';

// 手動建構視窗中的候選送出（orderKey = null）
function cand(id: string, teamId: string, serverTime: number, seq: number, orderKey: number | null = null): Submission {
  return {
    id,
    sessionId: 'ses_1',
    questionId: 'q1',
    teamId,
    memberId: `mem_${id}`,
    answers: ['0'],
    serverTime,
    seq,
    status: 'active',
    orderKey,
    withdrawnAt: null,
  };
}

describe('settlement', () => {
  it('UT-SETTLE-01 分數 A=2、B=0；A 較早送出 → B 在前', () => {
    const cands = [cand('a', 'A', 0, 1), cand('b', 'B', 1000, 2)];
    const snapshot = JSON.stringify(cands);
    const sorted = sortFairCandidates(cands, new Map([['A', 2], ['B', 0]]));
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a']);
    expect(JSON.stringify(cands)).toBe(snapshot); // 不修改輸入
  });

  it('UT-SETTLE-02 同分 → 早送出者在前', () => {
    const cands = [cand('a', 'A', 500, 1), cand('b', 'B', 0, 2)];
    expect(sortFairCandidates(cands, new Map([['A', 1], ['B', 1]])).map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('UT-SETTLE-03 同分同時間 → seq 小者在前', () => {
    const cands = [cand('a', 'A', 100, 7), cand('b', 'B', 100, 4)];
    expect(sortFairCandidates(cands, new Map([['A', 1], ['B', 1]])).map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('UT-SETTLE-04 scores 中沒有某組 → 視為 0', () => {
    const cands = [cand('a', 'A', 0, 1), cand('c', 'C', 900, 2)];
    expect(sortFairCandidates(cands, new Map([['A', 1]])).map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('UT-SETTLE-05 assignOrderKeys(sorted, 3) → 3、4、5', () => {
    const sorted = [cand('x', 'A', 0, 1), cand('y', 'B', 0, 2), cand('z', 'C', 0, 3)];
    const keys = assignOrderKeys(sorted, 3);
    expect([...keys.entries()]).toEqual([
      ['x', 3],
      ['y', 4],
      ['z', 5],
    ]);
  });

  it('UT-SETTLE-06 nextOrderKey([]) → 1；orderKey [1, 2, null] → 3', () => {
    expect(nextOrderKey([])).toBe(1);
    expect(nextOrderKey([cand('a', 'A', 0, 1, 1), cand('b', 'B', 0, 2, 2), cand('c', 'C', 0, 3, null)])).toBe(3);
  });
});
