import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// `base: './'` keeps every asset path relative, so the same build works on
// GitHub Pages (https://<user>.github.io/<repo>/), any sub-folder, or locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
