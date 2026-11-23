import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ImportSummary as Summary, QuestionInfo } from '@quiz/shared';
import ImportSummary from '../../src/components/ImportSummary';

// 範例 A：第 1、2 題為題組（各 2 子題），第 3、4 題為單題
const questionsA: QuestionInfo[] = [
  { id: 'q1', number: 1, isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] },
  { id: 'q2', number: 2, isGroup: true, subCount: 2, subLabels: ['（1）', '（2）'] },
  { id: 'q3', number: 3, isGroup: false, subCount: 1, subLabels: [''] },
  { id: 'q4', number: 4, isGroup: false, subCount: 1, subLabels: [''] },
];
const summaryA: Summary = {
  questionCount: 4, groupCount: 2, singleCount: 2, subQuestionCount: 4, warnings: [],
};

describe('ImportSummary', () => {
  it('UT-UI-IMPORT-02 範例 A summary → 題數 4、題組 2，摘要文字固定格式', () => {
    render(<ImportSummary summary={summaryA} questions={questionsA} />);
    expect(screen.getByTestId('import-question-count')).toHaveTextContent('4');
    expect(screen.getByTestId('import-group-count')).toHaveTextContent('2');
    expect(screen.getByTestId('import-summary'))
      .toHaveTextContent('偵測到 4 題，其中 2 題組（共 4 子題）、2 單題');
    expect(screen.getByText(/第 1 題 題組/)).toHaveTextContent('（1）（2）');
    expect(screen.getByText('第 3 題')).toBeInTheDocument();
    expect(screen.queryByTestId('import-warning-0')).not.toBeInTheDocument();
  });

  it('UT-UI-IMPORT-02 有 1 個警告 → 出現 import-warning-0', () => {
    const summary: Summary = {
      ...summaryA,
      warnings: [{ code: 'NON_CONSECUTIVE_NUMBERS', message: '題號不連續：1, 2, 3, 5' }],
    };
    render(<ImportSummary summary={summary} questions={questionsA} />);
    expect(screen.getByTestId('import-warning-0')).toHaveTextContent('題號不連續：1, 2, 3, 5');
    expect(screen.queryByTestId('import-warning-1')).not.toBeInTheDocument();
  });
});
