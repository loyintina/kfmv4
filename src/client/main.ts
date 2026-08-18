/**
 * KFM v4 客户端入口 — 中央页面版
 *
 * 左栏文件树已彻底删除，后续用 Canvas + kfmv3 v2 引擎重建。
 * 当前保留：光球面板、AI输入栏、日志系统、侧栏容器（空壳）。
 * 堆叠卡片面板：右侧边缘左滑唤出。
 */
// 9.0 L0 内核：Cordis 根总线必须是第一个副作用 import（总线出生点，
// 接线六点①，8.7.1）——总线先于一切 v8 init 出生
import { rootCtx, bootLog, ctxChurn, bootCtxSelfTest } from './ctx.js';
import { KFMState, API } from './modules/state.js';
import { markAppReady } from './modules/app-lifecycle.js';

declare global {
  interface Window {
    // ===== 调试/跨模块访问 =====
    KFMState: import('./modules/state.js').KFMStateType;
  }
}

import { initApp } from './modules/app.js';
import { initUI } from './modules/ui.js';
import { initGestures } from './modules/gestures.js';
import { initTreeRenderer } from './modules/tree-render.js';
import { initOrb } from './modules/orb.js';
import { loadFileTree, initLazyLoader } from './modules/tree-loader.js';
import { initCardStack } from './modules/card-stack.js';
import { initFloatingCards } from './modules/floating-card.js';
import { gestures } from './modules/gesture-registry.js';
import { Registry } from './modules/ui-registry.js';
import { initWsChannel } from './modules/ws-channel.js';
import { initVersionWatch } from './modules/version-watch.js';
import { initObsHud } from './modules/obs-hud.js';
import './modules/sibling-switcher.js';
import './cards/registry.js';

// ========== 调试桥：暴露关键模块到 window 供 browser_eval / debug 工具查询 ==========
// esbuild 将所有模块打包在 IIFE 闭包中，内部变量对 window 不可见。
// 这里显式暴露元数据访问接口，让 debug 工具的 5 个 kfmv4 专属视图能读取运行时状态。
import { L } from './modules/renderer-lifecycle.js';
import { cardRegistry } from './modules/card-registry.js';
import { anim } from './modules/animation-registry.js';

(window as unknown as Record<string, unknown>).__kfmDebug = { // escape-ok: 调试桥暴露内部模块到 window 供 browser_eval 调试
  KFMState,
  L,
  anim,
  cardRegistry,
  gestureRegistry: gestures,
  // 9.0 L0 内核挂调试桥（不新增顶层暴露，随调试桥 8.12.5 统一删）：
  // rootCtx 供守视直读 fiber 状态，ctxChurn 供 in-situ 泄漏实测
  ctx: { rootCtx, bootLog, ctxChurn },
};
// 额外暴露顶层引用，供 kfmv4-views.ts 的 JS 注入脚本通过 window.__L / window.__anim 等直接访问
(window as unknown as Record<string, unknown>).__L = L; // escape-ok: debug视图脚本需要
(window as unknown as Record<string, unknown>).__anim = anim; // escape-ok: debug视图脚本需要
(window as unknown as Record<string, unknown>).__cardRegistry = cardRegistry; // escape-ok: debug视图脚本需要
(window as unknown as Record<string, unknown>).__gestureRegistry = gestures; // escape-ok: debug视图脚本需要
(window as unknown as Record<string, unknown>).KFMState = KFMState; // escape-ok: debug视图脚本需要 window.KFMState

// 全局未捕获错误 → 调试卡
import { log } from './modules/logger.js';
// 客户端错误直报（2026-08-05 幽灵卡片堆排查装）：console 之外同步上报服务端落盘
// ~/.kfmv4/logs/client-errors.jsonl——手机端无 devtools，异常不能靠猜
function reportClientError(source: string, message: string, stack?: string): void {
  try {
    const apiBase = location.pathname.startsWith('/kfmv4/') ? '/kfmv4/api/' : '/api/';
    fetch(apiBase + 'client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, message: String(message).slice(0, 2000), stack: (stack || '').slice(0, 4000), ua: navigator.userAgent }),
      keepalive: true,
    }).catch(() => { /* 上报失败静默 */ });
  } catch { /* 上报通道自身不得炸 */ }
}
window.addEventListener('error', e => {
  log('GLOBAL error: ' + (e.error?.message || e.message) + ' ' + (e.error?.stack || e.filename + ':' + e.lineno));
  reportClientError('onerror', e.error?.message || e.message, e.error?.stack || `${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', e => {
  log('GLOBAL unhandled: ' + (e.reason?.message || String(e.reason)));
  reportClientError('unhandledrejection', e.reason?.message || String(e.reason), e.reason?.stack);
});

// 9.0 L0 内核自测：注册/注入/注销/清理全链（8.7.1 验收面）——异步不阻塞
// v8 init，结果落 bootLog（调试桥 __kfmDebug.ctx.bootLog 可读）
void bootCtxSelfTest();

gestures.init();
initApp();
initUI();
initGestures();
initOrb();
initTreeRenderer();
initCardStack();
initFloatingCards();
// 同步初始化全部完成——手势/卡片堆可安全消费（2026-08-10 竞态修复：
// initGestures 早于 initCardStack，READY 前手势忽略召唤，防刷新中触摸竞态）
markAppReady();


// ========== 注册能力层 ==========
// （空）能力注册面是「AI 之手」预留基础设施：ui-registry.registerCapability /
// ws-channel capabilities 推送 / page-state「你能做什么」段落管道保留，
// 但具体能力注册在 AI 之手落地前一律不加——无执行面的注册会误导 AI
// （ADR-004 追加裁决，2026-07-29：原 file-search/file-read/file-write 幽灵注册已删）。

// ========== 初始化 WebSocket 通道 ==========
// 在所有 Registry 注册完成后初始化，建立服务端↔浏览器端双向通信
initWsChannel();

// 版本监视：本页 bundle 与服务端 buildTime 不一致时挂旧包报警横幅
initVersionWatch();
initObsHud();

// 加载根目录：先与服务端同步 activeRoot（服务重启后重建状态），再加载文件树
async function establishRoot(): Promise<string> {
  const stored = localStorage.getItem('kfmv4_currentRoot');
  if (stored && stored.startsWith('/')) {
    try {
      const res = await fetch(API + '/root/switch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: stored }),
      });
      const data = await res.json();
      if (data?.success) return data.root;
    } catch { /* fall through */ }
  }
  try {
    const res = await fetch(API + '/root/current');
    const data = await res.json();
    if (data?.root) { localStorage.setItem('kfmv4_currentRoot', data.root); return data.root; }
  } catch { /* use stored */ }
  return stored || '.';
}

establishRoot().then(root => {
  KFMState.currentRoot = root;
  return loadFileTree(root);
}).then(() => {
  initLazyLoader();
}).catch(e => console.error('[main] loadFileTree failed:', e));