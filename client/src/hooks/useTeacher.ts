// 老師端狀態（TECH_SPEC §10.3）：001 的 view、error、busy、createSession、updateSettings；002 的 importSheet；003 的 start、end、reset；
// 004 的 rejectWinner、exportToSheet、restoreSheet、downloadCsv
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportSummary, TeacherView } from '@quiz/shared';
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
  importSheet(spreadsheet: string): Promise<ImportSummary>;
  start(): Promise<void>;
  end(): Promise<void>;
  reset(): Promise<void>;
  rejectWinner(questionId: string): Promise<void>;
  exportToSheet(): Promise<number>;
  restoreSheet(): Promise<number>;
  downloadCsv(): Promise<void>;
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

  /**
   * 匯入 Guided Notes（002）：成功以回應的 view 取代本地狀態並回傳 summary；
   * 失敗設定 error（由 TeacherDashboard 唯一的 ErrorBanner 顯示）並重新丟出，
   * 供 ImportForm 判斷是否顯示範本格式說明。之後仍以 teacher:state 快照為準。
   */
  const importSheet = useCallback(async (spreadsheet: string): Promise<ImportSummary> => {
    if (!token || !sessionId) {
      if (!token) onUnauthorized();
      throw toAppError({ code: token ? 'SESSION_NOT_FOUND' : 'UNAUTHORIZED', message: '尚無活動' });
    }
    setBusy(true);
    setError(null);
    try {
      const { view: v, summary } = await api.importSheet(token, sessionId, spreadsheet);
      if (mounted.current) setView(v);
      return summary;
    } catch (e) {
      if (mounted.current) fail(e);
      throw toAppError(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [token, sessionId, onUnauthorized, fail]);

  /**
   * 開始／結束／重新開始一輪（003）：按下即執行、沒有確認步驟（research D1）。
   * 與 createSession 相同的 busy／error 處理；成功以回應的 view 更新，之後仍以 teacher:state 快照為準。
   */
  const phaseAction = useCallback(
    (fn: (t: string, id: string) => Promise<TeacherView>) => {
      if (!sessionId) return Promise.resolve();
      return run((t) => fn(t, sessionId));
    },
    [run, sessionId],
  );
  const start = useCallback(() => phaseAction(api.start), [phaseAction]);
  const end = useCallback(() => phaseAction(api.end), [phaseAction]);
  const reset = useCallback(() => phaseAction(api.reset), [phaseAction]);

  /**
   * 004 的四個動作共用：busy／error 處理與 importSheet 相同，
   * 失敗時設定 error（ErrorBanner 依 §11 顯示）並重新丟出，讓呼叫端（ExportPanel）不顯示成功訊息。
   */
  const act = useCallback(async <T>(fn: (t: string, id: string) => Promise<T>): Promise<T> => {
    if (!token || !sessionId) {
      if (!token) onUnauthorized();
      throw toAppError({ code: token ? 'SESSION_NOT_FOUND' : 'UNAUTHORIZED', message: '尚無活動' });
    }
    setBusy(true);
    setError(null);
    try {
      return await fn(token, sessionId);
    } catch (e) {
      if (mounted.current) fail(e);
      throw toAppError(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [token, sessionId, onUnauthorized, fail]);

  /** 判錯（E5）：成功以回傳的 TeacherView 更新；遞補與扣分由伺服器推導 */
  const rejectWinner = useCallback((questionId: string) => act(async (t, id) => {
    const v = await api.rejectWinner(t, id, questionId);
    if (mounted.current) setView(v);
  }), [act]);

  const exportToSheet = useCallback(
    () => act(async (t, id) => (await api.exportSheet(t, id)).updatedCells),
    [act],
  );
  const restoreSheet = useCallback(
    () => act(async (t, id) => (await api.restoreSheet(t, id)).updatedCells),
    [act],
  );

  /** 下載 CSV：以暫時的 <a download> 觸發瀏覽器下載，完成後釋放 object URL */
  const downloadCsv = useCallback(() => act(async (t, id) => {
    const { blob, filename } = await api.downloadCsv(t, id);
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }), [act]);

  return {
    view, error, busy, createSession, updateSettings, importSheet, start, end, reset,
    rejectWinner, exportToSheet, restoreSheet, downloadCsv,
  };
}
