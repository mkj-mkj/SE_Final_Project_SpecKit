// 老師即時狀態表（TECH_SPEC §10.4 StatusCell 規則）：欄為題目、列為組別
import type { TeacherCell, TeacherView } from '@quiz/shared';
import { formatAnswers, formatTime } from '../format';
import { useTick } from '../hooks/useServerClock';

interface Props {
  view: TeacherView;
  now: () => number;
}

type Question = TeacherView['questions'][number];

/** 題目欄標題：公平模式視窗中顯示「判定中 x.x s」倒數 */
function QuestionHeader({ q, now }: { q: Question; now: () => number }) {
  const countdown = q.state === 'window' && q.windowEndsAt !== null
    ? `判定中 ${(Math.max(0, q.windowEndsAt - now()) / 1000).toFixed(1)} s`
    : null;
  return (
    <th data-testid={`question-state-${q.number}`}>
      第{q.number}題
      {countdown && <span className="window-countdown"> {countdown}</span>}
    </th>
  );
}

function StatusCell({ q, teamIndex, cell }: { q: Question; teamIndex: number; cell: TeacherCell | undefined }) {
  const testId = `status-cell-${q.number}-${teamIndex}`;
  const s = cell?.submission ?? null;
  if (!s) return <td data-testid={testId}>—</td>;
  if (s.status === 'withdrawn') return <td data-testid={testId} className="cell-withdrawn">已撤回</td>;
  if (s.status === 'rejected') return <td data-testid={testId} className="cell-rejected">✗ 判錯</td>;
  // active：答案、送出者、伺服器時間、順位（視窗中尚未結算為「判定中」）；得主另加強調
  return (
    <td data-testid={testId} className={s.isWinner ? 'cell-winner' : undefined}>
      <div>{formatAnswers(s.answers, q.subLabels)}</div>
      <div>{s.submittedBy} {formatTime(s.serverTime)}</div>
      <div>
        {s.rank === null ? '判定中' : `#${s.rank}`}
        {s.isWinner && ' ★ 得主'}
      </div>
    </td>
  );
}

export default function StatusGrid({ view, now }: Props) {
  useTick(100); // 刷新視窗倒數
  const questions = [...view.questions].sort((a, b) => a.number - b.number);
  const teams = [...view.teams].sort((a, b) => a.index - b.index);
  const cellOf = new Map(view.cells.map((c) => [`${c.questionId}:${c.teamId}`, c]));

  return (
    <table data-testid="status-grid" className="status-grid">
      <thead>
        <tr>
          <th />
          {questions.map((q) => <QuestionHeader key={q.id} q={q} now={now} />)}
        </tr>
      </thead>
      <tbody>
        {teams.map((t) => (
          <tr key={t.id}>
            <th scope="row">{t.name}</th>
            {questions.map((q) => (
              <StatusCell key={q.id} q={q} teamIndex={t.index} cell={cellOf.get(`${q.id}:${t.id}`)} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
