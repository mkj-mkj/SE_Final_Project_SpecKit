# 伺服器模組契約：結果與匯出（004）

簽名照抄 `docs/TECH_SPEC.md`；不得改名或改參數。標「既有」者為先前子功能已實作、本子功能只使用。

## `server/src/sheets/exporter.ts`（新增，§7.4）

```ts
export function buildExportWrites(
  slots: AnswerSlot[], questions: Question[], winners: Map<string, Submission> // key = questionId
): CellWrite[];
// 對每個有得主的題目、每個 slot（依 subNo）：value = slot.prefix + winner.answers[subNo-1]
// 無得主的題目不產生寫入；輸出依 sheetTitle、row、col 排序
export function buildRestoreWrites(slots: AnswerSlot[]): CellWrite[]; // value = originalValue
```

- 位置只取自 `slot.sheetTitle`、`slot.a1`（憲章原則 V）。
- 純函式，不呼叫閘道。測試：UT-EXP-01～04。

## `server/src/sheets/googleGateway.ts`（補 `writeCells`，§7.4）

```ts
writeCells(spreadsheetId: string, writes: CellWrite[]): Promise<void>;
```

- `client.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: writes.map(w => ({ range: rangeA1(w.sheetTitle, w.a1), values: [[w.value]] })) } })`。
- `writes` 為空 → 不呼叫 API。
- 錯誤：403 → `SHEETS_PERMISSION_DENIED`；404 → `SHEETS_NOT_FOUND`；其他 → `SHEETS_ERROR`（沿用既有 `toAppError`）。
- 測試：UT-GW-02（mock client）。

## `server/src/sheets/fakeGateway.ts`（補 `writeCells`，§7.4）

```ts
export function createFakeGateway(dir: string, outDir?: string): SheetsGateway & {
  getSnapshot(spreadsheetId: string): SheetSnapshot;
  reset(spreadsheetId: string): void;
};
```

- `outDir` 為新增的**可省略**參數（research R-07）；`index.ts` 傳 `data/fake-sheets`。
- `writeCells`：先驗證全部寫入（工作表存在、A1 合法，否則 `SHEETS_ERROR`，不套用任何一筆）→ 修改記憶體副本 → 有 `outDir` 時寫 `${outDir}/${spreadsheetId}.json`。
- 測試：UT-GW-05。

## `server/src/sheets/a1.ts`（既有，§7.2）

`rangeA1(sheetTitle, a1)` → `'學習單'!G5`（含單引號跳脫）。

## `server/src/export/csv.ts`（新增，§7.5）

```ts
export function buildResultsCsv(rows: CsvRow[]): string;
export interface CsvRow {
  questionNumber: number; subNo: number; teamName: string; submittedBy: string; answer: string;
  serverTime: number; rank: number | null; status: SubmissionStatus; isWinner: boolean;
}
```

- 規則見 [data-model.md §4](../data-model.md)。`CsvRow` 定義於此檔並匯出（§7.5）。
- 測試：UT-CSV-01～06（UT-CSV-07 經 `buildCsvRows`）。

## `server/src/domain/ranking.ts`（既有，§7.6）

`orderSubmissions`、`rankSubmissions`、`winnerOf`、`teamScores`——不修改。判錯後的遞補與扣分由 `winnerOf`／`teamScores` 自動成立。

## `server/src/domain/projections.ts`（補 `buildCsvRows`，§7.8）

```ts
export function buildResults(agg: SessionAggregate): Results;   // 既有（003）
export function buildCsvRows(agg: SessionAggregate): CsvRow[];   // 新增
```

- `buildCsvRows`：所有送出（含 withdrawn、rejected）× 每個子題；rank／isWinner 取自 `rankSubmissions`；排序 questionNumber → rank（null 最後，再 serverTime、seq）→ subNo。
- 測試：UT-PROJ-09、UT-CSV-07。

## `server/src/services/sessionService.ts`（補 4 個方法，§7.9）

```ts
rejectWinner(sessionId: string, questionId: string): TeacherView;
exportToSheet(sessionId: string): Promise<{ updatedCells: number; writes: CellWrite[] }>;
restoreSheet(sessionId: string): Promise<{ updatedCells: number }>;
exportCsv(sessionId: string): string;
```

| 方法 | 前置條件 | 演算法 | 錯誤 |
| --- | --- | --- | --- |
| rejectWinner | phase ∈ {RUNNING, ENDED}；題目屬於本活動；該題有得主 | 單一同步交易：`winnerOf` → `updateSubmission(w.id, { status: 'rejected' })`；COMMIT 後 `publish(sessionId)`（全部） | INVALID_PHASE、QUESTION_NOT_FOUND、NO_WINNER |
| exportToSheet | phase = ENDED；有 spreadsheetId | `buildExportWrites` ＋（plan D1）對「winnerOf 為 null 且有 rejected」題目的 slots `buildRestoreWrites` → 合併依 sheetTitle、row、col 排序 → 非空時 `sheets.writeCells` | INVALID_PHASE、SHEETS_* |
| restoreSheet | phase ∈ {READY, ENDED} | `buildRestoreWrites(全部 slots)` → 非空時 `sheets.writeCells` | INVALID_PHASE、SHEETS_* |
| exportCsv | phase = ENDED | `buildResultsCsv(buildCsvRows(loadAggregate))` | INVALID_PHASE |

- export／restore／csv 不寫資料庫、不推播（§9.3）。
- 測試：UT-SVC-REJ-01～06（＋ plan D1 的 UT-SVC-REJ-07）、UT-SVC-EXPORT-01～06。

## `server/src/http/teacherRoutes.ts`（補 4 條路由）

見 [rest-api.md](./rest-api.md)。`export.csv` 由路由組 `Content-Disposition`（roomCode、round 取自 session）。
