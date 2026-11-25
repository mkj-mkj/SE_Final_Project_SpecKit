---
description: "Task list for 003-live-quiz（依層次分 Phase：Setup → 後端 domain → 後端 service（純速度）→ 後端 service（公平、撤回、重啟、路由）→ 前端 → 整合與 E2E）"
---

# Tasks: 搶答進行（003-live-quiz）

**Input**：`specs/003-live-quiz/`（plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md）

**契約依據**：`docs/TECH_SPEC.md` v1.6（型別、簽名、API 路徑、Socket 事件、錯誤碼、`data-testid` 逐字照抄，不得改名）、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2、藍圖 `diagrams/003-*.puml`

**範圍**：只做 TECH_SPEC §14.1「003-live-quiz」一列。不建立 004 的檔案或空殼（`sheets/exporter.ts`、`export/csv.ts`、`buildCsvRows`、`rejectWinner`、`ResultsTable`、`ExportPanel`、`StudentResults`、AnswerCard 的 rejected 狀態）。三個控制按鈕按下即執行，**沒有確認步驟**（research D1）。

**前置依賴**：Phase 1、2A、2B、2C 可立即開始。Phase 3 需 001 的 Phase 3（`client/`，T051 起）與 002 的 Phase 3（T027 起）完成。Phase 4 的 IT 只需 Phase 2C；E2E 需 Phase 3 與 001 的 Phase 4（`e2e/playwright.config.ts`）完成。

## 規則

1. **測試先行（憲章 VII）**：每個實作任務之前都有測試任務；測試名稱必須含 TEST_SPEC 案例 ID（例：`it('UT-SVC-SUB-02 A 組在 t 送出第 3 題為得主', …)`），先執行確認失敗（Red）再實作（Green）。測試不得依賴真實時間、亂數或網路：server 一律 `FakeClock`／`ManualScheduler`／`SeqIdGen`；client 一律 `vi.useFakeTimers()` 與 `vi.mock('../src/api')`。例外：IT-CONC-01、IT-PERF-01 依 TEST_SPEC §6 使用真實 clock 與 `timerScheduler`。
2. **沒有 TEST_SPEC ID 的模組**（repo 新方法的部分、`boot/recover.ts`、`app.ts` 的 `serviceOf`、`index.ts` 接線、6 個路由、`seed.ts`、client `api.ts`、`useTeacher`／`usePlay` 的 REST 呼叫、TeacherDashboard／Play 組裝）：任務中以「覆蓋測試：<ID>」註明由哪個測試驗證，不新增無 ID 的測試（plan.md Complexity Tracking 的書面例外）。
3. **檔案歸屬（憲章 IX）**：[BE] 只改 `server/src/**`、`server/test/{helpers,domain,db,services}/**`；[FE] 只改 `client/**`；[QA] 只改 `server/test/integration/**`、`e2e/**`、`README.md`。[BE] 與 [FE] 不修改同一個檔案；前端型別一律從 `@quiz/shared` 匯入。
4. **伺服器規則**：domain／service 不得直接呼叫 `Date.now()`、`setTimeout`、`Math.random()`，一律用注入的 `clock`、`scheduler`、`ids`；寫入動作包在 `withTransaction`，且是同一個同步函式（中間沒有 `await`）；`scheduler.schedule／cancel` 與 `broadcaster.publish` 只在 COMMIT 之後執行（research R-01）。得主、順位、分數不存資料庫，一律由 `ranking.ts` 推導。重要業務邏輯加繁中註解（憲章 I）。
5. 每個 Phase 最後一個任務：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試），並依憲章原則 11（XI）比對程式碼與 `diagrams/003-*.puml`。

## Format: `- [ ] T### [P?] [BE|FE|QA] [US#?] 描述（檔案路徑）`

- **[P]**：可平行（不同檔案、不依賴同 Phase 內未完成的任務）
- **[BE]／[FE]／[QA]**：後端／前端／整合與驗證
- **[US#]**：對應 spec.md 的 User Story（US1 純速度送出、US2 老師狀態表與結束、US3 資訊隔離、US4 共編草稿、US5 公平模式、US6 撤回、US7 重連與重啟）；跨多個 story 的基礎任務不標
- 本檔依層次分 Phase（使用者指定），user story 對應見文末「追溯表」

---

## Phase 1: Setup — 基準確認

**Purpose**：確認 001、002 後端已完成、測試全綠，且 003 不需要新增任何相依套件。

- [ ] T001 [BE] **Phase 1 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試），記錄目前通過的測試數作為基準；確認 `package.json`、`server/package.json` 不需新增相依（plan Technical Context：新增「無」），並以 PowerShell `Get-ChildItem -Recurse -Filter *.node node_modules` 確認沒有原生模組；依憲章原則 11 確認 `diagrams/003-*.puml` 已是 plan D2、D3 更新後的版本（Repo 有 `listDrafts`、`listSessionsByPhase`；SessionService 有 `loadAggregate`；recover 標註「createApp 組裝完成後」），且 `java -jar plantuml.jar "./diagrams/*.puml"` 無錯誤（`diagrams/003-*.puml`、`diagrams/003-*.png`）

**Checkpoint**：Phase 2A 可開始

---

## Phase 2A: 後端 domain [BE] — ranking、settlement、projections、buildResults

**Purpose**：完成所有純函式，讓得主、順位、分數與視圖可由送出紀錄推導（TECH_SPEC §7.6～§7.8）。

### ranking.ts（§7.6）

- [X] T002 [P] [BE] [US1] 撰寫 UT-RANK-01～09，執行並確認失敗。測試以手動建構的 `Submission`（`status`、`orderKey`、`serverTime`、`seq`、`teamId`）組成：01 orderKey `[2, null, 1]` → `orderSubmissions` 依 1、2、null；02 orderKey 皆 null、serverTime 不同 → 依 serverTime；03 serverTime 相同、seq 不同 → 依 seq；04 含 withdrawn → 不出現在 `rankSubmissions` 結果，rank 連續 1..n；05 第一名 rejected → 第二名 `isWinner=true`，rejected 仍是 rank 1；06 全部 orderKey 為 null（視窗中）→ `winnerOf` 為 null；07 全部 rejected 或 withdrawn → `winnerOf` 為 null；08 `teamScores`：A 贏 2 題、B 贏 1 題、C 無 → A=2、B=1、C=0；09 `teamScores`：A 的得主被 rejected、B 遞補 → A=0、B=1。另斷言輸入陣列未被修改（`server/test/domain/ranking.test.ts`）
- [X] T003 [BE] [US1] 依 TECH_SPEC §7.6 實作純函式，簽名逐字照抄：`orderSubmissions(subs)`（排除 `status==='withdrawn'`；依 `orderKey` 升冪、`null` 排最後 → `serverTime` 升冪 → `seq` 升冪；回傳新陣列）、`rankSubmissions(subs): RankedSubmission[]`（`rank` = 排序位置 + 1；`isWinner` = 為排序後第一筆 `status==='active' && orderKey !== null` 者）、`winnerOf(subs): Submission | null`、`teamScores(teams, subsByQuestion): Map<string, number>`（每個 team 初值 0，每題 `winnerOf` 的 teamId +1）。以繁中註解說明「rejected 保留名次但不能是得主、withdrawn 不列入名次，因此遞補自動成立」，讓 T002 通過（`server/src/domain/ranking.ts`）

### settlement.ts（§7.7）

- [X] T004 [P] [BE] [US5] 撰寫 UT-SETTLE-01～06，執行並確認失敗：01 分數 A=2、B=0，A 較早送出 → `sortFairCandidates` 結果 B 在前；02 同分 → 早送出者在前；03 同分同時間 → seq 小者在前；04 `scores` 中沒有某組 → 視為 0；05 `assignOrderKeys(sorted, 3)` → 依序 3、4、5（回傳 `Map<id, key>`）；06 `nextOrderKey([])` → 1、orderKey `[1, 2, null]` → 3（`server/test/domain/settlement.test.ts`）
- [X] T005 [BE] [US5] 依 TECH_SPEC §7.7 實作：`sortFairCandidates(cands, scores)`（`scores.get(teamId) ?? 0` 升冪 → `serverTime` 升冪 → `seq` 升冪；回傳新陣列）、`assignOrderKeys(sorted, startAt): Map<string, number>`（id → startAt、startAt+1…）、`nextOrderKey(subs)`（所有送出〔含 withdrawn〕的 `max(orderKey) + 1`，沒有任何非 null 則 1）。繁中註解說明公平模式「低分優先 → 較早 → seq」，讓 T004 通過（`server/src/domain/settlement.ts`）

### projections.ts（§7.8）

- [X] T006 [BE] [US2] [US3] 在既有檔案補 UT-PROJ-02～08（保留 UT-PROJ-01、10），執行並確認失敗。以手動建構的 `SessionAggregate`（2～3 組、範例 A 的題目與 slots）：02 `projectTeacherView`（2 題 × 2 組）→ `cells.length === 4`、`questions[].winnerTeamId` 正確、cells 中含 B 組的答案；03 同組同題有 withdrawn（seq 小）後再 active（seq 大）→ 該 cell 取 seq 最大的一筆；04 RUNNING 中 `projectTeamView(agg, A)` 的 `JSON.stringify` 不含 B 組成員暱稱 `SECRETNICKB`、B 組答案 `SECRET-ANS-B`、B 的 member id、B 的 submission id；05 RUNNING 中 TeamView 遞迴掃描所有物件 key → 不存在 `rank`、`isWinner`、`score`、`scores`、`state`、`windowEndsAt`、`winnerTeamId`，且 `results === null`；06 ENDED 中 TeamView → `results` 非 null，含所有組的 ranking 與 scores；07 active 送出 `serverTime = T` → `mySubmissions[qid].withdrawableUntil === T + 10000`，withdrawn → `null`；08 `buildResults`：得主被判錯（status rejected）→ winner 為遞補者，ranking 含 rejected、不含 withdrawn，scores 依分數降冪、組序升冪（`server/test/domain/projections.test.ts`）
- [X] T007 [BE] [US2] [US3] 補完 projections（data-model §5、research R-07），讓 T006 與既有 UT-PROJ-01、10 通過：
  - `projectTeacherView`：先把 `agg.submissions` 依 questionId 分組成 `Map`，每題只呼叫一次 `rankSubmissions`、`winnerOf`，`teamScores` 只算一次（research R-13）；`questions[].winnerTeamId = winnerOf(...)?.teamId ?? null`；`teams[].score` 取 `teamScores`；`cells` 依題號升冪 → 組序升冪，每題 × 每組一格，`submission` 為該組該題 `seq` 最大的一筆（沒有則 `null`），欄位 `{ id, answers, submittedBy: 送出成員暱稱, serverTime, status, rank, isWinner }`，`rank` 在 `status==='withdrawn'` 或 `orderKey === null` 時為 `null`，否則取 `rankSubmissions` 的 rank；`isWinner` 為該筆是否等於 `winnerOf`。TeacherView 不含草稿（spec FR-015）。
  - `projectTeamView`：`drafts` 只取本組，`{ [questionId]: { answers, updatedBy, updatedAt } }`；`mySubmissions` 只取本組、每題 `seq` 最大的一筆，以**白名單**逐欄建立 `{ id, answers, submittedBy, serverTime, status, withdrawableUntil }`（不得 spread `Submission`），`withdrawableUntil = status === 'active' ? serverTime + WITHDRAW_LIMIT_MS : null`；`results = session.phase === 'ENDED' ? buildResults(agg) : null`。繁中註解標示 FR-10 資訊隔離。
  - 新增 `buildResults(agg): Results`：`questions` 依題號升冪，含 `questionId, number, isGroup, subLabels`（同 `questionInfo`）、`winner`（`{ teamId, teamName, answers, submittedBy }` 或 null）、`ranking`（`rankSubmissions` 的結果，欄位 `rank, teamId, teamName, answers, submittedBy, serverTime, status, isWinner`）；`scores` 依分數降冪 → 組序（`team.index`）升冪。
  - 更新檔頭註解（移除「作答、結果相關欄位仍回傳空值」）（`server/src/domain/projections.ts`）
- [X] T008 [BE] **Phase 2A 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試）；執行 `npm run test:coverage` 確認 `server/src/domain/**` 行 ≥ 95%、分支 ≥ 90%；依憲章原則 11 比對程式碼與 `diagrams/003-class.puml` 的 `ranking`、`settlement`、`projections` 模組（函式名稱、參數、回傳型別）與 `diagrams/003-component.puml` 的「排名 ranking」「結算 settlement」「視圖投影 projections」，不一致時修正程式或先改圖並重新產生 PNG（`server/src/domain/`、`diagrams/003-*.puml`）

**Checkpoint**：domain 純函式完成，service 可以開始使用

---

## Phase 2B: 後端 service（純速度）[BE] — repo、start、end、reset、updateDraft、submit、seed

**Purpose**：完成資料存取與純速度模式的完整流程（spec US1、US2、US4）。

### repo（drafts、submissions、seq、題目狀態）

- [X] T009 [BE] 在既有檔案補 UT-REPO-02～06（保留 UT-REPO-01、07），執行並確認失敗：02 `answers` 含中文、逗號、換行（如 `['作業,系統', '第一行\n第二行']`）→ `insertSubmission` 後 `getSubmission` 的 answers 完全相同（JSON 往返）；03 同組同題插入第二筆 active → 丟出 `AppError` 且 `code === 'ALREADY_SUBMITTED'`；04 同組同題：先 withdrawn 再 active → 允許；05 刪除 session → questions、teams、members、submissions 連帶刪除（以 `listQuestions`、`listTeams`、`listSubmissions` 驗證）；06 連續呼叫 `nextSeq()` 三次 → 嚴格遞增（`server/test/db/repo.test.ts`）
- [X] T010 [BE] 在 `Repo` 新增方法（名稱與 `diagrams/003-class.puml` 一致，data-model §4），全部使用參數化查詢、`$name` 具名參數，JSON 欄位自動 parse，讓 T009 通過：
  - `upsertDraft(d: Draft)`（`INSERT … ON CONFLICT(team_id, question_id) DO UPDATE SET answers, updated_by, updated_at`）、`deleteDraft(teamId, questionId)`、`listDrafts(sessionId)`（join teams 篩選 session）、`deleteDraftsBySession(sessionId)`
  - `nextSeq()`：回傳 `max(記憶體中上次發出的值, SELECT COALESCE(MAX(seq),0) FROM submissions) + 1` 並更新記憶體值（research R-02）
  - `insertSubmission(s)`：捕捉訊息含 `UNIQUE constraint failed: submissions.team_id, submissions.question_id` 的錯誤，改丟 `new AppError('ALREADY_SUBMITTED')`，其他錯誤原樣丟出（research R-03）
  - `getSubmission(id)`、`updateSubmission(id, patch: { status?, orderKey?, withdrawnAt? })`（只更新有提供的欄位）、`listSubmissions(sessionId)`、`listSubmissionsByQuestion(questionId)`（皆依 `seq` 升冪）、`deleteSubmissionsBySession(sessionId)`
  - `getQuestion(id)`、`updateQuestionState(id, state, windowEndsAt)`、`resetQuestionStates(sessionId)`（全部 `state='open'`、`window_ends_at=NULL`）、`listSessionsByPhase(phase)`
  
  （`server/src/db/repo.ts`）

### start、end（不含視窗結算）、reset

- [X] T011 [BE] [US1] [US2] 撰寫 UT-SVC-PHASE-01、02、04、05，執行並確認失敗。以 `makeTestService()` 建立，`createSession` → `importSheet('fixture-template-a')` 進入 READY：01 SETUP 中（未匯入）`start` → `AppError('INVALID_PHASE')`；02 READY 中 `start` → phase RUNNING、`startedAt === clock.now()`、所有題目 `state === 'open'`、`broadcaster.calls` 最後一筆為 `{ sessionId }`（scope 為預設，全部）；04 READY 中 `end` → INVALID_PHASE；05 先 `start`，以 `repo.insertSubmission`／`repo.upsertDraft` 直接放入 1 筆送出與 1 份草稿，`end` → `reset` → phase READY、`round === 2`、`listSubmissions`／`listDrafts` 為空、成員與題目保留、所有題目 state open、`startedAt`／`endedAt` 為 null（`server/test/services/session.phase.test.ts`）
- [X] T012 [BE] [US1] [US2] 在 `SessionService` 實作，讓 T011 通過：
  - 交易後副作用機制（research R-01）：private `runTx<T>(fn: (after: (cb: () => void) => void) => T): T`，以 `withTransaction(repo.db, …)` 執行 `fn`，COMMIT 成功後依序執行 `after` 收集的回呼；交易丟出例外時丟棄回呼。後續所有寫入方法都用它。
  - `loadAggregate`：drafts 改讀 `repo.listDrafts(sessionId)`、submissions 改讀 `repo.listSubmissions(sessionId)`；更新檔頭註解。
  - `start(sessionId): TeacherView`：`assertPhase(phase, 'start')` → 題數為 0 → `AppError('NO_QUESTIONS')` → `resetQuestionStates` → `phase = nextPhase(phase, 'start')`（RUNNING）、`startedAt = clock.now()` → COMMIT 後 `publish(sessionId)`。
  - `end(sessionId): TeacherView`（**本 Phase 不含視窗結算**，留到 T022）：`assertPhase(phase, 'end')` → phase ENDED、`endedAt = clock.now()` → COMMIT 後 publish。
  - `reset(sessionId): TeacherView`：`assertPhase(phase, 'reset')` → `deleteSubmissionsBySession`、`deleteDraftsBySession`、`resetQuestionStates` → `round + 1`、phase READY、`startedAt = endedAt = null` → COMMIT 後 publish。
  - 繁中註解說明階段轉換（`server/src/services/sessionService.ts`）
- [X] T013 [BE] 依 TEST_SPEC §3 建立 `seedRunning(t, opts?)`，簽名逐字照抄；預設 `fixture='template-a'`、`teams=3`、`membersPerTeam=2`、`mode='speed'`、`windowSec=3`；流程：`createSession({ teamCount: teams, fairnessMode: mode, windowSec })` → `await importSheet(sessionId, \`fixture-${fixture}\`)` → 各組依序 `join(roomCode, { teamId, nickname: \`T${i}M${j}\` })`（只用英數字，符合暱稱規則）→ `start(sessionId)`；回傳 `{ sessionId, teamIds, tokens /* tokens[teamIndex-1][memberIndex] */, q /* 題號 → questionId */ }`。同檔匯出答案常數 `ANSWERS = { 1: ['CPU','作業系統'], 2: ['演算法','堆疊'], 3: ['0'], 4: ['IP'] }`。覆蓋測試：T014、T016 起所有 UT-SVC（`server/test/helpers/seed.ts`）

### updateDraft（組內共編）

- [X] T014 [BE] [US4] 撰寫 UT-SVC-DRAFT-01～05，執行並確認失敗（使用 `seedRunning`）：01 A 組成員 1 更新第 1 題草稿 `['C','']` → A 組成員 2 的 `getTeamView` 的 `drafts[q1].answers` 為 `['C','']`；B 組的 TeamView 沒有該草稿（`JSON.stringify` 不含 `'C'` 草稿與 A 成員 id）；02 READY 中更新（另建未 start 的活動，以 `join` 取得 token）→ INVALID_PHASE；03 第 1 題送長度 1 的陣列 → INVALID_INPUT；單格 201 字 → ANSWER_TOO_LONG；`['','']` 允許、且不 trim（`[' a ','']` 原樣保存）；04 以 `repo.insertSubmission` 放入 A 組第 3 題 active 送出後更新第 3 題草稿 → ALREADY_SUBMITTED；05 更新成功後 `broadcaster.calls` 最後一筆 scope 為 `{ teacher: false, teamIds: [A] }`（`server/test/services/session.draft.test.ts`）
- [X] T015 [BE] [US4] 實作 `updateDraft(memberToken, questionId, answers): void`（data-model §6），讓 T014 通過：`resolveMember` → `assertPhase(phase, 'draft')` → `repo.getQuestion` 不存在或不屬於該活動 → QUESTION_NOT_FOUND → `answers.length !== subCount` → INVALID_INPUT → 任一格 `length > MAX_ANSWER_LENGTH`（200）→ ANSWER_TOO_LONG（**不 trim、允許空字串**）→ 本組該題已有 `status ∈ {active, rejected}` → ALREADY_SUBMITTED → `upsertDraft({ teamId, questionId, answers, updatedBy: member.id, updatedAt: clock.now() })`（整題覆蓋，spec FR-016a）→ COMMIT 後 `publish(sessionId, { teacher: false, teamIds: [member.teamId] })`（`server/src/services/sessionService.ts`）

### submit（純速度路徑）

- [X] T016 [BE] [US1] 撰寫 UT-SVC-SUB-01～10 與 UT-SVC-DRAFT-06，執行並確認失敗（`seedRunning` 預設 speed）：SUB-01 READY（未 start 的活動）與 ENDED（`end` 後）中送出 → INVALID_PHASE，且 `listSubmissions` 沒有新增；02 A 組在 t 送出第 3 題 `['0']` → 回傳 `serverTime === t`、`getTeacherView` 中 A 為第 3 題得主（`winnerTeamId === A`、cell `rank 1`、`isWinner true`）、題目 `state === 'settled'`；03 `clock.advance(80)` 後 B 組送出第 3 題 → B 的 cell `rank 2`、`isWinner false`；04 A 組另一成員再送第 3 題 → ALREADY_SUBMITTED；05 送出 `[' 0 ']` → 保存為 `['0']`；06 第 1 題（題組）送 `['CPU','']` → GROUP_INCOMPLETE；兩格都填 → 一筆送出、`answers.length === 2`；07 不存在的 questionId、別活動的題目（另建活動並匯入）→ QUESTION_NOT_FOUND；08 不推進 clock，A、B 先後送出 → 先呼叫者為得主（seq 決定）；09 `seedRunning(t, { teams: 20, membersPerTeam: 1 })`，20 組在同一毫秒依序送出同一題 → 恰 1 位得主、rank 為 1..20 不重複；10 回傳值 `withdrawableUntil === serverTime + 10000`。DRAFT-06：A 組先 `updateDraft` 第 3 題 `['0']`，再送出第 3 題 → `listDrafts` 中 A 組第 3 題草稿已刪除（`server/test/services/session.submit.test.ts`）
- [X] T017 [BE] [US1] 實作 `submit(memberToken, questionId, answers)`，**整段在單一同步交易中**，依 TECH_SPEC §7.9 submit 演算法步驟 1～11 逐條實作並以繁中註解標示步驟編號，讓 T016 通過：(1) `resolveMember`、取 session；(2) `assertPhase(phase, 'submit')`；(3) 題目必須屬於該活動，否則 QUESTION_NOT_FOUND；(4)(5) `validateAnswers(answers, q.subCount, q.isGroup)`（shared，回傳 trim 後的值；錯誤碼 INVALID_INPUT／GROUP_INCOMPLETE／ANSWER_REQUIRED／ANSWER_TOO_LONG）；(6) 本組該題已有 active／rejected → ALREADY_SUBMITTED；(7) `now = clock.now()`、`seq = repo.nextSeq()`；(8) **本 Phase 只實作 8a**：`session.fairnessMode === 'speed'` → `orderKey = nextOrderKey(repo.listSubmissionsByQuestion(q.id))`、題目 state 設為 `settled`（公平模式 8b～8d 留到 T020）；(9) `insertSubmission({ id: ids.id('sub'), …, status: 'active', orderKey, withdrawnAt: null })`、`deleteDraft(teamId, q.id)`；(10) COMMIT 後 `publish(sessionId)`；(11) 回傳 `{ submissionId, serverTime: now, withdrawableUntil: now + WITHDRAW_LIMIT_MS }`。客戶端送來的任何時間欄位都不讀取（`server/src/services/sessionService.ts`）
- [X] T018 [BE] **Phase 2B 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試）；依憲章原則 11 比對程式碼與 `diagrams/003-class.puml` 的 `Repo`（方法名稱與參數）、`SessionService`（`loadAggregate`、`start`、`end`、`reset`、`updateDraft`、`submit` 的簽名），以及 `diagrams/003-sequence.puml`「一、純速度模式」的步驟順序（resolveMember → assertPhase → 題目／validateAnswers → ALREADY_SUBMITTED 檢查 → clock.now → nextSeq → nextOrderKey → 新增送出、settled、刪草稿 → publish），不一致時修正（`server/src/`、`diagrams/003-*.puml`）

**Checkpoint**：純速度模式的開始、送出、共編、結束、重新開始可用（service 層）

---

## Phase 2C: 後端 service（公平模式、撤回、重啟與路由）[BE]

**Purpose**：完成公平模式視窗、撤回、啟動恢復、HTTP 路由與推播範圍（spec US5、US6、US7）。

### submit 視窗路徑與 settleWindow

- [X] T019 [BE] [US5] 撰寫 UT-SVC-FAIR-01～09，執行並確認失敗（`seedRunning(t, { mode: 'fair' })`，W=3 秒）：01 第一筆送出 → 題目 `state === 'window'`、`windowEndsAt === now + 3000`、`scheduler.pending()` 含 key `window:<qid>`；02 先讓 A 取得 2 分（第 1、2 題各自送出並 `scheduler.advance(3000)` 結算），第 3 題 A 在 t=0 送出、B 在 t=1000 送出，`advance` 到 3000 → B 為得主、A rank 2；03 同分，A t=0、B t=500 → A 為得主；04 結算後 C 送出 → rank 3、非得主；05 在 `clock.now() === windowEndsAt`、排程觸發前送出 → 列入候選（結算後有 orderKey 且依規則排序）；06 `seedRunning(t, { mode: 'fair', windowSec: 5 })` → `windowEndsAt === now + 5000`；07 A 先在第 3 題得分；第 4 題 A 先送、B 後送（皆在視窗內）→ 第 4 題 B 為得主（使用結算當下分數）；08 第 3、4 題的視窗同時到期，A、B 原本同分且都在兩題視窗內，A 在兩題都較早送出；**先送第 4 題、再送第 3 題**，使第 4 題先排程，以 `scheduler.advance(3000)` 觸發 → 依 `(windowEndsAt, 題號)` 結算：第 3 題 A（較早）→ 第 4 題 B（較低分）；另驗：不經排程、直接呼叫 `service.settleWindow(q4)` 時只結算第 4 題，第 3 題仍為 window（公開方法完全照 TECH_SPEC 演算法，research R-04）；09 對已結算的題目再呼叫 `service.settleWindow(qid)` → 送出紀錄不變、`broadcaster.calls.length` 不增加（`server/test/services/session.fair.test.ts`）
- [X] T020 [BE] [US5] 補完 `submit` 步驟 8b～8d，並實作 `settleWindow(questionId): void`，讓 T019 通過：
  - submit 8b：fair 且 `q.state === 'open'` → `orderKey = null`、`state = 'window'`、`windowEndsAt = now + windowSec * 1000`；以 `after` 在 COMMIT 後 `scheduler.schedule(\`window:${q.id}\`, windowEndsAt, () => this.onWindowDue(sessionId))`；private `onWindowDue(sessionId)`：取同活動中 `state === 'window'` 且 `windowEndsAt ≤ clock.now()` 的題目，依 `(windowEndsAt, number)` 排序後**逐題呼叫公開的 `settleWindow(qid)`**（落實 TECH_SPEC §7.9 註記「同時結束的多個視窗依 (windowEndsAt, number) 順序結算」，research R-04），整段以 try/catch 包住，例外時 `console.error('視窗結算失敗', sessionId, e)` 不重新丟出（research R-09）；8c：fair 且 `window` → `orderKey = null`（含 `now ≥ windowEndsAt` 但尚未觸發的情況，research R-05）；8d：fair 且 `settled` → `orderKey = nextOrderKey(...)`。
  - private `settleInTx(q: Question): boolean`：依 TECH_SPEC settleWindow 演算法步驟 2～7——`cands` = 該題 `status === 'active' && orderKey === null`；為空 → `state = 'open'`、`windowEndsAt = null`，回傳 true；否則 `scores = teamScores(全部組, 目前全部題目的送出依題目分組)` → `sortFairCandidates` → `assignOrderKeys(sorted, nextOrderKey(該題全部送出))` → 逐筆 `updateSubmission(id, { orderKey })` → `state = 'settled'`、`windowEndsAt = null`，回傳 true。
  - `settleWindow(qid)`：**完全照 TECH_SPEC settleWindow 演算法步驟 1～8**——交易內讀題目，`state !== 'window'` 直接 return（冪等，不 publish）；否則 `settleInTx(本題)`；COMMIT 後 `publish(sessionId)`。不結算其他題目。繁中註解說明「結算當下分數」與「依 (windowEndsAt, 題號) 順序」（`server/src/services/sessionService.ts`）

### end 結束前結算所有視窗

- [X] T021 [BE] [US2] [US5] 撰寫 UT-SVC-PHASE-03，執行並確認失敗：fair 模式第 3 題 A 送出開啟視窗，`clock.advance(1000)` 後 `end` → 第 3 題已結算且 A 為得主（`winnerTeamId === A`）、`scheduler.pending()` 為空、phase ENDED、`endedAt === clock.now()`、`broadcaster.calls` 只因 end 增加 1 次（`server/test/services/session.phase.test.ts`）
- [X] T022 [BE] [US2] [US5] 修改 `end`，讓 T021 通過且 UT-SVC-PHASE-04 仍通過：單一交易內 `assertPhase` → 取所有 `state === 'window'` 的題目依 `(windowEndsAt, number)` 排序，逐題 `settleInTx`（每題結算前重算 `teamScores`，前一題結果計入後一題，spec FR-023）→ phase ENDED、`endedAt = clock.now()`；COMMIT 後對每個原本在視窗中的題目 `scheduler.cancel(\`window:${qid}\`)`，最後只 `publish(sessionId)` 一次（research R-04）（`server/src/services/sessionService.ts`）

### withdraw

- [X] T023 [BE] [US6] 撰寫 UT-SVC-WD-01～06 與 UT-SVC-FAIR-10，執行並確認失敗：WD-01（speed）A 送出第 4 題，`clock.advance(5000)` 後撤回，再送出 → 原筆 `status === 'withdrawn'`、`withdrawnAt === clock.now()`；新筆 active，若題目已結算則 orderKey 大於所有既有 orderKey（排在已結算者之後）；02 送出在 T，`clock.set(T + 10000)` 撤回成功；另一筆在 `T + 10001` 撤回 → WITHDRAW_WINDOW_EXPIRED；03 B 組成員撤回 A 組的送出 → SUBMISSION_NOT_FOUND，送出不受影響；不存在的 id 也是 SUBMISSION_NOT_FOUND；04 撤回已撤回的送出 → INVALID_STATE；05（speed）A 為第 3 題得主、B 第 2 名，A 撤回 → B 為得主（`winnerTeamId === B`），`teams` 分數 A 0、B 1；06 ENDED 中撤回 → INVALID_PHASE。FAIR-10（fair）第 3 題視窗中只有 A，A 撤回 → 題目 `state === 'open'`、`windowEndsAt === null`、`scheduler.pending()` 不含 `window:<q3>`；之後 B 送出 → 重新開窗，`windowEndsAt === 該送出 serverTime + 3000`（`server/test/services/session.withdraw.test.ts`）
- [X] T024 [BE] [US6] 實作 `withdraw(memberToken, submissionId): void`（data-model §6、TECH_SPEC §7.9），讓 T023 通過：交易內 `resolveMember` → `assertPhase(phase, 'withdraw')` → `repo.getSubmission`，不存在**或** `teamId !== member.teamId` → SUBMISSION_NOT_FOUND（不透露他組送出是否存在）→ `status !== 'active'` → INVALID_STATE → `clock.now() - serverTime > WITHDRAW_LIMIT_MS` → WITHDRAW_WINDOW_EXPIRED（恰好 10000 允許）→ `updateSubmission(id, { status: 'withdrawn', withdrawnAt: now })` → 若題目 `state === 'window'` 且已沒有 `status === 'active' && orderKey === null` 的送出 → `state = 'open'`、`windowEndsAt = null`，並以 `after` 在 COMMIT 後 `scheduler.cancel(\`window:${qid}\`)` → COMMIT 後 `publish(sessionId)`。繁中註解說明「得主撤回後由 ranking 自動遞補」（`server/src/services/sessionService.ts`）

### recover 與啟動接線

- [X] T025 [BE] [US7] 撰寫 UT-SVC-RECOVER-01～03，執行並確認失敗。以 `makeTestService` 建立 fair 活動並送出（不觸發排程），再以**同一個 repo** 建新的 `SessionService`（新的 `ManualScheduler`、同一個 `FakeClock`、新的 `RecordingBroadcaster`）：01 `clock` 已超過 `windowEndsAt`，呼叫新 service 的 `recover()` → 該題立即結算（state settled、有得主）；02 `windowEndsAt` 尚未到 → 新 scheduler 的 `pending()` 含 `{ key: 'window:<qid>', at: windowEndsAt }`，`advanceTo(windowEndsAt)` 後結算；03 recover 前先在新 service 呼叫 `setOnline(memberId, true)`，recover 後 `getTeacherView` 所有成員 `online === false`（`server/test/services/session.recover.test.ts`）
- [X] T026 [BE] [US7] 實作 `recover(): void`（TECH_SPEC §7.12、research R-08），讓 T025 通過：清空記憶體上線集合；對 `repo.listSessionsByPhase('RUNNING')` 的每個活動，在單一交易內把 `state === 'window'` 且 `windowEndsAt ≤ clock.now()` 的題目依 `(windowEndsAt, number)` 逐題 `settleInTx`；COMMIT 後對其餘視窗題目 `scheduler.schedule(\`window:${qid}\`, windowEndsAt, () => this.onWindowDue(sessionId))`（同 T020）；有結算的活動 `publish(sessionId)`（`server/src/services/sessionService.ts`）
- [X] T027 [BE] [US7] 啟動恢復接線（TECH_SPEC §2「index.ts 負責 recover」、research D3／R-08）：(1) 建立 `recoverOnBoot(service: SessionService): void`（呼叫 `service.recover()`；失敗時 `console.error` 後重新丟出）；(2) `createApp` 內設定 `app.locals.service = service`，`app.ts` 另匯出 `serviceOf(app: Express): SessionService`（讀 `app.locals.service`，不存在時丟 Error）；`createApp` 的簽名與回傳 `{ app, httpServer, io }` 不變，**createApp 不呼叫 recover**；(3) `index.ts` 在 `httpServer.listen` 之前呼叫 `recoverOnBoot(serviceOf(app))`（需從 createApp 回傳值取出 `app`），並把檔頭註解「recover 由 003 加入」改為「listen 前以 boot/recover.ts 恢復搶答中的視窗」。覆蓋測試：IT-RESTART-01（T052）；本任務完成後先執行 001 的 IT（`auth.it.test.ts`、`online.it.test.ts`）確認不受影響（`server/src/boot/recover.ts`、`server/src/app.ts`、`server/src/index.ts`）

### HTTP 路由與推播範圍

- [X] T028 [BE] [US1] [US2] 在 `teacherRoutes` 新增（`requireTeacher` 之後）：`POST /sessions/:id/start`、`/end`、`/reset` → 依序呼叫 `service.start/end/reset(req.params.id)`，回 200 `TeacherView`。只做轉換，不寫業務規則。覆蓋測試：IT-SYNC-01、IT-CONC-01（T049、T051）、E2E-05、E2E-11（`server/src/http/teacherRoutes.ts`）
- [X] T029 [BE] [US1] [US4] [US6] 在 `playRoutes` 新增（`requireMember` 之後），zod 只取下列欄位、不讀任何客戶端時間：`PUT /drafts/:questionId` 本文 `z.object({ answers: z.array(z.string()) })` → `service.updateDraft(memberToken, req.params.questionId, answers)` → 204；`POST /submissions` 本文 `z.object({ questionId: z.string(), answers: z.array(z.string()) })` → `service.submit(...)` → 201 `{ submissionId, serverTime, withdrawableUntil }`；`POST /submissions/:id/withdraw` → `service.withdraw(memberToken, req.params.id)` → 204。zod 失敗由 001 的 errorHandler 轉為 422 INVALID_INPUT。覆蓋測試：IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-RT-01、IT-CONC-01（T049、T051）（`server/src/http/playRoutes.ts`）
- [X] T030 [BE] 核對推播範圍（TECH_SPEC §9.3、research R-12）：在 `sessionService.ts` 確認 start、end、reset、submit、withdraw、settleWindow（有變化）、recover（有結算）都呼叫 `publish(sessionId)`（老師＋全部組），只有 updateDraft 使用 `{ teacher: false, teamIds: [teamId] }`，且所有 publish 都在 COMMIT 之後；不符者修正。覆蓋測試：UT-SVC-DRAFT-05、UT-SVC-PHASE-02、03、UT-SVC-FAIR-09（`server/src/services/sessionService.ts`）
- [ ] T031 [BE] **Phase 2C 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試）；執行 `npm run test:coverage` 確認 `server/src/services/**` 行 ≥ 90%、分支 ≥ 85%，`server/src/domain/**` 95%／90%；依憲章原則 11 比對程式碼與 `diagrams/003-class.puml`（`SessionService` 8 個方法、`recover <<boot/recover>>` 的 `recoverOnBoot`、Scheduler／Broadcaster 依賴）、`diagrams/003-component.puml`（HTTP 路由 6 條、Recover → Svc、Svc → Sched 的 schedule／cancel）、`diagrams/003-sequence.puml`「二、公平模式」「三、撤回後遞補」的步驟順序，不一致時修正（`server/src/`、`diagrams/003-*.puml`）

**Checkpoint**：後端全部完成；Phase 4 的 IT 可以開始；E2E 需等 Phase 3

---

## Phase 3: 前端 [FE] — format、useServerClock、hooks、ControlBar、StatusGrid、AnswerCard、Play

**Purpose**：老師控制列與即時狀態表、學生作答卡與搶答畫面（spec US1、US2、US4、US6、US7 的畫面）。**需 001 Phase 3 與 002 Phase 3 完成**。

### format.ts 與 useServerClock

- [X] T032 [P] [FE] [US2] 撰寫 UT-UI-FMT-01、02，執行並確認失敗：01 `formatTime(0) === '08:00:00.000'`，另驗 `formatClock(0) === '08:00:00'`；02 `formatAnswers(['CPU','作業系統'], ['（1）','（2）']) === '（1）CPU／（2）作業系統'`，另驗單題 `formatAnswers(['0'], ['']) === '0'`（`client/test/format.test.ts`）
- [X] T033 [FE] [US2] 實作 `formatTime(ms)`（`HH:mm:ss.SSS`）、`formatClock(ms)`（`HH:mm:ss`）：以 `new Date(ms + 8 * 3600_000)` 的 UTC 欄位補零組字串（Asia/Taipei 無日光節約，不依賴 Intl 時區，research R-10）；`formatAnswers(answers, subLabels)`：單題（`subLabels` 為 `['']` 或長度 1）回傳 `answers[0]`，題組以「／」連接 `${subLabels[i]}${answers[i]}`。讓 T032 通過（`client/src/format.ts`）
- [X] T034 [P] [FE] 撰寫 UT-UI-CLOCK-01，執行並確認失敗：`vi.useFakeTimers()`、`vi.setSystemTime(1_000_000)`，`renderHook(() => useServerClock(1_002_000))`，回傳函式的結果 ≈ `Date.now() + 2000`（誤差 ≤ 5 ms）；`vi.advanceTimersByTime(500)` 後仍為 `Date.now() + 2000`（`client/test/useServerClock.test.tsx`）
- [X] T035 [FE] 實作 `useServerClock(serverNow): () => number`（每次 `serverNow` 改變時以 `serverNow - Date.now()` 重算 offset 存在 ref；`undefined` 時 offset 0；回傳穩定函式 `() => Date.now() + offset`）與 `useTick(intervalMs): void`（`setInterval` 觸發 state 更新以重新渲染，卸載時清除），讓 T034 通過（`client/src/hooks/useServerClock.ts`）

### hooks：useTeacher start/end/reset、usePlay setDraft/submit/withdraw

- [X] T036 [FE] [US4] 撰寫 UT-UI-CARD-03，執行並確認失敗：`vi.mock('../../src/api')`、`vi.useFakeTimers()`；建立測試用 harness 元件，以 `usePlay()` 的 `view`（mock socket 推送 RUNNING 的 TeamView）與 `setDraft` 渲染第 3 題 `AnswerCard`；在 `answer-input-3-1` 連續輸入「0」「1」「2」，`vi.advanceTimersByTime(299)` 時 `api.putDraft` 未被呼叫，`advanceTimersByTime(1)` 後恰好被呼叫 1 次，參數為 `(token, q3Id, ['012'])`；另驗：輸入後 500 ms 內 mock socket 推送 `drafts[q3] = ['x']` 的快照，輸入框仍為 `012`（spec FR-017），1 秒後再推送則改為 `x`（`client/test/components/AnswerCard.test.tsx`）
- [X] T037 [FE] 在 `api.ts` 新增（沿用 001 的 `request()`，型別從 `@quiz/shared` 匯入）：`start(token, sessionId)`、`end(token, sessionId)`、`reset(token, sessionId)` → `POST /api/teacher/sessions/:id/{start,end,reset}`，回傳 `TeacherView`；`putDraft(token, questionId, answers)` → `PUT /api/play/drafts/:questionId`；`submit(token, questionId, answers)` → `POST /api/play/submissions`，回傳 `{ submissionId, serverTime, withdrawableUntil }`；`withdraw(token, submissionId)` → `POST /api/play/submissions/:id/withdraw`。覆蓋測試：T036、E2E-04～11（`client/src/api.ts`）
- [X] T038 [FE] [US1] [US2] [US4] [US6] 在 hooks 新增（TECH_SPEC §10.3），讓 T036 通過：
  - `useTeacher`：`start()`、`end()`、`reset()`，與 001 的 `createSession` 相同的 `busy`／`error` 處理；成功後以回傳的 `TeacherView` 更新 `view`（之後仍以 socket 快照為準）。
  - `usePlay`：`setDraft(questionId, answers)` 立即更新本地 `localDrafts[qid]`、記錄 `lastInputAt[qid] = Date.now()`，每題各自 300 ms（`DRAFT_DEBOUNCE_MS`）debounce 後呼叫 `api.putDraft`；收到 `team:state` 時，`Date.now() - lastInputAt[qid] < 1000` 的題目保留本地值，其餘以 `view.drafts[qid].answers` 取代；快照沒有草稿時，若 `mySubmissions[qid]?.status === 'withdrawn'` 以撤回的答案為初始值，否則為 `subCount` 個空字串（research R-11）；`submit(qid)` 先取消該題 debounce，以本地目前內容呼叫 `api.submit`；`withdraw(submissionId)` 呼叫 `api.withdraw`；API 錯誤寫入 `error`（顯示於 001 的 ErrorBanner）。**不新增任何回傳欄位**：`usePlay()` 只回傳 TECH_SPEC §10.3 的 `view`、`me`、`error`、`setDraft`、`submit`、`withdraw`（憲章原則 IX）；上述規則決定的本地內容直接合併進回傳的 `view.drafts[qid] = { answers, updatedBy, updatedAt }`（本地輸入時 `updatedBy = me.id`、`updatedAt = Date.now()`；快照沒有草稿且 withdrawn 時填入撤回的答案），AnswerCard 一律從 `view.drafts[qid]?.answers` 讀取（research R-11）。
  
  覆蓋測試：T036、E2E-05、06、09（`client/src/hooks/useTeacher.ts`、`client/src/hooks/usePlay.ts`）

### ControlBar

- [X] T039 [P] [FE] [US2] 撰寫 UT-UI-CTRL-01，執行並確認失敗：分別以 phase READY、RUNNING、ENDED 渲染 `ControlBar`（props：`phase`、`busy=false`、`onStart`、`onEnd`、`onReset`）→ READY 只有 `btn-start` enabled；RUNNING 只有 `btn-end`；ENDED 只有 `btn-reset`；另驗 SETUP 三顆都 disabled、點擊 enabled 的按鈕立即呼叫對應 callback 一次（沒有確認步驟，research D1）（`client/test/components/ControlBar.test.tsx`）
- [X] T040 [FE] [US2] 實作 `ControlBar`：三顆按鈕 `data-testid` 為 `btn-start`（「開始搶答」）、`btn-end`（「結束搶答」）、`btn-reset`（「重新開始一輪」）；依 phase 只有對應的一顆 enabled，SETUP 或 `busy` 時全部 disabled；按下即呼叫 callback。讓 T039 通過（`client/src/components/ControlBar.tsx`）

### StatusGrid

- [X] T041 [P] [FE] [US2] 撰寫 UT-UI-GRID-01、02，執行並確認失敗。以手動建構的 `TeacherView`（範例 A 4 題、3 組）渲染 `StatusGrid`（props：`view`、`now: () => number`）：01 5 種格子分別顯示 `—`（無送出）、`#2`（active、rank 2、非得主，並含答案、送出者與 `formatTime` 時間）、`★ 得主`（active、isWinner）、`已撤回`（withdrawn）、`✗ 判錯`（rejected），各以 `status-cell-{qNumber}-{teamIndex}` 選取；另驗 rank 為 null 的 active 格顯示 `判定中`、題組答案為「（1）CPU／（2）作業系統」；02 第 2 題 `state: 'window'`、`windowEndsAt = now + 1800` → `question-state-2` 含「判定中」與「1.8 s」；非 window 的題目不顯示倒數（`client/test/components/StatusGrid.test.tsx`）
- [X] T042 [FE] [US2] 實作 `StatusGrid`（TECH_SPEC §10.4 StatusCell 規則）：表格 `data-testid="status-grid"`；欄為題目（題號升冪），欄標題含 `question-state-{qNumber}`，`state === 'window'` 時顯示 `判定中 ${(Math.max(0, windowEndsAt - now()) / 1000).toFixed(1)} s`（`useTick(100)` 刷新）；列為組別；格子 `status-cell-{qNumber}-{teamIndex}`：無送出 `—`；active → `formatAnswers`、送出者、`formatTime(serverTime)`、`rank === null ? '判定中' : \`#${rank}\``，得主加 `★ 得主` 並套強調樣式；withdrawn → `已撤回`（灰字）；rejected → `✗ 判錯`（刪除線）。讓 T041 通過（`client/src/components/StatusGrid.tsx`）

### AnswerCard（rejected 以外）

- [X] T043 [FE] [US1] [US6] （依賴 T036：同檔 `AnswerCard.test.tsx`，不可平行）在既有檔案補 UT-UI-CARD-01、02、04、05，執行並確認失敗（props 渲染，`vi.useFakeTimers()`）：01 phase READY → 所有 `answer-input-*` 與 `btn-submit-*` disabled，placeholder 為「等待老師開始」；02 RUNNING、第 1 題（題組）只填（1）→ `btn-submit-1` disabled，填（2）後 enabled；只填空白也視為空；04 active、`withdrawableUntil - now = 7000` → `withdraw-countdown-n` 顯示「撤回（7 秒）」，剩 6300 ms 顯示「撤回（7 秒）」、剩 200 ms 顯示「撤回（1 秒）」（無條件進位，spec FR-029），時間到 0 時 `btn-withdraw-n` 消失，只剩 `submitted-n`「已送出 HH:mm:ss」；05 withdrawn → 輸入框可編輯且值為原答案，`btn-submit-n` 出現（`client/test/components/AnswerCard.test.tsx`）
- [X] T044 [FE] [US1] [US6] 實作 `AnswerCard`（TECH_SPEC §10.4 狀態表 rejected 以外的列；props：`question: QuestionInfo`、`phase`、`answers: string[]`、`mySubmission`、`now: () => number`、`onChange(answers)`、`onSubmit()`、`onWithdraw(id)`）：容器 `answer-card-{n}`；每子題一個輸入框 `answer-input-{n}-{subNo}`，題組顯示子題標籤；`phase !== 'RUNNING'` → 輸入 disabled、placeholder「等待老師開始」、送出 disabled；RUNNING 未送出或 withdrawn → 可編輯，`btn-submit-{n}`（「送出第 n 題」）在任一格 trim 後為空時 disabled；active → 輸入 disabled 顯示已送出答案，`submitted-{n}` 顯示「已送出 {formatClock(serverTime)}」，剩餘 `withdrawableUntil - now() > 0` 時顯示 `btn-withdraw-{n}`，內含 `withdraw-countdown-{n}`「撤回（{Math.ceil(剩餘 / 1000)} 秒）」（`useTick(250)` 刷新），`≤ 0` 時不渲染。不顯示得主、順位或分數（FR-10）。讓 T043、T036 通過（`client/src/components/AnswerCard.tsx`）

### 頁面組裝

- [X] T045 [FE] [US2] 在 `TeacherDashboard` 組裝：READY／RUNNING／ENDED 顯示 `ControlBar`（`onStart/onEnd/onReset` 接 `useTeacher` 的 start／end／reset，`busy` 接 `useTeacher.busy`）；RUNNING、ENDED 顯示 `StatusGrid`（`now` 用 `useServerClock(view.serverNow)`）；ResultsTable 屬 004 不加入。覆蓋測試：E2E-05、07、09、11（`client/src/pages/TeacherDashboard.tsx`）
- [X] T046 [FE] [US1] [US4] [US6] [US7] 在 `Play` 組裝搶答畫面：保留 001 的 TeamHeader 與 PhaseBadge；依 `view.questions`（題號升冪）渲染 `AnswerCard`，`answers` 取 `view.drafts[qid]?.answers ?? Array(subCount).fill('')`（usePlay 已合併本地草稿與 withdrawn 初始值，不使用 TECH_SPEC 以外的欄位）、`mySubmission` 取 `view.mySubmissions[qid]`、`now` 用 `useServerClock(view.serverNow)`，`onChange` → `setDraft`、`onSubmit` → `submit(qid)`、`onWithdraw` → `withdraw(id)`；ENDED 時暫時沿用停用狀態的 AnswerCard（StudentResults 屬 004）。覆蓋測試：E2E-04、06、08、09、10（`client/src/pages/Play.tsx`）
- [ ] T047 [FE] **Phase 3 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試）；依憲章原則 11 比對程式碼與 `diagrams/003-component.puml` 的瀏覽器端組件（TeacherDashboard、ControlBar、StatusGrid、useTeacher、format.ts、useServerClock、Play、AnswerCard、usePlay）及其依賴方向（Grid → format／clock、Card → usePlay／clock、hooks → HTTP），以及所有 `data-testid` 與 TECH_SPEC §10.4 逐字相同、沒有新增，不一致時修正（`client/src/`、`diagrams/003-*.puml`）

**Checkpoint**：前端完成，E2E 可開始

---

## Phase 4: 整合與 E2E [QA]

**Purpose**：以真實 HTTP + Socket.IO 與瀏覽器驗證跨層行為（TEST_SPEC §6、§7）。IT 只需 Phase 2C；E2E 需 Phase 3 與 001 的 Phase 4。

### 整合測試基礎

- [ ] T048 [QA] 擴充 `startApp(opts?)`，向下相容（不帶參數時行為與現在相同，001 的 IT 不需修改）：`opts.snapshots`（預設改為載入 `fixture-template-a`、`fixture-template-b`，用 `server/test/helpers/fixtures.ts` 的 `loadSnapshot`）、`opts.realTime`（true 時使用 `systemClock` 與 `timerScheduler(systemClock)`，供 IT-CONC-01、IT-PERF-01）、`opts.dbPath`（預設 `':memory:'`，IT-RESTART-01 用暫存檔）、`opts.clock`（共用 FakeClock）；回傳值增加 `clock`、`scheduler`。另建 `flow.ts` 提供 `login`、`createAndImport({ mode, windowSec, teamCount })`、`joinMembers(roomCode, perTeam)`、`startQuiz`、`endQuiz`、`resetQuiz`、`submit(token, qid, answers)` 等以 `fetch` 呼叫 REST 的 helper（`server/test/integration/startApp.ts`、`server/test/integration/flow.ts`）

### 整合測試

- [ ] T049 [P] [QA] [US1] [US3] [US4] 撰寫並執行 IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01：PHASE-01 READY 中 `POST /api/play/submissions` → 409、本文 `error.code === 'INVALID_PHASE'`；VAL-01 RUNNING 中 `POST /submissions` 本文缺 answers → 422 INVALID_INPUT；VIS-01 A、B 兩組 socket 與老師 socket，A 送出第 3 題 `SECRET-A-123`、A 對第 4 題 PUT 草稿 `SECRET-DRAFT-A`，記錄 B 在 end 之前收到的所有 `team:state` → 序列化後不含這兩個字串、A 的 member id、A 的 submission id；老師收到含 `SECRET-A-123` 的 `teacher:state`；SYNC-01 5 個學生 socket + 老師，start、end 後每個 socket 都收到新 phase 的狀態；RT-01 A 送出後老師 socket 在 500 ms 內收到含該送出的 `teacher:state`（`server/test/integration/live.it.test.ts`）
- [ ] T050 [P] [QA] [US7] 撰寫並執行 IT-RECON-01、02：01 成員送出第 3 題並 PUT 第 2 題草稿後關閉 socket，以同 token 重連 → 立即收到 `team:state`，含先前草稿與送出（`withdrawableUntil` 依原送出時間）；在同一個 IT-RECON-01 案例中另驗 spec 邊界情況「搶答中有新成員加入」：同組新成員於 RUNNING 中 `join` 並連線 → 第一個 `team:state` 即含本組既有草稿與送出；02 斷線期間老師 `end`，重連後收到的 `team:state.session.phase === 'ENDED'`（`server/test/integration/recon.it.test.ts`）
- [ ] T051 [P] [QA] [US1] 撰寫並執行 IT-CONC-01（`startApp({ realTime: true })`）：20 組各 1 名成員，對同一題以 `Promise.all` 同時 `POST /api/play/submissions`；重複 50 輪（每輪 `end` → `reset` → `start`）→ 每輪恰 1 位得主、其餘 19 筆 rank 2..20 不重複、所有回應皆非 500（`server/test/integration/concurrency.it.test.ts`）
- [ ] T052 [P] [QA] [US7] 撰寫並執行 IT-RESTART-01：在 scratchpad 或 `os.tmpdir()` 建暫存 DB 檔，`startApp({ dbPath, clock })`（fair 模式），送出一題後關閉 app；`clock.advance(5000)` 後以同 DB、同 clock 再 `startApp`，並呼叫 `recoverOnBoot(serviceOf(app))`（與 `index.ts` 相同的啟動流程，`server/src/boot/recover.ts`、`server/src/app.ts`）→ recover 後該題已結算，`GET /api/teacher/sessions/:id` 的 view 顯示得主；測試結束刪除暫存檔（`server/test/integration/restart.it.test.ts`）
- [ ] T053 [P] [QA] [US2] 撰寫並執行 IT-PERF-01（`startApp({ realTime: true })`）：10 組 × 4 個學生 socket＋老師 socket，連續 20 次送出（不同組／題目），每次量測「POST 送出」到老師收到含該送出的 `teacher:state` 的時間 → p95 < 500 ms（`server/test/integration/perf.it.test.ts`）

### E2E（需 Phase 3 與 001 Phase 4）

- [ ] T054 [QA] 撰寫並執行 E2E-04～11（TEST_SPEC §7；`test.describe.serial`，每位使用者獨立 `browser.newContext()`，只用 `data-testid` 選取，每個案例結束截圖 `e2e/artifacts/<ID>.png`；開始前 `POST /api/dev/fake-sheets/fixture-template-a/reset`）。前置：老師登入、建立活動（3 組；判定模式與視窗秒數使用 TECH_SPEC §3.3 預設值「公平模式、3 秒」，整個 spec 都不改設定，對應 TEST_SPEC E2E-11「設定維持公平模式 3 秒」）、匯入 `fixture-template-a`（E2E-07、09 的老師格子在視窗結算前會先顯示答案與「判定中」，斷言只檢查答案文字與「已撤回」）；學生：第 1 組 X、Y，第 2 組 1 人，第 3 組 1 人。04 開始前所有 `answer-input-*` disabled，`page.request` 直接 POST 送出 → 409；05 老師按 `btn-start`，4 個學生頁的 `phase-badge` 1 秒內變「搶答中」；06 X 在 `answer-input-3-1` 輸入「0」→ 1 秒內出現在 Y 的輸入框，第 2 組頁面沒有該字串；07 第 1 組送出第 3 題 → 老師 `status-cell-3-1` 顯示答案，第 2 組頁面全文不含第 1 組答案與暱稱；08 第 2 組第 1 題只填（1）→ `btn-submit-1` disabled，填（2）後送出、出現 `submitted-1`；09 第 3 組送出第 4 題，3 秒內出現 `withdraw-countdown-4` 並按 `btn-withdraw-4`，輸入可編輯後修改再送出 → 老師看到「已撤回」後改為新送出；10 Y 重新整理 → `my-nickname` 相同、`submitted-3` 仍在；11 老師按 `btn-end` → `btn-reset` → （維持公平模式 3 秒）`btn-start`，第 1 組先送第 3 題取得 1 分（等視窗結算），第 4 題第 1 組先送、第 2 組 1 秒後送 → `question-state-4` 顯示「判定中」，約 3 秒後 `status-cell-4-2` 顯示 `★ 得主`（`e2e/tests/live-quiz.spec.ts`）

### 文件與收尾

- [ ] T055 [QA] 更新 `README.md` 的「功能清單」（開始／結束／重新開始、組內共編、純速度與公平模式、撤回、斷線重連與重啟恢復）與「如何執行」（示範：老師開始後以多個瀏覽器視窗模擬多組；公平模式視窗秒數設定），依 TECH_SPEC §0 第 8 點（`README.md`）
- [ ] T056 [QA] **Phase 4 驗收**：執行 `npm test` 與 `npm run lint` 全部通過（含 001、002 的測試），再執行 `npm run test:coverage`（TEST_SPEC §2.3 門檻）與 `npm run test:e2e`（E2E-01～11、18 全部通過）；確認 TECH_SPEC §14.1 003 列的每個測試 ID 都有實作且無 `it.skip`／`test.fixme`；依 quickstart.md §2、§3 走一遍；依憲章原則 11 逐項比對程式碼與 `diagrams/003-component.puml`（組件與依賴）、`diagrams/003-class.puml`（類別、公開方法、關聯）、`diagrams/003-sequence.puml`（三段互動順序），不一致時先修正並重新產生 PNG（`java -jar plantuml.jar "./diagrams/*.puml"`）（`diagrams/003-*.puml`、`server/`、`client/`）

---

## Dependencies & Execution Order

### Phase 依賴

| Phase | 依賴 | 阻擋 |
| --- | --- | --- |
| 1 Setup | 001、002 後端完成（已完成） | 2A |
| 2A domain | 1 | 2B |
| 2B service 純速度 | 2A | 2C |
| 2C service 公平／撤回／重啟／路由 | 2B | 4 的 IT；3 的 E2E 驗證 |
| 3 前端 | 001 Phase 3、002 Phase 3；可與 2B／2C 平行開發（只依 `@quiz/shared` 型別），但 hooks 實測需 2C 的路由 | 4 的 E2E |
| 4 整合與 E2E | IT：2C；E2E：3 與 001 Phase 4 | — |

### Phase 內依賴

- 2A：T002 → T003；T004 → T005；T006 → T007（T007 使用 T003 的 ranking）；T002、T004 可平行。
- 2B：T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017（全在 `sessionService.ts` 或依賴 seed，依序執行）。
- 2C：T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027；T028、T029 可在 T024 後進行（不同檔案）；T030 在 T026 後。
- 3：T032 → T033；T034 → T035；T036 → T037 → T038；T039 → T040；T041 → T042；T036 → T043 → T044（T043 與 T036 同檔，序列執行；T044 也要讓 T036 通過，需 T038）；T045 需 T040、T042；T046 需 T038、T044。
- 4：T048 → T049～T053（T049～T053 為不同檔案，可平行）→ T054 → T055 → T056。

## Parallel Example

```text
# Phase 2A：兩個純函式模組的測試同時撰寫
T002 server/test/domain/ranking.test.ts
T004 server/test/domain/settlement.test.ts

# Phase 3：互不相依的測試同時撰寫
T032 client/test/format.test.ts
T034 client/test/useServerClock.test.tsx
T039 client/test/components/ControlBar.test.tsx
T041 client/test/components/StatusGrid.test.tsx

# Phase 4：T048 完成後，各 IT 檔同時進行
T051 concurrency.it.test.ts、T052 restart.it.test.ts、T053 perf.it.test.ts

# 跨 Phase：[FE] 成員在 001／002 前端完成後即可開始 Phase 3，與 [BE] 的 2B／2C 平行
```

## Implementation Strategy

- **MVP（US1＋US2＋US3，純速度）**：完成 Phase 1、2A、2B，再加 2C 的路由（T028、T029）與 Phase 3 的 ControlBar、StatusGrid、AnswerCard，即可以純速度模式完成「開始 → 送出 → 老師即時看到得主 → 結束 → 重新開始」，且學生看不到他組資訊。
- **增量**：再完成公平模式（US5，T019～T022）→ 撤回（US6，T023～T024）→ 重啟恢復（US7，T025～T027）→ 共編草稿畫面（US4，T036、T038）→ Phase 4 全部驗證。
- **團隊並行**：[BE] 負責 2A～2C；[FE] 在 001／002 前端完成後做 Phase 3；[QA] 在 2C 完成後做 IT（T048～T053），Phase 3 完成後做 E2E（T054）。

## 追溯表

| User Story | 任務 | 測試 ID |
| --- | --- | --- |
| US1 開始、送出、純速度判定（P1） | T002、T003、T011、T012、T016、T017、T028、T029、T038、T043、T044、T046、T049、T051、T054 | UT-RANK-01～09、UT-SVC-PHASE-01、02、UT-SVC-SUB-01～10、UT-UI-CARD-01、02、IT-PHASE-01、IT-VAL-01、IT-CONC-01、E2E-04、05、07、08 |
| US2 老師狀態表、結束、重新開始（P1） | T006、T007、T011、T012、T021、T022、T028、T032、T033、T038～T042、T045、T049、T053、T054 | UT-PROJ-02、03、08、UT-SVC-PHASE-03～05、UT-UI-FMT-01、02、UT-UI-CTRL-01、UT-UI-GRID-01、02、IT-SYNC-01、IT-RT-01、IT-PERF-01、E2E-05、07、11 |
| US3 資訊隔離（P1） | T006、T007、T049、T054 | UT-PROJ-04～06、IT-VIS-01、E2E-07 |
| US4 組內共編草稿（P2） | T014、T015、T016、T029、T036、T038、T046、T049、T054 | UT-SVC-DRAFT-01～06、UT-UI-CARD-03、E2E-06 |
| US5 公平模式（P2） | T004、T005、T019～T022、T054 | UT-SETTLE-01～06、UT-SVC-FAIR-01～09、UT-SVC-PHASE-03、E2E-11 |
| US6 撤回與重送（P2） | T023、T024、T029、T038、T043、T044、T046、T054 | UT-SVC-WD-01～06、UT-SVC-FAIR-10、UT-PROJ-07、UT-UI-CARD-04、05、E2E-09 |
| US7 重連與重啟（P3） | T025～T027、T046、T050、T052、T054 | UT-SVC-RECOVER-01～03、IT-RECON-01、02、IT-RESTART-01、E2E-10 |
| 基礎（repo、seed、時鐘） | T009、T010、T013、T034、T035、T037、T048 | UT-REPO-02～06、UT-UI-CLOCK-01 |

**§14.1 003 列測試 ID 覆蓋檢查**：UT-RANK（T002）、UT-SETTLE（T004）、UT-PROJ-02～08（T006）、UT-REPO-02～06（T009）、UT-SVC-PHASE-01、02、04、05（T011）、UT-SVC-PHASE-03（T021）、UT-SVC-DRAFT-01～05（T014）、UT-SVC-DRAFT-06（T016）、UT-SVC-SUB-01～10（T016）、UT-SVC-FAIR-01～09（T019）、UT-SVC-FAIR-10（T023）、UT-SVC-WD-01～06（T023）、UT-SVC-RECOVER-01～03（T025）、UT-UI-FMT-01、02（T032）、UT-UI-CLOCK-01（T034）、UT-UI-CTRL-01（T039）、UT-UI-GRID-01、02（T041）、UT-UI-CARD-01、02、04、05（T043）、UT-UI-CARD-03（T036）、IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01（T049）、IT-RECON-01～02（T050）、IT-CONC-01（T051）、IT-RESTART-01（T052）、IT-PERF-01（T053）、E2E-04～11（T054）——全部涵蓋。
