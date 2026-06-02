/**
 * KFM v4 - 中央页面 UI 控制（侧栏开关）
 *
 * 侧栏打开时显示一个空壳容器，树内容由 Canvas 版 tree-render 填充。
 * 光标、选中、手势等逻辑在侧栏重写时重新实现。
 */

let sidebarContent: HTMLElement | null = null;

import { onSidebarOpen, onSidebarClose } from './tree-render.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';

export function openSidebar(): void {
  DOM.sidebar?.classList.add('open');
  DOM.overlay?.classList.add('show');
  onSidebarOpen();
  Registry.notifyStateChange('sidebar');
}

import { DOM } from "./dom-refs.js";

export function closeSidebar(): void {
  DOM.sidebar?.classList.remove('open');
  DOM.overlay?.classList.remove('show');
  onSidebarClose();
  Registry.notifyStateChange('sidebar');
}

export function initUI(): void {
  // openSidebar / closeSidebar 已通过 import 在 app.ts 中使用

  // overlay 点击关侧栏
  DOM.overlay?.addEventListener('click', () => {
    closeSidebar();
  });

  // 注册 UI 元素
  Registry.registerElement({
    id: 'sidebar',
    type: 'panel',
    label: '文件树侧栏',
    description: '左侧文件浏览面板，显示当前目录的文件树和工具栏',
    state: 'closed',
    enabled: true,
    effect: '打开后显示文件树，点击目录展开/折叠，左滑或点击遮罩关闭',
    source: 'ui.ts',
  }, () => DOM.sidebar?.classList.contains('open') ? 'open' : 'closed');

  // 注册 AI 指令处理器
  wsChannel.onCommand('open-sidebar', () => { openSidebar(); Registry.notifyStateChange('sidebar'); });
  wsChannel.onCommand('close-sidebar', () => { closeSidebar(); Registry.notifyStateChange('sidebar'); });
  wsChannel.onCommand('toggle-sidebar', () => {
    if (DOM.sidebar?.classList.contains('open')) { closeSidebar(); } else { openSidebar(); }
    Registry.notifyStateChange('sidebar');
  });
}
