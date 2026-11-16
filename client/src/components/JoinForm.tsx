// 學生加入表單：房間碼 → 選組 → 暱稱（TECH_SPEC §10.4）
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PublicSessionInfo } from '@quiz/shared';
import { getPublicInfo, join, type AppErrorView } from '../api';
import { toAppError } from '../errors';
import { saveMember } from '../storage';
import ErrorBanner from './ErrorBanner';

export default function JoinForm({ initialRoom = '' }: { initialRoom?: string }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState(initialRoom);
  const [info, setInfo] = useState<PublicSessionInfo | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppErrorView | null>(null);

  async function onNext(e: FormEvent) {
    e.preventDefault();
    const code = room.trim().toUpperCase();
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await getPublicInfo(code);
      setInfo(result);
      setTeamId(null);
    } catch (err) {
      setInfo(null);
      setError(toAppError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (!info || !teamId || !name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await join(info.roomCode, { teamId, nickname: name });
      saveMember({ token: res.token, roomCode: info.roomCode, memberId: res.memberId });
      navigate('/play');
    } catch (err) {
      setError(toAppError(err));
      setBusy(false);
    }
  }

  const canSubmit = !!info && !!teamId && nickname.trim() !== '' && !busy;

  return (
    <div className="join-form">
      <form onSubmit={onNext}>
        <label>
          房間碼
          <input
            data-testid="join-room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <button data-testid="join-room-next" type="submit" disabled={busy || room.trim() === ''}>下一步</button>
      </form>

      {info && (
        <form onSubmit={onJoin}>
          <div className="join-teams">
            <div>選擇組別</div>
            {info.teams.map((t, i) => (
              <button
                key={t.id}
                type="button"
                data-testid={`join-team-${i + 1}`}
                aria-pressed={teamId === t.id}
                className={teamId === t.id ? 'team-option selected' : 'team-option'}
                onClick={() => setTeamId(t.id)}
              >
                {t.name} {t.memberCount} 人
              </button>
            ))}
          </div>
          <label>
            暱稱
            <input
              data-testid="join-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button data-testid="join-submit" type="submit" disabled={!canSubmit}>加入</button>
        </form>
      )}

      <ErrorBanner error={error} />
    </div>
  );
}
