import { KFMState, API } from './state.js';
import { DOM } from "./dom-refs.js";
import { openCardStack, closeCardStack, isCardStackOpen } from './card-stack.js';
import { openSidebar, closeSidebar } from './ui.js';
/**
 * KFM v4 - 全局状态与初始化
 */


// ========== Toast ==========
export function showToast(msg: string): void {
  const toast = DOM.operationToast;
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 2000);
}

export async function initApp(): Promise<void> {

  // AI输入栏跟随键盘平滑移动
  const bar = DOM.aiInputBar;
  if (bar && window.visualViewport) {
    const vv = window.visualViewport;
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
      closeSidebar();
    });
  }

  // 侧栏召唤按钮
  const toggleBtn = DOM.sidebarToggleBtn;
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = DOM.sidebar;
      if (sidebar) {
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
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
