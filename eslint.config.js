// ESLint flat config：typescript-eslint recommended 套用於所有 TS／TSX 檔案
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      'coverage/**',
      'e2e/artifacts/**',
      'test-results/**',
      'playwright-report/**',
      '**/node_modules/**',
      '.specify/**',
      '.claude/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
  },
);
