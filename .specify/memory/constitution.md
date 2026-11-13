<!--
Sync Impact Report
==================
- 版本變更：(未填寫範本) → 1.0.0
- 修改的原則：無（首次制定）
- 新增章節：
  - Core Principles I–XI（語言、文件為準、伺服器唯一真相、資訊隔離、動態定位、機密資訊、
    測試先行、可測設計、子功能開發、本機執行、PlantUML 設計優先）
  - 技術與安全約束（Technical & Security Constraints）
  - 開發流程與品質關卡（Development Workflow & Quality Gates）
  - Governance
- 移除章節：無
- 需同步檢查的範本（本指令不修改，執行時讀取憲章）：
  - ⚠ .specify/templates/plan-template.md — Constitution Check 應涵蓋原則 I–XI 與 diagrams/ 藍圖
  - ⚠ .specify/templates/spec-template.md — specify 階段需產出 diagrams/<編號>-*.puml 與 PNG
  - ⚠ .specify/templates/tasks-template.md — 測試任務先於實作；後端／前端任務分開；
    implement 結尾需有「程式碼與圖表一致性驗證」任務
- 延後項目：無
-->

# Vibe Coding 課堂搶答系統 Constitution

## Core Principles

### I. 繁體中文優先（Language）

- 使用者介面文字、錯誤訊息、規格、計畫、任務與其他文件 MUST 使用繁體中文。
- 程式識別字（變數、函式、型別、檔名、API 路徑、事件名稱）MUST 使用英文。
- 重要業務邏輯（階段轉換、得主判定、計分、資訊過濾、動態定位）MUST 附繁體中文註解。

理由：使用者為國內師生，文件需讓組員與老師直接閱讀；英文識別字確保工具鏈相容。

### II. 文件為準（Docs Are the Source of Truth）

- `docs/PRD.md`（需求）、`docs/TECH_SPEC.md`（技術契約）、`docs/TEST_SPEC.md`（測試與驗收）
  為最高依據；所有 spec、plan、tasks 與程式碼 MUST NOT 與其矛盾。
- 發現衝突、遺漏或歧義時，MUST 先列出差異（出處、段落、衝突內容）並詢問使用者，
  MUST NOT 自行決定或擅自修改 docs/。

理由：三份文件是課程評分與團隊協作的共同契約，單方面偏離會造成整合失敗。

### III. 伺服器為唯一真相來源（Server Authority）

- 活動階段、時間（開始、截止、倒數）、搶答得主與分數 MUST 由伺服器決定與計算。
- 伺服器 MUST NOT 採信客戶端送來的時間戳、階段、得主或分數；客戶端只送「指令」，
  並以伺服器推送的完整快照取代本地狀態。
- 送出處理 MUST 在單一同步交易內完成，不得出現兩位得主的競態。

理由：搶答公平性完全取決於單一權威判定，客戶端資料可被竄改或因延遲而失準。

### IV. 資訊隔離（Server-Side Information Isolation）

- 搶答結束前，學生端 MUST NOT 收到其他組的任何作答資料（內容、是否已送出、順序等）。
- 過濾 MUST 在伺服器端完成（投影函式／推播範圍），MUST NOT 只依賴前端隱藏。
- 每個資訊隔離規則 MUST 有對應測試，驗證送出的 payload 本身不含他組資料。

理由：前端隱藏可被開發者工具輕易繞過，只有伺服器過濾才能保證公平。

### V. 動態定位（Dynamic Cell Location）

- 匯入或匯出 Guided Notes 時 MUST NOT 使用寫死的儲存格位址（例如 `B5`、`C3:C20`）。
- 題目與作答位置 MUST 由解析器依表頭（如「題號」「作答」）動態定位；
  寫回位置 MUST 只能來自解析結果。
- 測試 MUST 以至少兩種版面不同的範本（fixtures）驗證定位正確。

理由：老師的學習單版面各不相同，靜態位址會寫壞他人的內容。

### VI. 機密資訊管理（Secrets Hygiene）

- 密碼、金鑰、服務帳號憑證 MUST 只存在於 `.env` 與 `secrets/`，且兩者 MUST 列入 `.gitignore`。
- 機密 MUST NOT 出現在程式碼、文件、測試、fixtures、log 或 git 歷史中。
- 專案 MUST 提供 `.env.example`，列出所有變數名稱與假值／說明。

理由：Google 服務帳號金鑰外洩會造成帳號被濫用，且 git 歷史難以徹底清除。

### VII. 測試先行（Test-First，NON-NEGOTIABLE）

- 每個功能 MUST 有 unit test，且 MUST 先寫測試、確認失敗，再撰寫實作（Red-Green-Refactor）。
- 測試名稱 MUST 包含 `docs/TEST_SPEC.md` 的案例 ID（例如 `UT-VAL-01`）。
- 測試 MUST NOT 依賴真實時間、真實亂數或網路；一律使用假時鐘、可控亂數與 fake gateway。

理由：可重現的測試是並行開發與驗收的唯一共同標準。

### VIII. 可測設計（Design for Testability）

- 業務邏輯 MUST 寫成純函式或以參數注入依賴。
- 時間（Clock）、計時器（Timer）、亂數（Random）、外部服務（如 Google Sheets）
  MUST 透過介面（ports）取得，MUST NOT 在業務邏輯中直接呼叫 `Date.now()`、
  `setTimeout`、`Math.random()` 或 SDK。
- HTTP 與 Socket 層只做轉換與驗證，MUST NOT 包含業務規則。

理由：注入依賴才能讓原則 VII 的「不依賴真實時間、亂數、網路」成立。

### IX. 子功能並行開發（Feature-Sliced Parallel Development）

- 系統 MUST 拆成多個子功能，每個子功能有獨立目錄 `specs/<編號-名稱>/`
  （含 spec、plan、tasks 等產物）。
- 每個子功能的任務 MUST 將後端任務與前端任務分開標示，使不同成員可並行開發。
- `docs/TECH_SPEC.md` 定義的共用型別、介面、錯誤碼、事件名稱與 `data-testid`
  MUST NOT 擅自更改；如需變更，依原則 II 先提出差異並取得同意。

理由：穩定的共用契約是多人並行開發不互相阻塞的前提。

### X. 本機執行（Local-Only Execution）

- 系統 MUST 能在單一本機環境完整執行與模擬（含 fake Sheets 模式），
  MUST NOT 要求對外部署、雲端主機或 CI/CD 部署流程。
- 規格與計畫 MUST NOT 引入僅為部署所需的元件（容器編排、雲端資源、網域設定等）。

理由：專題範圍為課堂展示與驗收，部署複雜度不在評分範圍內。

### XI. PlantUML 設計優先（Design-First with PlantUML）

- **規格制定階段**：`/speckit-specify` MUST 以 PlantUML 產生該子功能的組件圖、類別圖、
  時序圖，存於 `./diagrams/`，檔名 MUST 以子功能編號開頭：
  `<編號>-component.puml`、`<編號>-class.puml`、`<編號>-sequence.puml`。
- **產物生成**：建立 `.puml` 後 MUST 執行 `java -jar plantuml.jar "./diagrams/*.puml"`
  轉為 PNG，輸出於同一目錄；`.puml` 與 PNG MUST 一併納入版本控制。
- **規劃階段**：`/speckit-plan` MUST 以上述圖表為主要藍圖推導架構與組件；
  plan 與圖表不一致時，MUST 先更新圖表（並重新產生 PNG）再更新 plan。
- **實作階段**：`/speckit-implement` 完成程式碼後 MUST 執行驗證步驟，逐項比對
  組件、類別（含公開方法與關聯）、互動順序與程式碼一致；不一致 MUST 修正後才算完成。

理由：先畫圖再寫碼讓設計可審閱，也讓實作有可驗證的對照基準。

## 技術與安全約束（Technical & Security Constraints）

- 技術棧以 `docs/TECH_SPEC.md` §3 為準：Node.js 22.13+、TypeScript 5（`strict: true`）、
  React 18 + Vite 5、Express 4 + Socket.IO 4、`node:sqlite`、zod、Vitest 2、Playwright。
  引入其他執行期相依套件 MUST 於 plan 中說明理由，且不得違反原則 II。
- 架構遵循「指令走 REST，狀態走 Socket（完整快照）」；業務邏輯置於
  `server/src/domain`、`server/src/sheets`、`server/src/services`。
- 外部服務（Google Sheets）MUST 支援 `fake` 模式，供測試與本機展示使用。
- PlantUML 轉檔需本機具備 Java 與 `plantuml.jar`；`plantuml.jar` 的取得方式 MUST
  記錄於專案說明文件，jar 本身不強制納入版本控制。

## 開發流程與品質關卡（Development Workflow & Quality Gates）

1. **Specify**：產出 `specs/<編號-名稱>/spec.md` 與 `diagrams/<編號>-*.puml`／PNG（原則 XI）；
   每條需求標註對應 PRD 編號（FR-xx、Ex）。
2. **Plan**：Constitution Check MUST 逐條檢查原則 I–XI；以圖表為藍圖，違反處 MUST 記錄於
   Complexity Tracking 並說明理由，否則不得進入下一步。
3. **Tasks**：測試任務 MUST 排在對應實作任務之前；後端與前端任務分開（原則 IX）；
   最後 MUST 包含「程式碼與圖表一致性驗證」任務。
4. **Implement**：依 Red-Green-Refactor 進行；完成前 MUST 確認：
   - 所有相關 TEST_SPEC 案例測試通過；
   - 無機密進入 git（原則 VI）；
   - 學生端 payload 不含他組資料（原則 IV）；
   - 程式碼與 diagrams/ 一致（原則 XI）。
5. **Review**：每次合併前，審查者 MUST 以本憲章檢核清單確認合規。

## Governance

- 本憲章優先於其他開發慣例；`docs/` 三份文件為需求與契約來源，憲章規範「如何」遵循它們。
- **修訂程序**：修訂 MUST 以 PR 提出，說明動機、影響的原則與受影響的 specs／範本，
  並經團隊同意後合併；合併時同步更新版本與 Last Amended 日期。
- **版本政策**（語意化版本）：
  - MAJOR：移除原則或以不相容方式重新定義原則；
  - MINOR：新增原則或章節、實質擴充規範；
  - PATCH：措辭澄清、錯字修正等不影響語意的修改。
- **合規審查**：每份 plan 的 Constitution Check、每次 PR 審查與每個子功能完成時，
  MUST 檢查是否符合本憲章；任何例外 MUST 有書面理由並記錄於該子功能的 plan。

**Version**: 1.0.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13
