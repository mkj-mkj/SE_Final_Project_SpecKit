// UT-GW-04（TEST_SPEC §5.2）：fake 模式的試算表閘道（UT-GW-05 的 writeCells 屬 004）
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
});
