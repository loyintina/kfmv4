/**
 * file-action-bar.ts — 文件行长按 → 底部抽屉操作栏
 *
 * 长按文件树某行 500ms，页面变暗，侧栏底部滑出操作列表。
 * 提供：重命名、复制路径、删除、新建文件夹（占位）、新建文件（占位）。
 */

import { Box } from '../engine/v2/box.js';
import { L } from './renderer-lifecycle.js';
import { DOM } from './dom-refs.js';
import { anim } from './animation-registry.js';
import { API, getFileRowData } from './state.js';
import { forceRebuildTree } from './tree-render.js';

// ========== 状态 ==========

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

// ========== 公开 API ==========

export function showFileActionBar(path: string): void {
  if (_drawer) return;
  _targetPath = path;

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

  const sidebarW = DOM.sidebar?.getBoundingClientRect().width ?? 295;
  const left = window.innerWidth - sidebarW;

  _drawer = document.createElement('div');
  _drawer.style.cssText = [
    'position:fixed',
    'left:' + left + 'px',
    'right:-12px',
    'bottom:0',
    'z-index:1006',
    'background:rgba(18,18,26,0.92)',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    'border-radius:16px 16px 0 0',
    'border:1px solid rgba(0,212,255,0.2)',
    'pointer-events:auto',
  ].join(';');

  const itemH = 44;
  const pad = 12;
  const totalH = ITEMS.length * itemH + pad * 2;
  _drawer.style.height = totalH + 'px';
  _drawer.style.padding = pad + 'px 0';

  ITEMS.forEach((item, i) => {
    const row = document.createElement('div');
    row.style.cssText = [
      'height:' + itemH + 'px',
      'padding:0 20px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'font-size:14px',
      'font-family:system-ui,-apple-system,sans-serif',
      'color:' + (item.disabled ? 'rgba(224,224,240,0.35)' : 'rgba(224,224,240,0.85)'),
      'cursor:pointer',
      'pointer-events:' + (item.disabled ? 'none' : 'auto'),
      'user-select:none',
      '-webkit-user-select:none',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = item.label;
    row.appendChild(label);

    const check = document.createElement('span');
    check.id = 'act-chk-' + item.id;
    check.style.cssText = 'color:#4ade80;font-size:16px;display:none';
    check.textContent = '\u2713';
    row.appendChild(check);

    if (!item.disabled) {
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

export function dismissFileActionBar(): void {
  if (!_dimmer && !_drawer) return;
  const d = _dimmer;
  const w = _drawer;
  _dimmer = null;
  _drawer = null;
  _targetPath = null;
  anim.to([d, w], {
    opacity: 0, y: '100%', duration: 0.2, ease: 'power2.in',
    onComplete() { d?.remove(); w?.remove(); },
  });
}

export function isFileActionBarOpen(): boolean {
  return _drawer !== null;
}

// ========== 内部操作 ==========

async function _handleAction(actionId: string): Promise<void> {
  switch (actionId) {
    case 'rename':
      _renameFile();
      break;
    case 'copy-path':
      _copyPath();
      break;
    case 'delete':
      _deleteFile();
      break;
  }
}

function _renameFile(): void {
  if (!_targetPath) return;
  dismissFileActionBar();

  // 找到目标行 Box
  const root = L.renderer?.getRoot();
  if (!root || !L.cursorBox?.data) return;
  const box = _findRowBox(root);
  if (!box) return;

  // 获取当前名称
  const parts = _targetPath.replace(/\\/g, '/').split('/');
  const oldName = parts[parts.length - 1] || '';
  const dir = parts.slice(0, -1).join('/');

  // 定位行
  const abs = box.getAbsolutePosition();
  const canvas = L.renderer?.canvas ?? DOM.treeCanvas;
  const left = canvas?.getBoundingClientRect().left ?? 0;
  const scrollY = root.scrollY ?? 0;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.style.cssText = [
    'position:fixed',
    'left:' + (left + abs.x) + 'px',
    'top:' + (abs.y - scrollY + 2) + 'px',
    'width:' + Math.max(box.width - 20, 80) + 'px',
    'height:' + (box.height - 4) + 'px',
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
    if (!newName || newName === oldName) return;
    try {
      const res = await fetch(API + '/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: _targetPath, newName }),
      });
      if (res.ok) {
        forceRebuildTree();
      }
    } catch { /* swallow */ }
  }

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.addEventListener('blur', submit);
}

function _copyPath(): void {
  if (!_targetPath) return;
  navigator.clipboard.writeText(_targetPath).catch(() => {});
  _copiedPaths.add(_targetPath);
  // 更新抽屉内 ✓ 显示
  const check = document.getElementById('act-chk-copy-path');
  if (check) check.style.display = 'inline';
}

async function _deleteFile(): Promise<void> {
  if (!_targetPath) return;
  dismissFileActionBar();
  try {
    await fetch(API + '/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [_targetPath] }),
    });
    forceRebuildTree();
  } catch { /* swallow */ }
}

// ========== 行查找 ==========

function _findRowBox(root: Box): Box | null {
  if (!_targetPath) return null;
  for (const row of L._rowIndex) {
    const d = getFileRowData(row.data);
    if (d && d.path === _targetPath) return row;
  }
  return null;
}
