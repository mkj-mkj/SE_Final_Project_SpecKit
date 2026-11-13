import { describe, expect, it } from 'vitest';
import { AppError, ERROR_CODES, HTTP_STATUS, MESSAGES, type ErrorCode } from '../src/index.js';

// TECH_SPEC §11 對照表：代碼 → [HTTP 狀態, 中文訊息]
const EXPECTED: Record<ErrorCode, [number, string]> = {
  UNAUTHORIZED: [401, '驗證失敗，請重新登入或加入'],
  INVALID_INPUT: [422, '輸入格式不正確'],
  SESSION_NOT_FOUND: [404, '找不到此活動，請確認房間碼'],
  TEAM_NOT_FOUND: [404, '找不到此組別'],
  QUESTION_NOT_FOUND: [404, '找不到此題目'],
  SUBMISSION_NOT_FOUND: [404, '找不到此送出紀錄'],
  INVALID_PHASE: [409, '目前階段不能執行此動作'],
  INVALID_STATE: [409, '此送出目前不能執行此動作'],
  NO_QUESTIONS: [422, '沒有偵測到任何題目'],
  HEADER_NOT_FOUND: [422, '找不到「題號」與「作答」表頭，請確認 Guided Notes 格式'],
  DUPLICATE_QUESTION_NUMBER: [422, '題號重複'],
  INVALID_SPREADSHEET_URL: [422, '不是有效的 Google Sheets 網址'],
  SHEETS_PERMISSION_DENIED: [403, '沒有權限存取試算表，請將試算表共用給服務帳號'],
  SHEETS_NOT_FOUND: [404, '找不到試算表'],
  SHEETS_ERROR: [502, 'Google Sheets 發生錯誤，請稍後再試'],
  INVALID_NICKNAME: [422, '暱稱需為 1–20 個中文字、英文字母或數字'],
  NICKNAME_TAKEN: [409, '這個暱稱在組內已被使用'],
  TEAM_HAS_MEMBERS: [409, '要移除的組別已有成員'],
  ANSWER_REQUIRED: [422, '請填寫答案'],
  GROUP_INCOMPLETE: [422, '題組的每個子題都必須填寫'],
  ANSWER_TOO_LONG: [422, '答案不可超過 200 字'],
  ALREADY_SUBMITTED: [409, '本組已送出此題'],
  WITHDRAW_WINDOW_EXPIRED: [409, '已超過 10 秒撤回時限'],
  NO_WINNER: [409, '此題目前沒有得主'],
};

describe('errors', () => {
  it('UT-ERR-01 每個 ErrorCode 都有 HTTP_STATUS 與非空 MESSAGES，且與 TECH_SPEC §11 一致', () => {
    const expectedCodes = Object.keys(EXPECTED).sort();
    expect([...ERROR_CODES].sort()).toEqual(expectedCodes);
    expect(Object.keys(HTTP_STATUS).sort()).toEqual(expectedCodes);
    expect(Object.keys(MESSAGES).sort()).toEqual(expectedCodes);
    for (const code of ERROR_CODES) {
      const [status, message] = EXPECTED[code];
      expect(HTTP_STATUS[code], code).toBe(status);
      expect(MESSAGES[code].length, code).toBeGreaterThan(0);
      expect(MESSAGES[code], code).toBe(message);
    }
  });

  it('UT-ERR-02 new AppError(code) 是 Error，帶 code 與預設中文訊息', () => {
    const err = new AppError('NO_WINNER');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('NO_WINNER');
    expect(err.message).toBe(MESSAGES.NO_WINNER);
  });
});
