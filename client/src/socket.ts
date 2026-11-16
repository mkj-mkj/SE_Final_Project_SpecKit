// Socket.IO 用戶端（contracts/socket-events.md）；客戶端只接收狀態快照
import { io, type Socket } from 'socket.io-client';
import type { TeacherView, TeamView } from '@quiz/shared';

export interface StateConnection<T> {
  onState(cb: (state: T) => void): void;
  onUnauthorized(cb: () => void): void;
  disconnect(): void;
}

function wrap<T>(socket: Socket, event: 'teacher:state' | 'team:state'): StateConnection<T> {
  return {
    onState(cb) {
      socket.on(event, cb);
    },
    onUnauthorized(cb) {
      socket.on('connect_error', (err: Error) => {
        if (err.message === 'UNAUTHORIZED') cb();
      });
    },
    disconnect() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

export function connectTeacher(token: string, sessionId: string): StateConnection<TeacherView> {
  return wrap<TeacherView>(io('/', { auth: { token, sessionId } }), 'teacher:state');
}

export function connectMember(token: string): StateConnection<TeamView> {
  return wrap<TeamView>(io('/', { auth: { token } }), 'team:state');
}
