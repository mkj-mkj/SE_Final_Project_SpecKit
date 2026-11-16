// 學生加入頁（TECH_SPEC §10.1）：已有身分先驗證，200 → /play；401 → 清除並預填原房間碼
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPlayState } from '../api';
import JoinForm from '../components/JoinForm';
import { toAppError } from '../errors';
import { clearMember, loadMember } from '../storage';

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [member] = useState(() => loadMember());
  const [checking, setChecking] = useState(member !== null);
  const [initialRoom, setInitialRoom] = useState(member?.roomCode ?? params.get('room') ?? '');

  useEffect(() => {
    if (!member) return;
    let active = true;
    getPlayState(member.token)
      .then(() => {
        if (active) navigate('/play', { replace: true });
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (toAppError(e).code === 'UNAUTHORIZED') {
          clearMember();
          setInitialRoom(member.roomCode);
        }
        setChecking(false);
      });
    return () => { active = false; };
  }, [member, navigate]);

  return (
    <main className="join">
      <h1>加入搶答</h1>
      {checking ? <p>確認身分中…</p> : <JoinForm initialRoom={initialRoom} />}
    </main>
  );
}
