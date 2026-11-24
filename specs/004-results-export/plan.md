# Implementation Plan：結果與匯出（004-results-export）

**Branch**: `004-results-export`（feature 名稱，與 spec 相同；git 工作分支為 `spec/004`，以 `.specify/feature.json` 定位目錄） | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-results-export/spec.md`

**藍圖（憲章原則 XI）**：[`diagrams/004-component.puml`](../../diagrams/004-component.puml)、[`diagrams/004-class.puml`](../../diagrams/004-class.puml)、[`diagrams/004-sequence.puml`](../../diagrams/004-sequence.puml)（2026-11-24 依差異 D1、D2 先更新圖表，PNG 已重新產生且無錯誤）

**契約依據**：`docs/TECH_SPEC.md` v1.6、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2。型別、函式簽名、API 路徑、錯誤碼、`data-testid` 照抄 TECH_SPEC。與 docs 的差異 D1、D2 已由使用者決定（2026-11-24），D3 為 docs 未定義處；三者需同步的 docs 段落列於 [research.md](./research.md)，**本 plan 不修改 docs/**。

## 實作前置閘門（憲章原則 II，analyze C1）

D1、D2、D3 已由使用者決定，但在 `docs/` 同步前，spec／plan／tasks 與 docs 仍有矛盾。依憲章原則 II，**本 plan 不修改 docs/**；由使用者依下表修改後，tasks T001 才會通過，之後才能開始任何實作任務。T001 檢查不通過時 MUST 停止並回報，不得自行改寫 docs 或改回舊行為。

| 文件 | 段落 | 需加入的內容 |
| --- | --- | --- |
| `docs/PRD.md` | §8 第 9 點 | 句末加：「例外：題目因判錯而沒有得主時，寫回會把該題作答格恢復為匯入時的原始值（E5：匯出以最終得主為準）。」；§13 變更紀錄加一列（來源 specs/004 clarify） |
| `docs/TECH_SPEC.md` | §7.9 表格 exportToSheet 列 | 演算法改為：「`buildExportWrites` ＋ 對 `winnerOf` 為 null 且有 `rejected` 送出的題目 `buildRestoreWrites`（該題 slots）→ 依 sheetTitle、row、col 合併排序 → 非空時 `sheets.writeCells`」 |
| `docs/TECH_SPEC.md` | §12.6 時序圖 | `buildExportWrites` 之後加一步「＋ 判錯到無得主題目的 buildRestoreWrites」 |
| `docs/TECH_SPEC.md` | §10.4 元件表 | ResultsTable 用途改為「結果、判錯（RUNNING、ENDED 顯示）」；ExportPanel 補「`export-result` 文字：已寫回 {n} 格／已還原 {n} 格」 |
| `docs/TEST_SPEC.md` | §5.6 UT-SVC-REJ | 新增 **UT-SVC-REJ-07**：「ENDED，第 3 題唯一送出被判錯後匯出 → gateway 收到 G11 = originalValue，updatedCells 含該格」 |
| `docs/TEST_SPEC.md` | §5.8 client | 新增 **UT-UI-EXP-02**：「ExportPanel 還原成功 6 格 → `export-result` 顯示『已還原 6 格』」 |
| `docs/TEST_SPEC.md` | §10 追溯矩陣 | FR-06 列加 UT-UI-EXP-02；E5 列加 UT-SVC-REJ-07 |
| `docs/TECH_SPEC.md` | §14.1 004 列 | 測試欄加 UT-SVC-REJ-07、UT-UI-EXP-02 |

## Summary

搶答結束後老師與學生看到結果（每題得主、答案、各組順位、分數）；老師可在搶答中或結束後判錯，系統依既有順位自動遞補；結束後老師可把最終得主答案寫回原 Guided Notes 的作答格（位置只來自 002 記錄的 `answer_slots`）、還原原始內容、下載 Excel 可直接開啟的 CSV。範圍嚴格限定在 TECH_SPEC §14.1「004-results-export」一列：

- **server/**：`sheets/exporter.ts`（§7.4）；`googleGateway.writeCells`、`fakeGateway.writeCells`；`export/csv.ts`（§7.5）；`projections.buildCsvRows`；`SessionService` 的 rejectWinner、exportToSheet、restoreSheet、exportCsv；路由 `POST /api/teacher/sessions/:id/questions/:qid/reject-winner`、`/export`、`/restore`、`GET /export.csv`。
- **client/**：useTeacher 的 rejectWinner、exportToSheet、restoreSheet、downloadCsv；`ResultsTable`、`ExportPanel`、`StudentResults`；AnswerCard 的 rejected 狀態；Play 的 ENDED 畫面（以及 TeacherDashboard 組裝這些元件）。
- **測試**：UT-EXP、UT-CSV、UT-GW-02、UT-GW-05、UT-PROJ-09、UT-SVC-REJ、UT-SVC-EXPORT、UT-UI-RES、UT-UI-EXP、UT-UI-CARD-06、UT-UI-PLAY-03、IT-FLOW-01、IT-CSV-01、IT-VIS-02、E2E-12～17；手動 MA-03～08；全部測試回歸與 TEST_SPEC §2.3 覆蓋率門檻。

技術方法：判錯只把得主送出的 `status` 改為 `rejected`，得主、順位、分數一律由既有 `ranking.ts` 從送出紀錄重新推導（不另外儲存）；寫回與還原由純函式 `exporter.ts` 產生 `CellWrite[]`，再經 `SheetsGateway.writeCells`（Google：`spreadsheets.values.batchUpdate`、`valueInputOption: 'RAW'`）寫入；CSV 由純函式 `buildCsvRows` → `buildResultsCsv` 產生。

## Technical Context

**Language/Version**: TypeScript 5.x（`strict: true`）；Node.js 22.13 以上（沿用 001 plan）

**Primary Dependencies**:
- 沿用 001～003：Express 4、Socket.IO 4、zod、`node:sqlite`、dotenv、**googleapis**（002 已加入，純 JS）；React 18、Vite 5、React Router 6、socket.io-client
- 新增：**無**（CSV 自行實作；research R-12）
- 禁止：任何需要 `.node` 原生模組的套件

**Storage**: SQLite（`node:sqlite`）；schema 不修改。讀 `sessions`、`questions`、`answer_slots`、`teams`、`members`、`submissions`；唯一寫入為 `submissions.status`（active → rejected）。fake 模式寫回結果另存 `data/fake-sheets/<id>.json`（`data/` 已在 `.gitignore`）。

**Testing**: Vitest 2（coverage-v8）；`InMemorySheetsGateway`（`failNext`）、`FakeClock`、`RecordingBroadcaster`、`seed.ts`（001～003 既有）；googleGateway 以 mock `sheets_v4.Sheets` 測試、不連網；整合測試用真實 HTTP + Socket.IO + fake 閘道；jsdom + @testing-library/react；Playwright（`channel: 'msedge'`）

**Target Platform**: 本機 Windows 11；Edge／Chrome；`localhost`

**Project Type**: Web application（npm workspaces：shared、server、client、e2e）

**Performance Goals**: 結束或判錯後 1 秒內所有分頁顯示最新結果（E2E-12、13）；fake 模式寫回到顯示「已寫回 N 格」< 2 秒（spec SC-010）

**Constraints**: 寫回位置只能來自 `answer_slots`；只改作答格的值（RAW，不改格式與合併）；判錯在單一同步交易內完成；RUNNING 中判錯不得讓他組得知任何資訊（FR-10）；export、csv 只在 ENDED，restore 只在 READY／ENDED；本機執行

**Scale/Scope**: 10 組 × 數十題；本子功能 42 個測試案例（server UT 27：EXP 4、CSV 7、GW 2、PROJ 1、SVC-REJ 7（含 D1 的 07）、SVC-EXPORT 6；client UT 6：RES 2、EXP 2（含 D3 的 02）、CARD 1、PLAY 1；IT 3；E2E 6）＋ 手動 MA-03～08

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查內容 | 結果 |
| --- | --- | --- |
| I 繁體中文優先 | UI 文字（「判錯」「無」「已寫回 N 格」「已還原 N 格」「老師判定此答案錯誤」）與 §11 錯誤訊息為繁中；識別字英文；判錯遞補、寫回格式、D1 原始值規則、CSV 防公式與跳脫加繁中註解 | ✅ |
| II 文件為準 | 範圍取自 §14.1 004 列；D1、D2 與 TECH_SPEC／PRD 的衝突已先列出並由使用者決定；需同步的 docs 段落列於「實作前置閘門」，本 plan 不改 docs/；docs 未同步前 T001 不通過、不得實作 | ✅（以閘門保證） |
| III 伺服器唯一真相 | 得主、分數只由 `ranking.ts` 推導；判錯路由無本文，不採信客戶端任何得主或分數；單一同步交易 | ✅ |
| IV 資訊隔離 | 學生資料仍只經 `projectTeamView`；`results` 只在 ENDED；RUNNING 判錯後他組 payload 不含判錯資訊（IT-VIS-02、UT-SVC-REJ 斷言） | ✅ |
| V 動態定位 | 寫回／還原位置只取 `AnswerSlot.sheetTitle`、`a1`；程式中無任何儲存格常數；以範例 A、B 兩份 fixture 驗證（UT-EXP、IT-FLOW-01、MA-03） | ✅ |
| VI 機密管理 | 不新增機密；服務帳號金鑰沿用 `secrets/`；fake 輸出在 `data/`（已忽略） | ✅ |
| VII 測試先行 | 每個模組先寫有 ID 的測試並確認失敗；閘道一律 InMemory／mock，不連網；D1、D3 的測試 ID（UT-SVC-REJ-07、UT-UI-EXP-02）由閘門要求先登錄於 TEST_SPEC | ✅（以閘門保證；接線模組例外見 Complexity Tracking） |
| VIII 可測設計 | exporter、csv、buildCsvRows 為純函式；SessionService 經 `SheetsGateway` port 注入；路由只做轉換與標頭 | ✅ |
| IX 子功能並行 | 獨立目錄；tasks 以 [BE]／[FE]／[QA] 分開；共用型別、錯誤碼、testid 不改 | ✅ |
| X 本機執行 | 無部署元件；fake 模式可完整示範寫回 | ✅ |
| XI PlantUML 設計優先 | 以 004 三張圖為藍圖；D1、D2 先改圖並重新產生 PNG；tasks 最後須有「程式碼與圖表一致性驗證」任務 | ✅ |
| 技術約束 | 不新增相依；googleapis 已存在且無原生模組 | ✅ |

**Gate 結果**：通過；原則 VII 的例外記錄於 Complexity Tracking。Phase 1 設計後重新檢查：結果不變。

## 設計要點（以圖表為藍圖）

### 組件（`diagrams/004-component.puml`）

| 圖表組件 | 對應檔案 | 004 範圍 |
| --- | --- | --- |
| 結果表 ResultsTable | `client/src/components/ResultsTable.tsx`（新增） | 全部；由 TeacherView 推導（research R-09） |
| 匯出面板 ExportPanel | `client/src/components/ExportPanel.tsx`（新增） | 全部 |
| 學生結果 StudentResults | `client/src/components/StudentResults.tsx`（新增） | 全部 |
| 作答卡 AnswerCard | `client/src/components/AnswerCard.tsx`（003） | 補 rejected 狀態 |
| 管理頁 TeacherDashboard | `client/src/pages/TeacherDashboard.tsx`（001） | RUNNING／ENDED 加 ResultsTable（D2）；READY／ENDED 加 ExportPanel |
| 作答頁 Play | `client/src/pages/Play.tsx`（001） | ENDED 改顯示 StudentResults |
| useTeacher | `client/src/hooks/useTeacher.ts`（001） | rejectWinner、exportToSheet、restoreSheet、downloadCsv（research R-10） |
| HTTP 路由 teacherRoutes | `server/src/http/teacherRoutes.ts`（001） | 新增 4 條路由 |
| 搶答服務 SessionService | `server/src/services/sessionService.ts`（001） | 新增 4 個方法 |
| 階段規則 domain/phase | `server/src/domain/phase.ts`（001） | 不修改（rejectWinner、export、csv、restore 已定義） |
| 排名 ranking | `server/src/domain/ranking.ts`（003） | 不修改 |
| 視圖投影 projections | `server/src/domain/projections.ts`（001） | 新增 `buildCsvRows`（`buildResults` 003 已有） |
| 寫回 sheets/exporter | `server/src/sheets/exporter.ts`（新增） | 全部 |
| CSV export/csv | `server/src/export/csv.ts`（新增） | 全部 |
| googleGateway.writeCells | `server/src/sheets/googleGateway.ts`（002） | 補 writeCells（research R-06） |
| fakeGateway.writeCells | `server/src/sheets/fakeGateway.ts`（002） | 補 writeCells；可省略的 `outDir`（research R-07） |
| Broadcaster | `server/src/realtime/broadcaster.ts`（001） | 不修改；只有 rejectWinner 呼叫 publish |
| 資料存取 Repo | `server/src/db/repo.ts`（001） | 不修改（`updateSubmission`、`listSlotsBySession`、`listSubmissionsByQuestion` 既有） |
| 設定與組裝 | `server/src/config.ts`、`server/src/index.ts` | `Config` 新增 `fakeSheetsOutDir = fromRoot('./data/fake-sheets')`（固定路徑，不新增環境變數）；`index.ts` 在 fake 模式傳給 `createFakeGateway` |
| README | `README.md` | 由實作者（[BE]）更新功能清單與執行方式（TECH_SPEC §0 第 8 點）；[QA] 只檢查（TEST_SPEC §0 第 1 點） |

### 類別與方法（`diagrams/004-class.puml`）

見 [contracts/server-modules.md](./contracts/server-modules.md)。SessionService 新增 4 個公開方法；exporter 2 個、csv 1 個、projections 1 個純函式；SheetsGateway 兩個實作補 `writeCells`。

### 互動順序（`diagrams/004-sequence.puml`）

1. **結束後檢視結果**：沿用 003 的 end；`projectTeamView` 在 ENDED 放入 `buildResults`；老師端由 TeacherView 推導結果表。
2. **判錯與遞補**：`assertPhase` → 題目屬於本活動 → `winnerOf` → `status = rejected`（交易內）→ COMMIT 後 publish 全部 → 回傳 TeacherView（research R-01～R-03）。
3. **寫回**：`assertPhase('export')` → `buildExportWrites` ＋ D1 還原寫入 → 合併排序 → `writeCells`（0 筆不呼叫）→ `{ updatedCells, writes }`（research R-04）；還原同理（R-05）。
4. **下載 CSV**：`assertPhase('csv')` → `buildCsvRows` → `buildResultsCsv` → 路由加 `Content-Disposition`（R-08）。

### 與 docs 的差異（決定與待同步，詳見 research）

| 編號 | 內容 | 決定 | 待同步 docs |
| --- | --- | --- | --- |
| D1 | 判錯到無人遞補的題目寫回時恢復原始值 | exporter 簽名不變，由 `exportToSheet` 合併 `buildRestoreWrites` | PRD §8-9；TECH_SPEC §7.9、§12.6；TEST_SPEC 新增 UT-SVC-REJ-07 |
| D2 | 搶答中的判錯入口 | RUNNING 也顯示 ResultsTable（沿用 `btn-reject-{q}`） | TECH_SPEC §10.4（ResultsTable 用途）、§10.5（選擇性） |
| D3 | 還原完成文字「已還原 N 格」 | ExportPanel 的 `export-result` 顯示 | TECH_SPEC §10.4；TEST_SPEC 新增 UT-UI-EXP-02 |

上述同步為實作前置閘門（見本檔開頭），由 tasks T001 檢查。

### 相依與順序

- [BE] 只依賴 001～003 已完成的後端（`ranking.ts`、`buildResults`、repo、phase），可立即開始。
- [FE] 依賴 001～003 的 [FE] 任務（`client/` 尚未建立；research R-11），在那之前不建立 001～003 的前端檔案。
- [QA] IT-FLOW-01、IT-CSV-01、IT-VIS-02 可在 [BE] 完成後執行；E2E-12～17 需 [FE] 完成。

## Project Structure

### Documentation (this feature)

```text
specs/004-results-export/
├── plan.md              # 本檔
├── research.md          # D1～D3 差異與 R-01～R-12 決定
├── data-model.md        # 實體、衍生值、CSV 格式、階段允許
├── quickstart.md        # 驗證指南
├── contracts/
│   ├── rest-api.md      # 4 條路由
│   ├── server-modules.md
│   └── ui-testids.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 產生
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── sheets/
│   │   ├── exporter.ts          # 新增：buildExportWrites、buildRestoreWrites
│   │   ├── googleGateway.ts     # 補 writeCells
│   │   └── fakeGateway.ts       # 補 writeCells、可省略 outDir
│   ├── export/
│   │   └── csv.ts               # 新增：buildResultsCsv、CsvRow
│   ├── domain/projections.ts    # 補 buildCsvRows
│   ├── services/sessionService.ts  # 補 rejectWinner、exportToSheet、restoreSheet、exportCsv
│   ├── http/teacherRoutes.ts    # 補 4 條路由
│   ├── config.ts                # Config.fakeSheetsOutDir
│   └── index.ts                 # fake 輸出資料夾
└── test/
    ├── sheets/exporter.test.ts            # UT-EXP
    ├── sheets/googleGateway.test.ts       # 補 UT-GW-02
    ├── sheets/fakeGateway.test.ts         # 補 UT-GW-05
    ├── export/csv.test.ts                 # UT-CSV-01～06
    ├── domain/projections.test.ts         # 補 UT-PROJ-09、UT-CSV-07
    ├── services/session.reject.test.ts    # UT-SVC-REJ-01～07
    ├── services/session.export.test.ts    # UT-SVC-EXPORT-01～06
    └── integration/results.it.test.ts     # IT-FLOW-01、IT-CSV-01、IT-VIS-02

client/
├── src/
│   ├── components/ResultsTable.tsx   # 新增
│   ├── components/ExportPanel.tsx    # 新增
│   ├── components/StudentResults.tsx # 新增
│   ├── components/AnswerCard.tsx     # 補 rejected
│   ├── pages/TeacherDashboard.tsx    # 組裝
│   ├── pages/Play.tsx                # ENDED 畫面
│   ├── hooks/useTeacher.ts           # 4 個方法
│   └── api.ts                        # rejectWinner、exportSheet、restoreSheet、downloadCsv
└── test/
    ├── components/ResultsTable.test.tsx   # UT-UI-RES-01～02
    ├── components/ExportPanel.test.tsx    # UT-UI-EXP-01～02
    ├── components/AnswerCard.test.tsx     # 補 UT-UI-CARD-06
    └── pages/Play.test.tsx                # 補 UT-UI-PLAY-03

e2e/tests/results-export.spec.ts           # E2E-12～17
```

**Structure Decision**: 沿用 001 建立的 npm workspaces（shared／server／client／e2e）；後端模組依 TECH_SPEC §2 放在 `server/src/sheets`、`server/src/export`、`server/src/services`；不新增 workspace 或套件。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 原則 VII：TeacherDashboard 組裝、`config.ts`／`index.ts` 的 outDir、`api.ts` 四個函式、`useTeacher` 四個方法、4 條路由無獨立 TEST_SPEC ID | 屬接線程式碼 | 以 E2E-12～17、IT-FLOW-01、IT-CSV-01 覆蓋；另立 ID 需修改 TEST_SPEC（UT-SVC-REJ-07、UT-UI-EXP-02 則由實作前置閘門先登錄，不屬例外） |
| `createFakeGateway` 新增可省略的 `outDir` 參數 | TECH_SPEC 要求寫到 `data/fake-sheets`，但單元測試不能碰檔案系統 | 寫死路徑會讓 UT-GW-05 寫入 repo；TECH_SPEC 未規定此建構函式簽名，回傳物件方法不變 |
