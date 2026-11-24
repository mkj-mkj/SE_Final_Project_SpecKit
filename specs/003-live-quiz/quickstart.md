# Quickstart：搶答進行（003-live-quiz）驗證指南

## 前置條件

- Node.js 22.13 以上；已 `npm install`。
- `.env` 由 `.env.example` 複製，`SHEETS_MODE=fake`、`TEACHER_PASSWORD` 已設定。
- 001、002 的後端已完成。步驟 3 之後需要前端：001 Phase 3、4 與 002 [FE] 完成後才能執行。

## 1. 自動化測試

| 指令 | 期望 |
| --- | --- |
| `npm test -w server -- ranking settlement projections` | UT-RANK、UT-SETTLE、UT-PROJ-01～10 全部通過 |
| `npm test -w server -- repo session.` | UT-REPO-01～07、UT-SVC-*（含 PHASE、DRAFT、SUB、FAIR、WD、RECOVER）全部通過 |
| `npm test -w server -- integration` | IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01、IT-CONC-01、IT-RECON-01～02、IT-RESTART-01、IT-PERF-01 通過（含 001 的 IT） |
| `npm test -w client` | UT-UI-FMT、UT-UI-CLOCK、UT-UI-CTRL、UT-UI-GRID、UT-UI-CARD-01～05 通過 |
| `npm run test:e2e` | E2E-04～11 通過（含 001、002 的 E2E） |
| `npm run test:coverage` | `server/src/domain/**` 行 ≥ 95%／分支 ≥ 90%；`server/src/services/**` 90%／85% |
| `npm run lint` | 無錯誤 |

## 2. API 煙霧測試（只需要後端）

`npm run dev` 後依序執行（以 `TOKEN`、`SID`、`M1`、`M2` 代表取得的值）：

1. `POST /api/teacher/login` → 取得 `TOKEN`；`POST /api/teacher/sessions` `{ "fairnessMode": "speed" }` → `SID`、房間碼。
2. `POST /api/teacher/sessions/$SID/import` `{ "spreadsheet": "fixture-template-a" }` → phase READY、4 題。
3. 兩組各加入一人（`POST /api/public/sessions/:roomCode/join`）→ `M1`、`M2`。
4. 開始前 `POST /api/play/submissions`（Bearer `M1`）→ **409 INVALID_PHASE**。
5. `POST /api/teacher/sessions/$SID/start` → phase RUNNING。
6. `M1` 送出第 3 題 `["0"]`，接著 `M2` 送出第 3 題 `["1"]` → 皆 201；`GET /api/teacher/sessions/$SID` 的第 3 題 cells：第 1 組 `rank 1、isWinner true`，第 2 組 `rank 2`。
7. `GET /api/play/state`（Bearer `M2`）→ 回應中**不含** `"0"`、第 1 組成員 id、`rank`、`isWinner`、`windowEndsAt`。
8. `M1` 對同一題再送出 → **409 ALREADY_SUBMITTED**；第 1 題只送 `["CPU", " "]` → **422 GROUP_INCOMPLETE**。
9. `M1` 在 10 秒內 `POST /api/play/submissions/:id/withdraw` → 204；老師 view 第 2 組成為得主，分數 第 1 組 0、第 2 組 1。
10. `POST .../end` → phase ENDED；`GET /api/play/state`（`M2`）的 `results` 含所有組的 ranking。
11. `POST .../reset` → phase READY、round 2、cells 全部為 null。

## 3. 手動畫面驗證（需要前端）

| # | 操作 | 期望 | 對應 |
| --- | --- | --- | --- |
| 1 | 老師開 `/teacher`、學生開 3 個獨立瀏覽器視窗加入第 1 組（2 人）與第 2 組（1 人）；老師按「開始搶答」 | 所有學生頁 1 秒內顯示「搶答中」，輸入框解鎖 | US1、E2E-05 |
| 2 | 第 1 組 X 在第 3 題輸入「0」 | Y 的第 3 題 1 秒內出現「0」；第 2 組與老師頁沒有 | US4、E2E-06 |
| 3 | X 送出第 3 題 | 老師 `status-cell-3-1` 顯示「0、X、HH:mm:ss.SSS、#1、★ 得主」；學生顯示「已送出 HH:mm:ss」與「撤回（10 秒）」倒數；第 2 組頁面毫無變化 | US2、US3、E2E-07 |
| 4 | 3 秒後重新整理 Y 的頁面 | 回到第 1 組，撤回倒數約「撤回（7 秒）」 | US7、E2E-10 |
| 5 | 按撤回 | 輸入框恢復可編輯並帶入「0」；老師該格顯示「已撤回」 | US6、E2E-09 |
| 6 | 結束、重新開始一輪、在設定改為公平 3 秒後再開始；第 1 組先拿第 3 題；第 4 題第 1 組先送、第 2 組 1 秒後送 | 老師 `question-state-4` 顯示「判定中 x.x s」倒數，約 3 秒後第 2 組「★ 得主」 | US5、E2E-11 |
| 7 | 公平模式送出後 1 秒內停止伺服器，5 秒後重新啟動 | 該題已結算，老師畫面顯示得主；成員先顯示離線，重新連線後恢復 | US7、IT-RESTART-01 |

## 4. 圖表一致性

`java -jar plantuml.jar "./diagrams/*.puml"` 無錯誤。實作完成後逐項比對 `diagrams/003-*.puml` 的組件、類別（含公開方法與關聯）與互動順序（憲章原則 XI）。
