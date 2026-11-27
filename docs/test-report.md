# 測試報告 2026-11-27 b38cde0（+ 002 Phase 4 QA：T035–T041，未提交）

## 摘要

| 層級 | 案例數 | 通過 | 失敗 | 略過 |
|---|---|---|---|---|
| UT + IT（`npm test`） | 288 | 288 | 0 | 0 |
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

## 驗收結論：不通過（001、002 自動化範圍內全部通過）

未滿足的 §8.1 條件：1、3（003～004 的 E2E 尚未實作）；5（MA-01、MA-02 待 Kevin 以真實 Google 服務帳號執行；MA-03～08 屬 004）。001、002 範圍內其餘自動化與手動驗收項目全部通過。
