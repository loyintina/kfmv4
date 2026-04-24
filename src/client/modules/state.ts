/**
 * KFM v4 - 统一状态层
 * Phase 8.0.1: 状态层基础设施
 */

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
  expandedPaths: Record<string, boolean>;
  selectedPath: string;
  showHidden: boolean;
  
  // UI
  viewport: ViewportState;
  sidebarOpen: boolean;
  
  // 缓存
  fileCache: { version: number; updated: number; tree: Record<string, any> };
  
  // 订阅机制
  _listeners: Array<(state: KFMStateType) => void>;
  subscribe(fn: (state: KFMStateType) => void): void;
  unsubscribe(fn: (state: KFMStateType) => void): void;
  notify(): void;
  
  // 操作方法
  setExpanded(path: string, expanded: boolean): void;
  setSelected(path: string): void;
  toggleHidden(): void;
  setSidebarOpen(open: boolean): void;
  setViewport(v: Partial<ViewportState>): void;
}

export const KFMState: KFMStateType = {
  files: {},
  expandedPaths: JSON.parse(localStorage.getItem('expandedPaths') || '{}'),
  selectedPath: '',
  showHidden: false,
  viewport: { scrollTop: 0, scrollLeft: 0 },
  sidebarOpen: false,
  fileCache: { version: 1, updated: 0, tree: {} },
  
  _listeners: [],
  
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
    if (expanded) {
      this.expandedPaths[path] = true;
    } else {
      delete this.expandedPaths[path];
    }
    localStorage.setItem('expandedPaths', JSON.stringify(this.expandedPaths));
    this.notify();
  },
  
  setSelected(path) {
    this.selectedPath = path;
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
  }
};

// 挂载到 window 供跨模块访问
declare global {
  interface Window {
    KFMState: typeof KFMState;
  }
}

if (typeof window !== 'undefined') {
  (window as any).KFMState = KFMState;
}
