# Quickstart：驗證匯入 Guided Notes（002）

## 前置條件

- 001 全部完成（含前端與 `e2e/playwright.config.ts`）。
- Node.js 22.13 以上；`npm install` 已執行（新增相依 `googleapis`）。
- `.env`：`SHEETS_MODE=fake`、`FAKE_SHEETS_DIR=./fixtures/sheets`、`TEACHER_PASSWORD` 已設定。

## 1. 自動化測試

```bash
npm test                 # UT-A1、UT-PARSE-01～22、UT-GW-01/03/04、UT-SVC-IMPORT、UT-PROJ-01、UT-UI-IMPORT，及 001 全部
npm run test:e2e         # E2E-01、E2E-02（及 001 的 E2E-03、E2E-18）
npm run lint
```

期望：全部通過；`git grep -nE "['\"][A-Z]{1,3}[0-9]+['\"]" server/src` 不應出現寫死的儲存格位址（測試與 fixtures 除外）。

## 2. 示範模式手動驗證

1. `npm run dev` → 開 `/teacher`，登入、建立活動。
2. 輸入 `fixture-template-a` 按「匯入」：按鈕短暫顯示「匯入中…」；2 秒內出現「偵測到 4 題，其中 2 題組（共 4 子題）、2 單題」；清單為「第 1 題 題組（1）（2）」「第 2 題 題組（1）（2）」「第 3 題」「第 4 題」；階段「等待開始」。
3. 輸入 `fixture-template-b` 重新匯入：6 題、0 題組；舊題目不再出現。
4. 輸入 `hello` → 「不是有效的 Google Sheets 網址」；輸入 `fixture-nope` → 「找不到試算表」；階段不變。
5. 以學生分頁加入後重新匯入，以瀏覽器開發者工具確認學生收到的 `team:state` 中 `questions` 即時更新且不含題目敘述（學生畫面的題號顯示屬 003 的 AnswerCard）。
6. 重新整理老師頁，摘要與題號清單仍在。
7. `GET /api/dev/fake-sheets/fixture-template-a` 回傳快照；`POST …/reset` 回 204。
8. README 列出 `fixture-template-a`、`fixture-template-b`（MA-09）。

## 3. Google 模式（手動 MA-01、MA-02）

1. 依 README 建立服務帳號、啟用 Sheets API，金鑰放 `secrets/service-account.json`（不得提交）；`.env` 設 `SHEETS_MODE=google`。
2. 把 `fixtures/sheets/template-a.xlsx`、`template-b.xlsx` 上傳為 Google Sheets 並共用給服務帳號。
3. 貼上網址匯入：題數與題組同步驟 2、3；未共用的試算表顯示「沒有權限存取試算表，請將試算表共用給服務帳號」（MA-05）。

## 4. 圖表一致性

對照 `diagrams/002-*.puml`：組件、類別（含公開方法與關聯）、兩段時序與程式碼一致（原則 XI）。
