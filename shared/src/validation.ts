// 暱稱、房間碼、答案的驗證（TECH_SPEC §11）。規則只寫在這裡，伺服器與前端共用。
import {
  MAX_ANSWER_LENGTH,
  MAX_NICKNAME_LENGTH,
  NICKNAME_PATTERN,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './constants.js';
import { AppError } from './errors.js';

/**
 * 暱稱正規化：去除前後空白後，長度須為 1–20 且只含中文字、英文字母、數字。
 * NICKNAME_PATTERN 只允許基本平面字元（不含代理對），因此 String.length 就等於字數；
 * 擴充 B 等代理對字元會被 pattern 擋下。
 */
export function normalizeNickname(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NICKNAME_LENGTH || !NICKNAME_PATTERN.test(trimmed)) {
    throw new AppError('INVALID_NICKNAME');
  }
  return trimmed;
}

/** 組內暱稱比對用的鍵：正規化後轉小寫（同組暱稱不分大小寫不可重複） */
export function nicknameKey(s: string): string {
  return normalizeNickname(s).toLowerCase();
}

/**
 * 房間碼正規化：去空白並轉大寫；須為 6 碼且每個字元都在 ROOM_CODE_ALPHABET（不含 I、O、0、1）。
 * 格式不符一律回報「找不到此活動」，不透露是格式錯誤還是活動不存在。
 */
export function normalizeRoomCode(s: string): string {
  const code = s.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH || ![...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))) {
    throw new AppError('SESSION_NOT_FOUND');
  }
  return code;
}

/**
 * 答案驗證（TECH_SPEC §7.9 submit 步驟 4–5）：
 * 1. 陣列長度必須等於子題數 → INVALID_INPUT
 * 2. trim 後任一為空 → 題組 GROUP_INCOMPLETE；單題 ANSWER_REQUIRED
 * 3. 任一超過 200 字 → ANSWER_TOO_LONG
 * 回傳 trim 後的答案陣列。
 */
export function validateAnswers(answers: string[], subCount: number, isGroup: boolean): string[] {
  if (answers.length !== subCount) {
    throw new AppError('INVALID_INPUT');
  }
  const trimmed = answers.map((a) => a.trim());
  if (trimmed.some((a) => a.length === 0)) {
    throw new AppError(isGroup ? 'GROUP_INCOMPLETE' : 'ANSWER_REQUIRED');
  }
  if (trimmed.some((a) => a.length > MAX_ANSWER_LENGTH)) {
    throw new AppError('ANSWER_TOO_LONG');
  }
  return trimmed;
}
