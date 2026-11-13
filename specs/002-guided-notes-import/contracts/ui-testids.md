# UI 契約（002 範圍）

照抄 `docs/TECH_SPEC.md` v1.6 §10.3、§10.4、§12.1。

## Hook

```ts
useTeacher(): { …001 欄位…; busy: boolean; importSheet(spreadsheet: string): Promise<ImportSummary>; }
```

`importSheet` 期間 `busy = true`；成功後以回應的 `view` 取代本地狀態（之後仍以 `teacher:state` 快照為準）；失敗時設定 `error`（由 TeacherDashboard 唯一的 `ErrorBanner` 顯示）並重新丟出，讓 `ImportForm` 判斷是否顯示範本格式說明。

## 元件與 `data-testid`

| 元件 | 行為 | `data-testid` |
| --- | --- | --- |
| `ImportForm` | 貼上網址並匯入；輸入為空白或 `useTeacher.busy` 為 true 時 `import-submit` disabled；匯入進行中按鈕文字為「匯入中…」 | `import-input`、`import-submit` |
| `ImportSummary` | `import-summary` 文字固定為「偵測到 {questionCount} 題，其中 {groupCount} 題組（共 {subQuestionCount} 子題）、{singleCount} 單題」，下方依序列出警告與題號清單 | `import-summary`、`import-question-count`、`import-group-count`、`import-warning-{i}` |
| `ErrorBanner`（001，不修改） | TeacherDashboard 唯一的錯誤橫幅，顯示 `useTeacher.error`（含匯入錯誤）；ImportForm 不另外渲染 ErrorBanner，避免同一錯誤出現兩次 | `error-banner` |
| `ImportForm` 的格式說明 | `onImport` 拒絕且 `code === 'HEADER_NOT_FOUND'` 時，在表單下方顯示「範本格式說明」4 點；下次送出時清除 | （無專屬 testid；UT-UI-IMPORT-03 以文字斷言） |

## TeacherDashboard（READY 畫面）

- 顯示 ImportForm（SETUP、READY 皆可）、ImportSummary（`importSummary` 不為 null 時）、題號清單：單題「第 n 題」；題組「第 n 題 題組（1）（2）」（取 `subLabels`）。
- 不顯示試算表 ID、工作表名稱與模式提示（PRD v1.2、spec FR-022、FR-026）。
- 不顯示題目敘述（FR-02）。

## 範本格式說明（HEADER_NOT_FOUND 時顯示）

1. 需有一列同時含「題號」與「作答」兩個儲存格。
2. 題號欄填整數（例：1、2、3）。
3. 題組：將題號儲存格向下合併 n 列。
4. 子題作答格可用「（1）」「（2）」開頭標示。

測試：UT-UI-IMPORT-01～04、E2E-01、E2E-02。
