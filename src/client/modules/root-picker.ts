/**
 * root-picker.ts — 文件树根目录切换器
 *
 * 位于侧栏工具栏中央，显示当前文件树的根目录名称。
 * 点击弹出目录选择器，可从 /root 下逐级浏览并选择任意文件夹作为文件树新根。
 *
 * 设计原则：
 * - 不操作 overlay/动画系统，不调 setExpanded
 * - 切换根时先清 expandedPaths，再调 loadFileTree 完整重建
 * - 只有文件夹可供选择
 */
import { KFMState, type FileNode } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { DOM } from './dom-refs.js';
import { API } from './state.js';
import { L } from './renderer-lifecycle.js';

// ========== 常量 ==========
const SAFE_ROOT = '/root';
const PICKER_H = 280; // 选择器面板高度（px）

// ========== 状态 ==========
let _labelEl: HTMLElement | null = null;
let _panelEl: HTMLElement | null = null;
let _currentPath = SAFE_ROOT;
let _stateUnsub: (() => void) | null = null;

// ========== 路径工具 ==========

function _displayName(path: string): string {
  if (path === '.' || path === SAFE_ROOT) return '项目根';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function _parentPath(path: string): string | null {
  if (path === '.' || path === SAFE_ROOT) return null;
  return path.split('/').slice(0, -1).join('/') || '.';
}

// ========== API 调用 ==========

interface DirItem { name: string; path: string; isDir: boolean; }

async function _fetchDirs(dirPath: string): Promise<DirItem[]> {
  try {
    const res = await fetch(API + '/files/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath }),
    });
    const data = await res.json();
    if (data.error) return [];
    // 只返回文件夹，过滤掉文件
    return (data.items || []).filter((item: DirItem) => item.isDir);
  } catch {
    return [];
  }
}

// ========== 标签 DOM ==========

export function createRootPicker(): void {
  if (_labelEl) return;

  const label = document.createElement('span');
  label.className = 'root-picker-label';
  label.textContent = _displayName(SAFE_ROOT);
  label.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_panelEl) { _closePanel(); return; }
    _openPanel();
  });

  // 插入到 toggleHiddenBtn 和 closeSidebarBtn 之间
  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  const closeBtn = DOM.closeSidebarBtn;
  if (tools && closeBtn) {
    tools.insertBefore(label, closeBtn);
  }
  _labelEl = label;
}

export function destroyRootPicker(): void {
  _closePanel();
  if (_stateUnsub) { _stateUnsub(); _stateUnsub = null; }
  if (_labelEl) { _labelEl.remove(); _labelEl = null; }
}

// ========== 选择器面板 ==========

async function _openPanel(): Promise<void> {
  if (_panelEl) return;

  _currentPath = SAFE_ROOT;

  // 创建遮罩
  const overlay = document.createElement('div');
  overlay.className = 'root-picker-overlay';

  // 创建面板
  const panel = document.createElement('div');
  panel.className = 'root-picker-panel';

  // 头部 — 当前路径
  const header = document.createElement('div');
  header.className = 'root-picker-header';
  header.textContent = SAFE_ROOT;
  panel.appendChild(header);

  // 列表容器
  const list = document.createElement('div');
  list.className = 'root-picker-list';
  panel.appendChild(list);

  // 底部 — 确认按钮
  const footer = document.createElement('div');
  footer.className = 'root-picker-footer';
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'root-picker-confirm';
  confirmBtn.textContent = '✅ 选此目录作为文件树';
  confirmBtn.disabled = true;
  confirmBtn.addEventListener('click', _doConfirm);
  footer.appendChild(confirmBtn);
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  _panelEl = panel;

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) _closePanel();
  });

  // 加载初始列表
  await _refreshList(list, header, confirmBtn, SAFE_ROOT);
}

function _closePanel(): void {
  if (!_panelEl) return;
  const overlay = _panelEl.parentElement;
  if (overlay) overlay.remove();
  _panelEl = null;
}

async function _refreshList(
  listEl: HTMLElement,
  headerEl: HTMLElement,
  confirmBtn: HTMLButtonElement,
  dirPath: string,
): Promise<void> {
  headerEl.textContent = dirPath;
  _currentPath = dirPath;
  confirmBtn.disabled = false;

  // 清空列表
  listEl.innerHTML = '';

  // ".." 上级（不能超过 SAFE_ROOT）
  const parent = _parentPath(dirPath);
  if (parent) {
    const upRow = document.createElement('div');
    upRow.className = 'root-picker-item';
    upRow.innerHTML = '<span class="picker-item-icon" style="opacity:0.5">📂</span> <span>..</span>';
    upRow.addEventListener('click', () => {
      _refreshList(listEl, headerEl, confirmBtn, parent);
    });
    listEl.appendChild(upRow);
  }

  // 加载子目录
  const dirs = await _fetchDirs(dirPath);
  if (dirs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'root-picker-empty';
    empty.textContent = '（无子文件夹）';
    listEl.appendChild(empty);
  } else {
    for (const dir of dirs) {
      const row = document.createElement('div');
      row.className = 'root-picker-item';
      row.dataset.path = dir.path;
      row.innerHTML = `<span class="picker-item-icon">📂</span> <span>${dir.name}</span>`;

      // 左键点击 → 进入该目录
      row.addEventListener('click', () => {
        _refreshList(listEl, headerEl, confirmBtn, dir.path);
      });

      listEl.appendChild(row);
    }
  }
}

// ========== 确认切换 ==========

async function _doConfirm(): Promise<void> {
  // 动画中不允许切换
  if (L.isAnimating) return;

  // 清空旧的展开状态
  KFMState.expandedPaths = {};
  localStorage.setItem('expandedPaths', '{}');

  _closePanel();

  // 重建文件树
  await loadFileTree(_currentPath);

  // 更新标签文字
  if (_labelEl) {
    _labelEl.textContent = _displayName(_currentPath);
  }
}
