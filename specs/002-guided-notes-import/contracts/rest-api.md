# REST 契約（002 範圍）

照抄 `docs/TECH_SPEC.md` v1.6 §8；錯誤格式 `{ "error": { "code": ErrorCode, "message": string } }`，HTTP 狀態依 §11。

## POST `/api/teacher/sessions/:id/import`（§8.1）

- 驗證：`Authorization: Bearer <teacherToken>`，失敗 401 `UNAUTHORIZED`。
- 本文（zod）：`{ spreadsheet: string }`；缺少或型別錯誤 → 422 `INVALID_INPUT`。
- 成功：200 `{ view: TeacherView, summary: ImportSummary }`；同時推播 `teacher:state` 與各組 `team:state`（§9.3 import → teacher＋全部組）。

| 錯誤碼 | HTTP | 情境 |
| --- | --- | --- |
| `SESSION_NOT_FOUND` | 404 | `:id` 不存在 |
| `INVALID_PHASE` | 409 | 階段為 RUNNING／ENDED（讀取前或交易內檢查） |
| `INVALID_SPREADSHEET_URL` | 422 | 不是含 `/spreadsheets/d/{id}` 的網址，也不是 `/^[A-Za-z0-9_-]{10,}$/` |
| `SHEETS_PERMISSION_DENIED` | 403 | Google 回 403 |
| `SHEETS_NOT_FOUND` | 404 | Google 回 404；fake 模式 ID 不是 `fixture-{名稱}` 或檔案不存在 |
| `SHEETS_ERROR` | 502 | 其他 Google 錯誤 |
| `HEADER_NOT_FOUND` | 422 | 所有工作表都沒有同列「題號」「作答」 |
| `NO_QUESTIONS` | 422 | 0 題 |
| `DUPLICATE_QUESTION_NUMBER` | 422 | 題號重複（message 含題號） |

## 開發用路由（§8.4，只在 `SHEETS_MODE=fake` 掛載於 `/api/dev`）

| 方法 | 路徑 | 回應 |
| --- | --- | --- |
| GET | `/api/dev/fake-sheets/:spreadsheetId` | 200 目前記憶體中的 `SheetSnapshot`；ID 無效 → 404 `SHEETS_NOT_FOUND` |
| POST | `/api/dev/fake-sheets/:spreadsheetId/reset` | 204，重新從 fixture 載入；ID 無效 → 404 `SHEETS_NOT_FOUND` |

`SHEETS_MODE=google` 時不掛載，請求 `/api/dev/*` 得 404（Express 預設）。
