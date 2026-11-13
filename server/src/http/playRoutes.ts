// 學生 API（TECH_SPEC §8.3，001 只有 GET /state）：需 member token
import { Router } from 'express';
import type { SessionService } from '../services/sessionService.js';
import { requireMember, wrap, type MemberLocals } from './auth.js';

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

  return r;
}
