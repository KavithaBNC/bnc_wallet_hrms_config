import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-webcam', 'xlsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || 5001}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            const port = process.env.VITE_API_PORT || 5001;
            console.error(`\n[vite] API proxy error: cannot connect to backend at http://localhost:${port}`);
            console.error('       From project root run:  npm run dev\n');
          });
        },
      },
    },
  },
});
