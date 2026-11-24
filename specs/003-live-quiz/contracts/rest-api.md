# REST 與 Socket 契約（003-live-quiz）

來源：`docs/TECH_SPEC.md` v1.6 §8.1、§8.3、§9.2、§9.3、§11。路徑、本文、狀態碼、事件名稱照抄，不得改名。路由只做 zod 驗證與轉換，業務規則都在 `SessionService`（憲章原則 VIII）。

## 1. 老師（`/api/teacher`，`Authorization: Bearer <teacherToken>`）

| 方法 | 路徑 | 本文 | 成功 | 錯誤 |
| --- | --- | --- | --- | --- |
| POST | `/sessions/:id/start` | — | 200 `TeacherView` | 401 UNAUTHORIZED、404 SESSION_NOT_FOUND、409 INVALID_PHASE、422 NO_QUESTIONS |
| POST | `/sessions/:id/end` | — | 200 `TeacherView`（已結算所有視窗、phase=ENDED） | 401、404、409 INVALID_PHASE |
| POST | `/sessions/:id/reset` | — | 200 `TeacherView`（phase=READY、round+1） | 401、404、409 INVALID_PHASE |

## 2. 學生（`/api/play`，`Authorization: Bearer <memberToken>`）

| 方法 | 路徑 | 本文（zod） | 成功 | 錯誤 |
| --- | --- | --- | --- | --- |
| PUT | `/drafts/:questionId` | `{ answers: string[] }` | 204 | 401、404 QUESTION_NOT_FOUND、409 INVALID_PHASE、409 ALREADY_SUBMITTED、422 INVALID_INPUT、422 ANSWER_TOO_LONG |
| POST | `/submissions` | `{ questionId: string, answers: string[] }` | 201 `{ submissionId, serverTime, withdrawableUntil }` | 401、404 QUESTION_NOT_FOUND、409 INVALID_PHASE、409 ALREADY_SUBMITTED、422 INVALID_INPUT、422 ANSWER_REQUIRED、422 GROUP_INCOMPLETE、422 ANSWER_TOO_LONG |
| POST | `/submissions/:id/withdraw` | — | 204 | 401、404 SUBMISSION_NOT_FOUND、409 INVALID_PHASE、409 INVALID_STATE、409 WITHDRAW_WINDOW_EXPIRED |

- 本文缺欄位或型別不符 → 422 `INVALID_INPUT`（IT-VAL-01），由 001 的 `errorHandler` 處理 zod 錯誤。
- 客戶端送來的任何時間、名次、得主欄位都不讀取（zod schema 只取上表列出的欄位）。
- 錯誤本文：`{ "error": { "code": ErrorCode, "message": MESSAGES[code] } }`。

## 3. Socket.IO（001 已建立連線與 room；003 只增加推播時機）

| 事件 | room | Payload |
| --- | --- | --- |
| `teacher:state` | `teacher:${sessionId}` | `projectTeacherView(agg, now)` |
| `team:state` | `team:${teamId}` | `projectTeamView(agg, teamId, now)` |

| 觸發（SessionService） | 老師 | 組別 |
| --- | --- | --- |
| start、end、reset、submit、withdraw | 是 | 全部 |
| settleWindow（有變化時；含 settleWindow 結算時沒有候選、題目回到 open） | 是 | 全部 |
| recover（有結算時） | 是 | 全部 |
| updateDraft | 否 | 只有該成員所屬組 |

publish 一律在交易 COMMIT 之後（research R-01）。客戶端 → 伺服器沒有事件，所有指令都走 REST。
