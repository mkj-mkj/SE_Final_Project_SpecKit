// 活動階段狀態機（TECH_SPEC §6）
import { AppError, type Phase } from '@quiz/shared';

export type Action =
  | 'import'
  | 'updateSettings'
  | 'start'
  | 'end'
  | 'reset'
  | 'draft'
  | 'submit'
  | 'withdraw'
  | 'rejectWinner'
  | 'export'
  | 'restore'
  | 'csv'
  | 'join';

/**
 * 每個動作允許的階段（§6 表格）：
 * - 匯入、修改設定只在搶答開始前（準備中／等待開始）
 * - 作答相關（草稿、送出、撤回）只在搶答中
 * - 判錯可在搶答中或結束後；匯出與 CSV 只在結束後；還原在等待開始或結束後
 * - 加入不限階段（任何時候都能加入）
 */
const ALLOWED_PHASES: Record<Action, readonly Phase[]> = {
  import: ['SETUP', 'READY'],
  updateSettings: ['SETUP', 'READY'],
  start: ['READY'],
  end: ['RUNNING'],
  reset: ['ENDED'],
  draft: ['RUNNING'],
  submit: ['RUNNING'],
  withdraw: ['RUNNING'],
  rejectWinner: ['RUNNING', 'ENDED'],
  export: ['ENDED'],
  csv: ['ENDED'],
  restore: ['READY', 'ENDED'],
  join: ['SETUP', 'READY', 'RUNNING', 'ENDED'],
};

/** 目前階段不允許該動作時丟出 INVALID_PHASE */
export function assertPhase(phase: Phase, action: Action): void {
  if (!ALLOWED_PHASES[action].includes(phase)) {
    throw new AppError('INVALID_PHASE');
  }
}

/** 會改變階段的動作執行後的新階段（匯入 → 等待開始；開始 → 搶答中；結束 → 已結束；重設 → 等待開始） */
const NEXT_PHASE: Record<'import' | 'start' | 'end' | 'reset', Phase> = {
  import: 'READY',
  start: 'RUNNING',
  end: 'ENDED',
  reset: 'READY',
};

export function nextPhase(phase: Phase, action: 'import' | 'start' | 'end' | 'reset'): Phase {
  assertPhase(phase, action);
  return NEXT_PHASE[action];
}
