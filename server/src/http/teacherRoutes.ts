// 老師 API（TECH_SPEC §8.1；001 範圍＋002 匯入＋003 開始、結束、重新開始＋004 判錯、寫回、還原、CSV）。只做 zod 驗證與轉換，業務規則在 SessionService。
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

  // 搶答控制（003）：按下即執行，沒有本文；回傳最新 TeacherView
  r.post(
    '/sessions/:id/start',
    wrap((req, res) => {
      res.status(200).json(service.start(String(req.params.id)));
    }),
  );

  r.post(
    '/sessions/:id/end',
    wrap((req, res) => {
      res.status(200).json(service.end(String(req.params.id)));
    }),
  );

  r.post(
    '/sessions/:id/reset',
    wrap((req, res) => {
      res.status(200).json(service.reset(String(req.params.id)));
    }),
  );

  // 結果與匯出（004）：判錯回傳最新 TeacherView；寫回、還原、CSV 的 Google Sheets 錯誤交給 errorHandler（403／404／502）
  r.post(
    '/sessions/:id/questions/:qid/reject-winner',
    wrap((req, res) => {
      res.status(200).json(service.rejectWinner(String(req.params.id), String(req.params.qid)));
    }),
  );

  r.post(
    '/sessions/:id/export',
    wrap(async (req, res) => {
      res.status(200).json(await service.exportToSheet(String(req.params.id)));
    }),
  );

  r.post(
    '/sessions/:id/restore',
    wrap(async (req, res) => {
      res.status(200).json(await service.restoreSheet(String(req.params.id)));
    }),
  );

  // 檔名含房間碼與輪次：results-<roomCode>-r<round>.csv
  r.get(
    '/sessions/:id/export.csv',
    wrap((req, res) => {
      const id = String(req.params.id);
      const csv = service.exportCsv(id);
      const { roomCode, round } = service.getTeacherView(id).session;
      res
        .status(200)
        .type('text/csv; charset=utf-8')
        .set('Content-Disposition', `attachment; filename="results-${roomCode}-r${round}.csv"`)
        .send(csv);
    }),
  );

  return r;
}
