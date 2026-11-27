# 測試報告 2026-11-28 b3c590b（+ 003 Convergence 驗收 T066，未提交）

## 摘要

| 層級 | 案例數 | 通過 | 失敗 | 略過 |
|---|---|---|---|---|
| UT + IT（`npm test`） | 298 | 298 | 0 | 0 |
| E2E（`npm run test:e2e`，001～003 範圍：E2E-03、18、01、02、04～11） | 12 | 12 | 0 | 0 |
| MA（001 手動驗收 T089、T093） | 13 | 13 | 0 | 0 |
| MA（002：MA-09 通過；MA-01、02 待 Kevin 執行） | 3 | 1 | 0 | 2（未執行） |

## 覆蓋率

| 範圍 | Lines | Branches | 門檻 | 結果 |
|---|---|---|---|---|
| 全專案 | 86.84% | 89.12% | 80 / 75 | 通過 |
| `server/src/domain/**` | 99.64% | 97.03% | 95 / 90 | 通過 |
| `server/src/sheets/parser.ts` | 100% | 95.31% | 95 / 90 | 通過 |
| `server/src/sheets/exporter.ts` | 100% | 92.85% | 95 / 90 | 通過 |
| `server/src/export/**` | 100% | 100% | 95 / 90 | 通過 |
| `server/src/services/**` | 98.99% | 93.59% | 90 / 85 | 通過 |
| `shared/src/**` | 100% | 100% | 90 / 85 | 通過 |

排除清單：`server/src/index.ts`。例外模組逐檔數值見 `docs/manual-test.md` 001 段落。

## 追溯矩陣結果（§10 每列 通過/失敗）

TECH_SPEC §14.1 001 列、002 列（見 `docs/manual-test.md`）自動化項目全部通過。FR-01（匯入、辨識題號）、FR-02（只以題號表示）列：UT 與 E2E-01、02 通過，MA-02 待 Kevin 執行。003 列的 E2E-04～11 通過（`e2e/tests/live-quiz.spec.ts`）；E2E-12～17 屬 004，不在本次範圍。

## 缺陷（DEF-*）

無。

## 待釐清（Q-*）

### Q-001 UT-UI-DASH-02 偶發失敗一次
- 相關條文：TEST_SPEC §0.3（可重現）、§8.1-1
- 觀察：`npx vitest run --reporter=verbose` 全套連續 9 次中 1 次失敗（該次 stderr 未保存，無錯誤訊息），其餘 8 次及該檔單獨執行 3 次皆通過。測試以 `findByTestId('room-code')`（預設 1 秒等待）等待 mock 回應，推測為全套負載下的等待逾時，屬測試時序問題而非產品缺陷。
- 採用的假設：不視為產品缺陷；`client/test/` 不在本次任務可修改範圍，未修改。
- 影響的測試：UT-UI-DASH-02

## 001 Phase 4 補充（T087–T090、T093）

- T087 機密與資訊隔離：通過。`git ls-files` 不含 `.env`、`secrets/`、`data/`；E2E 密碼改為只定義在 `e2e/playwright.config.ts` 的 webServer env（`identity.spec.ts` 改由 config 讀取）；IT-ONLINE-01 斷言學生 `team:state` 不含他組成員。
- T090：`npm test`（288）、`npm run lint`、`npm run test:e2e`（E2E-03、E2E-18）全部通過；`diagrams/001-sequence.puml` 補 T091 分支並修正連線推播順序（程式碼不變）。
- T089、T093：手動驗收全部通過，明細見 `docs/manual-test.md` 001 段落。T093(a) 因正式建置由伺服器提供前端，改以開發模式（server、client 分開執行）驗證。

## 002 Phase 4 補充（T035–T041）

- T035、T036：新增 `e2e/tests/import.spec.ts`（E2E-01 含匯入時間 < 2 秒、E2E-02）。
- T037：E2E 4 個、覆蓋率門檻全部通過；排除清單仍只有 `server/src/index.ts`。
- T038：README 功能清單加入 002，新增「Guided Notes 範本格式」「Google Sheets 服務帳號設定」兩節；「如何執行」未修改。
- T039：MA-09、quickstart 2-4～2-8 通過；MA-01、MA-02 需要真實 Google 服務帳號，待 Kevin 執行。
- T040：機密與 `team:state` 資訊隔離檢查通過。
- T041：`npm test`、`npm run lint`、`npm run test:e2e` 通過；002 圖表與程式碼一致。
- 本次未發現產品缺陷。

## 003 Phase 4 補充（T057–T062，涵蓋 T048–T053）

- T057（T048）：`startApp(opts?)` 新增 `snapshots`（預設載入 fixture-template-a、b）、`realTime`（systemClock＋timerScheduler）、`dbPath`、`clock`，回傳值加 `clock`、`scheduler`（另加 `gateway`、`service`）；`close()` 會取消計時器並關閉 DB。新增 `flow.ts`（`login`、`createAndImport`、`joinMembers`、`joinMember`、`startQuiz`、`endQuiz`、`resetQuiz`、`submit`、`putDraft`、`getTeacherView`、`waitForEvent`）。001 的 IT 未修改且通過。
- T058（T049）：`live.it.test.ts` IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01 通過。IT-VIS-01 以「B 自己存草稿並等到自己的 team:state」作為屏障，確保 end 前推給 B 的事件都已收到後才比對。
- T059（T051）：`concurrency.it.test.ts` IT-CONC-01（realTime，20 組 × 50 輪）通過，約 4.2 秒。
- T060（T050）：`recon.it.test.ts` IT-RECON-01（含「搶答中新成員加入」）、IT-RECON-02 通過。
- T061（T052）：`restart.it.test.ts` IT-RESTART-01 通過；暫存 DB 建在 `os.tmpdir()`，測試結束刪除。另斷言 recover 前題目仍為 window，確認結算是由 `recoverOnBoot(serviceOf(app))` 完成。
- T062（T053）：`perf.it.test.ts` IT-PERF-01（realTime，40 學生 socket＋老師，20 次送出）通過，p95 遠低於 500 ms（全部 20 次合計約 0.9 秒）。
- IT 只連 127.0.0.1 的測試伺服器，不使用外部網路；除 IT-CONC-01、IT-PERF-01 外皆用 FakeClock＋ManualScheduler。
- 本次未發現產品缺陷。

## 003 Phase 4 補充（T063、T064，涵蓋 T054、T055 的功能清單部分）

- T063（T054）：新增 `e2e/tests/live-quiz.spec.ts`（E2E-04～11，`test.describe.configure({ mode: 'serial' })`，每位使用者獨立 context，只用 `data-testid`，截圖 `e2e/artifacts/E2E-04.png`～`E2E-11.png`）。前置：重新匯入 `fixture-template-a`（import.spec 最後匯入範例 B）、組數改為 3，判定模式與視窗秒數維持預設公平 3 秒（斷言 `settings-mode-fair` 已勾選、`settings-window-sec` 為 3）；E2E-11 在 reset 後再次斷言設定未變。`npm run test:e2e` 12/12 通過；`live-quiz.spec.ts` 單獨執行亦通過（無既有活動時會自行建立）。
- T064（T055 的功能清單部分）：README「功能清單」加入 003 六項（開始／結束／重新開始一輪、作答與即時狀態表、組內共編草稿、純速度與公平模式、撤回、斷線重連與重啟恢復）；依指示未修改「如何執行」（搶答示範與公平模式視窗秒數設定尚未補上）。
- 本次未發現產品缺陷。

### Q-003 E2E-06／07「第 2 組頁面沒有該字串」的斷言方式
- 相關條文：TEST_SPEC §7 E2E-06、E2E-07；tasks T054
- 觀察：E2E-06 指定輸入「0」，但學生頁全文本來就含數字 0（例如「已送出 HH:mm:ss」、題號），全文比對「0」無法判斷是否洩漏。
- 採用的假設：E2E-06 以第 2 組所有 `answer-input-*` 的值都不含「0」斷言；E2E-07 第 1 組送出前把第 3 題答案改為不會自然出現的字串 `G1ANS0`、暱稱使用 `Xena`／`Yuri`，再以第 2 組頁面全文不含這三個字串斷言（TEST_SPEC 未指定 E2E-07 的答案內容）。
- 影響的測試：E2E-06、E2E-07

### Q-002 UT-UI-PLAY-03 偶發失敗一次
- 相關條文：TEST_SPEC §0.3（可重現）、§8.1-1
- 觀察：加入 003 IT 後第一次執行 `npm test`，`client/test/pages/Play.test.tsx` UT-UI-PLAY-03 失敗一次（耗時 1057 ms，接近 `findBy*` 預設 1 秒等待），之後連續 3 次完整 `npm test` 皆 298/298 通過。與 Q-001 相同，推測為全套平行執行（IT-CONC-01、IT-PERF-01 使用真實時鐘、CPU 負載較高）時的等待逾時。
- 採用的假設：不視為產品缺陷；`client/test/` 不在本次任務可修改範圍，未修改。
- 影響的測試：UT-UI-PLAY-03

## 003 Convergence 驗收（T066，取代 T056）

執行環境：commit b3c590b（T065 已合入），Windows 11、Node 22、E2E 使用 Edge。

| 檢查 | 指令／方式 | 結果 |
|---|---|---|
| UT＋IT | `npm test` | 51 檔、298/298 通過 |
| Lint＋型別 | `npm run lint` | 無錯誤（eslint、4 個 workspace typecheck） |
| 覆蓋率 | `npm run test:coverage` | 結束碼 0，§2.3 門檻全部達成（數值見上方覆蓋率表） |
| E2E | `npm run test:e2e` | 12/12 通過（E2E-01～11、18） |
| skip 檢查 | `grep` `*/test/**`、`e2e/tests` 的 `.skip(`／`.fixme(`／`.only(`／`.todo(` | 0 筆 |
| 003 測試 ID | IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01（`live.it.test.ts`）、IT-RECON-01～02（`recon.it.test.ts`）、IT-CONC-01（`concurrency.it.test.ts`）、IT-RESTART-01（`restart.it.test.ts`）、IT-PERF-01（`perf.it.test.ts`）、E2E-04～11（`live-quiz.spec.ts`） | 全部有對應測試名稱且通過 |
| quickstart §2 API 煙霧測試 | 以腳本對 `server/dist` 實機（PORT 3200、`DB_PATH=:memory:`、`SHEETS_MODE=fake`）依序執行步驟 1～11 | 11/11 通過（4：409 INVALID_PHASE；6：第 1 組 rank 1 得主、第 2 組 rank 2；7：第 2 組 `/api/play/state` 不含「0」、第 1 組成員 id／暱稱／送出 id、`rank`、`isWinner`、`windowEndsAt`；8：409 ALREADY_SUBMITTED、422 GROUP_INCOMPLETE；9：撤回 204、第 2 組遞補得主、分數 0／1；10：ENDED 且 results 含 4 題；11：READY、round 2、cells 全為 null） |
| quickstart §3 手動畫面 | #1→E2E-05、#2→E2E-06、#5→E2E-09＋UT-UI-CARD-05、#6→E2E-11＋UT-UI-GRID-02 已由自動化涵蓋 | #3（純速度模式格子完整格式）、#4（重整後倒數約 7 秒）、#7（真實停機重啟與離線→上線）人工於瀏覽器驗證通過 |
| PlantUML 語法 | `java -jar plantuml.jar -checkonly "./diagrams/003-*.puml"` | 無錯誤 |
| 圖表一致性（憲章 XI） | 逐項比對 `003-component`、`003-class`、`003-sequence` 與 `server/src`、`client/src` | 時序圖三段、類別圖的實體／視圖／domain 函式／ports／Repo 15 個方法／SessionService 003 方法、組件圖的前後端依賴皆一致；發現 2 處標示不精確（Q-004），已修正並重新產生 PNG（`java -jar plantuml.jar "./diagrams/003-*.puml"` 無錯誤） |

§2 煙霧測試說明：quickstart 寫 `npm run dev`，本次改用 E2E 剛建置的 `server/dist`（同一份程式碼）並以 `:memory:` DB 執行，避免動到 `./data/quiz.db`。步驟 10 第 3 題的 ranking 只有第 2 組，因第 1 組的送出已在步驟 9 撤回（withdrawn 不列入 ranking，符合 Results 型別的 `status: 'active' | 'rejected'`）。

本次未發現產品缺陷。

### Q-004 003 圖表與程式碼的 2 處標示差異
- 相關條文：憲章原則 XI；`diagrams/003-component.puml`、`diagrams/003-class.puml`
- 觀察：
  1. 組件圖 `Sched --> Svc : 到期 → settleWindow(qid)`、類別圖 `Scheduler ..> SessionService : window:{qid} 到期 → settleWindow`：實際排程回呼是 private `onWindowDue(sessionId)`，它取同活動所有已到期視窗、依 (windowEndsAt, 題號) 逐題呼叫 `settleWindow`（`server/src/services/sessionService.ts` 的 `submit` 8b 與 `recover`）。時序圖第二段已正確描述。
  2. 組件圖 TeacherDashboard 寫「RUNNING 時顯示 StatusGrid」：實際 `showGrid = phase === 'RUNNING' || phase === 'ENDED'`（`client/src/pages/TeacherDashboard.tsx:35`），ENDED 也顯示（004 判錯需要）。
- 採用的假設：屬圖表標示不精確，不是產品缺陷。
- 處理：經確認後，組件圖與類別圖改為「到期 → onWindowDue → 依序 settleWindow」，組件圖 TeacherDashboard 改為「RUNNING／ENDED 時顯示 StatusGrid」，並重新產生 `003-component.png`、`003-class.png`。已解決。
- 影響的測試：無

## 驗收結論：不通過（001～003 自動化範圍內全部通過）

未滿足的 §8.1 條件：1、3（004 的 E2E-12～17 尚未實作；003 的 T066 Convergence 驗收已完成）；5（MA-01、MA-02 待 Kevin 以真實 Google 服務帳號執行；MA-03～08 屬 004）。001、002 範圍內其餘自動化與手動驗收項目全部通過。
