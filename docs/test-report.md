# 測試報告 2026-11-28 9f38bfe（最終驗收，004 Phase 5 T040–T044）

執行環境：Windows 11、Node 22.13+、E2E 使用系統 Edge（`channel: 'msedge'`）。本報告的數值都在 commit `9f38bfe` 上執行（工作目錄乾淨，只有 `docs/` 的報告修改）。

## 摘要

| 層級 | 案例數（TEST_SPEC ID） | 測試數 | 通過 | 失敗 | 略過 |
|---|---|---|---|---|---|
| UT（§5） | 219 | 284 | 284 | 0 | 0 |
| IT（§6） | 17 | 17 | 17 | 0 | 0 |
| E2E（§7，E2E-01～18） | 18 | 18 | 18 | 0 | 0 |
| MA（§8.2，MA-01～09） | 9 | — | 7 | 0 | 2（MA-06 未執行；MA-08 Demo 影片部分未確認） |
| 子功能手動驗收（001 T089、T093；002 quickstart 2-4～2-7；003 quickstart §3 #3、#4、#7） | 13＋4＋3 | — | 20 | 0 | 0 |

- 「測試數」為 vitest `it` 個數；一個 ID 可以對應多個 `it`（例如分成多個情境）。TEST_SPEC §5～§7 定義的 236 個 UT／IT ID 與 18 個 E2E ID，**每一個**都出現在通過的測試名稱中（以 vitest JSON 報告與 Playwright 輸出逐一比對，缺 0 個、多 0 個）。
- `grep -rnE "it\.skip|test\.fixme|it\.only|test\.only|\.todo\(|describe\.(skip|only)" server/test client/test shared/test e2e/tests`：0 筆。
- `npm run lint`（eslint ＋ shared／server／client／e2e 4 個 workspace typecheck）：無錯誤。

## 覆蓋率

`npm run test:coverage`（結束碼 0；vitest `coverage.thresholds` 與 §2.3 相同，未調整門檻）：

| 範圍 | Lines | Branches | 門檻（L / B） | 結果 |
|---|---|---|---|---|
| 全專案 | 87.68% | 89.36% | 80 / 75 | 通過 |
| `server/src/domain/**` | 99.64% | 97.01% | 95 / 90 | 通過 |
| `server/src/sheets/parser.ts` | 100% | 95.38% | 95 / 90 | 通過 |
| `server/src/sheets/exporter.ts` | 100% | 93.33% | 95 / 90 | 通過 |
| `server/src/export/**` | 100% | 100% | 95 / 90 | 通過 |
| `server/src/services/**` | 99.00% | 93.72% | 90 / 85 | 通過 |
| `shared/src/**` | 100% | 100% | 90 / 85 | 通過 |

**排除清單**（`vitest.config.ts`）：`server/src/index.ts`（建立 Google client、Express／Socket.IO 組裝、listen）與 `**/*.d.ts`。`googleGateway.ts` **未排除**（100% / 60.46%）：UT-GW-01～05 以 mock 的 `sheets_v4.Sheets` client 執行；真正連網只發生在 `index.ts` 建立 client 處（已排除）。004 相關其他模組：`export/csv.ts` 100% / 100%、`fakeGateway.ts` 100% / 91.3%、`http/teacherRoutes.ts` 96.07% / 86.66%、`client/src/components/ExportPanel.tsx` 100% / 100%。

## 追溯矩陣結果（§10 每列 通過/失敗）

每列所列的 UT、IT、E2E ID 都已核對有對應測試並通過；MA 欄見 `docs/manual-test.md`。

| 需求 | UT | IT | E2E／手動 | 結果 |
|---|---|---|---|---|
| FR-01 匯入、辨識題號 | 通過 | IT-FLOW-01 通過 | E2E-01、02 通過；MA-02、MA-09 通過 | **通過** |
| FR-02 只以題號表示 | 通過 | IT-FLOW-01 通過 | E2E-01 通過 | **通過** |
| FR-03 開始／結束 | 通過 | IT-SYNC-01 通過 | E2E-05、12、17 通過 | **通過** |
| FR-04 老師即時狀態 | 通過 | IT-RT-01、IT-PERF-01 通過 | E2E-07 通過 | **通過** |
| FR-05 老師看結果 | 通過 | IT-FLOW-01 通過 | E2E-12 通過 | **通過** |
| FR-06 寫回原檔 | 通過（含 UT-UI-EXP-02） | IT-FLOW-01 通過 | E2E-14、15 通過；MA-03、MA-04 通過 | **通過** |
| FR-07 開始後才能作答 | 通過 | IT-PHASE-01 通過 | E2E-04 通過 | **通過** |
| FR-08 以組為單位 | 通過 | IT-CONC-01 通過 | E2E-06 通過 | **通過** |
| FR-09 學生看結果 | 通過 | IT-VIS-02 通過 | E2E-12 通過 | **通過** |
| FR-10 結束前看不到他組 | 通過 | IT-VIS-01 通過 | E2E-06、07 通過 | **通過** |
| FR-11 最快者得分 | 通過 | IT-CONC-01 通過 | E2E-07 通過 | **通過** |
| FR-12 階段同步 | 通過 | IT-SYNC-01、IT-RECON-02 通過 | E2E-05 通過 | **通過** |
| E1 題組 | 通過 | IT-FLOW-01 通過 | E2E-08 通過 | **通過** |
| E2 CSV | 通過 | IT-CSV-01 通過 | E2E-16 通過 | **通過** |
| E3 公平機制 | 通過 | IT-RESTART-01 通過 | E2E-11 通過 | **通過** |
| E4 撤回 | 通過 | IT-FLOW-01 通過 | E2E-09 通過 | **通過** |
| E5 人工判錯 | 通過（含 UT-SVC-REJ-07） | IT-FLOW-01 通過 | E2E-13 通過 | **通過** |
| E7 斷線重連 | 通過 | IT-RECON-01～02、IT-ONLINE-01、IT-RESTART-01 通過 | E2E-10、18 通過 | **通過** |
| 身分（房間碼＋組別＋暱稱） | 通過 | IT-AUTH-01～03 通過 | E2E-03 通過 | **通過** |
| 老師管理頁（登出、單一活動） | UT-UI-DASH-01～03 通過 | —（§10 未列） | —（§10 未列） | **通過（UT）**；IT／E2E 欄見 Q-008 |
| 錯誤處理 | 通過 | IT-VAL-01 通過 | MA-05 通過 | **通過** |

**TECH_SPEC §14.1 004 列核對（T044）**：UT-EXP-01～04、UT-CSV-01～07、UT-GW-02、UT-GW-05、UT-PROJ-09、UT-SVC-REJ-01～07、UT-SVC-EXPORT-01～06、UT-UI-RES-01～02、UT-UI-EXP-01～02、UT-UI-CARD-06、UT-UI-PLAY-03、IT-FLOW-01、IT-CSV-01、IT-VIS-02、E2E-12～17 皆有通過紀錄；MA-03、04、05、07 通過，MA-06 待 Demo 錄製時執行，MA-08 文件部分完成、Demo 影片待錄製後確認。

## 缺陷（DEF-*）

無。001～004 最終驗收期間未發現產品缺陷，未修改 `client/src`、`server/src`、`shared/src`、README 與根目錄設定檔。

## 待釐清（Q-*）

### Q-001 UT-UI-DASH-02 偶發失敗一次（已解決）
- 相關條文：TEST_SPEC §0.3（可重現）、§8.1-1
- 觀察：`npx vitest run --reporter=verbose` 全套連續 9 次中 1 次失敗（該次 stderr 未保存，無錯誤訊息），其餘 8 次及該檔單獨執行 3 次皆通過。測試以 `findByTestId('room-code')`（預設 1 秒等待）等待 mock 回應，推測為全套負載下的等待逾時，屬測試時序問題而非產品缺陷。
- 採用的假設：不視為產品缺陷；發現時屬 QA 範圍不可修改；後續以 [FE] 身分於 fix/flaky-ui-tests 修正。
- 影響的測試：UT-UI-DASH-02
- 狀態：**已解決**（branch `fix/flaky-ui-tests`）
- 處理方式：僅修改 `client/test/pages/TeacherDashboard.test.tsx`，將 UT-UI-DASH-02 的 `findByTestId('room-code')` 等待逾時由預設 1000 ms 放寬為 3000 ms（`{ timeout: 3000 }`）；斷言內容與 `client/src` 皆未修改。修改後連續執行 `npm test` 5 次，皆 53/53 檔、301/301 測試通過。

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

### Q-002 UT-UI-PLAY-03 偶發失敗一次（已解決）
- 相關條文：TEST_SPEC §0.3（可重現）、§8.1-1
- 觀察：加入 003 IT 後第一次執行 `npm test`，`client/test/pages/Play.test.tsx` UT-UI-PLAY-03 失敗一次（耗時 1057 ms，接近 `findBy*` 預設 1 秒等待），之後連續 3 次完整 `npm test` 皆 298/298 通過。與 Q-001 相同，推測為全套平行執行（IT-CONC-01、IT-PERF-01 使用真實時鐘、CPU 負載較高）時的等待逾時。
- 採用的假設：不視為產品缺陷；發現時屬 QA 範圍不可修改；後續以 [FE] 身分於 fix/flaky-ui-tests 修正。
- 影響的測試：UT-UI-PLAY-03
- 狀態：**已解決**（branch `fix/flaky-ui-tests`）
- 處理方式：僅修改 `client/test/pages/Play.test.tsx`，將 UT-UI-PLAY-03 中 `findByTestId('answer-card-1')` 與 `findByTestId('student-results')` 兩處等待逾時由預設 1000 ms 放寬為 3000 ms；斷言內容與 `client/src` 皆未修改。修改後連續執行 `npm test` 5 次，皆 53/53 檔、301/301 測試通過。

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

## 004 Phase 4 補充（T034–T039）

- T034：`startApp(opts?)` 新增 `opts.fakeSheets`：true 時改用 `createFakeGateway(<repo>/fixtures/sheets)`（不傳 outDir，不寫檔）並傳入 `fakeSheets` 掛載 `/api/dev/fake-sheets/*`；回傳值新增 `fakeSheets`，`gateway` 型別放寬為 `SheetsGateway`（既有 IT 未使用 InMemory 專屬方法）。`flow.ts` 新增 `rejectWinner`、`exportSheet`、`restoreSheet`、`getCsv`（回傳 `{ status, headers, text }`，保留 BOM）、`getFakeSheet`，另加 `withdraw`（IT-FLOW-01 的 E4 步驟需要）。001～003 的 IT 未修改且全部通過。
- T035：`results.it.test.ts` IT-FLOW-01 通過：RUNNING 中 export → 409；end 後第 1、3 題得主為第 1 組，第 4 題因撤回無得主；判錯第 3 題 → 第 2 組遞補；export → `updatedCells === 3`，G5「（1）CPU」、G6「（2）作業系統」、G11「1」，其餘儲存格與 fixture 相同；CSV 以 BOM 開頭；restore → 6 格，與 fixture 相同（比較方式見 Q-005）。
- T036：IT-CSV-01 通過：`Content-Type: text/csv; charset=utf-8`、`Content-Disposition: attachment; filename="results-<roomCode>-r1.csv"`；reset → start 時下載 → 409 INVALID_PHASE；end 後檔名為 `-r2.csv`。
- T037：`results-visibility.it.test.ts` IT-VIS-02 通過：A 送出 `SECRET-A-123`、B 隨後送出；RUNNING 中判錯 A → B 遞補；以「B 存草稿並等到自己的 team:state」作為屏障後比對，B 在 end 前收到的所有事件不含 `SECRET-A-123`、`rejected`、A 的 member id 與 submission id；A 的 `mySubmissions` 第 3 題 `status === 'rejected'`；end 後 B 的 `team:state.results` 含 A 的答案（ranking 中標 rejected）。
- T038：新增 `e2e/tests/results-export.spec.ts`（E2E-12～17，serial，每位使用者獨立 context，只用 `data-testid`，截圖 `e2e/artifacts/E2E-12.png`～`E2E-17.png`）。前置會把既有活動（E2E-11 結束時仍在搶答中）結束並重新開始，改為純速度、3 組並重新匯入 fixture-template-a。E2E-14 從點擊到「已寫回 3 格」< 2 秒。單獨執行本 spec（新伺服器、新活動）6/6 通過；全套 18/18 通過。
- T039：`npm test` 53 個檔案 301 個測試全部通過（新增 3 個 IT）；`npm run lint` 通過；`npm run test:e2e` 18/18 通過；`server/test`、`client/test`、`e2e/tests` 中 `it.skip`／`test.fixme`／`.only` 數量為 0。
- 撰寫過程中 2 次失敗皆為測試寫錯（已修正測試，未改產品程式）：(1) E2E-16 原本寫死 `r1`，但全套執行時同一活動已被 reset 兩次，實際為 `r3`（產品行為正確），改為以老師 API 取得目前輪次再比對完整檔名（見 Q-006）；(2) 單獨執行時新活動為「準備中」，前置的狀態判斷補上此狀態。
- 本次未發現產品缺陷。

### Q-005 「fake sheet 與 fixture 完全相同」的比較方式
- 相關條文：TEST_SPEC §6 IT-FLOW-01、§7 E2E-14、E2E-15；TECH_SPEC §7.4（fake 閘道 writeCells「逐筆補齊列與欄再設定值」）
- 觀察：fixture 第 11、13 列只有 3 欄（G11、G13 為「未填」）。寫回 G11 或還原時寫入 `''` 後，fake 閘道會把該列以 `''` 補齊到 7 欄，因此還原後的 `values` 陣列與 fixture 在 JSON 表示上不同（多了尾端空字串），但每個儲存格的值相同。
- 採用的假設：Google Sheets values API 本來就不回傳尾端空白格，「未填」與 `''` 是同一個儲存格值，屬表示方式差異而非資料錯誤，不視為缺陷。IT-FLOW-01、E2E-14、E2E-15 以「去除每列尾端 `''` 與尾端空列後逐格比對、merges 嚴格比對」判斷相同。
- 影響的測試：IT-FLOW-01、E2E-14、E2E-15

### Q-006 E2E-15、E2E-16 與 TEST_SPEC §7 規則的配合方式
- 相關條文：TEST_SPEC §7（每個案例前呼叫 fake-sheets reset）；tasks T038 E2E-15、E2E-16
- 觀察：(1) tasks T038 要求在 beforeEach 重設 fake sheet，E2E-14 的寫回因此在 E2E-15 開始前被清掉，直接按還原無法驗證「從寫回狀態恢復」。(2) 系統只有一個活動，全套執行時 E2E-11 與本 spec 前置各 reset 一次，下載檔名為 `r3` 而非 tasks 寫的 `r1`。
- 採用的假設：(1) E2E-15 先按一次 `btn-export-sheet` 並確認 G5 已寫入，再按還原斷言「已還原 6 格」與 fixture 相同；(2) E2E-16 以 `GET /api/teacher/sessions/current` 取得目前 `round`，斷言檔名為 `results-<roomCode>-r<round>.csv`（單獨執行本 spec 時即為 `r1`，已實際驗證）。
- 影響的測試：E2E-15、E2E-16

### Q-007 004 圖表與程式碼的 3 處標示差異（T044，已解決）
- 相關條文：憲章原則 XI；`diagrams/004-class.puml`、`diagrams/004-sequence.puml`
- 觀察：
  1. `004-class.puml` 的 `ranking <<module>>` 只列 `rankSubmissions`、`winnerOf`、`teamScores`；程式另有公開函式 `orderSubmissions(subs): Submission[]`（`server/src/domain/ranking.ts:24`），003 的類別圖與組件圖已列出，004 的程式沒有直接呼叫它。
  2. `004-sequence.puml` 第三段（寫回）與第四段（CSV）畫成先 `assertPhase` 再讀資料庫；`sessionService.ts` 的 `exportToSheet`、`exportCsv` 都是先 `loadAggregate` 再 `assertPhase`，回應結果相同。寫回時 `spreadsheetId` 為 null 會丟 `INVALID_PHASE`，這個分支圖上沒畫。
  3. `004-sequence.puml` 的還原段沒畫 `assertPhase(phase,'restore')`（READY／ENDED，只寫在老師動作的標籤中）和「寫入 0 筆時不呼叫閘道」（`restoreSheet` 有此判斷）。
- 採用的假設：三處都只是圖表標示不精確，對外行為（錯誤碼、寫入內容、HTTP 回應）與 TECH_SPEC 一致，**不是產品缺陷**。
- 處理（組員 2026-11-28 決定）：
  1. **不修改**。004 的圖只畫 004 用到的函式；`orderSubmissions` 屬 003，已在 `003-class.puml`、`003-component.puml` 中。
  2. **已修改** `004-sequence.puml`：寫回段與 CSV 段改成先 `loadAggregate` 再 `assertPhase`；寫回段補上 `spreadsheetId` 為 null → `INVALID_PHASE`（409）的分支。
  3. **已修改** `004-sequence.puml`：還原段補上 `assertPhase(phase,'restore')`（READY／ENDED，否則 INVALID_PHASE）、載入 answer_slots，以及「寫入為 0 筆時不呼叫閘道」；並依組員後續要求，比照寫回段補上 `spreadsheetId` 為 null → `INVALID_PHASE`（409）的分支（`restoreSheet` 在 `assertPhase` 之後檢查）。
  - 執行 `java -jar plantuml.jar "./diagrams/004-*.puml"` 重新產生 3 張 PNG，無錯誤，並已目視確認 `004-sequence.png` 的內容。程式碼未修改。
- 影響的測試：無
- 狀態：**已解決**

### Q-008 §10「老師管理頁」列沒有 IT／E2E
- 相關條文：TEST_SPEC §8.1 第 3 點（每列至少 1 個 UT 與 1 個 IT 或 E2E）、§10「老師管理頁（PRD §5.1 步驟 1–2：登出、單一活動）」列
- 觀察：§10 這一列的 Integration 與 E2E／手動欄都是「—」，只列 UT-UI-DASH-01～03，字面上不符合 §8.1 第 3 點。不過 E2E-01（登入 → 建立活動）、E2E-03 與 E2E-04～17 都會操作管理頁（E2E 只在 `btn-create-session` 存在時才按，沒有斷言「已有活動時不顯示建立入口」）。「單一活動」與「登出」沒有 IT／E2E 斷言，由 UT-UI-DASH-01～03 與 001 T089 情境 1 的手動驗收涵蓋。
- 採用的假設：該列是 TEST_SPEC 刻意設計為只有 UT（PRD 步驟 1–2 的 UI 行為），視為符合 §8.1 第 3 點；QA 不自行新增無 ID 的測試。若要嚴格符合，需由文件負責人在 TEST_SPEC 補登 E2E ID。
- 影響的測試：UT-UI-DASH-01～03
- 狀態：**已確認**（組員 2026-11-28 同意：TEST_SPEC 設計如此，視為符合 §8.1 第 3 點，不補 E2E）

### plan D1～D3 的 docs 同步狀態（004）
| 差異 | 內容 | docs 同步 | 對應測試 |
|---|---|---|---|
| D1 | 判錯到無人遞補的題目，寫回時恢復原始值 | 已同步：PRD v1.3 §8 第 9 點、TECH_SPEC v1.7 §7.9、§12.6、TEST_SPEC v1.4（UT-SVC-REJ-07） | UT-SVC-REJ-07、IT-FLOW-01 通過 |
| D2 | 搶答中也可判錯（RUNNING 顯示 ResultsTable） | 已同步：TECH_SPEC v1.7 §10.4、§10.5（PRD 無需修改，見 PRD v1.3 修訂紀錄） | UT-UI-RES、IT-VIS-02、E2E-13 通過 |
| D3 | 還原完成顯示「已還原 N 格」 | 已同步：TECH_SPEC v1.7 §10.4、TEST_SPEC v1.4（UT-UI-EXP-02） | UT-UI-EXP-02、E2E-15 通過 |

目前 docs 版本：PRD v1.3、TECH_SPEC v1.8（v1.8 只改 002 的 §10.6，不影響 004）、TEST_SPEC v1.4。`diagrams/004-*.puml` 標題為「依 TECH_SPEC v1.7」（T047）。

## 004 Phase 5 最終驗收（T040–T044）

| 任務 | 結果 |
|---|---|
| T040 全部測試與覆蓋率 | 通過：`npm run lint` 無錯誤；`npm test` 53 檔、301/301；`npm run test:coverage` 結束碼 0，§2.3 每列門檻達成（見上方覆蓋率表）；`npm run test:e2e` 18/18（41.5 s）；skip／only／fixme／todo 0 筆；排除清單只有 `server/src/index.ts`、`**/*.d.ts` |
| T041 手動驗收 MA-03～08 | MA-03、04、05 通過（2026-11-28／Kevin，截圖見 `docs/manual-test.md`）；MA-07 通過（Claude 執行 `git log --all -p` 搜尋）；**MA-06 待 Demo 錄製時執行**；**MA-08 文件部分完成、Demo 影片待錄製後確認** |
| T043 README 與乾淨 clone | 通過：README 功能清單涵蓋 FR-01～12、E1～E5、E7（E1 題組、E2 CSV、E3 公平、E4 撤回、E5 判錯、E7 重連都有獨立條目）；「如何執行」含 `npm install`、`npm run dev`、範例 ID `fixture-template-a`／`fixture-template-b`、Google 模式設定與共用給服務帳號、`data/fake-sheets/<ID>.json`。從乾淨 clone（`git clone` 到暫存資料夾，commit `9f38bfe`，**未建立 `.env`**）依 README 執行 `npm install && npm test && npm run test:e2e` 一次成功：安裝 485 個套件、53 檔 301 測試通過、E2E 18/18 通過。未修改 README |
| T044 最終一致性 | §14.1 004 列每個測試 ID 都有通過紀錄（見追溯矩陣段落）。`004-component.puml` 的組件、依賴、顯示條件（TeacherDashboard 的 `showGrid` 為 RUNNING／ENDED、`showExport` 為 READY／ENDED）、`data-testid`、閘道錯誤對應（403／404／其他）都和程式一致；`004-class.puml` 的實體、值物件、exporter／csv／projections／SessionService 簽名都和程式一致；`004-sequence.puml` 四段互動的主要順序也一致。3 處標示差異（Q-007）已依組員決定處理：第 1 點不修改（`orderSubmissions` 屬 003 的圖），第 2、3 點已修正 `004-sequence.puml`，並重新產生 `004-*.png`，無錯誤。**通過** |

## 驗收結論：不通過（待 Demo 錄製後補記即可通過）

逐條對照 §8.1：

| # | 條件 | 結果 |
|---|---|---|
| 1 | §5、§6、§7 所有案例皆實作且通過，無 skip | **滿足**：UT 219 個 ID、IT 17 個、E2E 18 個全部通過；skip 0 |
| 2 | 覆蓋率達 §2.3 門檻 | **滿足** |
| 3 | §10 每列至少 1 UT＋1 IT／E2E 且全部通過 | **滿足**（「老師管理頁」列依 §10 原設計只有 UT，Q-008 已確認視為符合） |
| 4 | 無未解決的 S1、S2 缺陷 | **滿足**：缺陷 0 筆 |
| 5 | §8.2 手動驗收全部勾選並附截圖 | **未滿足**：MA-01～05、07、09 通過；**MA-06 待 Demo 錄製時執行並截圖；MA-08 待 Demo 影片錄製後確認** |
| 6 | `npm run lint` 無錯誤 | **滿足** |
| 7 | 乾淨 clone 依 README 一次成功 | **滿足** |

唯一未滿足的條件是第 5 條，原因是 MA-06、MA-08 要在 Demo 錄製時才能執行，不是測試失敗或產品缺陷。Demo 錄製後，在 `docs/manual-test.md` 補記 MA-06 的結果與截圖、MA-08 的影片確認，即可改判為**通過**。Q-007（圖表）已解決，Q-008 已確認；目前沒有其他待決事項。
