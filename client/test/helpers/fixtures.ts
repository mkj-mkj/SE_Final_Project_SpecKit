// UI 測試共用的視圖樣本（僅供 client 測試使用）
import type { PublicSessionInfo, Session, TeacherView, TeamView } from '@quiz/shared';
import type { AppErrorView, PlayState } from '../../src/api';

export function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: 'sess-1', roomCode: 'K7Q2MX', phase: 'SETUP',
    spreadsheetId: null, sheetTitle: null,
    fairnessMode: 'fair', windowSec: 3, teamCount: 2,
    round: 1, createdAt: 0, startedAt: null, endedAt: null,
    ...over,
  };
}

export function makeTeacherView(over: Partial<Session> = {}): TeacherView {
  return {
    session: makeSession(over),
    questions: [],
    teams: [
      { id: 't1', sessionId: 'sess-1', index: 1, name: '第 1 組', score: 0,
        members: [{ id: 'm1', nickname: '小明', online: true }, { id: 'm2', nickname: '小華', online: false }] },
      { id: 't2', sessionId: 'sess-1', index: 2, name: '第 2 組', score: 0, members: [] },
    ],
    cells: [],
    importSummary: null,
    serverNow: 0,
  };
}

export function makeTeamView(): TeamView {
  return {
    session: { roomCode: 'K7Q2MX', phase: 'READY', round: 1 },
    team: { id: 't1', name: '第 1 組', members: [{ id: 'm1', nickname: '小明', online: true }] },
    questions: [], drafts: {}, mySubmissions: {}, results: null, serverNow: 0,
  };
}

export function makePlayState(): PlayState {
  return { ...makeTeamView(), me: { id: 'm1', nickname: '小明' } };
}

export function makePublicInfo(): PublicSessionInfo {
  return {
    roomCode: 'K7Q2MX', phase: 'SETUP',
    teams: [
      { id: 't1', name: '第 1 組', memberCount: 2 },
      { id: 't2', name: '第 2 組', memberCount: 0 },
    ],
  };
}

export function appError(code: AppErrorView['code']): AppErrorView {
  return { code, message: code };
}

/** 假的 socket 連線：測試可透過 emitState／emitUnauthorized 推送事件 */
export function fakeConnection<T>() {
  let stateCb: ((s: T) => void) | null = null;
  let unauthCb: (() => void) | null = null;
  return {
    onState: (cb: (s: T) => void) => { stateCb = cb; },
    onUnauthorized: (cb: () => void) => { unauthCb = cb; },
    disconnect: () => undefined,
    emitState: (s: T) => stateCb?.(s),
    emitUnauthorized: () => unauthCb?.(),
  };
}
