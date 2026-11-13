// 開發用路由（TECH_SPEC §8.4）：只在 SHEETS_MODE=fake 時由 app.ts 掛載於 /api/dev。
// 供 E2E 檢查記憶體中的範例試算表與重設；錯誤（如 SHEETS_NOT_FOUND）交給 errorHandler。
import { Router } from 'express';
import type { createFakeGateway } from '../sheets/fakeGateway.js';
import { wrap } from './auth.js';

export function devRoutes(fake: ReturnType<typeof createFakeGateway>): Router {
  const r = Router();

  r.get(
    '/fake-sheets/:spreadsheetId',
    wrap((req, res) => {
      res.status(200).json(fake.getSnapshot(String(req.params.spreadsheetId)));
    }),
  );

  r.post(
    '/fake-sheets/:spreadsheetId/reset',
    wrap((req, res) => {
      fake.reset(String(req.params.spreadsheetId));
      res.status(204).end();
    }),
  );

  return r;
}
