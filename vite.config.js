import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./production', import.meta.url)),
  base: './',
  publicDir: fileURLToPath(new URL('./production/public', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [{
    name: 'museum-site-metadata',
    transformIndexHtml(html) {
      return html.replace('<head>', '<head>\n    <meta name="museum-environment" content="production" />');
    },
  }],
});
