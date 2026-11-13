# Socket.IO 契約（001 範圍）

來源：`docs/TECH_SPEC.md` §7.11、§9。001 實作本節全部內容。

## 連線

```ts
io('/', { auth: { token: teacherToken, sessionId } });  // 老師
io('/', { auth: { token: memberToken } });              // 學生
```

| 情況 | 結果 |
| --- | --- |
| teacher token 有效，且帶有存在的 `sessionId` | 加入 room `teacher:${sessionId}`，立即收到 `teacher:state` |
| member token 有效 | 加入 room `team:${teamId}`；連線數 0→1 時 `setOnline(memberId, true)`；立即收到 `team:state` |
| 其他（無 token、錯誤 token、teacher token 缺 sessionId） | `connect_error.message === 'UNAUTHORIZED'`；客戶端清除身分並導回登入／加入頁 |
| 斷線 | 該成員連線數 1→0 時 `setOnline(memberId, false)` 並 publish（多分頁時最後一個斷線才算離線） |

## 伺服器 → 客戶端事件

| 事件 | Room | Payload |
| --- | --- | --- |
| `teacher:state` | `teacher:${sessionId}` | `projectTeacherView(agg, now)` |
| `team:state` | `team:${teamId}` | `projectTeamView(agg, teamId, now)`（只含本組，不含 `cells`） |

客戶端 → 伺服器：無（所有指令走 REST）。

## 推播範圍（§9.3 中 001 會觸發者）

| 觸發 | teacher | 組別 |
| --- | --- | --- |
| createSession、updateSettings | 是 | 全部 |
| join、上線／離線 | 是 | 該成員所屬組 |

`PublishScope` 預設 `{ teacher: true, teamIds: 'all' }`；`publish` 時載入一次 aggregate。
