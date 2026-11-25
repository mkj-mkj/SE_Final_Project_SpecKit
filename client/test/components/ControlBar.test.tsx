import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Phase } from '@quiz/shared';
import ControlBar from '../../src/components/ControlBar';

const IDS = ['btn-start', 'btn-end', 'btn-reset'] as const;

function renderBar(phase: Phase) {
  const cb = { onStart: vi.fn(), onEnd: vi.fn(), onReset: vi.fn() };
  const utils = render(<ControlBar phase={phase} busy={false} {...cb} />);
  return { ...utils, cb };
}

describe('ControlBar', () => {
  it('UT-UI-CTRL-01 READY 只有 btn-start、RUNNING 只有 btn-end、ENDED 只有 btn-reset 可用；SETUP 全部停用；按下立即呼叫 callback', () => {
    const cases: [Phase, (typeof IDS)[number] | null][] = [
      ['READY', 'btn-start'], ['RUNNING', 'btn-end'], ['ENDED', 'btn-reset'], ['SETUP', null],
    ];
    for (const [phase, enabled] of cases) {
      const { unmount, cb } = renderBar(phase);
      for (const id of IDS) {
        if (id === enabled) expect(screen.getByTestId(id)).toBeEnabled();
        else expect(screen.getByTestId(id)).toBeDisabled();
      }
      if (enabled) {
        fireEvent.click(screen.getByTestId(enabled));
        const called = { 'btn-start': cb.onStart, 'btn-end': cb.onEnd, 'btn-reset': cb.onReset }[enabled];
        // 沒有確認步驟（research D1）：按一次即呼叫一次
        expect(called).toHaveBeenCalledTimes(1);
        for (const f of [cb.onStart, cb.onEnd, cb.onReset]) if (f !== called) expect(f).not.toHaveBeenCalled();
      }
      unmount();
    }
    expect(screen.queryByTestId('btn-start')).toBeNull();
  });
});
