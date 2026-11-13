// 錯誤轉換（TECH_SPEC §11）：AppError → 對應狀態；zod／JSON 格式錯誤 → 422 INVALID_INPUT；其他 → 500
import { AppError, HTTP_STATUS, MESSAGES } from '@quiz/shared';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof AppError) {
    res.status(HTTP_STATUS[err.code]).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // zod 驗證失敗，或 express.json() 無法解析本文
  const isBodyParseError =
    typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';
  if (err instanceof ZodError || isBodyParseError) {
    res.status(HTTP_STATUS.INVALID_INPUT).json({ error: { code: 'INVALID_INPUT', message: MESSAGES.INVALID_INPUT } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: '發生未預期錯誤，請重新整理' } });
};
