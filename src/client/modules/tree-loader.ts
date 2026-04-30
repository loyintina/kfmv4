/**
 * tree-loader.ts — 数据加载层
 *
 * 核心逻辑：
 * - 展开文件夹时，通过递归 API 一次性获取整棵子树数据
 * - 数据就绪后 notify 触发展开动画，无需逐层串行加载
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
 * 递归获取目录树：一次请求拿到指定路径下所有层级的子目录内容。
 * 后端 /files/list-recursive 一次性返回整棵子树。
 */
async function fetchDirRecursive(dirPath: string, depth: number = 20): Promise<boolean> {
  try {
    const res = await fetch(API + '/files/list-recursive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath, depth }),
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
 * 用于首次展开（数据未缓存时）。
 */
async function loadAndAnimate(path: string): Promise<void> {
  markAnimatingPath(path);
  KFMState.notify();
  await sleep(30);

  const loaded = await fetchDirRecursive(path);
  if (!loaded) return;

  await waitForAnimUnlock();
  markAnimatingPath(path);
  KFMState.notify();
}

/**
 * 初始化根目录：加载根目录数据并触发展开动画。
 */
export async function loadFileTree(rootPath: string): Promise<void> {
  const loaded = await fetchDirRecursive(rootPath);
  if (!loaded) return;

  markAnimatingPath(rootPath);
  KFMState.notify();

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
