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

### T089 手動驗收（2026-11-27，基準 commit `fd9f4bb`，Edge／Chrome）

**啟動前檢查**：根目錄 `.env`（由 `.env.example` 複製、已設定 `TEACHER_PASSWORD`）；舊的 `data/` 經團隊同意刪除後，以 `npm run build && npm start` 啟動（`http://localhost:3000`）。

| 檢查 | 結果 | 證據 |
| --- | --- | --- |
| 伺服器讀到根目錄 `.env`（不是 `server/.env`） | 通過 | `server/.env` 不存在、shell 環境無 `TEACHER_PASSWORD`；伺服器仍成功啟動（該變數必填），且以根目錄 `.env` 的密碼登入回 200 |
| 資料庫建立在根目錄 `data/quiz.db` | 通過 | 啟動後出現 `data/quiz.db`（含 `-wal`、`-shm`）；`server/data/` 不存在 |

**quickstart 5 個情境**（老師：Edge 一般視窗；學生 A：Edge InPrivate；學生 B：Chrome 無痕）

| 情境 | 步驟與期望 | 結果 |
| --- | --- | --- |
| 1 登入並建立活動 | 錯誤密碼 →「驗證失敗，請重新登入或加入」；正確密碼 → 建立活動，房間碼 `6KXM2E`（6 碼、不含 I、O、0、1〔SC-006〕），第 1～6 組、準備中；重新整理仍在管理頁、房間碼相同、無建立按鈕；登出 → 登入頁，再開 `/teacher` 需重新登入 | 通過 |
| 2 調整設定 | 組數 8 → 出現第 7、8 組；純速度 → 視窗秒數欄位消失；組數 25 → 無法儲存 | 通過 |
| 3 學生加入 | 小寫房間碼 → 顯示各組與人數；第 1 組「小明」→ `/play` 顯示第 1 組／小明／準備中；「小明😀」→ 暱稱格式錯誤訊息；第 1 組再用「小明」→「這個暱稱在組內已被使用」；學生 B 以「Bob」加入第 5 組 | 通過 |
| 4 重連與重複加入 | 重新整理 `/play` 回到第 1 組／小明、老師端人數不變〔FR-025、SC-002〕；開 `/join` 直接導回 `/play`；兩個 `/play` 分頁關一個仍上線、兩個都關才離線 | 通過 |
| 5 減少組數被拒 | 第 5 組有成員時組數改 4 →「要移除的組別已有成員」，維持 8 組 | 通過 |

**補充檢查**

| 項目 | 結果 | 說明 |
| --- | --- | --- |
| (a) 1 秒內同步〔SC-001、SC-004〕 | 通過 | 碼錶計時：學生按加入 → 老師畫面出現成員 < 1 秒；老師儲存設定 → 學生畫面更新 < 1 秒（40 連線自動化量測屬 003 IT-PERF-01） |
| (b) 重啟後身分失效與上線恢復〔FR-036、FR-031〕 | 通過 | 學生在線時停止伺服器，再以 `npm run dev -w server`（同一根目錄 `.env` 與 `data/quiz.db`）啟動：老師原分頁自動導回登入頁；伺服器就緒當下的 API 快照為 `第 1 組/小明=offline, 第 5 組/Bob=offline`（2026-11-27T15:30:11Z），10 秒後兩人皆 `online`（學生分頁自動重連）；老師重新登入看到 `6KXM2E` 與成員、小明上線；學生 A 舊 `/play` 分頁維持第 1 組／小明 |
| (c) `/join?room=` 預填〔FR-027〕 | 通過 | 開啟 `room-code` 旁的加入網址 → `join-room` 已預填 |
| (d) 新分頁需登入〔FR-002〕 | 通過 | 已登入時在新分頁以網址開啟 `/teacher` → 導向登入頁（未測「複製分頁」，見 spec Assumptions） |

### T093 手動驗收（2026-11-27，基準 commit `fd9f4bb`）

| 項目 | 步驟 | 結果 |
| --- | --- | --- |
| (a) 伺服器無法連線時不重複加入（驗證 T091）〔FR-027a、FR-039〕 | 正式建置由伺服器提供前端，停止伺服器後 `/join` 本身無法載入（Edge「無法連上這個網站」），無法走到 T091 的路徑；因此改用開發模式：`npm run dev -w server`（3000）與 `npm run dev -w client`（5173）分開執行。學生 A 在 `:5173/join` 以「阿華」加入第 2 組 → `/play`；只停止 server；新分頁開 `:5173/join` → 顯示「發生未預期錯誤，請重新整理」、沒有加入表單、`localStorage` 的 `quiz.member` 仍在；重新啟動 server 後重新整理 → 導向 `/play`，回到第 2 組／阿華 | 通過 |
| (b) 設定超出範圍提示（驗證 T092）〔SC-003〕 | 管理頁組數改 21、視窗秒數改 0 → 皆顯示「輸入格式不正確」且無法儲存 | 通過 |

## 002-guided-notes-import

### T037 自動化驗證（2026-11-27，基準 commit `b38cde0` + 002 Phase 4 QA 變更）

**E2E（`npm run test:e2e`，Playwright 1.65.1、系統 Edge `channel: 'msedge'`）：4 個測試全部通過（25.6 s）**

| ID | 檔案 | 結果 | 截圖 |
| --- | --- | --- | --- |
| E2E-03 | `e2e/tests/identity.spec.ts` | 通過 | `e2e/artifacts/E2E-03.png` |
| E2E-18 | `e2e/tests/identity.spec.ts` | 通過 | `e2e/artifacts/E2E-18.png` |
| E2E-01 | `e2e/tests/import.spec.ts` | 通過（按下 `import-submit` 到 `import-summary` 出現 < 2000 ms 的斷言通過，SC-005） | `e2e/artifacts/E2E-01.png` |
| E2E-02 | `e2e/tests/import.spec.ts` | 通過 | `e2e/artifacts/E2E-02.png` |

- `import.spec.ts` 的 `beforeEach` 以 `POST /api/dev/fake-sheets/fixture-template-a/reset`、`…/fixture-template-b/reset` 重設（皆回 204，TEST_SPEC §7）。
- 系統只有一個活動：`btn-create-session` 存在才按。全套執行時沿用 E2E-03 已建立的活動；另以 `npm run test:e2e -- import` 單獨執行（新伺服器、無活動，走建立分支）也 2 個通過。
- E2E-02 的題號清單沒有專屬 `data-testid`（contracts/ui-testids.md），以 `import-summary` 所在區塊文字扣除摘要句後檢查「第 1～6 題」、無「第 7 題」、無「題組」。

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

其他 002 模組：`server/src/sheets/a1.ts` 100% / 100%；`fakeGateway.ts` 100% / 90.9%；`googleGateway.ts` 100% / 60.46%。

**排除清單**（`vitest.config.ts`）：`server/src/index.ts`（與型別宣告 `**/*.d.ts`）。`googleGateway.ts` 未排除：UT-GW-01、03 以 mock 的 `sheets_v4.Sheets` client 執行，實際連網只發生在 `index.ts` 建立 client 處（已排除）。未擴大排除、未調整門檻、未新增無 ID 的測試。

**plan.md Complexity Tracking 例外模組（無 TEST_SPEC 專屬 ID；由所列測試及 E2E-01／02 以建置版本實際執行，E2E 不計入 vitest 覆蓋率）**

| 檔案 | Lines | Branches | 覆蓋測試 |
| --- | --- | --- | --- |
| `server/src/http/devRoutes.ts` | 11.11% | 100% | E2E-01、02 的 `beforeEach` reset；T039 GET／reset 抽查 |
| `server/src/app.ts` | 83.87% | 75% | IT-AUTH-01～03、IT-ONLINE-01（`server/test/integration/startApp.ts` 組裝 app）；E2E-01、02 |
| `server/src/http/teacherRoutes.ts`（整檔，含 import 路由） | 80.39% | 80% | E2E-01、02 |
| `client/src/api.ts` | 13.91% | 100% | UT-UI-IMPORT（mock）；E2E-01、02 |
| `client/src/hooks/useTeacher.ts` | 50% | 76.47% | UT-UI-DASH、E2E-01、02 |
| `client/src/pages/TeacherDashboard.tsx` | 68.67% | 63.15% | UT-UI-DASH、E2E-01、02 |

### T039 手動驗收（2026-11-27）

**Google 模式（需要真實 Google 服務帳號）**

| ID | 項目 | 結果 | 日期／執行者 | 截圖 |
| --- | --- | --- | --- | --- |
| MA-01 | 依 README「Google Sheets 服務帳號設定」建立服務帳號、啟用 Sheets API、金鑰放 `secrets/service-account.json`、`.env` 設 `SHEETS_MODE=google` 後可啟動 | 通過：伺服器以 `SHEETS_MODE=google` 啟動，首頁正常顯示 | 2026-11-28／Kevin | [ma-01-start.png](screenshots/ma-01-start.png) |
| MA-02 | 把 `fixtures/sheets/template-a.xlsx`、`template-b.xlsx` 上傳為 Google Sheets 並共用給服務帳號後匯入：A 為 4 題、2 題組；B 為 6 題、0 題組（同 E2E-01、02） | 通過：A 匯入顯示「偵測到 4 題，其中 2 題組（共 4 子題）、2 單題」（第 1、2 題為題組（1）（2），第 3、4 題單題）；B 匯入顯示「偵測到 6 題，其中 0 題組（共 0 子題）、6 單題」（第 1～6 題）——與 E2E-01、02 一致 | 2026-11-28／Kevin | [ma-02-a.png](screenshots/ma-02-a.png)、[ma-02-b.png](screenshots/ma-02-b.png) |

**SC-003 其他 Guided Notes（如有）**

| 來源 | 匯入題數 | 題組判定 | 與原檔一致？ | 備註 |
| --- | --- | --- | --- | --- |
| （驗收當天若助教提供保留「題號／作答」表頭的另一份試算表，於此記錄） | | | | 未提供 |

**示範模式（`SHEETS_MODE=fake`）**

由 Claude 以正式建置（`server/dist`，port 3200、`DB_PATH=:memory:`）＋ Edge（Playwright 驅動，指令碼未提交）＋ socket.io-client 執行：

| 項目 | 步驟與期望 | 結果 |
| --- | --- | --- |
| MA-09 範例 ID | README 列出 `fixture-template-a`、`fixture-template-b`（功能清單、「Guided Notes 範本格式」與「示範模式」）；依 README 輸入 `fixture-template-a` → 「偵測到 4 題，其中 2 題組（共 4 子題）、2 單題」；匯入畫面無模式提示（`ImportForm` 只有標籤「試算表網址或 ID」、輸入框與按鈕） | 通過 |
| quickstart 2-4 | `hello` → 顯示「不是有效的 Google Sheets 網址」（INVALID_SPREADSHEET_URL）；`fixture-nope` → 「找不到試算表」；兩次階段皆維持「等待開始」、題數仍為 4 | 通過 |
| quickstart 2-5 | 學生加入第 1 組並以 member token 連 Socket，重新匯入 `fixture-template-b` → 該連線即時收到新的 `team:state`，`questions` 題號由 `[1,2,3,4]` 變為 `[1,2,3,4,5,6]`（學生畫面的題號顯示屬 003 AnswerCard） | 通過 |
| quickstart 2-6 | 重新整理老師頁 → 摘要「偵測到 6 題，其中 0 題組（共 0 子題）、6 單題」與題號清單仍在（FR-023） | 通過 |
| quickstart 2-7 | `GET /api/dev/fake-sheets/fixture-template-a` → 200 快照（`spreadsheetId`＝`fixture-template-a`、1 個工作表）；`POST …/fixture-template-a/reset` → 204；`POST …/fixture-nope/reset` → 404 `SHEETS_NOT_FOUND` | 通過 |

**請團隊以瀏覽器目視確認一次（可選）**：`npm run dev` → 老師登入、建立活動，依序輸入 `fixture-template-a`、`hello`、`fixture-nope`、`fixture-template-b`；另開無痕視窗以學生加入，在開發者工具 Network → WS 檢查 `team:state` 的 `questions`；最後重新整理老師頁。結果與上表一致即可在此補記「目視確認：通過（日期、確認人）」。

### T040 機密與資訊隔離（2026-11-27）

| 檢查 | 結果 | 說明 |
| --- | --- | --- |
| `git ls-files` 不含 `.env`、`secrets/`、金鑰 `*.json` | 通過 | 受版控的 `*.json` 只有 `package*.json`、`tsconfig*`、`.specify/*` 與 `fixtures/sheets/template-{a,b}.{snapshot,expected}.json`（皆非金鑰）；`.gitignore` 含 `.env`、`secrets/` |
| `git grep -n private_key` | 通過 | 只出現在 `docs/TEST_SPEC.md`、`specs/*/tasks.md` 的檢查說明文字；程式、測試、fixtures、README 無結果；`git grep "BEGIN PRIVATE KEY"` 無結果 |
| `TEACHER_PASSWORD=` 實值 | 通過 | 只有 `.env.example` 的 `change-me` 與文件中的 E2E 測試密碼 `e2e-pass` |
| `team:state` 的 `questions` 欄位 | 通過 | 實際收到的 payload 每題鍵值只有 `id`、`number`、`isGroup`、`subCount`、`subLabels`（憲章 IV） |
| `team:state` 不含題目敘述 | 通過 | 取範例 A、B 快照中 12 個長度 ≥ 12 的字串（題目敘述）逐一比對所有收到的 `team:state` JSON：0 筆出現（憲章 VI） |

### T041 Phase 4 驗收（2026-11-27）

- `npm test`：46 檔、288 測試全部通過；`npm run lint`（eslint ＋ 4 個 workspace typecheck，含 `e2e`）通過；`npm run test:e2e` 4 個全部通過；`skip`／`todo`／`fixme`／`only` 數量為 0。
- TECH_SPEC §14.1 002 列測試 ID 核對：UT-A1-01～07、UT-PARSE-01～22、UT-GW-01、03、04、UT-SVC-IMPORT-01～06、UT-PROJ-01、UT-UI-IMPORT-01～04、E2E-01、02 皆有對應且通過的測試；MA-09 通過；MA-01、MA-02 待 Kevin 執行（見 T039）。
- 憲章原則 XI 圖表比對（程式碼與圖一致，未修改圖檔；`java -jar plantuml.jar -checkonly "./diagrams/002-*.puml"` 無錯誤）：
  - `002-component.puml`：TeacherDashboard／ImportForm／ImportSummary／ErrorBanner／useTeacher 的顯示條件與 `data-testid` 與 `client/src` 一致；`index.ts` 依 `SHEETS_MODE` 組裝 `createGoogleGateway`／`createFakeGateway`，`app.ts` 只在有 fake gateway 時掛載 `/api/dev`；parser → `toA1`、googleGateway → `quoteSheet`、SessionService → `parseSpreadsheetInput`／`fetchSnapshot`／`parseGuidedNotes`／Repo／Broadcaster 連線皆存在。googleGateway 另使用 `rangeA1`，僅在 `writeCells`（圖中標示由 004 實作），不屬 002 互動。
  - `002-class.puml`：GridRange、SheetData、SheetSnapshot、CellWrite、ParseWarning(Code)、ParseResult、ParsedQuestion、ParsedSlot、ImportSummary、Session、Question、AnswerSlot、QuestionInfo 欄位與 `shared/src/types.ts` 逐欄一致；`a1` 五個匯出函式、`parseGuidedNotes`／`summarize`、`questionInfo(q, slots)`、`SheetsGateway` 兩個方法、`createFakeGateway(dir, outDir?)` 的 `getSnapshot`／`reset`、`devRoutes(fake)`、`SessionAggregate.importSummary`、Repo 七個方法與 `importSheet` 簽名皆一致。
  - `002-sequence.puml`：`importSheet` 依序 `assertPhase` → `parseSpreadsheetInput` → `fetchSnapshot` → `parseGuidedNotes` → `summarize` → 交易內 `nextPhase`（含 assertPhase）→ 刪除舊題目 → 寫入題目／作答格／摘要 → 交易後 `publish`；失敗分支在交易前丟錯、不寫入不推播，與 `server/src/services/sessionService.ts` 一致。

## 004-results-export

### T041 手動驗收（Google 模式）

MA-03～05：`SHEETS_MODE=google`，試算表為範例 A（`template-a.xlsx` 上傳為 Google Sheets）。MA-07 已執行；MA-06 待 Demo 錄製時執行，MA-08 的 Demo 影片部分待錄製後確認。

| ID | 項目 | 結果 | 日期／執行者 | 截圖 |
| --- | --- | --- | --- | --- |
| MA-03 | 真實寫回：前後截圖比對作答格為「前綴＋答案」，格式、合併與其他儲存格不變 | 通過：寫回後作答格依序為 G5「（1）A」、G6「（2）B」、G8「（1）123」、G9「（2）456」、G11「test123456」、G13「asdfgvb」——題組子題保留原前綴「（1）」「（2）」、單題只寫答案；題號、題目敘述、框線與題號欄的縱向合併與寫回前相同（依截圖比對） | 2026-11-28／Kevin | [ma-03-before.png](screenshots/ma-03-before.png)、[ma-03-after.png](screenshots/ma-03-after.png) |
| MA-04 | 真實還原：還原後與匯入前一致 | 通過：按「還原原始內容」後管理頁顯示「已還原 6 格」；試算表 G5、G6、G8、G9 恢復為「（1）」「（2）」前綴、G11、G13 恢復為空白，與 ma-03-before 一致 | 2026-11-28／Kevin | [ma-04-restored.png](screenshots/ma-04-restored.png) |
| MA-05 | 未共用給服務帳號的試算表 → 權限錯誤訊息 | 通過：顯示「沒有權限存取試算表，請將試算表共用給服務帳號」 | 2026-11-28／Kevin | [ma-05-denied.png](screenshots/ma-05-denied.png) |
| MA-06 | 老師＋3 組（含 1 組 2 人）四分割完成一輪 | 待 Demo 錄製時執行（組員回報將於錄製 Demo 時一併操作並截圖） | | （預定 `screenshots/ma-06-demo.png`） |
| MA-07 | `git log -p` 搜尋 `private_key`、`TEACHER_PASSWORD=` 實值 → 無結果 | 通過：`git log --all -p`（67 個 commit）中 `private_key` 只出現在 `docs/TEST_SPEC.md`、`specs/*/tasks.md`、`docs/manual-test.md` 的檢查說明文字；`BEGIN PRIVATE KEY` 只出現在 002 T040 的說明文字（無金鑰內容）；`TEACHER_PASSWORD=` 的值只有 `.env.example` 的 `change-me` 與 E2E 專用 `e2e-pass`；`.env`、`secrets/`、`service-account*`、`credentials*` 從未被追蹤（`git log --all --name-only` 無結果），`.gitignore` 第 4～6 行涵蓋 `data/`、`secrets/`、`.env` | 2026-11-28／Claude（指令輸出未存檔） | — |
| MA-08 | spec、`diagrams/*.puml`、README 功能清單、Demo 內容逐項一致 | 部分完成：spec ↔ README 功能清單 ↔ `diagrams/004-*.puml` 已逐項比對（Claude，2026-11-28），功能一致；圖表 3 處標示差異已處理（`docs/test-report.md` Q-007，已解決）。Demo 影片尚未錄製，**待錄製後確認** | 2026-11-28／Claude（文件部分） | — |
