/**
 * root-picker.ts — 文件树根目录切换器（Renderer 替换模式）
 *
 * 打开时替换 L.renderer 指向 picker 的 Canvas，光标系统自动对齐。
 * 展开/折叠由 picker 内部处理（无 overlay 动画）。
 * 确认时恢复 L.renderer，loadFileTree 重建主树。
 */
import { KFMState, getFileRowData } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { DOM } from './dom-refs.js';
import { API } from './state.js';
import { Renderer } from '../engine/v2/renderer.js';
import { Box } from '../engine/v2/box.js';
import { FONT, LINE_HEIGHT } from './style-registry.js';
import { gestures } from './gesture-registry.js';
import { L } from './renderer-lifecycle.js';
import { ensureCursorBox, moveCursorTo } from './canvas-cursor.js';

const BASE_PATH = '.';
const HEADER_H = LINE_HEIGHT + 8;
const INDENT = 16;

interface DirItem { name: string; path: string; isDir: boolean; }
interface ListResult { resolvedPath: string; items: DirItem[]; }

let _labelEl: HTMLElement | null = null;
let _renderer: Renderer | null = null;
let _container: HTMLElement | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _confirmBtn: HTMLButtonElement | null = null;
let _pickerExpanded: Record<string, boolean> = {};
let _currentPath = BASE_PATH;
let _currentResolved = '';
let _gestureUnreg: (() => void) | null = null;
let _contentH = 0;
let _cachedDirs: DirItem[] = [];
let _cursorIdx = 0;
let _scrollY = 0;
let _totalRows = 0;

// 保存/恢复 L 状态
let _savedRenderer: Renderer | null = null;
let _savedRowIdx: Box[] = [];

let _pointerId = -1;
let _ptrStartY = 0;
let _ptrStartScroll = 0;
let _ptrLastY = 0;
let _ptrLastTime = 0;
let _velY = 0;
let _flingId = 0;

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

export function destroyRootPicker(): void {
  _destroyPicker();
  if (_labelEl) { _labelEl.remove(); _labelEl = null; }
}

async function _openPanel(): Promise<void> {
  if (_container) return;
  _currentPath = BASE_PATH;
  const result = await _fetchDirs(BASE_PATH);
  if (!result) return;
  _currentResolved = result.resolvedPath;
  _cachedDirs = result.items;
  _pickerExpanded = {};
  _cursorIdx = 0; _scrollY = 0;

  _gestureUnreg = gestures.register({
    id: 'picker-lock', targetFilter: () => true, condition: () => !!_container, priority: 110, stopPropagation: true,
  });

  _container = document.createElement('div');
  _container.className = 'sidebar-picker';
  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  if (tools) DOM.sidebar?.insertBefore(_container, tools);

  const inner = document.createElement('div');
  inner.className = 'sidebar-picker-inner';
  _container.appendChild(inner);
  _canvas = document.createElement('canvas');
  _canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  inner.appendChild(_canvas);

  const confirmBar = document.createElement('div');
  confirmBar.className = 'root-picker-confirm-bar';
  const btn = document.createElement('button');
  btn.className = 'root-picker-confirm';
  btn.textContent = '✅ 选此目录作为文件树';
  btn.addEventListener('click', _doConfirm);
  confirmBar.appendChild(btn);
  inner.appendChild(confirmBar);
  _confirmBtn = btn;

  requestAnimationFrame(() => _initPicker());
}

function _closeWithAnim(): void {
  if (!_container) return;
  _container.classList.add('closing');
  setTimeout(() => _destroyPicker(), 280);
}

function _destroyPicker(): void {
  cancelAnimationFrame(_flingId); _flingId = 0;
  if (_gestureUnreg) { _gestureUnreg(); _gestureUnreg = null; }
  if (_renderer) { _renderer.stop(); _renderer = null; }
  _canvas = null; _container?.remove(); _container = null;
  _confirmBtn = null; _contentH = 0;
  _velY = 0; _pointerId = -1; _pickerExpanded = {};
  if (_savedRenderer) { L.renderer = _savedRenderer; _savedRenderer = null; }
  L._rowIndex = _savedRowIdx as any;
  _savedRowIdx = [];
}

function _initPicker(): void {
  if (!_canvas || !_container) return;
  const rect = _container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const confirmH = _confirmBtn ? (_confirmBtn.parentElement?.offsetHeight || 44) : 0;
  const h = rect.height - confirmH;
  if (w <= 0 || h <= 0) return;
  _canvas.width = w * dpr; _canvas.height = h * dpr;
  _canvas.style.width = w + 'px'; _canvas.style.height = h + 'px';
  _contentH = h;

  _savedRenderer = L.renderer;
  _savedRowIdx = L._rowIndex as any;

  _renderer = new Renderer(_canvas, { backgroundColor: 'rgba(10,10,15,0.85)', dpr });
  L.renderer = _renderer;
  _buildPickerTree();
  _renderer.start();
  _bindPickerEvents();
}

// ========== Box 树构建 ==========

function _buildPickerTree(): void {
  if (!_renderer || !_canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = _canvas.width / dpr;

  // 计算所有行的展开状态
  const dirs = _cachedDirs;
  _totalRows = _countRows(dirs);
  const totalH = HEADER_H + _totalRows * LINE_HEIGHT;

  const root = new Box({ id: 'picker-root', x: 0, y: 0, width: w, height: Math.max(totalH, _contentH), scrollable: true, scrollY: _scrollY });
  const header = new Box({ id: 'picker-head', x: 0, y: 0, width: w, height: HEADER_H });
  root.addChild(header);

  let ry = HEADER_H;
  const rows: Box[] = [];

  function addDir(d: typeof dirs[0], depth: number): void {
    const n = d.name;
    const path = d.path;
    const isExpanded = !!_pickerExpanded[path];
    const isCur = rows.length === _cursorIdx;
    const tri = isExpanded ? '▼' : '▶';
    const text = '  '.repeat(depth + 1) + tri + '  ' + n;
    const row = new Box({ id: `pr-${path}`, x: depth * INDENT, y: ry, width: w - depth * INDENT, height: LINE_HEIGHT });
    row.data = { path, isDir: true, isExpanded, depth, lineCount: 1 } as any;
    row.textStyle = { font: FONT, lineHeight: LINE_HEIGHT, align: 'left', verticalAlign: 'middle', overflow: 'ellipsis', maxLines: 2, content: text, color: isCur ? '#e0e0f0' : 'rgba(224,224,240,0.85)' };
    if (isCur) row.backgroundColor = 'rgba(46,213,163,0.12)';
    root.addChild(row);
    rows.push(row);
    ry += LINE_HEIGHT;

    if (isExpanded) {
      _addChildren(path, depth + 1);
    }
  }

  function _addChildren(parentPath: string, depth: number): void {
    // 子目录已缓存？如果没有，不展开
    // 展开是在 _toggleDir 中通过 async fetch 预先加载数据的
  }

  for (const d of dirs) addDir(d, 0);

  _renderer.setRoot(root);
  L._rowIndex = rows as any;
  ensureCursorBox(root, _contentH);
  if (rows.length > 0 && _cursorIdx < rows.length) {
    moveCursorTo(rows[_cursorIdx]);
  }
}

function _countRows(dirs: DirItem[]): number {
  let c = 0;
  for (const d of dirs) { c++; if (_pickerExpanded[d.path]) c += 0; } // 占位，子层展开后计入
  return c;
}

async function _toggleDir(path: string): Promise<void> {
  const expand = !_pickerExpanded[path];
  if (expand) {
    _pickerExpanded[path] = true;
    await _fetchDirs(path); // 预加载，获取子目录列表
  } else {
    delete _pickerExpanded[path];
  }
  _buildPickerTree();
}

// ========== Canvas 事件 ==========

function _bindPickerEvents(): void {
  if (!_canvas) return;
  _canvas.addEventListener('pointerdown', _onDown);
  _canvas.addEventListener('pointermove', _onMove);
  _canvas.addEventListener('pointerup', _onUp);
  _canvas.addEventListener('pointercancel', _onUp);
  _canvas.addEventListener('wheel', _onWheel, { passive: false });
}

function _rowAtY(localY: number): number {
  const y0 = HEADER_H - _scrollY;
  if (localY < y0) return -1;
  return Math.floor((localY - y0) / LINE_HEIGHT);
}

function _clampScrollY(val: number): number {
  const totalH = HEADER_H + _totalRows * LINE_HEIGHT;
  return Math.max(0, Math.min(Math.max(totalH - _contentH, 0), val));
}

function _onDown(e: PointerEvent): void {
  _pointerId = e.pointerId;
  _ptrStartY = e.clientY;
  _ptrStartScroll = _scrollY;
  _ptrLastY = e.clientY;
  _ptrLastTime = performance.now();
  _velY = 0;
  cancelAnimationFrame(_flingId); _flingId = 0;
  _canvas?.setPointerCapture(e.pointerId);
}

function _onMove(e: PointerEvent): void {
  if (_pointerId < 0 || e.pointerId !== _pointerId) return;
  _scrollY = _clampScrollY(_ptrStartScroll + _ptrStartY - e.clientY);
  const dt = performance.now() - _ptrLastTime;
  if (dt > 0) _velY = ((e.clientY - _ptrLastY) / dt) * 16;
  _ptrLastY = e.clientY; _ptrLastTime = performance.now();
  _buildPickerTree();
}

function _onUp(e: PointerEvent): void {
  if (_pointerId < 0 || e.pointerId !== _pointerId) return;
  _canvas?.releasePointerCapture(e.pointerId);
  _pointerId = -1;
  if (Math.abs(e.clientY - _ptrStartY) < 8) {
    const rect = _canvas?.getBoundingClientRect();
    if (rect) {
      const localY = e.clientY - rect.top;
      const rowIdx = _rowAtY(localY);
      if (rowIdx >= 0 && rowIdx < L._rowIndex.length) {
        const box = L._rowIndex[rowIdx];
        const d = getFileRowData(box.data);
        if (d && d.isDir) {
          _cursorIdx = rowIdx;
          _toggleDir(d.path);
        }
      }
    }
  } else {
    _startFling();
  }
}

function _onWheel(e: WheelEvent): void {
  e.preventDefault();
  _scrollY = _clampScrollY(_scrollY + e.deltaY);
  _buildPickerTree();
}

function _startFling(): void {
  cancelAnimationFrame(_flingId);
  let v = _velY;
  const step = () => {
    v *= 0.92;
    if (Math.abs(v) < 0.5) { _flingId = 0; return; }
    _scrollY = _clampScrollY(_scrollY + v);
    _buildPickerTree();
    _flingId = requestAnimationFrame(step);
  };
  _flingId = requestAnimationFrame(step);
}

// ========== 确认 ==========

async function _doConfirm(): Promise<void> {
  let confirmPath = BASE_PATH;
  if (_cursorIdx >= 0 && _cursorIdx < L._rowIndex.length) {
    const d = getFileRowData(L._rowIndex[_cursorIdx].data);
    if (d) confirmPath = d.path;
  }
  KFMState.expandedPaths = {};
  localStorage.setItem('expandedPaths', '{}');
  _destroyPicker();
  await loadFileTree(confirmPath);
  if (_labelEl) _renderLabel(_displayName(confirmPath));
}
