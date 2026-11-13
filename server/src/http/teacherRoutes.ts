// 老師 API（TECH_SPEC §8.1；001 範圍＋002 匯入）。只做 zod 驗證與轉換，業務規則在 SessionService。
import { AppError } from '@quiz/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/authService.js';
import type { SessionService } from '../services/sessionService.js';
import { requireTeacher, wrap } from './auth.js';

const loginBody = z.object({ password: z.string() });
const importBody = z.object({ spreadsheet: z.string() });
const settingsBody = z.object({
  teamCount: z.number().optional(),
  fairnessMode: z.enum(['speed', 'fair']).optional(),
  windowSec: z.number().optional(),
});

export function teacherRoutes(auth: AuthService, service: SessionService): Router {
  const r = Router();

  r.post(
    '/login',
    wrap((req, res) => {
      const { password } = loginBody.parse(req.body);
      res.status(200).json({ token: auth.login(password) });
    }),
  );

  // 以下皆需要 teacher token
  r.use(requireTeacher(auth));

  r.post(
    '/sessions',
    wrap((req, res) => {
      res.status(201).json(service.createSession(settingsBody.parse(req.body ?? {})));
    }),
  );

  r.get(
    '/sessions/current',
    wrap((_req, res) => {
      const view = service.getCurrentSession();
      if (!view) throw new AppError('SESSION_NOT_FOUND');
      res.status(200).json(view);
    }),
  );

  r.get(
    '/sessions/:id',
    wrap((req, res) => {
      res.status(200).json(service.getTeacherView(String(req.params.id)));
    }),
  );

  r.patch(
    '/sessions/:id/settings',
    wrap((req, res) => {
      res.status(200).json(service.updateSettings(String(req.params.id), settingsBody.parse(req.body ?? {})));
    }),
  );

  // 匯入 Guided Notes：回傳 { view, summary }；錯誤（含 Google Sheets 錯誤）交給 errorHandler
  r.post(
    '/sessions/:id/import',
    wrap(async (req, res) => {
      const { spreadsheet } = importBody.parse(req.body ?? {});
      res.status(200).json(await service.importSheet(String(req.params.id), spreadsheet));
    }),
  );

  return r;
}
