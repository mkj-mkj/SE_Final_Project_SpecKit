# 測試報告 2026-11-28 94a6061（+ 003 Phase 4 IT：T057–T062／T048–T053，未提交）

## 摘要

| 層級 | 案例數 | 通過 | 失敗 | 略過 |
|---|---|---|---|---|
| UT + IT（`npm test`） | 298 | 298 | 0 | 0 |
| E2E（`npm run test:e2e`，001＋002 範圍：E2E-03、18、01、02） | 4 | 4 | 0 | 0 |
| MA（001 手動驗收 T089、T093） | 13 | 13 | 0 | 0 |
| MA（002：MA-09 通過；MA-01、02 待 Kevin 執行） | 3 | 1 | 0 | 2（未執行） |

## 覆蓋率

| 範圍 | Lines | Branches | 門檻 | 結果 |
|---|---|---|---|---|
| 全專案 | 85.56% | 88.87% | 80 / 75 | 通過 |
| `server/src/domain/**` | 99.64% | 96.96% | 95 / 90 | 通過 |
| `server/src/sheets/parser.ts` | 100% | 95.31% | 95 / 90 | 通過 |
| `server/src/sheets/exporter.ts` | 100% | 92.85% | 95 / 90 | 通過 |
| `server/src/export/**` | 100% | 100% | 95 / 90 | 通過 |
| `server/src/services/**` | 98.99% | 93.56% | 90 / 85 | 通過 |
| `shared/src/**` | 100% | 100% | 90 / 85 | 通過 |

排除清單：`server/src/index.ts`。例外模組逐檔數值見 `docs/manual-test.md` 001 段落。

## 追溯矩陣結果（§10 每列 通過/失敗）

TECH_SPEC §14.1 001 列、002 列（見 `docs/manual-test.md`）自動化項目全部通過。FR-01（匯入、辨識題號）、FR-02（只以題號表示）列：UT 與 E2E-01、02 通過，MA-02 待 Kevin 執行。E2E-04～17 屬 003～004，不在本次範圍。

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

### Q-002 UT-UI-PLAY-03 偶發失敗一次
- 相關條文：TEST_SPEC §0.3（可重現）、§8.1-1
- 觀察：加入 003 IT 後第一次執行 `npm test`，`client/test/pages/Play.test.tsx` UT-UI-PLAY-03 失敗一次（耗時 1057 ms，接近 `findBy*` 預設 1 秒等待），之後連續 3 次完整 `npm test` 皆 298/298 通過。與 Q-001 相同，推測為全套平行執行（IT-CONC-01、IT-PERF-01 使用真實時鐘、CPU 負載較高）時的等待逾時。
- 採用的假設：不視為產品缺陷；`client/test/` 不在本次任務可修改範圍，未修改。
- 影響的測試：UT-UI-PLAY-03

## 驗收結論：不通過（001、002 自動化範圍內全部通過）

未滿足的 §8.1 條件：1、3（003～004 的 E2E 尚未實作）；5（MA-01、MA-02 待 Kevin 以真實 Google 服務帳號執行；MA-03～08 屬 004）。001、002 範圍內其餘自動化與手動驗收項目全部通過。
