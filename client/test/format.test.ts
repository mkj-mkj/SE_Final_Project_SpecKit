import { describe, expect, it } from 'vitest';
import { formatAnswers, formatClock, formatTime } from '../src/format';

describe('format', () => {
  it('UT-UI-FMT-01 formatTime(0) 為 Asia/Taipei 的 08:00:00.000', () => {
    expect(formatTime(0)).toBe('08:00:00.000');
    expect(formatClock(0)).toBe('08:00:00');
  });

  it('UT-UI-FMT-02 formatAnswers 題組以「／」連接子題標籤與答案，單題直接回傳答案', () => {
    expect(formatAnswers(['CPU', '作業系統'], ['（1）', '（2）'])).toBe('（1）CPU／（2）作業系統');
    expect(formatAnswers(['0'], [''])).toBe('0');
  });
});
