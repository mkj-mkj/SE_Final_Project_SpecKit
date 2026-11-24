# REST API 契約：結果與匯出（004）

照抄 `docs/TECH_SPEC.md` §8.1；錯誤格式 `{ "error": { "code": ErrorCode, "message": string } }`，狀態碼與訊息依 §11。所有路由需 `Authorization: Bearer <teacherToken>`（否則 401 `UNAUTHORIZED`）。`:id` 不是目前活動 → 404 `SESSION_NOT_FOUND`。

路由只做驗證與轉換（憲章原則 VIII），業務規則在 `SessionService`。

## POST `/api/teacher/sessions/:id/questions/:qid/reject-winner`

| 項目 | 內容 |
| --- | --- |
| 本文 | 無 |
| 成功 | 200 `TeacherView` |
| 推播 | `teacher:state` ＋ 全部組 `team:state`（§9.3） |
| 錯誤 | 409 `INVALID_PHASE`（phase ∉ {RUNNING, ENDED}）；404 `QUESTION_NOT_FOUND`（題目不存在或不屬於本活動）；409 `NO_WINNER`「此題目前沒有得主」 |

## POST `/api/teacher/sessions/:id/export`

| 項目 | 內容 |
| --- | --- |
| 本文 | 無 |
| 成功 | 200 `{ updatedCells: number, writes: CellWrite[] }`（writes 依 sheetTitle → row → col；含 plan D1 的原始值寫入） |
| 推播 | 無 |
| 錯誤 | 409 `INVALID_PHASE`（phase ≠ ENDED，閘道不被呼叫）；403 `SHEETS_PERMISSION_DENIED`；404 `SHEETS_NOT_FOUND`；502 `SHEETS_ERROR` |

範例 A（第 1 題得主 `['CPU','作業系統']`、第 3 題得主 `['0']`）：

```json
{
  "updatedCells": 3,
  "writes": [
    { "sheetTitle": "學習單", "a1": "G5", "value": "（1）CPU" },
    { "sheetTitle": "學習單", "a1": "G6", "value": "（2）作業系統" },
    { "sheetTitle": "學習單", "a1": "G11", "value": "0" }
  ]
}
```

## POST `/api/teacher/sessions/:id/restore`

| 項目 | 內容 |
| --- | --- |
| 本文 | 無 |
| 成功 | 200 `{ updatedCells: number }`（範例 A = 6） |
| 推播 | 無 |
| 錯誤 | 409 `INVALID_PHASE`（phase ∉ {READY, ENDED}）；403／404／502 同上 |

## GET `/api/teacher/sessions/:id/export.csv`

| 項目 | 內容 |
| --- | --- |
| 成功 | 200；`Content-Type: text/csv; charset=utf-8`；`Content-Disposition: attachment; filename="results-<roomCode>-r<round>.csv"`；本文為 `buildResultsCsv(buildCsvRows(agg))` |
| 推播 | 無 |
| 錯誤 | 409 `INVALID_PHASE`（phase ≠ ENDED） |

本文範例（UTF-8 BOM 開頭、CRLF）：

```
﻿題號,子題,組別,送出者,答案,伺服器時間,順位,狀態,是否得主
1,1,第 2 組,小華,CPU,2026-11-24T14:03:05.120+08:00,1,有效,是
1,2,第 2 組,小華,作業系統,2026-11-24T14:03:05.120+08:00,1,有效,是
3,1,第 1 組,小明,0,2026-11-24T14:03:06.002+08:00,1,判錯,否
3,1,第 2 組,阿傑,"1,0",2026-11-24T14:03:06.090+08:00,2,有效,是
3,1,第 3 組,小美,'=1+1,2026-11-24T14:03:04.500+08:00,,已撤回,否
```
