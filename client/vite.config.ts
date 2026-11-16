import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開發伺服器：port 5173，/api 與 /socket.io 轉發到後端 3000
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
