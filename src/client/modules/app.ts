import { KFMState } from './state.js';
import { DOM } from "./dom-refs.js";
import { openCardStack, closeCardStack, isCardStackOpen } from './card-stack.js';
/**
 * KFM v4 - 全局状态与初始化
 */

export const API = '/kfmv4/api';

// ========== Toast ==========
export function showToast(msg: string): void {
  const toast = DOM.operationToast;
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 2000);
}

// ========== 暴露到 window ==========
function exposeGlobals(): void {
  window.API = API;
  window.KFMState = KFMState;
  window.selectedFile = KFMState.selectedFile;
  window.expandedPaths = KFMState.expandedPaths;
  Object.defineProperty(window, 'showHidden', { get: () => KFMState.showHidden, configurable: true });
  window.showToast = showToast;
}

export async function initApp(): Promise<void> {
  exposeGlobals();

  // AI输入栏跟随键盘平滑移动
  const bar = DOM.aiInputBar;
  if (bar && (window as any).visualViewport) {
    const vv = (window as any).visualViewport;
    const onResize = () => {
      const kh = window.innerHeight - vv.height;
      bar.style.bottom = kh + 'px';
    };
    vv.addEventListener('resize', onResize);
    onResize();
  }

  // 眼睛按钮：显示/隐藏隐藏文件
  const eyeBtn = DOM.toggleHiddenBtn;
  if (eyeBtn) {
    eyeBtn.addEventListener('click', () => {
      KFMState.toggleHidden();
      eyeBtn.classList.toggle('active');
    });
  }

  // 关闭侧栏按钮
  const closeBtn = DOM.closeSidebarBtn;
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.closeSidebar?.();
    });
  }

  // 侧栏召唤按钮
  const toggleBtn = DOM.sidebarToggleBtn;
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = DOM.sidebar;
      if (sidebar) {
        if (sidebar.classList.contains('open')) {
          window.closeSidebar?.();
        } else {
          window.openSidebar?.();
        }
      }
    });
  }

  // 卡片堆召唤按钮
  const cardBtn = DOM.cardStackToggleBtn;
  if (cardBtn) {
    cardBtn.addEventListener('click', () => {
      if (isCardStackOpen()) {
        closeCardStack();
        cardBtn.classList.remove('active');
      } else {
        openCardStack();
        cardBtn.classList.add('active');
      }
    });
  }

  // AI输入框自动高度
  const aiInput = DOM.aiInput;
  if (aiInput) {
    aiInput.addEventListener('input', () => {
      aiInput.style.height = 'auto';
      const newHeight = Math.min(aiInput.scrollHeight, 120);
      aiInput.style.height = newHeight + 'px';
    });
  }
}
