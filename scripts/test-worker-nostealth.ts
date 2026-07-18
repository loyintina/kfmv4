import { parentPort } from 'node:worker_threads';
import puppeteer from 'puppeteer-core';
import { applyViewport, DEFAULT_VIEWPORT } from '../src/server/ai/tools/omp/browser/launch.ts';

parentPort?.on('message', async (msg) => {
  if (!msg.ws) return;
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: msg.ws, defaultViewport: null });
    const page = await browser.newPage();
    
    // NO stealth patches
    await applyViewport(page, DEFAULT_VIEWPORT);
    
    await page.goto('https://example.com');
    
    const t = await page.title();
    parentPort?.postMessage({ title: t });
    
    await page.close();
    browser.disconnect();
    parentPort?.postMessage({ done: true });
  } catch (err) {
    parentPort?.postMessage({ error: (err as Error).message });
  }
});
parentPort?.postMessage({ ready: true });
