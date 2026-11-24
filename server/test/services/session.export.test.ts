// UT-SVC-EXPORT-01～06（TEST_SPEC §5.6）：寫回、還原、CSV（FR-06、PRD §8 第 9、10 點、E2）。
// 寫回一律用 InMemorySheetsGateway（makeTestService），不連網。
import { AppError } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { loadSnapshot } from '../helpers/fixtures.js';
import { makeTestService } from '../helpers/makeTestService.js';
import { seedRunning } from '../helpers/seed.js';

async function codeOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return (e as AppError).code;
  }
  throw new Error('預期丟出 AppError');
}

/** 比較儲存格值用：去掉每列結尾的空字串與結尾的空列（寫入 '' 時替身會補齊列寬，值本身相同） */
function normalized(snap: ReturnType<typeof loadSnapshot>) {
  const out = structuredClone(snap);
  for (const sheet of out.sheets) {
    sheet.values = sheet.values.map((r) => {
      const row = [...r];
      while (row.length > 0 && row.at(-1) === '') row.pop();
      return row;
    });
    while (sheet.values.length > 0 && sheet.values.at(-1)!.length === 0) sheet.values.pop();
  }
  return out;
}

/** 範例 A 快照中某格的值（0-based 列、欄） */
function cellOf(snap: ReturnType<typeof loadSnapshot>, row: number, col: number): string {
  return snap.sheets[0]!.values[row]?.[col] ?? '';
}

describe('SessionService 寫回／還原／CSV', () => {
  it('UT-SVC-EXPORT-01 範例 A：end 後匯出 → gateway 恰收到 G5（1）CPU、G6（2）作業系統、G11 0 三筆；updatedCells 3', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[1]!, ['CPU', '作業系統']);
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']);
    t.service.end(sessionId);
    const calls = t.broadcaster.calls.length;

    const result = await t.service.exportToSheet(sessionId);

    const expected = [
      { sheetTitle: '學習單', a1: 'G5', value: '（1）CPU' },
      { sheetTitle: '學習單', a1: 'G6', value: '（2）作業系統' },
      { sheetTitle: '學習單', a1: 'G11', value: '0' },
    ];
    expect(t.gateway.writes).toEqual([{ spreadsheetId: 'fixture-template-a', writes: expected }]);
    expect(result).toEqual({ updatedCells: 3, writes: expected });
    // 其他儲存格不變（G8 為第 2 題作答格，無得主）
    const original = loadSnapshot('template-a');
    expect(cellOf(t.gateway.current('fixture-template-a'), 7, 6)).toBe(cellOf(original, 7, 6));
    // 寫回不推播
    expect(t.broadcaster.calls.length).toBe(calls);

    // 重複寫回 → 結果相同（spec FR-031）
    const again = await t.service.exportToSheet(sessionId);
    expect(again.writes).toEqual(result.writes);
  });

  it('UT-SVC-EXPORT-02 RUNNING 中匯出 → INVALID_PHASE；gateway 未被呼叫；ENDED 但無得主 → 0 筆且不呼叫 gateway', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    expect(await codeOf(() => t.service.exportToSheet(sessionId))).toBe('INVALID_PHASE');
    expect(t.gateway.writes).toHaveLength(0);

    const e = makeTestService();
    const empty = await seedRunning(e);
    e.service.end(empty.sessionId);
    expect(await e.service.exportToSheet(empty.sessionId)).toEqual({ updatedCells: 0, writes: [] });
    expect(e.gateway.writes).toHaveLength(0);
  });

  it('UT-SVC-EXPORT-03 還原 → 6 筆，值為各 originalValue；READY 可還原、RUNNING → INVALID_PHASE', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[1]!, ['CPU', '作業系統']);
    t.service.end(sessionId);
    await t.service.exportToSheet(sessionId);

    expect(await t.service.restoreSheet(sessionId)).toEqual({ updatedCells: 6 });
    const restore = t.gateway.writes.at(-1)!.writes;
    const slots = t.repo.listSlotsBySession(sessionId);
    expect(restore).toHaveLength(6);
    for (const s of slots) expect(restore).toContainEqual({ sheetTitle: s.sheetTitle, a1: s.a1, value: s.originalValue });
    expect(normalized(t.gateway.current('fixture-template-a'))).toEqual(normalized(loadSnapshot('template-a')));

    t.service.reset(sessionId); // READY
    expect(await t.service.restoreSheet(sessionId)).toEqual({ updatedCells: 6 });
    t.service.start(sessionId); // RUNNING
    expect(await codeOf(() => t.service.restoreSheet(sessionId))).toBe('INVALID_PHASE');
  });

  it('UT-SVC-EXPORT-04 exportCsv（ENDED）→ 以 BOM 開頭；列數 = 送出的子題總數 + 1', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[1]!, ['CPU', '作業系統']); // 2 個子題
    t.service.submit(tokens[1]![0]!, q[3]!, ['0']); // 1
    const w = t.service.submit(tokens[2]![0]!, q[4]!, ['=1+1']); // 1（撤回也列出）
    t.service.withdraw(tokens[2]![0]!, w.submissionId);
    t.service.end(sessionId);

    const csv = t.service.exportCsv(sessionId);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.split('\r\n');
    expect(lines.at(-1)).toBe('');
    expect(lines.slice(0, -1)).toHaveLength(4 + 1);
    expect(csv).toContain(",'=1+1,");
  });

  it('UT-SVC-EXPORT-05 exportCsv（RUNNING）→ INVALID_PHASE', async () => {
    const t = makeTestService();
    const { sessionId } = await seedRunning(t);
    expect(await codeOf(() => t.service.exportCsv(sessionId))).toBe('INVALID_PHASE');
  });

  it('UT-SVC-EXPORT-06 gateway failNext → 匯出丟出 SHEETS_ERROR；還原丟出 SHEETS_PERMISSION_DENIED', async () => {
    const t = makeTestService();
    const { sessionId, tokens, q } = await seedRunning(t);
    t.service.submit(tokens[0]![0]!, q[3]!, ['0']);
    t.service.end(sessionId);
    t.gateway.failNext('SHEETS_ERROR');
    expect(await codeOf(() => t.service.exportToSheet(sessionId))).toBe('SHEETS_ERROR');
    t.gateway.failNext('SHEETS_PERMISSION_DENIED');
    expect(await codeOf(() => t.service.restoreSheet(sessionId))).toBe('SHEETS_PERMISSION_DENIED');
  });
});
