// 學生作答頁：001 的組別資訊與階段；003 的搶答畫面（每題一張 AnswerCard）；
// 004：ENDED 且有 results 時不渲染 AnswerCard，改顯示 StudentResults（FR-09）
import AnswerCard from '../components/AnswerCard';
import ErrorBanner from '../components/ErrorBanner';
import PhaseBadge from '../components/PhaseBadge';
import StudentResults from '../components/StudentResults';
import TeamHeader from '../components/TeamHeader';
import { usePlay } from '../hooks/usePlay';
import { useServerClock } from '../hooks/useServerClock';

export default function Play() {
  const { view, me, error, setDraft, submit, withdraw } = usePlay();
  const now = useServerClock(view?.serverNow);

  return (
    <main className="play">
      <ErrorBanner error={error} />
      {view && me ? (
        <>
          <div className="play-top">
            <TeamHeader team={view.team} me={me} />
            <PhaseBadge phase={view.session.phase} />
          </div>
          {view.session.phase === 'ENDED' && view.results ? (
            <StudentResults results={view.results} />
          ) : view.questions.length === 0 ? (
            <p className="play-waiting">等待老師開始</p>
          ) : (
            [...view.questions]
              .sort((a, b) => a.number - b.number)
              .map((q) => (
                <AnswerCard
                  key={q.id}
                  question={q}
                  phase={view.session.phase}
                  // usePlay 已合併本地草稿與撤回答案的初始值（research R-11）
                  answers={view.drafts[q.id]?.answers ?? Array<string>(q.subCount).fill('')}
                  mySubmission={view.mySubmissions[q.id]}
                  now={now}
                  onChange={(answers) => setDraft(q.id, answers)}
                  onSubmit={() => void submit(q.id)}
                  onWithdraw={(id) => void withdraw(id)}
                />
              ))
          )}
        </>
      ) : (
        !error && <p>載入中…</p>
      )}
    </main>
  );
}
