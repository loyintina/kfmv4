/**
 * A1 阶段四 C 档验收（C1/C2/C3 实验台腿）：headless 真 UI 全链 ——
 * C1 默认（2026-09-04 拍板⑮=智谱 glm-5.3-flash）发一条短消息收真实流式
 * （截图含 R3 归位）；
 * C2 picker 两级下钻选 Kimi kimi-k2.7-code 同尺一条（双路方言覆盖不掉）；
 * C3 钩子读数打印（与 /tmp/nz-ai-chat.log 对拍由调用方做）。
 * 观测手段：Playwright 驱动真 bundle（8023 实服）+ __kfmNzAiChat() 钩 + 像素截图。
 */
import { launchBrowser } from './launch.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = join(process.cwd(), 'tests', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.setDefaultTimeout(60000);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() => !!window.__kfmNzAiChat, null, { timeout: 30000 });

const hook = () => page.evaluate(() => window.__kfmNzAiChat());
const shot = async (name) => {
  const p = join(OUT_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log('shot:', p);
};

// 打开 AI 页
await page.click('[data-kfm-aichat-orb]');
await page.waitForFunction(() => window.__kfmNzAiChat()?.page === 'AI_PAGE');
const h0 = await hook();
console.log('default run cfg btn =', await page.textContent('[data-aichat-model-btn]'));

async function sendAndWait(text, tag) {
  await page.fill('[data-aichat-input]', text);
  await page.click('[data-aichat-send]');
  await page.waitForFunction(() => window.__kfmNzAiChat()?.run?.phase === 'STREAMING', null, { timeout: 60000 })
    .catch(() => console.log(`[${tag}] warn: 未见 STREAMING（可能极快完成）`));
  // 流式中截图（R3/逐字上屏目击）
  await page.waitForTimeout(1200);
  await shot(`ai-chat-c-${tag}-streaming.png`);
  await page.waitForFunction(() => {
    const h = window.__kfmNzAiChat();
    return h && (!h.run || h.run.phase === 'IDLE');
  }, null, { timeout: 120000 });
  const h = await hook();
  const done = h.lastEvents.filter((e) => e.type === 'done').length;
  const deltas = h.lastEvents.filter((e) => e.type === 'content_block_delta').length;
  console.log(`[${tag}] hook:`, JSON.stringify({
    lastError: h.lastError, msgs: h.messages, doneEvents: done, deltaEvents: deltas,
    ringTail: h.lastEvents.slice(-3).map((e) => e.type),
  }));
  await shot(`ai-chat-c-${tag}-done.png`);
  return h;
}

// C1：默认（拍板⑮=智谱 glm-5.3-flash，不经 picker）
await sendAndWait('用一句话介绍你自己', 'c1-zhipu-default');

// C2：picker 两级路由（拍板⑫）下钻 Kimi → 选 kimi-for-coding-highspeed
// （⑮后 kimi-k2.7-code 不再是默认、不在 Kimi models 列表→picker 不可达，
// 这是拍板⑮明确接受的语义；Kimi 真通路腿走列表内 known-good 型号 §〇）
await page.click('[data-aichat-model-btn]');
await page.waitForSelector('[data-aichat-model-menu]');
await page.click('[data-aichat-provider-row="Kimi"]');
await page.waitForSelector('[data-aichat-model-row="Kimi::kimi-for-coding-highspeed"]');
await page.click('[data-aichat-model-row="Kimi::kimi-for-coding-highspeed"]');
await page.waitForFunction(() => window.__kfmNzAiChat()?.menu === 'CLOSED');
console.log('picker 切后 btn =', await page.textContent('[data-aichat-model-btn]'));
await sendAndWait('你好，一句话介绍自己', 'c2-kimi');

await browser.close();
console.log('=== C1/C2 实验台腿完成 ===');
