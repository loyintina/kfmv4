/**
 * file-action-bar.ts — 文件行长按 → 底部抽屉操作栏
 *
 * Phase 7：长按文件行 500ms → 全页变暗 → 侧栏底部滑出操作列表。
 * 提供：重命名、复制路径、删除、新建文件夹（占位）、新建文件（占位）。
 *
 * 与 canvas-scroll.ts 联动：longPressMs:500 → onLongPress → showFileActionBar(path)
 * 与 ui.ts 联动：closeSidebar() → dismissFileActionBar()
 */

import { L } from './renderer-lifecycle.js';
import { DOM } from './dom-refs.js';
import { anim } from './animation-registry.js';
import { API, getFileRowData } from './state.js';
import { forceRebuildTree } from './tree-render.js';

// ========== 模块状态 ==========

let _dimmer: HTMLElement | null = null;
let _drawer: HTMLElement | null = null;
let _targetPath: string | null = null;
let _copiedPaths: Set<string> = new Set();

const ITEMS: { id: string; label: string; disabled?: boolean }[] = [
  { id: 'rename', label: '重命名' },
  { id: 'copy-path', label: '复制路径' },
  { id: 'delete', label: '删除' },
  { id: 'new-folder', label: '新建文件夹', disabled: true },
  { id: 'new-file', label: '新建文件', disabled: true },
];

const ITEM_H = 44;
const DRAWER_PAD = 12;
const DRAWER_H = ITEMS.length * ITEM_H + DRAWER_PAD * 2;

// ========== 公开 API ==========

export function showFileActionBar(path: string): void {
  if (_drawer) return;
  _targetPath = path;

  _createDimmer();
  _createDrawer();
}

export function dismissFileActionBar(): void {
  if (!_dimmer && !_drawer) return;
  const d = _dimmer;
  const w = _drawer;
  _dimmer = null;
  _drawer = null;
  _targetPath = null;
  // √ 随关闭重置（再次打开时重新计算）
  if (w) {
    const checks = w.querySelectorAll('[id^="act-chk-"]');
    checks.forEach(el => (el as HTMLElement).style.display = 'none');
  }
  anim.to([d, w], {
    opacity: 0, y: '100%', duration: 0.2, ease: 'power2.in',
    onComplete() { d?.remove(); w?.remove(); },
  });
}

export function isFileActionBarOpen(): boolean {
  return _drawer !== null;
}

// ========== DOM 构建 ==========

function _createDimmer(): void {
  _dimmer = document.createElement('div');
  _dimmer.style.cssText = [
    'position:fixed', 'inset:0',
    'z-index:1005',
    'background:rgba(0,0,0,0.45)',
    'pointer-events:auto',
  ].join(';');
  _dimmer.addEventListener('click', dismissFileActionBar);
  document.body.appendChild(_dimmer);
  anim.fromTo(_dimmer, { opacity: 0 }, { opacity: 1, duration: 0.2 });
}

function _createDrawer(): void {
  const sidebarW = DOM.sidebar?.getBoundingClientRect().width ?? 295;
  const left = window.innerWidth - sidebarW - 12;

  _drawer = document.createElement('div');
  _drawer.style.cssText = [
    'position:fixed',
    'left:' + left + 'px',
    'right:0',
    'bottom:0',
    'z-index:1006',
    'background:rgba(18,18,26,0.92)',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    'border-radius:16px 16px 0 0',
    'border:1px solid rgba(0,212,255,0.2)',
    'height:' + DRAWER_H + 'px',
    'padding:' + DRAWER_PAD + 'px 0',
    'pointer-events:auto',
  ].join(';');

  ITEMS.forEach((item, i) => {
    const row = document.createElement('div');
    const isDisabled = item.disabled;
    row.style.cssText = [
      'height:' + ITEM_H + 'px',
      'padding:0 20px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'font-size:14px',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:' + (isDisabled ? 'rgba(224,224,240,0.35)' : 'rgba(224,224,240,0.85)'),
      'cursor:' + (isDisabled ? 'default' : 'pointer'),
      'pointer-events:' + (isDisabled ? 'none' : 'auto'),
      'user-select:none',
      '-webkit-user-select:none',
    ].join(';');
    if (i > 0) row.style.borderTop = '1px solid rgba(255,255,255,0.06)';
    if (i === 0) row.style.borderTop = 'none';

    const label = document.createElement('span');
    label.textContent = item.label;
    row.appendChild(label);

    const check = document.createElement('span');
    check.id = 'act-chk-' + item.id;
    check.style.cssText = 'color:#4ade80;font-size:16px;display:none';
    check.textContent = '\u2713';
    row.appendChild(check);

    if (!isDisabled) {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        _handleAction(item.id);
      });
    }
    _drawer!.appendChild(row);
  });

  document.body.appendChild(_drawer!);
  anim.fromTo(_drawer, { y: '100%' }, { y: '0%', duration: 0.3, ease: 'power3.out' });
}

// ========== 操作处理 ==========

async function _handleAction(id: string): Promise<void> {
  switch (id) {
    case 'rename':
      _renameFile();
      break;
    case 'copy-path':
      _copyPath();
      break;
    case 'delete':
      await _deleteFile();
      break;
  }
}

function _renameFile(): void {
  if (!_targetPath) return;
  dismissFileActionBar();

  const root = L.renderer?.getRoot();
  const canvas = L.renderer?.canvas ?? DOM.treeCanvas;
  if (!root || !canvas) return;

  const parts = _targetPath.replace(/\\/g, '/').split('/');
  const oldName = parts[parts.length - 1] || '';

  // 在 _rowIndex 中找到目标行 Box
  let targetBox = null;
  for (const row of L._rowIndex) {
    const d = getFileRowData(row.data);
    if (d && d.path === _targetPath) { targetBox = row; break; }
  }
  if (!targetBox) return;

  let abs: { x: number; y: number };
  try { abs = targetBox.getAbsolutePosition(); } catch { return; }
  const scrollY = root.scrollY ?? 0;
  const canvasRect = canvas.getBoundingClientRect();
  const screenX = canvasRect.left + abs.x;
  const screenY = canvasRect.top + abs.y - scrollY;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = [
    'position:fixed',
    'left:' + screenX + 'px',
    'top:' + (screenY + 2) + 'px',
    'width:' + Math.max(targetBox.width - 20, 80) + 'px',
    'height:' + (targetBox.height - 4) + 'px',
    'z-index:1007',
    'background:rgba(10,10,15,0.85)',
    'border:1px solid rgba(0,212,255,0.4)',
    'border-radius:4px',
    'color:#e0e0e0',
    'font-size:12px',
    'font-family:system-ui,-apple-system,sans-serif',
    'padding:0 8px',
    'outline:none',
  ].join(';');
  document.body.appendChild(input);
  input.focus();
  input.select();

  async function submit() {
    const newName = input.value.trim();
    input.remove();
    if (!newName || newName === oldName || !_targetPath) return;
    try {
      const res = await fetch(API + '/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: _targetPath, newName }),
      });
      if (res.ok) forceRebuildTree();
    } catch { /* swallow */ }
  }

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.addEventListener('blur', submit);
}

function _copyPath(): void {
  if (!_targetPath) return;
  navigator.clipboard.writeText(_targetPath).catch(() => {});
  _copiedPaths.add(_targetPath);
  const check = document.getElementById('act-chk-copy-path');
  if (check) check.style.display = 'inline';
}

async function _deleteFile(): Promise<void> {
  if (!_targetPath) return;
  const p = _targetPath;
  dismissFileActionBar();
  try {
    await fetch(API + '/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [p] }),
    });
    forceRebuildTree();
  } catch { /* swallow */ }
}
