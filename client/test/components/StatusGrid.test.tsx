import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import type { TeacherCell, TeacherView } from '@quiz/shared';
import StatusGrid from '../../src/components/StatusGrid';
import { formatTime } from '../../src/format';
import { makeTeacherView } from '../helpers/fixtures';

const NOW = 1_700_000_000_000;
const T1 = NOW - 5000;
const T2 = NOW - 4000;

type Sub = NonNullable<TeacherCell['submission']>;
function sub(over: Partial<Sub>): Sub {
  return {
    id: 's', answers: ['0'], submittedBy: '小明', serverTime: T1,
    status: 'active', rank: 1, isWinner: false, ...over,
  };
}

/** 範例 A：4 題（第 1、2 題題組、第 3、4 題單題）、3 組 */
function gridView(): TeacherView {
  const base = makeTeacherView({ phase: 'RUNNING', teamCount: 3 });
  const group = { isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] };
  const single = { isGroup: false, subCount: 1, subLabels: [''] };
  const questions: TeacherView['questions'] = [
    { id: 'q1', number: 1, ...group, state: 'settled', windowEndsAt: null, winnerTeamId: 't2' },
    { id: 'q2', number: 2, ...group, state: 'window', windowEndsAt: NOW + 1800, winnerTeamId: null },
    { id: 'q3', number: 3, ...single, state: 'settled', windowEndsAt: null, winnerTeamId: 't1' },
    { id: 'q4', number: 4, ...single, state: 'open', windowEndsAt: null, winnerTeamId: null },
  ];
  const teams: TeacherView['teams'] = [1, 2, 3].map((i) => ({
    id: `t${i}`, sessionId: 'sess-1', index: i, name: `第 ${i} 組`, score: 0, members: [],
  }));
  const cellMap: Record<string, Sub | null> = {
    'q1:t1': sub({ id: 's11', answers: ['CPU', '作業系統'], submittedBy: '小明', serverTime: T2, rank: 2 }),
    'q1:t2': sub({ id: 's12', answers: ['CPU', 'OS'], submittedBy: '阿傑', serverTime: T1, rank: 1, isWinner: true }),
    'q2:t1': sub({ id: 's21', answers: ['A', 'B'], rank: null }),
    'q2:t3': sub({ id: 's23', status: 'withdrawn', rank: null }),
    'q3:t1': sub({ id: 's31', answers: ['0'], rank: 1, isWinner: true }),
    'q3:t2': sub({ id: 's32', answers: ['1'], status: 'rejected', rank: null }),
  };
  const cells: TeacherCell[] = [];
  for (const q of questions) {
    for (const t of teams) {
      cells.push({ questionId: q.id, teamId: t.id, submission: cellMap[`${q.id}:${t.id}`] ?? null });
    }
  }
  return { ...base, questions, teams, cells, serverNow: NOW };
}

describe('StatusGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-UI-GRID-01 5 種格子分別顯示 —、#2、★ 得主、已撤回、✗ 判錯', () => {
    render(<StatusGrid view={gridView()} now={() => Date.now()} />);
    expect(screen.getByTestId('status-grid')).toBeInTheDocument();

    // 無送出
    expect(screen.getByTestId('status-cell-4-1')).toHaveTextContent('—');

    // active、非得主：答案（題組格式）、送出者、時間、順位
    const second = screen.getByTestId('status-cell-1-1');
    expect(second).toHaveTextContent('#2');
    expect(second).toHaveTextContent('（1）CPU／（2）作業系統');
    expect(second).toHaveTextContent('小明');
    expect(second).toHaveTextContent(formatTime(T2));
    expect(second).not.toHaveTextContent('★ 得主');

    // active、得主
    const winner = screen.getByTestId('status-cell-3-1');
    expect(winner).toHaveTextContent('★ 得主');
    expect(winner).toHaveTextContent('#1');
    expect(screen.getByTestId('status-cell-1-2')).toHaveTextContent('★ 得主');

    // withdrawn、rejected
    expect(screen.getByTestId('status-cell-2-3')).toHaveTextContent('已撤回');
    expect(screen.getByTestId('status-cell-3-2')).toHaveTextContent('✗ 判錯');

    // rank 為 null 的 active 格
    expect(screen.getByTestId('status-cell-2-1')).toHaveTextContent('判定中');
  });

  it('UT-UI-GRID-02 state window 的題目顯示「判定中」與倒數；非 window 不顯示倒數', () => {
    render(<StatusGrid view={gridView()} now={() => Date.now()} />);
    const header = screen.getByTestId('question-state-2');
    expect(header).toHaveTextContent('判定中');
    expect(header).toHaveTextContent('1.8 s');

    for (const n of [1, 3, 4]) {
      const h = screen.getByTestId(`question-state-${n}`);
      expect(h).not.toHaveTextContent('判定中');
      expect(within(h).queryByText(/\d\.\d s/)).toBeNull();
    }

    // useTick 刷新倒數
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId('question-state-2')).toHaveTextContent('1.3 s');
  });
});
