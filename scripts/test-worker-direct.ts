import { parentPort } from 'node:worker_threads';
import puppeteer from 'puppeteer-core';

parentPort?.on('message', async (msg) => {
  if (!msg.ws) return;
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: msg.ws, defaultViewport: null });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    
    // Direct call
    const t1 = await page.title();
    parentPort?.postMessage({ direct: t1 });
    
    // Via AsyncFunction (mimicking #executeCode)
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('page', 'return await page.title();');
    const t2 = await fn(page);
    parentPort?.postMessage({ asyncFn: t2 });
    
    await page.close();
    browser.disconnect();
    parentPort?.postMessage({ done: true });
  } catch (err) {
    parentPort?.postMessage({ error: (err as Error).message, stack: (err as Error).stack?.slice(0, 300) });
  }
});
parentPort?.postMessage({ ready: true });
