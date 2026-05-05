/**
 * KFM v4 - 中央页面 UI 控制（侧栏开关）
 *
 * 侧栏打开时显示一个空壳容器，树内容由 Canvas 版 tree-render 填充。
 * 光标、选中、手势等逻辑在侧栏重写时重新实现。
 */

let sidebarContent: HTMLElement | null = null;

import { onSidebarOpen, onSidebarClose } from './tree-render.js';

export function openSidebar(): void {
  DOM.sidebar?.classList.add('open');
  DOM.overlay?.classList.add('show');
  onSidebarOpen();
}

import { DOM } from "./dom-refs.js";

export function closeSidebar(): void {
  DOM.sidebar?.classList.remove('open');
  DOM.overlay?.classList.remove('show');
  onSidebarClose();
}

export function initUI(): void {
  window.openSidebar = openSidebar;
  window.closeSidebar = closeSidebar;

  // 保留 executeCursorAction 作为空壳
  window.executeCursorAction = async function() {};

  // overlay 点击关侧栏
  DOM.overlay?.addEventListener('click', () => {
    closeSidebar();
  });
}