# Data Model：結果與匯出（004-results-export）

型別定義照抄 `docs/TECH_SPEC.md` §4、§7.5（欄位名稱不得更改）。**本子功能不修改資料庫 schema、不新增資料表或欄位**；判錯只更新 `submissions.status`。

## 1. 持久化實體（沿用，只列本子功能用到的欄位）

### Submission（`submissions`，003 建立）

| 欄位 | 型別 | 本子功能用途 |
| --- | --- | --- |
| id | string | 判錯目標、CSV 排序穩定鍵 |
| sessionId、questionId、teamId、memberId | string | 分組、組名、送出者暱稱 |
| answers | string[]（長度 = subCount，已 trim） | 結果、寫回、CSV（每子題一列） |
| serverTime、seq | number | 結果顯示、CSV 時間與 null 名次排序 |
| status | `'active' \| 'withdrawn' \| 'rejected'` | **判錯：active → rejected（唯一寫入）** |
| orderKey | number \| null | 名次；rejected 保留 |

**狀態轉換（本子功能新增的一條）**：

```
active ──(rejectWinner：phase ∈ {RUNNING, ENDED} 且為該題 winnerOf)──▶ rejected
```

- rejected 為終態：不可撤回（003 withdraw 要求 active → `INVALID_STATE`）、不可復原；只在 `reset` 時隨送出一併刪除。
- 唯一索引 `uq_sub_team_q_live`（active 或 rejected 每組每題最多 1 筆）使被判錯組無法重送（`ALREADY_SUBMITTED`）。

### AnswerSlot（`answer_slots`，002 建立，唯讀）

| 欄位 | 用途 |
| --- | --- |
| questionId、subNo | 對應題目與子題（answers[subNo-1]） |
| sheetTitle、a1 | **寫回與還原唯一的位置來源**（憲章原則 V；禁止寫死儲存格） |
| row、col | 寫入排序鍵（sheetTitle → row → col） |
| prefix | 寫回值 = prefix + 答案 |
| originalValue | 還原值；D1 判錯到無得主時的寫回值 |

### Session（唯讀）

`phase`（階段檢查）、`spreadsheetId`（寫回目標）、`roomCode`、`round`（CSV 檔名）。

### Question、Team、Member（唯讀）

`Question.number`、`isGroup`、`subCount`；`Team.index`、`name`；`Member.nickname`（送出者）。

## 2. 衍生值（不儲存，由 `domain/ranking.ts` 計算）

| 值 | 規則 |
| --- | --- |
| 順位 rank | `orderSubmissions`：排除 withdrawn → orderKey 升冪（null 最後）→ serverTime → seq；位置 + 1 |
| 得主 | 排序後第一筆 `status = 'active'` 且 `orderKey !== null`；rejected 跳過 → **自動遞補** |
| 分數 | 每題得主的組 +1；判錯後原得主不再是得主 → **自動 −1**；最低 0 |
| 判錯到無得主（D1） | `winnerOf(subs) === null && subs.some(s => s.status === 'rejected')` |

## 3. 值物件（TECH_SPEC §4、§7.5）

### Results（只在 ENDED 放入 TeamView.results；003 已實作 `buildResults`）

```ts
interface Results {
  questions: {
    questionId: string; number: number; isGroup: boolean; subLabels: string[];
    winner: null | { teamId: string; teamName: string; answers: string[]; submittedBy: string };
    ranking: { rank: number; teamId: string; teamName: string; answers: string[];
               submittedBy: string; serverTime: number; status: 'active' | 'rejected'; isWinner: boolean }[];
  }[];
  scores: { teamId: string; teamName: string; score: number }[]; // 分數降冪、組序升冪
}
```

### CellWrite

```ts
interface CellWrite { sheetTitle: string; a1: string; value: string; }
```

- 寫回：`value = slot.prefix + winner.answers[slot.subNo - 1]`（有得主的題目）。
- D1：`value = slot.originalValue`（判錯到無得主的題目）。
- 還原：`value = slot.originalValue`（全部 slots）。

### CsvRow

```ts
interface CsvRow {
  questionNumber: number; subNo: number; teamName: string; submittedBy: string; answer: string;
  serverTime: number; rank: number | null; status: SubmissionStatus; isWinner: boolean;
}
```

- 每筆送出 × 每個子題一列；withdrawn 的 `rank = null`、`isWinner = false`。
- 排序：questionNumber ↑ → rank ↑（null 最後；null 之間 serverTime ↑、seq ↑）→ subNo ↑。

## 4. CSV 檔案格式（E2，TECH_SPEC §7.5）

| 項目 | 規則 |
| --- | --- |
| 編碼 | UTF-8，開頭 BOM `﻿` |
| 換行 | `\r\n`，最後一列後也有 |
| 表頭 | `題號,子題,組別,送出者,答案,伺服器時間,順位,狀態,是否得主` |
| 時間 | `YYYY-MM-DDTHH:mm:ss.SSS+08:00` |
| 狀態 | 有效／已撤回／判錯 |
| 是否得主 | 是／否 |
| 順位 null | 空字串 |
| 防公式 | 欄位開頭 `=` `+` `-` `@` → 前加 `'` |
| 跳脫 | 含 `,` `"` `\r` `\n` → 雙引號包住、`"` → `""`（在防公式之後） |
| 檔名 | `results-<roomCode>-r<round>.csv` |

## 5. 階段允許（TECH_SPEC §6，`assertPhase`）

| 動作 | 允許階段 | 其他 |
| --- | --- | --- |
| rejectWinner | RUNNING、ENDED | INVALID_PHASE |
| export | ENDED | INVALID_PHASE |
| csv | ENDED | INVALID_PHASE |
| restore | READY、ENDED | INVALID_PHASE |
