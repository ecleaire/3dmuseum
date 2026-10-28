import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPublishedSite } from '../scripts/check-published.mjs';

const built = '<link rel="stylesheet" href="./assets/app.css"><script type="module" src="./assets/app.js"></script>';
const model = new ArrayBuffer(12);
new DataView(model).setUint32(0, 0x46546c67, true);
function server({ html = built, cssStatus = 200 } = {}) {
  return async (url) => {
    assert.ok(url.pathname.startsWith('/3dmuseum/'));
    if (url.pathname.endsWith('app.css')) return new Response('.site-header{position:sticky}', { status: cssStatus, headers: { 'content-type': 'text/css' } });
    if (url.pathname.endsWith('app.js')) return new Response('customElements.define("model-viewer", class {});', { headers: { 'content-type': 'text/javascript' } });
    if (url.pathname.endsWith('.glb')) return new Response(model);
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  };
}
test('published-site check accepts a built site under the repository path', async () => {
  await verifyPublishedSite('https://example.com/3dmuseum/', server());
});
test('published-site check rejects source HTML served by legacy Pages', async () => {
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html: '<script type="module" src="/src/main.js"></script>' })), /Unbuilt source HTML/);
});
test('published-site check rejects a missing stylesheet', async () => {
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ cssStatus: 404 })), /HTTP 404/);
});
