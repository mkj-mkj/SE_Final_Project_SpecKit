// 伺服器時鐘校正（TECH_SPEC §10.3）：倒數與時間顯示一律以伺服器時間為準
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 回傳穩定的函式，呼叫時得到校正後的現在時間。
 * 每次 serverNow 改變時重算 offset = serverNow - Date.now()；undefined 時 offset 為 0。
 */
export function useServerClock(serverNow: number | undefined): () => number {
  const offset = useRef(0);
  const last = useRef<number | undefined>(undefined);
  // 於渲染期間同步更新，讓同一次渲染中的 now() 立即使用新快照的 offset
  if (serverNow !== last.current) {
    last.current = serverNow;
    offset.current = serverNow === undefined ? 0 : serverNow - Date.now();
  }
  return useCallback(() => Date.now() + offset.current, []);
}

/** 每 intervalMs 觸發一次重新渲染（倒數顯示用），卸載時清除計時器 */
export function useTick(intervalMs: number): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
