import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const production = mode === 'production';
  return {
    root: production ? fileURLToPath(new URL('./production', import.meta.url)) : fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    // Only the dedicated octahedron asset is public; never copy master assets.
    publicDir: production ? fileURLToPath(new URL('./production/public', import.meta.url)) : 'public',
    build: {
      outDir: fileURLToPath(new URL(production ? './dist' : './dist-master', import.meta.url)),
      emptyOutDir: true,
    },
    plugins: [{
      name: 'museum-site-metadata',
      transformIndexHtml(html) {
        const environment = production ? 'production' : 'master';
        return html.replace('<head>', `<head>\n    <meta name="museum-environment" content="${environment}" />${production ? '' : '\n    <meta name="robots" content="noindex, nofollow" />'}`)
          .replace('<title>3D MUSEUM</title>', '<title>【マスター版】3D MUSEUM</title>');
      },
    }],
  };
});
