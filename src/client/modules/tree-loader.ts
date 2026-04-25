/**
 * tree-loader.ts — 按需加载数据层
 *
 * 核心逻辑：
 * - 只加载已展开路径的数据
 * - 展开一个文件夹时，递归加载其内部所有已展开的子文件夹
 * - 这样 rebuildTree 时所有展开节点的数据都已就绪，直接递归构建
 */

import { KFMState, type FileNode } from './state.js';

const API = '/kfmv4/api';

async function fetchDir(path: string): Promise<boolean> {
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
 * 递归加载所有已展开路径的数据。
 * 一次性把整棵展开树填满，后续 rebuildTree 直接递归构建。
 */
export async function ensureDirLoadedRecursive(path: string): Promise<void> {
  if (!KFMState.expandedPaths[path]) return;

  const loaded = await fetchDir(path);
  if (!loaded) return;

  // 加载完后检查子文件夹是否有已展开的，递归加载
  const node = KFMState.files[path];
  if (node?.children) {
    const loadPromises: Promise<void>[] = [];
    for (const child of node.children) {
      if (child.isDir && KFMState.expandedPaths[child.path]) {
        loadPromises.push(ensureDirLoadedRecursive(child.path));
      }
    }
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
  }
}

/**
 * 初始化时加载根目录 + 递归加载所有已展开路径
 */
export async function loadFileTree(rootPath: string): Promise<void> {
  // 加载根目录
  await fetchDir(rootPath);

  // 递归加载所有已展开的子文件夹
  const rootNode = KFMState.files[rootPath];
  if (rootNode?.children) {
    const loadPromises: Promise<void>[] = [];
    for (const child of rootNode.children) {
      if (child.isDir && KFMState.expandedPaths[child.path]) {
        loadPromises.push(ensureDirLoadedRecursive(child.path));
      }
    }
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
  }

  KFMState.notify();
}

/**
 * 逐层加载展开的目录：加载一层就 notify 一次，让界面立即展示
 */
async function loadLayerByLayer(path: string): Promise<void> {
  // 立即 notify 一次，让 rebuildTree 生成带省略号的盒子
  KFMState.notify();

  // 加载当前层的直接子项
  const loaded = await fetchDir(path);
  if (!loaded) return;

  // 加载完本层立即刷新显示真实子项
  KFMState.notify();

  // 检查是否有已展开的子文件夹，递归逐层加载
  const node = KFMState.files[path];
  if (node?.children) {
    for (const child of node.children) {
      if (child.isDir && KFMState.expandedPaths[child.path]) {
        await loadLayerByLayer(child.path);
      }
    }
  }
}

/**
 * 初始化：劫持 setExpanded，展开时逐层加载并逐层显示
 */
export function initLazyLoader(): void {
  const originalSetExpanded = KFMState.setExpanded.bind(KFMState);
  KFMState.setExpanded = function (path: string, expanded: boolean) {
    originalSetExpanded(path, expanded);
    if (expanded) {
      // 异步逐层加载，每加载一层就 notify 一次
      loadLayerByLayer(path).catch(console.error);
    }
  };
}