# 測試報告 2026-11-27 fd9f4bb（+ 001 Phase 4 QA：T087–T090、T093，未提交）

## 摘要

| 層級 | 案例數 | 通過 | 失敗 | 略過 |
|---|---|---|---|---|
| UT + IT（`npm test`） | 288 | 288 | 0 | 0 |
| E2E（`npm run test:e2e`，001 範圍） | 2 | 2 | 0 | 0 |
| MA（001 手動驗收 T089、T093） | 13 | 13 | 0 | 0 |

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

本次只驗證 TECH_SPEC §14.1 001 列（見 `docs/manual-test.md`），全部通過。E2E-01、02、04～17 屬 002～004，尚未撰寫。

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

## 驗收結論：不通過（001 範圍內全部通過）

未滿足的 §8.1 條件：1、3（002～004 的 E2E 尚未實作）；5（§8.2 中 002～004 的 MA 項目）。001 範圍內的自動化與手動驗收項目全部通過；README 的 T088 執行說明部分待補。
