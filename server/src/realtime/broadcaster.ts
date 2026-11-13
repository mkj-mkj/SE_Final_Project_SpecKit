// 狀態推播（TECH_SPEC §7.11）
import type { Server } from 'socket.io';
import { projectTeacherView, projectTeamView, type SessionAggregate } from '../domain/projections.js';
import type { Clock } from '../ports/clock.js';

export interface PublishScope {
  teacher?: boolean;
  teamIds?: string[] | 'all';
} // 預設 { teacher: true, teamIds: 'all' }

export interface Broadcaster {
  publish(sessionId: string, scope?: PublishScope): void;
}

/** 單元測試或尚未接上 Socket 時使用：不做任何事 */
export const nullBroadcaster: Broadcaster = {
  publish: () => {},
};

/**
 * 以 Socket.IO 推播完整快照。每次 publish 只載入一次 aggregate：
 * - 老師 room `teacher:${sessionId}` 收 `teacher:state`（TeacherView）
 * - 每個目標組 room `team:${teamId}` 收 `team:state`，內容一律經 projectTeamView 過濾，
 *   只含該組資料（憲章原則 IV）；禁止把 TeacherView 送到組別 room。
 */
export function createSocketBroadcaster(
  io: Server,
  load: (sessionId: string) => SessionAggregate,
  clock: Clock,
): Broadcaster {
  return {
    publish(sessionId, scope = {}) {
      const { teacher = true, teamIds = 'all' } = scope;
      const agg = load(sessionId);
      const now = clock.now();
      if (teacher) {
        io.to(`teacher:${sessionId}`).emit('teacher:state', projectTeacherView(agg, now));
      }
      const targets = teamIds === 'all' ? agg.teams.map((t) => t.id) : teamIds;
      for (const teamId of targets) {
        io.to(`team:${teamId}`).emit('team:state', projectTeamView(agg, teamId, now));
      }
    },
  };
}
