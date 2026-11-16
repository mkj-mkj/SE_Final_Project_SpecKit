import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMember,
  clearTeacher,
  loadMember,
  loadTeacher,
  saveMember,
  saveTeacher,
} from '../src/storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('UT-UI-STORE-01 save → load 取回相同內容', () => {
    const member = { token: 'm-token', roomCode: 'ABC234', memberId: 'mem-1' };
    saveMember(member);
    expect(loadMember()).toEqual(member);
    expect(JSON.parse(localStorage.getItem('quiz.member') ?? 'null')).toEqual(member);

    saveTeacher({ token: 't-token' });
    expect(loadTeacher()).toEqual({ token: 't-token' });
    expect(JSON.parse(sessionStorage.getItem('quiz.teacher') ?? 'null')).toEqual({ token: 't-token' });

    clearMember();
    clearTeacher();
    expect(loadMember()).toBeNull();
    expect(loadTeacher()).toBeNull();
  });

  it('UT-UI-STORE-02 localStorage 中為壞 JSON → load 回傳 null 且已清除', () => {
    localStorage.setItem('quiz.member', '{not json');
    expect(loadMember()).toBeNull();
    expect(localStorage.getItem('quiz.member')).toBeNull();

    sessionStorage.setItem('quiz.teacher', '{not json');
    expect(loadTeacher()).toBeNull();
    expect(sessionStorage.getItem('quiz.teacher')).toBeNull();
  });

  it('UT-UI-STORE-03 localStorage.getItem 丟例外 → 回傳 null，不丟例外', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => loadMember()).not.toThrow();
    expect(loadMember()).toBeNull();
    expect(loadTeacher()).toBeNull();
  });
});
