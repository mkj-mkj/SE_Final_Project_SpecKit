import type { Submission, SubmissionStatus, Team } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { orderSubmissions, rankSubmissions, teamScores, winnerOf } from '../../src/domain/ranking.js';

// 手動建構送出紀錄（不連資料庫）
let autoSeq = 0;
function sub(
  id: string,
  opts: { teamId?: string; questionId?: string; status?: SubmissionStatus; orderKey?: number | null; serverTime?: number; seq?: number } = {},
): Submission {
  autoSeq += 1;
  return {
    id,
    sessionId: 'ses_1',
    questionId: opts.questionId ?? 'q1',
    teamId: opts.teamId ?? `team_${id}`,
    memberId: `mem_${id}`,
    answers: ['0'],
    serverTime: opts.serverTime ?? 1000,
    seq: opts.seq ?? autoSeq,
    status: opts.status ?? 'active',
    orderKey: opts.orderKey === undefined ? 1 : opts.orderKey,
    withdrawnAt: opts.status === 'withdrawn' ? 2000 : null,
  };
}

const team = (id: string, index: number): Team => ({ id, sessionId: 'ses_1', index, name: `第 ${index} 組` });

describe('ranking', () => {
  it('UT-RANK-01 orderKey [2, null, 1] → 排序為 1、2、null', () => {
    const subs = [sub('a', { orderKey: 2 }), sub('b', { orderKey: null }), sub('c', { orderKey: 1 })];
    const snapshot = JSON.stringify(subs);
    expect(orderSubmissions(subs).map((s) => s.orderKey)).toEqual([1, 2, null]);
    expect(JSON.stringify(subs)).toBe(snapshot); // 不修改輸入
  });

  it('UT-RANK-02 orderKey 皆 null、serverTime 不同 → 依 serverTime', () => {
    const subs = [
      sub('a', { orderKey: null, serverTime: 300, seq: 1 }),
      sub('b', { orderKey: null, serverTime: 100, seq: 2 }),
      sub('c', { orderKey: null, serverTime: 200, seq: 3 }),
    ];
    expect(orderSubmissions(subs).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('UT-RANK-03 serverTime 相同、seq 不同 → 依 seq', () => {
    const subs = [
      sub('a', { orderKey: null, serverTime: 100, seq: 9 }),
      sub('b', { orderKey: null, serverTime: 100, seq: 3 }),
      sub('c', { orderKey: null, serverTime: 100, seq: 5 }),
    ];
    expect(orderSubmissions(subs).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('UT-RANK-04 含 withdrawn → 不出現在結果，rank 連續 1..n', () => {
    const subs = [
      sub('a', { orderKey: 1, status: 'withdrawn' }),
      sub('b', { orderKey: 2 }),
      sub('c', { orderKey: 3, status: 'withdrawn' }),
      sub('d', { orderKey: 4 }),
    ];
    const snapshot = JSON.stringify(subs);
    const ranked = rankSubmissions(subs);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ['b', 1],
      ['d', 2],
    ]);
    expect(ranked[0]?.isWinner).toBe(true);
    expect(JSON.stringify(subs)).toBe(snapshot);
  });

  it('UT-RANK-05 第一名 rejected → 第二名 isWinner=true；rejected 仍有 rank 1', () => {
    const subs = [sub('a', { orderKey: 1, status: 'rejected' }), sub('b', { orderKey: 2 }), sub('c', { orderKey: 3 })];
    const ranked = rankSubmissions(subs);
    expect(ranked.map((r) => [r.id, r.rank, r.isWinner])).toEqual([
      ['a', 1, false],
      ['b', 2, true],
      ['c', 3, false],
    ]);
    expect(winnerOf(subs)?.id).toBe('b');
  });

  it('UT-RANK-06 全部 orderKey 為 null（視窗中）→ winnerOf 為 null', () => {
    const subs = [sub('a', { orderKey: null }), sub('b', { orderKey: null })];
    expect(winnerOf(subs)).toBeNull();
    expect(rankSubmissions(subs).every((r) => !r.isWinner)).toBe(true);
  });

  it('UT-RANK-07 全部 rejected 或 withdrawn → winnerOf 為 null', () => {
    const subs = [sub('a', { orderKey: 1, status: 'rejected' }), sub('b', { orderKey: 2, status: 'withdrawn' })];
    expect(winnerOf(subs)).toBeNull();
    expect(winnerOf([])).toBeNull();
  });

  it('UT-RANK-08 teamScores：A 贏 2 題、B 贏 1 題、C 無 → A=2、B=1、C=0', () => {
    const teams = [team('A', 1), team('B', 2), team('C', 3)];
    const byQ = new Map<string, Submission[]>([
      ['q1', [sub('1a', { teamId: 'A', orderKey: 1 }), sub('1b', { teamId: 'B', orderKey: 2 })]],
      ['q2', [sub('2b', { teamId: 'B', orderKey: 1 }), sub('2c', { teamId: 'C', orderKey: 2 })]],
      ['q3', [sub('3a', { teamId: 'A', orderKey: 1 })]],
      ['q4', [sub('4c', { teamId: 'C', orderKey: null })]], // 視窗中，沒有得主
    ]);
    const scores = teamScores(teams, byQ);
    expect(Object.fromEntries(scores)).toEqual({ A: 2, B: 1, C: 0 });
  });

  it('UT-RANK-09 teamScores：A 的得主被 rejected、B 遞補 → A=0、B=1', () => {
    const teams = [team('A', 1), team('B', 2)];
    const byQ = new Map<string, Submission[]>([
      ['q1', [sub('1a', { teamId: 'A', orderKey: 1, status: 'rejected' }), sub('1b', { teamId: 'B', orderKey: 2 })]],
    ]);
    expect(Object.fromEntries(teamScores(teams, byQ))).toEqual({ A: 0, B: 1 });
  });
});
