// 學生端狀態（TECH_SPEC §10.3，001 範圍：view、me、error）
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeamView } from '@quiz/shared';
import { getPlayState, type AppErrorView } from '../api';
import { toAppError } from '../errors';
import { connectMember } from '../socket';
import { clearMember, loadMember } from '../storage';

export interface UsePlay {
  view: TeamView | null;
  me: { id: string; nickname: string } | null;
  error: AppErrorView | null;
}

export function usePlay(): UsePlay {
  const navigate = useNavigate();
  const [member] = useState(() => loadMember());
  const [view, setView] = useState<TeamView | null>(null);
  const [me, setMe] = useState<UsePlay['me']>(null);
  const [error, setError] = useState<AppErrorView | null>(null);
  const [ready, setReady] = useState(false);

  const onUnauthorized = useCallback(() => {
    clearMember();
    const room = member?.roomCode ?? '';
    navigate(room ? `/join?room=${encodeURIComponent(room)}` : '/join', { replace: true });
  }, [member, navigate]);

  // 掛載：無身分 → /join；否則取得初始狀態
  useEffect(() => {
    if (!member) {
      navigate('/join', { replace: true });
      return;
    }
    let active = true;
    getPlayState(member.token)
      .then(({ me: self, ...teamView }) => {
        if (!active) return;
        setView(teamView);
        setMe(self);
        setReady(true);
      })
      .catch((e: unknown) => {
        if (!active) return;
        const err = toAppError(e);
        if (err.code === 'UNAUTHORIZED') onUnauthorized();
        else setError(err);
      });
    return () => { active = false; };
  }, [member, navigate, onUnauthorized]);

  // 取得初始狀態後訂閱 team:state，以快照取代 view
  useEffect(() => {
    if (!member || !ready) return;
    const conn = connectMember(member.token);
    conn.onState((s) => setView(s));
    conn.onUnauthorized(onUnauthorized);
    return () => conn.disconnect();
  }, [member, ready, onUnauthorized]);

  return { view, me, error };
}
