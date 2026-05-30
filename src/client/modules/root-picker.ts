/**
 * root-picker.ts — 文件树根目录切换器（Renderer 替换模式）
 *
 * 打开时替换 L.renderer 指向 picker 的 Canvas，光标系统自动对齐。
 * 展开/折叠由 picker 内部处理（无 overlay 动画）。
 * 确认时恢复 L.renderer，loadFileTree 重建主树。
 */
import { KFMState, type FileNode, getFileRowData } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { buildTree, type TreeOptions } from './tree-model.js';
import { DOM } from './dom-refs.js';
import { API } from './state.js';
import { Renderer } from '../engine/v2/renderer.js';
import { Box } from '../engine/v2/box.js';
import { LINE_HEIGHT } from './style-registry.js';
import { L } from './renderer-lifecycle.js';
import { _rebuildRowIndex, getRootScrollY } from './canvas-utils.js';
import { ensureCursorBox, moveCursorTo } from './canvas-cursor.js';
import { bindWheelEvents } from './canvas-scroll.js';

const BASE_PATH = '.';
const HEADER_H = LINE_HEIGHT + 8;

interface DirItem { name: string; path: string; isDir: boolean; }
interface ListResult { resolvedPath: string; items: DirItem[]; }

let _labelEl: HTMLElement | null = null;
let _renderer: Renderer | null = null;
let _container: HTMLElement | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _pickerExpanded: Record<string, boolean> = {};
let _currentPath = BASE_PATH;
let _currentResolved = '';
let _cachedDirs: DirItem[] = [];
let _cursorIdx = 0;
let _contentH = 0;

let _savedFiles: Record<string, any> = {};
let _savedRenderer: Renderer | null = null;
let _savedRowIdx: Box[] = [];

function _displayName(resolved: string): string {
  const parts = resolved.split('/').filter(Boolean);
  return parts.pop() || '';
}

async function _fetchDirs(dirPath: string): Promise<ListResult | null> {
  try {
    const res = await fetch(API + '/files/list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath }),
    });
    const data = await res.json();
    if (data.error) return null;
    return { resolvedPath: data.path, items: (data.items || []).filter((i: DirItem) => i.isDir) };
  } catch { return null; }
}

// ========== 标签（Canvas 渲染渐变文字） ==========

function _renderLabel(text: string): void {
  if (!_labelEl) return;
  const c = _labelEl as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  const w = r.width, h = r.height;
  if (w <= 0 || h <= 0) return;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.font = '600 13px -apple-system, sans-serif';
  const tw = ctx.measureText(text).width;
  const tx = (w - tw) / 2;
  const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#00d4ff');
  ctx.fillStyle = g; ctx.textBaseline = 'middle';
  ctx.fillText(text, tx, h / 2);
}

export function createRootPicker(): void {
  if (_labelEl) return;
  const c = document.createElement('canvas');
  c.className = 'root-picker-label';
  c.style.cssText = 'width:100%;height:40px;display:block';
  c.addEventListener('click', (e) => { e.stopPropagation(); if (_container) { _closeWithAnim(); return; } _openPanel(); });
  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  const btn = DOM.closeSidebarBtn;
  if (tools && btn) tools.insertBefore(c, btn);
  _labelEl = c;
  _fetchDirs(BASE_PATH).then(r => { if (r && _labelEl) { _currentResolved = r.resolvedPath; _renderLabel(_displayName(r.resolvedPath)); } });
}

export function isPickerOpen(): boolean { return !!_container; }

/**
 * 供 sidebar-scroll 在 picker 打开时调用：触发当前光标行的目录切换。
 */
export function pickerHandleClick(): void {
  if (L._rowIndex.length <= _cursorIdx) return;
  const box = L._rowIndex[_cursorIdx];
  const d = getFileRowData(box.data);
  if (d && d.isDir) _toggleDir(d.path, !d.isExpanded);
}

export function destroyRootPicker(): void {
  _destroyPicker();
  if (_labelEl) { _labelEl.remove(); _labelEl = null; }
}

// ========== 面板 ==========

async function _openPanel(): Promise<void> {
  if (_container) return;
  _currentPath = BASE_PATH;
  const result = await _fetchDirs(BASE_PATH);
  if (!result) return;
  _currentResolved = result.resolvedPath;
  _cachedDirs = result.items;
  _pickerExpanded = {};
  _cursorIdx = 0;
  // 保存 KFMState.files 快照，关闭时恢复
  _savedFiles = {};
  for (const key of Object.keys(KFMState.files)) {
    _savedFiles[key] = KFMState.files[key];
  }
  _cursorIdx = 0;
  _container = document.createElement('div');
  _container.className = 'sidebar-picker';
  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  if (tools) DOM.sidebar?.insertBefore(_container, tools);
  const inner = document.createElement('div');
  inner.className = 'sidebar-picker-inner';
  _container.appendChild(inner);
  _canvas = document.createElement('canvas');
  inner.appendChild(_canvas);

  requestAnimationFrame(() => _initPicker());
}

function _closeWithAnim(): void {
  if (!_container) return;
  // 确定光标所在目录路径
  let targetPath = BASE_PATH;
  if (_cursorIdx >= 0 && _cursorIdx < L._rowIndex.length) {
    const d = getFileRowData(L._rowIndex[_cursorIdx].data);
    if (d) targetPath = d.path;
  }
  const selectedLabel = targetPath === BASE_PATH ? _displayName(_currentResolved) : _displayName(targetPath);
  _container.classList.add('closing');
  // 动画期间后台加载文件树
  KFMState.expandedPaths = {};
  localStorage.setItem('expandedPaths', '{}');
  loadFileTree(targetPath).then(() => {
    setTimeout(() => _destroyPicker(), 50);
    if (_labelEl) _renderLabel(selectedLabel);
  });
  // 兜底：600ms 后强制关闭
  setTimeout(() => { if (_container) _destroyPicker(); }, 600);
}

function _destroyPicker(): void {
  if (_renderer) { _renderer.stop(); _renderer = null; }
  _canvas = null; _container?.remove(); _container = null;
  _pickerExpanded = {};
  if (_savedRenderer) {
    // 从旧 root 移除 picker 的光标，防止 ensureCursorBox 创建第二个
    const oldRoot = L.renderer?.getRoot();
    if (oldRoot && L.cursorBox && oldRoot.children.includes(L.cursorBox)) {
      oldRoot.removeChild(L.cursorBox);
    }
    L.renderer = _savedRenderer; _savedRenderer = null;
  }
  // 重建主树光标（覆盖 picker 遗留光标）
  const root = L.renderer?.getRoot();
  if (root) {
    ensureCursorBox(root, window.innerHeight);
    if (L._rowIndex.length > 0) moveCursorTo(L._rowIndex[0], false);
  }
  // 恢复 KFMState.files 到 picker 打开前的状态
  for (const key of Object.keys(KFMState.files)) {
    if (!(key in _savedFiles)) delete KFMState.files[key];
  }
  for (const key of Object.keys(_savedFiles)) {
    (KFMState.files as Record<string, any>)[key] = _savedFiles[key];
  }
  L._rowIndex = _savedRowIdx as any;
  _savedRowIdx = [];
}

function _initPicker(): void {
  if (!_canvas || !_container) return;
  const rect = _container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;
  _canvas.width = w * dpr; _canvas.height = h * dpr;
  _canvas.style.width = w + 'px'; _canvas.style.height = h + 'px';
  _contentH = h;

  _savedRenderer = L.renderer;
  _savedRowIdx = L._rowIndex as any;
  _renderer = new Renderer(_canvas, { backgroundColor: 'rgba(10,10,15,0.85)', dpr });
  L.renderer = _renderer;
  _rebuildPicker();
  _renderer.start();
  bindWheelEvents(_canvas);
}

// ========== Box 树构建（与主文件树相同的 toggle + label 结构） ==========

// ========== 用 buildTree 构建目录树 ==========

function _rebuildPicker(): void {
  if (!_renderer || !_canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = _canvas.width / dpr;

  // 构造根节点：当前目录自己作为根，子目录为 children
  const rootName = _displayName(_currentResolved) || '项目';
  const rootNode: FileNode = {
    name: rootName, path: BASE_PATH, isDir: true, isLink: false,
    children: _cachedDirs.map(d => ({ name: d.name, path: d.path, isDir: true, isLink: false })),
  };

  // 把 picker 的目录数据写入 KFMState.files（buildTree 内部会读它）
  KFMState.files[BASE_PATH] = rootNode as any;
  for (const d of _cachedDirs) {
    if (KFMState.files[d.path] === undefined) {
      KFMState.files[d.path] = { name: d.name, path: d.path, isDir: true, isLink: false, children: [] };
    }
  }

  // buildTree 输出同款视觉
  const treeRoot = buildTree([rootNode], {
    expandedPaths: _pickerExpanded,
    containerWidth: w,
    onDirToggle: (path: string, expand: boolean) => { _toggleDir(path, expand); },
    onFileClick: () => {},
  });

  // 包裹到可滚动的 picker 根容器
  const totalH = HEADER_H + (treeRoot.height || 0);
  const pickerRoot = new Box({ id: 'picker-root', x: 0, y: 0, width: w, height: Math.max(totalH, _contentH), scrollable: true, scrollY: getRootScrollY() ?? 0 });
  const header = new Box({ id: 'picker-head', x: 0, y: 0, width: w, height: HEADER_H });
  pickerRoot.addChild(header);
  treeRoot.y = HEADER_H;
  pickerRoot.addChild(treeRoot);
  if (treeRoot.height) pickerRoot.height = Math.max(HEADER_H + treeRoot.height, _contentH);

  _renderer.setRoot(pickerRoot);

  // 行索引和光标
  L._rowIndex = [];
  _rebuildRowIndex(pickerRoot);
  ensureCursorBox(pickerRoot, _contentH);
  if (L._rowIndex.length > 0) moveCursorTo(L._rowIndex[0], false);
}

function _rebuildPickerHeight(): number {
  const r = _renderer?.getRoot();
  if (!r) return 0;
  return r.height || 0;
}

async function _toggleDir(path: string, expand: boolean): Promise<void> {
  if (expand) {
    _pickerExpanded[path] = true;
    // 如果 KFMState.files 中没有该目录的 children，从 API 获取
    const existing = KFMState.files[path] as any as FileNode | undefined;
    if (!existing?.children || existing.children.length === 0) {
      const result = await _fetchDirs(path);
      if (result) {
        const fileNode: FileNode = {
          name: path.split('/').pop() || path, path, isDir: true, isLink: false,
          children: result.items.map(d => ({ name: d.name, path: d.path, isDir: true, isLink: false })),
        };
        KFMState.files[path] = fileNode as any;
      }
    }
  } else {
    delete _pickerExpanded[path];
  }
  _rebuildPicker();
}