/**
 * KFM v4 客户端入口 — 中央页面版
 *
 * 左栏文件树已彻底删除，后续用 Canvas + kfmv3 v2 引擎重建。
 * 当前保留：光球面板、AI输入栏、日志系统、侧栏容器（空壳）。
 */
import { KFMState } from './modules/state.js';

declare global {
  interface Window {
    API: string;
    selectedFile: string;
    expandedPaths: Record<string, boolean>;
    showHidden: boolean;
    showToast: (msg: string) => void;
    addLog: (msg: string, type?: string) => void;
    openLogPanel: () => void;
    closeLogPanel: () => void;
    clearLogs: () => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    rlog: (msg: string) => void;
    executeCursorAction: () => Promise<void>;
  }
}

import { initApp } from './modules/app.js';
import { initUI } from './modules/ui.js';
import { initGestures } from './modules/gestures.js';
import { initOrb } from './modules/orb.js';

initApp();
initUI();
initGestures();
initOrb();
