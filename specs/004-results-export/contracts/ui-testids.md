# UI 契約：結果與匯出（004）

`data-testid` 照抄 `docs/TECH_SPEC.md` §10.4，**不新增、不改名**。文字依 spec 與 §10.4／§10.5。

## ResultsTable（`client/src/components/ResultsTable.tsx`，新增）

顯示時機：TeacherDashboard 在 **RUNNING 與 ENDED**（plan D2；RUNNING 時位於 StatusGrid 下方）。

| testid | 內容 |
| --- | --- |
| `results-table` | 表格容器；每題一列（題號升冪） |
| `result-winner-{qNumber}` | 得主組名（如「第2組」）；無得主「無」 |
| `btn-reject-{qNumber}` | 「判錯」；按下呼叫 `onReject(questionId)`；`busy` 時 disabled；無得主時仍可按（伺服器回「此題目前沒有得主」） |
| `score-{teamIndex}` | 該組分數；分數列依分數降冪、組序升冪 |

- 答案欄：題組「（1）CPU（2）作業系統」，單題只有答案；無得主「無」。
- 順位欄：「1.第2組 2.第1組（判錯）」——不含已撤回、不含 rank 為 null。
- Props：`view: TeacherView`、`busy: boolean`、`onReject(questionId: string)`。
- 測試：UT-UI-RES-01、02。

## ExportPanel（`client/src/components/ExportPanel.tsx`，新增）

顯示時機：TeacherDashboard 在 **READY 與 ENDED**。

| testid | 文字 | 可按條件 |
| --- | --- | --- |
| `btn-export-sheet` | 寫回 Google Sheets | phase = ENDED 且非 busy |
| `btn-restore-sheet` | 還原原始內容 | phase ∈ {READY, ENDED} 且非 busy |
| `btn-download-csv` | 下載 CSV | phase = ENDED 且非 busy |
| `export-result` | 「已寫回 {n} 格」或「已還原 {n} 格」（最近一次成功的結果；失敗時不顯示，錯誤由 ErrorBanner 顯示） | — |

- Props：`phase`、`busy`、`onExport(): Promise<number>`、`onRestore(): Promise<number>`、`onDownload(): Promise<void>`。
- 測試：UT-UI-EXP-01（＋「已還原 N 格」延伸斷言，plan D3）。

## StudentResults（`client/src/components/StudentResults.tsx`，新增）

| testid | 內容 |
| --- | --- |
| `student-results` | 容器；只在 `view.results !== null`（ENDED）渲染 |
| `student-result-{qNumber}` | 該題得主組名（或「無」）、答案、各組順位（判錯標示） |

- 下方列出各組分數（spec Clarifications Q2）；無任何操作按鈕。
- Props：`results: Results`。

## AnswerCard（`client/src/components/AnswerCard.tsx`，003 建立；本子功能補 rejected 狀態）

| 條件 | 輸入框 | 按鈕／文字 |
| --- | --- | --- |
| RUNNING、`mySubmission.status === 'rejected'` | disabled，顯示原送出答案 | 不渲染 `btn-submit-{n}`、`btn-withdraw-{n}`；顯示「老師判定此答案錯誤」 |

- 測試：UT-UI-CARD-06。

## Play（`client/src/pages/Play.tsx`，001 建立）

- phase = ENDED：不渲染任何 `answer-card-*`，改渲染 `StudentResults`。測試：UT-UI-PLAY-03。

## TeacherDashboard（`client/src/pages/TeacherDashboard.tsx`，001 建立）

- RUNNING、ENDED：`StatusGrid`（003）下方加 `ResultsTable`。
- READY、ENDED：加 `ExportPanel`。
- `useTeacher` 新增（§10.3）：`rejectWinner(questionId)`、`exportToSheet(): Promise<number>`、`restoreSheet(): Promise<number>`、`downloadCsv(): Promise<void>`；呼叫期間 `busy = true`；錯誤寫入 `error` 由 ErrorBanner 顯示（§11 訊息，例如「沒有權限存取試算表，請將試算表共用給服務帳號」「此題目前沒有得主」）。
