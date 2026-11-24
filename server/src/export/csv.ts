// 結果 CSV（TECH_SPEC §7.5，PRD E2）。純函式，不讀資料庫、不依賴系統時區。
//
// 讓 Excel 直接開啟中文正常：開頭 UTF-8 BOM、換行 CRLF（最後一列後也有）。
// 每個欄位依序處理：
//   1. 防公式注入：開頭為 = + - @ 時前面加 '（避免 Excel 把學生答案當公式執行）；
//   2. RFC 4180 跳脫：含 , " \r \n 時以雙引號包住，內部 " 改為 ""。
// 先防公式再跳脫，因此 "=a,b" 會輸出為 "'=a,b"。
import type { SubmissionStatus } from '@quiz/shared';

export interface CsvRow {
  questionNumber: number;
  subNo: number;
  teamName: string;
  submittedBy: string;
  answer: string;
  serverTime: number;
  rank: number | null;
  status: SubmissionStatus;
  isWinner: boolean;
}

const BOM = '﻿';
const EOL = '\r\n';
const HEADER = '題號,子題,組別,送出者,答案,伺服器時間,順位,狀態,是否得主';
const TAIPEI_OFFSET_MS = 8 * 3600_000;

const STATUS_TEXT: Record<SubmissionStatus, string> = {
  active: '有效',
  withdrawn: '已撤回',
  rejected: '判錯',
};

/** 毫秒時間 → 台北時間 YYYY-MM-DDTHH:mm:ss.SSS+08:00（以 UTC 加 8 小時計算，與執行環境時區無關） */
function taipeiTime(ms: number): string {
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().replace('Z', '+08:00');
}

/** 單一欄位：先防公式注入，再依 RFC 4180 跳脫 */
function cell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildResultsCsv(rows: CsvRow[]): string {
  const lines = rows.map((r) =>
    [
      String(r.questionNumber),
      String(r.subNo),
      r.teamName,
      r.submittedBy,
      r.answer,
      taipeiTime(r.serverTime),
      r.rank === null ? '' : String(r.rank),
      STATUS_TEXT[r.status],
      r.isWinner ? '是' : '否',
    ]
      .map(cell)
      .join(','),
  );
  return BOM + [HEADER, ...lines].map((l) => l + EOL).join('');
}
