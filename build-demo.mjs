import { build } from 'esbuild';

await build({
  entryPoints: ['src/client/demo-leafer.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: 'public/demo-leafer.js',
  target: ['es2020'],
});

console.log('Demo build OK');
