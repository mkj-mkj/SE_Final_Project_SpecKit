// 學生端結果（TECH_SPEC §10.4；FR-09）：只在 ENDED（TeamView.results 非 null）時渲染，無任何操作按鈕
import type { Results } from '@quiz/shared';

interface Props {
  results: Results;
}

function joinAnswers(subLabels: string[], answers: string[]): string {
  return answers.map((a, i) => `${subLabels[i] ?? ''}${a}`).join('');
}

export default function StudentResults({ results }: Props) {
  const questions = [...results.questions].sort((a, b) => a.number - b.number);
  return (
    <section data-testid="student-results" className="student-results">
      <h2>結果</h2>
      {questions.map((q) => (
        <div key={q.questionId} data-testid={`student-result-${q.number}`} className="student-result">
          <h3>第{q.number}題</h3>
          <p>得主：{q.winner ? q.winner.teamName : '無'}</p>
          {q.winner && <p>答案：{joinAnswers(q.subLabels, q.winner.answers)}</p>}
          {q.ranking.length > 0 && (
            <p>
              順位：
              {[...q.ranking].sort((a, b) => a.rank - b.rank).map((r) => (
                <span key={r.teamId}>
                  {r.rank}.{r.teamName}{r.status === 'rejected' && '（判錯）'}{' '}
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
      {/* 各組分數（spec Clarifications Q2）；伺服器已依分數降冪、組序升冪排序 */}
      <p className="student-scores">
        分數：
        {results.scores.map((s) => (
          <span key={s.teamId}>{s.teamName} {s.score}{'　'}</span>
        ))}
      </p>
    </section>
  );
}
