/**
 * version-watch.ts — 版本横幅：本页 bundle 与服务端 buildTime 不一致时挂醒目横幅。
 *
 * 旧包验证病灶（kfmv4.0 起反复出现：修复后用户验证的是旧包 →「反复修反复没效果」）
 * 的浏览器侧终极兜底。agent 侧的强制在 check-deploy-freshness.mjs（链红门禁），
 * 但就算那层被绕过，用户验证的那一刻，页面自己会报警——不依赖任何 agent 的记性。
 *
 * 机制：build.mjs 用 esbuild define 把 buildTime 烙进 bundle（KFM_BUILD_TIME），
 * 服务端 /api/system/info 暴露运行进程的 buildTime（BAR-BUILD-05 版本握手）。
 * 两者不等 = 本页是旧包。加载时 + 每 60s 轮询一次，报警一次（不刷屏）。
 */

import { API } from './state.js';
import { Z } from './z-index-layers.js';
import { log } from './logger.js';

// esbuild define 注入（build.mjs）；非打包环境（测试/直跑）下 undefined → 整个模块静默
declare const KFM_BUILD_TIME: string | undefined;
const BUNDLE_TIME = typeof KFM_BUILD_TIME === 'undefined' ? '' : KFM_BUILD_TIME;

let _bannerShown = false;

function _fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function _showBanner(serverTime: string): void {
  _bannerShown = true;
  const el = document.createElement('div');
  el.className = 'version-banner';
  el.textContent = `⚠ 代码已更新（本页 ${_fmt(BUNDLE_TIME)} → 服务端 ${_fmt(serverTime)}），点击硬刷新`;
  el.style.cssText = `position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:${Z.VERSION_BANNER};`
    + 'background:#b45309;color:#fff;padding:6px 14px;font-size:12px;border-radius:0 0 8px 8px;'
    + 'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap';
  el.title = '服务端已部署更新版本的代码，当前页面是旧包。\n在旧包上验证修复会得到假阴性——点击刷新（或 Ctrl+Shift+R）。';
  el.onclick = () => location.reload();
  document.body.appendChild(el);
  log(`[version-watch] 检测到旧包：本页 ${BUNDLE_TIME} ≠ 服务端 ${serverTime}`);
}

async function _checkVersion(): Promise<void> {
  if (!BUNDLE_TIME || _bannerShown) return;
  try {
    const res = await fetch(API + '/system/info');
    const data = await res.json() as { buildInfo?: { buildTime?: string } };
    const serverTime = data?.buildInfo?.buildTime || '';
    if (serverTime && serverTime !== BUNDLE_TIME) _showBanner(serverTime);
  } catch { /* 网络失败忽略，下轮再试 */ }
}

/** 初始化版本监视（main.ts 调用一次） */
export function initVersionWatch(): void {
  if (!BUNDLE_TIME) return; // 非打包环境无注入，静默
  _checkVersion();
  setInterval(_checkVersion, 60_000);
}
