/**
 * file-action-bar.ts — 文件行长按 → 底部抽屉操作栏
 *
 * Phase 7 §③：遮罩 + 侧栏底部抽屉 + 5 项渐变边框行。
 * 边框技法与 orb.ts 聊天气泡一致（padding-box/border-box）。
 */

import { DOM } from './dom-refs.js';
import { anim } from './animation-registry.js';
import { gestures } from './gesture-registry.js';
import { L } from './renderer-lifecycle.js';
import { API, KFMState, getFileRowData } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { moveCursorTo } from './canvas-cursor.js';

// ========== 状态 ==========

let _dimmer: HTMLElement | null = null;
let _drawer: HTMLElement | null = null;
let _pressedRow: HTMLElement | null = null;
let _targetPath: string | null = null;
let _renaming = false;
const _copiedPaths = new Set<string>();

const ITEMS: { id: string; label: string; disabled?: boolean }[] = [
  { id: 'rename', label: '\u91CD\u547D\u540D' },
  { id: 'copy-path', label: '\u590D\u5236\u8DEF\u5F84' },
  { id: 'delete', label: '\u5220\u9664' },
  { id: 'new-folder', label: '\u65B0\u5EFA\u6587\u4EF6\u5939' },
  { id: 'new-file', label: '\u65B0\u5EFA\u6587\u4EF6' },
];

const ITEM_H = 38;
const GAP = 8;
const SIDE_MARGIN = 12;

// 渐变——与 orb.ts panelBorderGradient 同体系
const ROW_GRAD = 'linear-gradient(135deg,rgba(0,212,255,0.7),rgba(124,58,237,0.5))';
const ROW_BG = 'linear-gradient(rgba(18,18,26,0.92),rgba(18,18,26,0.92)) padding-box,' + ROW_GRAD + ' border-box';
const DRAWER_GRAD = 'linear-gradient(135deg,rgba(0,212,255,0.4),rgba(99,102,241,0.35),rgba(124,58,237,0.35))';
const DRAWER_BG = 'linear-gradient(rgba(18,18,26,0.92),rgba(18,18,26,0.92)) padding-box,' + DRAWER_GRAD + ' border-box';
const ROW_GRAD_PRESS = 'linear-gradient(135deg,rgba(0,212,255,1),rgba(124,58,237,0.8))';
const ROW_BG_PRESS = 'linear-gradient(rgba(18,18,26,0.92),rgba(18,18,26,0.92)) padding-box,' + ROW_GRAD_PRESS + ' border-box';

// ========== 区域手势拦截（一次性注册） ==========

let _zoneRegistered = false;

function _ensureZone(): void {
  if (_zoneRegistered) return;
  _zoneRegistered = true;
  gestures.register({
    id: 'action-bar-zone',
    targetFilter: (target) =>
      !!(_dimmer?.contains(target as HTMLElement) || _drawer?.contains(target as HTMLElement)),
    condition: () => isFileActionBarOpen(),
    priority: 70,
    stopPropagation: { start: true },
    onStart(e) {
      const target = e.target as HTMLElement;
      const row = target.closest<HTMLElement>('[data-action-row]');
      if (row) {
        _pressedRow = row;
        row.style.background = ROW_BG_PRESS;
      }
    },
    onEnd(e) {
      // 恢复行高亮
      if (_pressedRow) {
        _pressedRow.style.background = ROW_BG;
        _pressedRow = null;
      }
      // 点击遮罩（不在抽屉内）→ 关闭
      const target = e.target as HTMLElement;
      if (_dimmer?.contains(target) && !_drawer?.contains(target)) {
        dismissFileActionBar();
      }
    },
  });
}

// ========== 公开 API ==========

export function showFileActionBar(path: string): void {
  if (_drawer) return;
  _targetPath = path;
  _ensureZone();
  _createDimmer();
  _createDrawer();
}

export function dismissFileActionBar(): void {
  if (!_dimmer && !_drawer) return;
  _targetPath = null;
  _copiedPaths.clear();
  const d = _dimmer;
  const w = _drawer;
  _dimmer = null;
  _drawer = null;
  anim.to([d, w], {
    opacity: 0, y: '100%', duration: 0.2, ease: 'power2.in',
    onComplete() { d?.remove(); w?.remove(); },
  });
}

export function isFileActionBarOpen(): boolean {
  return _drawer !== null;
}

export function isRenaming(): boolean {
  return _renaming;
}

// ========== 内部构建 ==========

function _createDimmer(): void {
  _dimmer = document.createElement('div');
  _dimmer.style.cssText = [
    'position:fixed', 'inset:0',
    'z-index:1005',
    'background:rgba(0,0,0,0.45)',
    'pointer-events:auto',
  ].join(';');
  document.body.appendChild(_dimmer);
  anim.fromTo(_dimmer, { opacity: 0 }, { opacity: 1, duration: 0.2 });
}

function _createDrawer(): void {
  const sidebar = DOM.sidebar;
  if (!sidebar) return;
  const rect = sidebar.getBoundingClientRect();
  // 侧栏内容区 = 侧栏高 - 底栏 52px；抽屉 44% 伸到文件树中央
  const contentH = Math.max(rect.height - 52, 300);
  const rowsH = ITEMS.length * ITEM_H + (ITEMS.length - 1) * GAP;
  const totalH = Math.round(contentH * 0.46);
  const topPad = 16;

  _drawer = document.createElement('div');
  _drawer.style.cssText = [
    'position:fixed',
    'left:' + rect.left + 'px',
    'width:' + rect.width + 'px',
    'bottom:0',
    'z-index:1006',
    'background:' + DRAWER_BG,
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    'border-radius:16px 16px 0 0',
    'border:1px solid transparent',
    'height:' + totalH + 'px',
    'padding-top:' + topPad + 'px',
    'pointer-events:auto',
  ].join(';');

  ITEMS.forEach((item, i) => {
    const row = document.createElement('div');
    row.setAttribute('data-action-row', item.id);
    const isLast = i === ITEMS.length - 1;
    row.style.cssText = [
      'height:' + ITEM_H + 'px',
      'margin:0 ' + SIDE_MARGIN + 'px ' + (isLast ? '0' : GAP + 'px') + ' ' + SIDE_MARGIN + 'px',
      'padding:0 14px',
      'background:' + ROW_BG,
      'border:1px solid transparent',
      'border-left-width:3px',
      'border-radius:8px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'font-size:14px',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:rgba(224,224,240,0.85)',
      'cursor:pointer',
      'pointer-events:' + (item.disabled ? 'none' : 'auto'),
      'user-select:none',
      '-webkit-user-select:none',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = item.label;
    row.appendChild(label);

    // ✓ 占位（仅 copy-path）
    if (item.id === 'copy-path') {
      const check = document.createElement('span');
      check.id = 'act-chk-copy-path';
      check.style.cssText = 'color:#4ade80;font-size:16px;display:none';
      check.textContent = '\u2713';
      row.appendChild(check);
    }

    // click 监听（仅非 disabled）
    if (!item.disabled) {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.id === 'rename') _renameFile();
        else if (item.id === 'copy-path') _copyPath();
        else if (item.id === 'delete') _deleteFile();
        else if (item.id === 'new-folder') _createFolder();
        else if (item.id === 'new-file') _createFile();
      });
    }

    _drawer!.appendChild(row);
  });

  document.body.appendChild(_drawer!);
  anim.fromTo(_drawer, { y: '100%' }, { y: '0%', duration: 0.3, ease: 'power3.out' });
}

// ========== 操作处理 ==========

function _copyPath(): void {
  if (!_targetPath) return;
  navigator.clipboard.writeText(_targetPath).catch(() => {});
  _copiedPaths.add(_targetPath);
  const check = document.getElementById('act-chk-copy-path');
  if (check) check.style.display = 'inline';
}

function _renameFile(): void {
  if (!_targetPath) return;
  const p = _targetPath;
  dismissFileActionBar();
  _startRename(p);
}

/** 重命名核心：不负责 dismiss drawer、不负责修改 _targetPath。 */
function _startRename(targetPath: string): void {
  const p = targetPath;

  const root = L.renderer?.getRoot();
  const canvas = L.renderer?.canvas ?? DOM.treeCanvas;
  if (!root || !canvas) return;

  let rowBox: import('../engine/v2/box.js').Box | null = null;
  for (const r of L._rowIndex) {
    const d = getFileRowData(r.data);
    if (d?.path === p) { rowBox = r; break; }
  }
  if (!rowBox) return;

  const label = rowBox.children.find(c => c.id?.startsWith('label-'));
  if (!label) return;

  const origContent = (label.textStyle as unknown as { content?: string })?.content ?? '';
  label.textStyle = { ...label.textStyle, content: '' };

  _renaming = true;

  const abs = rowBox.getAbsolutePosition();
  const scrollY = root.scrollY ?? 0;
  const _origScrollY = scrollY;
  const rect = canvas.getBoundingClientRect();
  const INPUT_H = 18;
  const textX = rect.left + abs.x + (label.x || 0);
  const textW = Math.max(label.width || (rowBox.width - (label.x || 0) - 16), 60);
  const textH = INPUT_H;

  const _canvas = canvas;
  const _root = root;

  function _computeTextY(): string {
    const r2 = _canvas.getBoundingClientRect();
    const sy = _root.scrollY ?? 0;
    return (r2.top + abs.y - sy + (rowBox!.height - INPUT_H) / 2).toFixed(1);
  }

  let textY = _computeTextY();

  const viewH = window.innerHeight;
  const rowTop = rect.top + abs.y - scrollY;
  if (rowTop + rowBox.height > viewH * 0.6) {
    const offset = rowTop - viewH * 0.18;
    const maxY = root.getMaxScroll().maxY;
    const target = (root.scrollY ?? 0) + offset;
    if (target > maxY) root.scrollPaddingBottom = target - maxY;
    root.scrollY = Math.max(0, target);
    textY = _computeTextY();
  }

  const selStyle = document.createElement('style');
  selStyle.id = 'kfm-rename-selection';
  selStyle.textContent = '.kfm-rename-input::selection{background:rgba(0,212,255,0.35);color:#fff}.kfm-rename-input::-moz-selection{background:rgba(0,212,255,0.35);color:#fff}';
  document.head.appendChild(selStyle);

  const parts = p.replace(/\\/g, '/').split('/');
  const oldName = parts[parts.length - 1] || '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'kfm-rename-input';
  input.value = oldName;
  input.style.cssText = [
    'position:fixed',
    'left:' + textX + 'px',
    'top:' + textY + 'px',
    'width:' + textW + 'px',
    'height:' + textH + 'px',
    'z-index:1007',
    'background:transparent',
    'border:none',
    'outline:none',
    'font-size:13px',
    'font-family:system-ui,sans-serif',
    'line-height:1.2',
    'color:#e0e0e0',
    'caret-color:#e0e0e0',
    'padding:0',
  ].join(';');
  document.body.appendChild(input);
  input.focus();
  input.select();

  let _keyboardWasOpen = false;
  function _onViewportChange() {
    const vv = window.visualViewport;
    if (!vv) return;
    const closed = Math.abs(vv.height - window.innerHeight) < 10;
    if (_keyboardWasOpen && closed) {
      _root.scrollPaddingBottom = 0;
      _root.scrollY = Math.min(_origScrollY, _root.getMaxScroll().maxY);
      input.style.top = _computeTextY() + 'px';
      requestAnimationFrame(() => { if (document.activeElement === input) input.blur(); });
    } else if (!closed) {
      _keyboardWasOpen = true;
      input.style.top = _computeTextY() + 'px';
    }
  }
  window.visualViewport?.addEventListener('resize', _onViewportChange);

  const _label = label;
  const _origContent = origContent;

  function _cleanup() {
    _renaming = false;
    const mx = _root.getMaxScroll().maxY - (_root.scrollPaddingBottom ?? 0);
    _root.scrollY = Math.min(_root.scrollY, mx);
    _root.scrollPaddingBottom = 0;
    window.visualViewport?.removeEventListener('resize', _onViewportChange);
    selStyle.remove();
    _label.textStyle = { ..._label.textStyle, content: _origContent };
  }

  async function submit() {
    const newName = input.value.trim();
    input.remove();
    _cleanup();
    if (!newName || newName === oldName) return;
    try {
      await fetch(API + '/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: p, newName }),
      });
      loadFileTree(KFMState.currentRoot);
    } catch { /* swallow */ }
  }

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.addEventListener('blur', submit);
}

async function _createFolder(): Promise<void> {
  if (!_targetPath) return;
  const source = _targetPath;
  const isDir = KFMState.files[source]?.isDir ?? false;
  // 策略 B：长按文件夹 → 在其内部创建 / 长按文件 → 在同级目录创建
  const parentDir = isDir ? source : source.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
  dismissFileActionBar();
  try {
    const res = await fetch(API + '/files/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentDir }),
    });
    const data = await res.json();
    if (!data.success || !data.path) return;
    loadFileTree(KFMState.currentRoot);
    requestAnimationFrame(() => {
      for (const r of L._rowIndex) {
        const d = getFileRowData(r.data);
        if (d?.path === data.path) {
          moveCursorTo(r);
          _startRename(data.path);
          return;
        }
      }
      // fallback：树重建后没找到行也直接开 rename
      _startRename(data.path);
    });
  } catch { /* swallow */ }
}

async function _createFile(): Promise<void> {
  if (!_targetPath) return;
  const source = _targetPath;
  const isDir = KFMState.files[source]?.isDir ?? false;
  const parentDir = isDir ? source : source.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
  dismissFileActionBar();
  try {
    const res = await fetch(API + '/files/create-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentDir }),
    });
    const data = await res.json();
    if (!data.success || !data.path) return;
    loadFileTree(KFMState.currentRoot);
    requestAnimationFrame(() => {
      for (const r of L._rowIndex) {
        const d = getFileRowData(r.data);
        if (d?.path === data.path) {
          moveCursorTo(r);
          _startRename(data.path);
          return;
        }
      }
      _startRename(data.path);
    });
  } catch { /* swallow */ }
}

async function _deleteFile(): Promise<void> {
  if (!_targetPath) return;
  const p = _targetPath;
  dismissFileActionBar();
  try {
    await fetch(API + '/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p }),
    });
    loadFileTree(KFMState.currentRoot);
  } catch { /* swallow */ }
}
