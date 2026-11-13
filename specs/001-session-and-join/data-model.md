# Data Model：001-session-and-join

完整型別見 `docs/TECH_SPEC.md` §4（欄位名稱為契約），資料表見 §5。本子功能建立 §5 **全部**資料表，但只讀寫 `sessions`、`teams`、`members`。

## 實體

### Session（`sessions`）

| 欄位 | 型別 | 001 規則 |
| --- | --- | --- |
| id | string | `ids.id('ses')` |
| roomCode | string | 6 碼，字元 ∈ `ROOM_CODE_ALPHABET`；UNIQUE；重複時重抽最多 10 次 |
| phase | Phase | 建立時 `SETUP`；001 不會改變 |
| spreadsheetId、sheetTitle | string \| null | 001 一律 null（002 寫入） |
| fairnessMode | `'speed' \| 'fair'` | 預設 `fair` |
| windowSec | number | 1–10，預設 3；切到 speed 時保留原值 |
| teamCount | number | 2–20，預設 6；與 teams 筆數一致 |
| round | number | 建立時 1 |
| createdAt | number | `clock.now()` |
| startedAt、endedAt | number \| null | 001 一律 null |
| import_summary（僅 DB） | JSON | 001 為 null |

### Team（`teams`）

| 欄位 | 規則 |
| --- | --- |
| id | `ids.id('team')` |
| sessionId | 所屬活動 |
| index（DB 欄位 `idx`） | 1..teamCount；`UNIQUE(session_id, idx)` |
| name | `第 ${index} 組` |

### Member（`members`）

| 欄位 | 規則 |
| --- | --- |
| id | `ids.id('mem')` |
| teamId | 所屬組 |
| nickname | `normalizeNickname` 後的值（trim；1–20 字；符合 `NICKNAME_PATTERN`） |
| nickname_key（僅 DB） | `nicknameKey(nickname)`；`UNIQUE(team_id, nickname_key)` |
| token | `ids.token()`（正式為 32 bytes hex）；UNIQUE |
| joinedAt、lastSeenAt | `clock.now()`；`setOnline` 狀態改變時更新 lastSeenAt |

### 執行期（不持久化）

| 名稱 | 位置 | 內容 |
| --- | --- | --- |
| teacherTokens | `AuthService` | `Set<string>`；伺服器重啟即失效 |
| onlineMemberIds | `SessionService` | `Set<string>`；重啟後為空 |
| 連線計數 | `realtime/socket.ts` | `Map<memberId, number>`；0↔1 時呼叫 `setOnline` |

## 關係

`Session 1 ── 2..20 Team 1 ── 0..* Member`（刪除 session 時 CASCADE；減少組數只刪除無成員的組）

## 驗證規則（對應 spec FR）

| 規則 | 函式／位置 | 錯誤碼 |
| --- | --- | --- |
| 房間碼：trim、轉大寫、6 碼、字元在字母表 | `normalizeRoomCode` | SESSION_NOT_FOUND |
| 暱稱：trim、1–20 字、`NICKNAME_PATTERN` | `normalizeNickname` | INVALID_NICKNAME |
| 組內暱稱不重複（不分大小寫） | `join` + UNIQUE 索引 | NICKNAME_TAKEN |
| 組別屬於該活動 | `join` | TEAM_NOT_FOUND |
| 組數 2–20、秒數 1–10、模式 speed／fair | `createSession`、`updateSettings`（zod） | INVALID_INPUT |
| 減少組數時被移除組無成員 | `updateSettings` | TEAM_HAS_MEMBERS |
| 修改設定只在 SETUP／READY | `assertPhase(phase, 'updateSettings')` | INVALID_PHASE |

## 階段（§6）

001 實作完整的 `assertPhase`／`nextPhase`（13 個動作 × 4 階段），但只有 `createSession → SETUP` 實際發生；`join` 允許所有階段。

## 視圖投影（001 範圍）

| 視圖 | 001 填入 | 001 回傳空值 |
| --- | --- | --- |
| `TeacherView` | `session`；`teams`（含 `score: 0`、`members[{id, nickname, online}]`）；`serverNow` | `questions: []`、`cells: []`、`importSummary: null` |
| `TeamView` | `session {roomCode, phase, round}`；`team {id, name, members}`（只含本組）；`serverNow` | `questions: []`、`drafts: {}`、`mySubmissions: {}`、`results: null` |
| `PublicSessionInfo` | `roomCode`、`phase`、`teams[{id, name, memberCount}]`（不含暱稱） | — |
| `GET /api/play/state` | `TeamView & { me: { id, nickname } }` | — |
