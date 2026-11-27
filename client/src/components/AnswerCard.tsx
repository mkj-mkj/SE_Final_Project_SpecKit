// 學生作答卡（TECH_SPEC §10.4 AnswerCard 狀態表；rejected 列為 004）
// RUNNING 中只顯示「已送出」，不顯示得主、順位或分數（FR-10）
import type { Phase, QuestionInfo, TeamView } from '@quiz/shared';
import { formatClock } from '../format';
import { useTick } from '../hooks/useServerClock';

interface Props {
  question: QuestionInfo;
  phase: Phase;
  answers: string[];
  mySubmission: TeamView['mySubmissions'][string] | undefined;
  now: () => number;
  onChange(answers: string[]): void;
  onSubmit(): void;
  onWithdraw(submissionId: string): void;
}

export default function AnswerCard({ question, phase, answers, mySubmission, now, onChange, onSubmit, onWithdraw }: Props) {
  useTick(250); // 刷新撤回倒數
  const n = question.number;
  const running = phase === 'RUNNING';
  const active = mySubmission?.status === 'active' ? mySubmission : null;
  // 被老師判錯：只涉及本組自己的送出，顯示不違反 FR-10；不可重送也不可撤回
  const rejected = mySubmission?.status === 'rejected' ? mySubmission : null;
  const locked = active ?? rejected;
  // 未送出或已撤回時可編輯；已送出（active）或被判錯時鎖定並顯示送出的答案
  const editable = running && !locked;
  const shown = locked ? locked.answers : answers;
  const values = Array.from({ length: question.subCount }, (_, i) => shown[i] ?? '');
  const canSubmit = editable && values.every((v) => v.trim() !== '');

  // 撤回倒數：無條件進位到秒（spec FR-029），歸零後不渲染按鈕
  const remaining = active?.withdrawableUntil != null ? active.withdrawableUntil - now() : 0;

  function change(i: number, value: string) {
    const next = [...values];
    next[i] = value;
    onChange(next);
  }

  return (
    <section data-testid={`answer-card-${n}`} className="answer-card">
      <h3>第{n}題{question.isGroup && '（題組）'}</h3>
      <div className="answer-inputs">
        {values.map((v, i) => (
          <label key={i}>
            {question.isGroup && <span>{question.subLabels[i]}</span>}
            <input
              data-testid={`answer-input-${n}-${i + 1}`}
              value={v}
              disabled={!editable}
              placeholder={running ? undefined : '等待老師開始'}
              onChange={(e) => change(i, e.target.value)}
            />
          </label>
        ))}
      </div>
      {rejected ? (
        <p className="answer-rejected">老師判定此答案錯誤</p>
      ) : active ? (
        <div className="answer-submitted">
          <span data-testid={`submitted-${n}`}>已送出 {formatClock(active.serverTime)}</span>
          {remaining > 0 && (
            <button data-testid={`btn-withdraw-${n}`} type="button" onClick={() => onWithdraw(active.id)}>
              <span data-testid={`withdraw-countdown-${n}`}>撤回（{Math.ceil(remaining / 1000)} 秒）</span>
            </button>
          )}
        </div>
      ) : (
        <button data-testid={`btn-submit-${n}`} type="button" disabled={!canSubmit} onClick={onSubmit}>
          送出第 {n} 題
        </button>
      )}
    </section>
  );
}
