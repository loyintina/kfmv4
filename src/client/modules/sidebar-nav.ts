/**
 * sidebar-nav.ts — 侧栏导航栏
 *
 * 位于文件树 Canvas 下方，显示当前目录名。
 * 点击目录名弹出兄弟目录选择器，支持上下层级跳转。
 */
import { KFMState } from './state.js';
import { currentTheme as theme } from './theme.js';
import { DOM } from "./dom-refs.js";
import { gestures } from './gesture-registry.js';

// ========== 状态 ==========
let _navEl: HTMLElement | null = null;
let _popupEl: HTMLElement | null = null;
let _popupParentPath = '';
let _popupItems: { name: string; path: string; isDir: boolean }[] = [];
let _cursorIdx = -1;
let _stateUnsub: (() => void) | null = null;
let _gestureUnreg: (() => void) | null = null;

// ========== 路径工具 ==========

/** 路径最后一段作为显示名 */
function _displayName(path: string): string {
  if (path === '.' || path === '') return '\u9879\u76EE\u6839';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/** 父目录路径 */
function _parentPath(path: string): string | null {
  if (path === '.' || path === '' || !path.includes('/')) return null;
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '.';
}

/** 第一个子目录路径（用于 ▼ 按钮导航） */
function _firstChildPath(path: string): string | null {
  const node = KFMState.files[path];
  if (!node?.children) return null;
  const dirs = node.children.filter(c => c.isDir);
  return dirs.length > 0 ? dirs[0].path : null;
}

// ========== 导航栏 DOM ==========

export function createSidebarNav(): void {
  if (_navEl) return;

  const label = document.createElement('span');
  label.className = 'sidebar-nav-label';
  _refreshLabel(label);
  label.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_popupEl) { _closePopup(); return; }
    _openPopup();
  });

  // 插入到 toggleHiddenBtn 和 closeSidebarBtn 之间
  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  const closeBtn = DOM.closeSidebarBtn;
  if (tools && closeBtn) {
    tools.insertBefore(label, closeBtn);
  }
  _navEl = label;

  KFMState.subscribe(_onStateChange);
  _stateUnsub = () => KFMState.unsubscribe(_onStateChange);
}

export function destroySidebarNav(): void {
  _closePopup();
  if (_stateUnsub) { _stateUnsub(); _stateUnsub = null; }
  if (_navEl) { _navEl.remove(); _navEl = null; }
}

function _onStateChange(): void {
  if (!_navEl) return;
  const label = _navEl.querySelector('.sidebar-nav-label');
  if (label) _refreshLabel(label as HTMLElement);
}

function _refreshLabel(el: HTMLElement): void {
  const path = KFMState.activePath || '.';
  el.textContent = _displayName(path);
}

// ========== 弹出面板 ==========

function _openPopup(): void {
  if (_popupEl) return;

  const activePath = KFMState.activePath || '.';
  _popupParentPath = _parentPath(activePath) ?? '';

  const parentNode = KFMState.files[_popupParentPath || '.'];
  const allItems = parentNode?.children ?? KFMState.files['.']?.children ?? [];
  _popupItems = allItems
    .filter(c => KFMState.showHidden || !c.name.startsWith('.'))
    .map(c => ({ name: c.name, path: c.path, isDir: c.isDir }));

  _cursorIdx = _popupItems.findIndex(c => c.path === activePath);
  if (_cursorIdx === -1 && _popupItems.length > 0) _cursorIdx = 0;

  _renderPopup();
  _registerGestureLock();
}

function _closePopup(): void {
  if (!_popupEl) return;
  if (_gestureUnreg) { _gestureUnreg(); _gestureUnreg = null; }
  _popupEl.remove();
  _popupEl = null;
  _popupItems = [];
}

function _renderPopup(): void {
  if (_popupEl) _popupEl.remove();

  const popup = document.createElement('div');
  popup.className = 'sidebar-nav-popup';
  popup.addEventListener('pointerdown', e => e.stopPropagation());

  const header = document.createElement('div');
  header.className = 'sidebar-nav-popup-header';
  const parentDisplay = _popupParentPath ? _displayName(_popupParentPath) : '\u9879\u76EE\u6839';
  header.innerHTML = '<span class="sidebar-nav-popup-parent">' + parentDisplay + '</span>';
  popup.appendChild(header);

  const list = document.createElement('div');
  list.className = 'sidebar-nav-popup-list';
  if (_popupItems.length === 0) {
    list.innerHTML = '<div class="sidebar-nav-popup-empty">(\u7A7A)</div>';
  } else {
    for (let i = 0; i < _popupItems.length; i++) {
      const item = _popupItems[i];
      const row = document.createElement('div');
      row.className = 'sidebar-nav-popup-item' + (i === _cursorIdx ? ' active' : '') + (item.isDir ? '' : ' file');
      row.dataset.index = String(i);
      row.textContent = item.name;
      row.addEventListener('click', () => _navigateTo(item.path));
      row.addEventListener('pointerenter', () => { _cursorIdx = i; _updatePopupCursor(); });
      list.appendChild(row);
    }
  }
  popup.appendChild(list);
  const footer = document.createElement('div');
  footer.className = 'sidebar-nav-popup-footer';
  const upBtn = document.createElement('button');
  upBtn.className = 'sidebar-nav-btn';
  upBtn.innerHTML = '\u25B2 ' + (_popupParentPath ? _displayName(_popupParentPath) : '');
  upBtn.title = '\u4E0A\u5C42\u76EE\u5F55';
  upBtn.disabled = !_popupParentPath;
  upBtn.addEventListener('click', (e) => { e.stopPropagation(); _navToUpLevel(); });
  footer.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.className = 'sidebar-nav-btn';
  const firstChild = _firstChildPath(KFMState.activePath || '.');
  downBtn.innerHTML = '\u25BC ' + (firstChild ? _displayName(firstChild) : '');
  downBtn.title = '\u4E0B\u5C42\u76EE\u5F55';
  downBtn.disabled = !firstChild;
  downBtn.addEventListener('click', (e) => { e.stopPropagation(); _navToDownLevel(); });
  footer.appendChild(downBtn);

  popup.appendChild(footer);

  document.body.appendChild(popup);
  _popupEl = popup;
}

function _updatePopupCursor(): void {
  if (!_popupEl) return;
  const items = _popupEl.querySelectorAll('.sidebar-nav-popup-item');
  items.forEach((el, i) => {
    el.classList.toggle('active', i === _cursorIdx);
  });
}

function _navigateTo(path: string): void {
  const activePath = KFMState.activePath || '.';
  if (path === activePath) { _closePopup(); return; }

  KFMState.setExpanded(path, true);
  if (activePath !== '.' && activePath !== path) {
    KFMState.setExpanded(activePath, false);
  }
  KFMState.setActivePath(path);
  _closePopup();
}


function _navToUpLevel(): void {
  if (!_popupParentPath) return;
  const cur = KFMState.activePath || '.';
  KFMState.setExpanded(_popupParentPath, true);
  if (cur !== '.' && cur !== _popupParentPath) KFMState.setExpanded(cur, false);
  KFMState.setActivePath(_popupParentPath);
  _closePopup();
}

function _navToDownLevel(): void {
  const cur = KFMState.activePath || '.';
  const child = _firstChildPath(cur);
  if (!child) return;
  KFMState.setExpanded(child, true);
  KFMState.setExpanded(cur, true);
  KFMState.setActivePath(child);
  _closePopup();
}

// ========== 手势锁 ==========

function _registerGestureLock(): void {
  if (_gestureUnreg) return;
  _gestureUnreg = gestures.register({
    id: 'sidebar-nav-lock',
    targetFilter: () => true,
    condition: () => !!_popupEl,
    priority: 110,
    stopPropagation: true,
    onStart: (e) => {
      if (_popupEl && !_popupEl.contains(e.target as Node)) {
        _closePopup();
      }
    },
  });
}
