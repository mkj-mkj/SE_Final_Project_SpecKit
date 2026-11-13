// UT-GW-01、UT-GW-03（TEST_SPEC §5.2）：Google 試算表閘道。以 mock client 取代 googleapis，不連網。
import { AppError } from '@quiz/shared';
import type { sheets_v4 } from 'googleapis';
import { describe, expect, it, vi } from 'vitest';
import { createGoogleGateway } from '../../src/sheets/googleGateway.js';

function mockClient(opts: { get?: () => Promise<unknown>; batchGet?: () => Promise<unknown> }) {
  const get = vi.fn(
    opts.get ??
      (async () => ({
        data: {
          sheets: [
            {
              properties: { sheetId: 0, title: '學習單' },
              merges: [{ sheetId: 0, startRowIndex: 4, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 2 }],
            },
          ],
        },
      })),
  );
  const batchGet = vi.fn(
    opts.batchGet ??
      (async () => ({
        data: {
          valueRanges: [
            {
              range: "'學習單'!B2:H16",
              values: [['標題'], [], ['題號', '', '', '', '', '作答']],
            },
          ],
        },
      })),
  );
  const client = { spreadsheets: { get, values: { batchGet } } } as unknown as sheets_v4.Sheets;
  return { client, get, batchGet };
}

describe('sheets/googleGateway', () => {
  it('UT-GW-01 batchGet 回傳 range B2:H16 → values 補齊為以 A1 為原點（第 0 列與第 0 欄為空）', async () => {
    const { client, batchGet } = mockClient({});
    const snap = await createGoogleGateway(client).fetchSnapshot('sheet-id-123');
    const sheet = snap.sheets[0]!;
    expect(snap.spreadsheetId).toBe('sheet-id-123');
    expect(sheet).toMatchObject({ sheetId: 0, title: '學習單' });
    expect(sheet.values[0]).toEqual([]);
    expect(sheet.values[1]).toEqual(['', '標題']);
    expect(sheet.values[3]).toEqual(['', '題號', '', '', '', '', '作答']);
    for (const row of sheet.values) expect(row[0] ?? '').toBe('');
    expect(sheet.merges).toHaveLength(1);
    expect(batchGet).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'sheet-id-123',
        ranges: ["'學習單'"],
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    );
  });

  it('UT-GW-03 API 丟出 403／404／500 → SHEETS_PERMISSION_DENIED／SHEETS_NOT_FOUND／SHEETS_ERROR', async () => {
    const cases = [
      [403, 'SHEETS_PERMISSION_DENIED'],
      [404, 'SHEETS_NOT_FOUND'],
      [500, 'SHEETS_ERROR'],
    ] as const;
    for (const [status, code] of cases) {
      const { client } = mockClient({
        get: async () => {
          throw Object.assign(new Error(`HTTP ${status}`), { code: status, response: { status } });
        },
      });
      const err = await createGoogleGateway(client)
        .fetchSnapshot('sheet-id-123')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(code);
    }
  });
});
