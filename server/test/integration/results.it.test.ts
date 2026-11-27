// 004 結果與匯出整合測試（TEST_SPEC §6）：IT-FLOW-01（tasks T035）、IT-CSV-01（tasks T036）
// startApp({ fakeSheets: true })：試算表為 createFakeGateway(fixtures/sheets)，並掛載 /api/dev/fake-sheets/*。
import type { SheetSnapshot } from '@quiz/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSnapshot, setCell } from '../helpers/fixtures.js';
import { ANSWERS_A, flow } from './flow.js';
import { startApp } from './startApp.js';

type App = Awaited<ReturnType<typeof startApp>>;

const SHEET_ID = 'fixture-template-a';

/**
 * 比較用的儲存格內容：去除每列尾端的空字串與尾端的空列。
 * Google Sheets values API 本來就不回傳尾端空白格，fake 閘道寫入時以 '' 補齊列長只是表示方式不同，
 * 「未填」與「''」視為同一個儲存格值（見 docs/test-report.md Q-004）。merges 另外嚴格比對。
 */
function normalized(s: SheetSnapshot) {
  return s.sheets.map((sheet) => {
    const rows = sheet.values.map((r) => {
      const out = [...r];
      while (out.length > 0 && out[out.length - 1] === '') out.pop();
      return out;
    });
    while (rows.length > 0 && rows[rows.length - 1]!.length === 0) rows.pop();
    return { title: sheet.title, values: rows, merges: sheet.merges };
  });
}

describe('004 結果與匯出整合測試', () => {
  let t: App;
  let f: ReturnType<typeof flow>;
  beforeEach(async () => {
    t = await startApp({ fakeSheets: true });
    f = flow(t.baseUrl);
    await f.login();
  });
  afterEach(async () => {
    await t.close();
  });

  it('IT-FLOW-01 建立 → 匯入 A → 3 組加入 → 作答（含撤回）→ end → 判錯遞補 → 寫回 G5/G6/G11 → CSV 含 BOM → 還原與 fixture 相同', async () => {
    const token = f.teacherToken;
    const fixture = loadSnapshot('template-a');

    // 建立（純速度、3 組）＋匯入 fixture-template-a
    const s = await f.createAndImport({ mode: 'speed', teamCount: 3, spreadsheet: SHEET_ID });
    expect(s.view.session.phase).toBe('READY');
    expect(s.view.questions.map((q) => q.number)).toEqual([1, 2, 3, 4]);
    expect(s.teamIds).toHaveLength(3);

    // 3 組各 1 人加入 → start
    const [[m1], [m2], [m3]] = await f.joinMembers(s.roomCode, 1);
    expect((await f.startQuiz(s.sessionId)).session.phase).toBe('RUNNING');

    // 第 1 組送第 1 題、第 3 題；第 2 組送第 3 題；第 3 組送第 4 題後撤回（E4）
    const r1 = await f.submit(m1!.token, s.q[1]!, ANSWERS_A[1]!);
    expect(r1.status).toBe(201);
    const r13 = await f.submit(m1!.token, s.q[3]!, ['0']);
    expect(r13.status).toBe(201);
    const r23 = await f.submit(m2!.token, s.q[3]!, ['1']);
    expect(r23.status).toBe(201);
    const r34 = await f.submit(m3!.token, s.q[4]!, ANSWERS_A[4]!);
    expect(r34.status).toBe(201);
    expect((await f.withdraw(m3!.token, r34.body.submissionId)).status).toBe(204);

    // RUNNING 中寫回 → 409 INVALID_PHASE
    const early = await f.exportSheet(token, s.sessionId);
    expect(early.status).toBe(409);
    expect((early.body as unknown as { error: { code: string } }).error.code).toBe('INVALID_PHASE');

    // end → 第 1、3 題有得主（皆為第 1 組），第 2 題無人作答、第 4 題已撤回 → 無得主
    expect((await f.endQuiz(s.sessionId)).session.phase).toBe('ENDED');
    const ended = await f.getTeacherView(s.sessionId);
    const winnerOf = (v: typeof ended, n: number) => v.questions.find((q) => q.number === n)!.winnerTeamId;
    expect(winnerOf(ended, 1)).toBe(s.teamIds[0]);
    expect(winnerOf(ended, 3)).toBe(s.teamIds[0]);
    expect(winnerOf(ended, 2)).toBeNull();
    expect(winnerOf(ended, 4)).toBeNull();

    // 判錯第 3 題 → 200，得主遞補為第 2 組（E5）
    const rej = await f.rejectWinner(token, s.sessionId, s.q[3]!);
    expect(rej.status).toBe(200);
    expect(winnerOf(rej.body, 3)).toBe(s.teamIds[1]);
    expect(winnerOf(await f.getTeacherView(s.sessionId), 3)).toBe(s.teamIds[1]);

    // 寫回 → 200、3 格（G5、G6、G11）
    const exp = await f.exportSheet(token, s.sessionId);
    expect(exp.status).toBe(200);
    expect(exp.body.updatedCells).toBe(3);

    // fake sheet：G5「（1）CPU」、G6「（2）作業系統」、G11「1」，其餘儲存格（含 G8、G9、G13）與 fixture 相同
    const afterExport = await f.getFakeSheet(SHEET_ID);
    expect(afterExport.status).toBe(200);
    const sheet = afterExport.body.sheets[0]!;
    expect(sheet.values[4]![6]).toBe('（1）CPU');
    expect(sheet.values[5]![6]).toBe('（2）作業系統');
    expect(sheet.values[10]![6]).toBe('1');
    expect(sheet.values[7]![6]).toBe('（1）'); // G8 未變
    let expected = setCell(fixture, 'G5', '（1）CPU');
    expected = setCell(expected, 'G6', '（2）作業系統');
    expected = setCell(expected, 'G11', '1');
    expect(normalized(afterExport.body)).toEqual(normalized(expected));

    // CSV 以 BOM 開頭
    const csv = await f.getCsv(token, s.sessionId);
    expect(csv.status).toBe(200);
    expect(csv.text.startsWith('﻿')).toBe(true);

    // 還原 → 200，fake sheet 與 fixture 相同
    const res = await f.restoreSheet(token, s.sessionId);
    expect(res.status).toBe(200);
    expect(res.body.updatedCells).toBe(6);
    const afterRestore = await f.getFakeSheet(SHEET_ID);
    expect(afterRestore.status).toBe(200);
    expect(normalized(afterRestore.body)).toEqual(normalized(fixture));
  });

  it('IT-CSV-01 ENDED 時 export.csv 的 Content-Type 與檔名含房間碼與 round；reset 後 r2；RUNNING → 409', async () => {
    const token = f.teacherToken;
    const s = await f.createAndImport({ mode: 'speed', teamCount: 2, spreadsheet: SHEET_ID });
    const [[m1]] = await f.joinMembers(s.roomCode, 1);

    // 第 1 輪
    await f.startQuiz(s.sessionId);
    expect((await f.submit(m1!.token, s.q[3]!, ['0'])).status).toBe(201);
    await f.endQuiz(s.sessionId);
    const r1 = await f.getCsv(token, s.sessionId);
    expect(r1.status).toBe(200);
    expect(r1.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(r1.headers.get('content-disposition')).toBe(`attachment; filename="results-${s.roomCode}-r1.csv"`);

    // reset → start：RUNNING 中下載 → 409 INVALID_PHASE
    await f.resetQuiz(s.sessionId);
    await f.startQuiz(s.sessionId);
    const running = await f.getCsv(token, s.sessionId);
    expect(running.status).toBe(409);
    expect((JSON.parse(running.text) as { error: { code: string } }).error.code).toBe('INVALID_PHASE');

    // end → 第 2 輪檔名
    await f.endQuiz(s.sessionId);
    const r2 = await f.getCsv(token, s.sessionId);
    expect(r2.status).toBe(200);
    expect(r2.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(r2.headers.get('content-disposition')).toBe(`attachment; filename="results-${s.roomCode}-r2.csv"`);
  });
});
