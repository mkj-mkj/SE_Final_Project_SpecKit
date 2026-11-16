// 學生作答頁（001 範圍）：組別資訊、階段與等待畫面；作答卡屬 003
import ErrorBanner from '../components/ErrorBanner';
import PhaseBadge from '../components/PhaseBadge';
import TeamHeader from '../components/TeamHeader';
import { usePlay } from '../hooks/usePlay';

export default function Play() {
  const { view, me, error } = usePlay();

  return (
    <main className="play">
      <ErrorBanner error={error} />
      {view && me ? (
        <>
          <div className="play-top">
            <TeamHeader team={view.team} me={me} />
            <PhaseBadge phase={view.session.phase} />
          </div>
          <p className="play-waiting">等待老師開始</p>
        </>
      ) : (
        !error && <p>載入中…</p>
      )}
    </main>
  );
}
