import { pathToFileURL } from 'node:url';

export async function verifyPublishedSite(siteUrl, fetcher = fetch, expectedEnvironment) {
  const site = new URL(siteUrl);
  if (!site.pathname.endsWith('/')) site.pathname += '/';
  const pageUrl = new URL(site);
  pageUrl.searchParams.set('deployment', process.env.GITHUB_SHA || Date.now().toString());
  async function read(url, expectedType) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url.pathname}`);
    if (expectedType && !expectedType.test(response.headers.get('content-type') || '')) {
      throw new Error(`Unexpected content type: ${url.pathname}`);
    }
    return response;
  }
  const html = await (await read(pageUrl, /text\/html/i)).text();
  if (expectedEnvironment && !html.includes(`name="museum-environment" content="${expectedEnvironment}"`)) {
    throw new Error(`Wrong published environment: expected ${expectedEnvironment}.`);
  }
  const css = [...html.matchAll(/<link\b[^>]*>/gi)].find(([tag]) => /rel=["']stylesheet["']/i.test(tag));
  const cssPath = css?.[0].match(/href=["']([^"']+)["']/i)?.[1];
  if (!cssPath) throw new Error('Unbuilt source HTML is published. Set Pages Source to GitHub Actions and deploy dist/.');
  const cssText = await (await read(new URL(cssPath, site), /text\/css/i)).text();
  if (!cssText.includes('.site-header')) throw new Error('The museum stylesheet is missing.');
  if (!html.includes('Coming soon') || /<model-viewer(?![^>]*\bid=["']octahedron["'])|<form\b|<input\b/i.test(html)) {
    throw new Error('The published page does not match the approved landing page.');
  }
  const script = [...html.matchAll(/<script\b[^>]*>/gi)].find(([tag]) => /type=["']module["']/i.test(tag));
  const bundle = script?.[0].match(/src=["']([^"']+)["']/i)?.[1];
  if (!bundle || /(?:^|\/)src\//.test(bundle)) throw new Error('The compiled JavaScript bundle is missing.');
  await read(new URL(bundle, site), /(?:javascript|ecmascript)/i);
  const modelPath = html.match(/<model-viewer[^>]*src=["']([^"']+)["']/i)?.[1];
  if (!modelPath || new URL(modelPath, site).pathname !== new URL('octahedron.glb', site).pathname) throw new Error('The octahedron asset is missing.');
  const modelData = await (await read(new URL(modelPath, site))).arrayBuffer();
  if (modelData.byteLength < 12 || new DataView(modelData).getUint32(0, true) !== 0x46546c67) throw new Error('The octahedron GLB is invalid.');

}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.argv[2];
  if (!url) throw new Error('Usage: node scripts/check-published.mjs <site-url>');
  for (let attempt = 1; ; attempt++) {
    try {
      await verifyPublishedSite(url, fetch, process.argv[3]);
      console.log('Published site verified: the expected page and assets are available.');
      break;
    } catch (error) {
      if (attempt >= 6) throw error;
      console.log(`Published site not ready (${attempt}/6): ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
