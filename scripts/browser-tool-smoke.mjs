/**
 * browser-tool-smoke.mjs — 冒烟测试：验证 browser 工具模块可加载
 *
 * 通过 esbuild 直接编译测试入口，避免依赖完整的 server bundle。
 */

import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const testDir = '/tmp/browser-smoke-test';
mkdirSync(testDir, { recursive: true });

// 写测试入口
const testCode = `
import { browserTool } from '../src/server/ai/tools/omp/browser.js';
import { acquireTab, runInTab, releaseTab } from '../src/server/ai/tools/omp/browser/tab-supervisor.js';

async function main() {
  console.log('=== Browser Tool Smoke Test ===');
  
  // 1. 工具注册检查
  console.log('1. Tool name:', browserTool.name);
  console.log('   Tool category:', browserTool.category);
  if (browserTool.name !== 'browser') {
    console.error('❌ Tool name mismatch');
    process.exit(1);
  }
  console.log('✅ Tool registered correctly');

  // 2. Open action
  console.log('\\n2. Testing open action...');
  const ctx = { cwd: '/root/kfmv4', wsServer: null };
  const openResult = await browserTool.execute({
    action: 'open',
    url: 'https://example.com',
    name: 'smoke-test',
  }, ctx);
  console.log('   Result:', JSON.stringify(openResult.content[0]?.text?.slice(0, 200)));
  if (openResult.isError) {
    console.error('❌ Open failed:', openResult.content[0]?.text);
    process.exit(1);
  }
  console.log('✅ Open succeeded');

  // 3. Run action
  console.log('\\n3. Testing run action...');
  const runResult = await browserTool.execute({
    action: 'run',
    code: 'const title = await tab.title(); display(title); return title;',
    name: 'smoke-test',
  }, ctx);
  console.log('   Result:', JSON.stringify(runResult.content[0]?.text?.slice(0, 200)));
  if (runResult.isError) {
    console.error('❌ Run failed:', runResult.content[0]?.text);
    process.exit(1);
  }
  console.log('✅ Run succeeded');

  // 4. Close action
  console.log('\\n4. Testing close action...');
  const closeResult = await browserTool.execute({
    action: 'close',
    name: 'smoke-test',
  }, ctx);
  console.log('   Result:', JSON.stringify(closeResult.content[0]?.text));
  if (closeResult.isError) {
    console.error('❌ Close failed');
    process.exit(1);
  }
  console.log('✅ Close succeeded');

  console.log('\\n=== All smoke tests passed ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Smoke test error:', err.message);
  process.exit(1);
});
`;

writeFileSync(join(testDir, 'smoke.mjs'), testCode);

// 用 esbuild 编译测试文件（独立 bundle，不依赖 dist/server）
try {
  const result = await build({
    entryPoints: [join(testDir, 'smoke.mjs')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: join(testDir, 'smoke-bundle.mjs'),
    external: [
      'express', 'fs', 'path', 'os', 'ws', 'events', 'node-pty-prebuilt-multiarch',
      'node:fs', 'node:path', 'node:os', 'node:crypto', 'node:url', 'node:child_process',
      'node:worker_threads', 'node:net', 'node:assert',
    ],
    target: 'node22',
  });
  
  if (result.errors.length > 0) {
    console.error('Build errors:', result.errors);
    process.exit(1);
  }
  
  console.log('Build successful, running smoke test...\n');
  
  // 动态 import 并运行
  const mod = await import(join(testDir, 'smoke-bundle.mjs'));
  
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
