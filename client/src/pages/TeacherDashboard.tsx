// 老師管理頁（TECH_SPEC §10.1、§10.4）：無活動時只顯示建立按鈕；有活動顯示房間碼、設定與組別
import { Navigate, useNavigate } from 'react-router-dom';
import ErrorBanner from '../components/ErrorBanner';
import PhaseBadge from '../components/PhaseBadge';
import RoomCode from '../components/RoomCode';
import SettingsForm from '../components/SettingsForm';
import TeamList from '../components/TeamList';
import { useTeacher } from '../hooks/useTeacher';
import { clearTeacher, loadTeacher } from '../storage';

export default function TeacherDashboard() {
  if (!loadTeacher()) return <Navigate to="/teacher/login" replace />;
  return <Dashboard />;
}

function Dashboard() {
  const navigate = useNavigate();
  const { view, error, busy, createSession, updateSettings } = useTeacher();

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
