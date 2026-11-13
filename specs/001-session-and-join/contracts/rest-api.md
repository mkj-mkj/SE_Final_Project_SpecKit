# REST API 契約（001 範圍）

來源：`docs/TECH_SPEC.md` §8。路徑、本文、回應與錯誤碼不得更改。錯誤格式一律 `{ "error": { "code": ErrorCode, "message": string } }`，HTTP 狀態依 §11；zod 驗證失敗 → 422 `INVALID_INPUT`。

## 老師（`/api/teacher`）

| 方法 | 路徑 | 驗證 | 本文 | 成功 | 錯誤 |
| --- | --- | --- | --- | --- | --- |
| POST | `/login` | — | `{ password: string }` | 200 `{ token }` | 401 UNAUTHORIZED、422 INVALID_INPUT |
| POST | `/sessions` | Bearer teacher | `{ teamCount?, fairnessMode?, windowSec? }` | 201 `TeacherView` | 401、422 INVALID_INPUT |
| GET | `/sessions/current` | Bearer teacher | — | 200 `TeacherView` | 401、404 SESSION_NOT_FOUND（尚無活動） |
| GET | `/sessions/:id` | Bearer teacher | — | 200 `TeacherView` | 401、404 SESSION_NOT_FOUND |
| PATCH | `/sessions/:id/settings` | Bearer teacher | `{ teamCount?, fairnessMode?, windowSec? }` | 200 `TeacherView` | 401、404、409 INVALID_PHASE、409 TEAM_HAS_MEMBERS、422 INVALID_INPUT |

## 公開（`/api/public`）

| 方法 | 路徑 | 本文 | 成功 | 錯誤 |
| --- | --- | --- | --- | --- |
| GET | `/sessions/:roomCode`（不分大小寫） | — | 200 `PublicSessionInfo` | 404 SESSION_NOT_FOUND |
| POST | `/sessions/:roomCode/join` | `{ teamId: string, nickname: string }` | 201 `{ token, memberId, teamId, sessionId }` | 404 SESSION_NOT_FOUND、404 TEAM_NOT_FOUND、422 INVALID_NICKNAME、409 NICKNAME_TAKEN、422 INVALID_INPUT |

## 學生（`/api/play`）

| 方法 | 路徑 | 驗證 | 成功 | 錯誤 |
| --- | --- | --- | --- | --- |
| GET | `/state` | Bearer member | 200 `TeamView & { me: { id, nickname } }` | 401 UNAUTHORIZED |

## 身分交叉規則（IT-AUTH-01～02）

- 不帶 token 呼叫老師 API → 401。
- member token 呼叫老師 API → 401；teacher token 呼叫 `/api/play/state` → 401。

## 不在 001

`/sessions/:id/import`（002）；`/start`、`/end`、`/reset`、`/api/play/drafts/*`、`/api/play/submissions*`（003）；`reject-winner`、`/export`、`/restore`、`export.csv`（004）；`/api/dev/*`（002）。
