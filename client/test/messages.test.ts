import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ERROR_CODES, MESSAGES } from '@quiz/shared';
import { messageOf } from '../src/messages';
import ErrorBanner from '../src/components/ErrorBanner';

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

  it('UT-UI-MSG-01 ErrorBanner：DUPLICATE_QUESTION_NUMBER 顯示伺服器 message，其他錯誤碼顯示 messageOf(code)（§10.6 例外）', () => {
    const { unmount } = render(
      createElement(ErrorBanner, { error: { code: 'DUPLICATE_QUESTION_NUMBER', message: '題號重複：2' } }),
    );
    expect(screen.getByTestId('error-banner').textContent).toBe('題號重複：2');
    unmount();

    render(createElement(ErrorBanner, { error: { code: 'NO_QUESTIONS', message: 'server detail' } }));
    expect(screen.getByTestId('error-banner').textContent).toBe(messageOf('NO_QUESTIONS'));
  });
});
