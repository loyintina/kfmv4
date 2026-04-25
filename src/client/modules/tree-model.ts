/**
 * tree-model.ts — 数据建模层
 *
 * 核心 API 是一个通用函数 buildTree()：
 *   给定文件列表和选项，返回一棵 Box 树。
 *   不依赖 KFMState，不绑死侧栏。
 *
 * buildSidebarTree() = 专为侧栏准备的快捷调用。
 *
 * 所有视觉属性来自 style-registry.ts 注册表。
 * 改注册表 = 改所有盒子，不用动这文件。
 */

import { Box } from '../engine/v2/box.js';
import { KFMState, type FileNode } from './state.js';
import { DIMENSIONS, COLORS, TEXT_STYLES, getFileColor, createBox } from './style-registry.js';

// ============================================================
// 树构建选项
// ============================================================

export interface TreeOptions {
  /** 展开路径集合 */
  expandedPaths: Record<string, boolean>;
  /** 选中的文件/文件夹路径 */
  selectedFile?: string | null;
  /** 点击文件夹 */
  onDirToggle?: (path: string, expand: boolean) => void;
  /** 点击文件 */
  onFileClick?: (path: string) => void;
  /** 首层缩进级数（侧栏从1开始，弹窗从0开始） */
  baseDepth?: number;
  /** 容器宽度（默认SIDEBAR_WIDTH） */
  containerWidth?: number;
  /** 容器是否可滚动（默认true） */
  scrollable?: boolean;
}

// ============================================================
// 内部上下文
// ============================================================

interface BuildCtx {
  expandedPaths: Record<string, boolean>;
  selectedFile: string | null;
  onDirToggle: (path: string, expand: boolean) => void;
  onFileClick: (path: string) => void;
  containerWidth: number;
}

// ============================================================
// 单个文件夹节点（递归）
// ============================================================

function buildFolderBox(
  path: string,
  name: string,
  children: FileNode[],
  depth: number,
  ctx: BuildCtx,
): Box {
  const isExpanded = !!ctx.expandedPaths[path];
  const indent = DIMENSIONS.INDENT * depth + DIMENSIONS.ROW_PAD;
  const cw = ctx.containerWidth;

  // --- 标题行 ---
  const titleRow = createBox('folder-row', {
    id: `title-${path}`,
    y: 0,
    width: cw,
    backgroundColor: ctx.selectedFile === path ? COLORS.SELECTED_BG : 'transparent',
    data: { path, isDir: true, isExpanded },
    gesture: {
      passive: true,
      onTap: () => ctx.onDirToggle(path, !isExpanded),
    },
  });

  // 折叠三角
  const toggleIcon = createBox('toggle-icon', {
    id: `toggle-${path}`,
    x: indent,
  });
  toggleIcon.textStyle = {
    ...TEXT_STYLES.toggleIcon,
    content: isExpanded ? '▼' : '▶',
    color: COLORS.ACCENT,
  };
  titleRow.addChild(toggleIcon);

  // 标题文字
  const titleLabel = createBox('folder-label', {
    id: `label-${path}`,
    x: indent + DIMENSIONS.TRIANGLE_SIZE + DIMENSIONS.TRIANGLE_GAP,
    width: cw - indent - DIMENSIONS.TRIANGLE_SIZE - DIMENSIONS.TRIANGLE_GAP - DIMENSIONS.ROW_PAD,
  });
  titleLabel.textStyle = {
    ...TEXT_STYLES.folderLabel,
    content: path === '/root' ? 'root' : name,
    color: COLORS.DIR,
  };
  titleRow.addChild(titleLabel);

  // --- 子项 ---
  const subItems: Box[] = [];
  let currentY = titleRow.y + DIMENSIONS.BOX_HEIGHT;

  if (isExpanded) {
    for (const item of children) {
      if (item.isDir) {
        const folderBox = buildFolderBox(item.path, item.name, item.children || [], depth + 1, ctx);
        folderBox.y = currentY;
        subItems.push(folderBox);
        currentY += folderBox.height;
      } else {
        const fileRow = createBox('file-row', {
          id: `file-${item.path}`,
          y: currentY,
          backgroundColor: ctx.selectedFile === item.path ? COLORS.SELECTED_BG : 'transparent',
          data: { path: item.path, isDir: false },
          gesture: {
            passive: true,
            onTap: () => ctx.onFileClick(item.path),
          },
        });

        const fileLabel = createBox('file-label', {
          id: `label-${item.path}`,
          x: DIMENSIONS.INDENT * (depth + 1) + DIMENSIONS.ROW_PAD,
          width: cw - DIMENSIONS.INDENT * (depth + 1) - DIMENSIONS.ROW_PAD,
        });
        fileLabel.textStyle = {
          ...TEXT_STYLES.fileLabel,
          content: item.name,
          color: getFileColor(item.name),
        };

        fileRow.addChild(fileLabel);
        subItems.push(fileRow);
        currentY += DIMENSIONS.BOX_HEIGHT;
      }
    }
  }

  for (const child of subItems) {
    titleRow.addChild(child);
  }

  const totalChildrenHeight = subItems.reduce((sum, c) => sum + c.height, 0);
  titleRow.height = DIMENSIONS.BOX_HEIGHT + totalChildrenHeight;

  // 左边框
  titleRow.highlight = {
    color: COLORS.ACCENT,
    width: 3,
    side: 'left',
  };

  return titleRow;
}

// ============================================================
// buildTree — 通用文件树构建
// ============================================================

/**
 * 给定一个文件列表，构建完整的 Box 树。
 * 不依赖 KFMState，任何地方都能用。
 *
 * 用法：
 *   const tree = buildTree(files, {
 *     expandedPaths: { '/root/a': true },
 *     onDirToggle: (path, expand) => { ... },
 *   });
 *   renderer.setRoot(tree);
 */
export function buildTree(
  items: FileNode[],
  options: TreeOptions = {},
): Box {
  const {
    expandedPaths,
    selectedFile = null,
    onDirToggle = () => {},
    onFileClick = () => {},
    baseDepth = 0,
    containerWidth = DIMENSIONS.SIDEBAR_WIDTH,
    scrollable = true,
  } = options;

  const ctx: BuildCtx = {
    expandedPaths: expandedPaths ?? {},
    selectedFile,
    onDirToggle,
    onFileClick,
    containerWidth,
  };

  const rootBox = createBox('sidebar-root', {
    id: 'file-tree-root',
    width: containerWidth,
    scrollable,
    scrollY: 0,
    height: 0,
  });

  let currentY = 0;

  for (const item of items) {
    if (item.isDir) {
      const folderBox = buildFolderBox(item.path, item.name, item.children || [], baseDepth, ctx);
      folderBox.y = currentY;
      rootBox.addChild(folderBox);
      currentY += folderBox.height;
    } else {
      const fileRow = createBox('file-row', {
        id: `file-${item.path}`,
        y: currentY,
        backgroundColor: ctx.selectedFile === item.path ? COLORS.SELECTED_BG : 'transparent',
        data: { path: item.path, isDir: false },
        gesture: {
          passive: true,
          onTap: () => ctx.onFileClick(item.path),
        },
      });

      const fileLabel = createBox('file-label', {
        id: `label-${item.path}`,
        x: DIMENSIONS.INDENT * baseDepth + DIMENSIONS.ROW_PAD,
        width: containerWidth - DIMENSIONS.INDENT * baseDepth - DIMENSIONS.ROW_PAD,
      });
      fileLabel.textStyle = {
        ...TEXT_STYLES.fileLabel,
        content: item.name,
        color: getFileColor(item.name),
      };

      fileRow.addChild(fileLabel);
      rootBox.addChild(fileRow);
      currentY += DIMENSIONS.BOX_HEIGHT;
    }
  }

  rootBox.height = currentY;
  rootBox.scrollY = 0;
  return rootBox;
}

// ============================================================
// buildSidebarTree — 侧栏专用快捷调用
// ============================================================

export function buildSidebarTree(): Box {
  const state = KFMState;
  const rootNode = state.files['/root'];
  const items = rootNode?.children ?? [];

  return buildTree(items, {
    expandedPaths: state.expandedPaths,
    selectedFile: state.selectedFile,
    onDirToggle: (path, expand) => state.setExpanded(path, expand),
    onFileClick: (path) => state.selectFile(path),
    baseDepth: 1,
    containerWidth: DIMENSIONS.SIDEBAR_WIDTH,
    scrollable: true,
  });
}