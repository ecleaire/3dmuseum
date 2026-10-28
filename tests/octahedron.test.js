import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOctahedronGlb } from '../scripts/generate-octahedron.mjs';

test('public model is a closed regular octahedron with eight equilateral outward-facing faces', async () => {
  const glb = createOctahedronGlb();
  assert.deepEqual(await readFile(new URL('../production/public/octahedron.glb', import.meta.url)), glb);
  assert.equal(glb.readUInt32LE(8), glb.length);
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const start = 28 + jsonLength;
  const count = gltf.accessors[0].count;
  assert.equal(count / 3, 8);
  const vertices = new Set(), edges = new Map();
  for (let face = 0; face < count; face += 3) {
    const points = Array.from({length:3}, (_,i)=>Array.from({length:3},(_,axis)=>glb.readFloatLE(start + (face+i)*12 + axis*4)));
    points.forEach(v=>vertices.add(v.join(',')));
    const u = points[1].map((v,i)=>v-points[0][i]);
    const v = points[2].map((v,i)=>v-points[0][i]);
    const normal = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(normal.reduce((sum,n,i)=>sum+n*points[0][i],0)>0);
    for (let i=0;i<3;i++) {
      const a=points[i],b=points[(i+1)%3];
      assert.equal(a.reduce((sum,n,j)=>sum+(n-b[j])**2,0),2);
      const key=[a.join(','),b.join(',')].sort().join('|');
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.equal(vertices.size,6);assert.equal(edges.size,12);
  assert.ok([...edges.values()].every(n=>n===2));
});
