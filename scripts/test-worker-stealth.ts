import { parentPort } from 'node:worker_threads';
import puppeteer from 'puppeteer-core';
import { applyStealthPatches, applyViewport, DEFAULT_VIEWPORT } from '../src/server/ai/tools/omp/browser/launch.ts';

parentPort?.on('message', async (msg) => {
  if (!msg.ws) return;
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: msg.ws, defaultViewport: null });
    const page = await browser.newPage();
    
    // Apply stealth patches (like #init does)
    await applyStealthPatches(browser, page, { browserSession: null, override: null });
    await applyViewport(page, DEFAULT_VIEWPORT);
    
    await page.goto('https://example.com');
    
    const t = await page.title();
    parentPort?.postMessage({ title: t });
    
    await page.close();
    browser.disconnect();
    parentPort?.postMessage({ done: true });
  } catch (err) {
    parentPort?.postMessage({ error: (err as Error).message, stack: (err as Error).stack?.slice(0, 300) });
  }
});
parentPort?.postMessage({ ready: true });
