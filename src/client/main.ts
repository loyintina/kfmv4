/**
 * KFM v4 客户端入口 — 中央页面版
 *
 * 左栏文件树已彻底删除，后续用 Canvas + kfmv3 v2 引擎重建。
 * 当前保留：光球面板、AI输入栏、日志系统、侧栏容器（空壳）。
 * 堆叠卡片面板：右侧边缘左滑唤出。
 */
import { KFMState } from './modules/state.js';

declare global {
  interface Window {
    // ===== 应用全局接口 =====
    API: string;
    selectedFile: string;
    expandedPaths: Record<string, boolean>;
    showHidden: boolean;
    showToast: (msg: string) => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    executeCursorAction: () => Promise<void>;
    // ===== 调试/跨模块访问 =====
    KFMState: import('./modules/state.js').KFMStateType;
  }
}

import { initApp } from './modules/app.js';
import { initUI } from './modules/ui.js';
import { initGestures } from './modules/gestures.js';
import { initOrbCard } from './modules/orb-card.js';
import { initTreeRenderer } from './modules/tree-render.js';
import { loadFileTree, initLazyLoader } from './modules/tree-loader.js';
import { initCardStack } from './modules/card-stack.js';
import { initFloatingCards } from './modules/floating-card.js';
import { gestures } from './modules/gesture-registry.js';
import { Registry } from './modules/ui-registry.js';
import { initWsChannel } from './modules/ws-channel.js';

// 全局未捕获错误 → 调试卡
import { log } from './modules/logger.js';
window.addEventListener('error', e => log('GLOBAL error: ' + (e.error?.message || e.message) + ' ' + (e.error?.stack || e.filename + ':' + e.lineno)));
window.addEventListener('unhandledrejection', e => log('GLOBAL unhandled: ' + (e.reason?.message || String(e.reason))));

gestures.init();
initApp();
initUI();
initGestures();
initTreeRenderer();
initCardStack();
initOrbCard();
initFloatingCards();
// entry 字段与 capability-executor.ts 中的 id 保持一致，指向实际执行入口
Registry.registerCapability({
  id: 'file-search',
  name: '文件搜索',
  description: '在当前目录下搜索文件名匹配的文件',
  parameters: [{ name: 'pattern', type: 'string' }],
  entry: 'capability-executor:file-search',
});
Registry.registerCapability({
  id: 'file-read',
  name: '读取文件',
  description: '读取指定路径的文件内容',
  parameters: [{ name: 'path', type: 'string' }],
  entry: 'capability-executor:file-read',
});
Registry.registerCapability({
  id: 'file-write',
  name: '写入文件',
  description: '写入内容到指定路径的文件（可追加）',
  parameters: [
    { name: 'path', type: 'string' },
    { name: 'content', type: 'string' },
    { name: 'append', type: 'boolean' },
  ],
  entry: 'capability-executor:file-write',
});

// ========== 初始化 WebSocket 通道 ==========
// 在所有 Registry 注册完成后初始化，建立服务端↔浏览器端双向通信
initWsChannel();

// 加载根目录（使用持久化的 currentRoot），然后启用懒加载
loadFileTree(KFMState.currentRoot).then(() => {
  initLazyLoader();
}).catch(e => console.error('[main] loadFileTree failed:', e));
