// UT-A1（TEST_SPEC §5.2）：sheets/a1.ts
import { AppError } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { colToLetters, parseSpreadsheetInput, quoteSheet, rangeA1, toA1 } from '../../src/sheets/a1.js';

describe('sheets/a1', () => {
  it('UT-A1-01 colToLetters 0、6、25、26、701、702 → A、G、Z、AA、ZZ、AAA', () => {
    expect([0, 6, 25, 26, 701, 702].map(colToLetters)).toEqual(['A', 'G', 'Z', 'AA', 'ZZ', 'AAA']);
  });

  it('UT-A1-02 toA1(4,6) → G5；toA1(0,0) → A1', () => {
    expect(toA1(4, 6)).toBe('G5');
    expect(toA1(0, 0)).toBe('A1');
  });

  it("UT-A1-03 quoteSheet('學習單') → '學習單'；quoteSheet(\"It's\") → 'It''s'", () => {
    expect(quoteSheet('學習單')).toBe("'學習單'");
    expect(quoteSheet("It's")).toBe("'It''s'");
  });

  it("UT-A1-04 rangeA1('學習單','G5') → '學習單'!G5", () => {
    expect(rangeA1('學習單', 'G5')).toBe("'學習單'!G5");
  });

  it('UT-A1-05 Google Sheets 網址取出試算表 ID', () => {
    expect(parseSpreadsheetInput('https://docs.google.com/spreadsheets/d/1AbC_d-EfGhIjK/edit#gid=0')).toBe(
      '1AbC_d-EfGhIjK',
    );
  });

  it('UT-A1-06 符合 ID 格式的字串原樣回傳', () => {
    expect(parseSpreadsheetInput('1AbC_d-EfGhIjK')).toBe('1AbC_d-EfGhIjK');
    expect(parseSpreadsheetInput('fixture-template-a')).toBe('fixture-template-a');
  });

  it("UT-A1-07 ''、'hello'、'https://example.com/x' → INVALID_SPREADSHEET_URL", () => {
    for (const input of ['', 'hello', 'https://example.com/x']) {
      let err: unknown;
      try {
        parseSpreadsheetInput(input);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('INVALID_SPREADSHEET_URL');
    }
  });
});
