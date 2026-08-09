#!/usr/bin/env node
/**
 * browser-relay.mjs — 浏览器守视（2026-08-06 用户拍板，HUD 可视化自测基建）
 *
 * 职责：常驻一个 headless Chrome 实例，对外暴露 HTTP 控制面，让任何 agent
 * （kimi code / 其他 CLI agent / 未来 kfmv4 面板 agent）能用「跑命令 → 读 JSON
 * → 拿截图路径 → 读图」的套路亲眼看到页面并交互。UI 开发从「用户描述 → 猜」
 * 变成「改 → 自己看 → 再改」。
 *
 * 形态：单文件双角色——
 *   daemon：`node scripts/agent/browser-relay.mjs serve`（CLI 会自动拉起，一般不用手跑）
 *   CLI：   `node scripts/agent/browser-relay.mjs <cmd> [--k v ...]`，stdout 单行 JSON
 *
 * CLI 命令：
 *   open --url <u>            开标签页 → {tabId}
 *   shot [--tab N] [--full]   截图 → {path}（~/.kfmv4/browser-relay/shots/，留最新 50 张）
 *   click --tab N --sel <s>   点击 → 返回元素几何
 *   type  --tab N --sel <s> --text <t>
 *   eval  --tab N --js <e>    页面内求值 → {result}（须 JSON 可序列化）
 *   wait  --tab N [--sel s | --ms n]
 *   state [--tab N]           URL/标题/视口/标签清单
 *   close --tab N
 *   viewport                  当前生效视口（校准值或默认）
 *   stop                      关停 daemon
 *
 * 视口校准（用户拍板：必须和真机实测一致，不靠猜）：
 *   主入口 = kfmv4 服务端校准页——手机浏览器开 http://<服务器>/kfmv4/test（8021 常驻，
 *   经 nginx /kfmv4/ 代理），自动量 innerWidth/innerHeight/devicePixelRatio 回传存档
 *   （~/.kfmv4/browser-relay/viewport.json），此后新开标签一律用实测视口。
 *   本 daemon 的 /calibrate 仅作本机/LAN 备用入口。未校准前默认 400×812@2x。
 *
 * 长跑自洁（用户拍板：防泄露/防内存膨胀）：
 *   - 闲置 10 分钟自动退出（/health 不算活动），下次 CLI 调用自动拉起——平时零常驻成本
 *   - 标签上限 8，超出按 LRU 关最旧
 *   - 截图只留最新 50 张，老的自动删
 *   - 每次启动用全新临时 Chrome profile（禁磁盘缓存），退出即删
 *   - 上线 6 小时强制退休（兜底慢泄漏）
 *
 * 安全：控制面只认 127.0.0.1；/calibrate 对 LAN 开放（手机要访问）。
 * exit 0 = 成功；exit 2 = 失败（JSON 里带 error）。
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const DATA_DIR = join(homedir(), '.kfmv4', 'browser-relay');
const SHOTS_DIR = join(DATA_DIR, 'shots');
const VIEWPORT_PATH = join(DATA_DIR, 'viewport.json');
const PORT = 8033;
const IDLE_MS = 10 * 60 * 1000;      // 闲置退休
const MAX_UPTIME_MS = 6 * 3600_000;  // 强制退休兜底
const MAX_TABS = 8;
const MAX_SHOTS = 50;
const DEFAULT_VIEWPORT = { width: 400, height: 812, deviceScaleFactor: 2 };

mkdirSync(SHOTS_DIR, { recursive: true });

function loadViewport() {
  try {
    const v = JSON.parse(readFileSync(VIEWPORT_PATH, 'utf8'));
    if (v.width > 0 && v.height > 0) return { width: v.width, height: v.height, deviceScaleFactor: v.deviceScaleFactor || 2 };
  } catch {}
  return { ...DEFAULT_VIEWPORT };
}

function findChrome() {
  const base = join(homedir(), '.cache', 'puppeteer', 'chrome');
  const versions = existsSync(base) ? readdirSync(base).filter(d => d.startsWith('linux-')).sort() : [];
  for (let i = versions.length - 1; i >= 0; i--) {
    const p = join(base, versions[i], 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('未找到 puppeteer 缓存的 Chrome（~/.cache/puppeteer/chrome/linux-*）');
}

// ============================== daemon ==============================

async function serve() {
  const t0 = Date.now();
  let lastActive = Date.now();
  let chrome = null;          // { browser, profileDir }
  let nextTabId = 1;
  const tabs = new Map();     // id → { page, lastUsed }

  async function ensureChrome() {
    if (chrome && chrome.browser.connected) return;
    if (chrome) { try { await chrome.browser.close(); } catch {} rmSync(chrome.profileDir, { recursive: true, force: true }); }
    const profileDir = join(tmpdir(), `kfm-relay-profile-${process.pid}`);
    const browser = await puppeteer.launch({
      executablePath: findChrome(),
      headless: true,
      userDataDir: profileDir,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disk-cache-size=1',
             '--disable-application-cache', '--media-cache-size=1',
             // 后台防节流（2026-08-09：页面 hidden 时 rAF/定时器被暂停，
             // 徽标/星座图等 canvas 动画守视全部静默——强制后台照跑）
             '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
             '--disable-backgrounding-occluded-windows'],
    });
    browser.on('disconnected', () => { chrome = null; });
    chrome = { browser, profileDir };
  }

  function touchTab(id) {
    const t = tabs.get(id);
    if (t) t.lastUsed = Date.now();
    return t;
  }

  async function evictIfNeeded() {
    while (tabs.size >= MAX_TABS) {
      let oldestId = null, oldest = Infinity;
      for (const [id, t] of tabs) if (t.lastUsed < oldest) { oldest = t.lastUsed; oldestId = id; }
      try { await tabs.get(oldestId).page.close(); } catch {}
      tabs.delete(oldestId);
    }
  }

  function rotateShots() {
    try {
      const files = readdirSync(SHOTS_DIR).filter(f => f.startsWith('shot-') && f.endsWith('.png')).sort();
      for (let i = 0; i < files.length - MAX_SHOTS; i++) unlinkSync(join(SHOTS_DIR, files[i]));
    } catch {}
  }

  async function shutdown(code = 0) {
    if (chrome) { try { await chrome.browser.close(); } catch {} rmSync(chrome.profileDir, { recursive: true, force: true }); }
    process.exit(code);
  }

  // 闲置/超时退休（health 不算活动，防监控探活挡住退休）
  setInterval(() => {
    const now = Date.now();
    if (now - lastActive > IDLE_MS || now - t0 > MAX_UPTIME_MS) shutdown(0);
  }, 30_000).unref();
  process.on('SIGTERM', () => shutdown(0));
  process.on('SIGINT', () => shutdown(0));

  const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

  function readBody(req) {
    return new Promise((res, rej) => {
      let s = '';
      req.on('data', c => { s += c; if (s.length > 1e6) rej(new Error('body 过大')); });
      req.on('end', () => { try { res(s ? JSON.parse(s) : {}); } catch (e) { rej(e); } });
      req.on('error', rej);
    });
  }

  const CALIBRATE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>守视校准</title><body style="font:16px/2 monospace;background:#111;color:#eee;padding:24px">
<h3>守视 · 视口校准</h3><div id="m">测量中…</div>
<script>
const v = { width: window.innerWidth, height: window.innerHeight, deviceScaleFactor: window.devicePixelRatio, userAgent: navigator.userAgent };
fetch('/calibrate', { method: 'POST', body: JSON.stringify(v) }).then(r => r.json()).then(r => {
  document.getElementById('m').textContent = r.ok
    ? '已记录：' + r.viewport.width + '×' + r.viewport.height + ' @' + r.viewport.deviceScaleFactor + 'x（新开标签页生效）'
    : '记录失败：' + r.error;
});
</script>`;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (obj, code = 200) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    };
    try {
      // 校准页对 LAN 开放（手机访问），其余一律只认本机
      if (url.pathname === '/calibrate') {
        if (req.method === 'GET') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(CALIBRATE_HTML);
          return;
        }
        const b = await readBody(req);
        const w = Math.round(b.width), h = Math.round(b.height), d = Number(b.deviceScaleFactor) || 2;
        if (!(w >= 100 && w <= 2000 && h >= 100 && h <= 4000 && d > 0 && d <= 5)) return send({ ok: false, error: '视口数值不合理' }, 400);
        const viewport = { width: w, height: h, deviceScaleFactor: d, userAgent: String(b.userAgent || ''), updatedAt: new Date().toISOString() };
        writeFileSync(VIEWPORT_PATH, JSON.stringify(viewport, null, 2));
        return send({ ok: true, viewport });
      }
      if (!isLocal(req)) return send({ ok: false, error: '控制面只认 127.0.0.1' }, 403);

      if (url.pathname === '/health') {
        return send({ ok: true, uptime: Date.now() - t0, tabs: tabs.size, chrome: !!(chrome && chrome.browser.connected), viewport: loadViewport() });
      }
      lastActive = Date.now();
      const b = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams);

      if (url.pathname === '/stop') { send({ ok: true }); setTimeout(() => shutdown(0), 100); return; }

      await ensureChrome();

      if (url.pathname === '/open') {
        await evictIfNeeded();
        const page = await chrome.browser.newPage();
        await page.setViewport(loadViewport());
        if (b.url) await page.goto(String(b.url), { waitUntil: 'networkidle2', timeout: 30_000 });
        const tabId = nextTabId++;
        tabs.set(tabId, { page, lastUsed: Date.now() });
        return send({ ok: true, tabId, url: page.url() });
      }
      if (url.pathname === '/tabs') {
        const list = [];
        for (const [id, t] of tabs) list.push({ tabId: id, url: t.page.url() });
        return send({ ok: true, tabs: list });
      }

      const tab = touchTab(Number(b.tabId ?? b.tab));
      if (!tab) return send({ ok: false, error: 'tab 不存在（/tabs 看现役）' }, 404);
      const page = tab.page;

      if (url.pathname === '/shot') {
        rotateShots();
        const path = join(SHOTS_DIR, `shot-${Date.now()}-t${b.tabId ?? b.tab}.png`);
        await page.screenshot({ path, fullPage: !!b.full });
        return send({ ok: true, path });
      }
      if (url.pathname === '/click') {
        const el = await page.$(String(b.sel ?? b.selector));
        if (!el) return send({ ok: false, error: `选择器无命中：${b.sel ?? b.selector}` }, 404);
        const rect = await el.boundingBox();
        await el.click();
        return send({ ok: true, rect });
      }
      if (url.pathname === '/type') {
        await page.type(String(b.sel ?? b.selector), String(b.text ?? ''));
        return send({ ok: true });
      }
      if (url.pathname === '/eval') {
        // 强制页面可见再执行：headless 后台 tab 常被标 hidden，rAF/定时器停摆
        // 导致 canvas 动画静默（2026-08-09 星座图守视抓获）。CDP 覆盖 + args
        // 防节流双保险，对截图/交互无副作用。
        try {
          const cdp = await page.createCDPSession();
          await cdp.send('Emulation.setPageVisibilityStateOverride', { visibilityState: 'visible' });
          await cdp.detach();
        } catch { /* 老协议降级：忽略 */ }
        const result = await page.evaluate(String(b.js ?? ''));
        return send({ ok: true, result: result === undefined ? null : result });
      }
      if (url.pathname === '/wait') {
        if (b.sel || b.selector) await page.waitForSelector(String(b.sel ?? b.selector), { timeout: Number(b.ms) || 10_000 });
        else await new Promise(r => setTimeout(r, Number(b.ms) || 1000));
        return send({ ok: true });
      }
      if (url.pathname === '/goto') {
        await page.goto(String(b.url), { waitUntil: 'networkidle2', timeout: 30_000 });
        return send({ ok: true, url: page.url() });
      }
      if (url.pathname === '/close') {
        await page.close();
        tabs.delete(Number(b.tabId ?? b.tab));
        return send({ ok: true });
      }
      if (url.pathname === '/state') {
        return send({ ok: true, url: page.url(), title: await page.title(), viewport: page.viewport() });
      }
      return send({ ok: false, error: `未知端点：${url.pathname}` }, 404);
    } catch (e) {
      send({ ok: false, error: String(e && e.message || e) }, 500);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ ok: true, role: 'daemon', port: PORT, pid: process.pid }));
  });
}

// ============================== CLI ==============================

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    }
  }
  return flags;
}

async function api(path, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, body ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  return res.json();
}

async function ensureDaemon() {
  try { const h = await api('/health'); if (h.ok) return; } catch {}
  spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve'], { detached: true, stdio: 'ignore', cwd: REPO }).unref();
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    try { const h = await api('/health'); if (h.ok) return; } catch {}
  }
  throw new Error('daemon 拉起超时（10s）');
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const f = parseFlags(rest);
  const out = obj => { console.log(JSON.stringify(obj)); process.exit(obj.ok === false ? 2 : 0); };

  if (cmd === 'serve') return serve();
  if (!cmd) out({ ok: false, error: '用法：browser-relay.mjs <open|shot|click|type|eval|wait|goto|state|tabs|close|viewport|stop|serve> [--k v]' });
  if (cmd === 'viewport') out({ ok: true, viewport: loadViewport(), calibrated: existsSync(VIEWPORT_PATH) });

  await ensureDaemon();
  switch (cmd) {
    case 'open':  return out(await api('/open', { url: f.url }));
    case 'shot':  return out(await api('/shot', { tabId: f.tab, full: !!f.full }));
    case 'click': return out(await api('/click', { tabId: f.tab, sel: f.sel }));
    case 'type':  return out(await api('/type', { tabId: f.tab, sel: f.sel, text: f.text }));
    case 'eval':  return out(await api('/eval', { tabId: f.tab, js: f.js }));
    case 'wait':  return out(await api('/wait', { tabId: f.tab, sel: f.sel, ms: f.ms }));
    case 'goto':  return out(await api('/goto', { tabId: f.tab, url: f.url }));
    case 'state': return out(await api('/state', { tabId: f.tab }));
    case 'tabs':  return out(await api('/tabs', {}));
    case 'close': return out(await api('/close', { tabId: f.tab }));
    case 'stop':  return out(await api('/stop', {}));
    default: out({ ok: false, error: `未知命令：${cmd}` });
  }
}

main().catch(e => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e) })); process.exit(2); });
