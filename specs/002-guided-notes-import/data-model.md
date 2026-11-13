# Data Model：匯入 Guided Notes（002-guided-notes-import）

型別定義以 `docs/TECH_SPEC.md` v1.6 §4、§5、§7.8 為準（`shared/src/types.ts` 已由 001 建立，本子功能不改型別）；本文只說明本子功能的讀寫規則與對應關係。

## 1. 試算表快照（暫存，不入資料庫）

| 型別 | 欄位 | 規則 |
| --- | --- | --- |
| `SheetSnapshot` | `spreadsheetId`、`sheets: SheetData[]` | gateway 回傳；工作表順序即試算表順序 |
| `SheetData` | `sheetId`、`title`、`values: string[][]`、`merges: GridRange[]` | `values[0][0]`＝A1；缺格視為 `''` |
| `GridRange` | `sheetId`、`startRowIndex`、`endRowIndex`、`startColumnIndex`、`endColumnIndex` | 0-based、end 不含 |

## 2. 解析結果（`parseGuidedNotes` 輸出）

| 型別 | 欄位 | 規則 |
| --- | --- | --- |
| `ParseResult` | `sheetTitle`、`headerRow`、`numberCol`、`answerCol`、`questions`、`warnings` | `questions` 依題號升冪 |
| `ParsedQuestion` | `number`、`isGroup`、`slots` | 題組 slots ≥ 2；單題恰 1 |
| `ParsedSlot` | `subNo`、`sheetTitle`、`row`、`col`、`a1`、`prefix`、`originalValue` | `a1 = toA1(row, col)`；`col` 一律為 `answerCol` |
| `ParseWarning` | `code`、`message`、`questionNumber?` | `NON_CONSECUTIVE_NUMBERS`（無 questionNumber）、`SUBNO_MISMATCH`（含 questionNumber） |
| `ImportSummary` | `questionCount`、`groupCount`、`singleCount`、`subQuestionCount`、`warnings` | `subQuestionCount` 只計題組子題（範例 B 為 0） |

驗證規則（parser 丟出 `AppError`）：找不到表頭 → `HEADER_NOT_FOUND`；0 題 → `NO_QUESTIONS`；題號重複 → `DUPLICATE_QUESTION_NUMBER`（message 含題號）。

## 3. 保存的實體（資料庫）

### sessions（001 已建立；本子功能更新以下欄位）

| 欄位 | 寫入值 |
| --- | --- |
| `phase` | `READY` |
| `spreadsheet_id` | `parseSpreadsheetInput` 結果 |
| `sheet_title` | `ParseResult.sheetTitle` |
| `import_summary` | `JSON.stringify(ImportSummary)`；讀出時 parse，未匯入為 `null` |

### questions（`Question`）

| 欄位 | 來源 |
| --- | --- |
| `id` | `ids.id('q')` |
| `session_id` | 活動 id |
| `number` | `ParsedQuestion.number`（`UNIQUE(session_id, number)`） |
| `is_group` | `ParsedQuestion.isGroup ? 1 : 0` |
| `sub_count` | `slots.length` |
| `state` | `'open'` |
| `window_ends_at` | `null` |

### answer_slots（`AnswerSlot`）

| 欄位 | 來源 |
| --- | --- |
| `id` | `ids.id('slot')` |
| `question_id` | 所屬 Question.id |
| `sub_no`、`sheet_title`、`row`、`col`、`a1`、`prefix`、`original_value` | `ParsedSlot` 同名欄位 |

### 關聯與刪除

- `sessions 1 — * questions 1 — * answer_slots`；`questions 1 — * drafts`。
- 重新匯入：交易內 `DELETE FROM questions WHERE session_id = ?`，`answer_slots`、`drafts` 因 `ON DELETE CASCADE` 一併刪除（UT-SVC-IMPORT-02）。
- 匯入失敗時不進入交易，資料不變（FR-019）。

## 4. 新增的 repo 方法（`server/src/db/repo.ts`）

| 方法 | 說明 |
| --- | --- |
| `getImportSummary(sessionId): ImportSummary \| null` | 讀 `import_summary` 並 JSON.parse |
| `setImportSummary(sessionId, summary): void` | 寫 `import_summary` |
| `deleteQuestionsBySession(sessionId): void` | 刪除該活動全部題目（連帶作答格、草稿） |
| `insertQuestion(q: Question): void` | 新增題目 |
| `insertSlot(s: AnswerSlot): void` | 新增作答格 |
| `listQuestions(sessionId): Question[]` | 依 `number` 升冪 |
| `listSlotsBySession(sessionId): AnswerSlot[]` | 該活動全部作答格，依 `question_id`、`sub_no` |

`updateSession(s)`（001）已涵蓋 `phase`、`spreadsheet_id`、`sheet_title`。

## 5. 投影（`domain/projections.ts`）

| 輸出 | 規則 |
| --- | --- |
| `SessionAggregate.importSummary` | `repo.getImportSummary(sessionId)`（D9） |
| `questionInfo(q, slots)` | `subLabels`：題組取 `prefix`，空白時 `（${subNo}）`；單題 `['']` |
| `TeacherView.questions` | `questionInfo` ＋ `state`、`windowEndsAt`、`winnerTeamId: null`（003 補得主） |
| `TeacherView.importSummary` | `agg.importSummary` |
| `TeamView.questions` | 只含 `QuestionInfo`（不含 state、windowEndsAt，FR-10） |

## 6. 階段轉換

| 動作 | 允許階段 | 成功後 |
| --- | --- | --- |
| `import` | SETUP、READY（`domain/phase.ts` 已由 001 實作） | READY |
