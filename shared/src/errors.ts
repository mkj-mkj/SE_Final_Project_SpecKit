// 錯誤碼、HTTP 對照與中文訊息（TECH_SPEC §11，訊息逐字照抄）

/** 全部錯誤碼（24 個）；以陣列保存，讓測試與前端可以逐一列舉 */
export const ERROR_CODES = [
  'UNAUTHORIZED',
  'INVALID_INPUT',
  'SESSION_NOT_FOUND',
  'TEAM_NOT_FOUND',
  'QUESTION_NOT_FOUND',
  'SUBMISSION_NOT_FOUND',
  'INVALID_PHASE',
  'INVALID_STATE',
  'NO_QUESTIONS',
  'HEADER_NOT_FOUND',
  'DUPLICATE_QUESTION_NUMBER',
  'INVALID_SPREADSHEET_URL',
  'SHEETS_PERMISSION_DENIED',
  'SHEETS_NOT_FOUND',
  'SHEETS_ERROR',
  'INVALID_NICKNAME',
  'NICKNAME_TAKEN',
  'TEAM_HAS_MEMBERS',
  'ANSWER_REQUIRED',
  'GROUP_INCOMPLETE',
  'ANSWER_TOO_LONG',
  'ALREADY_SUBMITTED',
  'WITHDRAW_WINDOW_EXPIRED',
  'NO_WINNER',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 422,
  SESSION_NOT_FOUND: 404,
  TEAM_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  SUBMISSION_NOT_FOUND: 404,
  INVALID_PHASE: 409,
  INVALID_STATE: 409,
  NO_QUESTIONS: 422,
  HEADER_NOT_FOUND: 422,
  DUPLICATE_QUESTION_NUMBER: 422,
  INVALID_SPREADSHEET_URL: 422,
  SHEETS_PERMISSION_DENIED: 403,
  SHEETS_NOT_FOUND: 404,
  SHEETS_ERROR: 502,
  INVALID_NICKNAME: 422,
  NICKNAME_TAKEN: 409,
  TEAM_HAS_MEMBERS: 409,
  ANSWER_REQUIRED: 422,
  GROUP_INCOMPLETE: 422,
  ANSWER_TOO_LONG: 422,
  ALREADY_SUBMITTED: 409,
  WITHDRAW_WINDOW_EXPIRED: 409,
  NO_WINNER: 409,
};

export const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: '驗證失敗，請重新登入或加入',
  INVALID_INPUT: '輸入格式不正確',
  SESSION_NOT_FOUND: '找不到此活動，請確認房間碼',
  TEAM_NOT_FOUND: '找不到此組別',
  QUESTION_NOT_FOUND: '找不到此題目',
  SUBMISSION_NOT_FOUND: '找不到此送出紀錄',
  INVALID_PHASE: '目前階段不能執行此動作',
  INVALID_STATE: '此送出目前不能執行此動作',
  NO_QUESTIONS: '沒有偵測到任何題目',
  HEADER_NOT_FOUND: '找不到「題號」與「作答」表頭，請確認 Guided Notes 格式',
  DUPLICATE_QUESTION_NUMBER: '題號重複',
  INVALID_SPREADSHEET_URL: '不是有效的 Google Sheets 網址',
  SHEETS_PERMISSION_DENIED: '沒有權限存取試算表，請將試算表共用給服務帳號',
  SHEETS_NOT_FOUND: '找不到試算表',
  SHEETS_ERROR: 'Google Sheets 發生錯誤，請稍後再試',
  INVALID_NICKNAME: '暱稱需為 1–20 個中文字、英文字母或數字',
  NICKNAME_TAKEN: '這個暱稱在組內已被使用',
  TEAM_HAS_MEMBERS: '要移除的組別已有成員',
  ANSWER_REQUIRED: '請填寫答案',
  GROUP_INCOMPLETE: '題組的每個子題都必須填寫',
  ANSWER_TOO_LONG: '答案不可超過 200 字',
  ALREADY_SUBMITTED: '本組已送出此題',
  WITHDRAW_WINDOW_EXPIRED: '已超過 10 秒撤回時限',
  NO_WINNER: '此題目前沒有得主',
};

/** 業務錯誤：code 決定 HTTP 狀態，message 預設為對應的中文訊息 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? MESSAGES[code]);
    this.name = 'AppError';
  }
}
