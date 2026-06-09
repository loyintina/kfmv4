import { KFMState, API } from './state.js';
import { DOM } from "./dom-refs.js";
import { openCardStack, closeCardStack, isCardStackOpen } from './card-stack.js';
import { openSidebar, closeSidebar } from './ui.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
/**
 * KFM v4 - 全局状态与初始化
 */


// ========== Toast ==========
export function showToast(msg: string): void {
  const toast = DOM.operationToast;
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  Registry.notifyStateChange('operation-toast');
  setTimeout(() => {
    toast.classList.remove('show');
    Registry.notifyStateChange('operation-toast');
  }, 2000);
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
  // AI 指令处理器：显式切换隐藏文件（绕过通用 click 的坐标问题）
  wsChannel.onCommand('toggle-hidden-files', () => {
    KFMState.toggleHidden();
  });

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

  // ========== UI Element Registry 注册 ==========

  // 使用 registerElement() 便捷方法：一步完成 register + registerStateGetter
  Registry.registerElement({
    id: 'sidebar-toggle-btn',
    type: 'button',
    label: '侧栏开关',
    description: '打开/关闭左侧文件树侧栏',
    state: DOM.sidebar?.classList.contains('open') ? 'open' : 'closed',
    enabled: true,
    effect: '点击切换侧栏打开/关闭状态',
    source: 'app.ts',
  }, () => DOM.sidebar?.classList.contains('open') ? 'open' : 'closed');
  Registry.registerElement({
    id: 'card-stack-toggle-btn',
    type: 'button',
    label: '卡片堆开关',
    description: '打开/关闭堆叠卡片面板',
    state: 'closed',
    enabled: true,
    effect: '点击切换卡片堆打开/关闭状态',
    source: 'app.ts',
  }, () => isCardStackOpen() ? 'open' : 'closed');
  Registry.registerElement({
    id: 'close-sidebar-btn',
    type: 'button',
    label: '关闭侧栏',
    description: '关闭左侧文件树侧栏',
    state: 'visible',
    enabled: true,
    effect: '点击关闭侧栏',
    source: 'app.ts',
  }, () => DOM.sidebar?.classList.contains('open') ? 'visible' : 'hidden');
  Registry.registerElement({
    id: 'eye-btn',
    type: 'button',
    label: '显示隐藏文件',
    description: '切换是否显示隐藏文件（以 . 开头的文件/目录）',
    state: 'inactive',
    enabled: true,
    effect: '点击切换隐藏文件的显示状态',
    source: 'app.ts',
  }, () => KFMState.showHidden ? 'active' : 'inactive');
  Registry.registerElement({
    id: 'input-bar',
    type: 'text-input',
    label: 'AI 输入栏',
    description: '底部常驻输入栏，输入文字后点击发送或按 Enter 发送给 AI',
    state: 'visible',
    enabled: true,
    effect: '输入文字后点击发送或按 Enter 发送给 AI',
    source: 'app.ts',
  }, () => {
    const el = DOM.aiInputBar;
    // 通过 offsetParent 检测显隐（支持 CSS class 或祖先节点隐藏）
    return el && el.offsetParent !== null ? 'visible' : 'hidden';
  });
Registry.registerElement({
    id: 'operation-toast',
    type: 'icon',
    label: '操作提示',
    description: '短暂显示操作结果的浮动提示',
    state: 'hidden',
    enabled: true,
    effect: '操作完成后自动显示 2 秒后消失',
    source: 'app.ts',
  }, () => DOM.operationToast?.classList.contains('show') ? 'visible' : 'hidden');
  Registry.registerElement({
    id: 'ai-send-btn',
    type: 'button',
    label: '发送按钮',
    description: '发送输入栏中的文字给 AI',
    state: 'visible',
    enabled: true,
    effect: '点击后发送输入框中的文本给 AI 处理',
    source: 'app.ts',
  }, () => {
    const el = DOM.aiInputBar;
    return el && el.offsetParent !== null ? 'visible' : 'hidden';
  });

}
