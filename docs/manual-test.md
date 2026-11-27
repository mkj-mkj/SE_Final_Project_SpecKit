# 手動驗收與驗證紀錄

## 001-session-and-join

### T086 自動化驗證（2026-11-27，基準 commit `2ef4027` + Phase 4 QA 變更）

**E2E（`npm run test:e2e`，Playwright 1.65.1、系統 Edge `channel: 'msedge'`，未下載 Playwright 瀏覽器）**

| ID | 檔案 | 結果 | 截圖 |
| --- | --- | --- | --- |
| E2E-03 | `e2e/tests/identity.spec.ts` | 通過 | `e2e/artifacts/E2E-03.png` |
| E2E-18 | `e2e/tests/identity.spec.ts` | 通過 | `e2e/artifacts/E2E-18.png` |

- webServer 以 `npm run build && npm start`（cwd 為 repo 根目錄）啟動；`npm start` 實際執行 `npm run start -w server`（工作目錄 `server/`），瀏覽器能載入 `/teacher/login`、`/join`、`/play` → 證明伺服器從 `server/` 工作目錄找到 `client/dist`。
- 001 的 spec 不呼叫 fake-sheets reset（該路由屬 002，research R-13）。

**覆蓋率（`npm run test:coverage`：46 檔、288 測試全部通過，門檻全部達標）**

| 範圍 | Lines | Branches | 門檻（L / B） | 結果 |
| --- | --- | --- | --- | --- |
| 全專案 | 85.56% | 88.87% | 80 / 75 | 通過 |
| `server/src/domain/**` | 99.64% | 96.96% | 95 / 90 | 通過 |
| `server/src/sheets/parser.ts` | 100% | 95.31% | 95 / 90 | 通過 |
| `server/src/sheets/exporter.ts` | 100% | 92.85% | 95 / 90 | 通過 |
| `server/src/export/**` | 100% | 100% | 95 / 90 | 通過 |
| `server/src/services/**` | 98.99% | 93.56% | 90 / 85 | 通過 |
| `shared/src/**` | 100% | 100% | 90 / 85 | 通過 |

排除清單（`vitest.config.ts`）：`server/src/index.ts`（與 `**/*.d.ts`）。未擴大排除、未調整門檻。

**plan.md Complexity Tracking 例外模組（覆蓋測試在實作之後執行；由 E2E-03／E2E-18 以建置版本實際執行，E2E 不計入 vitest 覆蓋率）**

| 檔案 | Lines | Branches |
| --- | --- | --- |
| `server/src/config.ts` | 0% | 0% |
| `server/src/ports/clock.ts`（正式實作） | 0% | 100% |
| `server/src/ports/scheduler.ts`（正式實作） | 0% | 100% |
| `server/src/ports/ids.ts`（正式實作） | 0% | 0% |
| `client/src/api.ts` | 13.91% | 100% |
| `client/src/socket.ts` | 13.04% | 100% |
| `client/src/main.tsx` | 0% | 0% |

**整合測試與 TECH_SPEC §14.1 001 列核對**：IT-AUTH-01～03、IT-ONLINE-01 通過。§14.1 001 列的 UT-VAL、UT-ERR、UT-PHASE、UT-REPO-01、UT-REPO-07、UT-AUTH、UT-SVC-CREATE、UT-SVC-JOIN、UT-PROJ-10、UT-BC、UT-UI-STORE、UT-UI-MSG、UT-UI-PHASE、UT-UI-LOGIN、UT-UI-SET、UT-UI-JOIN、UT-UI-DASH-01～03、UT-UI-PLAY-01～02、IT-AUTH-01～03、IT-ONLINE-01、E2E-03、E2E-18 皆有對應測試且通過；`skip`／`todo`／`fixme` 數量為 0。

備註：以 `--reporter=verbose` 連續執行全套 9 次，其中 1 次 UT-UI-DASH-02 失敗，其餘 8 次與該檔單獨執行 3 次皆通過，無法重現（見 `docs/test-report.md` Q-001）。
