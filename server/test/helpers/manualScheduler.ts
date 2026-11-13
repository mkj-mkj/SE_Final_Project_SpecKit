// 手動觸發的排程器（TEST_SPEC §3）：依 (at 升冪, 排程先後) 觸發
import type { Scheduler } from '../../src/ports/scheduler.js';
import type { FakeClock } from './fakeClock.js';

interface Entry {
  key: string;
  at: number;
  order: number;
  fn: () => void;
}

export class ManualScheduler implements Scheduler {
  private entries = new Map<string, Entry>();
  private counter = 0;
  constructor(private clock: FakeClock) {}

  schedule(key: string, at: number, fn: () => void): void {
    this.entries.set(key, { key, at, order: this.counter++, fn }); // 同 key 取代
  }
  cancel(key: string): void {
    this.entries.delete(key);
  }
  cancelAll(): void {
    this.entries.clear();
  }
  pending(): { key: string; at: number }[] {
    return this.sorted().map(({ key, at }) => ({ key, at }));
  }
  /** 依序把 clock 設為每個到期的 at 並執行，最後 clock = t */
  advanceTo(t: number): void {
    for (;;) {
      const next = this.sorted()[0];
      if (!next || next.at > t) break;
      this.entries.delete(next.key);
      if (next.at > this.clock.now()) this.clock.set(next.at);
      next.fn();
    }
    this.clock.set(t);
  }
  advance(ms: number): void {
    this.advanceTo(this.clock.now() + ms);
  }
  private sorted(): Entry[] {
    return [...this.entries.values()].sort((a, b) => a.at - b.at || a.order - b.order);
  }
}
