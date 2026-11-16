// 載入 jest-dom 的 vitest matcher（toBeInTheDocument 等）
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 未啟用 vitest globals，Testing Library 不會自動 cleanup；每個測試後卸載已渲染的元件
afterEach(() => {
  cleanup();
});

// Node 25+ 內建的 localStorage／sessionStorage（未提供 --localstorage-file 時為 undefined）
// 會遮蔽 jsdom 的實作；此處改回 vitest 提供的 jsdom 視窗上的 Storage
const dom = (globalThis as { jsdom?: { window: { localStorage: Storage; sessionStorage: Storage } } }).jsdom;
if (dom) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => dom.window[key],
    });
  }
}
