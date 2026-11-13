import type { Session } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { openDb, withTransaction } from '../../src/db/db.js';
import { Repo } from '../../src/db/repo.js';

function sampleSession(id = 'ses_1', roomCode = 'AAAAA2'): Session {
  return {
    id,
    roomCode,
    phase: 'SETUP',
    spreadsheetId: null,
    sheetTitle: null,
    fairnessMode: 'fair',
    windowSec: 3,
    teamCount: 6,
    round: 1,
    createdAt: 1_700_000_000_000,
    startedAt: null,
    endedAt: null,
  };
}

describe('Repo', () => {
  it('UT-REPO-01 建立並讀回 session，欄位值相同', () => {
    const repo = new Repo(openDb(':memory:'));
    const s = sampleSession();
    repo.insertSession(s);
    // node:sqlite 回傳 null-prototype 物件，以 toEqual 比對
    expect(repo.getSession('ses_1')).toEqual(s);
    expect(repo.getSessionByRoomCode('AAAAA2')).toEqual(s);
  });

  it('UT-REPO-07 withTransaction 中途丟出例外 → 交易內所有寫入回復，例外原樣丟出', () => {
    const db = openDb(':memory:');
    const repo = new Repo(db);
    const boom = new Error('boom');
    let caught: unknown;
    try {
      withTransaction(db, () => {
        repo.insertSession(sampleSession('ses_1', 'AAAAA2'));
        repo.insertTeam({ id: 'team_1', sessionId: 'ses_1', index: 1, name: '第 1 組' });
        throw boom;
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(boom);
    expect(repo.getSession('ses_1')).toBeNull();
    expect(repo.listTeams('ses_1')).toEqual([]);
    // 交易結束後仍可正常寫入
    repo.insertSession(sampleSession('ses_2', 'AAAAA3'));
    expect(repo.getSession('ses_2')?.roomCode).toBe('AAAAA3');
  });
});
