/**
 * KFM v4 - 统一状态层
 * Phase 8.0.1: 状态层基础设施
 */
/** API 基础路径 */
export const API = '/kfmv4/api';

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  isLink: boolean;
  children?: FileNode[];
}

export interface ViewportState {
  scrollTop: number;
  scrollLeft: number;
}

export interface KFMStateType {
  // 文件系统
  files: Record<string, FileNode>;
  currentRoot: string;             // 当前文件树根目录在 files 中的 key
  expandedPaths: Record<string, boolean>;
  selectedFile: string;
  showHidden: boolean;
  
  // UI
  viewport: ViewportState;
  sidebarOpen: boolean;
  
  // 卡片工作台
  openCards: OpenCard[];
  focusedCardId: string | null;
  cart: CartState;
  config: CartConfig;
  
  // 缓存
  fileCache: { version: number; updated: number; tree: Record<string, any> };
  
  // 订阅机制
  _listeners: Array<(state: KFMStateType) => void>;
  subscribe(fn: (state: KFMStateType) => void): void;
  unsubscribe(fn: (state: KFMStateType) => void): void;
  notify(): void;

  // 钩子系统（替代 monkey-patch）
  _beforeExpandHooks: Array<(path: string) => boolean | void>;
  addHook(hook: 'beforeExpand', fn: (path: string) => boolean | void): void;
  removeHook(hook: 'beforeExpand', fn: (path: string) => boolean | void): void;
  
  // 操作方法
  setExpanded(path: string, expanded: boolean): void;
  setSelectedFile(path: string): void;
  toggleHidden(): void;
  setSidebarOpen(open: boolean): void;
  setViewport(v: Partial<ViewportState>): void;

  // 卡片工作台方法
  cartAddEntry(entry: CartEntry): void;
  cartRemoveEntry(id: string): void;
  cartClear(): void;
  cartSetOpen(open: boolean): void;
  cartSetEditMode(edit: boolean): void;
  addOpenCard(card: OpenCard): void;
  removeOpenCard(id: string): void;
  focusCard(id: string | null): void;
}

export const KFMState: KFMStateType = {
  files: {},
  currentRoot: localStorage.getItem('kfmv4_currentRoot') || '.',
  expandedPaths: JSON.parse(localStorage.getItem('expandedPaths') || '{}'),
  selectedFile: '',
  showHidden: false,
  viewport: { scrollTop: 0, scrollLeft: 0 },
  sidebarOpen: false,
  openCards: [],
  focusedCardId: null,
  cart: { entries: [], isOpen: false, editMode: false },
  config: { allowDuplicates: false },
  fileCache: { version: 1, updated: 0, tree: {} },
  
  _listeners: [],
  _beforeExpandHooks: [],

  addHook(hook: 'beforeExpand', fn: (path: string) => boolean | void): void {
    if (hook === 'beforeExpand') {
      this._beforeExpandHooks.push(fn);
    }
  },

  removeHook(hook: 'beforeExpand', fn: (path: string) => boolean | void): void {
    if (hook === 'beforeExpand') {
      const idx = this._beforeExpandHooks.indexOf(fn);
      if (idx !== -1) this._beforeExpandHooks.splice(idx, 1);
    }
  },

  subscribe(fn) {
    this._listeners.push(fn);
  },
  
  unsubscribe(fn) {
    const idx = this._listeners.indexOf(fn);
    if (idx !== -1) this._listeners.splice(idx, 1);
  },
  
  notify() {
    this._listeners.forEach(fn => fn(this));
  },
  
  setExpanded(path, expanded) {
    // beforeExpand 钩子：返回 true 表示跳过默认逻辑
    if (expanded) {
      for (const hook of this._beforeExpandHooks) {
        if (hook(path) === true) return;
      }
    }
    if (expanded) {
      this.expandedPaths[path] = true;
    } else {
      delete this.expandedPaths[path];
    }
    localStorage.setItem('expandedPaths', JSON.stringify(this.expandedPaths));
    this.notify();
  },
  
  setSelectedFile(path) {
    this.selectedFile = path;
    this.notify();
  },
  
  toggleHidden() {
    this.showHidden = !this.showHidden;
    this.notify();
  },
  
  setSidebarOpen(open) {
    this.sidebarOpen = open;
    this.notify();
  },
  
  setViewport(v) {
    Object.assign(this.viewport, v);
    this.notify();
  },

  cartAddEntry(entry) {
    if (!this.config.allowDuplicates && this.cart.entries.some(e => e.path === entry.path && e.type === entry.type)) return;
    this.cart.entries.push(entry);
    this.notify();
  },
  cartRemoveEntry(id) {
    this.cart.entries = this.cart.entries.filter(e => e.id !== id);
    this.notify();
  },
  cartClear() {
    this.cart.entries = [];
    this.notify();
  },
  cartSetOpen(open) {
    this.cart.isOpen = open;
    this.notify();
  },
  cartSetEditMode(edit) {
    this.cart.editMode = edit;
    this.notify();
  },
  addOpenCard(card) {
    this.openCards.push(card);
    this.notify();
  },
  removeOpenCard(id) {
    this.openCards = this.openCards.filter(c => c.id !== id);
    this.notify();
  },
  focusCard(id) {
    this.focusedCardId = id;
    this.notify();
  },
};

// ============================================================
// 文件行业务数据类型（替代 (as any).data 模式）
// ============================================================

/** 文件树中每行的 data 类型 */
export interface FileRowData {
  path: string;
  isDir: boolean;
  isExpanded?: boolean;  // 仅文件夹行有
  depth: number;
  lineCount: number;
}

/** 从 Box.data 中安全读取 FileRowData */
export function getFileRowData(d: Record<string, unknown>): FileRowData | null {
  if (typeof d.path === 'string' && typeof d.isDir === 'boolean') {
    return d as unknown as FileRowData;
  }
  return null;
}

// ============================================================
// 卡片工作台数据类型（WORKBENCH_SPEC.md §8）
// ============================================================

export interface OpenCard {
  id: string;
  type: 'file' | 'folder' | 'editor';
  path: string;
  name: string;
  instanceIndex: number;
  mode: 'preview' | 'detailed';
  createdAt: number;
}

export interface CartEntry {
  id: string;
  type: 'file' | 'folder';
  path: string;
  name: string;
  instanceIndex: number;
  createdAt: number;
}

export interface CartState {
  entries: CartEntry[];
  isOpen: boolean;
  editMode: boolean;
}

export interface CartConfig {
  allowDuplicates: boolean;
}

// 挂载到 window 供跨模块访问
declare global {
  interface Window {
    KFMState: typeof KFMState;
  }
}
