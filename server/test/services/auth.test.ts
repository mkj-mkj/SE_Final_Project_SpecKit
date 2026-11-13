import { AppError } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../src/services/authService.js';
import { SeqIdGen } from '../helpers/seqIdGen.js';

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof AppError ? e.code : 'NOT_APP_ERROR';
  }
}

describe('AuthService', () => {
  it('UT-AUTH-01 正確密碼回傳 token，verifyTeacher(token) 通過', () => {
    const auth = new AuthService('secret-pass', new SeqIdGen());
    const token = auth.login('secret-pass');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(codeOf(() => auth.verifyTeacher(token))).toBeNull();
  });

  it('UT-AUTH-02 錯誤密碼、長度不同的密碼 → UNAUTHORIZED', () => {
    const auth = new AuthService('secret-pass', new SeqIdGen());
    expect(codeOf(() => auth.login('secret-pasS'))).toBe('UNAUTHORIZED'); // 同長度
    expect(codeOf(() => auth.login('short'))).toBe('UNAUTHORIZED'); // 長度不同
    expect(codeOf(() => auth.login(''))).toBe('UNAUTHORIZED');
  });

  it('UT-AUTH-03 verifyTeacher(undefined)、未知 token → UNAUTHORIZED', () => {
    const auth = new AuthService('secret-pass', new SeqIdGen());
    expect(codeOf(() => auth.verifyTeacher(undefined))).toBe('UNAUTHORIZED');
    expect(codeOf(() => auth.verifyTeacher('tok_unknown'))).toBe('UNAUTHORIZED');
  });

  it('UT-AUTH-04 登入兩次，兩個不同 token 皆有效', () => {
    const auth = new AuthService('secret-pass', new SeqIdGen());
    const t1 = auth.login('secret-pass');
    const t2 = auth.login('secret-pass');
    expect(t1).not.toBe(t2);
    expect(codeOf(() => auth.verifyTeacher(t1))).toBeNull();
    expect(codeOf(() => auth.verifyTeacher(t2))).toBeNull();
  });
});
