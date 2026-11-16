// REST 用戶端（contracts/rest-api.md）；非 2xx 時丟出 AppErrorView
import type {
  ErrorCode,
  FairnessMode,
  PublicSessionInfo,
  TeacherView,
  TeamView,
} from '@quiz/shared';

/** 前端可見的錯誤；code 為 ErrorCode，伺服器未預期錯誤或網路錯誤為 'INTERNAL' */
export interface AppErrorView { code: ErrorCode | 'INTERNAL'; message: string }

export interface SettingsInput { teamCount?: number; fairnessMode?: FairnessMode; windowSec?: number }
export interface JoinBody { teamId: string; nickname: string }
export interface JoinResult { token: string; memberId: string; teamId: string; sessionId: string }
export type PlayState = TeamView & { me: { id: string; nickname: string } };

interface RequestOptions { method?: string; token?: string; body?: unknown }

function isAppErrorView(v: unknown): v is AppErrorView {
  return typeof v === 'object' && v !== null
    && typeof (v as AppErrorView).code === 'string'
    && typeof (v as AppErrorView).message === 'string';
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (e) {
    const err: AppErrorView = { code: 'INTERNAL', message: e instanceof Error ? e.message : String(e) };
    throw err;
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = (data as { error?: unknown } | null)?.error;
    const err: AppErrorView = isAppErrorView(body)
      ? { code: body.code, message: body.message }
      : { code: 'INTERNAL', message: `HTTP ${res.status}` };
    throw err;
  }
  return data as T;
}

// ---------- 老師 ----------
export function login(password: string): Promise<{ token: string }> {
  return request('/api/teacher/login', { method: 'POST', body: { password } });
}
export function createSession(token: string, input: SettingsInput): Promise<TeacherView> {
  return request('/api/teacher/sessions', { method: 'POST', token, body: input });
}
export function getCurrentSession(token: string): Promise<TeacherView> {
  return request('/api/teacher/sessions/current', { token });
}
export function getSession(token: string, id: string): Promise<TeacherView> {
  return request(`/api/teacher/sessions/${encodeURIComponent(id)}`, { token });
}
export function updateSettings(token: string, id: string, input: SettingsInput): Promise<TeacherView> {
  return request(`/api/teacher/sessions/${encodeURIComponent(id)}/settings`, {
    method: 'PATCH', token, body: input,
  });
}

// ---------- 公開 ----------
export function getPublicInfo(roomCode: string): Promise<PublicSessionInfo> {
  return request(`/api/public/sessions/${encodeURIComponent(roomCode)}`);
}
export function join(roomCode: string, body: JoinBody): Promise<JoinResult> {
  return request(`/api/public/sessions/${encodeURIComponent(roomCode)}/join`, { method: 'POST', body });
}

// ---------- 學生 ----------
export function getPlayState(token: string): Promise<PlayState> {
  return request('/api/play/state', { token });
}
