---
description: "Task list for 001-session-and-join（依層次分 Phase：Setup → 後端 → 前端 → 整合）"
---

# Tasks: 建立活動與加入（001-session-and-join）

**Input**：`specs/001-session-and-join/`（plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md）

**契約依據**：`docs/TECH_SPEC.md` v1.3（型別、簽名、API 路徑、Socket 事件、錯誤碼、`data-testid` 逐字照抄，不得改名）、`docs/TEST_SPEC.md` v1.2、藍圖 `diagrams/001-*.puml`

**範圍**：只做 TECH_SPEC §14.1「001-session-and-join」一列。不建立 002–004 的檔案或空殼（`sheets/`、`export/`、`ranking.ts`、`settlement.ts`、`boot/recover.ts`、`devRoutes.ts`、`format.ts`、`useServerClock.ts`、`seed.ts`、`fixtures.ts`）。

## 規則

1. **測試先行（憲章 VII）**：每個實作任務之前都有測試任務；測試名稱必須含 TEST_SPEC 案例 ID（例如 `it('UT-VAL-12 拒絕含空白、標點、emoji 的暱稱', …)`），先執行確認失敗（Red）再實作（Green）。測試不得依賴真實時間、亂數或網路。
2. **沒有 TEST_SPEC ID 的模組**（`config.ts`、`app.ts`、`index.ts`、`errorHandler.ts`、client `api.ts`、`socket.ts`、`useTeacher`、`usePlay`、部分元件與頁面）：任務中以「覆蓋測試：<ID>」註明由哪個已存在的測試驗證，不另外新增無 ID 的測試。
3. **檔案歸屬（憲章 IX）**：[BE] 只改根目錄設定檔、`shared/`、`server/`（不含 `server/test/integration/`）；[FE] 只改 `client/`；[QA] 只改 `server/test/integration/`、`e2e/`、`README.md`。[BE] 與 [FE] 不修改同一個檔案。前端需要的型別、錯誤碼、常數一律從 `@quiz/shared` 匯入，**禁止**匯入 `server/` 任何檔案。
4. **Phase 1 先單獨合併到 main**，前端（Phase 3）才能開始；Phase 2 與 Phase 3 可由不同成員並行。
5. 每個 Phase 最後一個任務：`npm test` 與 `npm run lint` 全部通過，並依憲章原則 XI 比對程式碼與 `diagrams/001-*.puml`。

## Format: `- [ ] T### [P?] [BE|FE|QA] 描述（檔案路徑）`

- **[P]**：可平行（不同檔案、不依賴同 Phase 內未完成的任務）
- **[BE]／[FE]／[QA]**：後端／前端／整合與驗證
- 本檔依層次分 Phase（使用者指定），user story 對應見文末「追溯表」

---

## Phase 1: Setup [BE] — 專案骨架與 shared/

**Purpose**：workspaces、TypeScript、ESLint、Vitest 與覆蓋率設定、`.env.example`、npm scripts，以及 `shared/` 全部（後續子功能共用）。**本 Phase 只放骨架與 shared/，完成後單獨合併到 main。**

- [ ] T001 [BE] 建立根目錄 `package.json`：`"private": true`、`"type": "module"`、`"workspaces": ["shared","server","client","e2e"]`（此時 server／client／e2e 目錄尚未存在，`npm install` 必須仍能成功，於 T014 驗證）、`"engines": { "node": ">=22.13" }`；scripts（TECH_SPEC §3.2）：`dev` = `concurrently -n server,client "npm run dev -w server" "npm run dev -w client"`、`build` = `npm run build --workspaces --if-present`、`start` = `npm run start -w server`、`test` = `vitest run`、`test:coverage` = `vitest run --coverage`、`test:e2e` = `npm run test -w e2e`、`lint` = `eslint . && npm run typecheck --workspaces --if-present`；devDependencies：typescript@5、vitest@2、@vitest/coverage-v8@2、concurrently、eslint、typescript-eslint、@types/node。**禁止**加入 better-sqlite3 或任何含 `.node` 原生模組的套件（`package.json`）
- [ ] T002 [P] [BE] 建立 `tsconfig.base.json`：`strict: true`、`target: "ES2022"`、`module: "NodeNext"`、`moduleResolution: "NodeNext"`、`resolveJsonModule: true`、`skipLibCheck: true`、`isolatedModules: true`；相對 import 一律寫 `.js` 副檔名（NodeNext 規則）（`tsconfig.base.json`）
- [ ] T003 [P] [BE] 建立 `eslint.config.js`（flat config、`typescript-eslint` recommended，套用 `**/*.{ts,tsx}`；忽略 `**/dist/**`、`coverage/**`、`e2e/artifacts/**`、`test-results/**`、`node_modules/**`）（`eslint.config.js`）
- [ ] T004 [P] [BE] 建立 `vitest.workspace.ts`（`export default ['{shared,server,client}/vitest.config.ts']`，以 glob 讓尚未建立的 workspace 不報錯）與根目錄 `vitest.config.ts` 的 `test.coverage`：provider `'v8'`、include `['shared/src/**','server/src/**','client/src/**']`、exclude `['server/src/index.ts','**/*.d.ts']`；`thresholds` 依 TEST_SPEC §2.3：`lines: 80, branches: 75`（全專案）、`'server/src/domain/**': { lines: 95, branches: 90 }`、`'server/src/services/**': { lines: 90, branches: 85 }`、`'shared/src/**': { lines: 90, branches: 85 }`（`vitest.workspace.ts`、`vitest.config.ts`）
- [ ] T005 [P] [BE] 建立 `.env.example`（逐字照 TECH_SPEC §3.4；`TEACHER_PASSWORD=change-me` 為假值）與 `.gitignore`（`.env`、`secrets/`、`data/`、`node_modules/`、`dist/`、`coverage/`、`e2e/artifacts/`、`test-results/`、`playwright-report/`）（`.env.example`、`.gitignore`）
- [ ] T006 [BE] 建立 `shared/package.json`（`"name": "@quiz/shared"`、`"type": "module"`、`"main": "src/index.ts"`、`"types": "src/index.ts"`、scripts `typecheck` = `tsc --noEmit -p .`）、`shared/tsconfig.json`（extends `../tsconfig.base.json`，include `src`、`test`）、`shared/vitest.config.ts`（`test.environment: 'node'`、`test.include: ['test/**/*.test.ts']`）（`shared/package.json`、`shared/tsconfig.json`、`shared/vitest.config.ts`）
- [ ] T007 [P] [BE] 依 TECH_SPEC §3.3 建立常數，逐字照抄：`DEFAULT_TEAM_COUNT = 6`、`MIN_TEAM_COUNT = 2`、`MAX_TEAM_COUNT = 20`、`DEFAULT_FAIRNESS_MODE = 'fair'`、`DEFAULT_WINDOW_SEC = 3`、`MIN_WINDOW_SEC = 1`、`MAX_WINDOW_SEC = 10`、`WITHDRAW_LIMIT_MS = 10_000`、`MAX_ANSWER_LENGTH = 200`、`MAX_NICKNAME_LENGTH = 20`、`NICKNAME_PATTERN = /^[㐀-䶿一-鿿A-Za-z0-9]+$/`、`ROOM_CODE_LENGTH = 6`、`ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`、`DRAFT_DEBOUNCE_MS = 300`（`shared/src/constants.ts`）
- [ ] T008 [P] [BE] 依 TECH_SPEC §4 建立**全部**型別（Phase、FairnessMode、SubmissionStatus、QuestionState、GridRange、SheetData、SheetSnapshot、ParsedSlot、ParsedQuestion、ParseWarningCode、ParseWarning、ParseResult、CellWrite、Session、Question、AnswerSlot、Team、Member、Draft、Submission、RankedSubmission、QuestionInfo、TeacherCell、TeacherView、ImportSummary、TeamView、Results、PublicSessionInfo），欄位名稱與型別逐字照抄；`ErrorCode` 由 errors.ts 定義後在此 re-export 或互相引用（`shared/src/types.ts`）
- [ ] T009 [BE] 撰寫 UT-ERR-01（列舉所有 ErrorCode：每個都有 `HTTP_STATUS` 與非空 `MESSAGES`，且狀態碼與 TECH_SPEC §11 表一致，24 個碼逐一列出期望值）、UT-ERR-02（`new AppError('NO_WINNER')`：`instanceof Error`、`code === 'NO_WINNER'`、`message === MESSAGES.NO_WINNER`），執行並確認失敗（`shared/test/errors.test.ts`）
- [ ] T010 [BE] 依 TECH_SPEC §11 實作 `ErrorCode`（24 個）、`AppError`、`HTTP_STATUS`、`MESSAGES`（訊息逐字照抄；INVALID_NICKNAME＝「暱稱需為 1–20 個中文字、英文字母或數字」），讓 T009 通過（`shared/src/errors.ts`）
- [ ] T011 [BE] 撰寫 UT-VAL-01～13，執行並確認失敗：01 `normalizeNickname(' 小明 ')`→`'小明'`；02 `''`、`'   '`→INVALID_NICKNAME；03 20 字通過、21 字 INVALID_NICKNAME；04 `nicknameKey('Amy') === nicknameKey(' amy ')`；05 `normalizeRoomCode(' k7q2mx ')`→`'K7Q2MX'`；06 `'K7Q2M'`、`'K7Q2M0'`→SESSION_NOT_FOUND；07 `validateAnswers([' CPU '],1,false)`→`['CPU']`；08 長度≠subCount→INVALID_INPUT；09 `['  ']`→ANSWER_REQUIRED；10 `['CPU','']`（題組）→GROUP_INCOMPLETE；11 200 字通過、201 字 ANSWER_TOO_LONG；12 `'小 明'`、`'Amy_01'`、`'小明😀'`、`'ＡＢ'`、`'𠀀'`→INVALID_NICKNAME；13 `'Amy01'`、`'小明2'`、`'㐀'` 通過（`shared/test/validation.test.ts`）
- [ ] T012 [BE] 實作 `normalizeNickname`（trim；長度 1–`MAX_NICKNAME_LENGTH` 且符合 `NICKNAME_PATTERN`，否則 `AppError('INVALID_NICKNAME')`）、`nicknameKey`（`normalizeNickname(s).toLowerCase()`）、`normalizeRoomCode`（trim + toUpperCase；長度須為 `ROOM_CODE_LENGTH` 且每字元在 `ROOM_CODE_ALPHABET`，否則 SESSION_NOT_FOUND）、`validateAnswers(answers, subCount, isGroup)`（長度≠subCount → INVALID_INPUT；trim 後任一空白 → isGroup ? GROUP_INCOMPLETE : ANSWER_REQUIRED；任一長度 > `MAX_ANSWER_LENGTH` → ANSWER_TOO_LONG；回傳 trim 後陣列），加繁中註解，讓 T011 通過（`shared/src/validation.ts`）
- [ ] T013 [BE] 建立 `shared/src/index.ts`，匯出 types、errors、constants、validation 全部（`shared/src/index.ts`）
- [ ] T014 [BE] 執行 `npm install`（成功且無 workspace 錯誤），確認無原生模組：PowerShell `Get-ChildItem -Recurse -Filter *.node node_modules` 結果為空（`package-lock.json`）
- [ ] T015 [BE] **Phase 1 驗收**：執行 `npm test`（UT-ERR-01～02、UT-VAL-01～13 全部通過）與 `npm run lint` 全部通過；依憲章原則 XI 比對 `diagrams/001-class.puml` 的 `Session`、`Team`、`Member`、`Phase`、`FairnessMode`、`AppError` 與 `shared/src/types.ts`、`errors.ts` 的欄位與值完全一致，不一致先修正（程式或圖表；改圖後重新執行 `java -jar plantuml.jar "./diagrams/*.puml"`），於本任務記錄比對結果（`shared/`、`diagrams/001-class.puml`）

**Checkpoint**：合併到 main；Phase 2（後端）與 Phase 3（前端）可開始並行

---

## Phase 2: 後端 [BE]（含後端整合測試 [QA]）

**Purpose**：依序完成 ports 與測試替身 → db 與 repo → domain/phase → projections → services → HTTP 路由 → Socket 與 broadcaster。整合測試 IT-AUTH-01～03、IT-ONLINE-01 依使用者決定放在對應實作之前（[QA]，檔案在 `server/test/integration/`）。

### 2.1 server 骨架、ports 與測試替身

- [ ] T016 [BE] 建立 `server/package.json`（dependencies：express@4、socket.io@4、zod、dotenv、tsx、`@quiz/shared`（`"*"`）；devDependencies：supertest、socket.io-client、@types/express、@types/supertest；scripts：`dev` = `tsx watch src/index.ts`、`start` = `tsx src/index.ts`（shared 以 TS 原始碼提供，正式啟動同樣用 tsx）、`build` = `tsc --noEmit -p .`、`typecheck` = `tsc --noEmit -p .`）、`server/tsconfig.json`（extends base，include `src`、`test`）、`server/vitest.config.ts`（environment `node`，include `test/**/*.test.ts`）；執行 `npm install`（`server/package.json`、`server/tsconfig.json`、`server/vitest.config.ts`）
- [ ] T017 [BE] 依 TECH_SPEC §7.1 建立 ports，簽名逐字照抄：`Clock`／`systemClock`；`Scheduler`（`schedule`／`cancel`／`cancelAll`）／`timerScheduler(clock)`（`setTimeout(max(0, at - clock.now()))`，同 key 取代）；`IdGen`（`id(prefix: 'ses'|'q'|'slot'|'team'|'mem'|'sub')`、`token()`、`roomCode()`）／`cryptoIdGen`（`crypto.randomUUID`、`randomBytes(32).toString('hex')`、`crypto.randomInt(0, 32)` 自 `ROOM_CODE_ALPHABET` 取 6 字）；`SheetsGateway`（`fetchSnapshot`、`writeCells`）。覆蓋測試：UT-SVC-CREATE-01（經 SeqIdGen）、IT-AUTH-01（經 createApp）（`server/src/ports/clock.ts`、`scheduler.ts`、`ids.ts`、`sheetsGateway.ts`）
- [ ] T018 [BE] 建立 `PublishScope`（`{ teacher?: boolean; teamIds?: string[] | 'all' }`，預設 `{ teacher: true, teamIds: 'all' }`）、`Broadcaster`（`publish(sessionId, scope?)`）介面與 `nullBroadcaster`；`createSocketBroadcaster` 留到 T046（`server/src/realtime/broadcaster.ts`）
- [ ] T019 [P] [BE] 依 TEST_SPEC §3 建立 `FakeClock`（預設 start `1_700_000_000_000`；`now`／`set`／`advance`）、`ManualScheduler`（依 (at 升冪, 排程先後) 觸發；`pending`／`advanceTo`／`advance`）、`SeqIdGen`（`id(prefix)` → `${prefix}_${n}`；`token()` → `tok_${n}`；`roomCode()` 依建構子陣列，預設 `'AAAAA2','AAAAA3',…`）（`server/test/helpers/fakeClock.ts`、`manualScheduler.ts`、`seqIdGen.ts`）
- [ ] T020 [P] [BE] 依 TEST_SPEC §3 建立 `InMemorySheetsGateway`（`writes`、`failNext(code)`、`current(id)`）、`RecordingBroadcaster`（`calls: {sessionId, scope?}[]`）、`fakeIo`（模擬 `io.to(room).emit(event, payload)`，記錄 `{room, event, payload}[]`）（`server/test/helpers/inMemorySheets.ts`、`recordingBroadcaster.ts`、`fakeIo.ts`）

### 2.2 db 與 repo

- [ ] T021 [P] [BE] 依 TECH_SPEC §5 建立 `schema.sql`，**全部**資料表與索引逐字照抄（PRAGMA、sessions、questions、answer_slots、teams、members（`UNIQUE(team_id, nickname_key)`）、drafts、submissions、`idx_sub_q`、`uq_sub_team_q_live`）（`server/src/db/schema.sql`）
- [ ] T022 [BE] 撰寫 UT-REPO-01（建立並讀回 session，欄位值以 `toEqual` 比對；node:sqlite 回傳 null-prototype 物件）、UT-REPO-07（`withTransaction` 中途丟出例外 → 交易內所有寫入回復、例外原樣丟出），執行並確認失敗（`server/test/db/repo.test.ts`）
- [ ] T023 [BE] 實作 `openDb(path)`（`new DatabaseSync(path)`；執行 schema.sql；`path` 非 `':memory:'` 時先建立父目錄）與 `withTransaction(db, fn)`（`BEGIN IMMEDIATE`／`COMMIT`，例外時 `ROLLBACK` 後重新丟出）；`export type Db = DatabaseSync`（`server/src/db/db.ts`）
- [ ] T024 [BE] 實作 `Repo`（只做 sessions、teams、members）：`insertSession`、`getSession`、`getSessionByRoomCode`、`roomCodeExists`、`getLatestSession`（`ORDER BY created_at DESC, rowid DESC LIMIT 1`）、`updateSession`、`insertTeam`、`listTeams`（依 idx）、`getTeam`、`deleteTeamsAbove(sessionId, idx)`、`countMembersInTeamsAbove(sessionId, idx)`、`insertMember`（UNIQUE(team_id, nickname_key) 衝突轉 `AppError('NICKNAME_TAKEN')`）、`getMemberByToken`、`getMember`、`listMembersBySession`、`countMembersByTeam`、`touchMember(memberId, lastSeenAt)`；資料列轉成 §4 實體（`idx` → `index`、snake_case → camelCase），具名參數用 `$name`；不實作 questions／drafts／submissions，讓 T022 通過（`server/src/db/repo.ts`）

### 2.3 domain/phase

- [ ] T025 [BE] 撰寫 UT-PHASE-01（TECH_SPEC §6 表 13 個動作 × 4 個階段，`it.each` 共 52 個斷言：允許者不丟例外，其餘 INVALID_PHASE）、UT-PHASE-02（SETUP+import→READY、READY+import→READY、READY+start→RUNNING、RUNNING+end→ENDED、ENDED+reset→READY）、UT-PHASE-03（`nextPhase('SETUP','start')` 等非法組合 → INVALID_PHASE），執行並確認失敗（`server/test/domain/phase.test.ts`）
- [ ] T026 [BE] 依 TECH_SPEC §6 實作 `Action`、`assertPhase(phase, action)`、`nextPhase(phase, action)`（全部 13 個動作，含 001 用不到的），以表格常數表達允許階段並加繁中註解，讓 T025 通過（`server/src/domain/phase.ts`）

### 2.4 projections

- [ ] T027 [BE] 撰寫 UT-PROJ-10（`onlineMemberIds` 只有 A1 → `projectTeacherView` 中 A1 `online=true`，其他成員 false），執行並確認失敗（`server/test/domain/projections.test.ts`）
- [ ] T028 [BE] 依 TECH_SPEC §7.8 建立 `SessionAggregate` 與函式簽名；只實作 `projectTeacherView(agg, now)`（`session`；`teams` 依 index 排序，各含 `score: 0`、`members: {id, nickname, online}[]`；`serverNow: now`；`questions: []`、`cells: []`、`importSummary: null`）與 `projectTeamView(agg, teamId, now)`（`session: {roomCode, phase, round}`；`team: {id, name, members}` **只取 teamId 相同的成員**；`questions: []`、`drafts: {}`、`mySubmissions: {}`、`results: null`；`serverNow: now`）；`questionInfo`、`buildResults`、`buildCsvRows` 不實作（003／004）；加繁中註解說明伺服器端資訊隔離（憲章 IV），讓 T027 通過（`server/src/domain/projections.ts`）

### 2.5 services

- [ ] T029 [BE] 撰寫 UT-AUTH-01（正確密碼回 token，`verifyTeacher(token)` 通過）、UT-AUTH-02（錯誤密碼、長度不同的密碼 → UNAUTHORIZED）、UT-AUTH-03（`verifyTeacher(undefined)`、未知 token → UNAUTHORIZED）、UT-AUTH-04（登入兩次，兩個不同 token 皆有效），執行並確認失敗（`server/test/services/auth.test.ts`）
- [ ] T030 [BE] 依 TECH_SPEC §7.10 實作 `AuthService(password, ids)`：`login` 先比長度，長度相同再用 `crypto.timingSafeEqual`；成功 → `ids.token()` 存入記憶體 `Set` 並回傳；`verifyTeacher(token)` 不在 Set → UNAUTHORIZED，讓 T029 通過（`server/src/services/authService.ts`）
- [ ] T031 [BE] 建立 `SessionService` 骨架：`ServiceDeps`（欄位照 §7.9：`repo`、`clock`、`scheduler`、`ids`、`sheets`、`broadcaster`）、`constructor(deps)`、記憶體 `onlineMemberIds: Set<string>`、`loadAggregate(sessionId): SessionAggregate`（questions、slots、drafts、submissions 為空陣列；供 broadcaster 使用）。覆蓋測試：UT-SVC-CREATE-01（`server/src/services/sessionService.ts`）
- [ ] T032 [BE] 實作 `makeTestService(opts?)`：DB `':memory:'`、`FakeClock`、`ManualScheduler`、`SeqIdGen(opts?.roomCodes)`、`InMemorySheetsGateway(opts?.snapshots ?? {})`（001 預設空物件，research R-04）、`RecordingBroadcaster`；回傳 `{ service, repo, clock, scheduler, ids, gateway, broadcaster }`（`server/test/helpers/makeTestService.ts`）
- [ ] T033 [BE] 撰寫 UT-SVC-CREATE-01～07，執行並確認失敗：01 `createSession({})` → phase SETUP、round 1、6 組「第 1 組」…「第 6 組」、fairnessMode `'fair'`、windowSec 3；02 roomCodes `AAAAA2`、`AAAAA2`、`AAAAA3` 建兩個活動 → 第二個為 `AAAAA3`；03 teamCount 1、21、windowSec 0、11（createSession 與 updateSettings 都測）→ INVALID_INPUT；04 6→8 組新增第 7、8 組；05 6→4 組且第 5 組有成員 → TEAM_HAS_MEMBERS，無成員時成功；06 以 repo 把 phase 設為 RUNNING 後 updateSettings → INVALID_PHASE（不實作 start）；07 成功操作後 broadcaster 記錄一次 publish（預設 scope）（`server/test/services/session.create.test.ts`）
- [ ] T034 [BE] 實作 `createSession(input)`（zod：`teamCount` ∈ [2,20]、`windowSec` ∈ [1,10]、`fairnessMode` ∈ {'speed','fair'}，未提供時 6／'fair'／3；`withTransaction` 內建立 session（phase `'SETUP'`、round 1、createdAt=`clock.now()`、其餘 null）與 N 組 `第 ${i} 組`；`ids.roomCode()` 與既有活動重複就重抽，最多 10 次，仍重複丟 INVALID_INPUT（research R-05）；成功後 `broadcaster.publish(sessionId)`）、`getCurrentSession()`（最新活動的 TeacherView 或 `null`，research R-06）、`getTeacherView(sessionId)`（不存在 → SESSION_NOT_FOUND）、`updateSettings(sessionId, input)`（research R-07：交易內 `assertPhase(phase,'updateSettings')` → zod 範圍（INVALID_INPUT）→ 減少組數時 `countMembersInTeamsAbove > 0` → TEAM_HAS_MEMBERS 且不做任何變更，否則 `deleteTeamsAbove` → 增加組數時新增 `第 ${idx} 組` → 更新 session，切到 speed 時保留 windowSec → `publish(sessionId)`），加繁中註解，讓 T033 通過（`server/src/services/sessionService.ts`）
- [ ] T035 [BE] 撰寫 UT-SVC-JOIN-01～10，執行並確認失敗：01 正常加入回傳 token，`getPublicInfo` 該組 memberCount 1；02 roomCode 小寫可加入；03 不存在的房間碼 SESSION_NOT_FOUND；04 teamId 屬於別的活動 TEAM_NOT_FOUND；05 同組 `Amy` 後 `amy` → NICKNAME_TAKEN，其他組可用 `amy`；06 `resolveMember('bad')` UNAUTHORIZED；07 以 repo 設 phase 為 RUNNING、ENDED 後加入皆成功；08 用原 token 再次 `getTeamView` 回到同一組、資料一致；09 暱稱 `'小明😀'` → INVALID_NICKNAME 且該組 memberCount 不變；10 同一組連續加入 25 位不同暱稱 → 全部成功，memberCount 25（`server/test/services/session.join.test.ts`）
- [ ] T036 [BE] 實作 `getPublicInfo(roomCode)`（`normalizeRoomCode` → 查活動（SESSION_NOT_FOUND）→ `{ roomCode, phase, teams: {id, name, memberCount}[] }`，**不含暱稱**）、`join(roomCode, {teamId, nickname})`（檢查順序：normalizeRoomCode → 活動存在（SESSION_NOT_FOUND）→ teamId 屬於該活動（TEAM_NOT_FOUND）→ `normalizeNickname`（INVALID_NICKNAME）→ 組內 `nicknameKey` 不重複（NICKNAME_TAKEN）；不檢查階段、不設人數上限；建立 member（`ids.id('mem')`、`ids.token()`、joinedAt＝lastSeenAt＝`clock.now()`）；`publish(sessionId, { teacher: true, teamIds: [teamId] })`；回傳 `{ token, memberId, teamId, sessionId }`）、`resolveMember(token)`（查無 → UNAUTHORIZED；回傳 `Member & { sessionId }`）、`getTeamView(memberToken)`（`projectTeamView(loadAggregate, teamId, clock.now())`），讓 T035 通過（`server/src/services/sessionService.ts`）

### 2.6 HTTP 路由

- [ ] T037 [QA] 撰寫 IT-AUTH-01（以 `createApp` 啟動真實 HTTP（隨機 port、DB `:memory:`、FakeClock、ManualScheduler、InMemorySheetsGateway），不帶 token 呼叫 `/api/teacher/sessions` → 401，本文 `{ error: { code: 'UNAUTHORIZED', message } }`）與 IT-AUTH-02（以 member token 呼叫老師 API → 401；以 teacher token 呼叫 `GET /api/play/state` → 401），執行並確認失敗（`server/test/integration/auth.it.test.ts`）
- [ ] T038 [BE] 實作 `errorHandler`：`AppError` → `HTTP_STATUS[code]` 與 `{ error: { code, message } }`；`ZodError` → 422 INVALID_INPUT；其他 → 500 `{ error: { code: 'INTERNAL', message } }` 並 `console.error`。覆蓋測試：IT-AUTH-01（`server/src/http/errorHandler.ts`）
- [ ] T039 [BE] 實作 `requireTeacher(auth)`（`Authorization: Bearer <token>` → `auth.verifyTeacher`）、`requireMember(service)`（Bearer → `service.resolveMember`，存入 `res.locals.member`）、`wrap(fn)`（把同步／非同步例外交給 `next`）。覆蓋測試：IT-AUTH-01～02（`server/src/http/auth.ts`）
- [ ] T040 [BE] 實作老師路由（contracts/rest-api.md）：`POST /login`（zod `{ password: string }` → 200 `{ token }`）、`POST /sessions`（zod `{ teamCount?, fairnessMode?, windowSec? }` → 201 TeacherView）、`GET /sessions/current`（`null` → 404 SESSION_NOT_FOUND）、`GET /sessions/:id`、`PATCH /sessions/:id/settings`（→ 200 TeacherView）；`/login` 以外全部套 `requireTeacher`。覆蓋測試：IT-AUTH-01～02（`server/src/http/teacherRoutes.ts`）
- [ ] T041 [BE] 實作公開路由 `GET /sessions/:roomCode`（→ 200 PublicSessionInfo）、`POST /sessions/:roomCode/join`（zod `{ teamId: string, nickname: string }` → 201）與學生路由 `GET /state`（`requireMember` → 200 `TeamView & { me: { id, nickname } }`）。覆蓋測試：IT-AUTH-02（`server/src/http/publicRoutes.ts`、`server/src/http/playRoutes.ts`）
- [ ] T042 [BE] 實作 `createApp(deps)` → `{ app, httpServer, io }`：deps＝`{ repo, clock, scheduler, ids, sheets, auth: AuthService }`；內部建立 `httpServer`、`io`（Socket.IO Server）、`SessionService`（broadcaster 暫用 `nullBroadcaster`，T049 改為 socket broadcaster）；`express.json()`；掛載 `/api/teacher`、`/api/public`、`/api/play`；最後掛 `errorHandler`；若 `client/dist` 存在則提供靜態檔與 SPA fallback（非 `/api`、`/socket.io` 的 GET 回 `index.html`），讓 T037 通過（`server/src/app.ts`）
- [ ] T043 [BE] 實作 `loadConfig()`（research R-02）：`dotenv` 載入 `.env`，zod 驗證 `PORT`（預設 3000）、`TEACHER_PASSWORD`（非空）、`DB_PATH`（預設 `./data/quiz.db`）、`SHEETS_MODE`（`'fake' | 'google'`，預設 fake）、`GOOGLE_APPLICATION_CREDENTIALS`（google 時檔案必須存在）、`FAKE_SHEETS_DIR`；失敗時印繁中訊息並 `process.exit(1)`。覆蓋測試：E2E-03（webServer 以此設定啟動）（`server/src/config.ts`）
- [ ] T044 [BE] 實作 `index.ts`：`loadConfig()` → `openDb(DB_PATH)` → `new AuthService(TEACHER_PASSWORD, cryptoIdGen)` → `createApp({ …, sheets })`，`sheets` 為本檔內部、不匯出的 gateway，兩個方法都 reject `new AppError('SHEETS_ERROR')`（research R-03；002 會替換）→ `httpServer.listen(PORT)`；不呼叫 `recover()`（003）。覆蓋測試：E2E-03（已列入 coverage exclude）（`server/src/index.ts`）

### 2.7 Socket 與 broadcaster

- [ ] T045 [BE] 撰寫 UT-BC-01（`publish(s)`，3 組 → `teacher:<s>` 收到 1 次 `teacher:state`；每個 `team:<id>` 各 1 次 `team:state`）、UT-BC-02（`publish(s, { teacher: false, teamIds: [A] })` → 只有 `team:A` 收到）、UT-BC-03（送到 `team:A` 的 payload 深度等於 `projectTeamView(agg, A)` 且不含 `cells`），以 `fakeIo` 驗證，執行並確認失敗（`server/test/realtime/broadcaster.test.ts`）
- [ ] T046 [BE] 實作 `createSocketBroadcaster(io, load, clock)`：publish 時呼叫一次 `load(sessionId)`；`scope.teacher !== false` → 對 `teacher:${sessionId}` emit `teacher:state`（`projectTeacherView`）；`teamIds`（`'all'` 為全部組）逐一對 `team:${teamId}` emit `team:state`（payload 一律經 `projectTeamView`，禁止送 TeacherView），讓 T045 通過（`server/src/realtime/broadcaster.ts`）
- [ ] T047 [QA] 撰寫 IT-AUTH-03（Socket 以錯誤 token 連線 → `connect_error.message === 'UNAUTHORIZED'`）與 IT-ONLINE-01（老師登入建立活動並以 `{ token, sessionId }` 連線；同一成員開 2 個 socket，關 1 個 → 老師收到的 `teacher:state` 中該成員仍 `online: true`；兩個都關 → `online: false`），執行並確認失敗（`server/test/integration/auth.it.test.ts`、`server/test/integration/online.it.test.ts`）
- [ ] T048 [BE] 實作 `setOnline(memberId, online)`：更新 `onlineMemberIds`；狀態有變時 `repo.touchMember(memberId, clock.now())` 並 `publish(sessionId, { teacher: true, teamIds: [teamId] })`；加繁中註解（research R-09）。覆蓋測試：IT-ONLINE-01、UT-PROJ-10（`server/src/services/sessionService.ts`）
- [ ] T049 [BE] 實作 `attachSocket(io, { auth, service })`：`io.use` 讀 `handshake.auth.token`——`auth.verifyTeacher` 成功時必須帶存在的 `handshake.auth.sessionId`，加入 `teacher:${sessionId}`；否則 `service.resolveMember` 成功加入 `team:${teamId}`；皆失敗 → `next(new Error('UNAUTHORIZED'))`；連線後立即對該 socket emit 一次目前狀態（`teacher:state` 或 `team:state`）；以 `Map<memberId, number>` 計數，0→1 呼叫 `setOnline(id, true)`、1→0 呼叫 `setOnline(id, false)`（多分頁時最後一個斷線才離線）；加繁中註解（research R-10）。修改 `createApp`：改用 `createSocketBroadcaster(io, (id) => service.loadAggregate(id), clock)`（以延遲綁定解決 service 與 broadcaster 互相依賴）並呼叫 `attachSocket`，讓 T047 通過（`server/src/realtime/socket.ts`、`server/src/app.ts`）
- [ ] T050 [BE] **Phase 2 驗收**：執行 `npm test`（UT-REPO-01／07、UT-PHASE-01～03、UT-PROJ-10、UT-AUTH-01～04、UT-SVC-CREATE-01～07、UT-SVC-JOIN-01～10、UT-BC-01～03、IT-AUTH-01～03、IT-ONLINE-01 全部通過，Phase 1 測試仍通過）與 `npm run lint` 全部通過；依憲章原則 XI 比對 `diagrams/001-component.puml`（伺服器組件與 import 關係）、`diagrams/001-class.puml`（AuthService、SessionService 9 個方法與 ServiceDeps、IdGen、Scheduler、SheetsGateway、Broadcaster 的簽名與關聯）、`diagrams/001-sequence.puml`（login、createSession、join、resolveMember、setOnline、publish 的呼叫順序與推播範圍）與程式碼，不一致先修正（改圖後重新產生 PNG），於本任務記錄比對結果（`server/`、`diagrams/001-*.puml`）

---

## Phase 3: 前端 [FE]

**Purpose**：依序完成 api、socket、storage、messages → hooks → 元件 → 頁面。只修改 `client/`；型別、錯誤碼、常數只從 `@quiz/shared` 匯入。依賴 Phase 1（已合併），與 Phase 2 可並行（UI 測試以 `vi.mock` 取代 `api.ts`、`socket.ts`）。

### 3.1 client 骨架與基礎模組

- [ ] T051 [FE] 建立 `client/package.json`（dependencies：react@18、react-dom@18、react-router-dom@6、socket.io-client、`@quiz/shared`（`"*"`）；devDependencies：vite@5、@vitejs/plugin-react、jsdom、@testing-library/react、@testing-library/user-event、@testing-library/jest-dom、@types/react、@types/react-dom；scripts：`dev` = `vite`、`build` = `vite build`、`typecheck` = `tsc --noEmit -p .`）、`client/tsconfig.json`（extends `../tsconfig.base.json`，覆寫 `module: "ESNext"`、`moduleResolution: "Bundler"`、`jsx: "react-jsx"`、`lib: ["DOM","ES2022"]`）、`client/index.html`、`client/vite.config.ts`（port 5173；proxy `/api` → `http://localhost:3000`、`/socket.io` → `http://localhost:3000`（`ws: true`））、`client/vitest.config.ts`（environment `jsdom`、setupFiles `test/setup.ts`、include `test/**/*.test.{ts,tsx}`）、`client/test/setup.ts`（載入 `@testing-library/jest-dom/vitest`）；執行 `npm install`（`client/`）
- [ ] T052 [FE] 撰寫 UT-UI-STORE-01（save → load 相同）、UT-UI-STORE-02（localStorage 中為壞 JSON → load 回傳 null 且已清除）、UT-UI-STORE-03（`localStorage.getItem` 丟例外 → 回傳 null，不丟例外），執行並確認失敗（`client/test/storage.test.ts`）
- [ ] T053 [FE] 依 TECH_SPEC §10.2 實作 `loadMember`／`saveMember`／`clearMember`（localStorage key `quiz.member`，`{ token, roomCode, memberId }`）、`loadTeacher`／`saveTeacher`／`clearTeacher`（sessionStorage key `quiz.teacher`，`{ token }`），全部 try/catch，壞 JSON 時清除並回傳 null，讓 T052 通過（`client/src/storage.ts`）
- [ ] T054 [FE] 撰寫 UT-UI-MSG-01（對每個 ErrorCode 皆回傳非空中文訊息且等於 shared `MESSAGES`；未知碼回傳「發生未預期錯誤，請重新整理」），執行並確認失敗（`client/test/messages.test.ts`）
- [ ] T055 [FE] 實作 `messageOf(code: string): string`（以 `@quiz/shared` 的 `MESSAGES` 為來源，未知碼回傳預設訊息），讓 T054 通過（`client/src/messages.ts`）
- [ ] T056 [FE] 實作 `api.ts`：`request()` 包裝 fetch（JSON、`Authorization: Bearer`、非 2xx 時解析 `{ error: { code, message } }` 並丟出 `AppErrorView { code, message }`；網路錯誤轉為 code `'INTERNAL'`）；函式 `login(password)`、`createSession(token, input)`、`getCurrentSession(token)`、`getSession(token, id)`、`updateSettings(token, id, input)`、`getPublicInfo(roomCode)`、`join(roomCode, body)`、`getPlayState(token)`，路徑與回應型別照 contracts/rest-api.md（型別自 `@quiz/shared` 匯入）。覆蓋測試：E2E-03、E2E-18（UI 單元測試以 `vi.mock` 取代）（`client/src/api.ts`）
- [ ] T057 [FE] 實作 `socket.ts`：`connectTeacher(token, sessionId)`、`connectMember(token)`（`io('/', { auth })`），回傳 `{ onState(cb), onUnauthorized(cb), disconnect() }`，`onState` 訂閱 `teacher:state`／`team:state`，`connect_error.message === 'UNAUTHORIZED'` 時呼叫 `onUnauthorized`。覆蓋測試：E2E-03、E2E-18（`client/src/socket.ts`）

### 3.2 hooks

- [ ] T058 [FE] 撰寫 UT-UI-DASH-01（`getCurrentSession` 回 404 → 存在 `btn-create-session`）、UT-UI-DASH-02（回 200 → 不存在 `btn-create-session`）、UT-UI-DASH-03（按 `teacher-logout` → 呼叫 `clearTeacher`、導向 `/teacher/login`、api 未被呼叫），以 MemoryRouter、`vi.mock('../../src/api')`、`vi.mock('../../src/socket')`，執行並確認失敗（`client/test/pages/TeacherDashboard.test.tsx`）
- [ ] T059 [FE] 撰寫 UT-UI-PLAY-01（無 member token → 導向 `/join`）、UT-UI-PLAY-02（`getPlayState` 回 401 → 呼叫 `clearMember` 並導向 `/join?room=<roomCode>`），執行並確認失敗（`client/test/pages/Play.test.tsx`）
- [ ] T060 [FE] 實作 `useTeacher()` 的 `view`、`error`、`busy`、`createSession(input)`、`updateSettings(input)`（§10.3）：掛載時 `getCurrentSession`——200 → 設 view 並 `connectTeacher(token, view.session.id)`，收到 `teacher:state` 以快照**整份取代** view；404 → view＝null；401 或 socket UNAUTHORIZED → `clearTeacher()` 並導向 `/teacher/login`；錯誤以 `AppErrorView` 存入 error；卸載時 disconnect。覆蓋測試：UT-UI-DASH-01～03（`client/src/hooks/useTeacher.ts`）
- [ ] T061 [FE] 實作 `usePlay()` 的 `view`、`me`、`error`（§10.3）：無 `quiz.member` → 導向 `/join`；`getPlayState` 200 → 設 view 與 me 並 `connectMember(token)`，收到 `team:state` 以快照取代 view；401 或 socket UNAUTHORIZED → `clearMember()` 並導向 `/join?room=<原 roomCode>`。覆蓋測試：UT-UI-PLAY-01～02（`client/src/hooks/usePlay.ts`）

### 3.3 元件

- [ ] T062 [P] [FE] 撰寫 UT-UI-PHASE-01（PhaseBadge 對 SETUP、READY、RUNNING、ENDED 依序顯示「準備中」「等待開始」「搶答中」「已結束」），執行並確認失敗（`client/test/components/PhaseBadge.test.tsx`）
- [ ] T063 [FE] 實作 `PhaseBadge`（`data-testid="phase-badge"`，Phase → 中文對照），讓 T062 通過（`client/src/components/PhaseBadge.tsx`）
- [ ] T064 [FE] 實作 `ErrorBanner`（`data-testid="error-banner"`，props `error: AppErrorView | null`，以 `messageOf(error.code)` 顯示；null 時不渲染）。覆蓋測試：UT-UI-LOGIN-02、UT-UI-JOIN-03（`client/src/components/ErrorBanner.tsx`）
- [ ] T065 [P] [FE] 撰寫 UT-UI-LOGIN-01（輸入密碼送出 → 呼叫 `api.login`，成功 `saveTeacher` 並導向 `/teacher`）、UT-UI-LOGIN-02（api 丟 UNAUTHORIZED → `error-banner` 顯示「驗證失敗，請重新登入或加入」），執行並確認失敗（`client/test/components/LoginForm.test.tsx`）
- [ ] T066 [FE] 實作 `LoginForm`（`teacher-password`、`teacher-login-submit`；成功 `saveTeacher({ token })` 並 `navigate('/teacher')`；失敗顯示 ErrorBanner），讓 T065 通過（`client/src/components/LoginForm.tsx`）
- [ ] T067 [P] [FE] 撰寫 UT-UI-SET-01（選純速度 → 不存在 `settings-window-sec`）、UT-UI-SET-02（組數輸入 25 → `settings-save` disabled 或顯示錯誤），執行並確認失敗（`client/test/components/SettingsForm.test.tsx`）
- [ ] T068 [FE] 實作 `SettingsForm`（props：目前 session、`onSave`、`disabled`；`settings-team-count`（2–20）、`settings-mode-speed`、`settings-mode-fair`、`settings-window-sec`（只在 fair 時渲染，1–10）、`settings-save`（任一值超出範圍時 disabled））；只在 phase 為 SETUP／READY 時可編輯，讓 T067 通過（`client/src/components/SettingsForm.tsx`）
- [ ] T069 [P] [FE] 實作 `RoomCode`（`data-testid="room-code"` 大字顯示房間碼，並顯示加入網址 `${location.origin}/join?room=<roomCode>`）。覆蓋測試：E2E-03（`client/src/components/RoomCode.tsx`）
- [ ] T070 [P] [FE] 實作 `TeamList`（每組 `team-row-{index}`，`team-member-count-{index}` 顯示人數，每位成員顯示暱稱與上線／離線標示）。覆蓋測試：E2E-03、E2E-18（`client/src/components/TeamList.tsx`）
- [ ] T071 [P] [FE] 撰寫 UT-UI-JOIN-01（輸入房間碼 → `join-room-next` → 呼叫 getPublicInfo，顯示各組 `join-team-{index}` 與人數）、UT-UI-JOIN-02（未選組或暱稱空白 → `join-submit` disabled）、UT-UI-JOIN-03（api 丟 NICKNAME_TAKEN → 顯示錯誤、不導頁）、UT-UI-JOIN-04（成功 → `saveMember` 後導向 `/play`），執行並確認失敗（`client/test/components/JoinForm.test.tsx`）
- [ ] T072 [FE] 實作 `JoinForm`（props `initialRoom`；`join-room` → `join-room-next` 呼叫 `getPublicInfo` → `join-team-{index}`（組名＋人數）→ `join-nickname` → `join-submit`（未選組或暱稱 trim 後為空時 disabled）→ 成功 `saveMember({ token, roomCode, memberId })` 並 `navigate('/play')`；錯誤以 ErrorBanner 顯示且不導頁），讓 T071 通過（`client/src/components/JoinForm.tsx`）
- [ ] T073 [P] [FE] 實作 `TeamHeader`（`team-name`、`my-nickname`、`team-members`，組員依暱稱列出並標示上線）。覆蓋測試：E2E-18（`client/src/components/TeamHeader.tsx`）

### 3.4 頁面與路由

- [ ] T074 [P] [FE] 實作 `Home` 頁（「我是老師」→ `/teacher`、「我是學生」→ `/join`）。覆蓋測試：E2E-03（`client/src/pages/Home.tsx`）
- [ ] T075 [FE] 實作 `TeacherLogin` 頁（渲染 LoginForm）。覆蓋測試：UT-UI-LOGIN-01（`client/src/pages/TeacherLogin.tsx`）
- [ ] T076 [FE] 實作 `TeacherDashboard` 頁：無 `quiz.teacher` → 導向 `/teacher/login`；使用 `useTeacher`；view 為 null → 只顯示 `btn-create-session`（呼叫 `createSession({})`）；有 view → 顯示 PhaseBadge、RoomCode、SettingsForm（`updateSettings`）、TeamList、ErrorBanner，且**不渲染** `btn-create-session`；`teacher-logout` → `clearTeacher()`、中斷 socket、`navigate('/teacher/login')`，不呼叫 api；讓 T058 通過（`client/src/pages/TeacherDashboard.tsx`）
- [ ] T077 [FE] 撰寫 UT-UI-JOIN-05（有 member token 且 `getPlayState` 200 → 導向 `/play`，不顯示 JoinForm）、UT-UI-JOIN-06（有 member token 且 401 → 呼叫 `clearMember`，`join-room` 預填原 roomCode），執行並確認失敗（`client/test/pages/Join.test.tsx`）
- [ ] T078 [FE] 實作 `Join` 頁：掛載時若有 `quiz.member` 先 `getPlayState(token)`——200 → `navigate('/play', { replace: true })` 且不渲染 JoinForm；401 → `clearMember()`，以原 roomCode 作為 `initialRoom`；無 token → 以 `?room=` 作為 `initialRoom`；讓 T077 通過（`client/src/pages/Join.tsx`）
- [ ] T079 [FE] 實作 `Play` 頁：使用 `usePlay`；顯示 TeamHeader、PhaseBadge、ErrorBanner 與等待畫面（「等待老師開始」；AnswerCard 屬 003），讓 T059 通過（`client/src/pages/Play.tsx`）
- [ ] T080 [FE] 實作 `main.tsx`（`createRoot` + `BrowserRouter`）與 `App.tsx`（路由 `/` Home、`/teacher/login` TeacherLogin、`/teacher` TeacherDashboard、`/join` Join、`/play` Play，依 TECH_SPEC §10.1）。覆蓋測試：UT-UI-PLAY-01、E2E-03（`client/src/main.tsx`、`client/src/App.tsx`）
- [ ] T081 [FE] **Phase 3 驗收**：執行 `npm test`（UT-UI-STORE-01～03、UT-UI-MSG-01、UT-UI-PHASE-01、UT-UI-LOGIN-01～02、UT-UI-SET-01～02、UT-UI-JOIN-01～06、UT-UI-DASH-01～03、UT-UI-PLAY-01～02 全部通過，Phase 1、2 測試仍通過）與 `npm run lint` 全部通過；確認 `client/` 沒有匯入 `server/` 的任何檔案（搜尋 `from '.*server/`）；依憲章原則 XI 比對 `diagrams/001-component.puml`（老師端／學生端組件、儲存、HTTP 與即時連線關係）、`diagrams/001-sequence.puml`（登入→取得目前活動→建立、登出、加入頁導向、重連與失效處理的順序）與程式碼，不一致先修正，於本任務記錄比對結果（`client/`、`diagrams/001-*.puml`）

---

## Phase 4: 整合與 E2E [QA]

**Purpose**：Playwright 設定、E2E-03、E2E-18、整合測試全量重跑、覆蓋率、文件與手動驗收。依賴 Phase 2 與 Phase 3。

- [ ] T082 [QA] 建立 `e2e/package.json`（devDependency `@playwright/test`；script `test` = `playwright test`；**不執行** `playwright install`，使用系統 Edge）與 `e2e/tsconfig.json`；執行 `npm install`（`e2e/package.json`、`e2e/tsconfig.json`）
- [ ] T083 [QA] 建立 Playwright 設定（research R-13）：`use.channel: 'msedge'`、`use.baseURL: 'http://localhost:3100'`；`webServer.command` = `npm run build && npm start`（cwd 為 repo 根目錄）、`webServer.env` = `{ PORT: '3100', DB_PATH: ':memory:', SHEETS_MODE: 'fake', TEACHER_PASSWORD: 'e2e-pass' }`、`webServer.url` = `http://localhost:3100`、`reuseExistingServer: false`；`workers: 1`；只用 `data-testid` 選取；每個測試結束截圖到 `e2e/artifacts/<ID>.png`（`e2e/playwright.config.ts`）
- [ ] T084 [QA] 撰寫 E2E-03：老師登入（`teacher-password`＝e2e-pass）並按 `btn-create-session`，讀取 `room-code`；4 個學生各用獨立 `browser.newContext()` 經 `/join` 加入（第 1 組 2 人、第 2、3 組各 1 人，暱稱只用中英數）→ 老師 `team-member-count-1`＝2、`team-member-count-2`＝1、`team-member-count-3`＝1（`e2e/tests/identity.spec.ts`）
- [ ] T085 [QA] 撰寫 E2E-18（同一 spec 檔、接在 E2E-03 之後、沿用某位學生的 context）：開啟 `/join` → 自動導向 `/play`，`my-nickname` 不變；老師端該組 `team-member-count-{index}` 不變（`e2e/tests/identity.spec.ts`）
- [ ] T086 [QA] 執行 `npm run test:e2e`（E2E-03、E2E-18 通過，截圖存在 `e2e/artifacts/`）與 `npm run test:coverage`（達 TEST_SPEC §2.3 門檻；記錄排除清單：`server/src/index.ts`）；再次確認 IT-AUTH-01～03、IT-ONLINE-01 通過；核對 TECH_SPEC §14.1 001 列每個測試 ID 都有對應且通過的測試（`e2e/tests/identity.spec.ts`、`server/test/integration/`）
- [ ] T087 [QA] 機密與資訊隔離檢查：`git ls-files` 不含 `.env`、`secrets/`、`data/`；程式與測試中沒有真實密碼（E2E 密碼只在 `e2e/playwright.config.ts` 的 webServer env）；抽查 IT-ONLINE-01 中學生收到的 `team:state` 只含本組成員（憲章 IV、VI）（`server/test/integration/online.it.test.ts`）
- [ ] T088 [QA] 更新 `README.md`：功能清單（001：老師登入／登出、建立活動、設定、學生加入、即時名單、重連）、如何執行（Node 22.13+、`npm install`、複製 `.env.example` 為 `.env`、`npm run dev`、`npm test`、`npm run test:e2e` 需安裝 Microsoft Edge）、`plantuml.jar` 取得方式與 `java -jar plantuml.jar "./diagrams/*.puml"`（TECH_SPEC §0 規則 8、憲章技術約束）（`README.md`）
- [ ] T089 [QA] 依 `specs/001-session-and-join/quickstart.md` 執行 5 個手動驗證情境，結果記錄於 `docs/manual-test.md` 的 001 段落（`docs/manual-test.md`）
- [ ] T090 [QA] **Phase 4 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（並確認 `npm run test:e2e` 通過）；依憲章原則 XI 對 `diagrams/001-component.puml`、`diagrams/001-class.puml`、`diagrams/001-sequence.puml` 做最終全面比對（組件與連線、類別欄位與公開方法與關聯、三段互動順序），不一致先修正（改圖後重新執行 `java -jar plantuml.jar "./diagrams/*.puml"` 並確認無錯誤），於本任務記錄比對結果（`diagrams/001-*.puml`）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup [BE]**：無依賴；完成後**單獨合併到 main**
- **Phase 2 後端 [BE]**：依賴 Phase 1
- **Phase 3 前端 [FE]**：依賴 Phase 1；與 Phase 2 **可並行**（UI 測試 mock `api.ts`／`socket.ts`，契約依 contracts/）
- **Phase 4 整合 [QA]**：依賴 Phase 2 與 Phase 3

### Within Phases

- 測試任務 → 實作任務（Red → Green）
- Phase 2 順序固定：ports／替身 → db／repo → phase → projections → services → HTTP → Socket
- `server/src/services/sessionService.ts` 由 T031、T034、T036、T048 依序修改；`server/src/app.ts` 由 T042、T049 依序修改；`server/test/integration/auth.it.test.ts` 由 T037、T047 依序修改；`e2e/tests/identity.spec.ts` 由 T084、T085 依序修改——同檔任務不可平行

### Parallel Opportunities

- Phase 1：T002–T005 平行；T007、T008 平行
- Phase 2：T019、T020、T021 平行
- Phase 3：T062、T065、T067、T071 測試可平行；T069、T070、T073、T074 平行
- **跨 Phase**：Phase 1 合併後，後端成員做 Phase 2、前端成員做 Phase 3，兩者不修改同一檔案

---

## Parallel Example

```bash
# Phase 1 合併後，兩位成員同時開始：
# 後端成員
Task: "T016 server/package.json …"
Task: "T017 server/src/ports/*.ts"
# 前端成員
Task: "T051 client/package.json、vite.config.ts …"
Task: "T052 UT-UI-STORE-01～03 in client/test/storage.test.ts"

# Phase 3 元件測試平行撰寫：
Task: "T062 UT-UI-PHASE-01 in client/test/components/PhaseBadge.test.tsx"
Task: "T065 UT-UI-LOGIN-01～02 in client/test/components/LoginForm.test.tsx"
Task: "T067 UT-UI-SET-01～02 in client/test/components/SettingsForm.test.tsx"
Task: "T071 UT-UI-JOIN-01～04 in client/test/components/JoinForm.test.tsx"
```

---

## Implementation Strategy

1. **Phase 1** → 驗收 T015 → 合併 main（共用契約就緒）
2. **Phase 2 ∥ Phase 3** → 各自驗收 T050、T081 → 分別合併
3. **Phase 4** → E2E、覆蓋率、README、手動驗收、最終圖表比對 T090
4. **合併條件**（TECH_SPEC §14.1）：001 列全部測試、`npm run lint` 通過，且 T090 完成

---

## 追溯表

### TECH_SPEC §14.1 001 列測試 ID → 任務

| 測試 ID | 測試任務 | 實作任務 |
| --- | --- | --- |
| UT-ERR-01～02 | T009 | T010 |
| UT-VAL-01～13 | T011 | T012 |
| UT-REPO-01、07 | T022 | T023、T024 |
| UT-PHASE-01～03 | T025 | T026 |
| UT-PROJ-10 | T027 | T028、T048 |
| UT-AUTH-01～04 | T029 | T030 |
| UT-SVC-CREATE-01～07 | T033 | T031、T034 |
| UT-SVC-JOIN-01～10 | T035 | T036 |
| IT-AUTH-01～02 | T037 | T038–T042 |
| UT-BC-01～03 | T045 | T046 |
| IT-AUTH-03、IT-ONLINE-01 | T047 | T048、T049 |
| UT-UI-STORE-01～03 | T052 | T053 |
| UT-UI-MSG-01 | T054 | T055 |
| UT-UI-DASH-01～03 | T058 | T060、T076 |
| UT-UI-PLAY-01～02 | T059 | T061、T079、T080 |
| UT-UI-PHASE-01 | T062 | T063 |
| UT-UI-LOGIN-01～02 | T065 | T064、T066、T075 |
| UT-UI-SET-01～02 | T067 | T068 |
| UT-UI-JOIN-01～04 | T071 | T064、T072 |
| UT-UI-JOIN-05～06 | T077 | T078 |
| E2E-03 | T084 | T043、T044、T056、T057、T069、T070、T074、T080 |
| E2E-18 | T085 | T056、T057、T070、T073 |

### User story → 任務

| Story | 後端 | 前端 | 整合 |
| --- | --- | --- | --- |
| US1 老師登入並建立活動 | T029–T034、T040 | T058、T060、T063–T066、T069、T075、T076 | T037、T084 |
| US2 學生加入 | T035、T036、T041 | T071、T072、T073、T079 | T037、T084 |
| US3 即時名單與上線 | T027、T028、T045–T049 | T057、T060、T061、T070 | T047、T084 |
| US4 自動重連 | T035（UT-SVC-JOIN-08） | T059、T061、T077、T078 | T085 |
| US5 調整設定 | T033、T034、T040 | T067、T068、T076 | — |
| US6 階段顯示與同步 | T025、T026、T046、T049 | T062、T063、T060、T061 | T047 |

---

## Notes

- 測試名稱必須含 TEST_SPEC ID；測試不依賴真實時間、亂數、網路
- 業務邏輯禁止直接呼叫 `Date.now()`、`setTimeout`、`Math.random()`（只有 `ports/` 的正式實作可以）
- 「覆蓋測試」標註的模組沒有 TEST_SPEC 專屬 ID，由所列測試驗證；不新增無 ID 的測試
- 每完成一個邏輯群組就 commit；Phase 1 單獨成一個 PR
