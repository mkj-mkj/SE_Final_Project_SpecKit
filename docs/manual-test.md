# 手動驗收與驗證紀錄

## 001-session-and-join

### T086 自動化驗證（2026-11-27，基準 commit `2ef4027` + Phase 4 QA 變更）

**E2E（`npm run test:e2e`，Playwright 1.65.1、系統 Edge `channel: 'msedge'`，未下載 Playwright 瀏覽器）**

| ID | 檔案 | 結果 | 截圖 |
| --- | --- | --- | --- |
| E2E-03 | `e2e/tests/identity.spec.ts` | 通過 | `e2e/artifacts/E2E-03.png` |
| E2E-18 | `e2e/tests/identity.spec.ts` | 通過 | `e2e/artifacts/E2E-18.png` |

- webServer 以 `npm run build && npm start`（cwd 為 repo 根目錄）啟動；`npm start` 實際執行 `npm run start -w server`（工作目錄 `server/`），瀏覽器能載入 `/teacher/login`、`/join`、`/play` → 證明伺服器從 `server/` 工作目錄找到 `client/dist`。
- 001 的 spec 不呼叫 fake-sheets reset（該路由屬 002，research R-13）。

**覆蓋率（`npm run test:coverage`：46 檔、288 測試全部通過，門檻全部達標）**

| 範圍 | Lines | Branches | 門檻（L / B） | 結果 |
| --- | --- | --- | --- | --- |
| 全專案 | 85.56% | 88.87% | 80 / 75 | 通過 |
| `server/src/domain/**` | 99.64% | 96.96% | 95 / 90 | 通過 |
| `server/src/sheets/parser.ts` | 100% | 95.31% | 95 / 90 | 通過 |
| `server/src/sheets/exporter.ts` | 100% | 92.85% | 95 / 90 | 通過 |
| `server/src/export/**` | 100% | 100% | 95 / 90 | 通過 |
| `server/src/services/**` | 98.99% | 93.56% | 90 / 85 | 通過 |
| `shared/src/**` | 100% | 100% | 90 / 85 | 通過 |

排除清單（`vitest.config.ts`）：`server/src/index.ts`（與 `**/*.d.ts`）。未擴大排除、未調整門檻。

**plan.md Complexity Tracking 例外模組（覆蓋測試在實作之後執行；由 E2E-03／E2E-18 以建置版本實際執行，E2E 不計入 vitest 覆蓋率）**

| 檔案 | Lines | Branches |
| --- | --- | --- |
| `server/src/config.ts` | 0% | 0% |
| `server/src/ports/clock.ts`（正式實作） | 0% | 100% |
| `server/src/ports/scheduler.ts`（正式實作） | 0% | 100% |
| `server/src/ports/ids.ts`（正式實作） | 0% | 0% |
| `client/src/api.ts` | 13.91% | 100% |
| `client/src/socket.ts` | 13.04% | 100% |
| `client/src/main.tsx` | 0% | 0% |

**整合測試與 TECH_SPEC §14.1 001 列核對**：IT-AUTH-01～03、IT-ONLINE-01 通過。§14.1 001 列的 UT-VAL、UT-ERR、UT-PHASE、UT-REPO-01、UT-REPO-07、UT-AUTH、UT-SVC-CREATE、UT-SVC-JOIN、UT-PROJ-10、UT-BC、UT-UI-STORE、UT-UI-MSG、UT-UI-PHASE、UT-UI-LOGIN、UT-UI-SET、UT-UI-JOIN、UT-UI-DASH-01～03、UT-UI-PLAY-01～02、IT-AUTH-01～03、IT-ONLINE-01、E2E-03、E2E-18 皆有對應測試且通過；`skip`／`todo`／`fixme` 數量為 0。

備註：以 `--reporter=verbose` 連續執行全套 9 次，其中 1 次 UT-UI-DASH-02 失敗，其餘 8 次與該檔單獨執行 3 次皆通過，無法重現（見 `docs/test-report.md` Q-001）。

### T089 手動驗收（2026-11-27，基準 commit `fd9f4bb`，Edge／Chrome）

**啟動前檢查**：根目錄 `.env`（由 `.env.example` 複製、已設定 `TEACHER_PASSWORD`）；舊的 `data/` 經團隊同意刪除後，以 `npm run build && npm start` 啟動（`http://localhost:3000`）。

| 檢查 | 結果 | 證據 |
| --- | --- | --- |
| 伺服器讀到根目錄 `.env`（不是 `server/.env`） | 通過 | `server/.env` 不存在、shell 環境無 `TEACHER_PASSWORD`；伺服器仍成功啟動（該變數必填），且以根目錄 `.env` 的密碼登入回 200 |
| 資料庫建立在根目錄 `data/quiz.db` | 通過 | 啟動後出現 `data/quiz.db`（含 `-wal`、`-shm`）；`server/data/` 不存在 |

**quickstart 5 個情境**（老師：Edge 一般視窗；學生 A：Edge InPrivate；學生 B：Chrome 無痕）

| 情境 | 步驟與期望 | 結果 |
| --- | --- | --- |
| 1 登入並建立活動 | 錯誤密碼 →「驗證失敗，請重新登入或加入」；正確密碼 → 建立活動，房間碼 `6KXM2E`（6 碼、不含 I、O、0、1〔SC-006〕），第 1～6 組、準備中；重新整理仍在管理頁、房間碼相同、無建立按鈕；登出 → 登入頁，再開 `/teacher` 需重新登入 | 通過 |
| 2 調整設定 | 組數 8 → 出現第 7、8 組；純速度 → 視窗秒數欄位消失；組數 25 → 無法儲存 | 通過 |
| 3 學生加入 | 小寫房間碼 → 顯示各組與人數；第 1 組「小明」→ `/play` 顯示第 1 組／小明／準備中；「小明😀」→ 暱稱格式錯誤訊息；第 1 組再用「小明」→「這個暱稱在組內已被使用」；學生 B 以「Bob」加入第 5 組 | 通過 |
| 4 重連與重複加入 | 重新整理 `/play` 回到第 1 組／小明、老師端人數不變〔FR-025、SC-002〕；開 `/join` 直接導回 `/play`；兩個 `/play` 分頁關一個仍上線、兩個都關才離線 | 通過 |
| 5 減少組數被拒 | 第 5 組有成員時組數改 4 →「要移除的組別已有成員」，維持 8 組 | 通過 |

**補充檢查**

| 項目 | 結果 | 說明 |
| --- | --- | --- |
| (a) 1 秒內同步〔SC-001、SC-004〕 | 通過 | 碼錶計時：學生按加入 → 老師畫面出現成員 < 1 秒；老師儲存設定 → 學生畫面更新 < 1 秒（40 連線自動化量測屬 003 IT-PERF-01） |
| (b) 重啟後身分失效與上線恢復〔FR-036、FR-031〕 | 通過 | 學生在線時停止伺服器，再以 `npm run dev -w server`（同一根目錄 `.env` 與 `data/quiz.db`）啟動：老師原分頁自動導回登入頁；伺服器就緒當下的 API 快照為 `第 1 組/小明=offline, 第 5 組/Bob=offline`（2026-11-27T15:30:11Z），10 秒後兩人皆 `online`（學生分頁自動重連）；老師重新登入看到 `6KXM2E` 與成員、小明上線；學生 A 舊 `/play` 分頁維持第 1 組／小明 |
| (c) `/join?room=` 預填〔FR-027〕 | 通過 | 開啟 `room-code` 旁的加入網址 → `join-room` 已預填 |
| (d) 新分頁需登入〔FR-002〕 | 通過 | 已登入時在新分頁以網址開啟 `/teacher` → 導向登入頁（未測「複製分頁」，見 spec Assumptions） |

### T093 手動驗收（2026-11-27，基準 commit `fd9f4bb`）

| 項目 | 步驟 | 結果 |
| --- | --- | --- |
| (a) 伺服器無法連線時不重複加入（驗證 T091）〔FR-027a、FR-039〕 | 正式建置由伺服器提供前端，停止伺服器後 `/join` 本身無法載入（Edge「無法連上這個網站」），無法走到 T091 的路徑；因此改用開發模式：`npm run dev -w server`（3000）與 `npm run dev -w client`（5173）分開執行。學生 A 在 `:5173/join` 以「阿華」加入第 2 組 → `/play`；只停止 server；新分頁開 `:5173/join` → 顯示「發生未預期錯誤，請重新整理」、沒有加入表單、`localStorage` 的 `quiz.member` 仍在；重新啟動 server 後重新整理 → 導向 `/play`，回到第 2 組／阿華 | 通過 |
| (b) 設定超出範圍提示（驗證 T092）〔SC-003〕 | 管理頁組數改 21、視窗秒數改 0 → 皆顯示「輸入格式不正確」且無法儲存 | 通過 |
