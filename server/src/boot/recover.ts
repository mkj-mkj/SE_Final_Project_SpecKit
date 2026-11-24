// 啟動恢復（TECH_SPEC §7.12，E7）：index.ts 在 listen 前呼叫。
// 已過期的公平模式視窗立即結算、未到期的重新排程、所有成員上線狀態重設為離線（細節見 SessionService.recover）。
import type { SessionService } from '../services/sessionService.js';

export function recoverOnBoot(service: SessionService): void {
  try {
    service.recover();
  } catch (e) {
    console.error('啟動恢復失敗', e);
    throw e;
  }
}
