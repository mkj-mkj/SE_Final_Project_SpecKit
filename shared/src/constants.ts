// 共用常數（TECH_SPEC §3.3，逐字照抄）
import type { FairnessMode } from './types.js';

export const DEFAULT_TEAM_COUNT = 6;
export const MIN_TEAM_COUNT = 2;
export const MAX_TEAM_COUNT = 20;
export const DEFAULT_FAIRNESS_MODE: FairnessMode = 'fair';
export const DEFAULT_WINDOW_SEC = 3;
export const MIN_WINDOW_SEC = 1;
export const MAX_WINDOW_SEC = 10;
export const WITHDRAW_LIMIT_MS = 10_000;
export const MAX_ANSWER_LENGTH = 200;
export const MAX_NICKNAME_LENGTH = 20;
export const NICKNAME_PATTERN = /^[\u3400-\u4DBF\u4E00-\u9FFFA-Za-z0-9]+$/; // 中文字（基本平面＋擴充 A）、英文字母、數字
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除 I O 0 1
export const DRAFT_DEBOUNCE_MS = 300;
