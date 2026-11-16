// 載入 jest-dom 的 vitest matcher（toBeInTheDocument 等）
import '@testing-library/jest-dom/vitest';

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
