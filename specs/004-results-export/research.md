# Research：結果與匯出（004-results-export）

**日期**：2026-11-24 ｜ **依據**：`docs/TECH_SPEC.md` v1.6、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2、`diagrams/004-*.puml`

Technical Context 沒有 NEEDS CLARIFICATION：技術棧沿用 001 plan，相依全部已安裝（`googleapis` 已於 002 加入）。本文件記錄與 TECH_SPEC 的差異（D 編號，已由使用者決定）與實作層級的決定（R 編號）。

---

## 與 docs 的差異（憲章原則 II）

### D1：判錯到無人遞補的題目，寫回時恢復原始值

- **來源**：spec Clarifications Q1（2026-11-24）。
- **衝突**：PRD §8-9「只寫有得主的題目」；TECH_SPEC §7.4 `buildExportWrites` 註解「無得主的題目不產生寫入」；§7.9 exportToSheet 演算法只列 `buildExportWrites → sheets.writeCells`。
- **使用者決定（2026-11-24 plan）**：**Service 合併還原寫入**。
  - `buildExportWrites`、`buildRestoreWrites` 的簽名與行為**完全照 TECH_SPEC**（UT-EXP-01～04 不變）。
  - `SessionService.exportToSheet` 另外找出「`winnerOf` 為 null 且有任何 `status = 'rejected'` 送出」的題目，對這些題目的 slots 呼叫 `buildRestoreWrites`，與 `buildExportWrites` 的結果合併後依 `sheetTitle → row → col` 排序，再呼叫 `writeCells`；`updatedCells` 為合併後筆數。
  - 從未有人被判錯的無得主題目仍不寫（PRD §8-9 的一般情況不變）。
- **需同步的 docs（由使用者修改，本 plan 不改 docs/）**：
  1. PRD §8-9 補一句：「因判錯而沒有得主的題目，寫回時恢復該題作答格的原始值。」
  2. TECH_SPEC §7.9 exportToSheet 列演算法改為：`buildExportWrites` ＋ 對「無得主且有 rejected」題目 `buildRestoreWrites` → 合併排序 → `sheets.writeCells`（0 筆時不呼叫）。
  3. TECH_SPEC §12.6 時序圖同步上一點。
  4. TEST_SPEC 新增 **UT-SVC-REJ-07**：「ENDED，第 3 題唯一送出被判錯後匯出 → gateway 收到 G11 = originalValue，updatedCells 含該格」。
- **在 docs 同步前**：UT-SVC-REJ-07 先以此 ID 撰寫（測試名稱含 ID，憲章原則 VII），並在 tasks 中標明「依 plan D1，待 TEST_SPEC 補登」。

### D2：搶答中的判錯入口為 ResultsTable

- **來源**：spec FR-009（搶答中可判錯）；TECH_SPEC §6（rejectWinner：RUNNING、ENDED）、§12.5（「在結果表或即時表按判錯」）。
- **衝突**：TECH_SPEC §10.4 只有 `ResultsTable` 有 `btn-reject-{qNumber}`；§10.5 線框只在 ENDED 畫出結果表；`StatusGrid`（003）沒有判錯按鈕。
- **使用者決定（2026-11-24 plan）**：**RUNNING 也顯示 ResultsTable**。`TeacherDashboard` 在 RUNNING 與 ENDED 都渲染 `ResultsTable`（RUNNING 時位於 `StatusGrid` 下方）。不新增 `data-testid`，不修改 003 的 `StatusGrid`。老師本來就看得到得主（TeacherView 含 `winnerTeamId`、`rank`、`isWinner`），不影響 FR-10。
- **需同步的 docs**：TECH_SPEC §10.4 ResultsTable 用途補「RUNNING、ENDED 顯示」；§10.5 搶答中線框補結果表（選擇性）。

### D3：還原完成訊息「已還原 N 格」

- **來源**：spec Clarifications Q3。TECH_SPEC §10.4 只列 `export-result` testid，未定義文字；TEST_SPEC 只有 UT-UI-EXP-01（「已寫回 3 格」）。
- **處理**：`ExportPanel` 在 `export-result` 顯示「已還原 {n} 格」。不與 docs 衝突（屬未定義處），建議 TECH_SPEC §10.4 補記文字；如需測試 ID，建議 TEST_SPEC 新增 UT-UI-EXP-02。在補登前，於 UT-UI-EXP-01 同一測試檔中以 `UT-UI-EXP-01` 的延伸斷言驗證（不另立 ID）。

---

## 實作決定

### R-01：判錯只改 status，得主與分數全部重算

- **Decision**：`rejectWinner` 在 `runTx` 內：`assertPhase(phase,'rejectWinner')` → `getQuestion(qid)` 且 `q.sessionId === sessionId`（否則 `QUESTION_NOT_FOUND`）→ `listSubmissionsByQuestion(qid)` → `winnerOf(subs)`；null → `NO_WINNER`；否則 `repo.updateSubmission(w.id, { status: 'rejected' })`；COMMIT 後 `broadcaster.publish(sessionId)`（teacher＋全部組，§9.3）；回傳 `projectTeacherView`。
- **Rationale**：TECH_SPEC §7.6 註：rejected 保留名次、不能當得主 → `winnerOf` 自動遞補、`teamScores` 自動扣分；使用者約束「不另外儲存得主與分數」。單一同步交易保證並發判錯不會跳過候選（spec FR-021）。
- **Alternatives**：儲存 `winner_team_id`／`score` 欄位——違反約束且需同步維護。

### R-02：搶答中判錯的資訊隔離

- **Decision**：不新增任何投影欄位；被判錯組由 003 的 `projectTeamView.mySubmissions[qid].status === 'rejected'` 得知；其他組的 TeamView 在 RUNNING 中不含 rank／isWinner／score（003 已保證，IT-VIS-01）。判錯推播到全部組只是重送各自的快照。
- **Rationale**：憲章原則 IV；不改 003 的白名單。
- **驗證**：UT-SVC-REJ 系列中加入「RUNNING 判錯後他組 TeamView 序列化不含被判錯組 id 與 `rejected`」的斷言（附屬於 UT-SVC-REJ-01 的 RUNNING 變體，不新增 ID）。

### R-03：公平模式視窗中的題目不可判錯

- **Decision**：`winnerOf` 對 `orderKey = null` 的送出回傳 null → `NO_WINNER`；不取消、不影響視窗排程。判錯改變的分數在下一次 `settleWindow` 時由 `teamScores` 自然反映（spec FR-019）。

### R-04：exportToSheet 流程（含 D1）

- **Decision**：
  1. `assertPhase(phase,'export')`（ENDED）；`session.spreadsheetId` 為 null → `INVALID_PHASE`（ENDED 必定已匯入，防禦性檢查）。
  2. `agg = loadAggregate(sessionId)`；依題目分組送出，`winners = Map(qid → winnerOf(subs))`（只放非 null）。
  3. `writes = buildExportWrites(agg.slots, agg.questions, winners)`。
  4. D1：`rejectedNoWinner = 題目 where winnerOf(subs) === null && subs.some(s => s.status === 'rejected')`；`writes.push(...buildRestoreWrites(這些題目的 slots))`；整體依 `sheetTitle`、`row`、`col` 排序（slots 帶 row／col；CellWrite 沒有，排序以 slot 為鍵後再轉出）。
  5. `writes.length > 0` 時 `await sheets.writeCells(spreadsheetId, writes)`；0 筆時不呼叫閘道（避免 Google API 對空 data 回錯）。
  6. 回傳 `{ updatedCells: writes.length, writes }`。不推播、不改資料庫。
- **錯誤**：閘道丟出的 `SHEETS_PERMISSION_DENIED`／`SHEETS_NOT_FOUND`／`SHEETS_ERROR` 原樣往上拋（UT-SVC-EXPORT-06），由 `errorHandler` 轉 403／404／502。
- **冪等**：同一狀態重複寫回得到相同試算表（spec FR-031），不需鎖。
- **async 與交易**：寫回是唯讀資料庫 ＋ 外部呼叫，不在 `runTx` 內；await 期間若有判錯，以呼叫當下載入的 aggregate 為準，老師再按一次即可。

### R-05：restoreSheet 流程

- **Decision**：`assertPhase(phase,'restore')`（READY、ENDED）→ `buildRestoreWrites(listSlotsBySession)` → `writeCells`（0 筆不呼叫）→ `{ updatedCells }`。所有作答格不論有無得主都寫回原值（spec FR-029）。

### R-06：googleGateway.writeCells

- **Decision**：`client.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: writes.map(w => ({ range: rangeA1(w.sheetTitle, w.a1), values: [[w.value]] })) } })`；錯誤經既有 `toAppError`（403／404／其他）。`writes` 為空時直接 return。
- **Rationale**：使用者指定 `values.batchUpdate` + `RAW`；googleapis 的 `batchUpdate` 參數把 `valueInputOption`、`data` 放在 `requestBody`（TECH_SPEC §7.4 為簡寫）。`RAW` 讓 `=1+1` 以文字寫入（spec FR-027），且 `values` API 只改值、不改格式與合併（spec FR-026）。單一 batchUpdate 請求在 Google 端為整批處理。
- **UT-GW-02** 斷言：mock client 的 `batchUpdate` 被呼叫一次，`requestBody.valueInputOption === 'RAW'`，`data[0].range === "'學習單'!G5"`。
- **Alternatives**：`spreadsheets.batchUpdate` + `updateCells`——可改格式，風險高且非使用者指定。

### R-07：fakeGateway.writeCells

- **Decision**：`getSnapshot(id)`（未載入時從 fixture 載入）→ 對每筆寫入找 `title === sheetTitle` 的工作表（找不到 → `SHEETS_ERROR`），以本檔私有的 `parseA1` 轉 0-based 列欄，必要時補齊列與欄後設定值；全部套用後，若建立時有提供輸出資料夾，將整份快照寫到 `${outDir}/${id}.json`（`mkdirSync({ recursive: true })`）。
- **簽名**：`createFakeGateway(dir: string, outDir?: string)`——TECH_SPEC 未規定建構函式參數；新增**可省略**的第二參數，`index.ts` 傳入 `fromRoot('./data/fake-sheets')`（`data/` 已在 `.gitignore`），單元測試不傳以免碰檔案系統。回傳物件的方法名稱（fetchSnapshot、writeCells、getSnapshot、reset）不變。
- **原子性**：先驗證所有 sheetTitle 與 A1 合法再套用，避免寫一半。
- **UT-GW-05**：writeCells 後 `getSnapshot` 可見；`reset` 後恢復 fixture 原值。

### R-08：CSV 產生（buildCsvRows ＋ buildResultsCsv）

- **buildCsvRows(agg)**（projections，純函式）：
  - 每題 `rankSubmissions(subs)` 得 `rank`、`isWinner`（id → 值）；withdrawn 不在其中 → `rank = null`、`isWinner = false`。
  - 對 `agg.submissions` 的每一筆（含 withdrawn、rejected）、每個 `answers[i]` 產生一列：`questionNumber`、`subNo = i + 1`、`teamName`、`submittedBy`（成員暱稱）、`answer`、`serverTime`、`rank`、`status`、`isWinner`。
  - 排序：`questionNumber` 升冪 → `rank` 升冪（null 最後）→ null 之間依 `serverTime`、再依 `seq` → `subNo` 升冪。
- **buildResultsCsv(rows)**（`export/csv.ts`，純函式）：
  - `'﻿' + 表頭 + '\r\n'` ＋ 每列 `+ '\r\n'`。
  - 每個欄位依序：轉字串 → **防公式**（開頭為 `=`、`+`、`-`、`@` 時前加 `'`）→ **RFC 4180**（含 `,`、`"`、`\r`、`\n` 時包雙引號、`"` → `""`）。順序先防公式再跳脫，使 `=a,b` 輸出為 `"'=a,b"`。
  - 時間：`new Date(ms + 8 * 3600_000).toISOString().replace('Z', '+08:00')`（Asia/Taipei 無日光節約，不依賴 Intl／系統時區；UT-CSV-05：0 → `1970-01-01T08:00:00.000+08:00`）。
  - 狀態對照 active→有效、withdrawn→已撤回、rejected→判錯；是否得主 是／否；rank null → 空字串。
- **路由**：`GET /sessions/:id/export.csv` → `res.status(200).type('text/csv; charset=utf-8').set('Content-Disposition', \`attachment; filename="results-${roomCode}-r${round}.csv"\`).send(csv)`（roomCode 只含 ASCII，不需 RFC 5987 編碼）。

### R-09：ResultsTable 由 TeacherView 推導

- **Decision**：TECH_SPEC 的 `TeacherView` 沒有 `results` 欄位；`ResultsTable` 以 `view.questions`（`winnerTeamId`、`subLabels`）、`view.cells`（`submission.rank`、`status`、`isWinner`、`answers`）、`view.teams`（`score`、`index`、`name`）推導：
  - 每題一列（題號升冪），`result-winner-{n}`：得主組名或「無」；答案以子題標籤串接（「（1）CPU（2）作業系統」，與 §10.5 線框一致）；無得主答案欄顯示「無」。
  - 順位：該題 `cells` 中 `submission` 非 null、`status !== 'withdrawn'`、`rank !== null` 者依 rank 升冪，顯示「{rank}.{組名}」，rejected 加「（判錯）」。RUNNING 視窗中（rank null）者不列入。
  - 分數 `score-{teamIndex}`：依 score 降冪、index 升冪。
  - `btn-reject-{n}`：每題一顆，`busy` 時 disabled；不因無得主而停用（再按顯示「此題目前沒有得主」，spec US2-3）。
- **Rationale**：不改 §4 型別；TeacherCell 已是「每組最新一筆」，與 Results 的「未撤回送出」一致（被判錯的組不能重送，撤回後重送者最新一筆即有效那筆）。
- **學生端**：`StudentResults` 直接渲染 `TeamView.results`（spec Clarifications Q2：含所有組分數）。

### R-10：下載 CSV（前端）

- **Decision**：`useTeacher.downloadCsv()` 以 `fetch` 帶 `Authorization: Bearer` 取得 `blob`，從 `Content-Disposition` 取檔名（取不到時 `results.csv`），`URL.createObjectURL` + 暫時 `<a download>` 觸發下載後 `revokeObjectURL`。錯誤（409 等）走既有 `request()` 的錯誤解析並顯示 ErrorBanner。
- **Rationale**：老師 token 在 sessionStorage，不能用一般連結（無法帶 header）。

### R-11：前端相依與執行順序

- **事實**：目前 repo 尚無 `client/`（001～003 的 [FE] 任務未完成）。§14.1 的 004 前端只包含 ResultsTable、ExportPanel、StudentResults、AnswerCard rejected 狀態、Play ENDED 畫面、useTeacher 四個方法。
- **Decision**：004 不建立 001～003 的前端檔案；004 [FE] 任務標為「依賴 001 T051 起的 [FE] 任務與 003 的 T044～T046 完成」。後端（[BE]）與整合測試（[QA] IT）可先行，E2E-12～17 待前端完成。

### R-12：相依套件

- **Decision**：不新增任何相依。`googleapis`（純 JS）已在 `server/package.json`；CSV 自行實作（規則簡單且需防公式注入，現成套件不一定支援）；不使用任何 `.node` 原生模組。
