// 公開 API（TECH_SPEC §8.2）：不需 token
import { Router } from 'express';
import { z } from 'zod';
import type { SessionService } from '../services/sessionService.js';
import { wrap } from './auth.js';

const joinBody = z.object({ teamId: z.string(), nickname: z.string() });

export function publicRoutes(service: SessionService): Router {
  const r = Router();

  r.get(
    '/sessions/:roomCode',
    wrap((req, res) => {
      res.status(200).json(service.getPublicInfo(String(req.params.roomCode)));
    }),
  );

  r.post(
    '/sessions/:roomCode/join',
    wrap((req, res) => {
      res.status(201).json(service.join(String(req.params.roomCode), joinBody.parse(req.body)));
    }),
  );

  return r;
}
