// 計時器介面（TECH_SPEC §7.1）。業務邏輯只能透過 Scheduler 排程。
import type { Clock } from './clock.js';

export interface Scheduler {
  schedule(key: string, at: number, fn: () => void): void; // 同 key 重複排程時取代舊的
  cancel(key: string): void;
  cancelAll(): void;
}

/** 正式實作：setTimeout(max(0, at - clock.now()))；同 key 先取消舊的計時器 */
export const timerScheduler = (clock: Clock): Scheduler => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const cancel = (key: string): void => {
    const t = timers.get(key);
    if (t !== undefined) {
      clearTimeout(t);
      timers.delete(key);
    }
  };
  return {
    schedule(key, at, fn) {
      cancel(key);
      const handle = setTimeout(
        () => {
          timers.delete(key);
          fn();
        },
        Math.max(0, at - clock.now()),
      );
      timers.set(key, handle);
    },
    cancel,
    cancelAll() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
};
