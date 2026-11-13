# Implementation Plan: 匯入 Guided Notes（002-guided-notes-import）

**Branch**: `002-guided-notes-import` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-guided-notes-import/spec.md`

**藍圖（憲章原則 XI）**：[`diagrams/002-component.puml`](../../diagrams/002-component.puml)、[`diagrams/002-class.puml`](../../diagrams/002-class.puml)、[`diagrams/002-sequence.puml`](../../diagrams/002-sequence.puml)（2026-11-13 依差異 D2–D8 更新並重新產生 PNG）

**契約依據**：`docs/TECH_SPEC.md` v1.6、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2。型別、函式簽名、API 路徑、錯誤碼、`data-testid` 照抄 TECH_SPEC，不得改名。D1（fake 讀檔規則，TECH_SPEC v1.5）與 D9（`SessionAggregate.importSummary`，v1.6）已經使用者同意並修改 TECH_SPEC（見 [research.md](./research.md)）。

## Summary

讓老師貼上 Google Sheets 網址或 ID（示範模式為 `fixture-template-a`／`b`）匯入 Guided Notes：伺服器讀取試算表快照，依「題號／作答」表頭動態定位、辨識題組與單題，保存每個作答格的位置與原始內容，活動進入「等待開始」，老師端顯示摘要與題號清單，學生端同步收到題號。範圍嚴格限定在 TECH_SPEC §14.1「002-guided-notes-import」一列：

- **server/**：`sheets/a1.ts`（§7.2 全部）、`sheets/parser.ts`（§7.3 十步驟＋`summarize`）、`sheets/fakeGateway.ts`（fetchSnapshot、getSnapshot、reset）、`sheets/googleGateway.ts`（createGoogleGateway、fetchSnapshot 與錯誤對照）、repo（questions、answer_slots、import_summary）、`SessionService.importSheet`、projections（`questionInfo`、TeacherView 的 questions 與 importSummary、TeamView 的 questions）、`POST /api/teacher/sessions/:id/import`、`devRoutes`（§8.4）、`index.ts` 依 `SHEETS_MODE` 組裝 gateway、測試替身 `fixtures.ts`、`makeTestService` 預設載入兩份 fixture。
- **client/**：`ImportForm`、`ImportSummary`、`useTeacher.importSheet`、TeacherDashboard 的 READY 畫面（題號清單，題組標示子題）。
- **e2e/**：E2E-01、E2E-02。

技術方法：解析器為純函式，只依表頭推得位置並以 `toA1` 產生位址；外部試算表經 `SheetsGateway` 介面注入（Google／fake 兩種實作）；`importSheet` 先在交易外讀取與解析，再於單一交易內重新檢查階段並整批取代題目；指令走 REST、狀態以 `teacher:state`／`team:state` 快照推播。

## Technical Context

**Language/Version**: TypeScript 5.x（`strict: true`）；Node.js 22.13 以上

**Primary Dependencies**:
- 沿用 001：Express 4、Socket.IO 4、zod、`node:sqlite`、dotenv；React 18、Vite 5、React Router 6、socket.io-client
- 新增（server 執行期）：`googleapis`（純 JS；服務帳號；scope 只用 `https://www.googleapis.com/auth/spreadsheets`；research R-01）
- 禁止：任何含 `.node` 原生模組的套件

**Storage**: SQLite（`node:sqlite`）；讀寫 `sessions`（phase、spreadsheet_id、sheet_title、import_summary）、`questions`、`answer_slots`；`drafts` 隨 questions 連帶刪除。fake 模式的試算表快照存記憶體（讀自 `fixtures/sheets`）。

**Testing**: Vitest 2（coverage-v8；`sheets` 模組行覆蓋率 ≥ 95%）、jsdom + @testing-library/react、supertest、Playwright（`channel: 'msedge'`）；fixtures：`fixtures/sheets/template-{a,b}.snapshot.json`、`.expected.json`

**Target Platform**: 本機 Windows 11；Edge／Chrome；`localhost`

**Project Type**: Web application（npm workspaces：shared、server、client、e2e）

**Performance Goals**: fake 模式按「匯入」到顯示摘要 < 2 秒（PRD v1.2 §10、E2E-01）；Google 模式不設上限，匯入期間顯示「匯入中…」

**Constraints**: 禁止寫死儲存格位址，寫回位置只能來自解析結果（原則 V）；金鑰只在 `.env`／`secrets/`（原則 VI）；測試不連網，Google client 以 mock 注入（原則 VII、VIII）；本機執行（原則 X）

**Scale/Scope**: 單一學習單（數十題、數百列以內）；本子功能 45 個 UT／E2E 案例（UT-A1 7、UT-PARSE 22、UT-GW 3、UT-SVC-IMPORT 6、UT-PROJ 1、UT-UI-IMPORT 4、E2E 2）＋手動 MA-01、MA-02、MA-09

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查內容 | 結果 |
| --- | --- | --- |
| I 繁體中文優先 | UI、錯誤訊息（§11 `MESSAGES`）、警告 message、範本格式說明為繁中；識別字英文；parser 每個步驟、`importSheet` 的階段重檢與交易、`questionInfo` 加繁中註解 | ✅ |
| II 文件為準 | 範圍取自 §14.1 002 列；D1、D9 與 TECH_SPEC 的衝突已先列出並經使用者同意修改 TECH_SPEC（v1.5、v1.6）；D2–D8 只改圖表 | ✅ |
| III 伺服器唯一真相 | 題目、作答格、階段由伺服器決定；匯入在單一交易內整批取代；客戶端以快照取代本地狀態 | ✅ |
| IV 資訊隔離 | `TeamView.questions` 只含 `QuestionInfo`（無 state、得主）；匯入不含任何組別資料；題目敘述完全不進入任何 payload（UT-PARSE-01、UT-PROJ-01） | ✅ |
| V 動態定位 | parser 依表頭定位，位址只由 `toA1(row, col)` 產生；以兩份 fixture 及位移、刪合併、前置工作表等變形驗證（UT-PARSE-01～22） | ✅ |
| VI 機密管理 | `GOOGLE_APPLICATION_CREDENTIALS` 指向 `secrets/`（已在 `.gitignore`）；`.env.example` 只有假值；測試不使用真實金鑰 | ✅ |
| VII 測試先行 | 有 ID 的模組先寫測試並確認失敗；Google client 以 mock、試算表以 `InMemorySheetsGateway`；無 ID 的組裝模組列為例外（Complexity Tracking） | ⚠️ 有書面例外 |
| VIII 可測設計 | `parseGuidedNotes`、`summarize`、`questionInfo`、a1 皆為純函式；`createGoogleGateway(client)` 注入 client；`SessionService` 經 `SheetsGateway` 取得試算表；路由只做 zod 驗證與轉換 | ✅ |
| IX 子功能並行 | 獨立目錄 `specs/002-guided-notes-import/`；tasks 以 [BE]／[FE]／[QA] 分開；共用型別不改（D9 改 §7.8 已取得同意） | ✅ |
| X 本機執行 | fake 模式免金鑰；`devRoutes` 只在 fake 掛載；無部署元件 | ✅ |
| XI PlantUML 設計優先 | 圖表已依 D2–D8 更新並重新產生 PNG；本 plan 以圖為藍圖；tasks 最後須有「程式碼與圖表一致性驗證」任務 | ✅ |
| 技術約束 | 新增執行期相依只有 `googleapis`（TECH_SPEC §3.1 已列，純 JS） | ✅ |

**Gate 結果**：通過；原則 VII 的例外記錄於 Complexity Tracking。Phase 1 設計後重新檢查：結果不變。

## 設計要點（以圖表為藍圖）

### 組件（`diagrams/002-component.puml`）

| 圖表組件 | 對應檔案 | 002 範圍 |
| --- | --- | --- |
| 管理頁 TeacherDashboard | `client/src/pages/TeacherDashboard.tsx` | READY 畫面：ImportForm（SETUP／READY）、ImportSummary、題號清單 |
| 匯入表單 ImportForm | `client/src/components/ImportForm.tsx` | 全部（含 busy「匯入中…」） |
| 匯入摘要 ImportSummary | `client/src/components/ImportSummary.tsx` | 全部（固定文字、警告） |
| 錯誤橫幅 ErrorBanner | `client/src/components/ErrorBanner.tsx`（001） | 不修改；由 ImportForm 引用，HEADER_NOT_FOUND 時 ImportForm 在其下方加顯示範本格式說明（UT-UI-IMPORT-03） |
| useTeacher.importSheet | `client/src/hooks/useTeacher.ts`（001） | 新增 `importSheet` |
| 啟動與設定 | `server/src/index.ts`、`server/src/config.ts`（001） | 依 `sheetsMode` 建 googleGateway（GoogleAuth＋`google.sheets`）或 fakeGateway；fake 時傳入 `fakeSheets` 讓 app 掛 devRoutes |
| HTTP 路由 | `server/src/http/teacherRoutes.ts`（001） | 新增 import 路由 |
| 開發用路由 | `server/src/http/devRoutes.ts`、`server/src/app.ts` | §8.4 全部 |
| 匯入服務 | `server/src/services/sessionService.ts` | `importSheet`、`loadAggregate` 補 questions／slots／importSummary |
| 階段規則 | `server/src/domain/phase.ts`（001） | 沿用 `assertPhase(…, 'import')`、`nextPhase` |
| 網址與位址 | `server/src/sheets/a1.ts` | §7.2 全部 |
| 解析器 | `server/src/sheets/parser.ts` | §7.3 全部 |
| 視圖投影 | `server/src/domain/projections.ts`（001） | `questionInfo`、TeacherView／TeamView 的 questions、importSummary |
| Repo | `server/src/db/repo.ts`（001） | 新增 7 個方法（data-model §4） |
| Google 閘道 | `server/src/sheets/googleGateway.ts` | createGoogleGateway、fetchSnapshot、錯誤對照；writeCells 暫丟 SHEETS_ERROR |
| 示範閘道 | `server/src/sheets/fakeGateway.ts` | fetchSnapshot、getSnapshot、reset；writeCells 暫丟 SHEETS_ERROR |

### 類別與方法（`diagrams/002-class.puml`）

| 方法 | 錯誤 | 推播（§9.3） |
| --- | --- | --- |
| `parseSpreadsheetInput` | INVALID_SPREADSHEET_URL | — |
| `parseGuidedNotes` | HEADER_NOT_FOUND、NO_QUESTIONS、DUPLICATE_QUESTION_NUMBER | — |
| `googleGateway.fetchSnapshot` | SHEETS_PERMISSION_DENIED、SHEETS_NOT_FOUND、SHEETS_ERROR | — |
| `fakeGateway.fetchSnapshot`／`getSnapshot`／`reset` | SHEETS_NOT_FOUND | — |
| `SessionService.importSheet` | SESSION_NOT_FOUND、INVALID_PHASE、上列全部 | teacher + 全部組 |

### 互動順序（`diagrams/002-sequence.puml`）

兩段流程（匯入成功、找不到表頭）對應 UT-SVC-IMPORT-01、06、E2E-01 與 quickstart 步驟 2、4。交易內重新檢查階段（D6）。

## Project Structure

### Documentation (this feature)

```text
specs/002-guided-notes-import/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0（含差異 D1–D9）
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── rest-api.md      # import 路由、devRoutes
│   ├── sheets-modules.md# a1、parser、gateways、projections、importSheet
│   └── ui-testids.md    # ImportForm、ImportSummary、READY 畫面
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 產生
```

### Source Code (repository root)

```text
/
├─ README.md                         # 補：範例 ID、Google 設定、題號／作答表頭格式（MA-01、MA-09、PRD §9）
├─ server/
│   ├─ package.json                  # 新增 googleapis
│   ├─ src/
│   │   ├─ index.ts  app.ts          # 修改：依 SHEETS_MODE 組裝 gateway；fake 時掛 /api/dev
│   │   ├─ sheets/   a1.ts  parser.ts  googleGateway.ts  fakeGateway.ts      # 新增
│   │   ├─ domain/   projections.ts  # 修改
│   │   ├─ db/       repo.ts         # 修改
│   │   ├─ services/ sessionService.ts                                     # 修改
│   │   └─ http/     teacherRoutes.ts（修改）  devRoutes.ts（新增）
│   └─ test/
│       ├─ helpers/  fixtures.ts（新增）  makeTestService.ts（修改：預設載入 fixture）
│       ├─ sheets/   a1.test.ts  parser.test.ts  googleGateway.test.ts  fakeGateway.test.ts
│       ├─ domain/   projections.test.ts（修改：UT-PROJ-01；aggregate 補 importSummary）
│       └─ services/ session.import.test.ts
├─ client/
│   ├─ src/components/ ImportForm.tsx  ImportSummary.tsx                    # 新增
│   ├─ src/api.ts  src/hooks/useTeacher.ts  src/pages/TeacherDashboard.tsx  # 修改
│   └─ test/components/ ImportForm.test.tsx  ImportSummary.test.tsx
└─ e2e/tests/ import.spec.ts         # E2E-01、E2E-02
```

**Structure Decision**: 沿用 TECH_SPEC §2 的 npm workspaces 結構與 001 已建立的檔案。`sheets/exporter.ts`、`export/csv.ts`、writeCells 實作屬 004，不預先建立。

## 前置依賴與對既有程式的影響

- **001 尚未完成 Phase 3（前端）與 Phase 4（E2E）**：`client/`、`e2e/` 目前不存在。002 的 [BE] 任務可立即開始；[FE] 任務與 E2E-01、02 必須等 001 Phase 3、4 完成。
- **D9 影響 001 已合併程式**：`SessionAggregate` 新增必填欄位 `importSummary`，`server/src/services/sessionService.ts` 的 `loadAggregate` 與 `server/test/domain/projections.test.ts` 建立 aggregate 的地方要補上欄位（002 的 [BE] 任務處理，否則 typecheck 失敗）。
- `server/src/index.ts` 的 `sheetsNotAvailable` 由真正的 gateway 取代。
- `makeTestService` 改為預設載入兩份 fixture；001 的測試不受影響（不使用 gateway）。

## 驗證範圍與後續子功能

| 需求 | 002 的驗證方式 | 自動化驗證所在 |
| --- | --- | --- |
| FR-001a（重疊匯入以最後完成者為準） | 由交易設計保證（research R-05）；quickstart 手動 | —（TEST_SPEC 無案例） |
| FR-023（重新整理後仍見摘要）、學生即時收到題號 | UT-SVC-IMPORT-01 額外斷言 `getTeacherView().importSummary`；quickstart 步驟 5、6 | 003：IT-SYNC-01 |
| devRoutes、fakeGateway.getSnapshot／reset | E2E 每個 spec 前呼叫 reset（TEST_SPEC §7）；quickstart 步驟 7 | 004：UT-GW-05、IT-FLOW-01、E2E-14、15 |
| MA-01、MA-02、MA-05、MA-09 | 手動，記錄於 `docs/manual-test.md` | — |

## Complexity Tracking

| 例外 | 為何需要 | 為何不採用較簡單的做法 |
| --- | --- | --- |
| 原則 VII：`devRoutes.ts`、`index.ts` 的 gateway 組裝（GoogleAuth、`google.sheets`）、`app.ts` 掛載、`teacherRoutes` 的 import 路由、`useTeacher.importSheet`、TeacherDashboard READY 畫面，沒有 002 專屬 TEST_SPEC 案例 ID | §14.1 的 002 列沒有這些模組的 ID；原則 II 禁止自行新增 ID。改由既有 ID 覆蓋：import 路由與 hook 由 E2E-01、02 驗證；devRoutes 由 E2E 前置 reset 呼叫與 004 的 E2E-14、15、IT-FLOW-01 驗證；Google 組裝由手動 MA-01、MA-02 驗證 | 寫無 ID 的測試違反原則 VII 命名規則；Google 組裝需要真實金鑰與網路，依原則 VII 不應寫成 unit test |
| D5：002 的 `writeCells` 只丟出 `SHEETS_ERROR` | `SheetsGateway` 介面要求 `writeCells`，但 §14.1 把寫回放在 004 | 提前實作寫回會超出 002 範圍並缺少 004 的測試（UT-GW-02、05） |
