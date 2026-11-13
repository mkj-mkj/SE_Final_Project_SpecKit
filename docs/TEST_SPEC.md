# 測試與驗收規範（TEST_SPEC）：Vibe Coding 課堂搶答系統

| 項目 | 內容 |
| --- | --- |
| 版本 | v1.3（2026-11-13：同步 PRD v1.2／TECH_SPEC v1.4——匯入摘要文字、匯入進行中按鈕停用、題號 0 與前面補零、fake 模式匯入 < 2 秒、README 列出範例 ID；前版 v1.2：同步 PRD v1.1／TECH_SPEC v1.3——老師登出、系統只有一個活動、已加入學生開 /join 直接回 /play、暱稱字元限制、組別人數不設上限） |
| 依據 | `docs/PRD.md`、`docs/TECH_SPEC.md`（介面契約） |
| 讀者 | 測試 agent（主要）、實作 agent、助教 |

---

## 0. 給測試 agent 的規則（必讀）

1. **只寫測試，不改產品程式**：只能新增或修改 `*/test/**`、`e2e/**`、`docs/test-report.md`。發現產品程式錯誤時開立缺陷（§9），不得修改 `src/` 讓測試通過，也不得放寬斷言。
2. **以契約為準**：型別、函式簽名、API、事件、錯誤碼、`data-testid` 一律依 TECH_SPEC。實作與 TECH_SPEC 不一致時，判定為缺陷並在報告中指出條文編號。
3. **可重現**：unit 與 integration 測試不得依賴真實時間、亂數或網路；一律使用 §3 的測試替身。E2E 一律 `SHEETS_MODE=fake`。
4. **每個測試案例 ID 必須出現在測試名稱中**，例如 `it('UT-PARSE-01 範例 A 完整解析', …)`，以便追溯（§10）。
5. 規格不明確時，在報告「待釐清」記錄問題與你採用的假設，不要自行發明行為。
6. 每次執行完整測試後更新 `docs/test-report.md`（範本見 §9.3）。

---

## 1. 測試層級

| 層級 | 對象 | 工具 | 位置 | 數量要求 |
| --- | --- | --- | --- | --- |
| Unit（UT） | 每個模組的每個公開函式／元件 | Vitest、@testing-library/react | `shared/test`、`server/test`、`client/test` | 本文 §5 全部案例 |
| Integration（IT） | HTTP + Socket + DB 串接 | Vitest、supertest、socket.io-client | `server/test/integration` | §6 全部案例 |
| End-to-end（E2E） | 多瀏覽器分頁的真實操作 | Playwright（`channel: 'msedge'`，使用系統已簽章的 Edge，不下載 Playwright 瀏覽器） | `e2e/tests` | §7 全部案例 |
| 手動驗收（MA） | 真實 Google Sheets、Demo、文件一致性 | 人工 + 截圖 | `docs/manual-test.md` | §8.2 全部項目 |

**每個功能都必須有 unit test**：§10 追溯矩陣中，每個 FR／E 至少對應 1 個 UT 與 1 個 IT 或 E2E。

---

## 2. 目錄、命名與執行

### 2.1 目錄

```
shared/test/validation.test.ts  errors.test.ts
server/test/
├─ helpers/  fakeClock.ts  manualScheduler.ts  seqIdGen.ts  inMemorySheets.ts
│            recordingBroadcaster.ts  fixtures.ts  makeTestService.ts  seed.ts  fakeIo.ts
├─ sheets/   a1.test.ts  parser.test.ts  exporter.test.ts  googleGateway.test.ts  fakeGateway.test.ts
├─ export/   csv.test.ts
├─ domain/   phase.test.ts  ranking.test.ts  settlement.test.ts  projections.test.ts
├─ db/       repo.test.ts
├─ services/ auth.test.ts  session.create.test.ts  session.import.test.ts  session.phase.test.ts
│            session.join.test.ts  session.draft.test.ts  session.submit.test.ts  session.fair.test.ts
│            session.withdraw.test.ts  session.reject.test.ts  session.export.test.ts  session.recover.test.ts
├─ realtime/ broadcaster.test.ts
└─ integration/ *.it.test.ts
client/test/  storage.test.ts  format.test.ts  messages.test.ts  useServerClock.test.ts
              components/*.test.tsx  pages/*.test.tsx
e2e/tests/    *.spec.ts
```

### 2.2 指令

| 指令 | 內容 |
| --- | --- |
| `npm test` | 全部 UT + IT |
| `npm run test:coverage` | 同上 + 覆蓋率門檻檢查 |
| `npm run test:e2e` | 啟動 `SHEETS_MODE=fake`、`DB_PATH=:memory:` 的 server（port 3100）並執行 Playwright |

### 2.3 覆蓋率門檻（vitest `coverage.thresholds`，未達即失敗）

| 範圍 | Lines | Branches |
| --- | --- | --- |
| `server/src/domain/**`、`server/src/sheets/parser.ts`、`server/src/sheets/exporter.ts`、`server/src/export/**` | ≥ 95% | ≥ 90% |
| `server/src/services/**` | ≥ 90% | ≥ 85% |
| `shared/src/**` | ≥ 90% | ≥ 85% |
| 全專案 | ≥ 80% | ≥ 75% |

`server/src/index.ts`、`googleGateway.ts` 的實際網路呼叫部分可排除，但需在報告中列出排除清單。

---

## 3. 測試替身（`server/test/helpers`）

```ts
// fakeClock.ts
export class FakeClock implements Clock {
  constructor(start = 1_700_000_000_000);
  now(): number; set(t: number): void; advance(ms: number): void;
}

// manualScheduler.ts —— 依 (at 升冪, 排程先後) 觸發
export class ManualScheduler implements Scheduler {
  constructor(clock: FakeClock);
  schedule(key: string, at: number, fn: () => void): void;   // 同 key 取代
  cancel(key: string): void; cancelAll(): void;
  pending(): { key: string; at: number }[];
  advanceTo(t: number): void;   // 依序把 clock 設為每個到期的 at 並執行，最後 clock = t
  advance(ms: number): void;    // advanceTo(clock.now() + ms)
}

// seqIdGen.ts
export class SeqIdGen implements IdGen {
  constructor(roomCodes?: string[]);       // 預設依序 'AAAAA2','AAAAA3',…
  id(prefix): string;                      // `${prefix}_${n}`
  token(): string;                         // `tok_${n}`
  roomCode(): string;
}

// inMemorySheets.ts
export class InMemorySheetsGateway implements SheetsGateway {
  constructor(snapshots: Record<string, SheetSnapshot>);
  writes: { spreadsheetId: string; writes: CellWrite[] }[];  // 每次 writeCells 的紀錄
  failNext(code: ErrorCode): void;                            // 下一次呼叫丟出 AppError(code)
  current(id: string): SheetSnapshot;
}

// recordingBroadcaster.ts
export class RecordingBroadcaster implements Broadcaster { calls: { sessionId: string; scope?: PublishScope }[]; }

// fixtures.ts —— 只讀取 fixtures/sheets 並產生變形版本（不寫檔）
export function loadSnapshot(name: 'template-a' | 'template-b'): SheetSnapshot;   // 深拷貝
export function loadExpected(name: 'template-a' | 'template-b'): ParseResult;
export function shiftGrid(s: SheetSnapshot, rows: number, cols: number): SheetSnapshot; // values 與 merges 一起位移
export function removeMerges(s: SheetSnapshot): SheetSnapshot;
export function setCell(s: SheetSnapshot, a1: string, value: string, sheetIndex = 0): SheetSnapshot;
export function prependSheet(s: SheetSnapshot, sheet: SheetData): SheetSnapshot;

// makeTestService.ts
export function makeTestService(opts?: { snapshots?: Record<string, SheetSnapshot>; roomCodes?: string[] }): {
  service: SessionService; repo: Repo; clock: FakeClock; scheduler: ManualScheduler;
  ids: SeqIdGen; gateway: InMemorySheetsGateway; broadcaster: RecordingBroadcaster;
};   // DB = ':memory:'；預設 snapshots = { 'fixture-template-a': A, 'fixture-template-b': B }

// seed.ts
export function seedRunning(t: ReturnType<typeof makeTestService>, opts?: {
  fixture?: 'template-a' | 'template-b'; teams?: number; membersPerTeam?: number;
  mode?: 'speed' | 'fair'; windowSec?: number;
}): Promise<{
  sessionId: string; teamIds: string[];
  tokens: string[][];                 // tokens[teamIndex-1][memberIndex]
  q: Record<number, string>;          // 題號 → questionId
}>;  // 預設 template-a、3 組、每組 2 人、speed；完成後 phase = RUNNING
```

答案常數（測試共用）：第 1 題 `['CPU','作業系統']`、第 2 題 `['演算法','堆疊']`、第 3 題 `['0']`、第 4 題 `['IP']`。

---

## 4. Fixtures

| 檔案 | 用途 |
| --- | --- |
| `fixtures/sheets/template-a.xlsx` / `.snapshot.json` | 範例 A：4 題，第 1、2 題為題組（各 2 子題），第 3、4 題單題 |
| `fixtures/sheets/template-a.expected.json` | 範例 A 的 `ParseResult` 期望值 |
| `fixtures/sheets/template-b.xlsx` / `.snapshot.json` | 範例 B：6 題單題，題目間有合併空白列 |
| `fixtures/sheets/template-b.expected.json` | 範例 B 的 `ParseResult` 期望值 |

範例 A 期望作答格：第 1 題 G5「（1）」、G6「（2）」；第 2 題 G8「（1）」、G9「（2）」；第 3 題 G11；第 4 題 G13。
範例 B 期望作答格：G5、G7、G9、G11、G13、G15（皆無前綴）。

---

## 5. Unit test 案例

格式：ID｜情境｜期望。所有「→ 錯誤碼」皆指 `throw AppError` 且 `code` 相符。

### 5.1 shared

**UT-VAL（`validation.ts`）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-VAL-01 | `normalizeNickname(' 小明 ')` | `'小明'` |
| UT-VAL-02 | `''`、`'   '` | INVALID_NICKNAME |
| UT-VAL-03 | 20 字、21 字 | 20 字通過；21 字 INVALID_NICKNAME |
| UT-VAL-04 | `nicknameKey('Amy')` vs `nicknameKey(' amy ')` | 相等 |
| UT-VAL-05 | `normalizeRoomCode(' k7q2mx ')` | `'K7Q2MX'` |
| UT-VAL-06 | `'K7Q2M'`（5 碼）、`'K7Q2M0'`（含 0） | SESSION_NOT_FOUND |
| UT-VAL-07 | `validateAnswers([' CPU '], 1, false)` | `['CPU']` |
| UT-VAL-08 | 陣列長度 ≠ subCount | INVALID_INPUT |
| UT-VAL-09 | 單題空白 `['  ']` | ANSWER_REQUIRED |
| UT-VAL-10 | 題組 `['CPU','']` | GROUP_INCOMPLETE |
| UT-VAL-11 | 200 字、201 字 | 200 通過；201 ANSWER_TOO_LONG |
| UT-VAL-12 | `normalizeNickname`：`'小 明'`、`'Amy_01'`、`'小明😀'`、`'ＡＢ'`（全形）、`'𠀀'`（擴充 B） | 皆 INVALID_NICKNAME |
| UT-VAL-13 | `normalizeNickname`：`'Amy01'`、`'小明2'`、`'㐀'`（擴充 A） | 皆通過，回傳原字串 |

**UT-ERR（`errors.ts`）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-ERR-01 | 列舉所有 ErrorCode | 每個都有 `HTTP_STATUS` 與非空 `MESSAGES`，且狀態與 TECH_SPEC §11 表一致 |
| UT-ERR-02 | `new AppError('NO_WINNER')` | `instanceof Error`、`code==='NO_WINNER'`、`message===MESSAGES.NO_WINNER` |

### 5.2 sheets

**UT-A1（`a1.ts`）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-A1-01 | `colToLetters` 0、6、25、26、701、702 | A、G、Z、AA、ZZ、AAA |
| UT-A1-02 | `toA1(4,6)`、`toA1(0,0)` | G5、A1 |
| UT-A1-03 | `quoteSheet('學習單')`、`quoteSheet("It's")` | `'學習單'`、`'It''s'` |
| UT-A1-04 | `rangeA1('學習單','G5')` | `'學習單'!G5` |
| UT-A1-05 | `parseSpreadsheetInput('https://docs.google.com/spreadsheets/d/1AbC_d-EfGhIjK/edit#gid=0')` | `1AbC_d-EfGhIjK` |
| UT-A1-06 | `'1AbC_d-EfGhIjK'`、`'fixture-template-a'` | 原樣回傳 |
| UT-A1-07 | `''`、`'hello'`、`'https://example.com/x'` | INVALID_SPREADSHEET_URL |

**UT-PARSE（`parser.ts`，FR-01／FR-02／FR-06／E1）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-PARSE-01 | 範例 A snapshot | 與 `template-a.expected.json` 深度相等（含 `warnings: []`） |
| UT-PARSE-02 | 範例 B snapshot | 與 `template-b.expected.json` 深度相等 |
| UT-PARSE-03 | `summarize`（範例 A） | `{questionCount:4, groupCount:2, singleCount:2, subQuestionCount:4, warnings:[]}` |
| UT-PARSE-04 | `summarize`（範例 B） | `{6, 0, 6, 0}` |
| UT-PARSE-05 | 範例 A `shiftGrid(+2 列, +1 欄)` | 題目結構相同；作答格變為 H7、H8、H10、H11、H13、H15（證明無寫死位置） |
| UT-PARSE-06 | 在範例 A 前插入無表頭的工作表「說明」 | `sheetTitle==='學習單'`，結果同 01 |
| UT-PARSE-07 | 把 B4「題號」改為「編號」 | HEADER_NOT_FOUND |
| UT-PARSE-08 | 範例 B 清空所有題號 | NO_QUESTIONS |
| UT-PARSE-09 | 範例 B 的 B9 由「3」改為「2」 | DUPLICATE_QUESTION_NUMBER，message 含「2」 |
| UT-PARSE-10 | 範例 B 清空 B11（第 4 題） | 5 題（1,2,3,5,6）、含 1 個 `NON_CONSECUTIVE_NUMBERS` 警告 |
| UT-PARSE-11 | 題號為 `'1.0'`、`' 2 '`；另有 `'1a'`、`'一'` | 前兩者解析為 1、2；後兩者略過 |
| UT-PARSE-12 | 範例 A `removeMerges` | 後備規則仍判定第 1、2 題為題組，結果同 01 |
| UT-PARSE-13 | 範例 A 的 G5、G6 改為半形 `(1)`、`(2)` | `prefix==='(1)'`、`subNo===1` |
| UT-PARSE-14 | 範例 A 清空 G5、G6 | 第 1 題仍為題組（merge），subNo 1、2，prefix `''` |
| UT-PARSE-15 | 範例 A 的 G5、G6 改為「（2）」「（1）」 | `SUBNO_MISMATCH` 警告；subNo 重編為 1、2 |
| UT-PARSE-16 | 範例 A 的 originalValue | G5 `'（1）'`、G11 `''` |
| UT-PARSE-17 | values 某列長度不足（短於 answerCol） | 不丟例外；originalValue `''` |
| UT-PARSE-18 | 表頭含空白 `' 題號 '`、`'作答 '` | 正常辨識 |
| UT-PARSE-19 | 調換兩題在表中的順序（第 2 題在第 1 題上方） | 回傳依題號升冪 |
| UT-PARSE-20 | 只水平合併、不跨列的題號格（rowspan=1） | 視為單題 |
| UT-PARSE-21 | 範例 B 的 B5 由「1」改為「0」 | 6 題（題號 0、2～6）；含 1 個 `NON_CONSECUTIVE_NUMBERS` 警告；第 0 題作答格為 G5 |
| UT-PARSE-22 | 範例 B 的題號改為 `'01'`、`'002'`、`'03.0'`（其餘不變） | 解析為 1、2、3；結果與 UT-PARSE-02 相同 |

**UT-EXP（`exporter.ts`，FR-06）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-EXP-01 | 範例 A slots；第 1 題得主 `['CPU','作業系統']`、第 3 題得主 `['0']` | 寫入恰為 G5 `（1）CPU`、G6 `（2）作業系統`、G11 `0`，順序依列 |
| UT-EXP-02 | 沒有任何得主 | `[]` |
| UT-EXP-03 | 單題 prefix 為 `''` | value 等於答案本身 |
| UT-EXP-04 | `buildRestoreWrites` | 每個 slot 一筆，value = originalValue |

**UT-GW（gateway）**

`googleGateway` 必須以 `createGoogleGateway(client)` 注入 `sheets_v4.Sheets`；測試以 mock 物件取代。

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-GW-01 | batchGet 回傳 `range: "'學習單'!B2:H16"` | values 補齊為以 A1 為原點（第 0 列與第 0 欄為空） |
| UT-GW-02 | `writeCells` | 呼叫 `values.batchUpdate`，`valueInputOption:'RAW'`，range 為 `'學習單'!G5` 格式 |
| UT-GW-03 | API 丟出 403／404／500 | SHEETS_PERMISSION_DENIED／SHEETS_NOT_FOUND／SHEETS_ERROR |
| UT-GW-04 | fake：`fetchSnapshot('fixture-template-a')` | 與 fixture 相同；`'nope'`、`'../x'` → SHEETS_NOT_FOUND |
| UT-GW-05 | fake：`writeCells` 後 `getSnapshot`、再 reset | 寫入可見；reset 後恢復原值 |

### 5.3 export

**UT-CSV（`csv.ts`，E2）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-CSV-01 | 空列 | 恰為 `﻿題號,子題,組別,送出者,答案,伺服器時間,順位,狀態,是否得主\r\n` |
| UT-CSV-02 | 兩列 | 每列以 `\r\n` 結尾 |
| UT-CSV-03 | 答案含 `,`、`"`、換行 | 以雙引號包住，`"` 變 `""` |
| UT-CSV-04 | 答案為 `=1+1`、`+5`、`-3`、`@x` | 輸出 `'=1+1` 等 |
| UT-CSV-05 | serverTime = 0 | `1970-01-01T08:00:00.000+08:00` |
| UT-CSV-06 | status 三種、isWinner、rank null | `有效／已撤回／判錯`、`是／否`、空字串 |
| UT-CSV-07 | 打亂順序輸入（經 `buildCsvRows`） | 題號 → 順位（null 最後）→ 子題 排序 |

### 5.4 domain

**UT-PHASE（`phase.ts`，FR-03／FR-07）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-PHASE-01 | 對 TECH_SPEC §6 表中 13 個動作 × 4 個階段逐一呼叫 `assertPhase` | 表內允許者不丟例外，其餘 INVALID_PHASE（共 52 個斷言，用 `it.each`） |
| UT-PHASE-02 | `nextPhase` | SETUP+import→READY、READY+import→READY、READY+start→RUNNING、RUNNING+end→ENDED、ENDED+reset→READY |
| UT-PHASE-03 | `nextPhase('SETUP','start')` 等非法組合 | INVALID_PHASE |

**UT-RANK（`ranking.ts`，FR-05／FR-11／E4／E5）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-RANK-01 | orderKey [2, null, 1] | 排序為 1、2、null |
| UT-RANK-02 | orderKey 皆 null，serverTime 不同 | 依 serverTime |
| UT-RANK-03 | serverTime 相同、seq 不同 | 依 seq |
| UT-RANK-04 | 含 withdrawn | 不出現在結果，rank 連續 1..n |
| UT-RANK-05 | 第一名 rejected | 第二名 `isWinner=true`；rejected 仍有 rank 1 |
| UT-RANK-06 | 全部 orderKey 為 null（視窗中） | `winnerOf` 為 null |
| UT-RANK-07 | 全部 rejected 或 withdrawn | `winnerOf` 為 null |
| UT-RANK-08 | `teamScores`：A 贏 2 題、B 贏 1 題、C 無 | A=2、B=1、C=0 |
| UT-RANK-09 | `teamScores`：A 的得主被 rejected、B 遞補 | A=0、B=1 |

**UT-SETTLE（`settlement.ts`，E3）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SETTLE-01 | 分數 A=2、B=0；A 較早送出 | B 在前 |
| UT-SETTLE-02 | 同分 | 早送出者在前 |
| UT-SETTLE-03 | 同分同時間 | seq 小者在前 |
| UT-SETTLE-04 | scores 中沒有某組 | 視為 0 |
| UT-SETTLE-05 | `assignOrderKeys(sorted, 3)` | 3、4、5 |
| UT-SETTLE-06 | `nextOrderKey([])`、orderKey [1,2,null] | 1、3 |

**UT-PROJ（`projections.ts`，FR-04／FR-05／FR-09／FR-10）**

測試資料：2 組（A、B），B 的暱稱為 `SECRETNICKB`（v1.2 修改：原為 `SECRET-NICK-B`，含 `-` 不符暱稱字元限制）、草稿與答案為 `SECRET-ANS-B`。

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-PROJ-01 | `questionInfo`：題組有前綴、題組無前綴、單題 | `['（1）','（2）']`、`['（1）','（2）']`、`['']` |
| UT-PROJ-02 | `projectTeacherView`（2 題 × 2 組） | `cells.length===4`；winnerTeamId 正確；包含 B 的答案 |
| UT-PROJ-03 | 同組同題有 withdrawn 後再 active | cell 取 seq 最大的一筆 |
| UT-PROJ-04 | RUNNING 中 `projectTeamView(agg, A)` | `JSON.stringify` 不含 `SECRETNICKB`、`SECRET-ANS-B`、B 的 member id、B 的 submission id（v1.2 修改：暱稱字串更新） |
| UT-PROJ-05 | RUNNING 中 TeamView 遞迴掃描所有 key | 不存在 `rank`、`isWinner`、`score`、`scores`、`state`、`windowEndsAt`、`winnerTeamId`；`results===null` |
| UT-PROJ-06 | ENDED 中 TeamView | `results` 非 null，含所有組的 ranking 與 scores |
| UT-PROJ-07 | active 送出 serverTime=T | `withdrawableUntil===T+10000`；withdrawn → null |
| UT-PROJ-08 | `buildResults`：得主被判錯 | winner 為遞補者；ranking 含 rejected、不含 withdrawn；scores 依分數降冪、組序升冪 |
| UT-PROJ-09 | `buildCsvRows`：題組送出 | 每個子題一列 |
| UT-PROJ-10 | onlineMemberIds 只有 A1 | TeacherView 中 A1 online=true，其他 false |

### 5.5 db

**UT-REPO（`repo.ts`）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-REPO-01 | 建立並讀回 session | 欄位值相同（`toEqual`；node:sqlite 回傳 null-prototype 物件） |
| UT-REPO-02 | answers 含中文、逗號、換行 | JSON 往返相同 |
| UT-REPO-03 | 同組同題插入第二筆 active | 違反唯一索引（repo 轉成 ALREADY_SUBMITTED） |
| UT-REPO-04 | 同組同題：withdrawn + active | 允許 |
| UT-REPO-05 | 刪除 session | questions、teams、members、submissions 連帶刪除 |
| UT-REPO-06 | 連續取 seq | 嚴格遞增 |
| UT-REPO-07 | `withTransaction` 中途丟出例外 | 交易內所有寫入都被回復，例外原樣丟出 |

### 5.6 services

**UT-AUTH**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-AUTH-01 | 正確密碼 | 回傳 token；`verifyTeacher(token)` 通過 |
| UT-AUTH-02 | 錯誤密碼、長度不同的密碼 | UNAUTHORIZED |
| UT-AUTH-03 | `verifyTeacher(undefined)`、未知 token | UNAUTHORIZED |
| UT-AUTH-04 | 登入兩次 | 兩個不同 token 皆有效 |

**UT-SVC-CREATE（createSession、updateSettings）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-CREATE-01 | `createSession({})` | phase SETUP、round 1、6 組「第 1 組」…「第 6 組」、fairnessMode `'fair'`、windowSec 3 |
| UT-SVC-CREATE-02 | roomCodes 依序回傳 `AAAAA2`、`AAAAA2`、`AAAAA3`，建兩個活動 | 第二個活動 roomCode 為 `AAAAA3` |
| UT-SVC-CREATE-03 | teamCount 1、21；windowSec 0、11 | INVALID_INPUT |
| UT-SVC-CREATE-04 | 6 → 8 組 | 新增第 7、8 組 |
| UT-SVC-CREATE-05 | 6 → 4 組，第 5 組有成員 | TEAM_HAS_MEMBERS；無成員時成功 |
| UT-SVC-CREATE-06 | RUNNING 中 updateSettings | INVALID_PHASE |
| UT-SVC-CREATE-07 | 成功操作後 | broadcaster 記錄一次 publish（預設 scope） |

**UT-SVC-IMPORT（FR-01）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-IMPORT-01 | 匯入 `fixture-template-a` | phase READY；4 題、6 個 slot；summary 同 UT-PARSE-03；spreadsheetId 已存 |
| UT-SVC-IMPORT-02 | READY 中再匯入 `fixture-template-b` | 6 題；舊題目、slot、草稿全部刪除 |
| UT-SVC-IMPORT-03 | RUNNING 中匯入 | INVALID_PHASE |
| UT-SVC-IMPORT-04 | gateway `failNext('SHEETS_PERMISSION_DENIED')` | 丟出該錯誤；phase 與題目不變 |
| UT-SVC-IMPORT-05 | 輸入 `'hello'` | INVALID_SPREADSHEET_URL；gateway 未被呼叫 |
| UT-SVC-IMPORT-06 | 無表頭 snapshot | HEADER_NOT_FOUND；phase 仍為 SETUP |

**UT-SVC-PHASE（FR-03／FR-12）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-PHASE-01 | SETUP 中 start | INVALID_PHASE |
| UT-SVC-PHASE-02 | READY 中 start | RUNNING；startedAt = clock.now()；所有題目 state open；publish |
| UT-SVC-PHASE-03 | fair 模式第 3 題視窗中，clock+1s 時 end | 先結算（有得主）；`scheduler.pending()` 為空；ENDED；endedAt 正確 |
| UT-SVC-PHASE-04 | READY 中 end | INVALID_PHASE |
| UT-SVC-PHASE-05 | ENDED 後 reset | READY；round 2；送出與草稿清空；成員與題目保留；題目 state open |

**UT-SVC-JOIN（E7）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-JOIN-01 | 正常加入 | 回傳 token；`getPublicInfo` 該組 memberCount 1 |
| UT-SVC-JOIN-02 | roomCode 小寫 | 可加入 |
| UT-SVC-JOIN-03 | 不存在的房間碼 | SESSION_NOT_FOUND |
| UT-SVC-JOIN-04 | teamId 屬於別的活動 | TEAM_NOT_FOUND |
| UT-SVC-JOIN-05 | 同組 `Amy` 後再 `amy` | NICKNAME_TAKEN；其他組可用 `amy` |
| UT-SVC-JOIN-06 | `resolveMember('bad')` | UNAUTHORIZED |
| UT-SVC-JOIN-07 | RUNNING、ENDED 中加入 | 成功 |
| UT-SVC-JOIN-08 | 用原 token 再次 `getTeamView` | 回到同一組，資料一致（重連） |
| UT-SVC-JOIN-09 | 以暱稱 `'小明😀'` 加入 | INVALID_NICKNAME；該組 memberCount 不變 |
| UT-SVC-JOIN-10 | 同一組連續加入 25 位不同暱稱的成員 | 全部成功；`getPublicInfo` 該組 memberCount 25（不設人數上限） |

**UT-SVC-DRAFT（FR-08 組內共編）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-DRAFT-01 | A 組成員 1 更新第 1 題草稿 | A 組成員 2 的 TeamView 看得到；B 組看不到 |
| UT-SVC-DRAFT-02 | READY 中更新 | INVALID_PHASE |
| UT-SVC-DRAFT-03 | 長度錯、單格 201 字 | INVALID_INPUT、ANSWER_TOO_LONG；空字串允許 |
| UT-SVC-DRAFT-04 | 已送出後更新 | ALREADY_SUBMITTED |
| UT-SVC-DRAFT-05 | publish scope | `{ teacher:false, teamIds:[A] }` |
| UT-SVC-DRAFT-06 | 送出該題 | 該題草稿被刪除 |

**UT-SVC-SUB（純速度模式，FR-07／FR-08／FR-11／E1）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-SUB-01 | READY、ENDED 中送出 | INVALID_PHASE，資料庫無新送出 |
| UT-SVC-SUB-02 | A 組在 t 送出第 3 題 | serverTime = t；A 為得主、rank 1；題目 state settled |
| UT-SVC-SUB-03 | B 組在 t+80 送出 | rank 2、非得主 |
| UT-SVC-SUB-04 | A 組另一成員再送第 3 題 | ALREADY_SUBMITTED |
| UT-SVC-SUB-05 | 答案前後空白 | 儲存為 trim 後 |
| UT-SVC-SUB-06 | 第 1 題（題組）只填一格 | GROUP_INCOMPLETE；兩格都填 → 一筆送出、answers 長度 2 |
| UT-SVC-SUB-07 | 不存在的題目、別活動的題目 | QUESTION_NOT_FOUND |
| UT-SVC-SUB-08 | 不推進 clock，A、B 先後送出 | 先呼叫者為得主（seq 決定） |
| UT-SVC-SUB-09 | 20 組在同一毫秒送出 | 恰 1 位得主；rank 為 1..20 不重複 |
| UT-SVC-SUB-10 | 回傳值 | `withdrawableUntil === serverTime + 10000` |

**UT-SVC-FAIR（公平模式，E3）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-FAIR-01 | 第一筆送出 | state window；windowEndsAt = now + 3000；pending 有 `window:<qid>` |
| UT-SVC-FAIR-02 | A（已 2 分）t=0 送出；B（0 分）t=1000 送出；advance 3000 | B 為得主、A rank 2 |
| UT-SVC-FAIR-03 | 同分，A t=0、B t=500 | A 為得主 |
| UT-SVC-FAIR-04 | 結算後 C 送出 | rank 3、非得主 |
| UT-SVC-FAIR-05 | 在 t = windowEndsAt、排程觸發前送出 | 列入候選 |
| UT-SVC-FAIR-06 | windowSec = 5 | windowEndsAt = now + 5000 |
| UT-SVC-FAIR-07 | A 先在第 3 題得分；第 4 題 A 先送、B 後送（視窗內） | 第 4 題 B 得主（使用結算當下分數） |
| UT-SVC-FAIR-08 | 第 3、4 題視窗同時到期，A、B 都在兩題視窗內且原本同分 | 依 (windowEndsAt, 題號) 結算：第 3 題 A（較早）→ 第 4 題 B（較低分） |
| UT-SVC-FAIR-09 | 同一題呼叫 `settleWindow` 兩次 | 第二次無變化、不 publish |
| UT-SVC-FAIR-10 | 視窗中唯一候選撤回 | state open、pending 清空；之後新送出重新開視窗 |

**UT-SVC-WD（撤回，E4）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-WD-01 | 送出後 5 秒撤回，再重送 | 原筆 withdrawn；新筆 active，名次排在已結算者之後 |
| UT-SVC-WD-02 | 恰 10000 ms、10001 ms 撤回 | 前者成功；後者 WITHDRAW_WINDOW_EXPIRED |
| UT-SVC-WD-03 | 撤回別組的送出 | SUBMISSION_NOT_FOUND |
| UT-SVC-WD-04 | 撤回已撤回的送出 | INVALID_STATE |
| UT-SVC-WD-05 | 純速度模式得主撤回 | 第 2 名遞補為得主；分數更新 |
| UT-SVC-WD-06 | ENDED 中撤回 | INVALID_PHASE |

**UT-SVC-REJ（人工判錯，E5）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-REJ-01 | A 得主、B 第 2 名，判錯 | A rejected；B 得主；分數 A−1、B+1 |
| UT-SVC-REJ-02 | 再判錯一次 | 第 3 名遞補 |
| UT-SVC-REJ-03 | 已無可遞補者再判錯 | NO_WINNER；results 該題 winner null |
| UT-SVC-REJ-04 | READY 中判錯 | INVALID_PHASE |
| UT-SVC-REJ-05 | 被判錯的組再送該題 | ALREADY_SUBMITTED |
| UT-SVC-REJ-06 | ENDED 中判錯後匯出 | 寫回的是遞補者答案 |

**UT-SVC-EXPORT（FR-06／E2）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-EXPORT-01 | 範例 A：第 1 題 A 組 `['CPU','作業系統']`、第 3 題 B 組 `['0']`；end 後匯出 | gateway 收到恰 3 筆：G5 `（1）CPU`、G6 `（2）作業系統`、G11 `0`；回傳 updatedCells 3 |
| UT-SVC-EXPORT-02 | RUNNING 中匯出 | INVALID_PHASE；gateway 未被呼叫 |
| UT-SVC-EXPORT-03 | 還原 | 6 筆，值為各 originalValue |
| UT-SVC-EXPORT-04 | `exportCsv`（ENDED） | 以 BOM 開頭；列數 = 送出的子題總數 + 1 |
| UT-SVC-EXPORT-05 | `exportCsv`（RUNNING） | INVALID_PHASE |
| UT-SVC-EXPORT-06 | gateway `failNext('SHEETS_ERROR')` | 丟出 SHEETS_ERROR |

**UT-SVC-RECOVER（E7、可靠性）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-SVC-RECOVER-01 | 以同一 repo 建新 service，clock 已超過 windowEndsAt，呼叫 `recover()` | 該題立即結算 |
| UT-SVC-RECOVER-02 | windowEndsAt 尚未到 | `pending()` 含該題，at = windowEndsAt |
| UT-SVC-RECOVER-03 | recover 後 | 所有成員 online=false |

### 5.7 realtime

**UT-BC（`broadcaster.ts`，以 `fakeIo` 記錄 `to(room).emit`）**

| ID | 情境 | 期望 |
| --- | --- | --- |
| UT-BC-01 | `publish(s)`（3 組） | `teacher:<s>` 收 1 次 `teacher:state`；每個 `team:<id>` 各收 1 次 `team:state` |
| UT-BC-02 | `publish(s, {teacher:false, teamIds:[A]})` | 只有 `team:A` 收到 |
| UT-BC-03 | 送到 `team:A` 的 payload | 深度等於 `projectTeamView(agg, A)`，且不含 `cells` 欄位 |

### 5.8 client

使用 Vitest + jsdom + React Testing Library；`api.ts` 與 `socket.ts` 以 `vi.mock` 取代。

| ID | 對象 | 情境 | 期望 |
| --- | --- | --- | --- |
| UT-UI-STORE-01 | storage | save → load | 相同 |
| UT-UI-STORE-02 | storage | localStorage 中為壞 JSON | load 回傳 null 且已清除 |
| UT-UI-STORE-03 | storage | `localStorage.getItem` 丟例外 | 回傳 null，不丟例外 |
| UT-UI-FMT-01 | format | `formatTime(0)` | `08:00:00.000` |
| UT-UI-FMT-02 | format | 題組答案格式化 | `（1）CPU／（2）作業系統` |
| UT-UI-CLOCK-01 | useServerClock | serverNow 比本地快 2000 ms | 回傳值 ≈ Date.now()+2000 |
| UT-UI-MSG-01 | messages | 每個 ErrorCode | 皆有中文訊息；未知碼回傳預設訊息 |
| UT-UI-PHASE-01 | PhaseBadge | 4 個階段 | 文字依序為準備中／等待開始／搶答中／已結束 |
| UT-UI-LOGIN-01 | LoginForm | 送出密碼 | 呼叫 api.login；成功 saveTeacher 並導向 `/teacher` |
| UT-UI-LOGIN-02 | LoginForm | api 回 UNAUTHORIZED | `error-banner` 顯示對應訊息 |
| UT-UI-SET-01 | SettingsForm | 選純速度 | 隱藏 `settings-window-sec` |
| UT-UI-SET-02 | SettingsForm | 輸入組數 25 | 儲存按鈕 disabled 或顯示錯誤 |
| UT-UI-IMPORT-01 | ImportForm | 空白輸入 | 匯入按鈕 disabled |
| UT-UI-IMPORT-02 | ImportSummary | 範例 A summary | （v1.3 修改：加驗摘要文字）`import-question-count` 顯示 4、`import-group-count` 顯示 2；`import-summary` 含「偵測到 4 題，其中 2 題組（共 4 子題）、2 單題」 |
| UT-UI-IMPORT-03 | ImportForm | api 回 HEADER_NOT_FOUND | 顯示表頭格式說明 |
| UT-UI-IMPORT-04 | ImportForm | `importSheet` 尚未完成（pending） | `import-submit` disabled 且文字為「匯入中…」；再點擊不會再呼叫 api；完成後恢復可按 |
| UT-UI-CTRL-01 | ControlBar | 各階段 | READY 只有 btn-start 可用；RUNNING 只有 btn-end；ENDED 只有 btn-reset |
| UT-UI-GRID-01 | StatusGrid | 5 種格子狀態 | 分別顯示 `—`、`#2`、`★ 得主`、`已撤回`、`✗ 判錯` |
| UT-UI-GRID-02 | StatusGrid | 題目 state window | `question-state-n` 顯示「判定中」與倒數 |
| UT-UI-RES-01 | ResultsTable | 有得主與無得主的題目 | 正確顯示；無得主顯示「無」 |
| UT-UI-RES-02 | ResultsTable | 按 `btn-reject-1` | 呼叫 rejectWinner(第 1 題 id) |
| UT-UI-EXP-01 | ExportPanel | 匯出成功 3 格 | `export-result` 顯示「已寫回 3 格」 |
| UT-UI-JOIN-01 | JoinForm | 輸入房間碼 → 下一步 | 呼叫 getPublicInfo；顯示各組與人數 |
| UT-UI-JOIN-02 | JoinForm | 未選組或暱稱空白 | `join-submit` disabled |
| UT-UI-JOIN-03 | JoinForm | api 回 NICKNAME_TAKEN | 顯示錯誤，不導頁 |
| UT-UI-JOIN-04 | JoinForm | 成功 | saveMember 後導向 `/play` |
| UT-UI-JOIN-05 | Join | 有 member token 且 `GET /state` 回 200 | 導向 `/play`，不顯示 JoinForm |
| UT-UI-JOIN-06 | Join | 有 member token 且 `GET /state` 回 401 | 呼叫 clearMember；`join-room` 預填原 roomCode |
| UT-UI-DASH-01 | TeacherDashboard | `GET /sessions/current` 回 404 | 顯示 `btn-create-session` |
| UT-UI-DASH-02 | TeacherDashboard | `GET /sessions/current` 回 200 | 不存在 `btn-create-session` |
| UT-UI-DASH-03 | TeacherDashboard | 按 `teacher-logout` | 呼叫 clearTeacher；導向 `/teacher/login`；api 未被呼叫 |
| UT-UI-CARD-01 | AnswerCard | phase READY | 輸入與送出 disabled |
| UT-UI-CARD-02 | AnswerCard | RUNNING、題組只填一格 | 送出 disabled；填滿後可用 |
| UT-UI-CARD-03 | AnswerCard | 輸入文字 | 呼叫 setDraft（debounce 300 ms，用 fake timers 驗證只呼叫 1 次 PUT） |
| UT-UI-CARD-04 | AnswerCard | active、剩 7 秒 | 顯示「撤回（7 秒）」；時間到 0 時按鈕消失 |
| UT-UI-CARD-05 | AnswerCard | withdrawn | 輸入可編輯且帶入原答案 |
| UT-UI-CARD-06 | AnswerCard | rejected | 顯示「老師判定此答案錯誤」 |
| UT-UI-PLAY-01 | Play | 無 token | 導向 `/join` |
| UT-UI-PLAY-02 | Play | `GET /state` 回 401 | clearMember 並導向 `/join?room=<roomCode>` |
| UT-UI-PLAY-03 | Play | ENDED 的 view | 顯示 `student-results`，不顯示 AnswerCard |

---

## 6. Integration test 案例（`server/test/integration`）

以 `createApp(deps)` 啟動真實 HTTP + Socket.IO（隨機 port），DB `:memory:`，`FakeClock` + `ManualScheduler` + `InMemorySheetsGateway`；IT-PERF、IT-CONC 使用真實 clock 與 timer scheduler。

| ID | 需求 | 情境 | 期望 |
| --- | --- | --- | --- |
| IT-AUTH-01 | 安全 | 不帶 token 呼叫 `/api/teacher/sessions` | 401 UNAUTHORIZED，本文格式 `{error:{code,message}}` |
| IT-AUTH-02 | 安全 | 用 member token 呼叫老師 API；用 teacher token 呼叫 `/api/play/state` | 皆 401 |
| IT-AUTH-03 | 安全 | Socket 以錯誤 token 連線 | `connect_error.message==='UNAUTHORIZED'` |
| IT-FLOW-01 | FR-01～09 | 登入 → 建立 → 匯入 A → 3 組加入 → start → 各組送出第 1、3 題 → end → `GET /sessions/:id` → export → `GET /api/dev/fake-sheets/fixture-template-a` → csv | 每步狀態碼正確；fake sheet 的 G5、G6、G11 為得主答案、G8 等未變；CSV 含 BOM |
| IT-PHASE-01 | FR-07 | READY 中 `POST /api/play/submissions` | 409 INVALID_PHASE |
| IT-VAL-01 | 錯誤處理 | `POST /submissions` 本文缺 answers | 422 INVALID_INPUT |
| IT-VIS-01 | FR-10 | A、B 兩組 socket 與老師 socket；A 送出 `SECRET-A-123`、A 草稿 `SECRET-DRAFT-A`；記錄 B 在 end 之前收到的所有事件 | B 的所有 payload 序列化後不含上述字串、A 的 member id、A 的 submission id；老師收到含 `SECRET-A-123` 的 `teacher:state` |
| IT-VIS-02 | FR-09 | 接續 IT-VIS-01，老師 end | B 收到的 `team:state.results` 含 A 的答案 |
| IT-SYNC-01 | FR-12 | 5 個學生 socket + 老師；start、end | 每個 socket 都收到新 phase 的狀態 |
| IT-RT-01 | FR-04 | A 送出後 | 老師 socket 在 500 ms 內收到含該送出的 `teacher:state` |
| IT-CONC-01 | FR-11 | 20 組各一成員，對同一題 `Promise.all` 同時 POST；重複 50 輪（每輪 end + reset + start） | 每輪恰 1 位得主；其餘 19 筆 rank 2..20 不重複；無 500 錯誤 |
| IT-RECON-01 | E7 | 成員 socket 斷線後以同 token 重連 | 立即收到 `team:state`，含先前草稿與送出 |
| IT-RECON-02 | E7 | 斷線期間其他人改了狀態（例如 end） | 重連後收到的是最新狀態 |
| IT-ONLINE-01 | E7 | 同成員開 2 個 socket，關 1 個 | 仍 online；兩個都關 → offline |
| IT-CSV-01 | E2 | `GET export.csv` | `Content-Type: text/csv; charset=utf-8`；`Content-Disposition` 檔名含房間碼與 round |
| IT-RESTART-01 | 可靠性 | 使用暫存檔案 DB：fair 模式送出後關閉 app；clock +5 秒後以同 DB 重建 app | recover 後該題已結算，老師 view 顯示得主 |
| IT-PERF-01 | NFR | 40 個學生 socket（10 組 × 4）＋老師；連續 20 次送出 | 老師收到更新的 p95 < 500 ms |

---

## 7. E2E 案例（`e2e/tests`，Playwright）

- 啟動：`SHEETS_MODE=fake PORT=3100 DB_PATH=:memory: TEACHER_PASSWORD=e2e-pass`；每個 spec 開始前呼叫 `POST /api/dev/fake-sheets/fixture-template-a/reset`。
- 每位使用者使用獨立 `browser.newContext()`（模擬不同裝置；localStorage 不共用）。
- 選取元素只用 `data-testid`。
- 每個 spec 結束時截圖存 `e2e/artifacts/<ID>.png`，供 Demo 與報告使用。

| ID | 需求 | 步驟 | 期望 |
| --- | --- | --- | --- |
| E2E-01 | FR-01 | 老師登入 → 建立活動 → 匯入 `fixture-template-a` | （v1.3 修改：加驗匯入時間）`import-question-count`=4、`import-group-count`=2；按下 `import-submit` 到 `import-summary` 出現 < 2 秒 |
| E2E-02 | FR-01 | 重新匯入 `fixture-template-b` | 顯示 6 題、0 題組 |
| E2E-03 | 身分 | 4 個學生：第 1 組 2 人、第 2、3 組各 1 人 | 老師 `team-member-count-1`=2、`-2`=1、`-3`=1 |
| E2E-04 | FR-07 | 開始前查看學生頁 | 所有 `answer-input-*` disabled；直接以 `page.request` 呼叫送出 API → 409 |
| E2E-05 | FR-12 | 老師按 `btn-start` | 4 個學生頁的 `phase-badge` 在 1 秒內變「搶答中」 |
| E2E-06 | FR-08 | 第 1 組成員 X 在第 3 題輸入「0」 | 1 秒內出現在成員 Y 的輸入框；第 2 組頁面沒有該字串 |
| E2E-07 | FR-04、FR-10 | 第 1 組送出第 3 題 | 老師 `status-cell-3-1` 顯示答案；第 2 組頁面全文不含第 1 組答案與暱稱 |
| E2E-08 | E1 | 第 2 組第 1 題只填（1） | `btn-submit-1` disabled；填（2）後可送出，顯示 `submitted-1` |
| E2E-09 | E4 | 第 3 組送出第 4 題後 3 秒內按撤回，再修改送出 | 出現倒數；撤回後可編輯；重送成功；老師看到「已撤回」與新送出 |
| E2E-10 | E7 | 第 1 組成員 Y 重新整理頁面 | 回到第 1 組，`my-nickname` 相同，送出狀態保留 |
| E2E-11 | E3 | （v1.2 修改：系統只有一個活動，不再建立新活動）老師按 `btn-end` 再按 `btn-reset` 重新開始一輪（同一活動，設定維持公平模式 3 秒），再按 `btn-start`；第 1 組先拿第 3 題（得 1 分）；第 4 題第 1 組先送，第 2 組 1 秒後送 | 老師 `question-state-4` 顯示判定中，3 秒後第 2 組 `★ 得主` |
| E2E-12 | FR-03、FR-05、FR-09 | 老師 `btn-end` | 學生頁顯示 `student-results`；老師顯示 `results-table` 與分數 |
| E2E-13 | E5 | 老師按 `btn-reject-3` | 第 3 題得主變為第 2 名組別；學生結果頁同步更新 |
| E2E-14 | FR-06 | 老師 `btn-export-sheet` | `export-result` 顯示格數；`GET /api/dev/fake-sheets/fixture-template-a` 中對應儲存格為「前綴＋答案」，其他儲存格與 fixture 相同 |
| E2E-15 | 還原 | 老師 `btn-restore-sheet` | fake sheet 與 fixture 完全相同 |
| E2E-16 | E2 | 老師 `btn-download-csv` | 下載檔以 BOM 開頭；列數正確 |
| E2E-17 | reset | 老師 `btn-reset` | 回到等待開始；學生頁清空送出狀態，組別保留 |
| E2E-18 | E7 | （接在 E2E-03 之後執行）E2E-03 的某位學生在同一 context 開啟 `/join` | 自動導向 `/play`，`my-nickname` 不變；老師端該組 `team-member-count-{index}` 不變 |

---

## 8. 驗收規範

### 8.1 通過條件（全部滿足才算驗收通過）

1. §5、§6、§7 的所有案例皆實作且通過，無 skip（`it.skip`、`test.fixme` 數量為 0）。
2. 覆蓋率達 §2.3 門檻。
3. §10 追溯矩陣每列至少 1 個 UT 與 1 個 IT 或 E2E，且全部通過。
4. 無未解決的 S1、S2 缺陷。
5. §8.2 手動驗收全部勾選並附截圖。
6. `npm run lint` 無錯誤。
7. 從乾淨 clone 依 README 執行 `npm install && npm test && npm run test:e2e` 一次成功。

### 8.2 手動驗收清單（記錄於 `docs/manual-test.md`）

| ID | 項目 | 通過標準 |
| --- | --- | --- |
| MA-01 | Google 設定 | 依 README 建立服務帳號、啟用 Sheets API、共用試算表後，`SHEETS_MODE=google` 可啟動 |
| MA-02 | 真實匯入 | 把範例 A、B 上傳為 Google Sheets 後匯入，題數與題組同 E2E-01、E2E-02 |
| MA-03 | 真實寫回 | 完成一輪後寫回；Google Sheets 中作答格為「前綴＋答案」，格式、合併、其他儲存格不變（前後截圖） |
| MA-04 | 真實還原 | 還原後與匯入前一致 |
| MA-05 | 權限錯誤 | 未共用的試算表 → 顯示「沒有權限存取試算表…」 |
| MA-06 | 多分頁 Demo | 老師 + 3 組（含 1 組 2 人）四分割畫面完成一輪，畫面同步 |
| MA-07 | 秘密資訊 | `git log -p` 搜尋 `private_key`、`TEACHER_PASSWORD=` 實值 → 無結果 |
| MA-08 | 文件一致性 | spec、PlantUML 圖、README 功能清單、Demo 影片內容彼此一致（逐項打勾） |
| MA-09 | 範例 ID 說明 | README 列出 `fixture-template-a`、`fixture-template-b`；fake 模式下依 README 輸入可匯入；匯入畫面不顯示模式提示 |

### 8.3 缺陷嚴重度

| 等級 | 定義 | 例 |
| --- | --- | --- |
| S1 | 違反核心規則或資料錯誤 | 兩位得主、學生收到他組資料、寫回錯格 |
| S2 | 核心功能無法使用 | 無法匯入範例 B、無法結束搶答 |
| S3 | 額外功能或體驗問題，有替代做法 | 倒數顯示不準、CSV 排序錯 |
| S4 | 文字、樣式 | 錯字、對齊 |

---

## 9. 報告

### 9.1 缺陷格式

```markdown
### DEF-<流水號> <標題>
- 嚴重度：S1–S4
- 失敗測試：<測試 ID>
- 違反條文：TECH_SPEC §x.y / PRD FR-xx
- 重現步驟：1. … 2. …
- 期望：…
- 實際：…（附 log 或截圖路徑）
```

### 9.2 待釐清格式

```markdown
### Q-<流水號> <問題>
- 相關條文：…
- 採用的假設：…
- 影響的測試：…
```

### 9.3 `docs/test-report.md` 範本

```markdown
# 測試報告 <日期> <commit>
## 摘要
| 層級 | 案例數 | 通過 | 失敗 | 略過 |
|---|---|---|---|---|
| UT | | | | |
| IT | | | | |
| E2E | | | | |
| MA | | | | |
## 覆蓋率
| 範圍 | Lines | Branches | 門檻 | 結果 |
## 追溯矩陣結果（§10 每列 通過/失敗）
## 缺陷（DEF-*）
## 待釐清（Q-*）
## 驗收結論：通過 / 不通過（列出未滿足的 §8.1 條件）
```

---

## 10. 追溯矩陣

| 需求 | Unit test | Integration | E2E／手動 |
| --- | --- | --- | --- |
| FR-01 匯入、辨識題號 | UT-A1-05～07、UT-PARSE-01～22、UT-SVC-IMPORT-01～06、UT-UI-IMPORT-01～04 | IT-FLOW-01 | E2E-01、E2E-02、MA-02、MA-09 |
| FR-02 只以題號表示 | UT-PROJ-01、UT-PARSE-01（結果不含題目文字） | IT-FLOW-01 | E2E-01 |
| FR-03 開始／結束 | UT-PHASE-01～03、UT-SVC-PHASE-01～05、UT-UI-CTRL-01 | IT-SYNC-01 | E2E-05、E2E-12、E2E-17 |
| FR-04 老師即時狀態 | UT-PROJ-02、03、10、UT-UI-GRID-01～02、UT-BC-01 | IT-RT-01、IT-PERF-01 | E2E-07 |
| FR-05 老師看結果 | UT-RANK-01～09、UT-PROJ-08、UT-UI-RES-01 | IT-FLOW-01 | E2E-12 |
| FR-06 寫回原檔 | UT-EXP-01～04、UT-GW-01～05、UT-SVC-EXPORT-01～03、06、UT-UI-EXP-01 | IT-FLOW-01 | E2E-14、E2E-15、MA-03、MA-04 |
| FR-07 開始後才能作答 | UT-PHASE-01、UT-SVC-SUB-01、UT-SVC-DRAFT-02、UT-UI-CARD-01 | IT-PHASE-01 | E2E-04 |
| FR-08 以組為單位 | UT-SVC-SUB-04、UT-SVC-DRAFT-01～06、UT-REPO-03～04 | IT-CONC-01 | E2E-06 |
| FR-09 學生看結果 | UT-PROJ-06、UT-UI-PLAY-03 | IT-VIS-02 | E2E-12 |
| FR-10 結束前看不到他組 | UT-PROJ-04、05、UT-BC-03、UT-SVC-DRAFT-01 | IT-VIS-01 | E2E-06、E2E-07 |
| FR-11 最快者得分 | UT-RANK-01～04、UT-SVC-SUB-02、03、08、09 | IT-CONC-01 | E2E-07 |
| FR-12 階段同步 | UT-SVC-PHASE-02、UT-BC-01、UT-UI-PHASE-01 | IT-SYNC-01、IT-RECON-02 | E2E-05 |
| E1 題組 | UT-PARSE-01、05、12～15、UT-VAL-10、UT-SVC-SUB-06、UT-UI-CARD-02 | IT-FLOW-01 | E2E-08 |
| E2 CSV | UT-CSV-01～07、UT-PROJ-09、UT-SVC-EXPORT-04～05 | IT-CSV-01 | E2E-16 |
| E3 公平機制 | UT-SETTLE-01～06、UT-SVC-FAIR-01～10、UT-SVC-PHASE-03、UT-UI-SET-01 | IT-RESTART-01 | E2E-11 |
| E4 撤回 | UT-SVC-WD-01～06、UT-PROJ-07、UT-RANK-04、UT-UI-CARD-04～05 | IT-FLOW-01 | E2E-09 |
| E5 人工判錯 | UT-SVC-REJ-01～06、UT-RANK-05、09、UT-UI-RES-02、UT-UI-CARD-06 | IT-FLOW-01 | E2E-13 |
| E7 斷線重連 | UT-SVC-JOIN-08、UT-SVC-RECOVER-01～03、UT-UI-STORE-01～03、UT-UI-PLAY-01～02、UT-UI-JOIN-05～06 | IT-RECON-01～02、IT-ONLINE-01、IT-RESTART-01 | E2E-10、E2E-18 |
| 身分（房間碼＋組別＋暱稱） | UT-VAL-01～06、12～13、UT-SVC-JOIN-01～07、09～10、UT-AUTH-01～04、UT-UI-JOIN-01～04 | IT-AUTH-01～03 | E2E-03 |
| 老師管理頁（PRD §5.1 步驟 1–2：登出、單一活動） | UT-UI-DASH-01～03 | — | — |
| 錯誤處理 | UT-ERR-01～02、UT-UI-MSG-01 | IT-VAL-01 | MA-05 |
