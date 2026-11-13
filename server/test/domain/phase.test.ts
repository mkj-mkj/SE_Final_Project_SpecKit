import { AppError, type Phase } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { assertPhase, nextPhase, type Action } from '../../src/domain/phase.js';

// TECH_SPEC §6 允許階段表
const ALLOWED: Record<Action, Phase[]> = {
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
const PHASES: Phase[] = ['SETUP', 'READY', 'RUNNING', 'ENDED'];
const CASES = (Object.keys(ALLOWED) as Action[]).flatMap((action) =>
  PHASES.map((phase) => ({ action, phase, allowed: ALLOWED[action].includes(phase) })),
);

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof AppError ? e.code : 'NOT_APP_ERROR';
  }
}

describe('phase', () => {
  it('UT-PHASE-01 案例數為 13 個動作 × 4 個階段 = 52', () => {
    expect(CASES).toHaveLength(52);
  });

  it.each(CASES)('UT-PHASE-01 assertPhase($phase, $action) 允許=$allowed', ({ action, phase, allowed }) => {
    expect(codeOf(() => assertPhase(phase, action))).toBe(allowed ? null : 'INVALID_PHASE');
  });

  it('UT-PHASE-02 nextPhase 合法轉換', () => {
    expect(nextPhase('SETUP', 'import')).toBe('READY');
    expect(nextPhase('READY', 'import')).toBe('READY');
    expect(nextPhase('READY', 'start')).toBe('RUNNING');
    expect(nextPhase('RUNNING', 'end')).toBe('ENDED');
    expect(nextPhase('ENDED', 'reset')).toBe('READY');
  });

  it('UT-PHASE-03 nextPhase 非法組合 → INVALID_PHASE', () => {
    expect(codeOf(() => nextPhase('SETUP', 'start'))).toBe('INVALID_PHASE');
    expect(codeOf(() => nextPhase('RUNNING', 'import'))).toBe('INVALID_PHASE');
    expect(codeOf(() => nextPhase('READY', 'end'))).toBe('INVALID_PHASE');
    expect(codeOf(() => nextPhase('RUNNING', 'reset'))).toBe('INVALID_PHASE');
    expect(codeOf(() => nextPhase('ENDED', 'start'))).toBe('INVALID_PHASE');
  });
});
