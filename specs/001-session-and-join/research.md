# Research：001-session-and-join

Technical Context 沒有 NEEDS CLARIFICATION。以下記錄 TECH_SPEC 未寫明、但實作 001 時必須決定的細節。每項都不改變契約（型別、簽名、路徑、事件、錯誤碼、`data-testid`）。

## R-01 Monorepo 與測試組態

- **Decision**: 根目錄 `package.json` 以 npm workspaces 管理 `shared`、`server`、`client`、`e2e`；根目錄 `vitest.workspace.ts` 列出 shared／server／client 三個專案，`npm test` 一次跑完 UT＋IT；`npm run test:coverage` 在根目錄以 `@vitest/coverage-v8` 彙整覆蓋率，並用 `coverage.thresholds` 的 glob 鍵設定 TEST_SPEC §2.3 的分區門檻。shared 以 TypeScript 原始碼直接被 server／client 引用（`"main": "src/index.ts"`、tsconfig `paths`），開發與測試不需先 build。
- **Rationale**: 單一指令產生單一覆蓋率報告，門檻才能涵蓋「全專案 ≥ 80%」；避免每個 workspace 各自計算。
- **Alternatives**: 每個 workspace 各跑 Vitest 再合併報告（設定複雜、全專案門檻難以計算）；shared 先 build 成 JS（開發迴圈變慢）。

## R-02 讀取 `.env`

- **Decision**: `config.ts` 用 `dotenv`（純 JS、無原生模組）讀 `.env`，再以 zod 驗證：`TEACHER_PASSWORD` 非空；`PORT` 預設 3000；`DB_PATH` 預設 `./data/quiz.db`，非 `:memory:` 時自動建立父目錄；`SHEETS_MODE` ∈ {fake, google}，預設 fake；`google` 時檢查金鑰檔存在。驗證失敗印出繁中訊息並 `process.exit(1)`。
- **Rationale**: TECH_SPEC §3.4 要求啟動時驗證；Node 22 的 `--env-file` 在檔案不存在時會報錯，且無法提供清楚訊息。
- **Alternatives**: `node --env-file`（缺檔即失敗、不易測試）。

## R-03 001 階段的 SheetsGateway 注入

- **Decision**: `ServiceDeps.sheets` 是必填（§7.9）。001 的 `index.ts` 注入一個本地（不匯出）的「尚未提供」gateway：兩個方法都 reject `AppError('SHEETS_ERROR')`。002 依 `SHEETS_MODE` 改為 `fakeGateway`／`googleGateway`。測試一律用 `InMemorySheetsGateway`。
- **Rationale**: 維持 §7.9 的建構子簽名，又不提前實作 002 的 `fakeGateway.ts`。001 沒有任何方法會呼叫 gateway。
- **Alternatives**: 在 001 先做 fakeGateway（越界）；把 `sheets` 改成選填（改契約）。

## R-04 makeTestService 預設 snapshots

- **Decision**: 依 TECH_SPEC §14.1 補充說明，001 的 `makeTestService` 預設 `snapshots = {}`；TEST_SPEC §3 註解中的「預設載入兩份 fixture」從 002 開始生效（002 的 tasks 會修改此 helper）。
- **Rationale**: 001 沒有 `fixtures.ts`；兩份文件已明訂此分階段做法。
- **Alternatives**: 001 就讀 fixture（需提前做 002 的 fixtures.ts）。

## R-05 房間碼產生與重抽

- **Decision**: `cryptoIdGen.roomCode()` 以 `crypto.randomInt(0, 32)` 從 `ROOM_CODE_ALPHABET` 取 6 字。`createSession` 在交易內檢查 `room_code` 是否已存在，重複就重抽，最多 10 次；10 次都重複時丟 `AppError('INVALID_INPUT')`（§7.9 表格唯一列出的錯誤），訊息「輸入格式不正確」。
- **Rationale**: 32^6 ≈ 10 億，10 次全部重複機率可忽略；不新增錯誤碼。UT-SVC-CREATE-02 用 SeqIdGen 驗證重抽。
- **Alternatives**: 新增 ROOM_CODE_EXHAUSTED 錯誤碼（改契約，不採用）。

## R-06 「目前活動」的判定

- **Decision**: `getCurrentSession()` 取 `created_at` 最大者，同毫秒以 SQLite `rowid` 較大者為準；沒有任何活動回傳 `null`，路由 `GET /api/teacher/sessions/current` 轉成 404 `SESSION_NOT_FOUND`。「只能有一個活動」僅在前端限制（TeacherDashboard 200 時不顯示 `btn-create-session`）；伺服器 `createSession` 不拒絕重複建立，UT-SVC-CREATE-02 仍需建立兩個活動。
- **Rationale**: 符合 PRD v1.1 §5.1 步驟 2 與 spec Assumptions；不新增錯誤碼。

## R-07 updateSettings 的組數增減

- **Decision**: 單一交易內：(1) `assertPhase(phase, 'updateSettings')`；(2) 以 zod 範圍驗證（組數 2–20、秒數 1–10、模式 speed／fair）→ INVALID_INPUT；(3) 減少組數時查詢 `idx > newCount` 的組是否有成員，任一有成員 → TEAM_HAS_MEMBERS，整筆不變；否則刪除這些組；(4) 增加組數時新增 `idx = old+1..new`，名稱 `第 ${idx} 組`；(5) 更新 session。切到 speed 時保留原 `windowSec`（前端隱藏欄位但不清除）。成功後 `publish(sessionId)`。
- **Rationale**: 對應 FR-010～FR-014、UT-SVC-CREATE-03～07；保留 windowSec 讓老師切回 fair 時維持原值。

## R-08 暱稱驗證位置

- **Decision**: `shared/validation.ts` 的 `normalizeNickname`：`trim` → 長度 1–`MAX_NICKNAME_LENGTH` → 符合 `NICKNAME_PATTERN`，任一不符丟 INVALID_NICKNAME；`nicknameKey` = `normalizeNickname(s).toLowerCase()`。`join` 先驗證暱稱，再以 `UNIQUE(team_id, nickname_key)` 檢查，衝突轉 NICKNAME_TAKEN（先查詢再插入，並把 SQLite UNIQUE 錯誤也轉成 NICKNAME_TAKEN 以防萬一）。前端 JoinForm 只做「空白 → disabled」（UT-UI-JOIN-02），其餘交給伺服器錯誤訊息。
- **Rationale**: 規則只寫一次（shared）；因 `NICKNAME_PATTERN` 只允許基本平面字元，`String.length` 就等於字數。
- **join 的檢查順序**：normalizeRoomCode（SESSION_NOT_FOUND）→ 活動存在（SESSION_NOT_FOUND）→ team 屬於活動（TEAM_NOT_FOUND）→ 暱稱（INVALID_NICKNAME）→ 組內重複（NICKNAME_TAKEN）。

## R-09 上線狀態與多分頁計數

- **Decision**: `socket.ts` 維護 `Map<memberId, number>` 連線數。連線成功：計數 +1，從 0 變 1 時呼叫 `service.setOnline(memberId, true)`；斷線：計數 −1，變 0 時呼叫 `setOnline(memberId, false)`。`SessionService` 以記憶體 `Set<string>` 保存 online 成員，`setOnline` 狀態有變才更新 `lastSeenAt`（透過 clock）並 `publish(sessionId, { teacher: true, teamIds: [teamId] })`。`SessionAggregate.onlineMemberIds` 從這個 Set 取得。伺服器重啟後 Set 為空，所有成員視為離線。
- **Rationale**: 多分頁規則屬於連線層的事實（幾個 socket），上線與否屬於服務狀態；兩者分開讓 IT-ONLINE-01 與 UT-PROJ-10 都能獨立測試。

## R-10 Socket 連線驗證

- **Decision**: `io.use`：讀 `handshake.auth.token`。先試 `authService.verifyTeacher(token)`；成功時必須有 `auth.sessionId` 且活動存在，否則 `next(new Error('UNAUTHORIZED'))`；加入 `teacher:${sessionId}`。否則試 `service.resolveMember(token)`，成功加入 `team:${teamId}`。兩者皆失敗 → `UNAUTHORIZED`。連線後立即 emit 一次目前狀態（`teacher:state` 或 `team:state`）。
- **Rationale**: 對應 §7.11、§9.1、IT-AUTH-03、FR-035／FR-036。

## R-11 HTTP 驗證中介層

- **Decision**: `http/auth.ts` 匯出 `requireTeacher(auth)`（Bearer → `verifyTeacher`）與 `requireMember(service)`（Bearer → `resolveMember`，把 member 掛在 `res.locals`）。老師 token 打學生 API、學生 token 打老師 API 都因查不到而 401（IT-AUTH-02）。Express 4 不會自動捕捉 async 錯誤，001 的路由皆為同步；仍以 `wrap(fn)` 包裝，為 002 的 async 路由預留。
- **Rationale**: HTTP 層只做轉換（原則 VIII）。

## R-12 前端狀態與錯誤

- **Decision**: `useTeacher` 掛載時 `GET /sessions/current`：200 → 設 view 並以 `{token, sessionId}` 連 socket，收到 `teacher:state` 直接取代 view；404 → view = null（顯示 `btn-create-session`）；401 → `clearTeacher()` 並導向 `/teacher/login`。`usePlay` 掛載時 `GET /api/play/state`，401 → `clearMember()` 並導向 `/join?room=<roomCode>`；socket `connect_error.message === 'UNAUTHORIZED'` 時同樣處理。錯誤以 `messages.ts` 轉成 §11 中文訊息，未知碼顯示「發生未預期錯誤，請重新整理」。
- **Rationale**: 對應 §10.1–§10.3、§12.1–§12.2 與 UT-UI-PLAY-01～02、UT-UI-JOIN-05～06、UT-UI-DASH-01～03。

## R-13 E2E 啟動方式

- **Decision**: `e2e/playwright.config.ts`：`use.channel = 'msedge'`；`webServer` 先 `npm run build` 再以 `PORT=3100 DB_PATH=:memory: SHEETS_MODE=fake TEACHER_PASSWORD=e2e-pass` 執行 `npm start`（server 提供 client 靜態檔）；`reuseExistingServer: false`。E2E-18 寫在 E2E-03 同一個 spec 檔、緊接其後，沿用相同 browser context。TEST_SPEC §7 要求「每個 spec 開始前呼叫 fake-sheets reset」，該路由屬 002；001 的 spec 不呼叫。
- **Rationale**: 不下載 Playwright 瀏覽器；以建置版本測試最接近 Demo 環境。
