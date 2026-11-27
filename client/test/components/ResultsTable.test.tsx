import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TeacherCell, TeacherView } from '@quiz/shared';
import ResultsTable from '../../src/components/ResultsTable';
import { makeSession } from '../helpers/fixtures';

type Sub = NonNullable<TeacherCell['submission']>;

function cell(questionId: string, teamId: string, sub: Partial<Sub> | null): TeacherCell {
  return {
    questionId, teamId,
    submission: sub && {
      id: `${questionId}-${teamId}`, answers: ['x'], submittedBy: '小明', serverTime: 1000,
      status: 'active', rank: null, isWinner: false, ...sub,
    },
  };
}

/** 範例 A：4 題（第 1 題題組）、3 組，phase ENDED */
function endedView(): TeacherView {
  const q = (id: string, number: number, winnerTeamId: string | null, isGroup = false) => ({
    id, number, isGroup, subCount: isGroup ? 2 : 1, subLabels: isGroup ? ['（1）', '（2）'] : [''],
    state: 'settled' as const, windowEndsAt: null, winnerTeamId,
  });
  const team = (index: number, score: number) => ({
    id: `t${index}`, sessionId: 'sess-1', index, name: `第 ${index} 組`, score, members: [],
  });
  return {
    session: makeSession({ phase: 'ENDED', teamCount: 3 }),
    // 故意打亂順序，驗證依題號升冪
    questions: [q('q3', 3, 't2'), q('q1', 1, 't2', true), q('q4', 4, null), q('q2', 2, null)],
    teams: [team(1, 0), team(2, 2), team(3, 0)],
    cells: [
      cell('q1', 't1', { answers: ['CPU', 'OS'], rank: 2 }),
      cell('q1', 't2', { answers: ['CPU', '作業系統'], rank: 1, isWinner: true }),
      cell('q1', 't3', null),
      cell('q2', 't1', null),
      cell('q2', 't2', null),
      cell('q2', 't3', { answers: ['演算法'], status: 'withdrawn', rank: null }),
      cell('q3', 't1', { answers: ['0'], status: 'rejected', rank: 1 }),
      cell('q3', 't2', { answers: ['1'], rank: 2, isWinner: true }),
      cell('q3', 't3', null),
      cell('q4', 't1', null),
      cell('q4', 't2', null),
      cell('q4', 't3', null),
    ],
    importSummary: null,
    serverNow: 0,
  };
}

function row(qNumber: number): HTMLElement {
  return screen.getByTestId(`result-winner-${qNumber}`).closest('tr')!;
}

describe('ResultsTable', () => {
  afterEach(cleanup);

  it('UT-UI-RES-01 有得主與無得主的題目正確顯示；無得主顯示「無」；分數依分數降冪、組序升冪', () => {
    render(<ResultsTable view={endedView()} busy={false} onReject={vi.fn()} />);
    expect(screen.getByTestId('results-table')).toBeInTheDocument();

    // 每題一列，題號升冪
    const winners = screen.getAllByTestId(/^result-winner-\d+$/).map((e) => e.dataset.testid);
    expect(winners).toEqual(['result-winner-1', 'result-winner-2', 'result-winner-3', 'result-winner-4']);

    // 第 1 題：得主第 2 組，答案以子題標籤串接，順位 1.第 2 組 → 2.第 1 組
    expect(screen.getByTestId('result-winner-1')).toHaveTextContent(/^第 2 組$/);
    expect(row(1)).toHaveTextContent('（1）CPU（2）作業系統');
    expect(row(1).textContent).toMatch(/1\.第 2 組.*2\.第 1 組/);

    // 第 3 題：判錯的第 1 組保留名次並標示（判錯），得主遞補為第 2 組
    expect(screen.getByTestId('result-winner-3')).toHaveTextContent(/^第 2 組$/);
    expect(row(3).textContent).toMatch(/1\.第 1 組（判錯）.*2\.第 2 組/);

    // 第 2、4 題無得主；已撤回的第 3 組不出現在順位
    expect(screen.getByTestId('result-winner-2')).toHaveTextContent(/^無$/);
    expect(screen.getByTestId('result-winner-4')).toHaveTextContent(/^無$/);
    expect(row(2)).not.toHaveTextContent('第 3 組');
    expect(row(2)).not.toHaveTextContent('演算法');

    // 分數
    expect(screen.getByTestId('score-1')).toHaveTextContent('0');
    expect(screen.getByTestId('score-2')).toHaveTextContent('2');
    expect(screen.getByTestId('score-3')).toHaveTextContent('0');
    const order = screen.getAllByTestId(/^score-\d+$/).map((e) => e.dataset.testid);
    expect(order).toEqual(['score-2', 'score-1', 'score-3']);
  });

  it('UT-UI-RES-02 按 btn-reject-1 → onReject(第 1 題 id)；busy 時全部 disabled；無得主的題目仍可按', () => {
    const onReject = vi.fn();
    const { rerender } = render(<ResultsTable view={endedView()} busy={false} onReject={onReject} />);

    fireEvent.click(screen.getByTestId('btn-reject-1'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith('q1');
    expect(screen.getByTestId('btn-reject-2')).toBeEnabled();

    rerender(<ResultsTable view={endedView()} busy onReject={onReject} />);
    for (const btn of screen.getAllByTestId(/^btn-reject-\d+$/)) expect(btn).toBeDisabled();
  });
});
