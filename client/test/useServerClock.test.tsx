import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useServerClock } from '../src/hooks/useServerClock';

describe('useServerClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-UI-CLOCK-01 offset = serverNow - Date.now()，時間前進後仍維持相同 offset', () => {
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useServerClock(1_002_000));
    expect(Math.abs(result.current() - (Date.now() + 2000))).toBeLessThanOrEqual(5);
    vi.advanceTimersByTime(500);
    expect(Math.abs(result.current() - (Date.now() + 2000))).toBeLessThanOrEqual(5);
  });
});
