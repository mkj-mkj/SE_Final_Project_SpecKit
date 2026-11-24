# 伺服器模組契約（003-live-quiz）

簽名照抄 `docs/TECH_SPEC.md` v1.6 §7；「補充」列出 plan 決定的內部規則（research.md）。domain 與 service 不得直接呼叫 `Date.now()`、`setTimeout`、`Math.random()`，一律透過 `Clock`、`Scheduler`、`IdGen`。

## 1. `server/src/domain/ranking.ts`（§7.6，純函式）

```ts
export function orderSubmissions(subs: Submission[]): Submission[];
export function rankSubmissions(subs: Submission[]): RankedSubmission[];
export function winnerOf(subs: Submission[]): Submission | null;
export function teamScores(teams: Team[], subsByQuestion: Map<string, Submission[]>): Map<string, number>;
```

測試：UT-RANK-01～09。不修改輸入陣列（回傳新陣列）。

## 2. `server/src/domain/settlement.ts`（§7.7，純函式）

```ts
export function sortFairCandidates(cands: Submission[], scores: Map<string, number>): Submission[];
export function assignOrderKeys(sorted: Submission[], startAt: number): Map<string, number>;
export function nextOrderKey(subs: Submission[]): number;
```

測試：UT-SETTLE-01～06。

## 3. `server/src/domain/projections.ts`（§7.8，補完）

```ts
export function projectTeacherView(agg: SessionAggregate, now: number): TeacherView;   // 補 cells、winnerTeamId、score
export function projectTeamView(agg: SessionAggregate, teamId: string, now: number): TeamView; // 補 drafts、mySubmissions、results
export function buildResults(agg: SessionAggregate): Results;
```

規則見 data-model §5。測試：UT-PROJ-02～08（UT-PROJ-01、10 為 002／001 既有案例，必須維持通過）。

## 4. `server/src/services/sessionService.ts`（§7.9）

```ts
start(sessionId: string): TeacherView;
end(sessionId: string): TeacherView;
reset(sessionId: string): TeacherView;
updateDraft(memberToken: string, questionId: string, answers: string[]): void;
submit(memberToken: string, questionId: string, answers: string[]): { submissionId: string; serverTime: number; withdrawableUntil: number };
withdraw(memberToken: string, submissionId: string): void;
settleWindow(questionId: string): void;
recover(): void;
```

補充：

| 方法 | 交易內 | COMMIT 後 |
| --- | --- | --- |
| start | assertPhase → 題數檢查 → `resetQuestionStates` → phase=RUNNING、startedAt=now | publish（全部） |
| end | assertPhase → 依 `(windowEndsAt, number)` 逐題 `settleInTx`（每題重算 `teamScores`）→ phase=ENDED、endedAt=now | `scheduler.cancel('window:<qid>')`（每個原本在視窗中的題目）→ publish 一次 |
| reset | assertPhase → `deleteSubmissionsBySession`、`deleteDraftsBySession`、`resetQuestionStates` → round+1、phase=READY、startedAt=endedAt=null | publish |
| updateDraft | data-model §6 → `upsertDraft`（不 trim） | publish `{ teacher:false, teamIds:[teamId] }` |
| submit | TECH_SPEC submit 演算法步驟 1～9 | 步驟 8b 的 `scheduler.schedule('window:<qid>', windowEndsAt, () => onWindowDue(sessionId))`；`onWindowDue` 依 `(windowEndsAt, number)` 對所有已到期視窗題逐題呼叫 `settleWindow`（research R-04） → publish |
| withdraw | data-model §6 → status=withdrawn、withdrawnAt=now；題目 window 且已無 `active && orderKey===null` 的候選 → state=open、windowEndsAt=null | 有回到 open 時 `scheduler.cancel('window:<qid>')` → publish |
| settleWindow | 完全照 TECH_SPEC 演算法，只結算本題：題目不是 window → 不做任何事；否則 `settleInTx(本題)` | 有變化才 publish（UT-SVC-FAIR-09） |
| recover | 對每個 RUNNING 活動：清空上線集合；已過期視窗依 `(windowEndsAt, number)` 逐題結算 | 未過期者 `scheduler.schedule`；有結算的活動 publish |

- 排程回呼以 try/catch 包住，例外時只記錄 log（research R-09）。
- `loadAggregate` 補讀 drafts、submissions。

測試：UT-SVC-PHASE-01～05、UT-SVC-DRAFT-01～06、UT-SVC-SUB-01～10、UT-SVC-FAIR-01～10、UT-SVC-WD-01～06、UT-SVC-RECOVER-01～03。

## 5. `server/src/boot/recover.ts`（§7.12）

```ts
export function recoverOnBoot(service: SessionService): void; // 呼叫 service.recover()
```

`createApp` 設定 `app.locals.service`，`app.ts` 匯出 `serviceOf(app: Express): SessionService`；`index.ts` 在 `listen` 前呼叫 `recoverOnBoot(serviceOf(app))`（TECH_SPEC §2、research R-08、D3）。`createApp` 的簽名與回傳值 `{ app, httpServer, io }` 不變。測試：IT-RESTART-01。

## 6. Repo（`server/src/db/repo.ts`）

方法列表見 data-model §4。測試：UT-REPO-02～06。

## 7. 測試替身（TEST_SPEC §3）

```ts
// server/test/helpers/seed.ts
export function seedRunning(t: ReturnType<typeof makeTestService>, opts?: {
  fixture?: 'template-a' | 'template-b'; teams?: number; membersPerTeam?: number;
  mode?: 'speed' | 'fair'; windowSec?: number;
}): Promise<{ sessionId: string; teamIds: string[]; tokens: string[][]; q: Record<number, string> }>;
// 預設 template-a、3 組、每組 2 人、speed；流程：createSession → importSheet(`fixture-${fixture}`) → 各組 join（暱稱為合法英數字）→ start；完成後 phase=RUNNING
```

答案常數：第 1 題 `['CPU','作業系統']`、第 2 題 `['演算法','堆疊']`、第 3 題 `['0']`、第 4 題 `['IP']`（放在 `seed.ts` 一併匯出 `ANSWERS`）。

`ManualScheduler`、`FakeClock`、`SeqIdGen`、`RecordingBroadcaster`、`makeTestService` 由 001 建立，003 直接使用，不修改。
