# Data Model：搶答進行（003-live-quiz）

型別以 `docs/TECH_SPEC.md` v1.6 §4、§5、§7.8 為準。`shared/src/types.ts` 與 `server/src/db/schema.sql` 已由 001 依契約建立，本子功能**不改型別、不改 schema**；本文只說明讀寫規則、狀態轉換與衍生值的計算方式。

## 1. 保存的實體

### sessions（001 建立；本子功能更新的欄位）

| 欄位 | start | end | reset |
| --- | --- | --- | --- |
| `phase` | READY → RUNNING | RUNNING → ENDED | ENDED → READY |
| `started_at` | `clock.now()` | 不變 | `null` |
| `ended_at` | 不變（null） | `clock.now()` | `null` |
| `round` | 不變 | 不變 | `+1` |

`fairness_mode`、`window_sec` 在 RUNNING 中不可修改（001 的 `assertPhase('updateSettings')` 已擋下）。

### questions（002 建立；本子功能更新的欄位）

| 欄位 | 規則 |
| --- | --- |
| `state` | `open`／`window`／`settled`，轉換見 §2 |
| `window_ends_at` | 只有 `state='window'` 時非 null；等於開窗那筆送出的 `serverTime + windowSec × 1000` |

### drafts（本子功能新增讀寫）

| 欄位 | 型別 | 規則 |
| --- | --- | --- |
| `team_id` + `question_id` | PK | 每組每題最多一份 |
| `answers` | JSON `string[]` | 長度 = `subCount`；每格 ≤ 200 字；**不 trim**、允許空字串 |
| `updated_by` | string | 最後編輯成員的 **member id** |
| `updated_at` | number | `clock.now()` |

以整題為單位 upsert（spec FR-016a，後到者整份覆蓋）。在 submit 該題、reset、重新匯入（002）時刪除。

### submissions（本子功能新增讀寫）

| 欄位 | 型別 | 規則 |
| --- | --- | --- |
| `id` | string | `ids.id('sub')` |
| `session_id`、`question_id`、`team_id`、`member_id` | FK | 題目必須屬於該成員所在的活動 |
| `answers` | JSON `string[]` | 長度 = `subCount`；已 trim；每格 1～200 字 |
| `server_time` | number | 交易內 `clock.now()`；**不採用任何客戶端時間** |
| `seq` | number UNIQUE | `repo.nextSeq()`，全域嚴格遞增（research R-02） |
| `status` | `active`／`withdrawn`／`rejected` | 新增時一律為 `active`；`rejected` 由 004 寫入 |
| `order_key` | number \| null | 純速度模式或已結算題目：新增時就給 `nextOrderKey`；視窗中為 null，結算時補上 |
| `withdrawn_at` | number \| null | 撤回時為 `clock.now()` |

唯一索引 `uq_sub_team_q_live (team_id, question_id) WHERE status IN ('active','rejected')`：每組每題最多一筆 active 或 rejected，withdrawn 不佔名額（UT-REPO-03、04）。

## 2. 狀態轉換

### 題目 `QuestionState`

```text
            submit（speed）
   open ───────────────────────────────▶ settled
    │  ▲                                    ▲
    │  │ withdraw 後已無候選 /              │ settleWindow（有候選）
    │  │ settleWindow 時沒有候選            │ end（逐題結算）
    │  │                                    │ recover（已過期）
    ▼  │                                    │
   window ──────────────────────────────────┘
   （submit（fair）且 state=open 時進入；windowEndsAt = now + W 秒）

start、reset：所有題目 → open、windowEndsAt = null
```

- `settled` 之後不會再回到 `open`。即使得主撤回、所有送出都被撤回，題目仍維持 settled，下一筆送出直接取得 `nextOrderKey`（research R-06）。
- 純速度模式下送出時，不論題目原本是 open 或 settled，都設為 `settled`。

### 送出 `SubmissionStatus`

```text
active ──withdraw（RUNNING、本組、≤ 10000 ms）──▶ withdrawn（終態）
active ──rejectWinner（004）──────────────────▶ rejected（終態）
```

### 活動 `Phase`（本子功能負責的轉換）

`READY --start（題數 ≥ 1）--> RUNNING --end（先結算所有視窗）--> ENDED --reset--> READY`

## 3. 衍生值（不儲存，由 `domain/ranking.ts` 從送出紀錄計算）

| 值 | 計算 |
| --- | --- |
| 排序 `orderSubmissions(subs)` | 排除 withdrawn；依 `orderKey` 升冪（null 排最後）→ `serverTime` → `seq` |
| 順位 `rank` | 排序後的位置 + 1（連續、不重複；rejected 保留名次） |
| 得主 `winnerOf(subs)` | 排序後第一筆 `status='active'` 且 `orderKey !== null` 者；沒有 → null |
| 分數 `teamScores(teams, subsByQuestion)` | 每題 `winnerOf` 的 teamId +1；其他組為 0 |
| 公平排序 `sortFairCandidates(cands, scores)` | `scores.get(teamId) ?? 0` 升冪 → `serverTime` → `seq` |
| 名次鍵 `nextOrderKey(subs)` | 該題所有送出（含 withdrawn）的 `max(orderKey) + 1`；沒有則 1 |
| `assignOrderKeys(sorted, startAt)` | 依序給 `startAt, startAt+1, …` |

`nextOrderKey` 把 withdrawn 也算進去，所以撤回後重送的名次鍵一定排在既有名次之後（spec FR-032），且不會和既有鍵重複。

## 4. Repo 方法（本子功能新增；名稱與 `diagrams/003-class.puml` 一致）

| 方法 | 說明 |
| --- | --- |
| `upsertDraft(d: Draft): void` | `INSERT … ON CONFLICT(team_id, question_id) DO UPDATE` |
| `deleteDraft(teamId, questionId): void` | |
| `listDrafts(sessionId): Draft[]` | join teams 依 session 篩選 |
| `deleteDraftsBySession(sessionId): void` | reset 用 |
| `nextSeq(): number` | research R-02 |
| `insertSubmission(s: Submission): void` | 唯一索引衝突 → `AppError('ALREADY_SUBMITTED')`（research R-03） |
| `getSubmission(id): Submission \| null` | |
| `updateSubmission(id, patch: { status?, orderKey?, withdrawnAt? }): void` | 只更新有提供的欄位 |
| `listSubmissions(sessionId): Submission[]` | 依 `seq` 升冪 |
| `listSubmissionsByQuestion(questionId): Submission[]` | 依 `seq` 升冪 |
| `deleteSubmissionsBySession(sessionId): void` | reset 用 |
| `getQuestion(id): Question \| null` | |
| `updateQuestionState(id, state, windowEndsAt): void` | |
| `resetQuestionStates(sessionId): void` | 全部 `open`、`window_ends_at = null` |
| `listSessionsByPhase(phase): Session[]` | recover 用 |

`SessionService.loadAggregate` 改為讀取 `repo.listDrafts(sessionId)` 與 `repo.listSubmissions(sessionId)`（001／002 回傳空陣列）。

## 5. 視圖（`domain/projections.ts`）

### TeacherView（只送 `teacher:${sessionId}`）

| 欄位 | 003 規則 |
| --- | --- |
| `questions[].state`、`windowEndsAt` | 資料庫值 |
| `questions[].winnerTeamId` | `winnerOf(該題送出)?.teamId ?? null` |
| `teams[].score` | `teamScores` |
| `cells` | 每題 × 每組一格（題號升冪 → 組序升冪），共 `題數 × 組數` 格（UT-PROJ-02） |
| `cells[].submission` | 該組該題 `seq` 最大的一筆（UT-PROJ-03）；沒有則 null |
| `cells[].submission.submittedBy` | 送出成員暱稱 |
| `cells[].submission.rank` | withdrawn 或 `orderKey === null` → null；否則 `rankSubmissions` 的 rank |
| `cells[].submission.isWinner` | 與 `winnerOf` 相同的那一筆為 true |

TeacherView **不含草稿**（spec FR-015）。

### TeamView（只送 `team:${teamId}`；憲章原則 IV）

| 欄位 | 規則 |
| --- | --- |
| `drafts` | 只含本組；`{ [questionId]: { answers, updatedBy, updatedAt } }` |
| `mySubmissions` | 只含本組、每題 `seq` 最大的一筆；白名單欄位 `id, answers, submittedBy, serverTime, status, withdrawableUntil`；`withdrawableUntil = status==='active' ? serverTime + 10000 : null`（UT-PROJ-07） |
| `results` | `phase === 'ENDED'` 時為 `buildResults(agg)`，否則 null |

在 `phase !== 'ENDED'` 時，TeamView 遞迴後不得出現 `rank`、`isWinner`、`score`、`scores`、`state`、`windowEndsAt`、`winnerTeamId` 等 key，也不得出現他組的成員 id、暱稱、答案、送出 id（UT-PROJ-04、05、IT-VIS-01）。

### Results（`buildResults(agg)`）

| 欄位 | 規則 |
| --- | --- |
| `questions[]` | 題號升冪；`subLabels` 同 `questionInfo` |
| `winner` | `winnerOf` → `{ teamId, teamName, answers, submittedBy }`，沒有則 null |
| `ranking[]` | `rankSubmissions` 的結果（不含 withdrawn，含 rejected）；欄位 `rank, teamId, teamName, answers, submittedBy, serverTime, status, isWinner` |
| `scores[]` | 依分數降冪 → 組序升冪（UT-PROJ-08） |

## 6. 驗證規則（錯誤碼依 TECH_SPEC §11）

| 動作 | 檢查順序 → 錯誤 |
| --- | --- |
| start | 階段 READY（INVALID_PHASE）→ 題數 ≥ 1（NO_QUESTIONS） |
| end | 階段 RUNNING（INVALID_PHASE） |
| reset | 階段 ENDED（INVALID_PHASE） |
| updateDraft | 階段 RUNNING（INVALID_PHASE）→ 題目屬於活動（QUESTION_NOT_FOUND）→ 長度 = subCount（INVALID_INPUT）→ 每格 ≤ 200（ANSWER_TOO_LONG）→ 本組該題沒有 active／rejected（ALREADY_SUBMITTED） |
| submit | TECH_SPEC §7.9 submit 演算法步驟 1～6；`validateAnswers`（shared，001 已實作）負責步驟 4～5 |
| withdraw | 階段 RUNNING（INVALID_PHASE）→ 送出存在且屬於本組（SUBMISSION_NOT_FOUND，不透露他組送出是否存在）→ `status='active'`（INVALID_STATE）→ `now - serverTime ≤ 10000`（WITHDRAW_WINDOW_EXPIRED） |
| HTTP 本文 | zod：drafts `{ answers: string[] }`；submissions `{ questionId: string, answers: string[] }`；不符 → 422 INVALID_INPUT（IT-VAL-01） |
