import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['source'] },
  test: {
    name: 'shared',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
