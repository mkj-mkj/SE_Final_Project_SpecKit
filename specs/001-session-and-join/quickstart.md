# Quickstart：驗證 001-session-and-join

## 前置條件

- Node.js 22.13 以上（`node -v`）；Microsoft Edge（E2E 用）；Java + `plantuml.jar`（重產圖表用）
- 複製 `.env.example` 為 `.env`，設定 `TEACHER_PASSWORD`（不要提交 `.env`）

```bash
npm install
```

## 自動化驗證

| 指令 | 期望 |
| --- | --- |
| `npm run lint` | ESLint 與 `tsc --noEmit` 無錯誤 |
| `npm test` | 001 列的 UT／IT 全部通過（UT-VAL、UT-ERR、UT-PHASE、UT-REPO-01／07、UT-AUTH、UT-SVC-CREATE、UT-SVC-JOIN、UT-PROJ-10、UT-BC、UT-UI-*、IT-AUTH-01～03、IT-ONLINE-01） |
| `npm run test:coverage` | 達到 TEST_SPEC §2.3 門檻 |
| `npm run test:e2e` | E2E-03、E2E-18 通過，截圖存於 `e2e/artifacts/` |
| `java -jar plantuml.jar "./diagrams/*.puml"` | 無錯誤，PNG 與 `.puml` 同步 |

## 手動驗證情境（對應 diagrams/001-sequence.puml）

啟動：`npm run dev`，開啟 `http://localhost:5173`。

1. **老師登入並建立活動**
   - `/teacher/login` 輸入錯誤密碼 → `error-banner` 顯示「驗證失敗，請重新登入或加入」。
   - 輸入正確密碼 → `/teacher` 顯示 `btn-create-session` → 按下 → `room-code` 顯示 6 碼（不含 I、O、0、1），`team-row-1`～`team-row-6`，`phase-badge` 為「準備中」。
   - 重新整理 → 仍在管理頁，房間碼相同，且沒有 `btn-create-session`。
   - 按 `teacher-logout` → 回到登入頁；再開 `/teacher` 需重新登入。
2. **調整設定**：組數改 8 → 出現第 7、8 組；選「純速度」→ `settings-window-sec` 消失；組數輸入 25 → 無法儲存。
3. **學生加入**（另開無痕視窗）
   - `/join` 輸入小寫房間碼 → 顯示各組與人數 → 選第 1 組、暱稱「小明」→ 進入 `/play`，`team-name`＝第 1 組、`my-nickname`＝小明，`phase-badge`＝準備中。
   - 老師畫面 1 秒內 `team-member-count-1` 變 1，「小明」顯示上線。
   - 另一視窗以「小明😀」加入 → 「暱稱需為 1–20 個中文字、英文字母或數字」；以「小明」加入第 1 組 → 「這個暱稱在組內已被使用」。
4. **重連與重複加入**
   - 學生重新整理 `/play` → 自動回到第 1 組「小明」，老師端人數不變。
   - 學生開啟 `/join` → 直接導回 `/play`。
   - 同一學生開兩個 `/play` 分頁，關一個 → 老師端仍上線；兩個都關 → 離線。
5. **減少組數被拒**：第 5 組有成員時把組數改為 4 → 「要移除的組別已有成員」，組數維持不變。

## 參考

- 端點：[contracts/rest-api.md](./contracts/rest-api.md)
- 連線與事件：[contracts/socket-events.md](./contracts/socket-events.md)
- 路由與 testid：[contracts/ui-testids.md](./contracts/ui-testids.md)
- 實體與驗證：[data-model.md](./data-model.md)
