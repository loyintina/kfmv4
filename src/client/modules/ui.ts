/**
 * KFM v4 - 中央页面 UI 控制（侧栏开关）
 *
 * 侧栏打开时显示一个空壳容器，树内容由 Canvas 版 tree-render 填充。
 * 光标、选中、手势等逻辑在侧栏重写时重新实现。
 */

import { onSidebarOpen, onSidebarClose } from './tree-render.js';
import { Registry } from './ui-registry.js';
import { KFMState } from './state.js';
import { wsChannel } from './ws-channel.js';
import { DOM } from "./dom-refs.js";
import { dismissFileActionBar } from './file-action-bar.js';

export function openSidebar(): void {
  DOM.sidebar?.classList.add('open');
  DOM.overlay?.classList.add('show');
  onSidebarOpen();
  KFMState.setSidebarOpen(true);
  // 不主动调 Registry.notifyStateChange('sidebar')：
  // KFMState.setSidebarOpen() → KFMState.notify() → ws-channel 自动推送 snapshot
}

export function closeSidebar(): void {
  dismissFileActionBar();
  DOM.sidebar?.classList.remove('open');
  DOM.overlay?.classList.remove('show');
  onSidebarClose();
  KFMState.setSidebarOpen(false);
  // 同上：KFMState.notify() 已覆盖推送
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
    effect: '打开后显示文件树，点击目录展开/折叠，左滑或点击遮罩关闭。AI 可发送 open-sidebar/close-sidebar/toggle-sidebar 命令操作',
    source: 'ui.ts',
  }, () => DOM.sidebar?.classList.contains('open') ? 'open' : 'closed');
  Registry.registerElement({
    id: 'overlay',
    type: 'button',
    label: '遮罩层',
    description: '侧栏打开时覆盖在主内容区的半透明遮罩，点击可关闭侧栏',
    state: 'hidden',
    enabled: true,
    effect: '点击关闭侧栏',
    source: 'ui.ts',
  }, () => DOM.overlay?.classList.contains('show') ? 'visible' : 'hidden');
  // 注册 AI 指令处理器（openSidebar/closeSidebar 内部已触发 KFMState.notify，
  // 无需额外调 Registry.notifyStateChange）
  wsChannel.onCommand('open-sidebar', () => { openSidebar(); });

  wsChannel.onCommand('close-sidebar', () => { closeSidebar(); });
  wsChannel.onCommand('toggle-sidebar', () => {
    if (DOM.sidebar?.classList.contains('open')) { closeSidebar(); } else { openSidebar(); }
  });
}
