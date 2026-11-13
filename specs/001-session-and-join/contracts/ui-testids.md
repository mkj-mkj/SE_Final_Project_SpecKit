# UI 契約：路由與 data-testid（001 範圍）

來源：`docs/TECH_SPEC.md` §10.1、§10.2、§10.4。名稱不得更改。

## 路由

| 路徑 | 頁面 | 進入條件 |
| --- | --- | --- |
| `/` | Home（「我是老師」「我是學生」） | — |
| `/teacher/login` | TeacherLogin | — |
| `/teacher` | TeacherDashboard | sessionStorage 有 `quiz.teacher`，否則導向 `/teacher/login` |
| `/join` | Join（支援 `?room=`） | 有 `quiz.member` 時先 `GET /api/play/state`：200 → `/play`；401 → `clearMember()` 並預填原房間碼 |
| `/play` | Play | localStorage 有 `quiz.member`，否則導向 `/join`；`GET /state` 401 → `clearMember()` 並導向 `/join?room=<roomCode>` |

## 儲存

| Key | 位置 | 內容 |
| --- | --- | --- |
| `quiz.teacher` | sessionStorage | `{ token }` |
| `quiz.member` | localStorage | `{ token, roomCode, memberId }` |

## data-testid

| 元件 | testid |
| --- | --- |
| PhaseBadge | `phase-badge`（準備中／等待開始／搶答中／已結束） |
| ErrorBanner | `error-banner` |
| LoginForm | `teacher-password`、`teacher-login-submit` |
| TeacherDashboard（頁面） | `btn-create-session`（只在無活動時存在）、`teacher-logout` |
| SettingsForm | `settings-team-count`、`settings-mode-speed`、`settings-mode-fair`、`settings-window-sec`（只在 fair 時存在）、`settings-save` |
| RoomCode | `room-code` |
| TeamList | `team-row-{index}`、`team-member-count-{index}` |
| JoinForm | `join-room`、`join-room-next`、`join-team-{index}`、`join-nickname`、`join-submit` |
| TeamHeader | `team-name`、`my-nickname`、`team-members` |

## Hooks（001 範圍）

- `useTeacher`：`view`、`error`、`busy`、`createSession`、`updateSettings`（其餘方法屬 002–004）
- `usePlay`：`view`、`me`、`error`（其餘方法屬 003）
