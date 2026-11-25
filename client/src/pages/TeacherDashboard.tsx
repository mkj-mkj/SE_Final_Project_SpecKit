// 老師管理頁（TECH_SPEC §10.1、§10.4）：無活動時只顯示建立按鈕；有活動顯示房間碼、匯入（SETUP／READY）、設定與組別；
// 003：READY／RUNNING／ENDED 顯示控制列，RUNNING／ENDED 顯示即時狀態表（ResultsTable 屬 004）
import { Navigate, useNavigate } from 'react-router-dom';
import ControlBar from '../components/ControlBar';
import ErrorBanner from '../components/ErrorBanner';
import ImportForm from '../components/ImportForm';
import ImportSummary from '../components/ImportSummary';
import PhaseBadge from '../components/PhaseBadge';
import RoomCode from '../components/RoomCode';
import SettingsForm from '../components/SettingsForm';
import StatusGrid from '../components/StatusGrid';
import TeamList from '../components/TeamList';
import { useServerClock } from '../hooks/useServerClock';
import { useTeacher } from '../hooks/useTeacher';
import { clearTeacher, loadTeacher } from '../storage';

export default function TeacherDashboard() {
  if (!loadTeacher()) return <Navigate to="/teacher/login" replace />;
  return <Dashboard />;
}

function Dashboard() {
  const navigate = useNavigate();
  const { view, error, busy, createSession, updateSettings, importSheet, start, end, reset } = useTeacher();
  const now = useServerClock(view?.serverNow);
  const phase = view?.session.phase ?? null;
  const canImport = phase === 'SETUP' || phase === 'READY';
  const showControls = phase === 'READY' || phase === 'RUNNING' || phase === 'ENDED';
  const showGrid = phase === 'RUNNING' || phase === 'ENDED';

  // 登出：清除身分並離開本頁（卸載時 useTeacher 會中斷 Socket）；不呼叫伺服器
  function logout() {
    clearTeacher();
    navigate('/teacher/login');
  }

  return (
    <main className="teacher-dashboard">
      <header>
        <span>課堂搶答 · 老師端</span>
        {view && <PhaseBadge phase={view.session.phase} />}
        <button data-testid="teacher-logout" type="button" onClick={logout}>登出</button>
      </header>

      <ErrorBanner error={error} />

      {view === null ? (
        busy ? (
          <p>載入中…</p>
        ) : (
          <button data-testid="btn-create-session" type="button" onClick={() => void createSession({})}>
            建立活動
          </button>
        )
      ) : (
        <>
          <RoomCode roomCode={view.session.roomCode} />
          {showControls && (
            <ControlBar
              phase={view.session.phase}
              busy={busy}
              onStart={() => void start()}
              onEnd={() => void end()}
              onReset={() => void reset()}
            />
          )}
          {showGrid && (
            <section>
              <h2>即時狀態</h2>
              <StatusGrid view={view} now={now} />
            </section>
          )}
          {(canImport || view.importSummary) && (
            <section>
              <h2>匯入 Guided Notes</h2>
              {/* 匯入錯誤沿用上方唯一的 ErrorBanner（useTeacher.error） */}
              {canImport && <ImportForm onImport={importSheet} busy={busy} />}
              {/* 摘要來自快照，重新整理後仍會顯示（FR-023） */}
              {view.importSummary && (
                <ImportSummary summary={view.importSummary} questions={view.questions} />
              )}
            </section>
          )}
          <section>
            <h2>活動設定</h2>
            <SettingsForm session={view.session} onSave={updateSettings} disabled={busy} />
          </section>
          <section>
            <h2>組別</h2>
            <TeamList teams={view.teams} />
          </section>
        </>
      )}
    </main>
  );
}
