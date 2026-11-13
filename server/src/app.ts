// 組裝 HTTP 與 Socket.IO（TECH_SPEC §2）：createApp(deps) → { app, httpServer, io }
import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import type { Repo } from './db/repo.js';
import { errorHandler } from './http/errorHandler.js';
import { playRoutes } from './http/playRoutes.js';
import { publicRoutes } from './http/publicRoutes.js';
import { teacherRoutes } from './http/teacherRoutes.js';
import type { Clock } from './ports/clock.js';
import type { IdGen } from './ports/ids.js';
import type { Scheduler } from './ports/scheduler.js';
import type { SheetsGateway } from './ports/sheetsGateway.js';
import { createSocketBroadcaster, nullBroadcaster, type Broadcaster } from './realtime/broadcaster.js';
import { attachSocket } from './realtime/socket.js';
import type { AuthService } from './services/authService.js';
import { SessionService } from './services/sessionService.js';

export interface AppDeps {
  repo: Repo;
  clock: Clock;
  scheduler: Scheduler;
  ids: IdGen;
  sheets: SheetsGateway;
  auth: AuthService;
}

// 前端建置結果：app.ts 位於 server/src 或 server/dist，往上兩層為專案根目錄（不依賴 process.cwd()）
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createApp(deps: AppDeps): { app: Express; httpServer: HttpServer; io: Server } {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  // 延遲綁定：SessionService 需要 broadcaster，而 socket broadcaster 需要 service 載入資料
  let target: Broadcaster = nullBroadcaster;
  const broadcaster: Broadcaster = { publish: (sessionId, scope) => target.publish(sessionId, scope) };
  const service = new SessionService({ ...deps, broadcaster });
  target = createSocketBroadcaster(io, (sessionId) => service.loadAggregate(sessionId), deps.clock);
  attachSocket(io, { auth: deps.auth, service });

  app.use(express.json());
  app.use('/api/teacher', teacherRoutes(deps.auth, service));
  app.use('/api/public', publicRoutes(service));
  app.use('/api/play', playRoutes(service));

  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    // SPA fallback：非 /api、/socket.io 的 GET 一律回 index.html
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: CLIENT_DIST });
    });
  }

  app.use(errorHandler);
  return { app, httpServer, io };
}
