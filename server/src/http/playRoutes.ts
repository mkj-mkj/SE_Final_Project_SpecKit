// 學生 API（TECH_SPEC §8.3）：需 member token。001：GET /state；003：草稿、送出、撤回。
// 只做 zod 驗證與轉換，業務規則在 SessionService；不讀取任何客戶端時間（伺服器時間由 clock 決定）。
import { Router } from 'express';
import { z } from 'zod';
import type { SessionService } from '../services/sessionService.js';
import { requireMember, wrap, type MemberLocals } from './auth.js';

const draftBody = z.object({ answers: z.array(z.string()) });
const submitBody = z.object({ questionId: z.string(), answers: z.array(z.string()) });

export function playRoutes(service: SessionService): Router {
  const r = Router();
  r.use(requireMember(service));

  r.get(
    '/state',
    wrap((_req, res) => {
      const { member, memberToken } = res.locals as MemberLocals;
      res.status(200).json({ ...service.getTeamView(memberToken), me: { id: member.id, nickname: member.nickname } });
    }),
  );

  // 更新本組草稿（整題覆蓋）
  r.put(
    '/drafts/:questionId',
    wrap((req, res) => {
      const { memberToken } = res.locals as MemberLocals;
      const { answers } = draftBody.parse(req.body);
      service.updateDraft(memberToken, String(req.params.questionId), answers);
      res.status(204).end();
    }),
  );

  // 送出答案：回傳伺服器時間與可撤回期限
  r.post(
    '/submissions',
    wrap((req, res) => {
      const { memberToken } = res.locals as MemberLocals;
      const { questionId, answers } = submitBody.parse(req.body);
      res.status(201).json(service.submit(memberToken, questionId, answers));
    }),
  );

  // 撤回本組的送出
  r.post(
    '/submissions/:id/withdraw',
    wrap((req, res) => {
      const { memberToken } = res.locals as MemberLocals;
      service.withdraw(memberToken, String(req.params.id));
      res.status(204).end();
    }),
  );

  return r;
}
