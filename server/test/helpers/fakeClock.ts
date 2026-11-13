// 可控時鐘（TEST_SPEC §3）
import type { Clock } from '../../src/ports/clock.js';

export class FakeClock implements Clock {
  private t: number;
  constructor(start = 1_700_000_000_000) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  set(t: number): void {
    this.t = t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
