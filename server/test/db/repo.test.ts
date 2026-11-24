import type { Session, Submission } from '@quiz/shared';
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

// ---------- 003：drafts、submissions、seq（UT-REPO-02～06） ----------

/** 建立一個活動、1 題、2 組、每組 1 位成員 */
function seedRepo(): Repo {
  const repo = new Repo(openDb(':memory:'));
  repo.insertSession(sampleSession());
  repo.insertQuestion({ id: 'q1', sessionId: 'ses_1', number: 1, isGroup: true, subCount: 2, state: 'open', windowEndsAt: null });
  for (const [i, t] of ['A', 'B'].entries()) {
    repo.insertTeam({ id: `team_${t}`, sessionId: 'ses_1', index: i + 1, name: `第 ${i + 1} 組` });
    repo.insertMember(
      { id: `mem_${t}`, teamId: `team_${t}`, nickname: `M${t}`, token: `tok_${t}`, joinedAt: 1, lastSeenAt: 1 },
      `m${t.toLowerCase()}`,
    );
  }
  return repo;
}

function sub(id: string, teamId: string, seq: number, status: Submission['status'] = 'active'): Submission {
  return {
    id,
    sessionId: 'ses_1',
    questionId: 'q1',
    teamId,
    memberId: teamId.replace('team', 'mem'),
    answers: ['CPU', '作業系統'],
    serverTime: 1_700_000_000_000 + seq,
    seq,
    status,
    orderKey: seq,
    withdrawnAt: status === 'withdrawn' ? 1_700_000_000_500 : null,
  };
}

describe('Repo（003 drafts、submissions、seq）', () => {
  it('UT-REPO-02 answers 含中文、逗號、換行 → insertSubmission 後 getSubmission 的 answers 完全相同', () => {
    const repo = seedRepo();
    const s = { ...sub('sub_1', 'team_A', 1), answers: ['作業,系統', '第一行\n第二行'] };
    repo.insertSubmission(s);
    expect(repo.getSubmission('sub_1')).toEqual(s);
    expect(repo.getSubmission('nope')).toBeNull();
    // 草稿的 JSON 往返也相同（不 trim）
    repo.upsertDraft({ teamId: 'team_A', questionId: 'q1', answers: [' 作業,系統 ', '\n'], updatedBy: 'mem_A', updatedAt: 5 });
    expect(repo.listDrafts('ses_1')).toEqual([
      { teamId: 'team_A', questionId: 'q1', answers: [' 作業,系統 ', '\n'], updatedBy: 'mem_A', updatedAt: 5 },
    ]);
  });

  it("UT-REPO-03 同組同題插入第二筆 active → AppError code==='ALREADY_SUBMITTED'", () => {
    const repo = seedRepo();
    repo.insertSubmission(sub('sub_1', 'team_A', 1));
    expect(() => repo.insertSubmission(sub('sub_2', 'team_A', 2))).toThrowError(
      expect.objectContaining({ code: 'ALREADY_SUBMITTED' }),
    );
    // 已判錯（rejected）也佔名額
    repo.updateSubmission('sub_1', { status: 'rejected' });
    expect(() => repo.insertSubmission(sub('sub_3', 'team_A', 3))).toThrowError(
      expect.objectContaining({ code: 'ALREADY_SUBMITTED' }),
    );
    // 其他組不受影響
    repo.insertSubmission(sub('sub_4', 'team_B', 4));
    expect(repo.listSubmissions('ses_1').map((s) => s.id)).toEqual(['sub_1', 'sub_4']);
  });

  it('UT-REPO-04 同組同題：先 withdrawn 再 active → 允許', () => {
    const repo = seedRepo();
    repo.insertSubmission(sub('sub_1', 'team_A', 1));
    repo.updateSubmission('sub_1', { status: 'withdrawn', withdrawnAt: 99 });
    repo.insertSubmission(sub('sub_2', 'team_A', 2));
    expect(repo.listSubmissionsByQuestion('q1').map((s) => [s.id, s.status, s.withdrawnAt])).toEqual([
      ['sub_1', 'withdrawn', 99],
      ['sub_2', 'active', null],
    ]);
    // updateSubmission 只更新有提供的欄位
    repo.updateSubmission('sub_2', { orderKey: null });
    expect(repo.getSubmission('sub_2')).toMatchObject({ status: 'active', orderKey: null, withdrawnAt: null });
  });

  it('UT-REPO-05 刪除 session → questions、teams、members、submissions 連帶刪除', () => {
    const repo = seedRepo();
    repo.insertSubmission(sub('sub_1', 'team_A', 1));
    repo.upsertDraft({ teamId: 'team_B', questionId: 'q1', answers: ['x', ''], updatedBy: 'mem_B', updatedAt: 1 });
    repo.db.prepare('DELETE FROM sessions WHERE id = $id').run({ id: 'ses_1' });
    expect(repo.listQuestions('ses_1')).toEqual([]);
    expect(repo.listTeams('ses_1')).toEqual([]);
    expect(repo.getMember('mem_A')).toBeNull();
    expect(repo.listSubmissions('ses_1')).toEqual([]);
    expect(repo.listDrafts('ses_1')).toEqual([]);
  });

  it('UT-REPO-06 連續呼叫 nextSeq() 三次 → 嚴格遞增', () => {
    const repo = seedRepo();
    const a = repo.nextSeq();
    const b = repo.nextSeq();
    const c = repo.nextSeq();
    expect(a).toBe(1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    // 新的 Repo 實例（例如重啟）接續資料庫中最大的 seq
    repo.insertSubmission(sub('sub_9', 'team_A', 50));
    expect(new Repo(repo.db).nextSeq()).toBe(51);
    expect(repo.nextSeq()).toBe(51);
  });

  it('UT-REPO-06 題目狀態與活動查詢：updateQuestionState、resetQuestionStates、listSessionsByPhase', () => {
    const repo = seedRepo();
    repo.updateQuestionState('q1', 'window', 123);
    expect(repo.getQuestion('q1')).toMatchObject({ state: 'window', windowEndsAt: 123 });
    repo.resetQuestionStates('ses_1');
    expect(repo.getQuestion('q1')).toMatchObject({ state: 'open', windowEndsAt: null });
    expect(repo.getQuestion('nope')).toBeNull();
    expect(repo.listSessionsByPhase('SETUP').map((s) => s.id)).toEqual(['ses_1']);
    expect(repo.listSessionsByPhase('RUNNING')).toEqual([]);
    // 刪除草稿與送出
    repo.upsertDraft({ teamId: 'team_A', questionId: 'q1', answers: ['a', 'b'], updatedBy: 'mem_A', updatedAt: 1 });
    repo.upsertDraft({ teamId: 'team_A', questionId: 'q1', answers: ['c', 'd'], updatedBy: 'mem_A', updatedAt: 2 });
    expect(repo.listDrafts('ses_1').map((d) => d.answers)).toEqual([['c', 'd']]);
    repo.deleteDraft('team_A', 'q1');
    expect(repo.listDrafts('ses_1')).toEqual([]);
    repo.upsertDraft({ teamId: 'team_B', questionId: 'q1', answers: ['e', 'f'], updatedBy: 'mem_B', updatedAt: 3 });
    repo.insertSubmission(sub('sub_1', 'team_A', 1));
    repo.deleteDraftsBySession('ses_1');
    repo.deleteSubmissionsBySession('ses_1');
    expect(repo.listDrafts('ses_1')).toEqual([]);
    expect(repo.listSubmissions('ses_1')).toEqual([]);
  });
});