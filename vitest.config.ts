import { defineConfig } from 'vitest/config';

// 根目錄設定只負責覆蓋率（TEST_SPEC §2.3），各 workspace 的測試設定見 vitest.workspace.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['shared/src/**', 'server/src/**', 'client/src/**'],
      exclude: ['server/src/index.ts', '**/*.d.ts'],
      thresholds: {
        lines: 80,
        branches: 75,
        'server/src/domain/**': { lines: 95, branches: 90 },
        'server/src/sheets/parser.ts': { lines: 95, branches: 90 },
        'server/src/services/**': { lines: 90, branches: 85 },
        'shared/src/**': { lines: 90, branches: 85 },
      },
    },
  },
});
