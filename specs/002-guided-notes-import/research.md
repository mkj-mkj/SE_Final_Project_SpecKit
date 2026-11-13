# Research：匯入 Guided Notes（002-guided-notes-import）

**日期**：2026-11-13　**依據**：`docs/TECH_SPEC.md` v1.6、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2

Technical Context 沒有 NEEDS CLARIFICATION；以下記錄本子功能的設計決策與已與使用者確認的契約差異。

## 已確認的契約差異（D1–D9）

| # | 差異 | 決議（2026-11-13） |
| --- | --- | --- |
| D1 | TECH_SPEC §7.4 原寫 `${FAKE_SHEETS_DIR}/${id}.snapshot.json`，但 ID 為 `fixture-template-a`、實際檔名為 `template-a.snapshot.json` | 使用者同意：fakeGateway 只接受 `fixture-` 開頭的 ID，去掉前綴後讀 `{名稱}.snapshot.json`；TECH_SPEC 已改為 v1.5 |
| D2 | 類別圖 `FakeSheetsGateway.reset()` 無參數，§8.4 為每個試算表重設 | 圖改為 `reset(spreadsheetId)` |
| D3 | 圖缺 `devRoutes`（§8.4） | 組件圖、類別圖加入 |
| D4 | 類別圖 a1 缺 `quoteSheet`、`rangeA1` | 加入；googleGateway 依賴 `quoteSheet` |
| D5 | 介面要求 `writeCells`，但 §14.1 把 writeCells 放在 004 | 002 兩個 gateway 的 `writeCells` 丟出 `AppError('SHEETS_ERROR')`，004 實作 |
| D6 | 時序圖只檢查一次階段；讀取試算表期間老師可能按下開始 | 交易內重新讀 session 並 `assertPhase(…, 'import')` |
| D7 | 圖早於 TECH_SPEC v1.4 | ImportForm 忙碌狀態「匯入中…」、ImportSummary 固定文字已加入圖 |
| D8 | 組件圖缺 `config.ts`／`index.ts` 依 `SHEETS_MODE` 組裝 gateway | 已加入 |
| D9 | §7.8 `SessionAggregate` 沒有 `importSummary`，`projectTeacherView` 無法輸出摘要 | 使用者同意：`SessionAggregate` 新增 `importSummary: ImportSummary \| null`；TECH_SPEC 已改為 v1.6 |

三張圖已更新並重新產生 PNG（`java -jar plantuml.jar "./diagrams/*.puml"` 無錯誤）。

## R-01 Google Sheets 套件：googleapis

- **Decision**：使用 `googleapis`（純 JavaScript，無 `.node` 原生模組），以 `google.auth.GoogleAuth({ keyFile: config.googleCredentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })` 建立 client，`google.sheets({ version: 'v4', auth })` 後注入 `createGoogleGateway(client)`。
- **Rationale**：TECH_SPEC §3.1 已指定 googleapis；`createGoogleGateway` 參數型別為 `sheets_v4.Sheets`；client 由 `index.ts` 建立，測試以 mock 物件取代（UT-GW-01、03），不連網。
- **Alternatives**：`@googleapis/sheets`（較小但與 TECH_SPEC 的 `sheets_v4` 匯入路徑不同，需改契約）；直接呼叫 REST（要自行處理 JWT 簽章，風險高）。皆不採用。
- **機密**：金鑰路徑只放 `.env` 的 `GOOGLE_APPLICATION_CREDENTIALS`（預設 `./secrets/service-account.json`）；`secrets/` 已在 `.gitignore`（001）。

## R-02 googleGateway.fetchSnapshot 的範圍補齊

- **Decision**：先 `spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title),merges)' })`，再 `values.batchGet({ ranges: 每個工作表 quoteSheet(title), valueRenderOption: 'FORMATTED_VALUE' })`；解析每個回傳 `range`（如 `'學習單'!B2:H16`）的起始儲存格，在前面補空列、每列前補空字串，使 `values[0][0]` 對應 A1（UT-GW-01）。
- **Rationale**：Google 只回傳有資料的範圍，必須補齊才能讓 `row`／`col` 與 A1 位址一致（憲章原則 V）。
- **錯誤對照**：讀取錯誤物件的 HTTP 狀態（`code` 或 `response.status`）：403 → `SHEETS_PERMISSION_DENIED`、404 → `SHEETS_NOT_FOUND`、其他 → `SHEETS_ERROR`（UT-GW-03）。

## R-03 fakeGateway 讀檔與記憶體副本

- **Decision**：`fakeGateway(dir)` 工廠回傳物件：`fetchSnapshot(id)` 檢查 `/^fixture-([A-Za-z0-9_-]+)$/`，第一次讀 `{dir}/{名稱}.snapshot.json` 後存在記憶體 Map，回傳深拷貝；`getSnapshot(id)` 回傳記憶體版本（未讀過則先載入）；`reset(id)` 重新從檔案載入；`writeCells` 於 002 丟出 `SHEETS_ERROR`（D5）。
- **Rationale**：符合 TECH_SPEC v1.5 §7.4；`'nope'`、`'../x'` 不符正規式直接 `SHEETS_NOT_FOUND`，不會讀到資料夾外的檔案（UT-GW-04）。
- **讀檔**：以 `node:fs/promises` 讀檔屬於 adapter（不是業務邏輯），符合原則 VIII。

## R-04 parser 實作方式

- **Decision**：`parseGuidedNotes` 為純函式，逐條依 TECH_SPEC §7.3 的 10 個步驟實作，每一步以繁中註解標示步驟編號；只用 `toA1` 產生 A1，不出現任何寫死位址。
- 合併範圍查找：對每個題目起點列找 `startRowIndex ≤ r < endRowIndex` 且 `startColumnIndex ≤ numberCol < endColumnIndex` 的 merge（同一 sheetId）。
- 後備規則（步驟 5）只在「非跨列合併的單題」且作答格前綴為「（1）」時啟動（全形；與 §7.3 原文一致）。
- 題號正規式 `/^\d+(\.0+)?$/` 與 `parseInt`：`01`、`002`、`03.0` → 1、2、3；`0` → 0（PRD v1.2 §9；UT-PARSE-21、22）。
- 警告 message 為繁中，例：`題號不是從 1 連續：0、2、3、4、5、6`、`第 1 題子題編號不是 1..n 遞增，已自動重編`；`DUPLICATE_QUESTION_NUMBER` 的 message 為 `題號重複：2`（含重複題號）。

## R-05 importSheet 的交易與競態

- **Decision**：順序為 `assertPhase` → `parseSpreadsheetInput` → `await sheets.fetchSnapshot` → `parseGuidedNotes` → `summarize` → `withTransaction`（重新讀 session 並 `assertPhase`、`deleteQuestionsBySession`、插入 questions／slots、更新 session、`setImportSummary`）→ `broadcaster.publish(sessionId)`（預設 scope：teacher + 全部組，§9.3）。
- **Rationale**：網路讀取不可放進同步交易；交易內再檢查一次階段可避免讀取期間開始搶答造成題目被替換（D6、FR-003）。兩次重疊的匯入各自在交易中整批寫入，最後完成者覆蓋前者，符合 spec FR-001a。
- 舊題目刪除：`questions` 對 `answer_slots`、`drafts` 皆 `ON DELETE CASCADE`，只刪 questions 即可（不需 003 的 drafts repo）。
- ID：`ids.id('q')`、`ids.id('slot')`；`Question.state='open'`、`windowEndsAt=null`、`subCount=slots.length`。

## R-06 projections 擴充

- **Decision**：`questionInfo(q, slots)`：取該題 slots 依 subNo 排序；題組 `subLabels = slot.prefix || \`（${subNo}）\``，單題 `['']`（UT-PROJ-01）。`projectTeacherView` 的 `questions` = `questionInfo` 加上 `state`、`windowEndsAt`、`winnerTeamId: null`（得主由 003 計算），依題號排序；`importSummary = agg.importSummary`。`projectTeamView` 的 `questions` 只放 `QuestionInfo`（不含 state，FR-10）。
- `SessionService.loadAggregate` 補讀 questions、slots、importSummary（D9）。

## R-07 前端

- **Decision**：`useTeacher.importSheet(spreadsheet)` 呼叫 `POST /api/teacher/sessions/:id/import`，期間 `busy=true`；`ImportForm` 在輸入為空白或 `busy` 時 disable `import-submit`，忙碌文字「匯入中…」（UT-UI-IMPORT-01、04）；`ImportSummary` 依 `TeacherView.importSummary` 顯示固定文字與 `import-warning-{i}`（UT-UI-IMPORT-02）；錯誤由 `useTeacher.error` 經 TeacherDashboard 唯一的 ErrorBanner 顯示；`HEADER_NOT_FOUND` 時 ImportForm 只在表單下方顯示範本格式說明（UT-UI-IMPORT-03；內容依 spec FR-017），不另外渲染 ErrorBanner，避免重複（analyze M3）。
- 摘要與題號清單來自 `teacher:state` 快照（重新整理後仍在，FR-023）。

## R-08 makeTestService 與 fixtures.ts

- **Decision**：新增 `server/test/helpers/fixtures.ts`（TEST_SPEC §3 全部 6 個函式），以 `node:fs` 讀 `fixtures/sheets`；`makeTestService` 預設 `snapshots = { 'fixture-template-a': loadSnapshot('template-a'), 'fixture-template-b': loadSnapshot('template-b') }`（§14.1 補充）。
- 001 既有測試以 `makeTestService()` 建立服務，預設載入 fixture 不影響其結果。
