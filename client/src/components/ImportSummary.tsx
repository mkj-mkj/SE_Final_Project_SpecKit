// 匯入摘要（TECH_SPEC §10.4、contracts/ui-testids.md）：固定摘要文字、警告、題號清單。
// 不顯示試算表 ID、工作表名稱與題目敘述（FR-02、FR-022）。
import type { ImportSummary as Summary, QuestionInfo } from '@quiz/shared';

interface Props {
  summary: Summary;
  questions: QuestionInfo[];
}

export default function ImportSummary({ summary, questions }: Props) {
  return (
    <div className="import-summary-block">
      <p data-testid="import-summary">
        偵測到 <span data-testid="import-question-count">{summary.questionCount}</span> 題，其中{' '}
        <span data-testid="import-group-count">{summary.groupCount}</span> 題組（共{' '}
        {summary.subQuestionCount} 子題）、{summary.singleCount} 單題
      </p>
      {summary.warnings.length > 0 && (
        <ul className="import-warnings">
          {summary.warnings.map((w, i) => (
            <li key={i} data-testid={`import-warning-${i}`}>{w.message}</li>
          ))}
        </ul>
      )}
      <ul className="question-list">
        {questions.map((q) => (
          <li key={q.id}>
            {q.isGroup ? `第 ${q.number} 題 題組${q.subLabels.join('')}` : `第 ${q.number} 題`}
          </li>
        ))}
      </ul>
    </div>
  );
}
