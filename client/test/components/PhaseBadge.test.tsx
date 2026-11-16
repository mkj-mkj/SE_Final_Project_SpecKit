import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Phase } from '@quiz/shared';
import PhaseBadge from '../../src/components/PhaseBadge';

describe('PhaseBadge', () => {
  it('UT-UI-PHASE-01 4 個階段依序顯示準備中／等待開始／搶答中／已結束', () => {
    const cases: [Phase, string][] = [
      ['SETUP', '準備中'], ['READY', '等待開始'], ['RUNNING', '搶答中'], ['ENDED', '已結束'],
    ];
    for (const [phase, text] of cases) {
      const { unmount } = render(<PhaseBadge phase={phase} />);
      expect(screen.getByTestId('phase-badge')).toHaveTextContent(text);
      unmount();
    }
  });
});
