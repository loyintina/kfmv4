/**
 * root-picker.ts — 文件树根目录切换器（Canvas 引擎版）
 *
 * 用与文件树相同的 Renderer + Box 树渲染目录列表，
 * 视觉和交互完全一致：同一套行高、字号、光标。
 */
import { KFMState } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { DOM } from './dom-refs.js';
import { API } from './state.js';
import { Renderer } from '../engine/v2/renderer.js';
import { Box } from '../engine/v2/box.js';
import { FONT, LINE_HEIGHT } from './style-registry.js';

const BASE_PATH = '.';
const HEADER_H = LINE_HEIGHT + 8;

interface DirItem { name: string; path: string; isDir: boolean; }

let _labelEl: HTMLElement | null = null;
let _renderer: Renderer | null = null;
let _container: HTMLElement | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _confirmBtn: HTMLButtonElement | null = null;
let _dirs: DirItem[] = [];
let _cursorIdx = -1;
let _currentPath = BASE_PATH;
let _currentResolved = '';
let _scrollY = 0;
let _contentH = 0;

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

function _parentPath(path: string): string | null {
  if (path === '.' || path === '') return null;
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return '.';
  return path.substring(0, idx) || '.';
}

async function _fetchDirs(dirPath: string): Promise<{
  resolvedPath: string; items: DirItem[];
} | null> {
  try {
    const res = await fetch(API + '/files/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath }),
    });
    const data = await res.json();
    if (data.error) return null;
    return {
      resolvedPath: data.path,
      items: (data.items || []).filter((item: DirItem) => item.isDir),
    };
  } catch { return null; }
}
// ========== 标签（Canvas 渲染渐变文字） ==========

/** 在 Canvas 上画渐变文字，渐变宽度 = 文字实际宽度 */
function _renderLabel(text: string): void {
  if (!_labelEl) return;
  const canvas = _labelEl as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  const fontSize = 13;
  const font = `600 ${fontSize}px -apple-system, sans-serif`;
  ctx.font = font;
  const textW = ctx.measureText(text).width;

  // 渐变 = 从文字左边缘到右边缘
  const textX = (w - textW) / 2;
  const grad = ctx.createLinearGradient(textX, 0, textX + textW, 0);
  grad.addColorStop(0, '#7c3aed');
  grad.addColorStop(1, '#00d4ff');

  ctx.fillStyle = grad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, textX, h / 2);
}

export function createRootPicker(): void {
  if (_labelEl) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'root-picker-label';
  canvas.style.width = '100%';
  canvas.style.height = '40px';
  canvas.style.display = 'block';
  canvas.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_container) { _destroyPicker(); return; }
    _openPanel();
  });

  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  const closeBtn = DOM.closeSidebarBtn;
  if (tools && closeBtn) tools.insertBefore(canvas, closeBtn);
  _labelEl = canvas;

  _fetchDirs(BASE_PATH).then(r => {
    if (r && _labelEl) {
      _currentResolved = r.resolvedPath;
      _renderLabel(_displayName(r.resolvedPath));
    }
  });
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
  _dirs = result.items;
  _cursorIdx = _dirs.length > 0 ? 0 : -1;
  _scrollY = 0;

  _container = document.createElement('div');
  _container.className = 'sidebar-picker';
  // 插入到 sidebar-content 和 sidebar-tools 之间
  const tools = DOM.sidebar?.querySelector('.sidebar-tools');
  if (tools) DOM.sidebar?.insertBefore(_container, tools);

  const inner = document.createElement('div');
  inner.className = 'sidebar-picker-inner';
  _container.appendChild(inner);

  _canvas = document.createElement('canvas');
  _canvas.style.width = '100%';
  _canvas.style.height = '100%';
  _canvas.style.display = 'block';
  _canvas.style.touchAction = 'none';
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

  requestAnimationFrame(() => _initRenderer());
}

function _destroyPicker(): void {
  cancelAnimationFrame(_flingId); _flingId = 0;
  if (_renderer) { _renderer.stop(); _renderer = null; }
  _canvas = null; _container?.remove(); _container = null;
  _confirmBtn = null;
  _dirs = []; _cursorIdx = -1; _scrollY = 0; _contentH = 0;
  _velY = 0; _pointerId = -1;
}

function _initRenderer(): void {
  if (!_canvas || !_container) return;
  const rect = _container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const confirmH = _confirmBtn ? (_confirmBtn.parentElement?.offsetHeight || 44) : 0;
  const h = rect.height - confirmH;
  if (w <= 0 || h <= 0) return;
  _canvas.width = w * dpr;
  _canvas.height = h * dpr;
  _canvas.style.width = w + 'px';
  _canvas.style.height = h + 'px';
  _contentH = h;

  _renderer = new Renderer(_canvas, { backgroundColor: 'rgba(10,10,15,0.85)', dpr });
  _buildTree();
  _renderer.start();
  _bindEvents();
}

function _totalContentH(): number {
  const hasUp = _parentPath(_currentPath) !== null;
  return HEADER_H + (hasUp ? LINE_HEIGHT : 0) + _dirs.length * LINE_HEIGHT;
}

function _buildTree(): void {
  if (!_renderer || !_canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = _canvas.width / dpr;
  const totalH = _totalContentH();

  const root = new Box({
    id: 'picker-root', x: 0, y: 0, width: w,
    height: Math.max(totalH, _contentH),
    scrollable: true, scrollY: _scrollY,
  });

  // 表头
  const header = new Box({ id: 'picker-head', x: 0, y: 0, width: w, height: HEADER_H });
  root.addChild(header);

  const dimColor = 'rgba(224,224,240,0.5)';
  const rowColor = 'rgba(224,224,240,0.85)';
  let y = HEADER_H;

  // .. 行
  if (_parentPath(_currentPath)) {
    const isCur = _cursorIdx === -1;
    const row = new Box({ id: 'row-up', x: 0, y, width: w, height: LINE_HEIGHT });
    row.textStyle = { font: FONT, lineHeight: LINE_HEIGHT, align: 'left', verticalAlign: 'middle', overflow: 'ellipsis', maxLines: 2, content: '  ..', color: dimColor };
    if (isCur) row.backgroundColor = 'rgba(46,213,163,0.12)';
    root.addChild(row);
    y += LINE_HEIGHT;
  }

  // 目录行
  for (let i = 0; i < _dirs.length; i++) {
    const isCur = i === _cursorIdx;
    const row = new Box({ id: `row-${i}`, x: 0, y, width: w, height: LINE_HEIGHT });
    row.textStyle = { font: FONT, lineHeight: LINE_HEIGHT, align: 'left', verticalAlign: 'middle', overflow: 'ellipsis', maxLines: 2, content: '  ' + _dirs[i].name, color: isCur ? '#e0e0f0' : rowColor };
    if (isCur) row.backgroundColor = 'rgba(46,213,163,0.12)';
    root.addChild(row);
    y += LINE_HEIGHT;
  }

  _renderer.setRoot(root);
}

// ========== 手势 ==========

function _bindEvents(): void {
  if (!_canvas) return;
  _canvas.addEventListener('pointerdown', _onDown);
  _canvas.addEventListener('pointermove', _onMove);
  _canvas.addEventListener('pointerup', _onUp);
  _canvas.addEventListener('pointercancel', _onUp);
  _canvas.addEventListener('wheel', _onWheel, { passive: false });
}

function _rowAtY(localY: number): number {
  let y = HEADER_H - _scrollY;
  if (_parentPath(_currentPath)) {
    if (localY >= y && localY < y + LINE_HEIGHT) return -2;
    y += LINE_HEIGHT;
  }
  for (let i = 0; i < _dirs.length; i++) {
    if (localY >= y && localY < y + LINE_HEIGHT) return i;
    y += LINE_HEIGHT;
  }
  return -1;
}

function _clampScrollY(val: number): number {
  return Math.max(0, Math.min(Math.max(_totalContentH() - _contentH, 0), val));
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
  _ptrLastY = e.clientY;
  _ptrLastTime = performance.now();
  _buildTree();
}

function _onUp(e: PointerEvent): void {
  if (_pointerId < 0 || e.pointerId !== _pointerId) return;
  _canvas?.releasePointerCapture(e.pointerId);
  _pointerId = -1;

  if (Math.abs(e.clientY - _ptrStartY) < 8) {
    const rect = _canvas?.getBoundingClientRect();
    if (rect) {
      const localY = e.clientY - rect.top;
      const idx = _rowAtY(localY);
      if (idx === -2) {
        const p = _parentPath(_currentPath);
        if (p) _navigateTo(p);
      } else if (idx >= 0 && idx < _dirs.length) {
        _navigateTo(_dirs[idx].path);
      }
    }
  } else {
    _startFling();
  }
}

function _onWheel(e: WheelEvent): void {
  e.preventDefault();
  _scrollY = _clampScrollY(_scrollY + e.deltaY);
  _buildTree();
}

function _startFling(): void {
  cancelAnimationFrame(_flingId);
  let v = _velY;
  const step = () => {
    v *= 0.92;
    if (Math.abs(v) < 0.5) { _flingId = 0; return; }
    _scrollY = _clampScrollY(_scrollY + v);
    _buildTree();
    _flingId = requestAnimationFrame(step);
  };
  _flingId = requestAnimationFrame(step);
}

// ========== 导航 ==========

function _navigateTo(dirPath: string): void {
  _currentPath = dirPath;
  _scrollY = 0;
  _cursorIdx = 0;
  _fetchDirs(dirPath).then(r => {
    if (!r) return;
    _currentResolved = r.resolvedPath;
    _dirs = r.items;
    if (_cursorIdx >= _dirs.length) _cursorIdx = _dirs.length > 0 ? 0 : -1;
    _buildTree();
  });
}

// ========== 确认 ==========

async function _doConfirm(): Promise<void> {
  KFMState.expandedPaths = {};
  localStorage.setItem('expandedPaths', '{}');
  _destroyPicker();
  await loadFileTree(_currentPath);
  if (_labelEl) _renderLabel(_displayName(_currentResolved));
}
