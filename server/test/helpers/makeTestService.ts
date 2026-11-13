// 組裝測試用 SessionService（TEST_SPEC §3）。
// 001：snapshots 預設為空物件（research R-04）；002 起改為預設載入兩份 fixture。
import type { SheetSnapshot } from '@quiz/shared';
import { openDb } from '../../src/db/db.js';
import { Repo } from '../../src/db/repo.js';
import { SessionService } from '../../src/services/sessionService.js';
import { FakeClock } from './fakeClock.js';
import { InMemorySheetsGateway } from './inMemorySheets.js';
import { ManualScheduler } from './manualScheduler.js';
import { RecordingBroadcaster } from './recordingBroadcaster.js';
import { SeqIdGen } from './seqIdGen.js';

export function makeTestService(opts?: { snapshots?: Record<string, SheetSnapshot>; roomCodes?: string[] }): {
  service: SessionService;
  repo: Repo;
  clock: FakeClock;
  scheduler: ManualScheduler;
  ids: SeqIdGen;
  gateway: InMemorySheetsGateway;
  broadcaster: RecordingBroadcaster;
} {
  const repo = new Repo(openDb(':memory:'));
  const clock = new FakeClock();
  const scheduler = new ManualScheduler(clock);
  const ids = new SeqIdGen(opts?.roomCodes);
  const gateway = new InMemorySheetsGateway(opts?.snapshots ?? {});
  const broadcaster = new RecordingBroadcaster();
  const service = new SessionService({ repo, clock, scheduler, ids, sheets: gateway, broadcaster });
  return { service, repo, clock, scheduler, ids, gateway, broadcaster };
}
