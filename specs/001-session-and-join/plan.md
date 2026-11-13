# Implementation Plan: 建立活動與加入（001-session-and-join）

**Branch**: `001-session-and-join` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-session-and-join/spec.md`

**藍圖（憲章原則 XI）**：[`diagrams/001-component.puml`](../../diagrams/001-component.puml)、[`diagrams/001-class.puml`](../../diagrams/001-class.puml)、[`diagrams/001-sequence.puml`](../../diagrams/001-sequence.puml)（2026-11-13 已依 TECH_SPEC v1.3 更新並重新產生 PNG）

**契約依據**：`docs/TECH_SPEC.md` v1.3、`docs/TEST_SPEC.md` v1.2、`docs/PRD.md` v1.1。本計畫所列型別、函式簽名、API 路徑、Socket 事件、錯誤碼、`data-testid` 皆照抄 TECH_SPEC，不得改名。

## Summary

建立整個專案的骨架與「老師登入 → 建立活動 → 調整設定 → 學生以房間碼加入 → 即時名單與上線狀態 → 自動重連 → 階段同步」的完整流程。範圍嚴格限定在 TECH_SPEC §14.1「001-session-and-join」一列：

- **shared/**：§3.3 常數、§4 全部型別、§11 錯誤碼／訊息／`AppError`、`validation.ts` 全部函式（含後續子功能會用到的 `validateAnswers`），一次做完整。
- **server/**：ports、`db`（§5 全部資料表、`openDb`、`withTransaction`）、repo（sessions、teams、members）、`domain/phase.ts`（§6 全部）、`domain/projections.ts`（只做 session／teams／members，其餘欄位回空值）、`AuthService`、`SessionService` 的 9 個方法、HTTP 路由與中介層、Socket 連線驗證與推播、`app.ts`／`index.ts`／`config.ts`、測試替身。
- **client/**：路由、`api.ts`、`socket.ts`、`storage.ts`、`messages.ts`、`useTeacher`／`usePlay` 的部分欄位、頁面 Home／TeacherLogin／Join／TeacherDashboard／Play（等待畫面）與 8 個元件。
- **e2e/**：`playwright.config.ts`（[QA]）、E2E-03、E2E-18。

技術方法：指令走 REST、狀態走 Socket（完整快照）；業務規則全部在 `services`／`domain`，以注入的 `Clock`／`IdGen`／`Scheduler` 取得時間與 ID；推播時由 `projectTeamView` 在伺服器端過濾，學生只收到本組資料。

## Technical Context

**Language/Version**: TypeScript 5.x（`strict: true`）；Node.js 22.13 以上（`node:sqlite` 免旗標）

**Primary Dependencies**:
- 後端：Express 4、Socket.IO 4、zod、Node 內建 `node:sqlite`（`DatabaseSync`）、`dotenv`（讀 `.env`，純 JS）
- 前端：React 18、Vite 5、React Router 6、socket.io-client
- 開發：tsx（server watch）、concurrently（`npm run dev` 同時啟動）、ESLint（typescript-eslint）
- 禁止：better-sqlite3 及任何含 `.node` 原生模組的套件（Windows 智慧型應用程式控制會封鎖）

**Storage**: SQLite（`node:sqlite`），檔案 `DB_PATH=./data/quiz.db`；測試用 `:memory:`。本子功能建立 §5 全部資料表，只讀寫 sessions、teams、members。成員上線狀態只存記憶體。

**Testing**: Vitest 2 + `@vitest/coverage-v8`（TEST_SPEC §2.3 門檻）、jsdom + @testing-library/react、supertest、socket.io-client、Playwright（`channel: 'msedge'`，不下載瀏覽器）

**Target Platform**: 本機 Windows 11 開發機；瀏覽器以 Edge／Chrome 為主；`localhost`

**Project Type**: Web application（npm workspaces：`shared`、`server`、`client`、`e2e`）

**Performance Goals**: 學生加入後老師畫面 1 秒內出現（SC-001）；狀態推播 1 秒內到所有分頁（SC-004）；10 組 × 4 人 = 40 分頁同時連線

**Constraints**: 本機執行、無外部部署（原則 X）；`SHEETS_MODE=fake` 預設，不需 Google 金鑰；機密只在 `.env`（原則 VI）；業務邏輯不得直接呼叫 `Date.now()`／`setTimeout`／`Math.random()`（原則 VIII）

**Scale/Scope**: 1 位老師、1 個活動、最多 20 組、每組人數不設上限；本子功能約 50 個 UT／IT／E2E 案例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查內容 | 結果 |
| --- | --- | --- |
| I 繁體中文優先 | 文件、UI、錯誤訊息為繁體中文（§11 `MESSAGES`）；識別字為英文；`phase.ts`、`projections.ts`、`sessionService` 的階段檢查、資訊過濾、上線計數加繁中註解 | ✅ |
| II 文件為準 | 範圍取自 §14.1；圖表與 TECH_SPEC 的 6 處差異（D1–D6）已列出並經使用者同意更新圖表；未修改契約 | ✅ |
| III 伺服器唯一真相 | 階段、房間碼、成員資料都由伺服器決定；客戶端以 `teacher:state`／`team:state` 快照取代本地狀態；本子功能沒有送出流程，但多步驟寫入（建立活動＋組、增減組）用 `withTransaction` | ✅ |
| IV 資訊隔離 | 學生只收 `projectTeamView(agg, teamId)`，推播到 `team:${teamId}`；`getPublicInfo` 只回人數不回暱稱；UT-PROJ-10、UT-BC-03 驗證 payload | ✅ |
| V 動態定位 | 本子功能不涉及試算表 | N/A |
| VI 機密管理 | `TEACHER_PASSWORD` 只在 `.env`；建立 `.env.example`（假值）、`.gitignore` 含 `.env`、`secrets/`、`data/`；E2E 密碼由啟動指令注入 | ✅ |
| VII 測試先行 | tasks 中每個模組先寫含 TEST_SPEC ID 的測試並確認失敗；使用 FakeClock、SeqIdGen、ManualScheduler，不依賴真實時間／亂數／網路 | ✅（於 tasks 落實） |
| VIII 可測設計 | `SessionService(deps)`、`AuthService(password, ids)` 注入依賴；`createApp(deps)` 可在測試中組裝；HTTP／Socket 層只做 zod 驗證與轉換 | ✅ |
| IX 子功能並行 | 獨立目錄 `specs/001-session-and-join/`；tasks 會以 [BE]／[FE]／[QA] 分開；不改 TECH_SPEC 共用契約 | ✅ |
| X 本機執行 | `npm run dev`／`npm start` 本機啟動；無容器、雲端或 CI 部署 | ✅ |
| XI PlantUML 設計優先 | 圖表已更新為與 TECH_SPEC v1.3 一致並重新產生 PNG；本 plan 以圖表為藍圖；tasks 最後須有「程式碼與圖表一致性驗證」任務 | ✅ |
| 技術約束 | 技術棧符合 §3；新增的執行期相依只有 `dotenv`（理由見 research.md R-02） | ✅ |

**Gate 結果**：通過，無需 Complexity Tracking。

## 設計要點（以圖表為藍圖）

### 組件（`diagrams/001-component.puml`）

| 圖表組件 | 對應檔案 | 001 範圍 |
| --- | --- | --- |
| 老師登入頁 TeacherLogin | `client/src/pages/TeacherLogin.tsx`、`components/LoginForm.tsx` | 全部 |
| 管理頁 TeacherDashboard | `client/src/pages/TeacherDashboard.tsx`、`components/RoomCode.tsx`、`SettingsForm.tsx`、`TeamList.tsx`、`PhaseBadge.tsx`、`ErrorBanner.tsx` | 建立活動（`btn-create-session` 只在 404 時顯示）、設定、名單、登出（`teacher-logout`） |
| 加入頁 Join | `client/src/pages/Join.tsx`、`components/JoinForm.tsx` | 全部，含有效身分時導向 `/play` |
| 作答頁 Play | `client/src/pages/Play.tsx`、`components/TeamHeader.tsx` | TeamHeader 與等待畫面 |
| 老師／學生儲存 | `client/src/storage.ts` | §10.2 全部 |
| HTTP 路由 | `server/src/http/teacherRoutes.ts`、`publicRoutes.ts`、`playRoutes.ts`、`auth.ts`、`errorHandler.ts` | 見 contracts/rest-api.md |
| 身分驗證 AuthService | `server/src/services/authService.ts` | §7.10 全部 |
| 活動服務 SessionService | `server/src/services/sessionService.ts` | 9 個方法 |
| 階段規則 | `server/src/domain/phase.ts` | §6 全部 |
| 視圖投影 | `server/src/domain/projections.ts` | 只做 session／teams／members |
| 即時推播 | `server/src/realtime/broadcaster.ts`、`socket.ts` | §7.11、§9 全部 |
| 資料存取 Repo | `server/src/db/schema.sql`、`db.ts`、`repo.ts` | 全部資料表；repo 只做 sessions／teams／members |
| 依賴介面 | `server/src/ports/clock.ts`、`scheduler.ts`、`ids.ts`、`sheetsGateway.ts` | §7.1 全部 |

### 類別與方法（`diagrams/001-class.puml`）

方法前置條件、效果與錯誤依 TECH_SPEC §7.9 表格；本子功能的補充決策見 [research.md](./research.md)。

| 方法 | 錯誤 | 推播（§9.3） |
| --- | --- | --- |
| `AuthService.login` | UNAUTHORIZED | — |
| `AuthService.verifyTeacher` | UNAUTHORIZED | — |
| `createSession` | INVALID_INPUT | teacher + 全部組 |
| `getCurrentSession` | —（無活動回 `null`，路由轉 404 SESSION_NOT_FOUND） | — |
| `getTeacherView` | SESSION_NOT_FOUND | — |
| `updateSettings` | INVALID_PHASE、INVALID_INPUT、TEAM_HAS_MEMBERS、SESSION_NOT_FOUND | teacher + 全部組 |
| `getPublicInfo` | SESSION_NOT_FOUND | — |
| `join` | SESSION_NOT_FOUND、TEAM_NOT_FOUND、INVALID_NICKNAME、NICKNAME_TAKEN | teacher + 該組 |
| `resolveMember` | UNAUTHORIZED | — |
| `getTeamView` | UNAUTHORIZED | — |
| `setOnline` | — | teacher + 該組 |

### 互動順序（`diagrams/001-sequence.puml`）

三段流程（老師登入並建立活動、學生加入、斷線重連）逐一對應到 quickstart.md 的驗證情境與 E2E-03、E2E-18、IT-ONLINE-01。

## Project Structure

### Documentation (this feature)

```text
specs/001-session-and-join/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── rest-api.md      # 001 範圍的 REST 端點
│   ├── socket-events.md # 連線驗證與事件
│   └── ui-testids.md    # 001 範圍的路由與 data-testid
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 產生
```

### Source Code (repository root)

```text
/
├─ package.json  tsconfig.base.json  eslint.config.js  vitest.workspace.ts
├─ .env.example  .gitignore  README.md
├─ shared/
│   ├─ package.json  tsconfig.json
│   ├─ src/  types.ts  errors.ts  constants.ts  validation.ts  index.ts
│   └─ test/ validation.test.ts  errors.test.ts
├─ server/
│   ├─ package.json  tsconfig.json  vitest.config.ts
│   ├─ src/
│   │   ├─ index.ts  app.ts  config.ts
│   │   ├─ ports/    clock.ts  scheduler.ts  ids.ts  sheetsGateway.ts
│   │   ├─ domain/   phase.ts  projections.ts
│   │   ├─ db/       schema.sql  db.ts  repo.ts
│   │   ├─ services/ sessionService.ts  authService.ts
│   │   ├─ http/     teacherRoutes.ts  publicRoutes.ts  playRoutes.ts  auth.ts  errorHandler.ts
│   │   └─ realtime/ socket.ts  broadcaster.ts
│   └─ test/
│       ├─ helpers/  fakeClock.ts  manualScheduler.ts  seqIdGen.ts  inMemorySheets.ts
│       │            recordingBroadcaster.ts  fakeIo.ts  makeTestService.ts
│       ├─ domain/   phase.test.ts  projections.test.ts
│       ├─ db/       repo.test.ts
│       ├─ services/ auth.test.ts  session.create.test.ts  session.join.test.ts
│       ├─ realtime/ broadcaster.test.ts
│       └─ integration/ auth.it.test.ts  online.it.test.ts
├─ client/
│   ├─ package.json  tsconfig.json  vite.config.ts  index.html
│   ├─ src/
│   │   ├─ main.tsx  App.tsx  api.ts  socket.ts  storage.ts  messages.ts
│   │   ├─ hooks/      useTeacher.ts  usePlay.ts
│   │   ├─ pages/      Home.tsx  TeacherLogin.tsx  TeacherDashboard.tsx  Join.tsx  Play.tsx
│   │   └─ components/ LoginForm.tsx  SettingsForm.tsx  RoomCode.tsx  TeamList.tsx
│   │                  PhaseBadge.tsx  ErrorBanner.tsx  JoinForm.tsx  TeamHeader.tsx
│   └─ test/  storage.test.ts  messages.test.ts  components/*.test.tsx  pages/*.test.tsx
└─ e2e/
    ├─ package.json  playwright.config.ts
    └─ tests/ identity.spec.ts   # E2E-03、E2E-18
```

**Structure Decision**: 採 TECH_SPEC §2 的 npm workspaces 結構。本子功能只建立上列檔案；§2 中其他檔案（`sheets/`、`export/`、`domain/ranking.ts`、`settlement.ts`、`boot/recover.ts`、`devRoutes.ts`、`format.ts`、`useServerClock.ts`、`seed.ts`、`fixtures.ts`）留給 002–004，不預先建立空殼。

## 不在本計畫範圍（留給後續子功能）

- 匯入（`importSheet`、`sheets/*`、`devRoutes`）→ 002
- start／end／reset、草稿、送出、撤回、視窗結算、`recover` → 003
- 判錯、寫回、CSV、結果畫面 → 004
- `index.ts` 不呼叫 `recover()`（003 才加入）；啟動時只把所有成員視為離線（online 狀態本來就只在記憶體）

## Complexity Tracking

無憲章違反，不需填寫。
