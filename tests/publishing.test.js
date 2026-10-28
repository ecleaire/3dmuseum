import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPublishedSite } from '../scripts/check-published.mjs';
const built = '<link rel="stylesheet" href="./assets/app.css"><script type="module" src="./assets/app.js"></script>';
const model = new ArrayBuffer(12);
new DataView(model).setUint32(0, 0x46546c67, true);
function server({ html = built, cssStatus = 200, privatePaths = false } = {}) {
  return async (url) => {
    assert.ok(url.pathname.startsWith('/3dmuseum/'));
    if (url.pathname.endsWith('app.css')) return new Response('.site-header{position:sticky}', { status: cssStatus, headers: { 'content-type': 'text/css' } });
    if (url.pathname.endsWith('app.js')) return new Response('customElements.define("model-viewer", class {});', { headers: { 'content-type': 'text/javascript' } });
    if (privatePaths && /(?:preview\/|master\/|\.glb)$/.test(url.pathname)) return new Response('', { status: 404 });
    if (url.pathname.endsWith('.glb')) return new Response(model);
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  };
}
test('master build check accepts built CSS, JavaScript and GLB under a repository path', async () => {
  await verifyPublishedSite('https://example.com/3dmuseum/', server());
});
test('published-site check rejects source HTML served by legacy Pages', async () => {
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html: '<script type="module" src="/src/main.js"></script>' })), /Unbuilt source HTML/);
});
test('published-site check rejects a missing stylesheet', async () => {
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ cssStatus: 404 })), /HTTP 404/);
});
test('published-site check detects the wrong environment', async () => {
  const html = '<meta name="museum-environment" content="master">' + built;
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html }), 'production'), /Wrong published environment/);
});
test('public site is coming-soon only and does not serve master paths or models', async () => {
  const html = '<meta name="museum-environment" content="production"><link rel="stylesheet" href="./assets/app.css"><h1>Coming soon</h1>';
  await verifyPublishedSite('https://example.com/3dmuseum/', server({ html, privatePaths: true }), 'production');
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html }), 'production'), /must return 404/);
  await assert.rejects(verifyPublishedSite('https://example.com/3dmuseum/', server({ html: html + '<model-viewer></model-viewer>', privatePaths: true }), 'production'), /only the coming-soon/);
});
