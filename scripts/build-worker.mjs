import { build } from 'esbuild';
await build({
  entryPoints: ['src/server/ai/tools/omp/browser/tab-worker-entry.ts'],
  bundle: false,
  platform: 'node',
  format: 'esm',
  outfile: 'src/server/ai/tools/omp/browser/tab-worker-entry.js',
});
console.log('Worker entry built (no bundle)');
