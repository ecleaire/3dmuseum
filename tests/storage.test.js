import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DriveStorage } from '../src/drive.js';
import { validateGlb, MAX_MODEL_BYTES } from '../shared/glb.js';

const file = await readFile(new URL('../public/models/pikatyuu.glb', import.meta.url));
const model = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('GLB validation accepts the actual model and rejects malformed or externally referenced models', () => {
  assert.equal(validateGlb(model, 'model.glb').asset.version, '2.0');
  assert.throws(() => validateGlb(model, 'model.gltf'));
  assert.throws(() => validateGlb(model.slice(0, 100), 'model.glb'));
  const broken = model.slice(0);
  new DataView(broken).setUint32(12, 0xffffffff, true);
  assert.throws(() => validateGlb(broken, 'model.glb'));
  assert.throws(() => validateGlb(new ArrayBuffer(MAX_MODEL_BYTES + 1), 'large.glb'), /50 MB/);
  const external = new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},scenes:[{}],buffers:[{uri:'https://example.com/data.bin'}]}).padEnd(160, ' '));
  const container = new ArrayBuffer(20 + external.length);
  const view = new DataView(container);
  [0x46546c67, 2, container.byteLength, external.length, 0x4e4f534a].forEach((value, i) => view.setUint32(i*4, value, true));
  new Uint8Array(container, 20).set(external);
  assert.throws(() => validateGlb(container, 'external.glb'), /GLB 内/);
});

test('Drive uses app-scoped folder, paginates, and sends an authenticated multipart GLB upload', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const drive = new DriveStorage(); drive.token = 'test-only';
  let creates = 0;
  let folderExists = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/upload/')) {
      assert.match(options.headers['Content-Type'], /^multipart\/related; boundary=/);
      const bytes = Buffer.from(await options.body.arrayBuffer());
      assert.ok(bytes.includes(file));
      const text = bytes.toString();
      assert.match(text, /"parents":\["folder-1"\]/);
      assert.match(text, /"museumModel":"glb-v1"/);
      assert.doesNotMatch(text, /"permissions"/);
      return jsonResponse({id:'model-1',name:'sample.glb'});
    }
    if (options.method === 'POST') {
      creates++;
      const metadata = JSON.parse(options.body);
      assert.equal(metadata.mimeType, 'application/vnd.google-apps.folder');
      assert.equal(metadata.appProperties.museumApp, '3dmuseum-v1');
      folderExists = true;
      return jsonResponse({id:'folder-1'});
    }
    if (parsed.searchParams.get('q').includes('museumApp')) return jsonResponse({files:folderExists?[{id:'folder-1'}]:[]});
    assert.match(parsed.searchParams.get('q'), /trashed = false/);
    return parsed.searchParams.has('pageToken') ? jsonResponse({files:[{id:'model-2'}]}) : jsonResponse({files:[{id:'model-1'}],nextPageToken:'next'});
  };
  assert.deepEqual(await drive.list(), []); // Browsing does not create a folder.
  const saved = await drive.save(new File([file], 'sample.glb'));
  assert.equal(saved.id, 'model-1');
  assert.equal(creates, 1);
  assert.deepEqual((await drive.list()).map(f => f.id), ['model-1','model-2']);
});

test('expired authorization clears the token; permission and quota failures are explained', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let expired = 0;
  const drive = new DriveStorage({onExpired:()=>expired++});
  drive.token = 'test-only';
  globalThis.fetch = async () => jsonResponse({}, 401);
  await assert.rejects(drive.download('abc'), /再接続/);
  assert.equal(drive.token, null);
  assert.equal(expired, 1);
  drive.token = 'test-only';
  globalThis.fetch = async () => jsonResponse({}, 403);
  await assert.rejects(drive.download('abc'), /権限/);
  globalThis.fetch = async () => jsonResponse({error:{errors:[{reason:'storageQuotaExceeded'}]}}, 403);
  await assert.rejects(drive.download('abc'), /空き容量/);
});

test('an in-flight response from a disconnected account is discarded', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const drive = new DriveStorage(); drive.token = 'test-only';
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const result = drive.download('abc');
  drive.clear();
  finish(new Response(file));
  await assert.rejects(result, /接続先が変更/);
});

test('master uploads and queries use a separate Drive folder and file namespace', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const drive = new DriveStorage({ master: true });
  drive.token = 'test-only';
  let created = false;
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/upload/')) {
      const payload = await options.body.text();
      assert.match(payload, /"parents":\["master-folder"\]/);
      assert.match(payload, /"museumModel":"glb-master-v1"/);
      return jsonResponse({id:'master-model'});
    }
    if (options.method === 'POST') {
      const metadata = JSON.parse(options.body);
      assert.equal(metadata.name, '3D Museum (Master)');
      assert.equal(metadata.appProperties.museumApp, '3dmuseum-master-v1');
      created = true;
      return jsonResponse({id:'master-folder'});
    }
    const query = parsed.searchParams.get('q');
    if (query.includes('museumApp')) {
      assert.match(query, /value='3dmuseum-master-v1'/);
      return jsonResponse({files:[]});
    }
    assert.match(query, /'master-folder' in parents/);
    assert.match(query, /value='glb-master-v1'/);
    return jsonResponse({files:[]});
  };
  await drive.save(new File([file], 'sample.glb'));
  assert.equal(created, true);
  await drive.list();
});
