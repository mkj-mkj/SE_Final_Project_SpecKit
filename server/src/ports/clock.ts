// 時間來源介面（TECH_SPEC §7.1）。業務邏輯只能透過 Clock 取得時間。
export interface Clock {
  now(): number; // 毫秒
}

export const systemClock: Clock = {
  now: () => Date.now(),
};
