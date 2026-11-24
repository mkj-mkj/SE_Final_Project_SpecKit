// UT-CSV-01～06（TEST_SPEC §5.3）：結果 CSV（TECH_SPEC §7.5）。UT-CSV-07 經 buildCsvRows，在 projections.test.ts。
import { describe, expect, it } from 'vitest';
import { buildResultsCsv, type CsvRow } from '../../src/export/csv.js';

const HEADER = '﻿題號,子題,組別,送出者,答案,伺服器時間,順位,狀態,是否得主\r\n';

function row(over: Partial<CsvRow> = {}): CsvRow {
  return {
    questionNumber: 1,
    subNo: 1,
    teamName: '第 1 組',
    submittedBy: 'T1M1',
    answer: 'CPU',
    serverTime: 0,
    rank: 1,
    status: 'active',
    isWinner: true,
    ...over,
  };
}

/** 取第 n 個資料列（不含表頭）的「答案」欄原文：表頭後的第 n 列，第 5 欄起到「伺服器時間」之前 */
function dataLines(csv: string): string[] {
  return csv.slice(HEADER.length).split('\r\n').slice(0, -1);
}

describe('export/csv', () => {
  it('UT-CSV-01 空列 → 恰為 BOM＋固定表頭＋CRLF', () => {
    expect(buildResultsCsv([])).toBe(HEADER);
    expect(buildResultsCsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  it('UT-CSV-02 兩列 → 共 3 個 CRLF，每列以 CRLF 結尾', () => {
    const csv = buildResultsCsv([row(), row({ subNo: 2, answer: '作業系統' })]);
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(dataLines(csv)).toEqual([
      '1,1,第 1 組,T1M1,CPU,1970-01-01T08:00:00.000+08:00,1,有效,是',
      '1,2,第 1 組,T1M1,作業系統,1970-01-01T08:00:00.000+08:00,1,有效,是',
    ]);
  });

  it('UT-CSV-03 答案含逗號、雙引號、換行 → 以雙引號包住，內部 " 變 ""', () => {
    const csv = buildResultsCsv([row({ answer: 'a,b' }), row({ answer: '他說"好"' }), row({ answer: '第一行\n第二行' })]);
    expect(csv).toContain(',"a,b",');
    expect(csv).toContain(',"他說""好""",');
    expect(csv).toContain(',"第一行\n第二行",');
  });

  it("UT-CSV-04 答案以 = + - @ 開頭 → 前面加 '（先防公式再跳脫）", () => {
    const lines = dataLines(
      buildResultsCsv(['=1+1', '+5', '-3', '@x'].map((answer) => row({ answer }))),
    );
    expect(lines.map((l) => l.split(',')[4])).toEqual(["'=1+1", "'+5", "'-3", "'@x"]);
    expect(buildResultsCsv([row({ answer: '=a,b' })])).toContain(`,"'=a,b",`);
  });

  it('UT-CSV-05 serverTime = 0 → 1970-01-01T08:00:00.000+08:00（台北時間，不依賴系統時區）', () => {
    expect(dataLines(buildResultsCsv([row({ serverTime: 0 })]))[0]!.split(',')[5]).toBe(
      '1970-01-01T08:00:00.000+08:00',
    );
    expect(dataLines(buildResultsCsv([row({ serverTime: Date.UTC(2026, 10, 24, 6, 3, 5, 120) })]))[0]!.split(',')[5]).toBe(
      '2026-11-24T14:03:05.120+08:00',
    );
  });

  it('UT-CSV-06 狀態三種、是否得主、rank null → 有效／已撤回／判錯、是／否、空字串', () => {
    const lines = dataLines(
      buildResultsCsv([
        row({ status: 'active', isWinner: true, rank: 1 }),
        row({ status: 'rejected', isWinner: false, rank: 2 }),
        row({ status: 'withdrawn', isWinner: false, rank: null }),
      ]),
    );
    expect(lines.map((l) => l.split(',').slice(6))).toEqual([
      ['1', '有效', '是'],
      ['2', '判錯', '否'],
      ['', '已撤回', '否'],
    ]);
  });
});
