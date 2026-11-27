// REST 用戶端（contracts/rest-api.md）；非 2xx 時丟出 AppErrorView
import type {
  CellWrite,
  ErrorCode,
  FairnessMode,
  ImportSummary,
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
  if (!res.ok) throw toErrorView(res.status, data);
  return data as T;
}

/** 非 2xx 回應本文 → AppErrorView（request() 與 downloadCsv() 共用） */
function toErrorView(status: number, data: unknown): AppErrorView {
  const body = (data as { error?: unknown } | null)?.error;
  return isAppErrorView(body)
    ? { code: body.code, message: body.message }
    : { code: 'INTERNAL', message: `HTTP ${status}` };
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
/** 匯入 Guided Notes（002，contracts/rest-api.md）；spreadsheet 為網址或試算表 ID */
export function importSheet(
  token: string, sessionId: string, spreadsheet: string,
): Promise<{ view: TeacherView; summary: ImportSummary }> {
  return request(`/api/teacher/sessions/${encodeURIComponent(sessionId)}/import`, {
    method: 'POST', token, body: { spreadsheet },
  });
}

// ---------- 老師：搶答流程（003，contracts/rest-api.md） ----------
function phaseAction(token: string, sessionId: string, action: 'start' | 'end' | 'reset'): Promise<TeacherView> {
  return request(`/api/teacher/sessions/${encodeURIComponent(sessionId)}/${action}`, { method: 'POST', token });
}
export function start(token: string, sessionId: string): Promise<TeacherView> {
  return phaseAction(token, sessionId, 'start');
}
export function end(token: string, sessionId: string): Promise<TeacherView> {
  return phaseAction(token, sessionId, 'end');
}
export function reset(token: string, sessionId: string): Promise<TeacherView> {
  return phaseAction(token, sessionId, 'reset');
}

// ---------- 老師：結果與匯出（004，contracts/rest-api.md） ----------
function sessionPath(sessionId: string): string {
  return `/api/teacher/sessions/${encodeURIComponent(sessionId)}`;
}
/** 判錯：目前得主改為 rejected，回傳遞補後的 TeacherView */
export function rejectWinner(token: string, sessionId: string, questionId: string): Promise<TeacherView> {
  return request(`${sessionPath(sessionId)}/questions/${encodeURIComponent(questionId)}/reject-winner`, {
    method: 'POST', token,
  });
}
export function exportSheet(token: string, sessionId: string): Promise<{ updatedCells: number; writes: CellWrite[] }> {
  return request(`${sessionPath(sessionId)}/export`, { method: 'POST', token });
}
export function restoreSheet(token: string, sessionId: string): Promise<{ updatedCells: number }> {
  return request(`${sessionPath(sessionId)}/restore`, { method: 'POST', token });
}

/**
 * 下載結果 CSV（research R-10）：老師 token 只在 sessionStorage，不能用一般連結，
 * 因此以 fetch 帶 Authorization 取得 blob；檔名取自 Content-Disposition，取不到時為 results.csv。
 */
export async function downloadCsv(token: string, sessionId: string): Promise<{ blob: Blob; filename: string }> {
  let res: Response;
  try {
    res = await fetch(`${sessionPath(sessionId)}/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    const err: AppErrorView = { code: 'INTERNAL', message: e instanceof Error ? e.message : String(e) };
    throw err;
  }
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    throw toErrorView(res.status, data);
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
  return { blob: await res.blob(), filename: match?.[1] ?? 'results.csv' };
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

// ---------- 學生：搶答（003，contracts/rest-api.md） ----------
export interface SubmitResult { submissionId: string; serverTime: number; withdrawableUntil: number }

/** 更新組內共編草稿（204） */
export async function putDraft(token: string, questionId: string, answers: string[]): Promise<void> {
  await request(`/api/play/drafts/${encodeURIComponent(questionId)}`, { method: 'PUT', token, body: { answers } });
}
export function submit(token: string, questionId: string, answers: string[]): Promise<SubmitResult> {
  return request('/api/play/submissions', { method: 'POST', token, body: { questionId, answers } });
}
/** 撤回本組送出（204） */
export async function withdraw(token: string, submissionId: string): Promise<void> {
  await request(`/api/play/submissions/${encodeURIComponent(submissionId)}/withdraw`, { method: 'POST', token });
}
