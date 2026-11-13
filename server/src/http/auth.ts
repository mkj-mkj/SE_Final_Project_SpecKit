// HTTP 驗證中介層（research R-11）：只做 token 取出與轉換，驗證邏輯在 AuthService／SessionService
import { AppError, type Member } from '@quiz/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthService } from '../services/authService.js';
import type { SessionService } from '../services/sessionService.js';

/** 取出 `Authorization: Bearer <token>`；沒有時回傳 undefined */
export function bearerToken(req: Request): string | undefined {
  const header = req.get('authorization');
  const m = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return m?.[1];
}

/** 把同步或非同步 handler 的例外交給 next（Express 4 不會自動捕捉 Promise 例外） */
export function wrap(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    try {
      const r = fn(req, res, next);
      if (r instanceof Promise) r.catch(next);
    } catch (e) {
      next(e);
    }
  };
}

/** 老師 API：teacher token 無效 → 401 UNAUTHORIZED（學生 token 也會失敗） */
export function requireTeacher(auth: AuthService): RequestHandler {
  return wrap((req, _res, next) => {
    auth.verifyTeacher(bearerToken(req));
    next();
  });
}

export interface MemberLocals {
  member: Member & { sessionId: string };
  memberToken: string;
}

/** 學生 API：member token 無效 → 401 UNAUTHORIZED（老師 token 也會失敗）；成員存入 res.locals */
export function requireMember(service: SessionService): RequestHandler {
  return wrap((req, res, next) => {
    const token = bearerToken(req);
    if (!token) throw new AppError('UNAUTHORIZED');
    const locals = res.locals as Partial<MemberLocals>;
    locals.member = service.resolveMember(token);
    locals.memberToken = token;
    next();
  });
}
