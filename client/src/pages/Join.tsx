// 學生加入頁（TECH_SPEC §10.1）：已有身分先驗證，200 → /play；401 → 清除並預填原房間碼；
// 其他錯誤（網路中斷、500 等）→ 保留身分、顯示 ErrorBanner、不渲染 JoinForm（FR-027a）
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPlayState, type AppErrorView } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import JoinForm from '../components/JoinForm';
import { toAppError } from '../errors';
import { clearMember, loadMember } from '../storage';

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [member] = useState(() => loadMember());
  const [checking, setChecking] = useState(member !== null);
  const [initialRoom, setInitialRoom] = useState(member?.roomCode ?? params.get('room') ?? '');
  const [error, setError] = useState<AppErrorView | null>(null);

  useEffect(() => {
    if (!member) return;
    let active = true;
    getPlayState(member.token)
      .then(() => {
        if (active) navigate('/play', { replace: true });
      })
      .catch((e: unknown) => {
        if (!active) return;
        const err = toAppError(e);
        if (err.code === 'UNAUTHORIZED') {
          clearMember();
          setInitialRoom(member.roomCode);
        } else {
          setError(err);
        }
        setChecking(false);
      });
    return () => { active = false; };
  }, [member, navigate]);

  return (
    <main className="join">
      <h1>加入搶答</h1>
      {checking ? (
        <p>確認身分中…</p>
      ) : error ? (
        <ErrorBanner error={error} />
      ) : (
        <JoinForm initialRoom={initialRoom} />
      )}
    </main>
  );
}
