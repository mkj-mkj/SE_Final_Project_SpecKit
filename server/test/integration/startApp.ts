// 整合測試用：以 createApp 啟動真實 HTTP + Socket.IO（隨機 port、測試替身）。
// 不帶參數時：DB :memory:、FakeClock + ManualScheduler、InMemorySheetsGateway 載入兩份範例快照（001 的 IT 不需修改）。
// opts.realTime：改用 systemClock + timerScheduler（TEST_SPEC §6：IT-CONC、IT-PERF 使用真實時鐘）。
// opts.dbPath：檔案 DB（IT-RESTART-01）；opts.clock：多次啟動共用同一個 FakeClock。
import type { AddressInfo } from 'node:net';
import type { SheetSnapshot } from '@quiz/shared';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp, serviceOf } from '../../src/app.js';
import { openDb } from '../../src/db/db.js';
import { Repo } from '../../src/db/repo.js';
import { systemClock, type Clock } from '../../src/ports/clock.js';
import { timerScheduler, type Scheduler } from '../../src/ports/scheduler.js';
import { AuthService } from '../../src/services/authService.js';
import { FakeClock } from '../helpers/fakeClock.js';
import { loadSnapshot } from '../helpers/fixtures.js';
import { InMemorySheetsGateway } from '../helpers/inMemorySheets.js';
import { ManualScheduler } from '../helpers/manualScheduler.js';
import { SeqIdGen } from '../helpers/seqIdGen.js';

export const TEACHER_PASSWORD = 'it-pass';

export interface StartAppOptions {
  /** 試算表替身的內容；預設 fixture-template-a、fixture-template-b */
  snapshots?: Record<string, SheetSnapshot>;
  /** 預設 ':memory:' */
  dbPath?: string;
  /** 共用的 FakeClock（realTime 時忽略） */
  clock?: FakeClock;
}

/** 真實時鐘模式（IT-CONC-01、IT-PERF-01） */
export function startApp(opts: StartAppOptions & { realTime: true }): Promise<StartedApp<Clock, Scheduler>>;
/** 預設：可控時鐘 */
export function startApp(opts?: StartAppOptions & { realTime?: false }): Promise<StartedApp<FakeClock, ManualScheduler>>;
export async function startApp(
  opts: StartAppOptions & { realTime?: boolean } = {},
): Promise<StartedApp<Clock, Scheduler>> {
  const clock: Clock = opts.realTime ? systemClock : (opts.clock ?? new FakeClock());
  const scheduler: Scheduler = opts.realTime ? timerScheduler(systemClock) : new ManualScheduler(clock as FakeClock);
  const ids = new SeqIdGen();
  const db = openDb(opts.dbPath ?? ':memory:');
  const gateway = new InMemorySheetsGateway(
    opts.snapshots ?? {
      'fixture-template-a': loadSnapshot('template-a'),
      'fixture-template-b': loadSnapshot('template-b'),
    },
  );
  const { app, httpServer, io } = createApp({
    repo: new Repo(db),
    clock,
    scheduler,
    ids,
    sheets: gateway,
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

  let closed = false;
  /** 關閉所有用戶端、Socket.IO、HTTP，取消計時器並關閉 DB（檔案 DB 才能刪除） */
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    for (const c of clients) c.close();
    scheduler.cancelAll();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    db.close();
  };

  return { app, httpServer, io, baseUrl, connect, close, clock, scheduler, gateway, service: serviceOf(app) };
}

export interface StartedApp<C extends Clock, S extends Scheduler> {
  app: ReturnType<typeof createApp>['app'];
  httpServer: ReturnType<typeof createApp>['httpServer'];
  io: ReturnType<typeof createApp>['io'];
  baseUrl: string;
  connect: (auth: Record<string, string>) => ClientSocket;
  close: () => Promise<void>;
  clock: C;
  scheduler: S;
  gateway: InMemorySheetsGateway;
  service: ReturnType<typeof serviceOf>;
}

/** 等待 socket 的下一個指定事件 */
export function nextEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

/** startApp({ realTime: true }) 的回傳型別 */
export type RealTimeApp = StartedApp<Clock, Scheduler>;
