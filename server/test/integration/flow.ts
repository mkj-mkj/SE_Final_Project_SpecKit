// 整合測試用 REST 流程 helper：以 fetch 呼叫真實 HTTP（只連 127.0.0.1 的測試伺服器，不用外部網路）。
// 用法：const f = flow(t.baseUrl); await f.login(); const s = await f.createAndImport({ mode: 'speed' });
import type { FairnessMode, PublicSessionInfo, TeacherView } from '@quiz/shared';
import type { Socket as ClientSocket } from 'socket.io-client';
import { TEACHER_PASSWORD } from './startApp.js';

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

export interface JoinedMember {
  token: string;
  memberId: string;
  nickname: string;
  teamId: string;
}

export interface CreatedSession {
  sessionId: string;
  roomCode: string;
  teamIds: string[];
  /** 題號 → questionId */
  q: Record<number, string>;
  view: TeacherView;
}

/** 範例 A 各題的正確格式答案（第 1、2 題為兩格題組） */
export const ANSWERS_A: Record<number, string[]> = {
  1: ['CPU', '作業系統'],
  2: ['演算法', '堆疊'],
  3: ['0'],
  4: ['IP'],
};

export function flow(baseUrl: string) {
  let teacherToken: string | null = null;

  /** 呼叫 API，回傳狀態碼與本文（204 時 body 為 null） */
  async function api<T = unknown>(method: string, path: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  /** 呼叫 API 並要求指定的狀態碼，否則丟出含本文的錯誤 */
  async function expectStatus<T>(status: number, method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const res = await api<T>(method, path, body, token);
    if (res.status !== status) {
      throw new Error(`${method} ${path} 期望 ${status}，實際 ${res.status}：${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  function requireTeacher(): string {
    if (!teacherToken) throw new Error('flow：請先呼叫 login()');
    return teacherToken;
  }

  /** 單一成員加入指定組 */
  async function joinMember(roomCode: string, teamId: string, nickname: string): Promise<JoinedMember> {
    const body = await expectStatus<{ token: string; memberId: string }>(
      201,
      'POST',
      `/api/public/sessions/${roomCode}/join`,
      { teamId, nickname },
    );
    return { token: body.token, memberId: body.memberId, nickname, teamId };
  }

  return {
    api,

    /** 老師登入，token 存在 helper 內供後續老師 API 使用 */
    async login(): Promise<string> {
      const { token } = await expectStatus<{ token: string }>(200, 'POST', '/api/teacher/login', {
        password: TEACHER_PASSWORD,
      });
      teacherToken = token;
      return token;
    },

    get teacherToken(): string {
      return requireTeacher();
    },

    /** 建立活動（指定判定模式、視窗秒數、組數）並匯入範例快照（預設 fixture-template-a） */
    async createAndImport(opts: {
      mode?: FairnessMode;
      windowSec?: number;
      teamCount?: number;
      spreadsheet?: string;
    } = {}): Promise<CreatedSession> {
      const token = requireTeacher();
      const settings: Record<string, unknown> = {};
      if (opts.mode !== undefined) settings.fairnessMode = opts.mode;
      if (opts.windowSec !== undefined) settings.windowSec = opts.windowSec;
      if (opts.teamCount !== undefined) settings.teamCount = opts.teamCount;
      const created = await expectStatus<TeacherView>(201, 'POST', '/api/teacher/sessions', settings, token);
      const sessionId = created.session.id;
      const { view } = await expectStatus<{ view: TeacherView }>(
        200,
        'POST',
        `/api/teacher/sessions/${sessionId}/import`,
        { spreadsheet: opts.spreadsheet ?? 'fixture-template-a' },
        token,
      );
      const q = Object.fromEntries(view.questions.map((x) => [x.number, x.id])) as Record<number, string>;
      return { sessionId, roomCode: view.session.roomCode, teamIds: view.teams.map((x) => x.id), q, view };
    },

    /** 每組加入 perTeam 位成員；回傳 members[組序-1][成員序] */
    async joinMembers(roomCode: string, perTeam: number): Promise<JoinedMember[][]> {
      const info = await expectStatus<PublicSessionInfo>(200, 'GET', `/api/public/sessions/${roomCode}`);
      const out: JoinedMember[][] = [];
      for (const [i, team] of info.teams.entries()) {
        const row: JoinedMember[] = [];
        for (let j = 0; j < perTeam; j++) {
          row.push(await joinMember(roomCode, team.id, `T${i + 1}M${j + 1}`));
        }
        out.push(row);
      }
      return out;
    },

    joinMember,

    startQuiz: (sessionId: string) =>
      expectStatus<TeacherView>(200, 'POST', `/api/teacher/sessions/${sessionId}/start`, undefined, requireTeacher()),
    endQuiz: (sessionId: string) =>
      expectStatus<TeacherView>(200, 'POST', `/api/teacher/sessions/${sessionId}/end`, undefined, requireTeacher()),
    resetQuiz: (sessionId: string) =>
      expectStatus<TeacherView>(200, 'POST', `/api/teacher/sessions/${sessionId}/reset`, undefined, requireTeacher()),
    getTeacherView: (sessionId: string) =>
      expectStatus<TeacherView>(200, 'GET', `/api/teacher/sessions/${sessionId}`, undefined, requireTeacher()),

    /** 送出答案（不檢查狀態碼，回傳原始回應） */
    submit: (token: string, questionId: string, answers: string[]) =>
      api<{ submissionId: string; serverTime: number; withdrawableUntil: number }>(
        'POST',
        '/api/play/submissions',
        { questionId, answers },
        token,
      ),

    /** 更新本組草稿（不檢查狀態碼） */
    putDraft: (token: string, questionId: string, answers: string[]) =>
      api('PUT', `/api/play/drafts/${questionId}`, { answers }, token),
  };
}

/**
 * 等待 socket 收到符合條件的事件（含呼叫前尚未收到、之後才到的事件）；逾時丟出錯誤。
 * 請在觸發動作「之前」呼叫，避免錯過事件。
 */
export function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  pred: (payload: T) => boolean = () => true,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`等待 ${event} 逾時（${timeoutMs} ms）`));
    }, timeoutMs);
    function handler(payload: T): void {
      if (!pred(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}
