import { parentPort } from 'node:worker_threads';
import puppeteer from 'puppeteer-core';

async function test(wsEndpoint: string) {
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null });
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'load', timeout: 10000 });
    
    // Test 1: page.url() (no evaluate)
    const url = page.url();
    parentPort?.postMessage({ test: 'url', result: url });
    
    // Test 2: page.title() (uses evaluate internally)
    try {
      const t = await page.title();
      parentPort?.postMessage({ test: 'title', result: t });
    } catch (err) {
      parentPort?.postMessage({ test: 'title', error: (err as Error).message });
    }
    
    // Test 3: page.evaluate directly
    try {
      const t = await page.evaluate(() => document.title);
      parentPort?.postMessage({ test: 'evaluate', result: t });
    } catch (err) {
      parentPort?.postMessage({ test: 'evaluate', error: (err as Error).message });
    }
    
    await page.close();
    browser.disconnect();
    parentPort?.postMessage({ done: true });
  } catch (err) {
    parentPort?.postMessage({ error: (err as Error).message });
  }
}

parentPort?.on('message', (msg) => {
  if (msg.ws) test(msg.ws);
});
parentPort?.postMessage({ ready: true });
