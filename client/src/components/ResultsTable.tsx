// 老師端結果表與判錯入口（TECH_SPEC §10.4、§10.5；research R-09）
// TeacherView 沒有 results 欄位，得主、答案、順位、分數皆由 questions／cells／teams 推導（不改 §4 型別）
import type { TeacherView } from '@quiz/shared';

interface Props {
  view: TeacherView;
  busy: boolean;
  onReject(questionId: string): void;
}

/** 答案顯示：題組以子題標籤直接串接（「（1）CPU（2）作業系統」），單題只有答案 */
function joinAnswers(subLabels: string[], answers: string[]): string {
  return answers.map((a, i) => `${subLabels[i] ?? ''}${a}`).join('');
}

export default function ResultsTable({ view, busy, onReject }: Props) {
  const teamName = new Map(view.teams.map((t) => [t.id, t.name]));
  const questions = [...view.questions].sort((a, b) => a.number - b.number);
  // 分數列：分數降冪、組序升冪（與 Results.scores 的規則一致）
  const scores = [...view.teams].sort((a, b) => b.score - a.score || a.index - b.index);

  return (
    <div data-testid="results-table" className="results-table">
      <table>
        <thead>
          <tr><th>題號</th><th>得主</th><th>答案</th><th>各組順位</th><th>操作</th></tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const cells = view.cells.filter((c) => c.questionId === q.id);
            const winnerCell = q.winnerTeamId
              ? cells.find((c) => c.teamId === q.winnerTeamId && c.submission)
              : undefined;
            // 順位：不含已撤回與尚未結算（rank 為 null）者；判錯者保留名次並標示
            const ranking = cells
              .flatMap((c) => (c.submission && c.submission.status !== 'withdrawn' && c.submission.rank !== null
                ? [{ teamId: c.teamId, rank: c.submission.rank, rejected: c.submission.status === 'rejected' }]
                : []))
              .sort((a, b) => a.rank - b.rank);
            return (
              <tr key={q.id}>
                <td>{q.number}</td>
                <td data-testid={`result-winner-${q.number}`}>
                  {q.winnerTeamId ? teamName.get(q.winnerTeamId) ?? '' : '無'}
                </td>
                <td>{winnerCell?.submission ? joinAnswers(q.subLabels, winnerCell.submission.answers) : '無'}</td>
                <td>
                  {ranking.map((r) => (
                    <span key={r.teamId} className="results-rank">
                      {r.rank}.{teamName.get(r.teamId)}{r.rejected && '（判錯）'}{' '}
                    </span>
                  ))}
                </td>
                <td>
                  {/* 無得主時仍可按：伺服器回 NO_WINNER，由 ErrorBanner 顯示「此題目前沒有得主」 */}
                  <button data-testid={`btn-reject-${q.number}`} type="button" disabled={busy} onClick={() => onReject(q.id)}>
                    判錯
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="results-scores">
        分數：
        {scores.map((t) => (
          <span key={t.id} className="results-score">
            {t.name} <span data-testid={`score-${t.index}`}>{t.score}</span>{'　'}
          </span>
        ))}
      </p>
    </div>
  );
}
