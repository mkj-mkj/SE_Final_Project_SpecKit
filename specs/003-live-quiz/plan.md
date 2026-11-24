# Implementation Plan：搶答進行（003-live-quiz）

**Branch**: `003-live-quiz` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-live-quiz/spec.md`

**藍圖（憲章原則 XI）**：[`diagrams/003-component.puml`](../../diagrams/003-component.puml)、[`diagrams/003-class.puml`](../../diagrams/003-class.puml)、[`diagrams/003-sequence.puml`](../../diagrams/003-sequence.puml)（2026-11-24 依差異 D2、D3 更新，並依 analyze I2、I3 再更新；PNG 已重新產生）

**契約依據**：`docs/TECH_SPEC.md` v1.6、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2。型別、函式簽名、API 路徑、Socket 事件、錯誤碼、`data-testid` 照抄 TECH_SPEC。差異 D1（撤回 spec FR-006a）已由使用者決定；D2、D3 只改圖表、不改 docs（見 [research.md](./research.md)）。

## Summary

實作搶答的核心流程：老師開始、結束、重新開始一輪；學生以組為單位共編草稿、送出、在 10 秒內撤回；伺服器依自己的時間與遞增序號判定得主（純速度模式立即判定；公平模式開 W 秒視窗，依「低分優先 → 較早 → seq」結算）；老師即時看到「題號 × 組別」狀態表；結束前學生收不到他組任何資訊；斷線重連與伺服器重啟後恢復原狀態。範圍嚴格限定在 TECH_SPEC §14.1「003-live-quiz」一列：

- **server/**：`domain/ranking.ts`（§7.6）、`domain/settlement.ts`（§7.7）；projections 補完（TeacherView 的 cells、state、windowEndsAt、winnerTeamId、teams.score；TeamView 的 drafts、mySubmissions；`buildResults`）；repo（drafts、submissions、seq、題目狀態）；`SessionService` 的 start、end、reset、updateDraft、submit、withdraw、settleWindow、recover；`boot/recover.ts`；路由 `POST /api/teacher/sessions/:id/{start,end,reset}`、`PUT /api/play/drafts/:questionId`、`POST /api/play/submissions`、`POST /api/play/submissions/:id/withdraw`；推播範圍依 §9.3；測試替身 `seed.ts`。
- **client/**：`format.ts`、`useServerClock`；useTeacher 的 start、end、reset；usePlay 的 setDraft、submit、withdraw；`ControlBar`、`StatusGrid`（StatusCell 規則）、`AnswerCard`（rejected 以外的狀態）；Play 的搶答畫面。
- **e2e/**：E2E-04～11。

技術方法：得主、順位、分數一律由 `ranking.ts` 的純函式從送出紀錄推導、不另外儲存；每個寫入動作在 `withTransaction` 的單一同步函式內完成，排程與推播延到 COMMIT 之後（research R-01）；指令走 REST，狀態以 `teacher:state`／`team:state` 完整快照推播；學生端資料一律經 `projectTeamView` 以白名單投影（research R-07）。

## Technical Context

**Language/Version**: TypeScript 5.x（`strict: true`）；Node.js 22.13 以上

**Primary Dependencies**:
- 沿用 001／002：Express 4、Socket.IO 4、zod、`node:sqlite`、dotenv、googleapis；React 18、Vite 5、React Router 6、socket.io-client
- 新增：**無**（本子功能不新增任何執行期或開發相依）
- 禁止：任何含 `.node` 原生模組的套件

**Storage**: SQLite（`node:sqlite`，`DatabaseSync`）；讀寫 `sessions`（phase、started_at、ended_at、round）、`questions`（state、window_ends_at）、`drafts`、`submissions`；唯一索引 `uq_sub_team_q_live` 為最後防線。schema 沿用 001，不修改。上線狀態只存在記憶體。

**Testing**: Vitest 2（coverage-v8；`server/src/domain/**` 行 ≥ 95%／分支 ≥ 90%，`server/src/services/**` 90%／85%）；`FakeClock` + `ManualScheduler` + `SeqIdGen` + `RecordingBroadcaster`（001）＋新增 `seed.ts`；整合測試用真實 HTTP + Socket.IO（IT-CONC、IT-PERF 使用真實 clock 與 timerScheduler）；IT-RESTART-01 使用暫存檔案 DB；jsdom + @testing-library/react（fake timers）；Playwright（`channel: 'msedge'`）

**Target Platform**: 本機 Windows 11；Edge／Chrome；`localhost`

**Project Type**: Web application（npm workspaces：shared、server、client、e2e）

**Performance Goals**: 送出到老師畫面更新 p95 < 500 ms（10 組 × 4 人 + 老師，IT-PERF-01）；開始／結束／重新開始後 1 秒內所有分頁切換（E2E-05、IT-SYNC-01）；草稿 1 秒內同步到同組（E2E-06）

**Constraints**: submit、settleWindow 必須在單一同步交易內完成（同題唯一得主）；domain／service 不得直接呼叫 `Date.now()`／`setTimeout`／`Math.random()`；RUNNING 中 TeamView 不得含 `rank`、`isWinner`、`score(s)`、`state`、`windowEndsAt`、`winnerTeamId` 與他組資料；本機執行

**Scale/Scope**: 10 組 × 4 人、數十題；本子功能 96 個測試案例（server UT 67：RANK 9、SETTLE 6、PROJ 7、REPO 5、SVC-PHASE 5、DRAFT 6、SUB 10、FAIR 10、WD 6、RECOVER 3；client UT 11：FMT 2、CLOCK 1、CTRL 1、GRID 2、CARD 5；IT 10；E2E 8）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查內容 | 結果 |
| --- | --- | --- |
| I 繁體中文優先 | UI 文字（「搶答中」「判定中」「★ 得主」「已撤回」「撤回（n 秒）」…）與錯誤訊息（§11 `MESSAGES`）為繁中；識別字英文；submit／settleWindow 演算法、公平排序、資訊過濾、階段轉換加繁中註解 | ✅ |
| II 文件為準 | 範圍取自 §14.1 003 列；D1 與 TECH_SPEC／TEST_SPEC 的衝突已先列出，由使用者決定撤回 FR-006a；D2、D3 不改 docs | ✅ |
| III 伺服器唯一真相 | serverTime、seq、名次、得主、分數只由伺服器計算；zod 只取 `questionId`、`answers`，不讀客戶端時間；客戶端倒數只供顯示；單一同步交易＋唯一索引 | ✅ |
| IV 資訊隔離 | 學生資料只經 `projectTeamView`（白名單欄位）；草稿推播 scope 只有本組；UT-PROJ-04、05、UT-SVC-DRAFT-01、05、IT-VIS-01、E2E-07 驗證 payload | ✅ |
| V 動態定位 | 本子功能不讀寫試算表；題目與子題標籤沿用 002 解析結果 | ✅（不適用） |
| VI 機密管理 | 不新增機密；測試使用固定假密碼 | ✅ |
| VII 測試先行 | 每個有 ID 的模組先寫測試並確認失敗；時間、排程一律 FakeClock／ManualScheduler；無 ID 的接線模組列為例外 | ⚠️ 有書面例外 |
| VIII 可測設計 | ranking、settlement、projections 為純函式；SessionService 經 Clock、Scheduler、IdGen、Broadcaster 注入；路由只做 zod 驗證與轉換 | ✅ |
| IX 子功能並行 | 獨立目錄 `specs/003-live-quiz/`；tasks 以 [BE]／[FE]／[QA] 分開；共用型別、事件、testid 不改 | ✅ |
| X 本機執行 | 無部署元件 | ✅ |
| XI PlantUML 設計優先 | 以三張 003 圖為藍圖；plan 與圖不一致處（D2、D3）已先改圖並重新產生 PNG；tasks 最後須有「程式碼與圖表一致性驗證」任務 | ✅ |
| 技術約束 | 不新增相依套件；沿用 TECH_SPEC §3 技術棧 | ✅ |

**Gate 結果**：通過；原則 VII 的例外記錄於 Complexity Tracking。Phase 1 設計後重新檢查：結果不變。

## 設計要點（以圖表為藍圖）

### 組件（`diagrams/003-component.puml`）

| 圖表組件 | 對應檔案 | 003 範圍 |
| --- | --- | --- |
| 控制列 ControlBar | `client/src/components/ControlBar.tsx`（新增） | 全部 |
| 即時狀態表 StatusGrid | `client/src/components/StatusGrid.tsx`（新增） | 全部（StatusCell 規則、視窗倒數） |
| 管理頁 TeacherDashboard | `client/src/pages/TeacherDashboard.tsx`（001） | READY／RUNNING／ENDED 顯示 ControlBar；RUNNING、ENDED 顯示 StatusGrid |
| useTeacher | `client/src/hooks/useTeacher.ts`（001） | 新增 start、end、reset |
| format.ts | `client/src/format.ts`（新增） | formatTime、formatClock、formatAnswers |
| useServerClock | `client/src/hooks/useServerClock.ts`（新增） | useServerClock、useTick |
| 作答頁 Play | `client/src/pages/Play.tsx`（001） | 搶答畫面：依題號列出 AnswerCard |
| 作答卡 AnswerCard | `client/src/components/AnswerCard.tsx`（新增） | rejected 以外的全部狀態 |
| usePlay | `client/src/hooks/usePlay.ts`（001） | 新增 setDraft（300 ms debounce、1 秒內保留本地）、submit、withdraw |
| HTTP 路由 | `server/src/http/teacherRoutes.ts`、`playRoutes.ts`（001） | 新增 6 個路由 |
| 搶答服務 SessionService | `server/src/services/sessionService.ts` | 新增 8 個方法；`loadAggregate` 補 drafts、submissions |
| 階段規則 phase | `server/src/domain/phase.ts`（001） | 沿用 `assertPhase`、`nextPhase` |
| 排名 ranking | `server/src/domain/ranking.ts`（新增） | §7.6 全部 |
| 結算 settlement | `server/src/domain/settlement.ts`（新增） | §7.7 全部 |
| 視圖投影 projections | `server/src/domain/projections.ts` | 補完 TeacherView、TeamView；新增 buildResults |
| 驗證 validation | `shared/src/validation.ts`（001） | 沿用 `validateAnswers` |
| 排程器、時鐘 | `server/src/ports/scheduler.ts`、`clock.ts`（001） | 沿用 |
| 啟動恢復 | `server/src/boot/recover.ts`（新增）、`server/src/app.ts` | `recoverOnBoot`；`app.ts` 設 `app.locals.service` 並匯出 `serviceOf(app)`，`index.ts` 於 listen 前呼叫（D3、TECH_SPEC §2） |
| Broadcaster、rooms | `server/src/realtime/*`（001） | 不修改；service 依 §9.3 傳入 scope |
| 資料存取 Repo | `server/src/db/repo.ts` | 新增 15 個方法（data-model §4） |

### 類別與方法（`diagrams/003-class.puml`）

| 方法 | 錯誤 | 推播 |
| --- | --- | --- |
| `start` | SESSION_NOT_FOUND、INVALID_PHASE、NO_QUESTIONS | 老師＋全部組 |
| `end` | SESSION_NOT_FOUND、INVALID_PHASE | 老師＋全部組（一次） |
| `reset` | SESSION_NOT_FOUND、INVALID_PHASE | 老師＋全部組 |
| `updateDraft` | UNAUTHORIZED、INVALID_PHASE、QUESTION_NOT_FOUND、INVALID_INPUT、ANSWER_TOO_LONG、ALREADY_SUBMITTED | 只有本組 |
| `submit` | UNAUTHORIZED、INVALID_PHASE、QUESTION_NOT_FOUND、INVALID_INPUT、ANSWER_REQUIRED、GROUP_INCOMPLETE、ANSWER_TOO_LONG、ALREADY_SUBMITTED | 老師＋全部組 |
| `withdraw` | UNAUTHORIZED、INVALID_PHASE、SUBMISSION_NOT_FOUND、INVALID_STATE、WITHDRAW_WINDOW_EXPIRED | 老師＋全部組 |
| `settleWindow` | —（冪等） | 有變化時：老師＋全部組 |
| `recover` | — | 有結算的活動：老師＋全部組 |

詳細規則見 [contracts/server-modules.md](./contracts/server-modules.md)。

### 互動順序（`diagrams/003-sequence.puml`）

三段流程：純速度送出與推播（UT-SVC-SUB-02、03、IT-RT-01、E2E-07）、公平模式視窗結算（UT-SVC-FAIR-02、E2E-11）、撤回後遞補與重送（UT-SVC-WD-01、05、E2E-09）。交易內只做資料變更；`scheduler.schedule／cancel` 與 `publish` 在 COMMIT 之後執行（research R-01；與圖中「單一同步交易」群組之後才呼叫 BC 的順序一致）。

## Project Structure

### Documentation (this feature)

```text
specs/003-live-quiz/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0（差異 D1–D3、R-01～R-14）
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── rest-api.md      # 6 個路由、Socket 推播範圍
│   ├── server-modules.md# ranking、settlement、projections、SessionService、recover、repo、seed
│   └── ui-testids.md    # format、hooks、ControlBar、StatusGrid、AnswerCard
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 產生
```

### Source Code (repository root)

```text
/
├─ server/
│   ├─ src/
│   │   ├─ domain/   ranking.ts  settlement.ts（新增）  projections.ts（修改）
│   │   ├─ db/       repo.ts（修改）
│   │   ├─ services/ sessionService.ts（修改）
│   │   ├─ boot/     recover.ts（新增）
│   │   ├─ http/     teacherRoutes.ts  playRoutes.ts（修改）
│   │   ├─ app.ts    # 修改：app.locals.service、匯出 serviceOf(app)
│   │   └─ index.ts  # 修改：listen 前呼叫 recoverOnBoot(serviceOf(app))
│   └─ test/
│       ├─ helpers/      seed.ts（新增）
│       ├─ domain/       ranking.test.ts  settlement.test.ts（新增）  projections.test.ts（修改：UT-PROJ-02～08）
│       ├─ db/           repo.test.ts（修改：UT-REPO-02～06）
│       ├─ services/     session.phase.test.ts  session.draft.test.ts  session.submit.test.ts
│       │                session.fair.test.ts  session.withdraw.test.ts  session.recover.test.ts（新增）
│       └─ integration/  startApp.ts（修改：選項）  flow.ts（新增：REST 流程 helper）
│                        live.it.test.ts（PHASE、VAL、VIS、SYNC、RT）  recon.it.test.ts（RECON）
│                        concurrency.it.test.ts  restart.it.test.ts  perf.it.test.ts（新增）
├─ client/
│   ├─ src/format.ts  src/hooks/useServerClock.ts（新增）
│   ├─ src/components/ ControlBar.tsx  StatusGrid.tsx  AnswerCard.tsx（新增）
│   ├─ src/api.ts  src/hooks/useTeacher.ts  src/hooks/usePlay.ts
│   │   src/pages/TeacherDashboard.tsx  src/pages/Play.tsx（修改）
│   └─ test/ format.test.ts  useServerClock.test.tsx
│            components/ ControlBar.test.tsx  StatusGrid.test.tsx  AnswerCard.test.tsx
└─ e2e/tests/ live-quiz.spec.ts      # E2E-04～11
```

**Structure Decision**：沿用 TECH_SPEC §2 的 npm workspaces 結構與 001／002 已建立的檔案。`ResultsTable`、`StudentResults`、`rejectWinner`、`buildCsvRows`、匯出相關屬 004，不預先建立。

## 前置依賴與對既有程式的影響

- **前端尚未建立**：001 的 [FE] Phase 3（T051 起 40 項）、[QA] Phase 4 與 002 的 [FE]（T027 起 15 項）都還沒完成，`client/`、`e2e/` 目前不存在。003 的 [BE] 任務可以立即開始；[FE] 任務與 E2E-04～11 必須等 001、002 的前端完成。
- `SessionService.loadAggregate` 原本對 drafts、submissions 回傳空陣列，改為讀資料庫；001／002 的測試不受影響（沒有送出）。
- `projectTeacherView` 的 `score`（原為 0）、`winnerTeamId`（原為 null）、`cells`（原為 []），以及 `projectTeamView` 的 drafts、mySubmissions、results 改為真實值；UT-PROJ-01、10 必須維持通過。
- `createApp` 只多設定 `app.locals.service`（簽名與回傳值不變），001 的 IT 不受影響。
- `index.ts` 在 `httpServer.listen` 前呼叫 `recoverOnBoot(serviceOf(app))`，並更新檔頭註解（TECH_SPEC §2：index.ts 負責 recover）。

## 驗證範圍與後續子功能

| 需求 | 003 的驗證方式 | 自動化驗證所在 |
| --- | --- | --- |
| FR-001～006、FR-005 同步 | UT-SVC-PHASE-01～05、UT-UI-CTRL-01、IT-SYNC-01、E2E-05 | — |
| FR-003 結果資料 | UT-PROJ-06、08（buildResults） | 004：IT-VIS-02、E2E-12 |
| FR-007～013 送出 | UT-SVC-SUB-01～10、IT-PHASE-01、IT-VAL-01、UT-UI-CARD-01、02、E2E-04、08 | — |
| FR-014～017 共編（含 FR-016a 整題覆蓋） | UT-SVC-DRAFT-01～06、UT-UI-CARD-03、E2E-06；FR-017（1 秒內保留本地）在 UT-UI-CARD-03 的 render 中斷言 | — |
| FR-018～026 判定 | UT-RANK、UT-SETTLE、UT-SVC-SUB-08、09、UT-SVC-FAIR-01～10、IT-CONC-01、E2E-11 | — |
| FR-027～032 撤回（含 FR-029 無條件進位） | UT-SVC-WD-01～06、UT-SVC-FAIR-10、UT-PROJ-07、UT-UI-CARD-04、05、E2E-09 | — |
| FR-033～037 老師狀態表（FR-037 分數只在 TeacherView 資料中，搶答中不顯示計分板） | UT-PROJ-02、03、UT-UI-GRID-01、02、IT-RT-01、E2E-07 | 004：分數畫面 `score-{teamIndex}`（UT-UI-RES、E2E-12） |
| FR-038～040 資訊隔離 | UT-PROJ-04～06、IT-VIS-01、E2E-07 | 004：IT-VIS-02 |
| FR-041～043 同步、重連、重啟 | IT-RECON-01、02、UT-SVC-RECOVER-01～03、IT-RESTART-01、E2E-10 | — |
| FR-044 效能 | IT-PERF-01 | — |
| 被判錯（rejected）的顯示 | StatusCell 依 status 顯示「✗ 判錯」（UT-UI-GRID-01 以假資料驗證）；rejected 的寫入屬 004 | 004：UT-SVC-REJ、E2E-13 |

## Complexity Tracking

| 例外 | 為何需要 | 為何不採用較簡單的做法 |
| --- | --- | --- |
| 原則 VII：`boot/recover.ts`、`app.ts` 的 `serviceOf`、`index.ts` 的接線、6 個路由、`api.ts` 新增函式、`useTeacher`／`usePlay` 的 REST 呼叫、TeacherDashboard／Play 的組裝，沒有專屬的 TEST_SPEC 案例 ID | §14.1 的 003 列沒有這些模組的 ID；原則 II 禁止自行新增 ID。改由既有 ID 覆蓋：路由由 IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-CONC-01、IT-RT-01 驗證；recover 接線由 IT-RESTART-01 驗證；hooks 與頁面由 UT-UI-CARD-03 與 E2E-04～11 驗證 | 寫無 ID 的測試違反原則 VII 的命名規則 |

## Analyze 修正紀錄（2026-11-24）

依 `/speckit-analyze` 報告修正，判斷順序：憲章 → PRD → TECH_SPEC → TEST_SPEC。

| ID | 問題 | 修正 |
| --- | --- | --- |
| C1 | `usePlay` 新增 `answersOf`，擴充了 TECH_SPEC §10.3 的介面（違反憲章 IX） | 移除；本地草稿合併進 `view.drafts`（research R-11）；改 T038、T044、T046、contracts/ui-testids.md |
| H1 | FR-037 要求搶答中顯示分數，但 PRD §3.2 把 E6 計分板列為範圍外 | spec FR-037 改為「TeacherView 提供分數與得主；畫面以 ★ 得主呈現，分數畫面屬 004」 |
| I1 | FR-039 要求學生端顯示「已撤回」，與 TECH_SPEC §10.4（撤回後恢復可編輯）不同 | spec FR-039 依 TECH_SPEC 修正 |
| I2 | `settleWindow(qid)` 一併結算其他題，偏離 TECH_SPEC 演算法 | 公開 `settleWindow` 完全照演算法；排程回呼 `onWindowDue` 依 `(windowEndsAt, 題號)` 逐題呼叫它（research R-04）；移除 Complexity Tracking 的例外；更新時序圖 |
| I3 | recover 由 `createApp` 呼叫，與 TECH_SPEC §2「index.ts 負責 recover」不符 | 改由 `index.ts` 以 `recoverOnBoot(serviceOf(app))` 呼叫（research R-08）；更新組件圖、類別圖 |
| I4 | T043 標 [P] 但與 T036 同檔 | 移除 [P] |
| I5 | 檔案樹與 tasks 不一致（recon.it.test.ts、flow.ts） | 更新檔案樹 |
| U1 | E2E 設定模式不明 | 依 TEST_SPEC E2E-11「設定維持公平模式 3 秒」：整個 E2E 用建立活動的預設值（公平、3 秒） |
| U2 | 「搶答中新成員加入」沒有斷言 | 在 IT-RECON-01（T050）加斷言 |
| U3 | FR-001 的 NO_QUESTIONS 實際碰不到 | spec 註明為防禦性檢查 |
| U4 | SC-007 未說明 debounce 中的輸入 | spec 註明只保證已同步的草稿 |