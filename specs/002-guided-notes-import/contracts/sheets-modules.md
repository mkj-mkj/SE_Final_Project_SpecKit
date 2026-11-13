# 伺服器模組契約（002 範圍）

函式簽名照抄 `docs/TECH_SPEC.md` v1.6 §7.1–§7.4、§7.8、§7.9，不得改名。

## `server/src/sheets/a1.ts`（§7.2，全部）

```ts
export function colToLetters(col: number): string;              // 0→'A', 25→'Z', 26→'AA'
export function toA1(row: number, col: number): string;          // (4,6)→'G5'
export function quoteSheet(title: string): string;              // 學習單 → "'學習單'"；含 ' 時改為 ''
export function rangeA1(sheetTitle: string, a1: string): string; // "'學習單'!G5"
export function parseSpreadsheetInput(input: string): string;   // 網址取 id／符合 /^[A-Za-z0-9_-]{10,}$/ 原樣／否則 INVALID_SPREADSHEET_URL
```

測試：UT-A1-01～07。

## `server/src/sheets/parser.ts`（§7.3，10 個步驟逐條實作）

```ts
export function parseGuidedNotes(snapshot: SheetSnapshot): ParseResult;
export function summarize(result: ParseResult): ImportSummary;
```

測試：UT-PARSE-01～22（期望值 `fixtures/sheets/template-{a,b}.expected.json`）。

## `server/src/sheets/googleGateway.ts`（§7.4）

```ts
export function createGoogleGateway(client: sheets_v4.Sheets): SheetsGateway;
```

- `fetchSnapshot`：`spreadsheets.get`（fields `sheets(properties(sheetId,title),merges)`）＋ `values.batchGet`（ranges＝每個工作表 `quoteSheet(title)`，`FORMATTED_VALUE`）；依回傳 range 起始格補齊為以 A1 為原點。
- 錯誤：403 → `SHEETS_PERMISSION_DENIED`；404 → `SHEETS_NOT_FOUND`；其他 → `SHEETS_ERROR`。
- `writeCells`：002 丟出 `AppError('SHEETS_ERROR')`，004 實作（research D5）。
- 測試：UT-GW-01、UT-GW-03（mock client）。

## `server/src/sheets/fakeGateway.ts`（§7.4，TECH_SPEC v1.5）

```ts
export function createFakeGateway(dir: string): SheetsGateway & {
  getSnapshot(spreadsheetId: string): SheetSnapshot;
  reset(spreadsheetId: string): void;
};
```

- ID 必須符合 `/^fixture-([A-Za-z0-9_-]+)$/`，讀 `{dir}/{名稱}.snapshot.json`；否則 `SHEETS_NOT_FOUND`。之後以記憶體副本為準，回傳深拷貝。
- `writeCells`：002 丟出 `SHEETS_ERROR`（004 實作）。
- 測試：UT-GW-04（UT-GW-05 屬 004）。
- 工廠名稱 `createFakeGateway` 為本計畫命名（TECH_SPEC 只規定檔名與方法）。

## `server/src/http/devRoutes.ts`（§8.4）

```ts
export function devRoutes(fake: ReturnType<typeof createFakeGateway>): Router;
```

只有 `config.sheetsMode === 'fake'` 時由 `app.ts` 掛載到 `/api/dev`（`AppDeps` 新增選填欄位 `fakeSheets?`）。

## `domain/projections.ts`（§7.8，TECH_SPEC v1.6）

```ts
export interface SessionAggregate { /* …既有欄位… */ importSummary: ImportSummary | null; }
export function questionInfo(q: Question, slots: AnswerSlot[]): QuestionInfo;
```

測試：UT-PROJ-01。

## `services/sessionService.ts`

```ts
importSheet(sessionId: string, spreadsheetInput: string): Promise<{ view: TeacherView; summary: ImportSummary }>;
```

前置條件、效果、錯誤依 §7.9 表格；交易內重新檢查階段（research R-05）。測試：UT-SVC-IMPORT-01～06。
