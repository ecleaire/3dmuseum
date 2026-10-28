import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function createOctahedronGlb() {
  const positions = [], normals = [];
  // One vertex on each positive and negative axis: all 12 edges have length √2.
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const face = [[x, 0, 0], [0, y, 0], [0, 0, z]];
    if (x * y * z < 0) [face[1], face[2]] = [face[2], face[1]];
    for (const vertex of face) {
      positions.push(...vertex);
      normals.push(x / Math.sqrt(3), y / Math.sqrt(3), z / Math.sqrt(3));
    }
  }
  const binary = Buffer.alloc(positions.length * 4 + normals.length * 4);
  [...positions, ...normals].forEach((value, i) => binary.writeFloatLE(value, i * 4));
  const gltf = {
    asset: { version: '2.0', generator: '3D MUSEUM regular octahedron' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Regular octahedron' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [{ name: 'Mint crystal', pbrMetallicRoughness: { baseColorFactor: [0.22, 0.82, 0.7, 1], metallicFactor: 0.5, roughnessFactor: 0.25 }, emissiveFactor: [0.015, 0.07, 0.055] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length * 4 }, { buffer: 0, byteOffset: positions.length * 4, byteLength: normals.length * 4 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-1,-1,-1], max: [1,1,1] }, { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' }],
  };
  const json = Buffer.from(JSON.stringify(gltf).padEnd(Math.ceil(Buffer.byteLength(JSON.stringify(gltf)) / 4) * 4, ' '));
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binaryHeader, binary]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeFile(new URL('../production/public/octahedron.glb', import.meta.url), createOctahedronGlb());
}
