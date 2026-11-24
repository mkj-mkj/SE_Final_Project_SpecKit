// UT-GW-04、UT-GW-05（TEST_SPEC §5.2）：fake 模式的試算表閘道
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { createFakeGateway } from '../../src/sheets/fakeGateway.js';
import { loadSnapshot } from '../helpers/fixtures.js';

const FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/sheets', import.meta.url));

describe('sheets/fakeGateway', () => {
  it("UT-GW-04 fetchSnapshot('fixture-template-a') 與 fixture 相同；'nope'、'../x' → SHEETS_NOT_FOUND", async () => {
    const gw = createFakeGateway(FIXTURE_DIR);
    expect(await gw.fetchSnapshot('fixture-template-a')).toEqual(loadSnapshot('template-a'));
    for (const id of ['nope', '../x', 'fixture-../x', 'fixture-nope']) {
      const err = await gw.fetchSnapshot(id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('SHEETS_NOT_FOUND');
    }
  });

  it('UT-GW-05 writeCells 後 getSnapshot 可見、其他格不變；reset 後恢復；工作表不存在 → SHEETS_ERROR 且不套用；outDir 輸出 JSON', async () => {
    const gw = createFakeGateway(FIXTURE_DIR);
    const original = loadSnapshot('template-a');
    await gw.writeCells('fixture-template-a', [{ sheetTitle: '學習單', a1: 'G5', value: '（1）CPU' }]);
    const after = gw.getSnapshot('fixture-template-a');
    expect(after.sheets[0]!.values[4]![6]).toBe('（1）CPU');
    const expected = structuredClone(original);
    expected.sheets[0]!.values[4]![6] = '（1）CPU';
    expect(after).toEqual(expected);

    gw.reset('fixture-template-a');
    expect(gw.getSnapshot('fixture-template-a')).toEqual(original);

    // 任一筆不合法 → 全部不套用
    const err = await gw
      .writeCells('fixture-template-a', [
        { sheetTitle: '學習單', a1: 'G5', value: 'x' },
        { sheetTitle: '不存在', a1: 'G6', value: 'y' },
      ])
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('SHEETS_ERROR');
    expect(gw.getSnapshot('fixture-template-a')).toEqual(original);

    const outDir = mkdtempSync(join(tmpdir(), 'fake-sheets-'));
    try {
      const gwOut = createFakeGateway(FIXTURE_DIR, outDir);
      await gwOut.writeCells('fixture-template-a', [{ sheetTitle: '學習單', a1: 'G11', value: '0' }]);
      const file = join(outDir, 'fixture-template-a.json');
      expect(existsSync(file)).toBe(true);
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(gwOut.getSnapshot('fixture-template-a'));
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
