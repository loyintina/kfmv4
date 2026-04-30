/**
 * tree-loader.ts — 数据加载层
 *
 * 核心逻辑：
 * - 页面加载时，根据 expandedPaths 只获取展开路径上的节点
 * - 点击展开时，获取该目录的子节点（不递归获取未展开的子目录）
 * - 后端根据 expandedPaths 参数，只返回展开路径上的节点
 */

import { KFMState, type FileNode } from './state.js';
import { markAnimatingPath, isAnimLocked } from './tree-render.js';

const API = '/kfmv4/api';

/** 休眠指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 等待动画锁释放，最长 3s 超时 */
async function waitForAnimUnlock(): Promise<void> {
  if (!isAnimLocked()) return;
  const start = Date.now();
  while (isAnimLocked()) {
    if (Date.now() - start > 3000) break;
    await sleep(50);
  }
}

/**
 * 获取指定路径下展开路径上的所有节点。
 * 后端根据 expandedPaths 只返回展开的子目录的子节点。
 */
async function fetchDirRecursive(
  dirPath: string,
  expandedPaths: Record<string, boolean> = {},
  depth: number = 20
): Promise<boolean> {
  try {
    const res = await fetch(API + '/files/list-recursive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath, depth, expandedPaths }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const tree: any[] = data.tree || [];
    if (tree.length === 0) return false;

    // 将递归树结构写入 KFMState.files
    function ingestTree(parentPath: string, items: any[]): void {
      const children: FileNode[] = items.map(item => ({
        name: item.name,
        path: item.path,
        isDir: item.isDir,
        isLink: false,
      }));
      KFMState.files[parentPath] = {
        name: parentPath.split('/').pop() || parentPath,
        path: parentPath,
        isDir: true,
        isLink: false,
        children,
      };
      for (const item of items) {
        if (item.isDir && item.children && item.children.length > 0) {
          ingestTree(item.path, item.children);
        }
      }
    }

    ingestTree(dirPath, tree);
    return true;
  } catch {
    return false;
  }
}

/**
 * 加载指定目录的子树数据，然后触发展开动画。
 * 用于点击展开时：只获取该目录的子节点，不递归获取未展开的子目录。
 */
async function loadAndAnimate(path: string): Promise<void> {
  markAnimatingPath(path);
  KFMState.notify();
  await sleep(30);

  // 只获取当前目录的子节点，传入该目录下展开的子路径
  const childExpandedPaths = getChildExpandedPaths(path);
  const loaded = await fetchDirRecursive(path, childExpandedPaths);
  if (!loaded) return;

  await waitForAnimUnlock();
  markAnimatingPath(path);
  KFMState.notify();
}

/**
 * 获取指定路径下展开的子路径。
 * 例如：path=/root，expandedPaths 有 /root/go 和 /root/go/src
 * 则返回 { "/root/go": true, "/root/go/src": true }
 */
function getChildExpandedPaths(path: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const expandedPath of Object.keys(KFMState.expandedPaths)) {
    if (expandedPath.startsWith(path + '/')) {
      result[expandedPath] = true;
    }
  }
  return result;
}

/**
 * 初始化根目录：根据 expandedPaths 获取所有展开路径上的节点。
 */
export async function loadFileTree(rootPath: string): Promise<void> {
  // 获取所有展开路径
  const allExpandedPaths = { ...KFMState.expandedPaths };
  
  // 一次性获取所有展开路径上的节点
  const loaded = await fetchDirRecursive(rootPath, allExpandedPaths);
  if (!loaded) return;

  markAnimatingPath(rootPath);
  KFMState.notify();

  // 依次触发展开动画
  await waitForAnimUnlock();
  const rootNode = KFMState.files[rootPath];
  if (rootNode?.children) {
    for (const child of rootNode.children) {
      if (child.isDir && KFMState.expandedPaths[child.path]) {
        markAnimatingPath(child.path);
        KFMState.notify();
        await waitForAnimUnlock();
      }
    }
  }
}

/**
 * 初始化：劫持 setExpanded，展开时加载数据并触发展开动画。
 */
export function initLazyLoader(): void {
  const originalSetExpanded = KFMState.setExpanded.bind(KFMState);
  KFMState.setExpanded = function (path: string, expanded: boolean) {
    originalSetExpanded(path, expanded);
    if (expanded) {
      const cached = KFMState.files[path]?.children?.length !== undefined;
      if (!cached) {
        loadAndAnimate(path).catch(console.error);
      }
    }
  };
}
