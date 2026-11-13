---
description: "Task list for 002-guided-notes-import（依層次分 Phase：Setup → 後端 → 前端 → 整合）"
---

# Tasks: 匯入 Guided Notes（002-guided-notes-import）

**Input**：`specs/002-guided-notes-import/`（plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md）

**契約依據**：`docs/TECH_SPEC.md` v1.6（型別、簽名、API 路徑、錯誤碼、`data-testid` 逐字照抄，不得改名）、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2、藍圖 `diagrams/002-*.puml`

**範圍**：只做 TECH_SPEC §14.1「002-guided-notes-import」一列。不建立 003、004 的檔案或空殼（`sheets/exporter.ts`、`export/csv.ts`、`domain/ranking.ts`、`settlement.ts`、`boot/recover.ts`、`seed.ts`）；`writeCells` 只丟 `SHEETS_ERROR`（research D5）。

**前置依賴**：Phase 1、2 可立即開始；Phase 3 需 001 的 Phase 3（`client/`）完成；Phase 4 需 001 的 Phase 4（`e2e/playwright.config.ts`）完成。

## 規則

1. **測試先行（憲章 VII）**：每個實作任務之前都有測試任務；測試名稱必須含 TEST_SPEC 案例 ID（例：`it('UT-PARSE-05 範例 A 位移後作答格為 H7…', …)`），先執行確認失敗（Red）再實作（Green）。測試不得依賴真實時間、亂數或網路（Google client 一律 mock）。
2. **沒有 TEST_SPEC ID 的模組**（repo 新方法、`teacherRoutes` 的 import 路由、`devRoutes`、`app.ts`、`index.ts`、client `api.ts`、`useTeacher.importSheet`、TeacherDashboard）：任務中以「覆蓋測試：<ID>」註明由哪個測試驗證，不新增無 ID 的測試；實作後才執行的覆蓋屬 plan.md Complexity Tracking 的書面例外。
3. **檔案歸屬（憲章 IX）**：[BE] 只改根目錄設定檔、`server/`；[FE] 只改 `client/`；[QA] 只改 `e2e/`、`README.md`、`docs/manual-test.md`。[BE] 與 [FE] 不修改同一個檔案；前端型別一律從 `@quiz/shared` 匯入。
4. **禁止寫死儲存格位址（憲章 V）**：`server/src/` 中 A1 位址只能由 `toA1(row, col)` 產生；寫回位置只能來自解析結果。
5. 每個 Phase 最後一個任務：執行 `npm test` 與 `npm run lint` 全部通過（含 001 的測試），並依憲章原則 XI 比對程式碼與 `diagrams/002-*.puml`。

## Format: `- [ ] T### [P?] [BE|FE|QA] 描述（檔案路徑）`

- **[P]**：可平行（不同檔案、不依賴同 Phase 內未完成的任務）
- **[BE]／[FE]／[QA]**：後端／前端／整合與驗證
- 本檔依層次分 Phase（使用者指定），因此以 [BE]／[FE]／[QA] 取代範本的 [US#] 標籤；user story 對應見文末「追溯表」

---

## Phase 1: Setup [BE] — 相依套件、覆蓋率門檻、測試替身

**Purpose**：加入 googleapis、補 parser 覆蓋率門檻、建立 `fixtures.ts`，並讓 `makeTestService` 預設載入兩份 fixture（TECH_SPEC §14.1 補充）。

- [X] T001 [BE] 在 `server/package.json` 的 dependencies 加入 `googleapis`（純 JS，research R-01）；執行 `npm install`，確認無原生模組：PowerShell `Get-ChildItem -Recurse -Filter *.node node_modules` 結果為空（`server/package.json`、`package-lock.json`）
- [X] T002 [P] [BE] 在根目錄 `vitest.config.ts` 的 `coverage.thresholds` 加入 `'server/src/sheets/parser.ts': { lines: 95, branches: 90 }`（TEST_SPEC §2.3；`exporter.ts` 屬 004，不在此加入）；`exclude` 不得增加其他檔案（`vitest.config.ts`）
- [X] T003 [P] [BE] 依 TEST_SPEC §3 建立 `fixtures.ts`，簽名逐字照抄：`loadSnapshot(name: 'template-a' | 'template-b'): SheetSnapshot`（讀 `fixtures/sheets/{name}.snapshot.json`，以 `import.meta.url` 推算專案根目錄，回傳深拷貝）、`loadExpected(name): ParseResult`（讀 `{name}.expected.json`）、`shiftGrid(s, rows, cols)`（每個工作表 values 前面插入 `rows` 個空列、每列前面插入 `cols` 個 `''`；merges 的 `startRowIndex`／`endRowIndex` 加 rows、`startColumnIndex`／`endColumnIndex` 加 cols；回傳新物件）、`removeMerges(s)`（所有工作表 `merges = []`）、`setCell(s, a1, value, sheetIndex = 0)`（解析 A1 為 0-based row／col，不足時補空列與 `''`）、`prependSheet(s, sheet)`（插到 `sheets[0]`）；全部不寫檔、不修改輸入。覆蓋測試：T008、T009（`server/test/helpers/fixtures.ts`）
- [X] T004 [BE] 修改 `makeTestService`：`snapshots` 預設改為 `{ 'fixture-template-a': loadSnapshot('template-a'), 'fixture-template-b': loadSnapshot('template-b') }`，有傳入 `opts.snapshots` 時以傳入值為準；更新檔頭註解（移除「001：snapshots 預設為空物件」）（`server/test/helpers/makeTestService.ts`）
- [X] T005 [BE] **Phase 1 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001 的測試，確認 `makeTestService` 預設載入 fixture 不影響既有結果）；依憲章原則 XI 確認本 Phase 無對應圖表元件需比對（測試替身不在圖中），於本任務記錄結果（`server/test/helpers/`、`diagrams/002-*.puml`）

**Checkpoint**：Phase 2 可開始

---

## Phase 2: 後端 [BE]

**Purpose**：依序完成 a1 → parser（含 summarize）→ fakeGateway、googleGateway 讀取 → repo → importSheet → projections → import 路由、devRoutes、依 `SHEETS_MODE` 組裝 gateway。

### 2.1 sheets/a1.ts（§7.2）

- [X] T006 [BE] 撰寫 UT-A1-01～07，執行並確認失敗：01 `colToLetters` 0、6、25、26、701、702 → A、G、Z、AA、ZZ、AAA；02 `toA1(4,6)`、`toA1(0,0)` → G5、A1；03 `quoteSheet('學習單')`、`quoteSheet("It's")` → `'學習單'`、`'It''s'`；04 `rangeA1('學習單','G5')` → `'學習單'!G5`；05 `parseSpreadsheetInput('https://docs.google.com/spreadsheets/d/1AbC_d-EfGhIjK/edit#gid=0')` → `1AbC_d-EfGhIjK`；06 `'1AbC_d-EfGhIjK'`、`'fixture-template-a'` 原樣回傳；07 `''`、`'hello'`、`'https://example.com/x'` → `AppError('INVALID_SPREADSHEET_URL')`（`server/test/sheets/a1.test.ts`）
- [X] T007 [BE] 實作 `colToLetters`、`toA1`、`quoteSheet`（前後加 `'`，內部 `'` 改為 `''`）、`rangeA1`（`${quoteSheet(title)}!${a1}`）、`parseSpreadsheetInput`（先 trim；含 `/spreadsheets/d/{id}` 的網址取 id；符合 `/^[A-Za-z0-9_-]{10,}$/` 原樣回傳；否則丟 `AppError('INVALID_SPREADSHEET_URL')`），簽名逐字照 TECH_SPEC §7.2，加繁中註解，讓 T006 通過（`server/src/sheets/a1.ts`）

### 2.2 sheets/parser.ts 與 summarize（§7.3）

- [X] T008 [BE] 以 `fixtures.ts` 撰寫 UT-PARSE-01～20，執行並確認失敗：01 範例 A 與 `loadExpected('template-a')` 深度相等（含 `warnings: []`）；02 範例 B 與 `loadExpected('template-b')` 深度相等；03 `summarize`（A）→ `{questionCount:4, groupCount:2, singleCount:2, subQuestionCount:4, warnings:[]}`；04 `summarize`（B）→ `{6,0,6,0}`；05 `shiftGrid(A, 2, 1)` → 結構同 01、作答格依序 H7、H8、H10、H11、H13、H15；06 `prependSheet` 無表頭的「說明」→ `sheetTitle==='學習單'`，其餘同 01；07 B4「題號」改「編號」→ HEADER_NOT_FOUND；08 範例 B 清空所有題號 → NO_QUESTIONS；09 B9 由「3」改「2」→ DUPLICATE_QUESTION_NUMBER 且 message 含「2」；10 範例 B 清空 B11 → 5 題（1,2,3,5,6）、1 個 `NON_CONSECUTIVE_NUMBERS`；11 題號 `'1.0'`、`' 2 '` 解析為 1、2，`'1a'`、`'一'` 略過；12 `removeMerges(A)` → 後備規則判定第 1、2 題為題組，結果同 01；13 G5、G6 改 `(1)`、`(2)` → `prefix==='(1)'`、`subNo===1`；14 清空 G5、G6 → 第 1 題仍為題組，subNo 1、2，prefix `''`；15 G5、G6 改「（2）」「（1）」→ `SUBNO_MISMATCH`，subNo 重編為 1、2；16 originalValue：G5 `'（1）'`、G11 `''`；17 某列長度短於 answerCol → 不丟例外、originalValue `''`；18 表頭 `' 題號 '`、`'作答 '` 正常辨識；19 第 2 題在第 1 題上方 → 依題號升冪；20 只水平合併的題號格 → 單題。另斷言結果 JSON 不含題目敘述文字（FR-02）（`server/test/sheets/parser.test.ts`）
- [X] T009 [BE] 在同檔補 UT-PARSE-21～22（TEST_SPEC v1.3），執行並確認失敗：21 範例 B 的 B5 由「1」改「0」→ 6 題（題號 0、2～6）、1 個 `NON_CONSECUTIVE_NUMBERS`、第 0 題作答格 G5；22 範例 B 題號改 `'01'`、`'002'`、`'03.0'` → 解析為 1、2、3，結果與 UT-PARSE-02 相同（`server/test/sheets/parser.test.ts`）
- [X] T010 [BE] 依 TECH_SPEC §7.3 **逐條**實作 `parseGuidedNotes(snapshot): ParseResult`，每一步以繁中註解標示步驟編號：(1) 依 `snapshot.sheets` 順序找第一個某列同時有 `trim(cell)==='題號'` 與 `'作答'` 的工作表，記錄 `headerRow`、`numberCol`、`answerCol`（多個取最左），全部找不到 → `AppError('HEADER_NOT_FOUND')`；(2) 從 `headerRow+1` 掃到最後一列，`raw = trim(values[r][numberCol] ?? '')`；(3) 符合 `/^\d+(\.0+)?$/` → 起點，`number = parseInt(raw, 10)`，否則跳過；(4) 找同 sheetId、包含 `(r, numberCol)` 的 merge，跨列數 > 1 → 題組（列 `start…end-1`），否則單題 `[r]`；(5) 後備規則：單題且作答格前綴為「（1）」→ 向下吸收「題號欄空白且作答格前綴依序為（k）」的列，≥ 2 列視為題組；(6) 每列建 `ParsedSlot`：`originalValue = values[row][answerCol] ?? ''`，前綴正規式 `/^\s*[（(]\s*(\d+)\s*[）)]/`，符合 → `prefix = match[0]`、`subNo = Number(match[1])`，否則 `prefix=''`、`subNo` = 列序（從 1）；單題 `subNo = 1`；`a1 = toA1(row, answerCol)`；(7) 題組 subNo 不是 1..n 遞增 → 加 `SUBNO_MISMATCH`（含 `questionNumber`，message「第 n 題子題編號不是 1..n 遞增，已自動重編」）並改為列序；(8) 下一掃描列 = 題組最後一列 + 1；(9) 0 題 → `NO_QUESTIONS`；題號重複 → `new AppError('DUPLICATE_QUESTION_NUMBER', `題號重複：${重複題號}`)`（`AppError` 第二參數為自訂 message）；排序後不是 `1..N` 連續 → `NON_CONSECUTIVE_NUMBERS`（message 列出實際題號，不阻擋）；(10) 依題號升冪回傳。spec Edge Cases 的邊界規則也必須實作：同列多個「題號」／「作答」取最左；後備規則吸收後不足 2 列仍為單題；單題作答格以「（1）」開頭（不符後備規則）仍為單題、subNo 1、前綴照原樣保存；題組前綴有些有有些沒有時，有前綴取其編號、沒有取列序；「2.5」等非整數略過（覆蓋：UT-PARSE-01～22 與 T026 的 parser.ts 覆蓋率門檻）。另實作 `summarize(result): ImportSummary`（questionCount、groupCount、singleCount、subQuestionCount＝題組子題總數、warnings）。不得出現任何寫死的儲存格位址，讓 T008、T009 通過（`server/src/sheets/parser.ts`）

### 2.3 gateways 讀取（§7.4，TECH_SPEC v1.5）

- [X] T011 [P] [BE] 撰寫 UT-GW-04，執行並確認失敗：以 `createFakeGateway(<repo>/fixtures/sheets)` 呼叫 `fetchSnapshot('fixture-template-a')` → 與 `loadSnapshot('template-a')` 深度相等；`'nope'`、`'../x'`、`'fixture-../x'` → `SHEETS_NOT_FOUND`（UT-GW-05 屬 004，不在此撰寫）（`server/test/sheets/fakeGateway.test.ts`）
- [X] T012 [BE] 實作 `createFakeGateway(dir: string): SheetsGateway & { getSnapshot(spreadsheetId: string): SheetSnapshot; reset(spreadsheetId: string): void }`：ID 必須符合 `/^fixture-([A-Za-z0-9_-]+)$/`，讀 `{dir}/{名稱}.snapshot.json`（`node:fs`），第一次讀取後存在記憶體 Map；`fetchSnapshot` 回傳深拷貝；`getSnapshot` 回傳記憶體版本（未載入先載入）；`reset` 重新從檔案載入；ID 不符或檔案不存在 → `AppError('SHEETS_NOT_FOUND')`；`writeCells` 丟 `AppError('SHEETS_ERROR')`（加註解「004 實作」），讓 T011 通過（`server/src/sheets/fakeGateway.ts`）
- [X] T013 [P] [BE] 撰寫 UT-GW-01、UT-GW-03（mock `sheets_v4.Sheets` 物件，不連網），執行並確認失敗：01 `spreadsheets.get` 回傳一個工作表「學習單」、`values.batchGet` 回傳 `valueRanges: [{ range: "'學習單'!B2:H16", values: [...] }]` → `values[0]` 與每列第 0 欄為空、原 B2 位於 `values[1][1]`，並斷言 `batchGet` 的 ranges 為 `["'學習單'"]`、`valueRenderOption: 'FORMATTED_VALUE'`；03 API 丟出 status 403／404／500 的錯誤 → `SHEETS_PERMISSION_DENIED`／`SHEETS_NOT_FOUND`／`SHEETS_ERROR`（`server/test/sheets/googleGateway.test.ts`）
- [X] T014 [BE] 實作 `createGoogleGateway(client: sheets_v4.Sheets): SheetsGateway`：`fetchSnapshot` 呼叫 `spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title),merges)' })`，再 `spreadsheets.values.batchGet({ spreadsheetId, ranges: 每個工作表 quoteSheet(title), valueRenderOption: 'FORMATTED_VALUE' })`；依回傳 `range` 的起始儲存格補齊為以 A1 為原點（解析 `!` 後的起點欄列）；錯誤以 `code` 或 `response.status` 對照 403 → `SHEETS_PERMISSION_DENIED`、404 → `SHEETS_NOT_FOUND`、其他 → `SHEETS_ERROR`；`writeCells` 丟 `AppError('SHEETS_ERROR')`（註解「004 實作」），讓 T013 通過（`server/src/sheets/googleGateway.ts`）

### 2.4 repo 與 importSheet（§5、§7.9）

- [X] T015 [BE] 撰寫 UT-SVC-IMPORT-01～06（`makeTestService()`，先 `createSession({})`），執行並確認失敗：01 匯入 `fixture-template-a` → phase READY；`repo.listQuestions` 4 題、`repo.listSlotsBySession` 6 個 slot；回傳 summary 同 UT-PARSE-03；session `spreadsheetId==='fixture-template-a'`、`sheetTitle==='學習單'`；broadcaster 記錄一次 publish（預設 scope）；02 READY 中再匯入 `fixture-template-b` → 6 題；舊題目、slot、草稿全部刪除（草稿以 `repo.db` 直接插入一筆 drafts 驗證）；03 以 repo 把 phase 設為 RUNNING 後匯入 → INVALID_PHASE；04 先匯入 `fixture-template-a`（READY、4 題）再 `gateway.failNext('SHEETS_PERMISSION_DENIED')` 並匯入 `fixture-template-b` → 丟出該錯誤，phase 仍為 READY、`listQuestions` 仍為範例 A 的 4 題、`listSlotsBySession` 仍為 6 個、`getImportSummary` 仍等於範例 A 的 summary、broadcaster 未再 publish（spec US4 情境 2、FR-019）；05 輸入 `'hello'` → INVALID_SPREADSHEET_URL，且 gateway 未被呼叫（以 spy 驗證）；06 傳入無表頭 snapshot（`setCell` 改 B4）→ HEADER_NOT_FOUND，phase 仍為 SETUP（`server/test/services/session.import.test.ts`）
- [X] T016 [BE] 在 `Repo` 新增（data-model §4）：`getImportSummary(sessionId): ImportSummary | null`（JSON.parse `import_summary`）、`setImportSummary(sessionId, summary)`、`deleteQuestionsBySession(sessionId)`（`answer_slots`、`drafts` 以 `ON DELETE CASCADE` 連帶刪除）、`insertQuestion(q: Question)`（`is_group` 存 0／1）、`insertSlot(s: AnswerSlot)`、`listQuestions(sessionId): Question[]`（依 `number` 升冪）、`listSlotsBySession(sessionId): AnswerSlot[]`（依 `question_id`、`sub_no`）；欄位對照 TECH_SPEC §5。覆蓋測試：T015（UT-SVC-IMPORT-01、02）（`server/src/db/repo.ts`）
- [X] T017 [BE] 實作 `importSheet(sessionId, spreadsheetInput): Promise<{ view; summary }>`（research R-05），加繁中註解：(1) `requireSession` 並 `assertPhase(phase, 'import')`；(2) `parseSpreadsheetInput`；(3) `await sheets.fetchSnapshot`；(4) `parseGuidedNotes`、`summarize`；(5) `withTransaction`：重新讀 session 並 `assertPhase`（讀取期間已開始搶答 → INVALID_PHASE）、`deleteQuestionsBySession`、依序 `insertQuestion`（`ids.id('q')`、`subCount = slots.length`、`state: 'open'`、`windowEndsAt: null`）與 `insertSlot`（`ids.id('slot')`，欄位取自 ParsedSlot）、`updateSession`（`spreadsheetId`、`sheetTitle`、`phase: nextPhase(phase, 'import')`）、`setImportSummary`；(6) `broadcaster.publish(sessionId)`；(7) 回傳 `{ view: getTeacherView(sessionId), summary }`。任何錯誤都不寫入、不推播，讓 T015 通過（`server/src/services/sessionService.ts`）

### 2.5 projections：questionInfo 與 importSummary（§7.8，TECH_SPEC v1.6）

- [X] T018 [BE] 撰寫 UT-PROJ-01：`questionInfo` 對題組有前綴、題組無前綴、單題 → `['（1）','（2）']`、`['（1）','（2）']`、`['']`；並把本檔既有測試建立 `SessionAggregate` 的地方補上 `importSummary: null`（D9），執行並確認 UT-PROJ-01 失敗、001 的 UT-PROJ-10 仍通過（`server/test/domain/projections.test.ts`）
- [X] T019 [BE] 在 UT-SVC-IMPORT-01 補斷言（FR-023、FR-10），執行並確認失敗：`getTeacherView(id).importSummary` 等於回傳 summary；`questions` 依題號為 1～4，第 1 題 `subLabels` 為 `['（1）','（2）']`、`winnerTeamId === null`；以 `join` 建立一位成員後 `getTeamView(token).questions` 有 4 題，且每題 key 只有 `id`、`number`、`isGroup`、`subCount`、`subLabels`（`server/test/services/session.import.test.ts`）
- [X] T020 [BE] 修改 projections：`SessionAggregate` 新增 `importSummary: ImportSummary | null`（TECH_SPEC v1.6）；實作 `questionInfo(q, slots)`（取該題 slots 依 subNo 排序；題組 `subLabels = prefix || \`（${subNo}）\``，單題 `['']`）；`projectTeacherView` 的 `questions` = 依題號排序的 `questionInfo` 加 `state`、`windowEndsAt`、`winnerTeamId: null`（註解「得主由 003 計算」），`importSummary = agg.importSummary`；`projectTeamView` 的 `questions` 只放 `QuestionInfo`（不含 state，FR-10）。`state`、`windowEndsAt` 只是把資料庫欄位原樣帶出（匯入時為 `'open'`、`null`），`winnerTeamId` 固定 `null`，三者皆加註解「TECH_SPEC §14.1：由 003 改寫」，本任務不實作任何搶答邏輯，讓 T018 通過（`server/src/domain/projections.ts`）
- [X] T021 [BE] 修改 `SessionService.loadAggregate`：`questions = repo.listQuestions(sessionId)`、`slots = repo.listSlotsBySession(sessionId)`、`importSummary = repo.getImportSummary(sessionId)`，讓 T019 通過（`server/src/services/sessionService.ts`）

### 2.6 路由與組裝（§8.1、§8.4、§3.4）

- [X] T022 [BE] 在 `teacherRoutes` 新增 `POST /sessions/:id/import`：需老師驗證；本文以 zod `{ spreadsheet: z.string() }` 驗證（失敗 → INVALID_INPUT）；呼叫 `await service.importSheet(id, spreadsheet)`，回 200 `{ view, summary }`；async 錯誤交給 `errorHandler`。覆蓋測試：E2E-01、E2E-02（T035、T036；實作後執行，plan Complexity Tracking 例外）（`server/src/http/teacherRoutes.ts`）
- [X] T023 [P] [BE] 建立 `devRoutes(fake)`（§8.4）：`GET /fake-sheets/:spreadsheetId` → 200 `fake.getSnapshot(id)`；`POST /fake-sheets/:spreadsheetId/reset` → `fake.reset(id)` 後 204；錯誤交給 `errorHandler`（`SHEETS_NOT_FOUND` → 404）。覆蓋測試：E2E-01、E2E-02 的前置 reset（T035）；完整驗證屬 004 的 UT-GW-05、IT-FLOW-01、E2E-14、15（`server/src/http/devRoutes.ts`）
- [X] T024 [BE] 修改 `app.ts`：`AppDeps` 新增選填 `fakeSheets?: ReturnType<typeof createFakeGateway>`；有提供時 `app.use('/api/dev', devRoutes(deps.fakeSheets))`（掛在 SPA fallback 與 `errorHandler` 之前）；未提供時不掛載。覆蓋測試：E2E-01（`server/src/app.ts`）
- [X] T025 [BE] 修改 `index.ts`，移除 `sheetsNotAvailable`：`config.sheetsMode === 'fake'` → `const fake = createFakeGateway(config.fakeSheetsDir)`，`sheets: fake`、`fakeSheets: fake`；`'google'` → `new google.auth.GoogleAuth({ keyFile: config.googleCredentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })`、`google.sheets({ version: 'v4', auth })`、`createGoogleGateway(client)`，不傳 `fakeSheets`。`config.ts` 已驗證 google 模式金鑰檔存在，不需修改。覆蓋測試：E2E-01（fake）、手動 MA-01、MA-02（google）（`server/src/index.ts`）
- [X] T026 [BE] **Phase 2 驗收**：執行 `npm test`（UT-A1-01～07、UT-PARSE-01～22、UT-GW-01、03、04、UT-SVC-IMPORT-01～06、UT-PROJ-01，以及 001 全部測試）與 `npm run lint` 全部通過；`npm run test:coverage` 中 `server/src/sheets/parser.ts` ≥ 95%／90%、`server/src/domain/**` ≥ 95%／90%、`server/src/services/**` ≥ 90%／85%。**若 `parser.ts` 未達門檻**：列出未覆蓋的行與分支（預期為 T010 的邊界規則），停止並回報；不得新增無 TEST_SPEC ID 的測試、不得調低門檻或擴大排除清單，依憲章原則 II 提案在 `docs/TEST_SPEC.md` 新增 UT-PARSE-23 起的案例並登記於 TECH_SPEC §14.1、TEST_SPEC §10，經使用者同意後才補測試；以 `git grep -nE "['\"][A-Z]{1,3}[0-9]+['\"]" server/src` 確認無寫死儲存格位址；依憲章原則 XI 比對 `diagrams/002-component.puml`（伺服器組件與連線）、`002-class.puml`（a1、parser、gateways、devRoutes、Repo 7 個方法、SessionAggregate、projections 的公開方法與關聯）、`002-sequence.puml`（伺服器端呼叫順序，含交易內重檢階段）與程式一致，不一致先修正（改圖後重新執行 `java -jar plantuml.jar "./diagrams/*.puml"`），於本任務記錄比對結果（`server/`、`diagrams/002-*.puml`）

**Checkpoint**：後端可合併；Phase 3 待 001 Phase 3 完成後開始

---

## Phase 3: 前端 [FE]

**Purpose**：`useTeacher.importSheet` → `ImportForm`、`ImportSummary` → TeacherDashboard 的 READY 題號清單。UI 測試以 `vi.mock` 取代 `api.ts`／`socket.ts`（TEST_SPEC §5.8）。

- [ ] T027 [P] [FE] 撰寫 UT-UI-IMPORT-01、03、04，執行並確認失敗：01 `import-input` 空白（含只有空白字元）→ `import-submit` disabled；03 `onImport` 以 `{ code: 'HEADER_NOT_FOUND' }` 拒絕 → 表單下方顯示範本格式說明（含「題號」「作答」「合併」等字樣，內容見 contracts/ui-testids.md），且 ImportForm 本身不渲染 `error-banner`（錯誤橫幅由 TeacherDashboard 顯示，analyze M3）；以其他錯誤碼拒絕時不顯示格式說明；04 `onImport` 回傳未完成的 Promise → `import-submit` disabled 且文字為「匯入中…」，再點擊不會再呼叫 `onImport`，Promise 完成後恢復可按（`client/test/components/ImportForm.test.tsx`）
- [ ] T028 [P] [FE] 撰寫 UT-UI-IMPORT-02，執行並確認失敗：以範例 A summary（4、2、2、4、`warnings: []`）與 4 題 `questions` 渲染 → `import-question-count` 顯示 4、`import-group-count` 顯示 2，`import-summary` 含「偵測到 4 題，其中 2 題組（共 4 子題）、2 單題」；並斷言有 1 個警告時出現 `import-warning-0`（`client/test/components/ImportSummary.test.tsx`）
- [ ] T029 [FE] 在 `api.ts` 新增 `importSheet(token, sessionId, spreadsheet): Promise<{ view: TeacherView; summary: ImportSummary }>`（`POST /api/teacher/sessions/:id/import`，本文 `{ spreadsheet }`），沿用 `request()` 的錯誤處理。覆蓋測試：E2E-01、E2E-02（實作後執行，plan Complexity Tracking 例外）（`client/src/api.ts`）
- [ ] T030 [FE] 在 `useTeacher()` 新增 `importSheet(spreadsheet: string): Promise<ImportSummary>`（§10.3）：`busy = true` → 呼叫 `api.importSheet` → 成功以回應的 `view` 取代本地 view、清除 error、回傳 summary；失敗設定 `error`（由 TeacherDashboard 既有的唯一 `ErrorBanner` 顯示）並重新丟出，供 ImportForm 判斷是否顯示格式說明；`finally` 設 `busy = false`；之後仍以 `teacher:state` 快照為準。覆蓋測試：UT-UI-DASH-01～03 仍通過、E2E-01、E2E-02（`client/src/hooks/useTeacher.ts`）
- [ ] T031 [FE] 實作 `ImportForm`（props：`onImport(spreadsheet): Promise<unknown>`、`busy: boolean`）：`import-input`、`import-submit`；輸入 trim 後為空白、`busy` 為 true、或本元件送出中 → disabled；送出中按鈕文字「匯入中…」，否則「匯入」；`onImport` 拒絕時**不**渲染 `ErrorBanner`（錯誤由 `useTeacher.error` 經 TeacherDashboard 唯一的 ErrorBanner 顯示，避免重複），只在 `code === 'HEADER_NOT_FOUND'` 時於表單下方顯示範本格式說明 4 點（contracts/ui-testids.md），下次送出時清除；不顯示模式提示，讓 T027 通過（`client/src/components/ImportForm.tsx`）
- [ ] T032 [P] [FE] 實作 `ImportSummary`（props：`summary: ImportSummary`、`questions: QuestionInfo[]`）：`import-summary` 文字固定為「偵測到 {questionCount} 題，其中 {groupCount} 題組（共 {subQuestionCount} 子題）、{singleCount} 單題」，數字分別包在 `import-question-count`、`import-group-count`（其餘數字無 testid）；下方依序列出警告 `import-warning-{i}`（顯示 message）與題號清單：單題「第 n 題」、題組「第 n 題 題組」加 `subLabels`；不顯示試算表 ID、工作表名稱、題目敘述，讓 T028 通過（`client/src/components/ImportSummary.tsx`）
- [ ] T033 [FE] 修改 `TeacherDashboard`：phase 為 SETUP 或 READY 時顯示 `ImportForm`（`onImport = importSheet`、`busy`）；`view.importSummary` 不為 null 時顯示 `ImportSummary`（`questions = view.questions`），重新整理後由快照自動顯示（FR-023）；RUNNING、ENDED 不顯示 ImportForm；不新增第二個 `ErrorBanner`，匯入錯誤沿用 001 既有、顯示 `useTeacher.error` 的那一個；不修改 `client/src/pages/Play.tsx`（學生等待畫面的題號顯示屬 003 AnswerCard）。覆蓋測試：UT-UI-DASH-01～03 仍通過、E2E-01、E2E-02（`client/src/pages/TeacherDashboard.tsx`）
- [ ] T034 [FE] **Phase 3 驗收**：執行 `npm test`（UT-UI-IMPORT-01～04，以及 001 全部測試）與 `npm run lint` 全部通過；確認 `client/` 未匯入 `server/` 任何檔案；依憲章原則 XI 比對 `diagrams/002-component.puml`（瀏覽器端：TeacherDashboard、ImportForm 的 disabled 與「匯入中…」、ImportSummary 的固定文字、TeacherDashboard → ErrorBanner 唯一一個且 ImportForm 只顯示格式說明、useTeacher.importSheet）與 `002-sequence.puml`（老師端 busy 切換與兩段流程）與程式一致，不一致先修正（改圖後重新產生 PNG），於本任務記錄比對結果（`client/`、`diagrams/002-*.puml`）

**Checkpoint**：前端可合併；Phase 4 待 001 Phase 4 完成後開始

---

## Phase 4: 整合與 E2E [QA]

**Purpose**：E2E-01、E2E-02、README、手動驗收與最終圖表比對。依賴本子功能 Phase 2、3 與 001 Phase 4。

- [ ] T035 [QA] 撰寫 E2E-01（v1.3）：`test.beforeEach` 以 `request.post('/api/dev/fake-sheets/fixture-template-a/reset')`、`…/fixture-template-b/reset` 重設（TEST_SPEC §7）；老師登入（`teacher-password`＝e2e-pass）；系統只有一個活動，若 `btn-create-session` 存在才按（001 的 E2E-03 可能已建立）；`import-input` 填 `fixture-template-a`，記錄按下 `import-submit` 到 `import-summary` 出現的時間 < 2000 ms；`import-question-count`＝4、`import-group-count`＝2，`import-summary` 含「偵測到 4 題，其中 2 題組（共 4 子題）、2 單題」；`phase-badge`＝「等待開始」；頁面不含範例 A 的題目敘述（抽一句）；截圖 `e2e/artifacts/E2E-01.png`（`e2e/tests/import.spec.ts`）
- [ ] T036 [QA] 在同檔撰寫 E2E-02（接在 E2E-01 之後）：重新匯入 `fixture-template-b` → `import-question-count`＝6、`import-group-count`＝0，題號清單只剩第 1～6 題且無「題組」字樣；截圖 `e2e/artifacts/E2E-02.png`（`e2e/tests/import.spec.ts`）
- [ ] T037 [QA] 執行 `npm run test:e2e`（E2E-01、02 與 001 的 E2E-03、18 全部通過）與 `npm run test:coverage`（達 TEST_SPEC §2.3 門檻；排除清單只有 `server/src/index.ts`）；在 `docs/manual-test.md` 的 002 段落記錄覆蓋率實際值、plan Complexity Tracking 例外模組（`devRoutes.ts`、`app.ts`、`teacherRoutes.ts` 的 import 路由、`client/src/api.ts`、`useTeacher.ts`、`TeacherDashboard.tsx`）的覆蓋率，以及排除清單（`server/src/index.ts`；`googleGateway.ts` 只排除實際連網部分，依 TEST_SPEC §2.3）；未達門檻時不得擴大排除清單、調低門檻或新增無 ID 的測試，停止並回報團隊（`e2e/tests/import.spec.ts`、`docs/manual-test.md`）
- [ ] T038 [QA] 更新 `README.md`：功能清單加入 002（匯入 Guided Notes）；「Guided Notes 範本格式」：保留「題號／作答」表頭、題號欄填整數（可 `1.0`、`01`）、題組以縱向合併題號格、子題作答格可用「（n）」開頭（PRD §9 要求 README 寫明）；fake 模式可匯入的範例 ID `fixture-template-a`、`fixture-template-b`（MA-09）；Google 模式設定：建立服務帳號、啟用 Google Sheets API、下載金鑰放 `secrets/service-account.json`（不得提交）、`.env` 設 `SHEETS_MODE=google` 與 `GOOGLE_APPLICATION_CREDENTIALS`、把試算表共用給服務帳號 email（MA-01）（`README.md`）
- [ ] T039 [QA] 手動驗收並記錄於 `docs/manual-test.md` 的 002 段落：MA-01（依 README 設定後 `SHEETS_MODE=google` 可啟動）、MA-02（把 `template-a.xlsx`、`template-b.xlsx` 上傳為 Google Sheets 後匯入，題數與題組同 E2E-01、02）、MA-09（README 範例 ID 可匯入、匯入畫面無模式提示）；SC-003 另設一欄「其他 Guided Notes（如有）」：驗收當天若助教提供保留「題號／作答」表頭的另一份試算表，記錄匯入題數、題組判定與是否與原檔一致；並依 `quickstart.md` 步驟 2 的 4～8 驗證：`hello` → INVALID_SPREADSHEET_URL 訊息、`fixture-nope` → 找不到試算表、學生分頁加入後重新匯入時 `team:state` 的 questions 即時更新（以瀏覽器開發者工具檢查 Socket payload；學生端題號畫面屬 003 AnswerCard）、重新整理老師頁後摘要仍在、devRoutes GET／reset 可用（`docs/manual-test.md`）
- [ ] T040 [QA] 機密與資訊隔離檢查：`git ls-files` 不含 `.env`、`secrets/`、任何 `*.json` 金鑰；程式、測試、fixtures、README 中沒有真實金鑰內容（`git grep -n private_key` 無結果）；抽查 `team:state` payload 的 `questions` 只含 `id`、`number`、`isGroup`、`subCount`、`subLabels`，且無題目敘述（憲章 IV、VI）（`docs/manual-test.md`）
- [ ] T041 [QA] **Phase 4 驗收**：執行 `npm test`、`npm run lint` 全部通過（含 001 的測試），並確認 `npm run test:e2e` 通過；核對 TECH_SPEC §14.1 002 列每個測試 ID（UT-A1、UT-PARSE、UT-GW-01、03、04、UT-SVC-IMPORT、UT-PROJ-01、UT-UI-IMPORT、E2E-01、02、MA-01、02、09）都有對應且通過的測試或紀錄；依憲章原則 XI 對 `diagrams/002-component.puml`、`002-class.puml`、`002-sequence.puml` 做最終全面比對（組件與連線、類別欄位與公開方法與關聯、兩段互動順序），不一致先修正（改圖後重新執行 `java -jar plantuml.jar "./diagrams/*.puml"` 並確認無錯誤），於本任務記錄比對結果（`diagrams/002-*.puml`）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup [BE]**：依賴 001 Phase 1、2（已完成）
- **Phase 2 後端 [BE]**：依賴 Phase 1
- **Phase 3 前端 [FE]**：依賴 001 Phase 3（`client/` 骨架、`api.ts`、`useTeacher`、`TeacherDashboard`、`ErrorBanner`）；與本子功能 Phase 2 **可並行**（UI 測試 mock `api.ts`，契約見 contracts/）
- **Phase 4 整合 [QA]**：依賴本子功能 Phase 2、3 與 001 Phase 4（`e2e/playwright.config.ts`）

### Within Phases

- 測試任務 → 實作任務（Red → Green）
- Phase 2 順序固定：a1 → parser → gateways → repo／importSheet → projections → 路由與組裝
- 同檔依序修改、不可平行：`server/test/sheets/parser.test.ts`（T008 → T009）；`server/test/services/session.import.test.ts`（T015 → T019）；`server/src/services/sessionService.ts`（T017 → T021）；`e2e/tests/import.spec.ts`（T035 → T036 → T037）
- T018（測試補 `importSummary: null`）與 T020（型別新增欄位）之間 `npm run lint` 的 typecheck 可能暫時失敗，以 T026 的結果為準

### Parallel Opportunities

- Phase 1：T002、T003 平行
- Phase 2：T011（fake 測試）與 T013（google 測試）平行；T023（devRoutes）可與 T022 平行
- Phase 3：T027、T028 平行；T032 可與 T031 平行
- **跨 Phase**：後端成員做 Phase 2，前端成員在 001 Phase 3 合併後做 Phase 3，兩者不修改同一檔案

---

## Parallel Example

```bash
# Phase 2 的 gateway 測試同時撰寫：
Task: "T011 UT-GW-04 in server/test/sheets/fakeGateway.test.ts"
Task: "T013 UT-GW-01、03 in server/test/sheets/googleGateway.test.ts"

# Phase 3 的元件測試同時撰寫：
Task: "T027 UT-UI-IMPORT-01、03、04 in client/test/components/ImportForm.test.tsx"
Task: "T028 UT-UI-IMPORT-02 in client/test/components/ImportSummary.test.tsx"
```

---

## Implementation Strategy

1. **Phase 1** → 驗收 T005
2. **Phase 2**（MVP：伺服器能以 fake 模式正確匯入兩份範例）→ 驗收 T026 → 合併
3. **Phase 3**（001 前端完成後）→ 驗收 T034 → 合併
4. **Phase 4** → E2E、README、手動驗收、最終圖表比對 T041
5. **合併條件**（TECH_SPEC §14.1）：002 列全部測試、前面子功能全部測試、`npm run lint` 通過，且 T041 完成

---

## 追溯表

### TECH_SPEC §14.1 002 列測試 ID → 任務

| 測試 ID | 測試任務 | 實作任務 |
| --- | --- | --- |
| UT-A1-01～07 | T006 | T007 |
| UT-PARSE-01～20 | T008 | T003、T010 |
| UT-PARSE-21～22 | T009 | T010 |
| UT-GW-04 | T011 | T012 |
| UT-GW-01、03 | T013 | T014 |
| UT-SVC-IMPORT-01～06 | T015、T019 | T004、T016、T017、T021 |
| UT-PROJ-01 | T018 | T020 |
| UT-UI-IMPORT-01、03、04 | T027 | T031 |
| UT-UI-IMPORT-02 | T028 | T032 |
| E2E-01 | T035 | T022–T025、T029、T030、T033 |
| E2E-02 | T036 | T017、T022、T033 |
| MA-01、MA-02、MA-09 | T039 | T014、T025、T038 |

### 無自動化測試 ID 的需求 → 驗證任務（plan.md「驗證範圍與後續子功能」）

| 需求 | 驗證任務 |
| --- | --- |
| FR-001a 重疊匯入以最後完成者為準 | T017（交易設計）、T039 |
| FR-023 重新整理後仍見摘要 | T019（UT-SVC-IMPORT-01 補斷言）、T039 |
| US1 情境 6、US4 情境 4：學生即時收到題號（資料） | T019（TeamView.questions）、T039；學生等待畫面的題號顯示屬 003 AnswerCard（TECH_SPEC §10.4「phase ≠ RUNNING」），002 不改 `Play.tsx` |
| US4 情境 2、FR-019：重新匯入失敗保留舊題目與摘要 | T015（UT-SVC-IMPORT-04 以 READY 為前置） |
| spec Edge Cases 的 parser 邊界規則 | T010（實作）、T026（parser.ts 覆蓋率；未達時依原則 II 提案新增 TEST_SPEC ID） |
| FR-017 錯誤只顯示一次、格式說明 | T027（UT-UI-IMPORT-03）、T030、T031、T033 |
| SC-003 助教另一份 Guided Notes | T039（手動紀錄欄位） |
| devRoutes、fakeGateway.getSnapshot／reset | T035（前置 reset）、T039；完整測試屬 004 |
| SC-005 fake 模式 < 2 秒 | T035（E2E-01 計時） |

### User story → 任務

| Story | 後端 | 前端 | 整合 |
| --- | --- | --- | --- |
| US1 匯入並確認題目結構（P1） | T006–T008、T010、T011、T012、T015–T025 | T027–T033 | T035、T039 |
| US2 版面不同也能辨識（P1） | T003、T008、T009、T010 | — | T038、T039（MA-02） |
| US3 失敗原因明確、活動不受影響（P2） | T006、T007、T013、T014、T015、T017 | T027、T031 | T039 |
| US4 等待開始階段重新匯入（P2） | T015（UT-SVC-IMPORT-02）、T016、T017 | T030、T033 | T036 |

---

## Notes

- 測試名稱必須含 TEST_SPEC ID；測試不依賴真實時間、亂數、網路
- 業務邏輯禁止直接呼叫 `Date.now()`、`setTimeout`、`Math.random()` 或 googleapis SDK（SDK 只出現在 `googleGateway.ts` 與 `index.ts`）
- 「覆蓋測試」標註的模組沒有 TEST_SPEC 專屬 ID，由所列測試驗證；不新增無 ID 的測試
- 每完成一個邏輯群組就 commit
