/**
 * KFM v4 客户端入口
 * 所有模块从此处导入，由 esbuild 打包为单个 bundle.js
 */

// 全局状态（挂在 window 上供跨模块访问）
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
    renderTree: (container?: HTMLElement, path?: string, depth?: number) => Promise<void>;
    refreshTree: () => void;
    toggleHidden: () => void;
    rlog: (msg: string) => void;
    executeCursorAction: () => Promise<void>;
    updateCursorHighlight: (immediate?: boolean) => void;
    updateSidebarPath: (item: HTMLElement | null) => void;
    isNodeExpanded: (item: HTMLElement) => boolean;
    centerCursorToView: (item: HTMLElement, smooth?: boolean) => void;
  }
}

import { initApp } from './modules/app.js';
import { initTree } from './modules/tree.js';
import { initUI } from './modules/ui.js';
import { initGestures } from './modules/gestures.js';
import { initOrb } from './modules/orb.js';

initApp();
initTree();
initUI();
initGestures();
initOrb();
