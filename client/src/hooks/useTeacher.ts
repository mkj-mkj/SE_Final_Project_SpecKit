// 老師端狀態（TECH_SPEC §10.3，001 範圍：view、error、busy、createSession、updateSettings）
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeacherView } from '@quiz/shared';
import * as api from '../api';
import type { AppErrorView, SettingsInput } from '../api';
import { toAppError } from '../errors';
import { connectTeacher } from '../socket';
import { clearTeacher, loadTeacher } from '../storage';

export interface UseTeacher {
  view: TeacherView | null;
  error: AppErrorView | null;
  busy: boolean;
  createSession(input: SettingsInput): Promise<void>;
  updateSettings(input: SettingsInput): Promise<void>;
}

export function useTeacher(): UseTeacher {
  const navigate = useNavigate();
  const [token] = useState(() => loadTeacher()?.token ?? null);
  const [view, setView] = useState<TeacherView | null>(null);
  const [error, setError] = useState<AppErrorView | null>(null);
  const [busy, setBusy] = useState(true); // 首次載入 getCurrentSession 期間為 true
  const mounted = useRef(true);

  const onUnauthorized = useCallback(() => {
    clearTeacher();
    navigate('/teacher/login', { replace: true });
  }, [navigate]);

  /** 共用的錯誤處理：401 → 清除身分並回登入頁；其餘存入 error */
  const fail = useCallback((e: unknown) => {
    const err = toAppError(e);
    if (err.code === 'UNAUTHORIZED') onUnauthorized();
    else setError(err);
  }, [onUnauthorized]);

  // 掛載：取得目前活動
  useEffect(() => {
    mounted.current = true;
    if (!token) {
      onUnauthorized();
      return;
    }
    api.getCurrentSession(token)
      .then((v) => { if (mounted.current) setView(v); })
      .catch((e: unknown) => {
        if (!mounted.current) return;
        if (toAppError(e).code === 'SESSION_NOT_FOUND') setView(null); // 尚無活動
        else fail(e);
      })
      .finally(() => { if (mounted.current) setBusy(false); });
    return () => { mounted.current = false; };
  }, [token, onUnauthorized, fail]);

  // 有活動後訂閱 teacher:state；收到快照整份取代 view；卸載或換活動時中斷
  const sessionId = view?.session.id ?? null;
  useEffect(() => {
    if (!token || !sessionId) return;
    const conn = connectTeacher(token, sessionId);
    conn.onState((s) => setView(s));
    conn.onUnauthorized(onUnauthorized);
    return () => conn.disconnect();
  }, [token, sessionId, onUnauthorized]);

  const run = useCallback(async (fn: (t: string) => Promise<TeacherView>) => {
    if (!token) return onUnauthorized();
    setBusy(true);
    setError(null);
    try {
      const v = await fn(token);
      if (mounted.current) setView(v);
    } catch (e) {
      if (mounted.current) fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [token, onUnauthorized, fail]);

  const createSession = useCallback(
    (input: SettingsInput) => run((t) => api.createSession(t, input)),
    [run],
  );

  const updateSettings = useCallback(
    (input: SettingsInput) => {
      if (!sessionId) return Promise.resolve();
      return run((t) => api.updateSettings(t, sessionId, input));
    },
    [run, sessionId],
  );

  return { view, error, busy, createSession, updateSettings };
}
