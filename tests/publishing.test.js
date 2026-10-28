import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPublishedSite } from '../scripts/check-published.mjs';
import { verifyBuild } from '../scripts/check-build.mjs';
const built = '<meta name="museum-environment" content="production"><link rel="stylesheet" href="./assets/app.css"><h1>Coming soon</h1><model-viewer id="octahedron" src="./octahedron.glb"></model-viewer><script type="module" src="./assets/app.js"></script>';
const model = new ArrayBuffer(12);
new DataView(model).setUint32(0, 0x46546c67, true);
function server({ html = built, cssStatus = 200 } = {}) {
  return async (url) => {
    assert.ok(url.pathname.startsWith('/3dmuseum/'));
    if (url.pathname.endsWith('app.css')) return new Response('.site-header{position:sticky}', { status: cssStatus, headers: { 'content-type': 'text/css' } });
    if (url.pathname.endsWith('app.js')) return new Response('customElements.define("model-viewer", class {});', { headers: { 'content-type': 'text/javascript' } });
    if (url.pathname.endsWith('octahedron.glb')) return new Response(model);
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  };
}
test('published landing page serves its compiled files under the repository path', async () => {
  await verifyPublishedSite('https://example.com/3dmuseum/', server(), 'production');
});
test('published-site check rejects source HTML and missing styles', async () => {
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html: '<script type="module" src="/src/main.js"></script>' })), /Unbuilt source HTML/);
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ cssStatus: 404 })), /HTTP 404/);
});
test('published-site check rejects an unexpected environment or application', async () => {
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html: built.replace('content="production"','content="other"') }), 'production'), /Wrong published environment/);
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html: built + '<model-viewer></model-viewer>' })), /approved landing page/);
});
test('build output allowlist rejects accidental extra files', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'museum-build-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'assets'));
  for (const file of ['index.html','octahedron.glb','assets/app.css','assets/app.js']) await writeFile(join(directory,file),'fixture');
  await verifyBuild(directory);
  await writeFile(join(directory,'unexpected.txt'),'fixture');
  await assert.rejects(verifyBuild(directory),/Unexpected published file/);
});
