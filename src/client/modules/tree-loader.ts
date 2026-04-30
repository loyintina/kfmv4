/**
 * tree-loader.ts — 按需加载数据层
 *
 * 核心逻辑：
 * - 只加载已展开路径的数据
 * - 展开一个文件夹时，递归加载其内部所有已展开的子文件夹
 * - 这样 rebuildTree 时所有展开节点的数据都已就绪，直接递归构建
 */

import { KFMState, type FileNode } from './state.js';
import { markAnimatingPath, isAnimLocked } from './tree-render.js';

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
 * 逐层加载每个展开的目录，每加载一层的直系子项就立即 notify。
 * 边加载边播展开动画 —— 加载多少就展开多少。
 */
export async function loadFileTree(rootPath: string): Promise<void> {
  // 先把根目录的数据加载进来
  await fetchDir(rootPath);
  // 标记根目录做展开动画 + notify
  markAnimatingPath(rootPath);
  KFMState.notify();

  // 然后逐层加载已展开的子目录（延迟一小段时间让 rebuildTree 动画先启动）
  await sleep(50);

  const rootNode = KFMState.files[rootPath];
  if (rootNode?.children) {
    for (const child of rootNode.children) {
      if (child.isDir && KFMState.expandedPaths[child.path]) {
        await loadLayerByLayerDeep(child.path);
      }
    }
  }
}

/** 休眠指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 逐层加载展开的目录：
 * 1. 设置 animatingPath → notify → 等一帧让动画启动
 * 2. 加载这一层 → notify → 触发 expanded- 容器从 0 展开
 * 3. 递归子目录
 */
async function loadLayerByLayerDeep(path: string): Promise<void> {
  // 先标记自己做展开动画（让 rebuildTree 在数据加载前就记录 _fullHeight）
  markAnimatingPath(path);
  KFMState.notify();
  await sleep(30);

  // 加载这一层
  const loaded = await fetchDir(path);
  if (!loaded) return;

  // 数据就绪后，等待动画解锁（避免 notify 被 animLocked 挡掉）
  if (isAnimLocked()) {
    // 轮回等待 — 每次检查间隔 50ms，最长等 3000ms
    const start = Date.now();
    while (isAnimLocked()) {
      if (Date.now() - start > 3000) break;
      await sleep(50);
    }
  }
  // notify 让真实内容显示出来 → rebuildTree 检测到 animatingPath → 展开动画
  markAnimatingPath(path);
  KFMState.notify();
  await sleep(30);

  // 递归已展开的子目录
  const node = KFMState.files[path];
  if (node?.children) {
    for (const child of node.children) {
      if (child.isDir && KFMState.expandedPaths[child.path]) {
        await loadLayerByLayerDeep(child.path);
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
      // 数据已在缓存中时，不要走逐层加载流程
      // （点击事件自己的 animatingPath → notify 已足够触发展开动画）
      // 逐层加载会额外 notify，打乱动画状态机
      const cached = KFMState.files[path]?.children?.length !== undefined;
      if (!cached) {
        loadLayerByLayerDeep(path).catch(console.error);
      }
    }
  };
}