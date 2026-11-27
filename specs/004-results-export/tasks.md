---
description: "Task list for 004-results-export（依層次分 Phase：Setup → 後端 → 前端 → 整合與 E2E → 最終驗收）"
---

# Tasks: 結果與匯出（004-results-export）

**Input**：`specs/004-results-export/`（plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md）

**契約依據**：`docs/TECH_SPEC.md` v1.6（型別、簽名、API 路徑、錯誤碼、`data-testid` 逐字照抄，不得改名）、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2、藍圖 `diagrams/004-*.puml`

**範圍**：只做 TECH_SPEC §14.1「004-results-export」一列。不建立 001～003 的前端檔案（`client/` 由 001 T051 起建立）。plan 差異：**D1** 判錯到無人遞補的題目寫回時恢復原始值（由 `exportToSheet` 合併 `buildRestoreWrites`，exporter 簽名不變）；**D2** RUNNING 也顯示 `ResultsTable`（判錯入口，沿用 `btn-reject-{qNumber}`）；**D3** 還原完成顯示「已還原 N 格」。

**前置依賴**：Phase 1、2 可立即開始（需 003 後端 Phase 2 完成：`ranking.ts`、`buildResults`、`repo.updateSubmission`）。Phase 3 需 001～003 的 [FE] 任務完成（`client/`、`api.ts`、`useTeacher`、`AnswerCard`、`Play`、`TeacherDashboard`、`StatusGrid`）。Phase 4 的 IT 只需 Phase 2 與 003 T048（`flow.ts`）；E2E 需 Phase 3 與 001 的 `e2e/playwright.config.ts`。

## 規則

1. **測試先行（憲章 VII）**：每個實作任務之前都有測試任務；測試名稱必須含 TEST_SPEC 案例 ID（例：`it('UT-SVC-REJ-01 A 得主、B 第 2 名，判錯 → B 得主', …)`），先執行確認失敗（Red）再實作（Green）。server 一律 `makeTestService()`（`FakeClock`、`InMemorySheetsGateway`、`RecordingBroadcaster`）與 `seedRunning()`；googleGateway 用 mock `sheets_v4.Sheets`，不連網；client 一律 `vi.mock('../../src/api')`。
2. **實作前置閘門（憲章 II，plan「實作前置閘門」）**：D1、D2、D3 需先由使用者同步 `docs/`（PRD §8-9；TECH_SPEC §7.9、§10.4、§12.6、§14.1；TEST_SPEC 新增 **UT-SVC-REJ-07**、**UT-UI-EXP-02** 並列入 §10）。T001 檢查未通過時 MUST 停止，不得開始 T002 以後的任務，也不得自行修改 docs/ 或改回舊行為。
3. **沒有 TEST_SPEC ID 的模組**（4 條路由、`config.ts`／`index.ts` 接線、client `api.ts`、`useTeacher` 四個方法、`StudentResults` 元件本身、`TeacherDashboard` 組裝、README）：任務中以「覆蓋測試：<ID>」註明由哪個測試驗證（plan Complexity Tracking）。
4. **檔案歸屬（憲章 IX；TECH_SPEC §0 第 8 點；TEST_SPEC §0 第 1 點）**：[BE] 只改根目錄設定檔與 `README.md`、`server/src/**`、`server/test/{helpers,sheets,export,domain,services}/**`；[FE] 只改 `client/**`；[QA] 只改 `server/test/integration/**`、`e2e/**`、`docs/test-report.md`、`docs/manual-test.md`（TEST_SPEC §8.2 指定），不修改 `README.md` 與任何 `src/`。**[BE] 與 [FE] 不修改同一個檔案**。前端型別一律從 `@quiz/shared` 匯入。
5. **伺服器規則**：寫回位置只能來自 `answer_slots`（`slot.sheetTitle`、`slot.a1`），程式中不得出現任何儲存格位址常數；判錯只改 `submissions.status`，得主與分數一律由 `ranking.ts` 推導、不另外儲存；判錯在 `runTx` 的單一同步函式內完成，`broadcaster.publish` 只在 COMMIT 後；export／restore／csv 不推播、不寫資料庫。重要業務邏輯加繁中註解（憲章 I）。
6. Phase 2、Phase 3 的最後一個任務：執行 `npm test` 與 `npm run lint` 全部通過（含 001～003 的測試），並依憲章原則 11（XI）比對程式碼與 `diagrams/004-*.puml`。

## Format: `- [ ] T### [P?] [BE|FE|QA] [US#?] 描述（檔案路徑）`

- **[P]**：可平行（不同檔案、不依賴同 Phase 內未完成的任務）
- **[BE]／[FE]／[QA]**：後端／前端／整合與驗證
- **[US#]**：對應 spec.md（US1 結束後看結果、US2 判錯與遞補、US3 寫回與還原、US4 下載 CSV）；跨多個 story 的任務不標
- 本檔依層次分 Phase（使用者指定），user story 對應見文末「追溯表」

---

## Phase 1: Setup — 基準確認

**Purpose**：確認 docs 已同步（實作前置閘門）、001～003 後端已完成、測試全綠、不需新增相依，並補上 TEST_SPEC §2.3 對 004 模組的覆蓋率門檻。

- [X] T001 [BE] **實作前置閘門與基準確認**：(a) 確認 `docs/` 已依 plan「實作前置閘門」同步——`docs/PRD.md` §8 第 9 點含「因判錯而沒有得主時…恢復為匯入時的原始值」；`docs/TECH_SPEC.md` §7.9 exportToSheet 列含 `buildRestoreWrites` 合併、§10.4 ResultsTable 為 RUNNING／ENDED 顯示且 ExportPanel 列出「已寫回 {n} 格／已還原 {n} 格」、§12.6 含合併步驟、§14.1 004 列含 UT-SVC-REJ-07、UT-UI-EXP-02；`docs/TEST_SPEC.md` 有 UT-SVC-REJ-07、UT-UI-EXP-02 且 §10 的 E5、FR-06 列已加入。任一項未完成即停止並回報使用者（不得自行修改 docs/）。(b) 執行 `npm test` 與 `npm run lint` 全部通過（含 001～003 的測試），記錄通過的測試數作為基準；確認 `server/src/domain/ranking.ts`（`winnerOf` 跳過 rejected）、`projections.buildResults`、`repo.updateSubmission`、`repo.listSlotsBySession`、`repo.listSubmissionsByQuestion`、`domain/phase.ts`（rejectWinner: RUNNING／ENDED；export、csv: ENDED；restore: READY／ENDED）皆已存在；確認 `server/package.json` 已有 `googleapis`、不需新增任何相依（plan Technical Context），並以 PowerShell `Get-ChildItem -Recurse -Filter *.node node_modules` 確認沒有原生模組；執行 `java -jar plantuml.jar "./diagrams/*.puml"` 無錯誤，且 `diagrams/004-*.puml` 已含 plan D1、D2（ResultsTable 為 RUNNING／ENDED 的判錯入口；exportToSheet 合併 buildRestoreWrites）（`diagrams/004-*.puml`、`diagrams/004-*.png`）
- [X] T002 [BE] 在根目錄 `vitest.config.ts` 的 `coverage.thresholds` 新增 `'server/src/sheets/exporter.ts': { lines: 95, branches: 90 }` 與 `'server/src/export/**': { lines: 95, branches: 90 }`（TEST_SPEC §2.3），其餘設定不變（`vitest.config.ts`）

---

## Phase 2: 後端 [BE]

**Purpose**：exporter → csv 與 buildCsvRows → 兩個閘道的 writeCells → SessionService 四個方法 → HTTP 路由。完成後 API 可完整驗證（quickstart §2）。

### 2A：寫回寫入清單 `sheets/exporter.ts`（FR-06、§8-9、§8-10）

- [X] T003 [P] [BE] [US3] 撰寫 UT-EXP-01～04，執行並確認失敗。以 `makeTestService()` 建立活動並 `importSheet(sid, 'fixture-template-a')`，取 `repo.listQuestions(sid)`、`repo.listSlotsBySession(sid)`；`winners` 以手動建構的 `Submission`（只需 `answers` 與 `questionId` 正確）放入 `Map<questionId, Submission>`：01 第 1 題 `['CPU','作業系統']`、第 3 題 `['0']` → `buildExportWrites` 恰為 `[{sheetTitle:'學習單',a1:'G5',value:'（1）CPU'},{sheetTitle:'學習單',a1:'G6',value:'（2）作業系統'},{sheetTitle:'學習單',a1:'G11',value:'0'}]`（順序依列）；02 空 Map → `[]`；03 單題 prefix 為 `''`（第 3 題）→ value 等於答案本身，另以 `fixture-template-b` 的一個單題驗證位置取自該範本的 slot（不同版面，憲章原則 V）；04 `buildRestoreWrites(slots)` → 每個 slot 一筆（範例 A 共 6 筆），`value === slot.originalValue`、`a1 === slot.a1`（`server/test/sheets/exporter.test.ts`）
- [X] T004 [BE] [US3] 實作 `buildExportWrites(slots, questions, winners)`：對每個 `winners.has(question.id)` 的題目、該題每個 slot（依 `subNo`）產生 `{ sheetTitle: slot.sheetTitle, a1: slot.a1, value: slot.prefix + winner.answers[slot.subNo - 1] }`；無得主的題目不產生寫入；輸出依 `sheetTitle` → `row` → `col` 排序。`buildRestoreWrites(slots)`：每個 slot `{ sheetTitle, a1, value: slot.originalValue }`，同樣排序。純函式；位置只來自 slot（加繁中註解說明「禁止寫死儲存格，FR-06／憲章 V」）。讓 T003 通過（`server/src/sheets/exporter.ts`）

### 2B：CSV `export/csv.ts` 與 `buildCsvRows`（E2）

- [X] T005 [P] [BE] [US4] 撰寫 UT-CSV-01～06，執行並確認失敗（以手動建構的 `CsvRow[]`）：01 空陣列 → 恰為 `'﻿題號,子題,組別,送出者,答案,伺服器時間,順位,狀態,是否得主\r\n'`；02 兩列 → 共 3 個 `\r\n` 且字串以 `\r\n` 結尾；03 answer 為 `a,b`、`他說"好"`、`第一行\n第二行` → 分別輸出 `"a,b"`、`"他說""好"""`、`"第一行\n第二行"`；04 answer 為 `=1+1`、`+5`、`-3`、`@x` → 輸出 `'=1+1`、`'+5`、`'-3`、`'@x`，另驗 `=a,b` → `"'=a,b"`（先防公式再跳脫，research R-08）；05 `serverTime = 0` → `1970-01-01T08:00:00.000+08:00`；06 status `active`／`withdrawn`／`rejected` → `有效`／`已撤回`／`判錯`，`isWinner` true／false → `是`／`否`，`rank: null` → 該欄為空字串（`server/test/export/csv.test.ts`）
- [X] T006 [BE] [US4] 實作並匯出 `interface CsvRow { questionNumber: number; subNo: number; teamName: string; submittedBy: string; answer: string; serverTime: number; rank: number | null; status: SubmissionStatus; isWinner: boolean; }` 與 `buildResultsCsv(rows)`：`'﻿'` ＋ 固定表頭 ＋ `'\r\n'`，每列欄位依「題號、子題、組別、送出者、答案、伺服器時間、順位、狀態、是否得主」以 `,` 連接並以 `'\r\n'` 結尾；每個欄位先轉字串 → 開頭為 `=`、`+`、`-`、`@` 時前加 `'` → 含 `,`、`"`、`\r`、`\n` 時以雙引號包住並把 `"` 改為 `""`；時間為 `new Date(ms + 8 * 3600_000).toISOString().replace('Z', '+08:00')`（不依賴系統時區）；狀態與是否得主依 UT-CSV-06；rank null → `''`。純函式，加繁中註解（防公式注入、RFC 4180）。讓 T005 通過（`server/src/export/csv.ts`）
- [X] T007 [BE] [US4] 在既有檔案新增 `describe('projections（004 CSV）')`，撰寫 UT-PROJ-09、UT-CSV-07，執行並確認失敗。以 `makeTestService()` ＋ `seedRunning(t)` 建立資料後 `t.service.loadAggregate(sessionId)` 取得 agg：PROJ-09 第 1 組送出第 1 題（題組）`['CPU','作業系統']` → `buildCsvRows(agg)` 中該送出恰有 2 列，`subNo` 1、2，`answer` 分別為 `CPU`、`作業系統`，`teamName === '第 1 組'`（依 Team.name）、`submittedBy` 為送出者暱稱；CSV-07 依序：第 3 組送第 3 題後撤回、第 2 組送第 3 題、第 1 組送第 1 題、第 1 組送第 3 題，`end` 後 → 列順序為題號 1 的兩列（subNo 1、2）→ 題號 3 rank 1、rank 2 → 題號 3 的已撤回列（`rank === null`、`status === 'withdrawn'`、`isWinner === false`）排最後；得主列 `isWinner === true`（`server/test/domain/projections.test.ts`）
- [X] T008 [BE] [US4] 實作 `buildCsvRows(agg)`：依題目分組送出，每題 `rankSubmissions(subs)` 建立 `id → { rank, isWinner }`；對 `agg.submissions` 每一筆（含 withdrawn、rejected）的每個 `answers[i]` 產生一列（`subNo = i + 1`、`teamName` 取 Team.name、`submittedBy` 取 Member.nickname、withdrawn 的 `rank = null`、`isWinner = false`）；排序：`questionNumber` 升冪 → `rank` 升冪（null 最後；null 之間依 `serverTime`、`seq`）→ `subNo` 升冪。`CsvRow` 型別從 `../export/csv.js` 匯入。讓 T007 通過（`server/src/domain/projections.ts`）

### 2C：試算表閘道 `writeCells`（FR-06）

- [X] T009 [P] [BE] [US3] 在既有檔案撰寫 UT-GW-02，執行並確認失敗：擴充 `mockClient` 加入 `values.batchUpdate = vi.fn(async () => ({ data: {} }))`；`writeCells('sid', [{sheetTitle:'學習單',a1:'G5',value:'（1）CPU'},{sheetTitle:'學習單',a1:'G11',value:'=1+1'}])` → `batchUpdate` 恰被呼叫 1 次，參數 `spreadsheetId === 'sid'`、`requestBody.valueInputOption === 'RAW'`、`requestBody.data` 為 `[{ range: "'學習單'!G5", values: [['（1）CPU']] }, { range: "'學習單'!G11", values: [['=1+1']] }]`；另驗 `writeCells('sid', [])` 不呼叫 `batchUpdate`；`batchUpdate` 丟出 `{ code: 403 }` → `SHEETS_PERMISSION_DENIED`（`server/test/sheets/googleGateway.test.ts`）
- [X] T010 [BE] [US3] 實作 `googleGateway.writeCells(spreadsheetId, writes)`：`writes.length === 0` 時直接 return；否則 `client.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: writes.map((w) => ({ range: rangeA1(w.sheetTitle, w.a1), values: [[w.value]] })) } })`，錯誤經既有 `toAppError`（403 → SHEETS_PERMISSION_DENIED、404 → SHEETS_NOT_FOUND、其他 → SHEETS_ERROR）；繁中註解說明 RAW 讓答案以純文字寫入、values API 不改格式與合併（research R-06）。移除「002 不支援寫回」的暫時實作與註解。讓 T009 通過（`server/src/sheets/googleGateway.ts`）
- [X] T011 [P] [BE] [US3] 在既有檔案撰寫 UT-GW-05，執行並確認失敗：`createFakeGateway(fixturesDir)`（不傳 outDir）→ `writeCells('fixture-template-a', [{sheetTitle:'學習單',a1:'G5',value:'（1）CPU'}])` 後 `getSnapshot('fixture-template-a').sheets[0].values[4][6] === '（1）CPU'`，其他格與 fixture 相同；`reset('fixture-template-a')` 後該格恢復 fixture 原值；另驗寫入不存在的工作表 `'不存在'` → `SHEETS_ERROR` 且快照未被修改（全部驗證後才套用）；傳入 `outDir = mkdtempSync(join(tmpdir(), 'fake-sheets-'))` 時寫入後 `${outDir}/fixture-template-a.json` 存在且內容等於 `getSnapshot`（測試結束刪除暫存資料夾）（`server/test/sheets/fakeGateway.test.ts`）
- [X] T012 [BE] [US3] 實作 `createFakeGateway(dir: string, outDir?: string)` 的 `writeCells`：取 `getSnapshot(id)`；先對每筆寫入找到 `title === sheetTitle` 的工作表並以本檔私有 `parseA1('G5') → { row: 4, col: 6 }` 解析（任一失敗 → `SHEETS_ERROR`，不套用任何一筆）；再逐筆補齊列與欄後設定值；`outDir` 有值時 `mkdirSync(outDir, { recursive: true })` 並 `writeFileSync(join(outDir, \`${id}.json\`), JSON.stringify(snapshot, null, 2))`。回傳物件的方法名稱不變。移除「002 不支援寫回」的暫時實作與註解。讓 T011 通過（`server/src/sheets/fakeGateway.ts`）
- [X] T013 [BE] [US3] fake 模式組裝（plan「設定與組裝」）：在 `Config` 介面新增 `fakeSheetsOutDir: string`，`loadConfig()` 回傳 `fakeSheetsOutDir: fromRoot('./data/fake-sheets')`（固定路徑，不新增環境變數，不改 `.env.example`；`fromRoot` 維持檔內私有）；`index.ts` 的 `buildSheets()` 在 fake 模式改為 `createFakeGateway(config.fakeSheetsDir, config.fakeSheetsOutDir)`。`data/` 已在 `.gitignore`。覆蓋測試：E2E-14、E2E-15（並手動確認 `data/fake-sheets/fixture-template-a.json` 產生）（`server/src/config.ts`、`server/src/index.ts`）

### 2D：SessionService（E5、FR-06、E2）

- [X] T014 [P] [BE] [US2] 撰寫 UT-SVC-REJ-01～07，執行並確認失敗。共同前置：`makeTestService()`、`seedRunning(t)`（純速度、3 組），第 1、2、3 組依序（`clock.advance(100)` 間隔）送出第 3 題 `['0']`、`['1']`、`['2']`：01 `end` 後 `rejectWinner(sid, q3)` → 第 1 組該筆 `status === 'rejected'`（`orderKey` 不變）；回傳的 TeacherView 第 3 題 `winnerTeamId` 為第 2 組、`teams` 分數第 1 組 0、第 2 組 1；`broadcaster.calls.at(-1)` 為 `{ sessionId }`（全部）。同一測試的 RUNNING 變體（另一個 service，不 end）：判錯後 `getTeamView(第 2 組 token)` 的 `JSON.stringify` 不含 `'rejected'`、不含第 1 組送出 id，`results === null`（FR-10、research R-02）；同一測試的公平模式變體（spec FR-019）：`seedRunning(t, { mode: 'fair', windowSec: 3 })`，第 1 組送第 1 題、第 2 組送第 2 題，各自 `clock.advance(3000)` + `scheduler.runDue()` 結算（兩組各 1 分）；老師判錯第 1 題（第 1 組 → 0 分）；第 4 題第 2 組先送、`advance(1000)` 後第 1 組送，視窗到期結算 → 得主為第 1 組（低分優先，證明判錯後的分數立即生效；若未判錯兩組同分則應為第 2 組）；02 再判錯 → 第 3 組為得主、第 2 組 rejected；03 第三次判錯 → 丟出 `NO_WINNER`，資料不變；ENDED 的 `getTeamView` `results.questions` 第 3 題 `winner === null`；另驗無送出的第 4 題 → `NO_WINNER`、`rejectWinner(sid, 'nope')` → `QUESTION_NOT_FOUND`，以及公平模式（`seedRunning(t, { mode: 'fair' })`）視窗中的題目 → `NO_WINNER` 且 `scheduler` 仍有該視窗排程（research R-03）；04 READY（`createSession` ＋ `importSheet`，不 start）判錯 → `INVALID_PHASE`；05 RUNNING 判錯第 1 組後，第 1 組再 `submit` 第 3 題 → `ALREADY_SUBMITTED`，`withdraw` 該 rejected 筆 → `INVALID_STATE`；06 ENDED 判錯後 `exportToSheet` → `gateway.writes.at(-1).writes` 中 G11 為 `'1'`（遞補者答案）；07（plan D1）只有第 1 組送出第 3 題、`end`、判錯 → `exportToSheet` 的 writes 含 `{ a1: 'G11', value: <範例 A G11 的 originalValue> }`，`updatedCells` 計入該格，且未送出的第 1、2、4 題不產生寫入（`server/test/services/session.reject.test.ts`）
- [X] T015 [BE] [US2] 實作 `rejectWinner(sessionId, questionId): TeacherView`：`runTx` 內 `requireSession` → `assertPhase(session.phase, 'rejectWinner')` → `repo.getQuestion(questionId)`，不存在或 `q.sessionId !== sessionId` → `QUESTION_NOT_FOUND` → `winnerOf(repo.listSubmissionsByQuestion(questionId))`，null → `NO_WINNER` → `repo.updateSubmission(w.id, { status: 'rejected' })`；`after(() => broadcaster.publish(sessionId))`；回傳 `projectTeacherView(this.loadAggregate(sessionId), clock.now())`。繁中註解：判錯只改 status，rejected 保留名次但不能是得主，遞補與扣分由 `winnerOf`／`teamScores` 自動成立（TECH_SPEC §7.6）。讓 T014 的 01～05 通過（`server/src/services/sessionService.ts`）
- [X] T016 [P] [BE] [US3] [US4] 撰寫 UT-SVC-EXPORT-01～06，執行並確認失敗（`makeTestService()`、`seedRunning(t)`）：01 第 1 組送第 1 題 `['CPU','作業系統']`、第 2 組送第 3 題 `['0']`，`end` 後 `exportToSheet` → `gateway.writes` 恰 1 次呼叫且 `writes` 恰 3 筆：G5 `（1）CPU`、G6 `（2）作業系統`、G11 `0`；回傳 `updatedCells === 3`；`gateway.current('fixture-template-a')` 中 G8 與 fixture 相同；呼叫前後 `broadcaster.calls.length` 不變；同一測試再呼叫一次 `exportToSheet` → 第二次的 `writes` 與第一次深度相等（spec FR-031 重複寫回結果相同）；02 RUNNING 中 `exportToSheet` → `INVALID_PHASE` 且 `gateway.writes.length === 0`；另驗 ENDED 但無任何送出 → `{ updatedCells: 0, writes: [] }` 且 `gateway.writes.length === 0`（0 筆不呼叫閘道，research R-04）；03 `end` 後 `restoreSheet` → 恰 6 筆，值為各 slot 的 `originalValue`、`updatedCells === 6`；另驗 `reset` 後（READY）`restoreSheet` 成功、`start` 後（RUNNING）→ `INVALID_PHASE`；04 ENDED 的 `exportCsv` → 以 `'﻿'` 開頭；`split('\r\n')` 去掉結尾空字串後的列數 = 所有送出的子題總數 + 1；05 RUNNING 中 `exportCsv` → `INVALID_PHASE`；06 `gateway.failNext('SHEETS_ERROR')` 後 `exportToSheet` → 以 `SHEETS_ERROR` reject；`failNext('SHEETS_PERMISSION_DENIED')` 後 `restoreSheet` → `SHEETS_PERMISSION_DENIED`（`server/test/services/session.export.test.ts`）
- [X] T017 [BE] [US3] [US4] 實作（research R-04、R-05、R-08）：`exportToSheet(sessionId)`：`assertPhase(phase, 'export')`；`spreadsheetId` 為 null → `INVALID_PHASE`；`agg = loadAggregate`；依題目分組送出，`winners = Map(qid → winnerOf(subs))`（只放非 null）；`writes = buildExportWrites(agg.slots, agg.questions, winners)`；**plan D1**：對 `winnerOf(subs) === null && subs.some(s => s.status === 'rejected')` 的題目，取其 slots 呼叫 `buildRestoreWrites` 並合併；合併後依對應 slot 的 `sheetTitle` → `row` → `col` 排序；`writes.length > 0` 時 `await sheets.writeCells(spreadsheetId, writes)`；回傳 `{ updatedCells: writes.length, writes }`；不推播、不寫資料庫（繁中註解說明 D1 與 PRD §8-9 的關係）。`restoreSheet(sessionId)`：`assertPhase(phase, 'restore')` → `buildRestoreWrites(repo.listSlotsBySession(sessionId))` → 非空時 `writeCells` → `{ updatedCells }`。`exportCsv(sessionId)`：`assertPhase(phase, 'csv')` → `buildResultsCsv(buildCsvRows(loadAggregate(sessionId)))`。讓 T016 與 T014 的 06、07 通過（`server/src/services/sessionService.ts`）

### 2E：HTTP 路由（§8.1）

- [X] T018 [BE] 在老師路由新增（只做轉換，無業務規則；皆需 teacher 驗證，沿用既有 `:id` 檢查）：`POST /sessions/:id/questions/:qid/reject-winner` → 200 `service.rejectWinner(id, qid)`；`POST /sessions/:id/export` → 200 `await service.exportToSheet(id)`（`{ updatedCells, writes }`）；`POST /sessions/:id/restore` → 200 `await service.restoreSheet(id)`；`GET /sessions/:id/export.csv` → `csv = service.exportCsv(id)`，取 session 的 `roomCode`、`round`，`res.status(200).type('text/csv; charset=utf-8').set('Content-Disposition', \`attachment; filename="results-${roomCode}-r${round}.csv"\`).send(csv)`。async 錯誤交給 `errorHandler`（403／404／409／502 依 §11）。覆蓋測試：IT-FLOW-01、IT-CSV-01、E2E-13～16（`server/src/http/teacherRoutes.ts`）
- [X] T019 [BE] 更新 `README.md`（TECH_SPEC §0 第 8 點：每完成一個功能由實作者更新）：「功能清單」加入結果畫面（老師／學生，含各組分數）、老師判錯與遞補（搶答中與結束後）、寫回 Google Sheets（前綴＋答案、只改作答格、因判錯而無得主的題目恢復原始值）、還原原始內容、下載 CSV（Excel 可直接開啟）；「如何執行」補 fake 模式寫回結果位置 `data/fake-sheets/<id>.json` 與 `GET /api/dev/fake-sheets/:id`、Google 模式需把試算表共用給服務帳號（編輯者）、權限錯誤訊息的處理方式；保留 `fixture-template-a`、`fixture-template-b` 範例 ID（MA-09）。README 不存在時（001 的 [QA] 任務尚未建立）先建立含這兩節的最小版本。覆蓋測試：MA-08、MA-09（`README.md`）
- [X] T020 [BE] **Phase 2 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001～003 的測試）；執行 `npm run test:coverage` 確認 `server/src/sheets/exporter.ts`、`server/src/export/**`、`server/src/domain/**` 行 ≥ 95%／分支 ≥ 90%，`server/src/services/**` 90%／85%；以 `grep -rnE "['\"][A-Z]{1,3}[0-9]+['\"]" server/src` 搜尋疑似儲存格位址，**逐筆人工確認**不是試算表儲存格常數（命中不代表失敗；漏網情況以 UT-EXP-03 的範例 B 驗證補強）；依憲章原則 11 比對程式碼與 `diagrams/004-class.puml`（SessionService 4 個方法、exporter 2 個、csv 1 個、projections `buildCsvRows`、`GoogleSheetsGateway`／`FakeSheetsGateway` 的 `writeCells`）、`diagrams/004-component.puml`（HTTP 路由 4 條；Svc → Exp、Csv、GGw／FGw、BC 只有判錯）、`diagrams/004-sequence.puml`「二、判錯與遞補」「三、寫回 Google Sheets（含 D1 合併、0 筆不呼叫）」「四、下載 CSV」的步驟順序，不一致時修正並重新產生 PNG（`server/src/`、`diagrams/004-*.puml`）

**Checkpoint**：後端完成；quickstart §2 的 API 煙霧測試可全部執行。

---

## Phase 3: 前端 [FE]

**Purpose**：useTeacher 四個方法 → ResultsTable、ExportPanel、StudentResults → AnswerCard rejected → Play ENDED，並組裝 TeacherDashboard。只修改 `client/`。依賴 001～003 的 [FE] 任務。

- [X] T021 [FE] 在 `api.ts` 新增（沿用既有 `request()` 與錯誤解析，型別從 `@quiz/shared` 匯入）：`rejectWinner(token, sessionId, questionId)` → `POST /api/teacher/sessions/:id/questions/:qid/reject-winner`，回傳 `TeacherView`；`exportSheet(token, sessionId)` → `POST .../export`，回傳 `{ updatedCells: number; writes: CellWrite[] }`；`restoreSheet(token, sessionId)` → `POST .../restore`，回傳 `{ updatedCells: number }`；`downloadCsv(token, sessionId)` → `GET .../export.csv`（帶 `Authorization: Bearer`），非 2xx 時解析錯誤本文並丟出與 `request()` 相同的錯誤，成功回傳 `{ blob, filename }`（filename 由 `Content-Disposition` 的 `filename="…"` 取得，取不到時 `results.csv`）（research R-10）。覆蓋測試：E2E-13～16（`client/src/api.ts`）
- [X] T022 [FE] 在 `useTeacher` 新增（TECH_SPEC §10.3 簽名逐字相同）：`rejectWinner(questionId: string): Promise<void>`（成功後以回傳的 TeacherView 更新 `view`）；`exportToSheet(): Promise<number>`、`restoreSheet(): Promise<number>`（回傳 `updatedCells`）；`downloadCsv(): Promise<void>`（`URL.createObjectURL(blob)` → 暫時 `<a download={filename}>` click → `URL.revokeObjectURL`）。四者呼叫期間 `busy = true`、結束恢復；錯誤寫入 `error`（ErrorBanner 依 §11 顯示，如「此題目前沒有得主」「沒有權限存取試算表，請將試算表共用給服務帳號」），且 Promise 以錯誤 reject 讓呼叫端不顯示成功訊息。覆蓋測試：UT-UI-RES-02、UT-UI-EXP-01～02（以 props 注入）、E2E-13～16（`client/src/hooks/useTeacher.ts`）
- [X] T023 [P] [FE] [US1] [US2] 撰寫 UT-UI-RES-01、02，執行並確認失敗。以手動建構的 `TeacherView`（範例 A 4 題、3 組，phase ENDED）渲染 `ResultsTable`（props：`view`、`busy=false`、`onReject`）：01 第 1 題 `winnerTeamId` 為第 2 組、cells 第 2 組 rank 1 isWinner、第 1 組 rank 2 → `result-winner-1` 為「第 2 組」，該列答案含「（1）CPU（2）作業系統」，順位依序「1.第 2 組」「2.第 1 組」；第 3 題第 1 組 `status: 'rejected'` rank 1、第 2 組得主 rank 2 → 順位含「1.第 1 組（判錯）」；第 2、4 題 `winnerTeamId: null` → `result-winner-2` 為「無」；已撤回的格不出現在順位；`score-1`～`score-3` 文字為各組分數，分數列 DOM 順序為分數降冪、同分組序升冪；02 按 `btn-reject-1` → `onReject` 被呼叫 1 次且參數為第 1 題 id；`busy=true` 時 `btn-reject-*` 皆 disabled；無得主的 `btn-reject-2` 仍 enabled（`client/test/components/ResultsTable.test.tsx`）
- [X] T024 [FE] [US1] [US2] 實作 `ResultsTable`（research R-09，contracts/ui-testids.md）：容器 `results-table`；每題一列（題號升冪）：題號、`result-winner-{n}`（得主組名或「無」）、答案（得主那格的 answers，題組以 `subLabels[i] + answers[i]` 直接串接，單題只有答案；無得主「無」）、順位（該題 cells 中 `submission` 非 null、`status !== 'withdrawn'`、`rank !== null` 者依 rank 升冪，顯示 `${rank}.${組名}`，rejected 加「（判錯）」）、`btn-reject-{n}`「判錯」（`busy` 時 disabled，按下 `onReject(questionId)`）；下方分數列 `score-{teamIndex}`（依 score 降冪、index 升冪）。讓 T023 通過（`client/src/components/ResultsTable.tsx`）
- [X] T025 [P] [FE] [US3] [US4] 撰寫 UT-UI-EXP-01、02，執行並確認失敗。渲染 `ExportPanel`（props：`phase`、`busy`、`onExport`、`onRestore`、`onDownload`）：01 phase ENDED，`onExport` resolve 3 → 按 `btn-export-sheet` 後 `export-result` 顯示「已寫回 3 格」；02（plan D3）phase ENDED，`onRestore` resolve 6 → 按 `btn-restore-sheet` 後 `export-result` 顯示「已還原 6 格」。01 的同一測試另驗：`onExport` reject → `export-result` 不顯示成功文字；phase READY → `btn-export-sheet`、`btn-download-csv` disabled、`btn-restore-sheet` enabled；phase RUNNING → 三顆皆 disabled；`busy=true` → 三顆皆 disabled；按 `btn-download-csv` → `onDownload` 被呼叫 1 次（`client/test/components/ExportPanel.test.tsx`）
- [X] T026 [FE] [US3] [US4] 實作 `ExportPanel`：`btn-export-sheet`「寫回 Google Sheets」（ENDED 且非 busy 可按）、`btn-restore-sheet`「還原原始內容」（READY／ENDED 且非 busy）、`btn-download-csv`「下載 CSV」（ENDED 且非 busy）；成功後 `export-result` 顯示「已寫回 {n} 格」或「已還原 {n} 格」（最近一次成功的結果），失敗時清除訊息（錯誤由 ErrorBanner 顯示）。讓 T025 通過（`client/src/components/ExportPanel.tsx`）
- [X] T027 [P] [FE] [US1] 在既有檔案撰寫 UT-UI-PLAY-03，執行並確認失敗：`vi.mock` socket／api，推送 phase ENDED 的 TeamView（`results` 含範例 A 第 1、3 題得主與 3 組 `scores`）→ 頁面顯示 `student-results` 與 `student-result-1`、`student-result-3`（含得主組名與答案），`student-result-2` 顯示「無」；不存在任何 `answer-card-*`；不存在任何 `btn-reject-*`；畫面含各組分數（spec Clarifications Q2）（`client/test/pages/Play.test.tsx`）
- [X] T028 [FE] [US1] 實作 `StudentResults`（props：`results: Results`）：容器 `student-results`；每題 `student-result-{number}` 顯示題號、得主組名（無得主「無」）、得主答案（題組以子題標籤串接）、各組順位（`ranking` 依 rank，`status === 'rejected'` 加「（判錯）」）；下方列出 `scores`（已依分數降冪、組序升冪）；無任何操作按鈕。覆蓋測試：UT-UI-PLAY-03（T031 後通過）（`client/src/components/StudentResults.tsx`）
- [X] T029 [FE] [US2] （依賴 003 的 `AnswerCard.test.tsx`：同檔，不可平行）在既有檔案補 UT-UI-CARD-06，執行並確認失敗：phase RUNNING、`mySubmission = { status: 'rejected', answers: ['0'], … }` → `answer-input-3-1` disabled 且值為 `0`；顯示「老師判定此答案錯誤」；不存在 `btn-submit-3`、`btn-withdraw-3`（`client/test/components/AnswerCard.test.tsx`）
- [X] T030 [FE] [US2] 在 `AnswerCard` 補 TECH_SPEC §10.4 狀態表的 rejected 列：RUNNING 且 `mySubmission?.status === 'rejected'` → 輸入框 disabled 顯示原送出答案、不渲染送出與撤回按鈕、顯示「老師判定此答案錯誤」（只涉及本組資料，不違反 FR-10）。其他狀態行為不變（UT-UI-CARD-01～05 仍通過）。讓 T029 通過（`client/src/components/AnswerCard.tsx`）
- [X] T031 [FE] [US1] 在 `Play` 加入 ENDED 畫面：`view.session.phase === 'ENDED' && view.results` 時不渲染 AnswerCard，改渲染 `<StudentResults results={view.results} />`；保留 TeamHeader、PhaseBadge。讓 T027 通過（`client/src/pages/Play.tsx`）
- [X] T032 [FE] [US1] [US2] [US3] [US4] 在 `TeacherDashboard` 組裝（plan D2）：RUNNING、ENDED 於 `StatusGrid` 下方渲染 `ResultsTable`（`onReject` → `useTeacher.rejectWinner`，`busy` → `useTeacher.busy`）；READY、ENDED 渲染 `ExportPanel`（`onExport` → `exportToSheet`、`onRestore` → `restoreSheet`、`onDownload` → `downloadCsv`）。不修改 003 的 `StatusGrid`。覆蓋測試：E2E-12～17（`client/src/pages/TeacherDashboard.tsx`）
- [X] T033 [FE] **Phase 3 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001～003 的測試）；確認所有 `data-testid` 與 TECH_SPEC §10.4 逐字相同、沒有新增（`results-table`、`result-winner-{qNumber}`、`btn-reject-{qNumber}`、`score-{teamIndex}`、`btn-export-sheet`、`btn-restore-sheet`、`btn-download-csv`、`export-result`、`student-results`、`student-result-{qNumber}`）；依憲章原則 11 比對程式碼與 `diagrams/004-component.puml` 的瀏覽器端組件（TeacherDashboard 在 RUNNING／ENDED 顯示 ResultsTable、READY／ENDED 顯示 ExportPanel；TeacherDashboard → useTeacher，以 props 傳給 ResultsTable、ExportPanel；Play → StudentResults、AnswerCard）及 `diagrams/004-sequence.puml`「一、結束後檢視結果」，不一致時修正並重新產生 PNG（`client/src/`、`diagrams/004-*.puml`）
  - ✅ 驗收紀錄（2026-11-27）：
    - **測試與 lint**：`npm test` 46 個檔案、285 個測試全部通過；`npm run lint`（eslint ＋ shared／server／client typecheck）無錯誤，未修改任何檔案。
    - **client 不匯入 server**：`client/src`、`client/test` 的 import 只有相對路徑（client 內部）、`@quiz/shared` 與第三方套件，沒有任何 `server/` 或 `@quiz/server`。
    - **data-testid**：ResultsTable（`results-table`、`result-winner-{q}`、`btn-reject-{q}`、`score-{teamIndex}`）、ExportPanel（`btn-export-sheet`、`btn-restore-sheet`、`btn-download-csv`、`export-result`）、StudentResults（`student-results`、`student-result-{q}`）與 TECH_SPEC §10.4 逐字相同；004 沒有新增其他 testid（AnswerCard rejected 列沿用 003 的 testid）。
    - **004-component 一致**：TeacherDashboard 在 RUNNING／ENDED 顯示 ResultsTable（plan D2）、READY／ENDED 顯示 ExportPanel；ResultsTable 的判錯入口、無得主顯示「無」、分數降冪＋組序升冪；ExportPanel 的按鈕啟用條件（寫回、CSV：ENDED；還原：READY／ENDED；busy 全停用）與「已寫回 N 格」「已還原 N 格」；useTeacher 的 rejectWinner、exportToSheet、restoreSheet、downloadCsv → api.ts REST（reject-winner、export、restore、export.csv）；Play 在 ENDED 且有 results 時顯示 StudentResults、不渲染 AnswerCard；AnswerCard rejected 顯示「老師判定此答案錯誤」且無送出／撤回按鈕；teacher:state、team:state 由頁面（經 useTeacher／usePlay）接收，與 003 慣例相同。
    - **004-component 不一致（圖表有誤，經使用者決定改圖）**：原圖 `RTable --> UT`、`ExpP --> UT` 表示子元件直接呼叫 useTeacher；實際上兩者為純 props 元件，由 TeacherDashboard 呼叫 useTeacher 後以 props 傳入（與 003 e681b6f「hooks called from pages」及 T023／T025 的 props 測試一致）。已改為 `TDash --> UT`，`TDash --> RTable／ExpP` 與 `Play --> SRes／Card` 標註 props，TDash 與 Play 說明補上組裝方式，並重新產生 `004-component.png`（無錯誤）。client 程式碼未修改。
    - **004-sequence「一、結束後檢視結果」一致**：按「結束搶答」→ `api.end` POST `/sessions/:id/end` → useTeacher 以回應與 `teacher:state` 更新 view → ResultsTable 顯示每題得主／答案／各組順位（含判錯、不含撤回與未結算）、無得主「無」、分數排序；學生端 `team:state`（ENDED 含 results）→ Play 隱藏 AnswerCard、顯示 StudentResults。無不一致。

**Checkpoint**：老師與學生畫面完成；quickstart §3 可手動走一遍。

---

## Phase 4: 整合與 E2E [QA]

**Purpose**：以真實 HTTP + Socket.IO 驗證完整流程與資訊隔離；以 Playwright 驗證畫面。只修改 `server/test/integration/**`、`e2e/**`。

- [ ] T034 [QA] 擴充整合測試工具（向下相容，001～003 的 IT 不需修改）：`startApp(opts?)` 新增 `opts.fakeSheets?: boolean`——true 時改用 `createFakeGateway(<repo>/fixtures/sheets)`（不傳 outDir）作為 `sheets`，並傳入 `fakeSheets` 讓 `/api/dev/fake-sheets/*` 掛載；`flow.ts` 新增 `rejectWinner(token, sid, qid)`、`exportSheet(token, sid)`、`restoreSheet(token, sid)`、`getCsv(token, sid)`（回傳 `{ status, headers, text }`）、`getFakeSheet(spreadsheetId)`（`server/test/integration/startApp.ts`、`server/test/integration/flow.ts`）
- [ ] T035 [QA] [US1] [US2] [US3] [US4] 撰寫並執行 IT-FLOW-01（`startApp({ fakeSheets: true })`）：登入 → 建立（純速度、3 組）→ 匯入 `fixture-template-a` → 3 組各 1 人加入 → start → 第 1 組送第 1 題 `['CPU','作業系統']`、第 1 組送第 3 題 `['0']`、第 2 組送第 3 題 `['1']`、第 3 組送第 4 題後撤回（E4）→ RUNNING 中 `POST export` → 409 → end → `GET /api/teacher/sessions/:id` 第 1、3 題有得主 → `POST reject-winner`（第 3 題）→ 200、第 3 題得主改為第 2 組（E5）→ `POST export` → 200 `updatedCells === 3` → `GET /api/dev/fake-sheets/fixture-template-a`：G5 `（1）CPU`、G6 `（2）作業系統`、G11 `1`，G8 等其他格與 fixture 完全相同 → `GET export.csv` 本文以 BOM 開頭 → `POST restore` → 200 且 fake sheet 與 fixture 完全相同。每步狀態碼皆正確（`server/test/integration/results.it.test.ts`）
- [ ] T036 [QA] [US4] （同檔，接在 T035 之後）撰寫並執行 IT-CSV-01：ENDED 時 `GET /api/teacher/sessions/:id/export.csv` → 200、`Content-Type` 為 `text/csv; charset=utf-8`、`Content-Disposition` 為 `attachment; filename="results-<roomCode>-r1.csv"`（roomCode 為該活動房間碼）；`reset` → `start` → `end` 後檔名為 `-r2.csv`；RUNNING 中 → 409 `INVALID_PHASE`（`server/test/integration/results.it.test.ts`）
- [ ] T037 [P] [QA] [US1] [US2] 撰寫並執行 IT-VIS-02（接續 IT-VIS-01 的情境，自行建立）：A、B 兩組學生 socket 與老師 socket，A 送出第 3 題 `SECRET-A-123`；RUNNING 中老師判錯 A 的第 3 題（且 B 送出第 3 題讓 B 遞補）→ B 在 end 之前收到的所有 `team:state` 序列化後不含 `SECRET-A-123`、`rejected`、A 的 member id 與 submission id（spec SC-008）；A 收到的 `team:state` 中第 3 題 `mySubmissions.status === 'rejected'`；老師 end 後 B 收到的 `team:state.results` 含 A 的答案 `SECRET-A-123`（FR-09）（`server/test/integration/results-visibility.it.test.ts`）
- [ ] T038 [QA] 撰寫並執行 E2E-12～17（TEST_SPEC §7；`test.describe.serial`，每位使用者獨立 `browser.newContext()`，只用 `data-testid` 選取，每個案例結束截圖 `e2e/artifacts/<ID>.png`；開始前 `POST /api/dev/fake-sheets/fixture-template-a/reset`）。前置：老師登入、建立活動（3 組、純速度，讓得主立即判定）、匯入 `fixture-template-a`、3 組各 1 人加入、`btn-start`；第 1 組送第 1 題（`CPU`、`作業系統`）與第 3 題 `0`，第 2 組送第 3 題 `1`。12 老師 `btn-end` → 3 個學生頁在 1 秒內（`expect(...).toBeVisible({ timeout: 1000 })`）顯示 `student-results`、不再有 `answer-card-*`；老師顯示 `results-table` 與 `score-1`～`score-3`；13 老師按 `btn-reject-3` → `result-winner-3` 在 1 秒內變為「第 2 組」，學生頁 `student-result-3` 在 1 秒內同步顯示第 2 組（`toContainText(..., { timeout: 1000 })`，spec SC-003）；14 老師按 `btn-export-sheet` → `export-result` 顯示「已寫回 3 格」，並量測從點擊到該文字出現的時間 < 2000 ms（spec SC-010）；`page.request.get('/api/dev/fake-sheets/fixture-template-a')` 中 G5 `（1）CPU`、G6 `（2）作業系統`、G11 `1`，其他儲存格與 fixture 相同；15 按 `btn-restore-sheet` → `export-result` 顯示「已還原 6 格」，fake sheet 與 fixture 完全相同；16 按 `btn-download-csv` → `page.waitForEvent('download')`，檔名含房間碼與 `r1`，內容以 BOM 開頭、資料列數 = 4（第 1 題 2 列＋第 3 題 2 列）+ 表頭；17 按 `btn-reset` → 老師 `phase-badge` 為「等待開始」，學生頁不再有 `student-results`、所有 `submitted-*` 消失、`team-name` 不變（`e2e/tests/results-export.spec.ts`）
- [ ] T039 [QA] **Phase 4 驗收**：執行 `npm test`（含 001～003 的 IT）與 `npm run test:e2e`（E2E-01～18 全部通過）；確認 IT-FLOW-01、IT-CSV-01、IT-VIS-02、E2E-12～17 皆已實作且無 `it.skip`／`test.fixme`（`server/test/integration/`、`e2e/tests/`）

---

## Phase 5: 最終驗收 [QA]

**Purpose**：TEST_SPEC §8.1 通過條件全部確認，完成報告並檢查 README。004 為最後一個子功能，此 Phase 涵蓋全部測試回歸。[QA] 不修改 `src/` 與 `README.md`（TEST_SPEC §0 第 1 點），發現問題以缺陷記錄。

- [ ] T040 [QA] 執行全部測試與覆蓋率：`npm run lint`、`npm test`、`npm run test:coverage`、`npm run test:e2e`；確認 TEST_SPEC §2.3 每一列門檻達成（`server/src/domain/**`、`parser.ts`、`exporter.ts`、`export/**` 95%／90%；`services/**` 90%／85%；`shared/src/**` 90%／85%；全專案 80%／75%）；以 `grep -rnE "it\.skip|test\.fixme|it\.only|test\.only" server/test client/test e2e` 確認數量為 0；列出覆蓋率排除清單（`server/src/index.ts`、`googleGateway.ts` 實際網路呼叫部分）。結果寫入 T042 的報告（`docs/test-report.md`）
- [ ] T041 [QA] 執行並記錄手動驗收 MA-03～08（TEST_SPEC §8.2，附截圖路徑）：MA-03 真實寫回（`SHEETS_MODE=google`，前後截圖比對作答格為「前綴＋答案」、格式／合併／其他儲存格不變）；MA-04 真實還原與匯入前一致；MA-05 未共用試算表 → 「沒有權限存取試算表，請將試算表共用給服務帳號」；MA-06 老師＋3 組（含 1 組 2 人）四分割完成一輪；MA-07 `git log -p` 搜尋 `private_key`、`TEACHER_PASSWORD=` 實值 → 無結果；MA-08 spec、`diagrams/*.puml`、README 功能清單、Demo 內容逐項一致。需要真實 Google 帳號的項目若無法執行，標記「未執行」與原因（`docs/manual-test.md`）
- [ ] T042 [QA] 依 TEST_SPEC §9.3 範本完成測試報告：摘要（UT／IT／E2E／MA 案例數、通過、失敗、略過）、覆蓋率表（每列門檻與結果）、**§10 追溯矩陣每一列**（FR-01～FR-12、E1～E5、E7、身分、老師管理頁、錯誤處理）的 UT 與 IT／E2E 是否全部通過、缺陷（§9.1 格式）、待釐清（§9.2 格式；記錄 plan D1、D2、D3 的 docs 同步狀態與對應版本）、驗收結論（逐條對照 §8.1 的 7 個條件）（`docs/test-report.md`）
- [ ] T043 [QA] **檢查 README 功能清單與執行方式**（不修改 README）：逐項確認 T019 與 001～003 的 README 內容涵蓋全部功能（FR-01～FR-12、E1～E5、E7）與「如何執行」（`npm install`、`npm run dev`、fake 模式範例 ID `fixture-template-a`、`fixture-template-b`、Google 模式設定與共用給服務帳號、`data/fake-sheets` 位置）；從乾淨 clone 依 README 執行 `npm install && npm test && npm run test:e2e` 一次成功（TEST_SPEC §8.1 第 7 點）。缺漏或錯誤依 §9.1 記為缺陷寫入報告（`docs/test-report.md`）
- [ ] T044 [QA] **最終一致性驗證（憲章原則 XI）**：逐項比對程式碼與 `diagrams/004-component.puml`（組件與依賴）、`diagrams/004-class.puml`（類別、公開方法、關聯）、`diagrams/004-sequence.puml`（四段互動順序），以及 TECH_SPEC §14.1 004 列的每個測試 ID（UT-EXP、UT-CSV、UT-GW-02、UT-GW-05、UT-PROJ-09、UT-SVC-REJ（含 07）、UT-SVC-EXPORT、UT-UI-RES、UT-UI-EXP（含 02）、UT-UI-CARD-06、UT-UI-PLAY-03、IT-FLOW-01、IT-CSV-01、IT-VIS-02、E2E-12～17、MA-03～08）都有通過紀錄；不一致時以缺陷記錄於報告（QA 不修改 `src/`），並重新產生 PNG 確認無錯誤（`docs/test-report.md`、`diagrams/004-*.png`）

---

## Dependencies & Execution Order

```
Phase 1 (T001 閘門：docs 未同步即停止 → T002)
   │
   ▼
Phase 2 後端 ─ 2A (T003→T004) ─┐
              2B (T005→T006→T007→T008)
              2C (T009→T010, T011→T012→T013)
                               ├─▶ 2D (T014→T015, T016→T017) ─▶ 2E (T018) ─▶ T019 README ─▶ T020
                               │
Phase 3 前端（需 001～003 [FE]）：T021→T022 ─▶ (T023→T024 ∥ T025→T026 ∥ T027→T028) ─▶ T029→T030 ─▶ T031 ─▶ T032 ─▶ T033
   │
Phase 4：T034（需 T020 與 003 T048）─▶ T035→T036 ∥ T037 ；T038（需 T033 與 001 playwright config）─▶ T039
   │
Phase 5：T040 ─▶ T041 ∥ T042 ∥ T043 ─▶ T044
```

- 2D 依賴 2A（exporter）、2B（csv、buildCsvRows）、2C 不需要（service 測試用 InMemorySheetsGateway），但 T020 驗收需全部完成。
- T014 的 06、07 需 T017 完成才會通過（T015 只讓 01～05 通過）。
- T027 的 UT-UI-PLAY-03 在 T031 完成後才通過。
- [BE] 與 [FE] 無共用檔案，Phase 2 與 Phase 3 可由不同成員並行（Phase 3 以 `vi.mock` 取代 api）。

## Parallel Examples

```text
# Phase 2 一開始，三位後端成員可同時：
T003 exporter.test.ts   ∥   T005 csv.test.ts   ∥   T009 googleGateway.test.ts   ∥   T011 fakeGateway.test.ts
# 2D 兩個測試檔可同時撰寫：
T014 session.reject.test.ts   ∥   T016 session.export.test.ts
# Phase 3 元件測試可同時：
T023 ResultsTable.test.tsx   ∥   T025 ExportPanel.test.tsx   ∥   T027 Play.test.tsx
# Phase 4：
T035/T036 results.it.test.ts   ∥   T037 results-visibility.it.test.ts
```

## Implementation Strategy

1. **MVP（US1 + US2，P1）**：Phase 1 → 2D 的判錯（T014、T015）＋ 2E 的 reject-winner 路由 → 前端 ResultsTable、StudentResults、AnswerCard rejected、Play ENDED。此時老師與學生可看結果並判錯。
2. **US3（P1）寫回／還原**：2A、2C、T016～T017、ExportPanel。
3. **US4（P2）CSV**：2B、exportCsv、export.csv 路由、下載按鈕。
4. 整合與 E2E、最終驗收。實際執行仍依使用者指定的 Phase 順序（後端 → 前端 → QA）。

## 追溯表（User Story → 任務 → 測試 ID）

| Story | 任務 | 測試 ID |
| --- | --- | --- |
| US1 結束後看結果（FR-05、FR-09） | T023、T024、T027、T028、T031、T032、T035、T037、T038 | UT-UI-RES-01、UT-UI-PLAY-03、IT-FLOW-01、IT-VIS-02、E2E-12 |
| US2 判錯與遞補（E5） | T014、T015、T018、T022、T023、T024、T029、T030、T032、T035、T037、T038 | UT-SVC-REJ-01～07、UT-UI-RES-02、UT-UI-CARD-06、IT-FLOW-01、IT-VIS-02、E2E-13 |
| US3 寫回與還原（FR-06、§8-9、§8-10） | T003、T004、T009～T013、T016、T017、T018、T025、T026、T032、T035、T038、T041 | UT-EXP-01～04、UT-GW-02、UT-GW-05、UT-SVC-EXPORT-01～03、06、UT-SVC-REJ-07、UT-UI-EXP-01～02、IT-FLOW-01、E2E-14、E2E-15、MA-03～05 |
| US4 下載 CSV（E2） | T005～T008、T016、T017、T018、T025、T026、T036、T038 | UT-CSV-01～07、UT-PROJ-09、UT-SVC-EXPORT-04～05、IT-CSV-01、E2E-16 |
| 跨 story | T001、T002、T019、T020、T033、T034、T039～T044 | E2E-17、MA-06～09、全部回歸 |

**TECH_SPEC §14.1 004 列測試 ID 檢核**：UT-EXP（T003）、UT-CSV（T005、T007）、UT-GW-02（T009）、UT-GW-05（T011）、UT-PROJ-09（T007）、UT-SVC-REJ-01～07（T014）、UT-SVC-EXPORT-01～06（T016）、UT-UI-RES-01～02（T023）、UT-UI-EXP-01～02（T025）、UT-UI-CARD-06（T029）、UT-UI-PLAY-03（T027）、IT-FLOW-01（T035）、IT-CSV-01（T036）、IT-VIS-02（T037）、E2E-12～17（T038）、MA-03～08（T041）、全部測試回歸與 §2.3 覆蓋率門檻（T040）——全部涵蓋。

---

## Phase 6: Convergence

**Purpose**：`/speckit-converge`（2026-11-27）比對 spec／plan／tasks、程式碼、`diagrams/004-*.puml` 與 `docs/`（PRD v1.3、TECH_SPEC v1.7、TEST_SPEC v1.4）後的剩餘工作。docs 已同步 D1～D3，T001 的 (a) 檢查現可通過。既有未完成任務（T001、T002、T014 的 UT-SVC-REJ-07、T017 的 D1 合併、T020、T034～T044）不在此重複。

- [X] T045 [FE] [US3] **CRITICAL**：把 `ExportPanel.test.tsx` 中以 UT-UI-EXP-01 名義寫的「延伸斷言（plan D3）」拆成獨立的 `it('UT-UI-EXP-02 還原成功 6 格 → export-result 顯示「已還原 6 格」', …)`（TEST_SPEC v1.4 §5.8 已登錄此 ID），移除「TEST_SPEC 補登前」的暫時註解；UT-UI-EXP-01 只保留寫回相關斷言。不修改 `ExportPanel.tsx` per Constitution VII、TEST_SPEC v1.4 UT-UI-EXP-02 (partial)（`client/test/components/ExportPanel.test.tsx`）
  - 📝 註記：EXP-01 保留 onDownload 斷言，因 TEST_SPEC 無 CSV 下載的 UI 測試 ID，避免失去覆蓋。
- [ ] T046 [BE] [US3] （依賴 T017 的 D1 合併完成）更新 `README.md` 功能清單「寫回 Google Sheets」：刪除「此行為待 docs 同步後實作」的暫時說明，改為實際行為——因判錯而沒有得主的題目，寫回時該題作答格恢復為匯入時的原始值並計入「已寫回 N 格」；從未被判錯的無得主題目不寫 per FR-024、T019 (partial)（`README.md`）
- [ ] T047 [BE] 把 `diagrams/004-component.puml`、`004-class.puml`、`004-sequence.puml` 標題的「依 TECH_SPEC v1.6」改為「依 TECH_SPEC v1.7」（圖表內容已含 D1～D3，不改其他內容），執行 `java -jar plantuml.jar "./diagrams/004-*.puml"` 重新產生 PNG 且無錯誤 per Constitution XI、TECH_SPEC v1.7 (partial)（`diagrams/004-*.puml`、`diagrams/004-*.png`）
