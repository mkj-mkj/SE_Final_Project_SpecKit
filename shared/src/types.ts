// 共用型別（TECH_SPEC §4，欄位名稱為契約，不得更改）
export type { ErrorCode } from './errors.js';

// ---------- 列舉 ----------
export type Phase = 'SETUP' | 'READY' | 'RUNNING' | 'ENDED';
export type FairnessMode = 'speed' | 'fair';
export type SubmissionStatus = 'active' | 'withdrawn' | 'rejected';
export type QuestionState = 'open' | 'window' | 'settled';

// ---------- 試算表 ----------
export interface GridRange {            // 與 Google Sheets API 相同：0-based，end 不含
  sheetId: number;
  startRowIndex: number; endRowIndex: number;
  startColumnIndex: number; endColumnIndex: number;
}
export interface SheetData {
  sheetId: number;
  title: string;
  values: string[][];                   // 以 A1 為原點（values[0][0] = A1），缺格視為 ''
  merges: GridRange[];
}
export interface SheetSnapshot { spreadsheetId: string; sheets: SheetData[]; }

export interface ParsedSlot {
  subNo: number;                        // 單題為 1
  sheetTitle: string;
  row: number; col: number;             // 0-based
  a1: string;                           // 例：'G5'
  prefix: string;                       // 例：'（1）'；單題通常為 ''
  originalValue: string;                // 匯入時作答格原值
}
export interface ParsedQuestion { number: number; isGroup: boolean; slots: ParsedSlot[]; }
export type ParseWarningCode = 'NON_CONSECUTIVE_NUMBERS' | 'SUBNO_MISMATCH';
export interface ParseWarning { code: ParseWarningCode; message: string; questionNumber?: number; }
export interface ParseResult {
  sheetTitle: string; headerRow: number; numberCol: number; answerCol: number;
  questions: ParsedQuestion[];
  warnings: ParseWarning[];
}
export interface CellWrite { sheetTitle: string; a1: string; value: string; }

// ---------- 實體 ----------
export interface Session {
  id: string; roomCode: string; phase: Phase;
  spreadsheetId: string | null; sheetTitle: string | null;
  fairnessMode: FairnessMode; windowSec: number; teamCount: number;
  round: number;                        // 每次 reset +1，從 1 開始
  createdAt: number; startedAt: number | null; endedAt: number | null;
}
export interface Question {
  id: string; sessionId: string; number: number; isGroup: boolean; subCount: number;
  state: QuestionState; windowEndsAt: number | null;
}
export interface AnswerSlot {
  id: string; questionId: string; subNo: number;
  sheetTitle: string; row: number; col: number; a1: string; prefix: string; originalValue: string;
}
export interface Team { id: string; sessionId: string; index: number; name: string; } // name = `第 ${index} 組`
export interface Member {
  id: string; teamId: string; nickname: string; token: string; joinedAt: number; lastSeenAt: number;
}
export interface Draft {
  teamId: string; questionId: string; answers: string[]; updatedBy: string; updatedAt: number;
}
export interface Submission {
  id: string; sessionId: string; questionId: string; teamId: string; memberId: string;
  answers: string[];                    // 長度 = subCount，已 trim
  serverTime: number; seq: number;      // seq：全域遞增，同毫秒時決定先後
  status: SubmissionStatus;
  orderKey: number | null;              // 結算後的名次鍵；視窗中為 null
  withdrawnAt: number | null;
}

// ---------- 衍生值 ----------
export interface RankedSubmission extends Submission { rank: number; isWinner: boolean; }

// ---------- 給客戶端的視圖 ----------
export interface QuestionInfo { id: string; number: number; isGroup: boolean; subCount: number; subLabels: string[]; }
// subLabels：題組為 ['（1）','（2）']（取 prefix，沒有則 `（${subNo}）`）；單題為 ['']

export interface TeacherCell {
  questionId: string; teamId: string;
  submission: null | {
    id: string; answers: string[]; submittedBy: string; serverTime: number;
    status: SubmissionStatus; rank: number | null; isWinner: boolean;
  };
}
export interface TeacherView {
  session: Session;
  questions: (QuestionInfo & { state: QuestionState; windowEndsAt: number | null; winnerTeamId: string | null })[];
  teams: (Team & { score: number; members: { id: string; nickname: string; online: boolean }[] })[];
  cells: TeacherCell[];                 // 每題 × 每組一格；同組同題多筆時取最新一筆
  importSummary: ImportSummary | null;
  serverNow: number;
}
export interface ImportSummary {
  questionCount: number; groupCount: number; singleCount: number; subQuestionCount: number;
  warnings: ParseWarning[];
}

export interface TeamView {               // 只送到該組 room；絕不含他組資料
  session: { roomCode: string; phase: Phase; round: number };
  team: { id: string; name: string; members: { id: string; nickname: string; online: boolean }[] };
  questions: QuestionInfo[];
  drafts: Record<string, { answers: string[]; updatedBy: string; updatedAt: number }>; // key = questionId
  mySubmissions: Record<string, {     // key = questionId；只含本組最新一筆
    id: string; answers: string[]; submittedBy: string; serverTime: number;
    status: SubmissionStatus; withdrawableUntil: number | null; // status=active 時 = serverTime + 10000
  }>;
  results: Results | null;              // 只有 phase = ENDED 時非 null
  serverNow: number;
}
export interface Results {
  questions: {
    questionId: string; number: number; isGroup: boolean; subLabels: string[];
    winner: null | { teamId: string; teamName: string; answers: string[]; submittedBy: string };
    ranking: { rank: number; teamId: string; teamName: string; answers: string[];
               submittedBy: string; serverTime: number; status: 'active' | 'rejected'; isWinner: boolean }[];
  }[];
  scores: { teamId: string; teamName: string; score: number }[]; // 依分數降冪、組序升冪
}
export interface PublicSessionInfo {
  roomCode: string; phase: Phase; teams: { id: string; name: string; memberCount: number }[];
}
