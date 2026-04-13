import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'https://gummi-server.onrender.com',
      '/uploads': 'https://gummi-server.onrender.com',
      '/reports': 'https://gummi-server.onrender.com',
    }
  }
});




