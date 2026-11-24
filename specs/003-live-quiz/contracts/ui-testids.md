# 前端契約（003-live-quiz）

來源：`docs/TECH_SPEC.md` v1.6 §10.3、§10.4。`data-testid` 照抄，不得新增或改名。三個控制按鈕都是按下即執行，沒有確認步驟（research D1）。

## 1. Hooks 與工具

```ts
// client/src/format.ts
export function formatTime(ms: number): string;        // 'HH:mm:ss.SSS'（Asia/Taipei）；formatTime(0) === '08:00:00.000'
export function formatClock(ms: number): string;       // 'HH:mm:ss'（Asia/Taipei，學生端）
export function formatAnswers(answers: string[], subLabels: string[]): string; // 題組「（1）CPU／（2）作業系統」；單題原樣

// client/src/hooks/useServerClock.ts
export function useServerClock(serverNow: number | undefined): () => number;
export function useTick(intervalMs: number): void;     // 定時重新渲染（倒數用）

// useTeacher（001 建立，003 新增）
start(): Promise<void>; end(): Promise<void>; reset(): Promise<void>;
// usePlay（001 建立，003 新增）
setDraft(questionId: string, answers: string[]): void; // 立即更新本地，300 ms debounce 後 PUT
submit(questionId: string): Promise<void>;             // 以目前本地草稿送出
withdraw(submissionId: string): Promise<void>;
// usePlay 只回傳 TECH_SPEC §10.3 的 view、me、error、setDraft、submit、withdraw，不新增欄位（憲章原則 IX）；
// 本地草稿合併進回傳的 view.drafts（距上次本地輸入 < 1 秒的題目保留本地值，research R-11）
```

`api.ts` 新增：`start/end/reset(token, sessionId)`、`putDraft(token, qid, answers)`、`submit(token, qid, answers)`、`withdraw(token, submissionId)`。

## 2. 元件與 `data-testid`

| 元件 | testid | 規則 |
| --- | --- | --- |
| `ControlBar` | `btn-start`、`btn-end`、`btn-reset` | READY 只有 `btn-start` 可按；RUNNING 只有 `btn-end`；ENDED 只有 `btn-reset`；SETUP 全部停用；`useTeacher.busy` 時全部停用（UT-UI-CTRL-01） |
| `StatusGrid` | `status-grid`、`status-cell-{qNumber}-{teamIndex}`、`question-state-{qNumber}` | 格子規則見 §3；`question-state-{n}` 在 `state='window'` 時顯示 `判定中 x.x s`（UT-UI-GRID-02） |
| `AnswerCard` | `answer-card-{qNumber}`、`answer-input-{qNumber}-{subNo}`、`btn-submit-{qNumber}`、`submitted-{qNumber}`、`btn-withdraw-{qNumber}`、`withdraw-countdown-{qNumber}` | 狀態表見 §4 |

## 3. StatusCell（老師端，UT-UI-GRID-01）

| 狀態 | 顯示 |
| --- | --- |
| 無送出 | `—` |
| active、非得主 | `formatAnswers`、送出者、`formatTime(serverTime)`、`#rank`；`rank === null` 時顯示 `判定中` |
| active、得主 | 同上並加 `★ 得主`，強調樣式 |
| withdrawn | `已撤回`（灰字） |
| rejected | `✗ 判錯`（刪除線） |

## 4. AnswerCard（學生端；rejected 狀態屬 004）

| 條件 | 輸入框 | 按鈕／文字 |
| --- | --- | --- |
| phase ≠ RUNNING | disabled，placeholder「等待老師開始」 | `btn-submit` disabled |
| RUNNING、未送出 | 可編輯，內容為本地草稿；輸入時呼叫 `setDraft` | `btn-submit` 在任一子題 trim 後為空時 disabled（UT-UI-CARD-02） |
| RUNNING、active、`withdrawableUntil - now > 0` | disabled，顯示已送出答案 | `submitted-{n}`「已送出 HH:mm:ss」＋`btn-withdraw-{n}`，`withdraw-countdown-{n}`「撤回（n 秒）」，n = ceil(剩餘毫秒 / 1000)（UT-UI-CARD-04） |
| RUNNING、active、剩餘 ≤ 0 | disabled | 只有 `submitted-{n}`「已送出 HH:mm:ss」 |
| RUNNING、withdrawn | 可編輯，初始值為撤回的答案（伺服器有新草稿時以草稿為準） | `btn-submit`（UT-UI-CARD-05） |

學生端在 RUNNING 中不顯示得主、順位或分數（FR-10）。

## 5. 頁面

- `TeacherDashboard`：READY／RUNNING／ENDED 顯示 `ControlBar`；RUNNING、ENDED 顯示 `StatusGrid`。
- `Play`：搶答畫面依題號列出 `AnswerCard`，`answers` 取 `view.drafts[qid]?.answers`（沒有時：withdrawn 取撤回的答案，否則為空格）；ENDED 的 StudentResults 屬 004。
- 搶答中不顯示計分板（PRD §3.2 E6 範圍外）；分數 `score-{teamIndex}` 屬 004 的 ResultsTable。
