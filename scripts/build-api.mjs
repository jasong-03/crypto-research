import { build } from 'esbuild';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('Building API function with esbuild...');

try {
  await build({
    entryPoints: [resolve(rootDir, 'api/research.ts.bak')],
    bundle: true,
    outfile: resolve(rootDir, 'api/research.js'),
    platform: 'node',
    target: 'node20',
    format: 'esm',
    external: ['@vercel/node'],
    loader: {
      '.md': 'text',
      '.bak': 'ts',
    },
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },
    sourcemap: false,
    minify: false,
    treeShaking: true,
  });
  
  console.log('✓ API function bundled successfully to api/research.js');
} catch (error) {
  console.error('✗ Bundling failed:', error);
  process.exit(1);
}

