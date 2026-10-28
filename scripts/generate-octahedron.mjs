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
  const edgePositions = [], edgeNormals = [];
  const vertices = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normalize = a => a.map(value=>value/Math.hypot(...a));
  // Thin solid cylinders form all twelve edges, with correct face occlusion.
  for (let i=0;i<vertices.length;i++) for (let j=i+1;j<vertices.length;j++) {
    const a=vertices[i], b=vertices[j];
    if (a.reduce((sum,value,k)=>sum+(value-b[k])**2,0)!==2) continue;
    const axis=normalize(b.map((value,k)=>value-a[k]));
    const u=normalize(cross(axis,Math.abs(axis[1])<0.9?[0,1,0]:[1,0,0]));
    const v=cross(axis,u);
    const ring = (point, angle) => {
      const normal=u.map((value,k)=>value*Math.cos(angle)+v[k]*Math.sin(angle));
      return { position:point.map((value,k)=>value+normal[k]*0.008), normal };
    };
    for (let side=0;side<8;side++) {
      const angle=side*Math.PI/4, next=(side+1)*Math.PI/4;
      const p=ring(a,angle),q=ring(a,next),r=ring(b,angle),t=ring(b,next);
      for (const vertex of [p,q,r,q,t,r]) {
        edgePositions.push(...vertex.position);edgeNormals.push(...vertex.normal);
      }
    }
  }
  const arrays=[positions,normals,edgePositions,edgeNormals];
  const binary=Buffer.alloc(arrays.reduce((sum,array)=>sum+array.length*4,0));
  const bufferViews=[];
  let offset=0;
  for (const array of arrays) {
    bufferViews.push({buffer:0,byteOffset:offset,byteLength:array.length*4});
    array.forEach((value,i)=>binary.writeFloatLE(value,offset+i*4));
    offset+=array.length*4;
  }
  const linearColor = hex => hex.match(/../g).map(channel=>{
    const value=parseInt(channel,16)/255;
    return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;
  });
  const gltf = {
    asset: { version: '2.0', generator: '3D MUSEUM regular octahedron' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Regular octahedron' }],
    meshes: [{ primitives: [
      { attributes: { POSITION: 0, NORMAL: 1 }, material: 0 },
      { attributes: { POSITION: 2, NORMAL: 3 }, material: 1 },
    ] }],
    materials: [
      { name: 'Navy faces', pbrMetallicRoughness: { baseColorFactor: [...linearColor('172438'), 1], metallicFactor: 0, roughnessFactor: 0.8 } },
      { name: 'Mint edges', pbrMetallicRoughness: { baseColorFactor: [...linearColor('73e7d1'), 1], metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } },
    ],
    buffers: [{ byteLength: binary.length }], bufferViews,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-1,-1,-1], max: [1,1,1] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: edgePositions.length/3, type: 'VEC3', min: [-1.008,-1.008,-1.008], max: [1.008,1.008,1.008] },
      { bufferView: 3, componentType: 5126, count: edgeNormals.length/3, type: 'VEC3' },
    ],
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
