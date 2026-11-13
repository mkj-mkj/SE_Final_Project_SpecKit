// 模擬 Socket.IO Server 的 io.to(room).emit(event, payload)，記錄所有送出
import type { Server } from 'socket.io';

export interface Emitted {
  room: string;
  event: string;
  payload: unknown;
}

export function fakeIo(): { io: Server; emitted: Emitted[] } {
  const emitted: Emitted[] = [];
  const io = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ room, event, payload: structuredClone(payload) });
          return true;
        },
      };
    },
  };
  return { io: io as unknown as Server, emitted };
}
