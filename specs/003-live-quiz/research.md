# Research：搶答進行（003-live-quiz）

**日期**：2026-11-24　**依據**：`docs/TECH_SPEC.md` v1.6、`docs/TEST_SPEC.md` v1.3、`docs/PRD.md` v1.2

Technical Context 沒有 NEEDS CLARIFICATION。技術選擇沿用 001 的 plan，不新增任何執行期相依套件（也就沒有 `.node` 原生模組）。以下記錄契約差異的處理，以及 TECH_SPEC 沒寫死、需要在 plan 決定的實作做法。

## 契約差異

| # | 差異 | 決議（2026-11-24） |
| --- | --- | --- |
| D1 | spec clarify 新增的 FR-006a（結束／重新開始前要在頁面內確認）需要 TECH_SPEC §10.4 沒有的 `data-testid`，也與 TEST_SPEC E2E-11、12、17「按 `btn-end`／`btn-reset` 立即生效」衝突 | 使用者選擇**撤回 FR-006a**：三個控制按鈕都是按下即執行；spec 的 Clarifications、FR-006、US2 情境已改回。docs 不變 |
| D2 | 類別圖 `Repo` 的方法名稱標註「示意，以 plan 為準」，且把 `loadAggregate` 畫在 Repo；實際程式（001／002）的 `loadAggregate` 在 `SessionService` | 依憲章原則 XI 先改圖：Repo 方法改為 data-model §4 的名稱，`loadAggregate` 移到 SessionService；PNG 已重新產生 |
| D3 | TECH_SPEC §2 只寫 `index.ts` 負責「recover」，但 `createApp` 依契約只回傳 `{ app, httpServer, io }`，`index.ts` 與 IT-RESTART-01（「以同 DB 重建 app」）都拿不到 service | （2026-11-24 analyze I3 修正，依 TECH_SPEC §2「index.ts 負責 recover」）不改 `createApp` 的簽名與回傳型別：`createApp` 把 service 存在 `app.locals.service`，`app.ts` 另匯出型別化的 `serviceOf(app): SessionService`；`index.ts` 在 `listen` 前呼叫 `recoverOnBoot(serviceOf(app))`；IT-RESTART-01 重建 app 後以同樣方式呼叫。見 R-08。組件圖、類別圖已標註並重新產生 PNG |

沒有其他與 TECH_SPEC 衝突之處：三張 003 圖的組件、方法簽名、互動順序都和 §7.6～§7.9、§9、§10.4、§12.3～§12.5 一致。

## R-01 單一同步交易與「交易後副作用」

- **Decision**：`submit`、`withdraw`、`settleWindow`、`start`、`end`、`reset`、`updateDraft` 的資料庫讀寫，全部包在 `withTransaction(db, fn)` 裡，並在**同一個同步函式**中完成（中間沒有 `await`）。排程（`scheduler.schedule`／`cancel`）與 `broadcaster.publish` 先記在本次呼叫的待辦清單，**交易 COMMIT 成功後**才執行；交易丟出例外時清單直接丟棄。
- **Rationale**：Node 單執行緒，加上 `DatabaseSync` 是同步 API，兩筆送出不可能交錯執行，所以同一題不會有兩位得主（FR-019、IT-CONC-01）。如果在交易內就排程，而後續的 insert 撞到唯一索引被 ROLLBACK，會留下一個不存在的視窗計時。雖然 `settleWindow` 是冪等的，這仍是多餘的副作用；推播也必須讀到已提交的資料。
- **Alternatives**：在交易內直接呼叫 scheduler（ROLLBACK 時會殘留計時，不採用）；用 async 鎖（沒有必要，同步交易已足夠）。

## R-02 `seq` 的取得（UT-REPO-06）

- **Decision**：`repo.nextSeq()` 回傳 `max(記憶體中上次發出的值, SELECT COALESCE(MAX(seq),0)) + 1`，並更新記憶體值；只在交易內呼叫。
- **Rationale**：TECH_SPEC §5 寫的是「交易內 `SELECT COALESCE(MAX(seq),0)+1`」，但 UT-REPO-06 要求「連續取 seq 嚴格遞增」，而連續呼叫之間不一定有插入。加上記憶體值後，就算 ROLLBACK 或 reset 刪除送出，序號也只會出現空號，不會重複，仍符合「全域遞增」。重啟後記憶體值歸零，會改從資料庫 MAX 接續。
- **Alternatives**：另建 `counters` 資料表（要改 §5 schema，不採用）；直接用 MAX+1（UT-REPO-06 會失敗）。

## R-03 唯一索引衝突轉成 ALREADY_SUBMITTED（UT-REPO-03）

- **Decision**：`repo.insertSubmission` 捕捉 `node:sqlite` 的 constraint 錯誤（訊息含 `UNIQUE constraint failed: submissions.team_id, submissions.question_id`），改丟 `AppError('ALREADY_SUBMITTED')`；其他錯誤原樣丟出。
- **Rationale**：`submit` 的步驟 6 已先檢查一次；索引是 TECH_SPEC §13 指定的最後防線。

## R-04 `end` 的逐題結算

- **Decision**：`SessionService` 的 private 方法 `settleInTx(q, scores)` 只做結算的資料變更（TECH_SPEC settleWindow 演算法步驟 2～7），回傳是否有變化。公開的 `settleWindow(qid)` 是「交易 + `settleInTx` + 有變化才 publish」。`end` 在**單一交易**內，把所有 `state='window'` 的題目依 `(windowEndsAt, number)` 排序，逐題 `settleInTx`（每題結算前重新計算 `teamScores`），然後把 phase 設為 ENDED、endedAt 設為 now；COMMIT 後 `scheduler.cancel` 每個 `window:<qid>`，最後只 publish 一次。
- **Rationale**：結束搶答時，畫面要直接看到「已結束＋完整結果」，不應先閃過幾次中間狀態（spec US2 情境 9）。UT-SVC-PHASE-03 要求 `pending()` 為空，且有得主。前一題結果要計入後一題（FR-023），所以每題結算前重算分數。
- **同時到期**（2026-11-24 analyze I2 修正）：公開的 `settleWindow(qid)` **完全照 TECH_SPEC 演算法**，只結算指定題目。`ManualScheduler`／`timerScheduler` 對同一個 `at` 依「排程先後」觸發，不一定依題號；為了落實 TECH_SPEC §7.9 的註記「同時結束的多個視窗依 `(windowEndsAt, number)` 順序結算」（FR-023、UT-SVC-FAIR-08），service 交給 scheduler 的回呼是 private `onWindowDue(sessionId)`：取同活動中 `state === 'window'` 且 `windowEndsAt ≤ clock.now()` 的題目，依 `(windowEndsAt, number)` 排序後**逐題呼叫公開的 `settleWindow`**。之後輪到的其他回呼發現題目已不是 window，依步驟 1 直接返回（冪等）。這樣不改任何公開方法的語意，Complexity Tracking 不需要例外。

## R-05 `settleWindow` 沒有候選時

- **Decision**：依 TECH_SPEC 步驟 3：題目改回 `open`、`windowEndsAt=null`，並 publish（spec FR-025、「視窗結算時沒有候選」）。
- **補充**：若在 `windowEndsAt` 之後、計時還沒觸發前收到送出（事件迴圈延遲），因為題目仍是 `window`，依 TECH_SPEC submit 步驟 8c 列入候選；spec FR-021 規定的「恰等於到期時間」是其中一種情況（UT-SVC-FAIR-05）。

## R-06 得主撤回後沒有遞補者（公平模式）

- **Decision**：題目維持 `settled`；下一筆送出走 submit 步驟 8d，取得 `nextOrderKey`。因為前面已沒有 active 的送出，`winnerOf` 會直接把它算成得主（spec 邊界情況「得主撤回」；clarify 時已依 TECH_SPEC 修正措辭）。不需要額外寫程式。

## R-07 衍生值與視圖欄位

- **Decision**：
  - `TeacherCell.submission.rank`：`orderKey === null` 時為 `null`（畫面顯示「判定中」），否則取 `rankSubmissions` 的 rank。`withdrawn` 的送出 rank 一律 `null`、`isWinner=false`。
  - `submittedBy`（TeacherCell、mySubmissions、Results）＝送出成員的**暱稱**。`Draft.updatedBy`＝成員 **id**（只會出現在本組 TeamView）。
  - `TeacherView.teams[].score`、`questions[].winnerTeamId`、`Results.scores` 都由 `teamScores`／`winnerOf` 即時推導，不存入資料庫（使用者約束）。
  - `projectTeamView`：`drafts`、`mySubmissions` 只取本組；`mySubmissions` 的值只有 `{ id, answers, submittedBy, serverTime, status, withdrawableUntil }` 這幾個欄位，用白名單逐一列出，不使用 spread，避免把 `orderKey` 等欄位帶出去；`results` 只有 ENDED 時才呼叫 `buildResults`。
- **Rationale**：UT-PROJ-04、05 會用遞迴掃描與 `JSON.stringify` 檢查。白名單可以防止日後在 `Submission` 加欄位時不小心洩漏（憲章原則 IV）。

## R-08 啟動恢復的接線（D3）

- **Decision**：`server/src/boot/recover.ts` 匯出 `recoverOnBoot(service: SessionService): void`，內容只有呼叫 `service.recover()`，以及在失敗時記錄 log 後重新丟出。`createApp` 設定 `app.locals.service = service`，`app.ts` 匯出 `serviceOf(app: Express): SessionService`；`index.ts` 在 `httpServer.listen` 之前呼叫 `recoverOnBoot(serviceOf(app))`（TECH_SPEC §2）。`service.recover()` 對 `repo.listSessionsByPhase('RUNNING')` 的每個活動：清空記憶體中的上線集合；對 `windowEndsAt ≤ now` 的視窗題，依 `(windowEndsAt, number)` 逐題結算（同 R-04）；其餘題目 `scheduler.schedule(window:<qid>, windowEndsAt, …)`。有變化才 publish。
- **Rationale**：符合 TECH_SPEC §2「index.ts：讀 config、組裝依賴、啟動、recover」，且 `createApp(deps) → { app, httpServer, io }` 的簽名不變。IT-RESTART-01 用同一個 DB 重建 app 後，以 `recoverOnBoot(serviceOf(app))` 恢復並結算。recover 在 `listen` 之前執行，此時沒有任何 socket，publish 不會送給任何人，無害。
- **Alternatives**：讓 `createApp` 多回傳 `service`（要改回傳型別契約，不採用）；由 `createApp` 直接呼叫 recover（與 TECH_SPEC §2 的職責分配不符，analyze I3 改掉）；`index.ts` 另外建一個 SessionService（會有兩份上線集合，不採用）。

## R-09 排程回呼的錯誤處理

- **Decision**：service 傳給 scheduler 的回呼用 try/catch 包住；發生例外時以 `console.error` 記錄（含 questionId），不重新丟出。
- **Rationale**：`timerScheduler` 的回呼在 `setTimeout` 中執行，未捕捉的例外會讓整個伺服器程序結束。結算是冪等的，記錄錯誤後下次重啟的 recover 仍會補結算。

## R-10 前端時間與倒數

- **Decision**：
  - `format.ts`：`formatTime(ms)` → `HH:mm:ss.SSS`、`formatClock(ms)` → `HH:mm:ss`。兩者都以 `ms + 8 小時` 後取 UTC 欄位計算（台灣沒有日光節約時間），不依賴 `Intl` 時區資料，jsdom 的結果也會一致（UT-UI-FMT-01：`formatTime(0) === '08:00:00.000'`）。`formatAnswers(answers, subLabels)`：單題直接回傳答案；題組以「／」連接 `${label}${answer}`（UT-UI-FMT-02）。
  - `useServerClock(serverNow)`：每次收到新的 `serverNow` 時計算 `offset = serverNow - Date.now()`，回傳 `() => Date.now() + offset`（UT-UI-CLOCK-01）。另提供 `useTick(intervalMs)`，以 `setInterval` 觸發重新渲染：StatusGrid 每 100 ms、AnswerCard 每 250 ms。
  - 撤回倒數 n ＝ `Math.ceil((withdrawableUntil - now()) / 1000)`；`≤ 0` 時不渲染按鈕（spec FR-029 clarify）。視窗倒數顯示 `判定中 ${(max(0, windowEndsAt - now) / 1000).toFixed(1)} s`。
- **Rationale**：倒數只是顯示用；能否撤回、何時結算一律由伺服器判斷（憲章原則 III）。前端在 client/ 呼叫 `Date.now()` 不受原則 VIII 限制（該限制只針對 domain／service）。

## R-11 草稿同步（usePlay）

- **Decision**：`setDraft(qid, answers)` 立即更新本地 `localDrafts[qid]` 並記錄 `lastInputAt[qid]`；每題各有一個 300 ms（`DRAFT_DEBOUNCE_MS`）debounce 計時，到期後 `PUT /api/play/drafts/:qid`。收到 `team:state` 時，`Date.now() - lastInputAt[qid] < 1000` 的題目保留本地值，其餘以快照的 `drafts[qid].answers` 取代；快照中沒有草稿的題目：若 `mySubmissions[qid].status === 'withdrawn'` 就以撤回的答案為初始值（TECH_SPEC §10.4），否則為空格。`submit(qid)` 先取消該題 debounce，再以本地目前內容 `POST /submissions`。
- **介面不擴充**（2026-11-24 analyze C1 修正，憲章原則 IX）：`usePlay()` 只回傳 TECH_SPEC §10.3 的 `view`、`me`、`error`、`setDraft`、`submit`、`withdraw`，不新增任何欄位。本地草稿直接合併進回傳的 `view.drafts`：上述規則決定的內容寫成 `view.drafts[qid] = { answers, updatedBy, updatedAt }`（本地輸入時 `updatedBy = me.id`、`updatedAt = Date.now()`）。AnswerCard 一律從 `view.drafts[qid]?.answers` 讀取；沒有時依 withdrawn 規則或空格。
- **整題覆蓋**：草稿以整題為單位，最後送達者為準（spec FR-016a）；伺服器不做子題合併。
- **錯誤**：PUT 失敗（例如 ALREADY_SUBMITTED、INVALID_PHASE）時設定 `error`，畫面以 ErrorBanner 顯示，下一次快照會修正本地狀態。

## R-12 推播範圍（§9.3）

| 方法 | publish |
| --- | --- |
| start、end、reset、submit、withdraw、settleWindow（有變化）、recover（有變化） | `publish(sessionId)`（老師＋全部組） |
| updateDraft | `publish(sessionId, { teacher: false, teamIds: [teamId] })`（UT-SVC-DRAFT-05） |

每組收到的都是自己的 `projectTeamView`，不會洩漏他組資料（IT-VIS-01、UT-BC-03 已由 001 驗證 broadcaster）。

## R-13 效能（IT-PERF-01、SC-003）

- **Decision**：維持「每次 publish 只載入一次 aggregate」（001 broadcaster 已是如此）。`projectTeacherView` 先把送出依 questionId 分組（`Map`），每題只呼叫一次 `rankSubmissions`，`teamScores` 只算一次，避免 題數 × 組數 × 送出數 的重複排序。10 組 × 20 題的快照小於 50 KB（§13）。
- **Rationale**：40 個連線＋老師時，一次送出會產生 11 次投影，每次都是 O(送出數 log 送出數)，在本機遠低於 500 ms。

## R-14 前端畫面範圍

- **Decision**：
  - TeacherDashboard：RUNNING 時顯示 `StatusGrid`；ENDED 時也顯示 StatusGrid，呈現最終狀態（結果表 ResultsTable 屬 004）。`ControlBar` 在 READY／RUNNING／ENDED 都顯示，依階段只有一顆按鈕可按；SETUP 時三顆都停用。
  - Play：所有階段都渲染 AnswerCard；`phase ≠ RUNNING`（含 ENDED）時輸入與送出停用，placeholder 為「等待老師開始」。ENDED 的 StudentResults 與 AnswerCard 的 rejected 狀態屬 004。
- **分數**（analyze H1）：搶答中不顯示計分板（PRD §3.2：E6 計分板範圍外；TECH_SPEC §10.5 搶答中線框沒有分數欄）。TeacherView 仍提供 `teams[].score`，供 004 的 ResultsTable（`score-{teamIndex}`）使用。
- **前置條件**：001 的 [FE] Phase 3、4 與 002 的 [FE] 尚未完成，`client/`、`e2e/` 目前不存在。003 的 [BE] 任務可以立即開始；[FE] 任務與 E2E-04～11 必須等 001、002 的前端完成。
