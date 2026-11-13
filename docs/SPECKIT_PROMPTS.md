# SpecKit 提示詞（4 個子功能）

| 項目 | 內容 |
| --- | --- |
| 版本 | v1.0（2026-11-13），對應 PRD v1.0、TECH_SPEC v1.2、TEST_SPEC v1.1 |
| 使用者 | Kevin（規格與後端）、組員（前端與驗證） |
| 指令格式 | Claude Code 的 SpecKit 技能：`/speckit-xxx`（連字號） |

## 0. 使用方式

1. 子功能依序開發：001 → 002 → 003 → 004。每個子功能的範圍與必須通過的測試，以 `docs/TECH_SPEC.md` §14.1 為準。
2. 每個子功能的步驟與負責人：

| 步驟 | 指令 | 負責 | 分支 |
| --- | --- | --- | --- |
| 1 | `/speckit-specify` | Kevin | `spec/00N` |
| 2 | `/speckit-clarify`（重複到沒有問題） | Kevin | `spec/00N` |
| 3 | `/speckit-plan` | Kevin | `spec/00N` |
| 4 | `/speckit-tasks` | Kevin | `spec/00N` |
| 5 | `/speckit-analyze` → 修正 → 再 analyze | Kevin | `spec/00N`，完成後開 PR 由組員審 |
| 6a | `/speckit-implement`（[BE]） | Kevin | `be/00N` |
| 6b | `/speckit-implement`（[FE]） | 組員 | `fe/00N` |
| 7 | `/speckit-converge` → 補做 → 再 converge | 組員 | `qa/00N` |
| 8 | `/speckit-implement`（[QA]） | 組員 | `qa/00N` |

3. **每一步之前**先確認 `.specify/feature.json` 指向正確的子功能（此檔已加入 `.gitignore`，每個人自己維護）：

```powershell
Get-Content .specify/feature.json
Set-Content .specify/feature.json '{"feature_directory":"specs/001-session-and-join"}'
```

4. 每次對話開新的 Claude Code 工作階段，避免上一個子功能的內容干擾。對話結束用 `/export` 保存紀錄（Google 表單要交）。
5. 提示詞中的 `00N`、資料夾名稱已依子功能填好，直接整段複製。

---

## 1. 每個子功能都相同的提示詞

### 1.1 clarify

```text
/speckit-clarify
回答依據以 docs/PRD.md 為準；PRD 沒有規定、且會影響功能行為的問題，請列出來讓我決定，不要自行假設。
```

AI 提問後逐一回答。若答案改變了功能行為，先更新 `docs/PRD.md`，並通知 OpenSpec 組。重複執行到 AI 回報沒有需要釐清的問題。

### 1.2 analyze 與修正

```text
/speckit-analyze
```

讀完報告後輸入：

```text
請針對分析報告中的每個問題提出具體修正，並直接修改 spec.md、plan.md、tasks.md。
判斷依據的優先順序：.specify/memory/constitution.md → docs/PRD.md → docs/TECH_SPEC.md → docs/TEST_SPEC.md。
修正後確認 docs/TECH_SPEC.md §14.1 本子功能列出的每個測試 ID 都出現在 tasks.md 中。
```

再執行一次 `/speckit-analyze`，直到沒有 CRITICAL 與 HIGH 等級的問題。

### 1.3 converge（組員，[BE] 與 [FE] 都合併到 main 之後）

```text
/speckit-converge
比對範圍以 docs/TECH_SPEC.md §14.1 中本子功能那一列、以及 docs/TEST_SPEC.md 對應的測試案例為準。
新增的待辦任務請標上 [BE]、[FE] 或 [QA]，並寫出要修改的檔案路徑。
```

有新增 [BE] 任務就交給 Kevin，[FE] 由組員處理，各自再執行一次第 6 步的 implement 提示詞，然後重新 converge，直到沒有新增任務。

### 1.4 [QA] 任務（組員，converge 沒有新增任務之後）

```text
/speckit-implement
只執行 tasks.md 中標記 [QA] 的任務。規則：
1. 遵守 docs/TEST_SPEC.md §0：只新增或修改 server/test/integration、client/test、e2e/ 與 docs/test-report.md，不得修改 shared/src、server/src、client/src。
2. 測試名稱必須包含 TEST_SPEC 的案例 ID。
3. E2E 以 SHEETS_MODE=fake 啟動，只用 data-testid 選取元素，瀏覽器使用 channel: 'msedge'。
4. 測試失敗時不要修改產品程式，也不要放寬斷言；依 TEST_SPEC §9.1 的格式把缺陷寫進 docs/test-report.md，並註明違反的 TECH_SPEC 或 PRD 條文。
5. 最後執行 npm test、npm run test:e2e、npm run lint，把結果摘要寫進 docs/test-report.md。
```

缺陷依標記交回 Kevin（後端）或組員（前端）修正。

---

## 2. 子功能 001：建立活動與加入（session-and-join）

feature.json：`{"feature_directory":"specs/001-session-and-join"}`

### 2.1 specify

```text
/speckit-specify
子功能編號 001，short name 為 session-and-join，資料夾名稱必須是 specs/001-session-and-join。
撰寫「建立活動與加入」子功能的規格。需求來源：docs/PRD.md §3、§4、§5、§8 第 1 與第 8 點、§10、E7、FR-12。只描述使用者行為、規則與邊界情況，不要指定框架或工具。

【使用者情境】
1. 老師登入：老師輸入管理密碼進入管理頁；密碼錯誤顯示「驗證失敗」訊息；在同一個瀏覽器分頁重新整理後仍維持登入。
2. 建立活動：老師建立活動後取得 6 碼房間碼（大寫英文與數字，不含容易混淆的 I、O、0、1），預設 6 組（名稱為「第 1 組」…「第 6 組」）、判定模式為公平模式、視窗 3 秒。活動初始階段為「準備中」。
3. 調整設定：只有在「準備中」或「等待開始」階段可以修改；組數 2–20；判定模式為「公平」或「純速度」；視窗秒數 1–10，只有公平模式才顯示。減少組數時，若要被移除的組已有成員，拒絕並提示。
4. 學生加入：學生輸入房間碼（不分大小寫）→ 看到各組名稱與目前人數 → 選擇組別 → 輸入暱稱（去除前後空白後 1–20 字，同一組內不可重複，不分大小寫）→ 進入作答頁，看到組名、自己的暱稱與組員名單。任何階段都可以加入。
5. 自動重連：學生重新整理頁面或斷線後，自動回到原本的組別與暱稱，不需重新加入；若憑證已失效，導回加入頁並自動帶入原房間碼。老師重新整理後回到管理頁。
6. 即時名單：老師即時看到每組的成員與上線狀態。同一位成員開多個分頁時，全部分頁關閉才顯示離線。
7. 階段顯示：老師與學生頁面都顯示目前階段（準備中／等待開始／搶答中／已結束），階段改變時所有人的畫面即時同步。本子功能只建立同步機制，開始與結束搶答屬於 003。

【邊界情況】
房間碼不存在或位數不對、房間碼為小寫、組別不屬於該活動、暱稱空白或超過 20 字、同組暱稱只差大小寫、減少組數時被移除的組已有成員、非允許階段修改設定、未登入呼叫老師功能、學生憑證被拿去呼叫老師功能、老師憑證被拿去呼叫學生功能、即時連線使用錯誤憑證、同一成員開多個分頁後逐一關閉。

【成功標準】
- 學生加入後，老師畫面在 1 秒內出現該成員。
- 學生重新整理後不需任何操作即回到原組別。
- 所有錯誤都顯示繁體中文訊息（訊息內容見 docs/TECH_SPEC.md §11）。

【不在本子功能範圍】
匯入題目（002）、開始／結束搶答與作答（003）、結果與匯出（004）。

【圖表】依憲章原則 11 產生：
- diagrams/001-component.puml：老師端、學生端、伺服器（驗證、活動服務、即時推播）、資料庫之間的關係
- diagrams/001-class.puml：Session、Team、Member、AuthService、SessionService（本子功能用到的方法）
- diagrams/001-sequence.puml：老師登入並建立活動；學生加入；學生斷線後重連
完成後執行 java -jar plantuml.jar "./diagrams/*.puml" 產生 PNG，並確認沒有錯誤。
```

### 2.2 plan

```text
/speckit-plan
【技術選擇】依 docs/TECH_SPEC.md §2、§3：
- TypeScript strict；npm workspaces：shared、server、client、e2e
- 後端：Node.js 22.13 以上、Express 4、Socket.IO 4、zod；資料庫使用 Node 內建的 node:sqlite（DatabaseSync）
- 前端：React 18、Vite、React Router 6
- 測試：Vitest（含 coverage-v8 與 TEST_SPEC §2.3 的覆蓋率門檻）、@testing-library/react、supertest、socket.io-client、Playwright（channel: 'msedge'，不下載 Playwright 瀏覽器）
- 禁止加入 better-sqlite3 或任何需要 .node 原生模組的套件：開發機啟用 Windows 智慧型應用程式控制，會擋下未簽章的原生模組
- 預設 SHEETS_MODE=fake，不需要 Google 金鑰即可開發與測試

【範圍】以 docs/TECH_SPEC.md §14.1 中「001-session-and-join」一列為準，不要實作其他列的內容。
本子功能需要的章節：§2 專案結構、§3 指令與設定、§4 共用型別（全部）、§5 資料庫（建立全部資料表）、§6 階段狀態機、§7.1 依賴介面、§7.8 projections（只做 session、teams、members）、§7.9 中 createSession、getCurrentSession、getTeacherView、updateSettings、getPublicInfo、join、resolveMember、getTeamView、setOnline、§7.10、§7.11、§8.1 的 login 與 sessions 相關路由、§8.2、§8.3 的 GET /state、§9、§10.1–§10.3、§10.4 中本列列出的元件、§10.6、§11。
測試替身依 docs/TEST_SPEC.md §3。

【約束】
- 型別、函式簽名、API 路徑、Socket 事件、錯誤碼、data-testid 必須與 TECH_SPEC 完全一致，不得改名。
- 以 diagrams/001-*.puml 為主要藍圖；圖表與 TECH_SPEC 衝突時，先列出差異問我，不要自行決定。
- shared/ 的型別、錯誤碼、常數、驗證函式在本子功能一次做完整（後續子功能會用到），其餘模組只做本列範圍。
```

### 2.3 tasks

```text
/speckit-tasks
依 plan 拆成可驗證的 Phase，任務編號連續：
- Phase 1 Setup [BE]：專案骨架（workspaces、tsconfig、ESLint、Vitest 與覆蓋率設定、.env.example、npm scripts）與 shared/ 全部（types、errors、constants、validation 及其測試）。這個 Phase 會先單獨合併到 main，前端才能開始，所以只放骨架與 shared/。
- Phase 2 後端 [BE]：ports 與測試替身 → db 與 repo → domain/phase → projections → services → HTTP 路由 → Socket 與 broadcaster。
- Phase 3 前端 [FE]：api、socket、storage、messages → hooks → 元件 → 頁面。
- Phase 4 整合與 E2E [QA]：Playwright 設定與 E2E-03、IT-AUTH-01～03、IT-ONLINE-01。
規則：
1. 每個實作任務之前都有對應的測試任務，並標註 docs/TEST_SPEC.md 的案例 ID；docs/TECH_SPEC.md §14.1 本列的每個測試 ID 都必須出現在某個任務中。
2. [BE] 與 [FE] 任務不得修改同一個檔案；前端需要的型別只能從 shared/ 匯入。
3. 每個任務寫出要建立或修改的檔案路徑。
4. 每個 Phase 的最後一個任務是「執行 npm test 與 npm run lint 全部通過，並依憲章原則 11 比對程式碼與 diagrams/001-*.puml」。
```

### 2.4 implement — Kevin

001 要分兩次執行。第一次只做 Phase 1，合併到 main 後組員才能開始前端：

```text
/speckit-implement
只執行 tasks.md 中 Phase 1 的任務。
每個任務先寫測試（測試名稱含 TEST_SPEC 案例 ID），確認失敗後再實作到通過。
完成後執行 npm test 與 npm run lint，全部通過後在 tasks.md 勾選完成的任務。
```

合併 Phase 1 後，從 main 開 `be/001` 執行：

```text
/speckit-implement
只執行 tasks.md 中 Phase 2 標記 [BE] 的任務。規則：
1. 每個任務先寫測試（測試名稱含 TEST_SPEC 案例 ID），確認失敗後再實作到通過。
2. 不要修改 client/ 與 e2e/，也不要實作 docs/TECH_SPEC.md §14.1 其他子功能的內容；測試需要 RUNNING 或 ENDED 階段時，直接用 repo 設定 session.phase。
3. 每完成一組相關任務就執行 npm test 與 npm run lint，必須全部通過才繼續。
4. 完成後依憲章原則 11 比對程式碼與 diagrams/001-*.puml，列出不一致處；要修改圖或程式之前先問我。
5. 在 tasks.md 勾選完成的任務。
```

### 2.5 implement — 組員

Phase 1 合併後，從 main 開 `fe/001` 執行：

```text
/speckit-implement
只執行 tasks.md 中 Phase 3 標記 [FE] 的任務。規則：
1. 只修改 client/；型別一律從 shared/ 匯入，不要修改 shared/ 與 server/。
2. 後端尚未合併前，元件與 hooks 的測試以 vi.mock 模擬 api.ts 與 socket.ts，回傳資料符合 docs/TECH_SPEC.md §4、§8、§9 的型別。
3. data-testid 必須與 docs/TECH_SPEC.md §10.4 完全一致；畫面文字使用繁體中文，錯誤訊息使用 §11 的內容。
4. 每個元件、hook、storage 函式都要有測試，測試名稱含 TEST_SPEC 案例 ID；完成後執行 npm test 與 npm run lint 全部通過。
5. 完成後依憲章原則 11 比對程式碼與 diagrams/001-*.puml，列出不一致處。
6. 在 tasks.md 勾選完成的任務。
```

---

## 3. 子功能 002：匯入 Guided Notes（guided-notes-import）

feature.json：`{"feature_directory":"specs/002-guided-notes-import"}`

### 3.1 specify

```text
/speckit-specify
子功能編號 002，short name 為 guided-notes-import，資料夾名稱必須是 specs/002-guided-notes-import。
撰寫「匯入 Guided Notes」子功能的規格。需求來源：docs/PRD.md FR-01、FR-02、E1（題組辨識）、§8 第 10 點、§9。只描述使用者行為、規則與邊界情況，不要指定框架或工具。

【使用者情境】
1. 老師在「準備中」或「等待開始」階段，貼上 Google Sheets 網址或試算表 ID 後按「匯入」。
2. 系統依 docs/PRD.md §9 辨識題目，不寫死任何儲存格位置：
   - 任一工作表中，同一列同時有「題號」與「作答」的儲存格為表頭；兩者所在欄為題號欄與作答欄（合併儲存格取左上角）。依工作表順序取第一個有表頭的工作表。
   - 表頭列以下，題號欄為整數的列是一題的起點（容許「1」「1.0」與前後空白）。
   - 題號儲存格縱向合併 n 列（n > 1）代表含 n 個子題的題組；否則為單題。
   - 子題編號取作答格開頭的「（n）」或「(n)」；沒有則依列序 1..n。
   - 題號欄空白的列（含間隔列）略過。
   - 合併資訊遺失時：作答格開頭為「（1）」且下方連續列的題號欄空白、作答格依序為「（2）」「（3）」…，也視為題組。
3. 匯入成功後顯示摘要「偵測到 N 題，其中 M 題組（共 K 子題）、L 單題」與題號清單（題組列出子題標籤），活動進入「等待開始」。
4. 題目只以題號表示，不匯入、不顯示題目敘述。
5. 系統保存每個作答格的位置與原始內容，供 004 寫回與還原。
6. 等待開始階段可重新匯入，新的題目完全取代舊的。
7. 沒有設定 Google 金鑰時（示範模式），可輸入「fixture-template-a」或「fixture-template-b」匯入專案內的兩份範例。

【驗收範例】
- 範例 A（fixtures/sheets/template-a）：4 題；第 1 題（作答格 G5、G6）與第 2 題（G8、G9）為題組，各 2 子題，前綴為「（1）」「（2）」；第 3 題（G11）、第 4 題（G13）為單題。
- 範例 B（fixtures/sheets/template-b）：6 題，皆為單題，作答格 G5、G7、G9、G11、G13、G15。
- 範例 A 整體往下移 2 列、往右移 1 欄後匯入，題目結構相同，作答格變為 H7、H8、H10、H11、H13、H15。
- 完整期望值見 fixtures/sheets/template-a.expected.json 與 template-b.expected.json。

【錯誤與警告】
- 錯誤（不匯入、階段不變）：不是有效的網址或 ID、試算表沒有共用給服務帳號、找不到試算表、找不到「題號」「作答」表頭（附上格式說明）、沒有任何題目、題號重複（訊息含重複的題號）、搶答中或已結束時匯入。
- 警告（仍匯入，顯示在摘要）：題號不是從 1 連續、題組子題編號不是 1..n 遞增（自動重編）。

【成功標準】
- 兩份範例皆 100% 正確辨識，換範例不需改程式。
- 助教用另一份保留「題號／作答」表頭的 Guided Notes 也能匯入。

【不在本子功能範圍】寫回與還原（004）、學生作答（003）。

【圖表】依憲章原則 11 產生：
- diagrams/002-component.puml：老師端、匯入服務、解析器、試算表閘道（Google 與示範模式兩種實作）、資料庫
- diagrams/002-class.puml：ParseResult、ParsedQuestion、ParsedSlot、Question、AnswerSlot、SheetsGateway
- diagrams/002-sequence.puml：老師匯入成功；匯入失敗（找不到表頭）
完成後執行 java -jar plantuml.jar "./diagrams/*.puml" 產生 PNG，並確認沒有錯誤。
```

### 3.2 plan

```text
/speckit-plan
【技術選擇】沿用 001 的 plan（TypeScript、Express、Socket.IO、node:sqlite、React、Vitest、Playwright msedge）。禁止加入需要 .node 原生模組的套件。Google Sheets 使用 googleapis（服務帳號、scope 只用 https://www.googleapis.com/auth/spreadsheets），金鑰路徑放在 .env 的 GOOGLE_APPLICATION_CREDENTIALS，不得提交。

【範圍】以 docs/TECH_SPEC.md §14.1 中「002-guided-notes-import」一列為準，不要實作其他列的內容。
本子功能需要的章節：§3.4 環境變數、§4 的 SheetSnapshot、GridRange、ParsedSlot、ParsedQuestion、ParseResult、ImportSummary、QuestionInfo、§5 的 questions 與 answer_slots、§7.2、§7.3（演算法 10 個步驟必須逐條實作）、§7.4 中 googleGateway 的 fetchSnapshot 與錯誤對照、fakeGateway 的 fetchSnapshot、getSnapshot、reset、§7.3 的 summarize、§7.8 的 questionInfo、§7.9 importSheet（前置條件、效果、錯誤）、§8.1 import 路由、§8.4、§10.4 的 ImportForm、ImportSummary、§11。
測試資料使用 fixtures/sheets/ 的 snapshot 與 expected 檔，測試替身 fixtures.ts 依 docs/TEST_SPEC.md §3。

【約束】
- 型別、函式簽名、API 路徑、錯誤碼、data-testid 必須與 TECH_SPEC 完全一致。
- 禁止寫死任何儲存格位址；寫回位置只能來自解析結果。
- 以 diagrams/002-*.puml 為主要藍圖；與 TECH_SPEC 衝突時先列出差異問我。
```

### 3.3 tasks

```text
/speckit-tasks
依 plan 拆成可驗證的 Phase，任務編號連續：
- Phase 2 後端 [BE]：a1.ts → parser.ts 與 summarize（先用 fixtures 寫完 UT-PARSE-01～20）→ fakeGateway、googleGateway 讀取 → repo（questions、answer_slots）→ importSheet → projections 的 questionInfo 與 importSummary → import 路由、devRoutes、config 依 SHEETS_MODE 組裝 gateway。
- Phase 3 前端 [FE]：useTeacher.importSheet → ImportForm、ImportSummary → TeacherDashboard 的 READY 題號清單。
- Phase 4 整合與 E2E [QA]：E2E-01、E2E-02。
規則：
1. 每個實作任務之前都有對應的測試任務，並標註 docs/TEST_SPEC.md 的案例 ID；docs/TECH_SPEC.md §14.1 本列的每個測試 ID 都必須出現在某個任務中。
2. [BE] 與 [FE] 任務不得修改同一個檔案。
3. 每個任務寫出要建立或修改的檔案路徑。
4. 每個 Phase 的最後一個任務是「執行 npm test 與 npm run lint 全部通過（含 001 的測試），並依憲章原則 11 比對程式碼與 diagrams/002-*.puml」。
```

### 3.4 implement — Kevin（`be/002`）

```text
/speckit-implement
只執行 tasks.md 中 Phase 2 標記 [BE] 的任務。規則：
1. 每個任務先寫測試（測試名稱含 TEST_SPEC 案例 ID），確認失敗後再實作到通過。parser 的測試必須以 fixtures/sheets/*.expected.json 深度比對。
2. 不要修改 client/ 與 e2e/，也不要實作 docs/TECH_SPEC.md §14.1 其他子功能的內容（例如 writeCells 屬於 004）。
3. 每完成一組相關任務就執行 npm test 與 npm run lint，001 的測試也必須保持通過。
4. 完成後依憲章原則 11 比對程式碼與 diagrams/002-*.puml，列出不一致處；要修改圖或程式之前先問我。
5. 在 tasks.md 勾選完成的任務。
```

### 3.5 implement — 組員（`fe/002`）

```text
/speckit-implement
只執行 tasks.md 中 Phase 3 標記 [FE] 的任務。規則：
1. 只修改 client/；型別從 shared/ 匯入，不要修改 shared/ 與 server/。
2. 後端尚未合併前，以 vi.mock 模擬 api.ts，匯入結果使用範例 A 的摘要（4 題、2 題組、2 單題、4 子題）。
3. data-testid 必須與 docs/TECH_SPEC.md §10.4 一致（import-input、import-submit、import-summary、import-question-count、import-group-count、import-warning-{i}）；找不到表頭的錯誤要顯示表頭格式說明。
4. 每個元件與 hook 都要有測試，測試名稱含 TEST_SPEC 案例 ID；完成後執行 npm test 與 npm run lint 全部通過。
5. 完成後依憲章原則 11 比對程式碼與 diagrams/002-*.puml，列出不一致處。
6. 在 tasks.md 勾選完成的任務。
```

### 3.6 手動驗收（Kevin，002 合併後）

- MA-01：建立 Google Cloud 專案、啟用 Sheets API、建立服務帳號並下載金鑰到 `secrets/`，`.env` 設 `SHEETS_MODE=google` 後可啟動。
- MA-02：把兩份範例上傳成 Google Sheets 並共用給服務帳號，匯入結果與 E2E-01、E2E-02 相同。結果截圖記錄在 `docs/manual-test.md`。

---

## 4. 子功能 003：搶答進行（live-quiz）

feature.json：`{"feature_directory":"specs/003-live-quiz"}`

003 是最大的子功能。Kevin 的 implement 分三次執行，見 4.4。

### 4.1 specify

```text
/speckit-specify
子功能編號 003，short name 為 live-quiz，資料夾名稱必須是 specs/003-live-quiz。
撰寫「搶答進行」子功能的規格。需求來源：docs/PRD.md FR-03、FR-04、FR-07、FR-08、FR-10、FR-11、FR-12、E1（題組送出）、E3、E4、E7、§5、§8 第 1～7 點、§10。只描述使用者行為、規則與邊界情況，不要指定框架或工具。

【老師】
1. 開始搶答：「等待開始」階段且已匯入至少 1 題時可按開始；所有人的畫面在 1 秒內切換為「搶答中」。
2. 即時狀態表：以「題號 × 組別」顯示每格狀態：未送出（—）、已送出（答案、送出者暱稱、時間精確到毫秒、順位，尚未判定時顯示「判定中」）、得主（★ 得主）、已撤回、被判錯（✗ 判錯；判錯功能本身屬於 004，這裡只負責顯示）。題組答案以「（1）A／（2）B」顯示。公平模式視窗進行中，該題欄位顯示「判定中」與剩餘秒數倒數。任一組送出後，老師畫面在 500 毫秒內更新。
3. 結束搶答：按結束時，先對所有仍在視窗中的題目立即判定，再進入「已結束」。結果畫面屬於 004，但結束時系統必須已產生完整結果資料。
4. 重新開始一輪：「已結束」後可重新開始，清除所有送出與草稿，保留題目、組別與成員，回到「等待開始」。

【學生】
5. 「搶答中」以外的階段，作答輸入框與送出按鈕都鎖定，伺服器也拒絕送出（FR-07）。
6. 每題一張作答卡；題組依子題顯示多個輸入框並標示（1）（2）。
7. 組內共編：同組成員看到同一份草稿，任一人輸入後 1 秒內同步給組員；草稿不傳給其他組與老師。
8. 送出：任一組員按送出即代表全組；題組必須每個子題都填寫；每格去除前後空白後 1–200 字；每組每題只採計一份有效答案，組員重複送出時提示「本組已送出此題」。送出後顯示「已送出 HH:mm:ss」。
9. 撤回：送出後 10 秒內顯示「撤回（n 秒）」倒數，按下即撤回，作答卡恢復可編輯並帶入原答案；10 秒後按鈕消失。撤回後可重新送出，新送出以新的時間計算。
10. 資訊隔離（FR-10）：搶答結束前，學生看不到其他組的任何資訊，包括是否已有人送出、答案、順位、得主、分數、判定中狀態；必須由伺服器過濾，不能只靠畫面隱藏。學生只看得到本組送出的狀態。
11. 重新整理或斷線後回到原狀態：草稿、送出狀態、撤回倒數都保留。

【判定規則】
12. 時間一律以伺服器收到請求的時間為準；同一毫秒以伺服器處理先後決定，同一題保證只有一位得主。
13. 純速度模式：每題第一個有效送出即為得主，其他依時間排序。
14. 公平模式（E3）：某題收到第一筆送出時開啟 W 秒視窗（W 為活動設定，預設 3）。視窗結束時，視窗內所有有效送出依「目前得分少者優先 → 同分則較早送出者優先」排序，第一名為得主。目前得分以結算當下已判定的題目計算。多題視窗同時到期時，依到期時間、再依題號先後結算，前一題的結果會影響後一題的分數。
15. 得主決定後，其他組仍可送出，依時間排在已判定名次之後，作為遞補候選。
16. 計分：每題（含題組）得主得 1 分。
17. 撤回對判定的影響：撤回的送出不列入名次；撤回的若是得主，依既有順位由下一個有效送出遞補；視窗中唯一的候選撤回時，該題回到未作答，下一筆送出重新開啟視窗。
18. 伺服器重啟後，未結束的視窗依原到期時間繼續；已過期的立即結算。

【驗收範例】
- 純速度：A 組在 t 送出、B 組在 t+80 ms 送出同一題 → A 得主、B 第 2 名。
- 公平模式 3 秒：A 組（2 分）t=0 送出、B 組（0 分）t=1 秒送出 → B 得主、A 第 2 名；若 B 在 t=4 秒才送出 → A 得主。
- 20 組在同一毫秒送出同一題 → 恰 1 位得主，順位 1～20 不重複。
- 開始前送出 → 被拒絕；題組少填一格 → 被拒絕；送出後恰好 10 秒撤回 → 成功，10.001 秒 → 被拒絕。

【邊界情況】
開始前或結束後送出、同組兩人同時送出、多組同一毫秒送出、題組少填、答案超過 200 字或只有空白、送出不存在或其他活動的題目、撤回別組的送出、重複撤回、結束時仍有視窗、兩題視窗同時到期、視窗中唯一候選撤回、得主撤回、伺服器重啟、10 組 × 4 人（40 個連線）同時在線。

【不在本子功能範圍】結果畫面、老師判錯、寫回 Google Sheets、CSV（004）。

【圖表】依憲章原則 11 產生：
- diagrams/003-component.puml：老師端、學生端、搶答服務、判定（排名、結算）、即時推播（老師 room 與各組 room）、排程器、資料庫
- diagrams/003-class.puml：Question、Submission、Draft、TeacherView、TeamView、ranking 與 settlement 的函式、SessionService 本子功能方法
- diagrams/003-sequence.puml：純速度送出與推播；公平模式視窗結算；撤回後遞補
完成後執行 java -jar plantuml.jar "./diagrams/*.puml" 產生 PNG，並確認沒有錯誤。
```

### 4.2 plan

```text
/speckit-plan
【技術選擇】沿用 001 的 plan。禁止加入需要 .node 原生模組的套件。

【範圍】以 docs/TECH_SPEC.md §14.1 中「003-live-quiz」一列為準，不要實作其他列的內容。
本子功能需要的章節：§1 設計原則、§4 的 Submission、Draft、RankedSubmission、TeacherCell、TeacherView、TeamView、Results、§5 的 drafts、submissions 與唯一索引、§6、§7.1 的 Clock 與 Scheduler、§7.6、§7.7、§7.8（projectTeacherView、projectTeamView、buildResults 及 FR-10 強制約束）、§7.9 的 start、end、reset、updateDraft、submit、withdraw、settleWindow 與 submit、settleWindow 演算法、§7.12、§8.1 的 start、end、reset、§8.3 的 drafts、submissions、withdraw、§9.2、§9.3、§10.3、§10.4 的 ControlBar、StatusGrid（StatusCell 規則）、AnswerCard（狀態表）、§11、§12.3～§12.5、§13。
測試替身 seed.ts、ManualScheduler 依 docs/TEST_SPEC.md §3。

【約束】
- submit 與 settleWindow 必須在單一同步交易中完成（withTransaction），保證同一題只有一位得主。
- 得主、順位、分數一律由 ranking.ts 的純函式從送出紀錄計算，不另外儲存。
- domain 與 service 禁止直接呼叫 Date.now()、setTimeout、Math.random()，一律透過 Clock、Scheduler、IdGen。
- 送到組別 room 的資料一律經過 projectTeamView；RUNNING 中的 TeamView 不得含 rank、isWinner、score、state、windowEndsAt、winnerTeamId 等欄位。
- 型別、函式簽名、API 路徑、Socket 事件、錯誤碼、data-testid 必須與 TECH_SPEC 完全一致。
- 以 diagrams/003-*.puml 為主要藍圖；與 TECH_SPEC 衝突時先列出差異問我。
```

### 4.3 tasks

```text
/speckit-tasks
依 plan 拆成可驗證的 Phase，任務編號連續：
- Phase 2A 後端 domain [BE]：ranking.ts、settlement.ts、projections 其餘部分與 buildResults（UT-RANK、UT-SETTLE、UT-PROJ-02～08）。
- Phase 2B 後端 service（純速度）[BE]：repo（drafts、submissions、seq）、start、end（不含視窗結算）、reset、updateDraft、submit 的純速度路徑、seed.ts（UT-REPO-02～06、UT-SVC-PHASE-01、02、04、05、UT-SVC-DRAFT、UT-SVC-SUB）。
- Phase 2C 後端 service（公平模式、撤回、重啟與路由）[BE]：submit 的視窗路徑、settleWindow、end 結束前結算所有視窗、withdraw、recover、boot/recover.ts、HTTP 路由與推播範圍（UT-SVC-PHASE-03、UT-SVC-FAIR、UT-SVC-WD、UT-SVC-RECOVER）。
- Phase 3 前端 [FE]：format.ts、useServerClock → useTeacher 的 start、end、reset 與 usePlay 的 setDraft、submit、withdraw → ControlBar、StatusGrid、AnswerCard（rejected 以外）→ Play 搶答畫面。
- Phase 4 整合與 E2E [QA]：IT-PHASE-01、IT-VAL-01、IT-VIS-01、IT-SYNC-01、IT-RT-01、IT-CONC-01、IT-RECON-01～02、IT-RESTART-01、IT-PERF-01、E2E-04～11。
規則：
1. 每個實作任務之前都有對應的測試任務，並標註 docs/TEST_SPEC.md 的案例 ID；docs/TECH_SPEC.md §14.1 本列的每個測試 ID 都必須出現在某個任務中。
2. [BE] 與 [FE] 任務不得修改同一個檔案。
3. 每個任務寫出要建立或修改的檔案路徑。
4. 每個 Phase 的最後一個任務是「執行 npm test 與 npm run lint 全部通過（含 001、002 的測試），並依憲章原則 11 比對程式碼與 diagrams/003-*.puml」。
```

### 4.4 implement — Kevin（`be/003`，分三次）

第一次：

```text
/speckit-implement
只執行 tasks.md 中 Phase 2A 的任務。規則：
1. 每個任務先寫測試（測試名稱含 TEST_SPEC 案例 ID），確認失敗後再實作到通過。
2. 這些都是純函式，測試只用手動建構的資料，不連資料庫。UT-PROJ-04、05 必須以遞迴掃描與 JSON 字串檢查確認 RUNNING 中的 TeamView 不含他組資料與禁止的欄位。
3. 不要修改 client/ 與 e2e/。
4. 完成後執行 npm test 與 npm run lint 全部通過，並在 tasks.md 勾選。
```

第二次：

```text
/speckit-implement
只執行 tasks.md 中 Phase 2B 的任務。規則：
1. 每個任務先寫測試，確認失敗後再實作到通過；時間與排程一律使用 FakeClock 與 ManualScheduler。
2. submit 依 docs/TECH_SPEC.md §7.9 的演算法步驟 1～11 實作，本次只做純速度路徑（步驟 8a），公平模式路徑先保留給 Phase 2C。
3. submit 必須包在 withTransaction 中；UT-SVC-SUB-09（20 組同一毫秒）必須通過。
4. 不要修改 client/ 與 e2e/。
5. 完成後執行 npm test 與 npm run lint 全部通過（含先前子功能），並在 tasks.md 勾選。
```

第三次：

```text
/speckit-implement
只執行 tasks.md 中 Phase 2C 的任務。規則：
1. 每個任務先寫測試，確認失敗後再實作到通過；時間與排程一律使用 FakeClock 與 ManualScheduler。
2. 公平模式依 docs/TECH_SPEC.md §7.9 submit 步驟 8b～8d 與 settleWindow 步驟 1～8 實作；settleWindow 必須冪等；多題同時到期依 (windowEndsAt, number) 順序結算；end 依 §7.9 表格先結算所有視窗中的題目並取消排程，再進入 ENDED（UT-SVC-PHASE-03）。
3. withdraw 的邊界：恰好 10000 毫秒允許，10001 毫秒拒絕；視窗中唯一候選撤回時題目回到 open 並取消排程。
4. 路由與推播範圍依 §8、§9.3；updateDraft 只推播給該組，不推播給老師。
5. 不要修改 client/ 與 e2e/。
6. 完成後執行 npm test 與 npm run lint 全部通過，依憲章原則 11 比對程式碼與 diagrams/003-*.puml，列出不一致處；要修改圖或程式之前先問我。在 tasks.md 勾選。
```

### 4.5 implement — 組員（`fe/003`）

```text
/speckit-implement
只執行 tasks.md 中 Phase 3 標記 [FE] 的任務。規則：
1. 只修改 client/；型別從 shared/ 匯入，不要修改 shared/ 與 server/。
2. 後端尚未合併前，以 vi.mock 模擬 api.ts 與 socket.ts，TeacherView 與 TeamView 依 docs/TECH_SPEC.md §4 建構測試資料。
3. StatusGrid 依 §10.4 StatusCell 規則顯示（—、#順位或判定中、★ 得主、已撤回）；AnswerCard 依 §10.4 狀態表實作 rejected 以外的全部狀態。
4. 草稿輸入先更新畫面，300 毫秒 debounce 後才送出（UT-UI-CARD-03 用 fake timers 驗證只送一次）；收到伺服器快照時，距本地最後輸入不到 1 秒的題目保留本地內容。
5. 倒數一律用 useServerClock 校正後的時間，不直接用 Date.now() 計算。
6. data-testid 必須與 §10.4 一致；每個元件與 hook 都要有測試，測試名稱含 TEST_SPEC 案例 ID；完成後執行 npm test 與 npm run lint 全部通過。
7. 完成後依憲章原則 11 比對程式碼與 diagrams/003-*.puml，列出不一致處；在 tasks.md 勾選。
```

---

## 5. 子功能 004：結果與匯出（results-export）

feature.json：`{"feature_directory":"specs/004-results-export"}`

### 5.1 specify

```text
/speckit-specify
子功能編號 004，short name 為 results-export，資料夾名稱必須是 specs/004-results-export。
撰寫「結果與匯出」子功能的規格。需求來源：docs/PRD.md FR-05、FR-06、FR-09、E2、E5、§8 第 6、9、10 點。只描述使用者行為、規則與邊界情況，不要指定框架或工具。

【結果】
1. 搶答結束後，老師看到結果表：每題的得主組別、得主答案、各組順位（含被判錯的送出，不含已撤回的送出）；以及各組分數，依分數由高到低、同分依組別順序排列。沒有得主的題目顯示「無」。
2. 學生在搶答結束後看到同樣的結果（FR-09）；結束前看不到（FR-10 已由 003 保證）。

【老師判錯（E5）】
3. 搶答中或結束後，老師可對某題按「判錯」：原得主的送出標為判錯、扣回 1 分，依既有順位由下一個有效送出遞補為得主並得 1 分；可連續判錯；沒有可遞補者時該題沒有得主，再按判錯提示「此題目前沒有得主」。
4. 被判錯的組不能重新送出該題；該組學生看到「老師判定此答案錯誤」。
5. 判錯後老師與學生的結果畫面即時更新。

【寫回 Google Sheets（FR-06）】
6. 只有「已結束」階段可以寫回。按下後，把每題最終得主的答案寫入原 Guided Notes 對應的作答格；作答格原本有子題前綴（如「（1）」）時，寫入「前綴＋答案」，否則只寫答案；沒有得主的題目不寫。
7. 寫入位置只能來自 002 匯入時記錄的位置，禁止寫死儲存格。只改作答格的值，不改其他儲存格、格式與合併。
8. 寫回完成後顯示「已寫回 N 格」。
9. 「還原原始內容」把所有作答格恢復成匯入時的原始值（等待開始或已結束階段可用）。
10. 沒有權限時顯示「沒有權限存取試算表，請將試算表共用給服務帳號」。

【CSV（E2）】
11. 已結束階段可下載 CSV，檔名包含房間碼與第幾輪。每個送出的每個子題一列，欄位依序為：題號、子題、組別、送出者、答案、伺服器時間（台北時間，格式 YYYY-MM-DDTHH:mm:ss.SSS+08:00）、順位、狀態（有效／已撤回／判錯）、是否得主（是／否）。
12. 以 Excel 開啟中文正常（UTF-8 含 BOM，CRLF 換行）；答案含逗號、雙引號、換行時正確跳脫；答案以 = + - @ 開頭時前面加單引號，避免被當成公式。
13. 排序：題號 → 順位（無順位排最後）→ 子題。

【驗收範例】
- 範例 A：第 1 題得主答案為「CPU」「作業系統」、第 3 題得主答案為「0」，寫回後 G5 為「（1）CPU」、G6 為「（2）作業系統」、G11 為「0」，其他儲存格不變；回報寫回 3 格。
- 第 3 題得主 A 組被判錯、B 組為第 2 名 → B 成為得主，A 分數 −1、B +1，寫回改用 B 的答案。

【邊界情況】
沒有得主的題目、連續判錯到無人可遞補、搶答中寫回或下載 CSV、等待開始時判錯、答案含逗號引號換行或以 = 開頭、試算表未共用、Google API 暫時錯誤。

【不在本子功能範圍】匯入（002）、作答與判定（003）。

【圖表】依憲章原則 11 產生：
- diagrams/004-component.puml：老師端、學生端、結果服務、匯出（寫回、CSV）、試算表閘道、資料庫
- diagrams/004-class.puml：Results、CsvRow、CellWrite、AnswerSlot、SheetsGateway、SessionService 本子功能方法
- diagrams/004-sequence.puml：結束後檢視結果；判錯與遞補；寫回 Google Sheets；下載 CSV
完成後執行 java -jar plantuml.jar "./diagrams/*.puml" 產生 PNG，並確認沒有錯誤。
```

### 5.2 plan

```text
/speckit-plan
【技術選擇】沿用 001 的 plan。禁止加入需要 .node 原生模組的套件。寫回使用 googleapis 的 spreadsheets.values.batchUpdate，valueInputOption 為 RAW。

【範圍】以 docs/TECH_SPEC.md §14.1 中「004-results-export」一列為準，不要實作其他列的內容。
本子功能需要的章節：§4 的 CellWrite、Results、§7.2 的 rangeA1、§7.4（exporter、googleGateway.writeCells、fakeGateway.writeCells 與錯誤對照）、§7.5、§7.6（判錯後的遞補由 winnerOf 自動成立）、§7.8 的 buildResults 與 buildCsvRows、§7.9 的 rejectWinner、exportToSheet、restoreSheet、exportCsv、§8.1 的 reject-winner、export、restore、export.csv、§10.4 的 ResultsTable、ExportPanel、StudentResults、AnswerCard 的 rejected 狀態、§11、§12.5、§12.6。

【約束】
- 寫回位置只能來自 answer_slots，禁止寫死儲存格。
- 判錯只改送出的 status，得主與分數由 ranking.ts 重新計算，不另外儲存。
- 型別、函式簽名、API 路徑、錯誤碼、data-testid 必須與 TECH_SPEC 完全一致。
- 以 diagrams/004-*.puml 為主要藍圖；與 TECH_SPEC 衝突時先列出差異問我。
```

### 5.3 tasks

```text
/speckit-tasks
依 plan 拆成可驗證的 Phase，任務編號連續：
- Phase 2 後端 [BE]：exporter.ts → csv.ts 與 buildCsvRows → googleGateway.writeCells、fakeGateway.writeCells → rejectWinner、exportToSheet、restoreSheet、exportCsv → HTTP 路由。
- Phase 3 前端 [FE]：useTeacher 的 rejectWinner、exportToSheet、restoreSheet、downloadCsv → ResultsTable、ExportPanel、StudentResults → AnswerCard 的 rejected 狀態 → Play 的 ENDED 畫面。
- Phase 4 整合與 E2E [QA]：IT-FLOW-01、IT-CSV-01、IT-VIS-02、E2E-12～17。
- Phase 5 最終驗收 [QA]：執行全部測試與覆蓋率檢查（docs/TEST_SPEC.md §2.3）、完成 docs/test-report.md、檢查 §10 追溯矩陣每一列都有通過的測試、README 功能清單與執行方式。
規則：
1. 每個實作任務之前都有對應的測試任務，並標註 docs/TEST_SPEC.md 的案例 ID；docs/TECH_SPEC.md §14.1 本列的每個測試 ID 都必須出現在某個任務中。
2. [BE] 與 [FE] 任務不得修改同一個檔案。
3. 每個任務寫出要建立或修改的檔案路徑。
4. Phase 2、Phase 3 的最後一個任務是「執行 npm test 與 npm run lint 全部通過（含 001～003 的測試），並依憲章原則 11 比對程式碼與 diagrams/004-*.puml」。
```

### 5.4 implement — Kevin（`be/004`）

```text
/speckit-implement
只執行 tasks.md 中 Phase 2 標記 [BE] 的任務。規則：
1. 每個任務先寫測試（測試名稱含 TEST_SPEC 案例 ID），確認失敗後再實作到通過。
2. 寫回測試使用 InMemorySheetsGateway，UT-SVC-EXPORT-01 必須驗證 gateway 恰好收到 G5「（1）CPU」、G6「（2）作業系統」、G11「0」三筆。
3. googleGateway 的測試以注入的 mock client 驗證 batchUpdate 參數（valueInputOption 為 RAW、range 格式為 '學習單'!G5），不連網路。
4. CSV 依 docs/TECH_SPEC.md §7.5 逐條實作，UT-CSV-01 必須與表頭字串完全相同（含 BOM）。
5. 不要修改 client/ 與 e2e/。
6. 完成後執行 npm test 與 npm run lint 全部通過（含先前子功能），依憲章原則 11 比對程式碼與 diagrams/004-*.puml，列出不一致處；要修改圖或程式之前先問我。在 tasks.md 勾選。
```

### 5.5 implement — 組員（`fe/004`）

```text
/speckit-implement
只執行 tasks.md 中 Phase 3 標記 [FE] 的任務。規則：
1. 只修改 client/；型別從 shared/ 匯入，不要修改 shared/ 與 server/。
2. 後端尚未合併前，以 vi.mock 模擬 api.ts，Results 依 docs/TECH_SPEC.md §4 建構測試資料（包含有得主、無得主、判錯的題目）。
3. data-testid 必須與 §10.4 一致（results-table、result-winner-{qNumber}、btn-reject-{qNumber}、score-{teamIndex}、btn-export-sheet、btn-restore-sheet、btn-download-csv、export-result、student-results、student-result-{qNumber}）；寫回成功顯示「已寫回 N 格」。
4. 判錯按鈕在搶答中與已結束都可使用；下載 CSV 以瀏覽器下載檔案，檔名使用伺服器回傳的 Content-Disposition。
5. 每個元件與 hook 都要有測試，測試名稱含 TEST_SPEC 案例 ID；完成後執行 npm test 與 npm run lint 全部通過。
6. 完成後依憲章原則 11 比對程式碼與 diagrams/004-*.puml，列出不一致處；在 tasks.md 勾選。
```

### 5.6 最終驗收（組員執行 Phase 4、5；Kevin 做手動驗收）

組員：先執行第 1.3 節 converge、第 1.4 節 [QA]，再輸入：

```text
/speckit-implement
執行 tasks.md 中 Phase 5 的任務。規則：
1. 遵守 docs/TEST_SPEC.md §0，只寫測試與報告，不修改產品程式。
2. 執行 npm run test:coverage、npm run test:e2e、npm run lint，確認 docs/TEST_SPEC.md §8.1 的通過條件逐項成立。
3. 依 §9.3 範本完成 docs/test-report.md：各層級案例數與通過數、覆蓋率、§10 追溯矩陣每一列的結果、缺陷清單、待釐清清單、驗收結論；未滿足的條件逐條列出。
```

Kevin：
- MA-03～05：真實 Google Sheets 寫回、還原、未共用時的錯誤訊息，前後截圖記錄在 `docs/manual-test.md`。
- 與組員一起完成 MA-06～08：多分頁 Demo 演練、`git log -p` 檢查沒有金鑰、spec／圖表／README／Demo 內容一致。
