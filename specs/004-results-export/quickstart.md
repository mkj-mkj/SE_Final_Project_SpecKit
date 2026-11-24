# Quickstart：結果與匯出（004-results-export）驗證指南

## 前置條件

- Node.js 22.13 以上；已 `npm install`（不需新增任何套件）。
- `.env` 由 `.env.example` 複製，`SHEETS_MODE=fake`、`TEACHER_PASSWORD` 已設定。
- 001～003 的後端已完成。步驟 3、4 需要前端：001～003 的 [FE] 任務完成後才能執行（research R-11）。
- 實作前須先完成 plan「實作前置閘門」：使用者同步 docs（含 TEST_SPEC 新增 UT-SVC-REJ-07、UT-UI-EXP-02）。

## 1. 自動化測試

| 指令 | 期望 |
| --- | --- |
| `npm test -w server -- exporter csv` | UT-EXP-01～04、UT-CSV-01～07 通過 |
| `npm test -w server -- Gateway` | UT-GW-01～05 通過（含 002 的 01、03、04） |
| `npm test -w server -- projections` | UT-PROJ-01～10 通過（本子功能新增 09） |
| `npm test -w server -- session.reject session.export` | UT-SVC-REJ-01～07、UT-SVC-EXPORT-01～06 通過 |
| `npm test -w server -- integration` | IT-FLOW-01、IT-CSV-01、IT-VIS-02 通過（含先前子功能的 IT） |
| `npm test -w client` | UT-UI-RES-01～02、UT-UI-EXP-01～02、UT-UI-CARD-06、UT-UI-PLAY-03 通過 |
| `npm run test:e2e` | E2E-12～17 通過（含先前的 E2E） |
| `npm run test:coverage` | TEST_SPEC §2.3 門檻：domain 95%／90%、services 90%／85%、全專案 80%／75%；`server/src/sheets/**`、`server/src/export/**` 行 ≥ 95% |
| `npm run lint` | 無錯誤 |

## 2. API 煙霧測試（只需要後端）

`npm run dev` 後（`TOKEN`、`SID`、`M1`～`M3` 為取得的值；fake 模式）：

1. 登入、建立活動（`fairnessMode: "speed"`、3 組）、匯入 `fixture-template-a`，三組各加入一人。
2. `POST /api/teacher/sessions/$SID/export` → **409 INVALID_PHASE**；`GET .../export.csv` → **409**；`POST .../questions/<q3>/reject-winner` → **409 INVALID_PHASE**（READY）。
3. `start`；`M1` 送第 1 題 `["CPU","作業系統"]`；`M1` 送第 3 題 `["0"]`、`M2` 送第 3 題 `["1"]`、`M3` 送第 3 題 `["=1+1"]`。
4. RUNNING 中 `POST .../questions/<q3>/reject-winner` → 200；`GET /api/play/state`（`M1`）第 3 題 `mySubmissions.status === "rejected"`；`M2` 的 state **不含** `rejected`、`rank`、`isWinner`、`score`；`M1` 再送第 3 題 → **409 ALREADY_SUBMITTED**。
5. RUNNING 中 `POST .../export` → **409**（`GET /api/dev/fake-sheets/fixture-template-a` 未改變）。
6. `end`。`GET /api/play/state`（`M3`）`results.questions` 第 3 題 winner 為第 2 組、ranking 含第 1 組 `status: "rejected"`；`scores` 依分數降冪。
7. `POST .../export` → `{ updatedCells: 3 }`，writes 為 G5「（1）CPU」、G6「（2）作業系統」、G11「1」；`GET /api/dev/fake-sheets/fixture-template-a` 中這三格改變、G8 等其他格與 fixture 相同。
8. 再判錯第 3 題兩次（第 2 組、第 3 組）→ 第三次 **409 NO_WINNER**「此題目前沒有得主」；`POST .../export` → G11 回到原始值（plan D1），updatedCells = 3（G5、G6、G11）。
9. `GET .../export.csv` → 標頭 `Content-Disposition` 含 `results-<房間碼>-r1.csv`；本文以 BOM 開頭、CRLF；資料列 = 2 + 1 + 1 + 1 = 5；`=1+1` 輸出為 `'=1+1`。
10. `POST .../restore` → `{ updatedCells: 6 }`；fake sheet 與 fixture 完全相同。`reset` 後（READY）再 `restore` → 200；`start` 後 `restore` → **409**。

## 3. 手動畫面驗證（需要前端）

| # | 操作 | 期望 | 對應 |
| --- | --- | --- | --- |
| 1 | 3 組送出後老師按「結束搶答」 | 老師顯示結果表與分數；3 個學生頁 1 秒內改為結果畫面（含分數，無判錯按鈕） | E2E-12、US1 |
| 2 | 老師按第 3 題「判錯」 | 結果表得主改為第 2 名組、分數 −1／+1；學生結果頁同步更新 | E2E-13、US2 |
| 3 | 搶答中按判錯 | 結果表出現在狀態表下方；被判錯組作答卡顯示「老師判定此答案錯誤」且無送出鈕 | UT-UI-CARD-06、plan D2 |
| 4 | 按「寫回 Google Sheets」 | 顯示「已寫回 N 格」；寫回期間三顆按鈕 disabled | E2E-14、UT-UI-EXP-01 |
| 5 | 按「還原原始內容」 | 顯示「已還原 6 格」；fake sheet 與 fixture 相同 | E2E-15、plan D3 |
| 6 | 按「下載 CSV」，用 Excel 開啟 | 中文正常、含逗號／引號／換行答案顯示原文、`=1+1` 不被計算 | E2E-16、SC-005 |
| 7 | 按「重新開始一輪」 | 回到等待開始；學生頁清空送出狀態；「還原原始內容」仍可按 | E2E-17 |

## 4. 真實 Google Sheets（手動，MA-03～05）

1. `SHEETS_MODE=google`，服務帳號金鑰放 `secrets/`；把範本複製一份並共用給服務帳號（編輯者）。
2. 完成一輪後寫回：作答格為「前綴＋答案」，格式、合併、其他儲存格不變（前後截圖，MA-03）。
3. 還原：與匯入前一致（MA-04）。
4. 改用未共用的試算表匯入或寫回 → 顯示「沒有權限存取試算表，請將試算表共用給服務帳號」（MA-05）。
