// 記錄 publish 呼叫的 broadcaster（TEST_SPEC §3）
import type { Broadcaster, PublishScope } from '../../src/realtime/broadcaster.js';

export class RecordingBroadcaster implements Broadcaster {
  calls: { sessionId: string; scope?: PublishScope }[] = [];
  publish(sessionId: string, scope?: PublishScope): void {
    this.calls.push(scope === undefined ? { sessionId } : { sessionId, scope });
  }
}
