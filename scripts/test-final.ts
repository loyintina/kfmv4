import { browserTool } from '../src/server/ai/tools/omp/browser.ts';

const ctx = { cwd: '/root/kfmv4', wsServer: null };

async function main() {
  console.log('=== Open ===');
  const r1 = await browserTool.execute({ action: 'open', url: 'https://example.com', name: 'final' }, ctx);
  console.log('Open:', r1.isError ? 'FAIL' : 'OK', JSON.stringify(r1.content[0]?.text).slice(0, 200));

  console.log('\n=== Run: tab.title() ===');
  const r2 = await browserTool.execute({ action: 'run', code: 'return await tab.title();', name: 'final' }, ctx);
  console.log('Run:', r2.isError ? 'FAIL' : 'OK', JSON.stringify(r2.content[0]?.text).slice(0, 200));

  console.log('\n=== Run: page.evaluate ===');
  const r3 = await browserTool.execute({ action: 'run', code: 'return await page.evaluate(() => document.title);', name: 'final' }, ctx);
  console.log('Run:', r3.isError ? 'FAIL' : 'OK', JSON.stringify(r3.content[0]?.text).slice(0, 200));

  console.log('\n=== Run: tab.observe ===');
  const r4 = await browserTool.execute({ action: 'run', code: 'const obs = await tab.observe(); display(obs.elements.slice(0, 3)); return obs.url;', name: 'final' }, ctx);
  console.log('Run:', r4.isError ? 'FAIL' : 'OK', JSON.stringify(r4.content).slice(0, 300));

  console.log('\n=== Close ===');
  const r5 = await browserTool.execute({ action: 'close', name: 'final' }, ctx);
  console.log('Close:', r5.isError ? 'FAIL' : 'OK', JSON.stringify(r5.content[0]?.text));
}

main().catch(err => console.error(err.message));
