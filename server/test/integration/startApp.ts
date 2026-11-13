// 整合測試用：以 createApp 啟動真實 HTTP + Socket.IO（隨機 port、DB :memory:、測試替身）
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { openDb } from '../../src/db/db.js';
import { Repo } from '../../src/db/repo.js';
import { AuthService } from '../../src/services/authService.js';
import { FakeClock } from '../helpers/fakeClock.js';
import { InMemorySheetsGateway } from '../helpers/inMemorySheets.js';
import { ManualScheduler } from '../helpers/manualScheduler.js';
import { SeqIdGen } from '../helpers/seqIdGen.js';

export const TEACHER_PASSWORD = 'it-pass';

export async function startApp() {
  const clock = new FakeClock();
  const ids = new SeqIdGen();
  const { app, httpServer, io } = createApp({
    repo: new Repo(openDb(':memory:')),
    clock,
    scheduler: new ManualScheduler(clock),
    ids,
    sheets: new InMemorySheetsGateway({}),
    auth: new AuthService(TEACHER_PASSWORD, ids),
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const clients: ClientSocket[] = [];

  /** 建立 Socket.IO 用戶端（不自動重連，測試結束時統一關閉） */
  const connect = (auth: Record<string, string>): ClientSocket => {
    const s = ioClient(baseUrl, { auth, reconnection: false, transports: ['websocket'] });
    clients.push(s);
    return s;
  };

  const close = async (): Promise<void> => {
    for (const c of clients) c.close();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { app, httpServer, io, baseUrl, connect, close };
}

/** 等待 socket 的下一個指定事件 */
export function nextEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}
