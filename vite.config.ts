/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20000,
          groups: [
            { name: 'vendor-highlight', test: /node_modules[\\/]highlight\.js/ },
            { name: 'vendor-markdown', test: /node_modules[\\/](marked|dompurify)/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)/ },
            { name: 'vendor-ui', test: /node_modules[\\/](lucide-react|react-virtuoso)/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
