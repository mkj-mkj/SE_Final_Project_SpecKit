// 錯誤碼 → 中文訊息（TECH_SPEC §10.6）；來源為 @quiz/shared 的 MESSAGES
import { MESSAGES, type ErrorCode } from '@quiz/shared';

export const DEFAULT_MESSAGE = '發生未預期錯誤，請重新整理';

export function messageOf(code: string): string {
  return Object.prototype.hasOwnProperty.call(MESSAGES, code)
    ? MESSAGES[code as ErrorCode]
    : DEFAULT_MESSAGE;
}
