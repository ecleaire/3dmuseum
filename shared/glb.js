export const MAX_MODEL_BYTES = 50 * 1024 * 1024;

// Validate the container before preview or upload. Works in Node and the browser.
export function validateGlb(arrayBuffer, filename) {
  if (!/\.glb$/i.test(filename)) throw new Error('GLB（.glb）ファイルを選択してください。');
  if (arrayBuffer.byteLength > MAX_MODEL_BYTES) throw new Error('ファイルは 50 MB 以下にしてください。');
  const view = new DataView(arrayBuffer);
  const invalid = () => { throw new Error('有効な GLB（glTF 2.0）ファイルを選択してください。'); };
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== view.byteLength) invalid();
  let offset = 12;
  let document;
  while (offset < view.byteLength) {
    if (offset + 8 > view.byteLength) invalid();
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > view.byteLength) invalid();
    if (offset === 12) {
      if (type !== 0x4e4f534a) invalid();
      try {
        document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(arrayBuffer, offset + 8, length)));
      } catch { invalid(); }
    }
    offset += 8 + length;
  }
  if (document?.asset?.version !== '2.0' || !Array.isArray(document.scenes) || !document.scenes.length) invalid();
  // Keep uploaded models self-contained; do not fetch external resources.
  for (const resource of [...(document.buffers || []), ...(document.images || [])]) {
    if (resource.uri && !resource.uri.startsWith('data:')) throw new Error('テクスチャやデータを GLB 内に含めて書き出してください。');
  }
  return document;
}
