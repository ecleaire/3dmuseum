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
  if (expectedEnvironment === 'production') {
    if (!html.includes('Coming soon') || /<model-viewer(?![^>]*\bid=["']octahedron["'])|id=["'](?:viewer|file|drive-connect)["']/i.test(html)) {
      throw new Error('The public site must contain only the coming-soon page.');
    }
    const script = [...html.matchAll(/<script\b[^>]*>/gi)].find(([tag]) => /type=["']module["']/i.test(tag));
    const bundle = script?.[0].match(/src=["']([^"']+)["']/i)?.[1];
    if (!bundle) throw new Error('The octahedron JavaScript bundle is missing.');
    await read(new URL(bundle, site), /(?:javascript|ecmascript)/i);
    const modelPath = html.match(/<model-viewer[^>]*src=["']([^"']+)["']/i)?.[1];
    if (!modelPath) throw new Error('The public octahedron is missing.');
    const modelData = await (await read(new URL(modelPath, site))).arrayBuffer();
    if (modelData.byteLength < 12 || new DataView(modelData).getUint32(0, true) !== 0x46546c67) throw new Error('The octahedron GLB is invalid.');
    for (const path of ['preview/', 'master/', 'models/pikatyuu.glb']) {
      const privateUrl = new URL(path, site);
      privateUrl.searchParams.set('deployment', process.env.GITHUB_SHA || Date.now().toString());
      const response = await fetcher(privateUrl, { signal: AbortSignal.timeout(15000) });
      if (response.status !== 404) throw new Error(`Private app/model path must return 404: ${path}`);
    }
    return;
  }
  const javascript = [...html.matchAll(/<script\b[^>]*>/gi)].find(([tag]) => /type=["']module["']/i.test(tag));
  const jsPath = javascript?.[0].match(/src=["']([^"']+)["']/i)?.[1];
  if (!jsPath || /(?:^|\/)src\//.test(jsPath)) throw new Error('The master application must be built before serving it.');
  const jsText = await (await read(new URL(jsPath, site), /(?:javascript|ecmascript)/i)).text();
  if (!jsText.length) throw new Error('The JavaScript bundle is empty.');
  const model = await (await read(new URL('models/pikatyuu.glb', site))).arrayBuffer();
  if (model.byteLength < 12 || new DataView(model).getUint32(0, true) !== 0x46546c67) {
    throw new Error('The sample GLB model is missing or invalid.');
  }
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
