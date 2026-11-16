// 將任意丟出的值轉為 AppErrorView（api.ts 已丟出 AppErrorView；其餘視為 INTERNAL）
import type { AppErrorView } from './api';

export function toAppError(e: unknown): AppErrorView {
  if (typeof e === 'object' && e !== null
    && typeof (e as AppErrorView).code === 'string'
    && typeof (e as AppErrorView).message === 'string') {
    return { code: (e as AppErrorView).code, message: (e as AppErrorView).message };
  }
  return { code: 'INTERNAL', message: e instanceof Error ? e.message : String(e) };
}
