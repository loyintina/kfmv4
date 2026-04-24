/**
 * tree-loader.ts — 按需加载数据层
 *
 * 不递归预加载全量树，只加载需要展示的文件夹的子项。
 * expandedPaths 记录了已展开的路径，每次只加载这些路径缺少的数据。
 */

import { KFMState, type FileNode } from './state.js';

const API = '/kfmv4/api';

/**
 * 从 API 获取一个文件夹的子文件列表，填充到 KFMState.files
 */
async function fetchDir(path: string): Promise<boolean> {
  // 如果已经加载过，跳过
  if (KFMState.files[path]?.children?.length !== undefined) {
    return true;
  }

  try {
    const res = await fetch(API + '/files/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const items: any[] = data.items || [];

    const children: FileNode[] = items.map(item => ({
      name: item.name,
      path: item.path,
      isDir: item.isDir,
      isLink: false,
    }));

    KFMState.files[path] = {
      name: path.split('/').pop() || path,
      path,
      isDir: true,
      isLink: false,
      children,
    };

    return true;
  } catch {
    return false;
  }
}

/**
 * 加载所有已展开路径的子文件。
 * expandedPaths = { '/root': true, '/root/kfmv4': true, ... }
 * 逐层加载，确保每个展开的文件夹都有 children 数据。
 */
export async function loadFileTree(rootPath: string, _maxDepth = 0): Promise<void> {
  // 只加载根目录一层。深层路径等用户点击展开时再按需拉取。
  await fetchDir(rootPath);

  // 通知渲染
  KFMState.notify();
}

/**
 * 当用户展开/折叠文件夹时，需要按需加载子文件
 * 订阅 expandedPaths 变化，动态拉取
 */
export function ensureDirLoaded(path: string): void {
  // 如果还没展开过，不加载
  if (!KFMState.expandedPaths[path]) return;
  // 如果已加载，跳过
  if (KFMState.files[path]?.children?.length !== undefined) return;

  fetchDir(path).then(() => {
    KFMState.notify();
  });
}

/**
 * 初始化：监听 expandedPaths 变化，自动按需加载
 * 只监听用户主动展开操作，不做穷举扫描
 */
export function initLazyLoader(): void {
  const originalSetExpanded = KFMState.setExpanded.bind(KFMState);
  KFMState.setExpanded = function (path: string, expanded: boolean) {
    originalSetExpanded(path, expanded);
    if (expanded) {
      ensureDirLoaded(path);
    }
  };
}