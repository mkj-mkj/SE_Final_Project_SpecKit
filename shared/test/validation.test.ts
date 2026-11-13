import { describe, expect, it } from 'vitest';
import type { ErrorCode } from '../src/errors.js';
import { AppError } from '../src/errors.js';
import { nicknameKey, normalizeNickname, normalizeRoomCode, validateAnswers } from '../src/validation.js';

/** 斷言 fn 丟出指定錯誤碼的 AppError */
function expectCode(fn: () => unknown, code: ErrorCode): void {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught, `應丟出 ${code}`).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

describe('normalizeNickname / nicknameKey', () => {
  it('UT-VAL-01 去除前後空白', () => {
    expect(normalizeNickname(' 小明 ')).toBe('小明');
  });

  it('UT-VAL-02 空字串或全空白 → INVALID_NICKNAME', () => {
    expectCode(() => normalizeNickname(''), 'INVALID_NICKNAME');
    expectCode(() => normalizeNickname('   '), 'INVALID_NICKNAME');
  });

  it('UT-VAL-03 20 字通過、21 字 INVALID_NICKNAME', () => {
    const twenty = '小'.repeat(20);
    expect(normalizeNickname(twenty)).toBe(twenty);
    expectCode(() => normalizeNickname('小'.repeat(21)), 'INVALID_NICKNAME');
  });

  it('UT-VAL-04 nicknameKey 不分大小寫且去除空白', () => {
    expect(nicknameKey('Amy')).toBe(nicknameKey(' amy '));
  });

  it('UT-VAL-12 含空白、標點、emoji、全形英文、擴充 B 字元 → INVALID_NICKNAME', () => {
    for (const bad of ['小 明', 'Amy_01', '小明😀', 'ＡＢ', '𠀀']) {
      expectCode(() => normalizeNickname(bad), 'INVALID_NICKNAME');
    }
  });

  it('UT-VAL-13 中文字、英文字母、數字、擴充 A 字元皆通過並回傳原字串', () => {
    for (const ok of ['Amy01', '小明2', '㐀']) {
      expect(normalizeNickname(ok)).toBe(ok);
    }
  });
});

describe('normalizeRoomCode', () => {
  it('UT-VAL-05 去空白並轉大寫', () => {
    expect(normalizeRoomCode(' k7q2mx ')).toBe('K7Q2MX');
  });

  it('UT-VAL-06 位數不對或含易混淆字元 → SESSION_NOT_FOUND', () => {
    expectCode(() => normalizeRoomCode('K7Q2M'), 'SESSION_NOT_FOUND');
    expectCode(() => normalizeRoomCode('K7Q2M0'), 'SESSION_NOT_FOUND');
  });
});

describe('validateAnswers', () => {
  it('UT-VAL-07 回傳 trim 後的答案', () => {
    expect(validateAnswers([' CPU '], 1, false)).toEqual(['CPU']);
  });

  it('UT-VAL-08 陣列長度 ≠ subCount → INVALID_INPUT', () => {
    expectCode(() => validateAnswers(['A'], 2, true), 'INVALID_INPUT');
    expectCode(() => validateAnswers(['A', 'B'], 1, false), 'INVALID_INPUT');
  });

  it('UT-VAL-09 單題空白 → ANSWER_REQUIRED', () => {
    expectCode(() => validateAnswers(['  '], 1, false), 'ANSWER_REQUIRED');
  });

  it('UT-VAL-10 題組有子題空白 → GROUP_INCOMPLETE', () => {
    expectCode(() => validateAnswers(['CPU', ''], 2, true), 'GROUP_INCOMPLETE');
  });

  it('UT-VAL-11 200 字通過、201 字 ANSWER_TOO_LONG', () => {
    expect(validateAnswers(['a'.repeat(200)], 1, false)).toEqual(['a'.repeat(200)]);
    expectCode(() => validateAnswers(['a'.repeat(201)], 1, false), 'ANSWER_TOO_LONG');
  });
});
