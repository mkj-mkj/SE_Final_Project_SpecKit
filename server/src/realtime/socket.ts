// Socket.IO 連線驗證與上線計數（TECH_SPEC §7.11、§9；research R-09、R-10）
import type { Server, Socket } from 'socket.io';
import type { AuthService } from '../services/authService.js';
import type { SessionService } from '../services/sessionService.js';

type SocketData =
  | { role: 'teacher'; sessionId: string }
  | { role: 'member'; memberId: string; teamId: string; token: string };

/**
 * 連線規則：
 * - teacher token 有效且帶有存在的 auth.sessionId → 加入 `teacher:${sessionId}`
 * - member token 有效 → 加入 `team:${teamId}`
 * - 其他 → connect_error，訊息 'UNAUTHORIZED'
 * 連線成功後立即送出一次目前狀態（重連時不必等下一次變更）。
 */
export function attachSocket(io: Server, deps: { auth: AuthService; service: SessionService }): void {
  const { auth, service } = deps;

  // 每位成員目前的連線（分頁）數：0→1 才算上線，1→0 才算離線，
  // 因此同一成員開多個分頁時，要全部關閉才會顯示離線
  const connections = new Map<string, number>();

  io.use((socket, next) => {
    const { token, sessionId } = (socket.handshake.auth ?? {}) as { token?: unknown; sessionId?: unknown };
    const data = authenticate(typeof token === 'string' ? token : undefined, sessionId);
    if (!data) {
      next(new Error('UNAUTHORIZED'));
      return;
    }
    socket.data = data;
    next();
  });

  function authenticate(token: string | undefined, sessionId: unknown): SocketData | null {
    if (!token) return null;
    try {
      auth.verifyTeacher(token);
      if (typeof sessionId !== 'string') return null;
      service.getTeacherView(sessionId); // 活動不存在 → SESSION_NOT_FOUND
      return { role: 'teacher', sessionId };
    } catch {
      // 不是有效的老師身分（或活動不存在），改試學生身分
    }
    try {
      const member = service.resolveMember(token);
      return { role: 'member', memberId: member.id, teamId: member.teamId, token };
    } catch {
      return null;
    }
  }

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    if (data.role === 'teacher') {
      void socket.join(`teacher:${data.sessionId}`);
      socket.emit('teacher:state', service.getTeacherView(data.sessionId));
      return;
    }

    void socket.join(`team:${data.teamId}`);
    const count = (connections.get(data.memberId) ?? 0) + 1;
    connections.set(data.memberId, count);
    if (count === 1) service.setOnline(data.memberId, true); // 會推播給老師與本組
    socket.emit('team:state', service.getTeamView(data.token));

    socket.on('disconnect', () => {
      const left = (connections.get(data.memberId) ?? 1) - 1;
      if (left > 0) {
        connections.set(data.memberId, left);
        return;
      }
      connections.delete(data.memberId);
      service.setOnline(data.memberId, false);
    });
  });
}
