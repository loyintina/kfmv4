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
import { L } from './renderer-lifecycle.js';
import { _rebuildRowIndex, getRootScrollY, findBoxById } from './canvas-utils.js';
import { ensureCursorBox, moveCursorTo, getCursorRowIndex } from './canvas-cursor.js';
import { bindWheelEvents } from './canvas-scroll.js';

const BASE_PATH = '.';
const HEADER_H = 4;

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
let _contentH = 0;

let _savedFiles: Record<string, any> = {};
let _cursorWatchRaf = 0;
let _lastLabelPath = '';

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

  // 根据文字宽度自适应字号：13px → 递减，必要时截断加省略号
  const maxW = w - 16;  // 左右各 8px 内边距
  let fontSize = 13;
  let displayText = text;
  for (; fontSize >= 8; fontSize--) {
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    if (ctx.measureText(displayText).width <= maxW) break;
  }
  if (fontSize < 8) {
    // 最小字号仍超宽：截断加省略号
    fontSize = 8;
    ctx.font = '600 8px -apple-system, sans-serif';
    while (displayText.length > 1) {
      displayText = displayText.slice(0, -1);
      if (ctx.measureText(displayText + '…').width <= maxW) { displayText += '…'; break; }
    }
  }

  const tw = ctx.measureText(displayText).width;
  const tx = (w - tw) / 2;
  const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#00d4ff');
  ctx.fillStyle = g; ctx.textBaseline = 'middle';
  ctx.fillText(displayText, tx, h / 2);
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
  _fetchDirs(BASE_PATH).then(r => { if (r && _labelEl) {
    _currentResolved = r.resolvedPath;
    const displayPath = KFMState.currentRoot !== BASE_PATH ? KFMState.currentRoot : r.resolvedPath;
    _renderLabel(_displayName(displayPath));
  } });
}

export function isPickerOpen(): boolean { return !!_container; }

/**
 * 在 picker 树中查找位于指定坐标的交互行（与 tree-render.ts findTapTarget 同模式）。
 */
function _hitTest(box: Box, px: number, py: number): Box | null {
  for (let i = box.children.length - 1; i >= 0; i--) {
    const child = box.children[i];
    if (!child.visible || child.disabled) continue;
    const found = _hitTest(child, px, py);
    if (found) return found;
  }
  if (box.containsPoint(px, py) && box.interactive && box.gesture?.onTap) {
    return box;
  }
  return null;
}

/**
 * 供 sidebar-scroll 在 picker 打开时调用。基于点击坐标命中检测，
 * 与主树 processClickQueue（tree-render.ts:689）同模式：
 * 第一击移动光标，第二击切换展开/折叠。
 */
export function pickerHandleClick(e?: PointerEvent): void {
  // 使用点击坐标查找目标行
  const root = L.renderer?.getRoot();
  const rect = _canvas?.getBoundingClientRect();
  if (root && rect && e) {
    const scrollY = root.scrollY ?? 0;
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top + scrollY;
    const hit = _hitTest(root, ox, oy);
    if (hit) {
      const hitIdx = L._rowIndex.indexOf(hit);
      if (hitIdx >= 0 && hitIdx !== getCursorRowIndex()) {
        // 点击目标与光标位置不同 → 移动光标，不展开
        moveCursorTo(hit);
        return;
      }
    }
  }
  // 点击目标就是光标位置 → 切换展开/折叠
  const idx = getCursorRowIndex();
  if (idx < 0 || idx >= L._rowIndex.length) return;
  const box = L._rowIndex[idx];
  const d = getFileRowData(box.data);
  if (!d || !d.isDir) return;
  _toggleDir(d.path, !d.isExpanded);
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
  _pickerExpanded = { [BASE_PATH]: true };
  _savedFiles = {};
  for (const key of Object.keys(KFMState.files)) {
    _savedFiles[key] = KFMState.files[key];
  }
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
  const cursorIdx = getCursorRowIndex();
  if (cursorIdx >= 0 && cursorIdx < L._rowIndex.length) {
    const d = getFileRowData(L._rowIndex[cursorIdx].data);
    if (d) targetPath = d.path;
  }
  const selectedLabel = targetPath === BASE_PATH ? _displayName(_currentResolved) : _displayName(targetPath);
  // 先销毁 picker，恢复主树渲染器（loadFileTree 的 rebuildTree 才能跑在正确渲染器上）
  _destroyPicker();
  // 设定新根目录，再加载数据（buildSidebarTree 读 files[currentRoot] 定位数据）
  KFMState.currentRoot = targetPath;
  localStorage.setItem('kfmv4_currentRoot', targetPath);
  KFMState.expandedPaths = {};
  localStorage.setItem('expandedPaths', '{}');
  // 清除旧光标位置，rebuildTree 无需尝试在新树中找旧行
  L.cursorRowId = null;
  loadFileTree(targetPath).then(() => {
    // 切换根目录后光标定位到新树的第一个目录（非第一个元素——可能是文件）
    const firstDir = L._rowIndex.find(r => { const d = getFileRowData(r.data); return d && d.isDir; });
    if (firstDir) moveCursorTo(firstDir, false);
    if (_labelEl) _renderLabel(selectedLabel);
  });
}

function _destroyPicker(): void {
  if (_cursorWatchRaf) { cancelAnimationFrame(_cursorWatchRaf); _cursorWatchRaf = 0; }
  if (_renderer) { _renderer.stop(); _renderer = null; }
  _canvas = null; _container?.remove(); _container = null;
  _pickerExpanded = {}; // popContext 自动恢复主树的 renderer、rowIndex、cursorBox、cursorRowId
  L.popContext();
  // 重建主树光标（popContext 恢复了 cursorRowId，但 cursorBox 可能无效）
  const root = L.renderer?.getRoot();
  if (root) ensureCursorBox(root, window.innerHeight);
  // 恢复 KFMState.files（仅在 picker 曾成功打开时，避免 _savedFiles={} 时清空主树）
  if (Object.keys(_savedFiles).length > 0) {
    for (const key of Object.keys(KFMState.files)) {
      if (!(key in _savedFiles)) delete KFMState.files[key];
    }
    for (const key of Object.keys(_savedFiles)) {
      (KFMState.files as Record<string, any>)[key] = _savedFiles[key];
    }
  }
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

  // pushContext 保存主树状态并切换到 picker 上下文
  _renderer = new Renderer(_canvas, { backgroundColor: 'rgba(10,10,15,0.85)', dpr });
  L.pushContext({ renderer: _renderer, rowIndex: [], cursorBox: null, cursorRowId: null });
  _rebuildPicker();
  // 将光标定位到当前根目录对应的行（强绑定：label 显示什么，光标就在什么上）
  for (let i = 0; i < L._rowIndex.length; i++) {
    const d = getFileRowData(L._rowIndex[i].data);
    if (d && d.isDir) {
      const match = KFMState.currentRoot === BASE_PATH
        ? d.path === BASE_PATH
        : KFMState.currentRoot === d.path || KFMState.currentRoot.startsWith(d.path + '/');
      if (match) { moveCursorTo(L._rowIndex[i], false); break; }
    }
  }
  _renderer.start();
  bindWheelEvents(_canvas);
  // 启动光标跟踪：每次光标移动时更新 label 显示当前目录名
  _lastLabelPath = '';
  _startCursorWatch();
}

/** rAF 循环：光标移动时更新 label 显示当前目录名 */
function _startCursorWatch(): void {
  _cursorWatchRaf = requestAnimationFrame(function tick() {
    if (!_container) { _cursorWatchRaf = 0; return; }
    const idx = getCursorRowIndex();
    if (idx >= 0 && idx < L._rowIndex.length) {
      const d = getFileRowData(L._rowIndex[idx].data);
      if (d && d.isDir && _labelEl) {
        const display = d.path === BASE_PATH ? _displayName(_currentResolved) : _displayName(d.path);
        if (display !== _lastLabelPath) {
          _lastLabelPath = display;
          _renderLabel(display);
        }
      }
    }
    _cursorWatchRaf = requestAnimationFrame(tick);
  });
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
  // 注意：主树可能在 files 中存有含文件的完整数据，picker 仅需目录
  KFMState.files[BASE_PATH] = rootNode as any;
  for (const d of _cachedDirs) {
    const existing = KFMState.files[d.path];
    if (existing === undefined || existing.children === undefined) {
      KFMState.files[d.path] = { name: d.name, path: d.path, isDir: true, isLink: false, children: [] };
    } else {
      // 主树预填充的数据可能包含文件，Picker 只保留目录
      KFMState.files[d.path] = { ...existing, children: existing.children.filter(c => c.isDir) };
    }
  }

  // buildTree 输出同款视觉
  const treeRoot = buildTree([rootNode], {
    expandedPaths: _pickerExpanded,
    containerWidth: w,
    onDirToggle: (path: string, expand: boolean) => { _toggleDir(path, expand); },
    onFileClick: () => {},
  });

  // 包裹到可滚动的 picker 根容器（根高度固定为视口高，内容溢出时 maxY>0 进入滚动模式）
  const totalH = HEADER_H + (treeRoot.height || 0);
  const pickerRoot = new Box({ id: 'picker-root', x: 0, y: 0, width: w, height: _contentH, scrollable: true, scrollY: getRootScrollY() ?? 0, overflow: 'hidden' });
  const header = new Box({ id: 'picker-head', x: 0, y: 0, width: w, height: HEADER_H });
  pickerRoot.addChild(header);
  treeRoot.y = HEADER_H;
  pickerRoot.addChild(treeRoot);

  _renderer.setRoot(pickerRoot);

  // 保存光标 → 重置 → 重建 → 恢复/居中（与 rebuildTree tree-render.ts:1062 同模式）
  const prevCursorRowId = L.cursorRowId;
  L.cursorBox = null;
  L.cursorRowId = null;
  L._rowIndex = [];
  _rebuildRowIndex(pickerRoot);
  ensureCursorBox(pickerRoot, _contentH);
  if (prevCursorRowId) {
    const target = findBoxById(pickerRoot, prevCursorRowId);
    if (target) { moveCursorTo(target, false); return; }
  }
  if (L._rowIndex.length > 0) moveCursorTo(L._rowIndex[Math.min(L._rowIndex.length - 1, Math.floor(L._rowIndex.length / 2))], false);
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