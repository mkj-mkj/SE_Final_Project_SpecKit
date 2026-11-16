import { describe, expect, it } from 'vitest';
import { ERROR_CODES, MESSAGES } from '@quiz/shared';
import { messageOf } from '../src/messages';

describe('messages', () => {
  it('UT-UI-MSG-01 每個 ErrorCode 皆有中文訊息；未知碼回傳預設訊息', () => {
    for (const code of ERROR_CODES) {
      const msg = messageOf(code);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toMatch(/[一-鿿]/);
      expect(msg).toBe(MESSAGES[code]);
    }
    expect(messageOf('INTERNAL')).toBe('發生未預期錯誤，請重新整理');
    expect(messageOf('SOMETHING_ELSE')).toBe('發生未預期錯誤，請重新整理');
  });
});
