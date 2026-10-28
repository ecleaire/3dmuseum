import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export async function verifyBuild(directory) {
  if (directory instanceof URL) directory = fileURLToPath(directory);
  const files = [];
  async function walk(path, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) await walk(join(path, entry.name), relative + '/');
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported output entry: ${relative}`);
    }
  }
  await walk(directory);
  for (const file of files) {
    if (!['index.html', 'octahedron.glb'].includes(file) && !/^assets\/[\w-]+\.(?:css|js)$/.test(file)) {
      throw new Error(`Unexpected published file: ${file}`);
    }
  }
  if (!files.includes('index.html') || !files.includes('octahedron.glb') || !files.some(f=>f.endsWith('.css')) || !files.some(f=>f.endsWith('.js'))) {
    throw new Error('Required published files are missing.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyBuild(process.argv[2] || new URL('../dist', import.meta.url));
  console.log('Build output contains only approved site files.');
}
