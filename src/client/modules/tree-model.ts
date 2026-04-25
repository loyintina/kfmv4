/**
 * tree-model.ts — 数据建模层
 *
 * 核心 API 是 buildTree() 通用函数。
 *
 * 建模规则（正确嵌套）：
 *  - 根目录是一个无左边框的大盒子，里面全是文字行。
 *  - 每个文件夹标题行 = 一个纯文字行（可点击）。
 *  - 文件夹展开时，在标题行下面**插入一个带左边框的子容器盒子**，
 *    里面放该目录的所有子项（文件行/递归文件夹区域）。
 *  - 子项按深度缩进。
 */

import { Box } from '../engine/v2/box.js';
import { KFMState, type FileNode } from './state.js';
import { DIMENSIONS, COLORS, TEXT_STYLES, getFileColor, createBox } from './style-registry.js';

// ============================================================
// 树构建选项
// ============================================================

export interface TreeOptions {
  expandedPaths: Record<string, boolean>;
  selectedFile?: string | null;
  onDirToggle?: (path: string, expand: boolean) => void;
  onFileClick?: (path: string) => void;
  baseDepth?: number;
  containerWidth?: number;
  scrollable?: boolean;
}

interface BuildCtx {
  expandedPaths: Record<string, boolean>;
  selectedFile: string | null;
  onDirToggle: (path: string, expand: boolean) => void;
  onFileClick: (path: string) => void;
  containerWidth: number;
}

// ============================================================
// 构建一个文件夹展开区域（带左边框的盒子）
// ============================================================

/**
 * 返回一个带蓝色左边框的容器，里面包含该文件夹的所有子项。
 * 展开/折叠时才会创建或销毁这个盒子。
 */
function buildExpandedContainer(
  path: string,
  children: FileNode[],
  depth: number,
  ctx: BuildCtx,
): Box {
  const cw = ctx.containerWidth;
  const container = createBox('folder-container', {
    id: `expanded-${path}`,
    width: cw,
    height: 0,
    x: 0,
    y: 0,
  });
  container.border = {
    color: COLORS.DIR,
    width: 1,
    sides: ['top', 'bottom', 'left', 'right'],
  };

  let currentY = 0;

  // 数据未加载 → 占位行"…"，让紫色边框立刻可见
  if (children.length === 0) {
    const loadingRow = createBox('file-row', {
      id: `loading-${path}`,
      x: 0,
      y: currentY,
      width: cw,
      height: DIMENSIONS.BOX_HEIGHT,
      backgroundColor: 'transparent',
      data: { path, loading: true },
    });
    const loadingLabel = createBox('file-label', {
      id: `loading-label-${path}`,
      x: DIMENSIONS.INDENT * (depth + 1) + DIMENSIONS.ROW_PAD,
      width: cw - DIMENSIONS.INDENT * (depth + 1) - DIMENSIONS.ROW_PAD,
    });
    loadingLabel.textStyle = {
      ...TEXT_STYLES.fileLabel,
      content: '…',
      color: COLORS.FILE,
    };
    loadingRow.addChild(loadingLabel);
    container.addChild(loadingRow);
    currentY += DIMENSIONS.BOX_HEIGHT;
    container.height = currentY;
    return container;
  }

  for (const item of children) {
    if (item.isDir) {
      // 子文件夹：先文字行，再展开区域
      const subDepth = depth + 1;
      const subIndent = DIMENSIONS.INDENT * subDepth + DIMENSIONS.ROW_PAD;

      // 子文件夹标题行（纯文字，无边框）
      const subTitleRow = createBox('folder-row', {
        id: `title-${item.path}`,
        x: 0,
        y: currentY,
        width: cw,
        height: DIMENSIONS.BOX_HEIGHT,
        backgroundColor: ctx.selectedFile === item.path ? COLORS.SELECTED_BG : 'transparent',
        data: { path: item.path, isDir: true, isExpanded: !!ctx.expandedPaths[item.path] },
        gesture: {
          passive: true,
          onTap: () => ctx.onDirToggle(item.path, !ctx.expandedPaths[item.path]),
        },
      });

      // 三角
      const subToggle = createBox('toggle-icon', {
        id: `toggle-${item.path}`,
        x: subIndent,
      });
      subToggle.textStyle = {
        ...TEXT_STYLES.toggleIcon,
        content: ctx.expandedPaths[item.path] ? '▼' : '▶',
        color: COLORS.ACCENT,
      };
      subTitleRow.addChild(subToggle);

      // 名称
      const subLabel = createBox('folder-label', {
        id: `label-${item.path}`,
        x: subIndent + DIMENSIONS.TRIANGLE_SIZE + DIMENSIONS.TRIANGLE_GAP,
        width: cw - subIndent - DIMENSIONS.TRIANGLE_SIZE - DIMENSIONS.TRIANGLE_GAP - DIMENSIONS.ROW_PAD,
      });
      subLabel.textStyle = {
        ...TEXT_STYLES.folderLabel,
        content: item.name,
        color: COLORS.DIR,
      };
      subTitleRow.addChild(subLabel);

      container.addChild(subTitleRow);
      currentY += DIMENSIONS.BOX_HEIGHT;

      // 子文件夹展开→递归插入子容器
      if (ctx.expandedPaths[item.path]) {
        const children = KFMState.files[item.path]?.children ?? item.children ?? [];
        const subContainer = buildExpandedContainer(item.path, children, subDepth, ctx);
        subContainer.y = currentY;
        container.addChild(subContainer);
        currentY += subContainer.height;
      }
    } else {
      // 文件行
      const fileIndent = DIMENSIONS.INDENT * (depth + 1) + DIMENSIONS.ROW_PAD;
      const fileRow = createBox('file-row', {
        id: `file-${item.path}`,
        x: 0,
        y: currentY,
        width: cw,
        height: DIMENSIONS.BOX_HEIGHT,
        backgroundColor: ctx.selectedFile === item.path ? COLORS.SELECTED_BG : 'transparent',
        data: { path: item.path, isDir: false },
        gesture: {
          passive: true,
          onTap: () => ctx.onFileClick(item.path),
        },
      });

      const fileLabel = createBox('file-label', {
        id: `label-${item.path}`,
        x: fileIndent,
        width: cw - fileIndent - DIMENSIONS.ROW_PAD,
      });
      fileLabel.textStyle = {
        ...TEXT_STYLES.fileLabel,
        content: item.name,
        color: getFileColor(item.name),
      };

      fileRow.addChild(fileLabel);
      container.addChild(fileRow);
      currentY += DIMENSIONS.BOX_HEIGHT;
    }
  }

  container.height = currentY;
  return container;
}

// ============================================================
// buildTree — 通用文件树构建
// ============================================================

export function buildTree(
  items: FileNode[],
  options: TreeOptions = {},
): Box {
  const {
    expandedPaths = {},
    selectedFile = null,
    onDirToggle = () => {},
    onFileClick = () => {},
    baseDepth = 0,
    containerWidth = DIMENSIONS.SIDEBAR_WIDTH,
    scrollable = true,
  } = options;

  const ctx: BuildCtx = {
    expandedPaths,
    selectedFile,
    onDirToggle,
    onFileClick,
    containerWidth,
  };

  // 根目录大盒子：无左边框，纯文本流容器
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
      // 文件夹标题行（纯文字，无边框）
      const indent = DIMENSIONS.INDENT * baseDepth + DIMENSIONS.ROW_PAD;
      const titleRow = createBox('folder-row', {
        id: `title-${item.path}`,
        x: 0,
        y: currentY,
        width: containerWidth,
        height: DIMENSIONS.BOX_HEIGHT,
        backgroundColor: ctx.selectedFile === item.path ? COLORS.SELECTED_BG : 'transparent',
        data: { path: item.path, isDir: true, isExpanded: !!ctx.expandedPaths[item.path] },
        gesture: {
          passive: true,
          onTap: () => ctx.onDirToggle(item.path, !ctx.expandedPaths[item.path]),
        },
      });

      // 三角
      const toggleIcon = createBox('toggle-icon', {
        id: `toggle-${item.path}`,
        x: indent,
      });
      toggleIcon.textStyle = {
        ...TEXT_STYLES.toggleIcon,
        content: ctx.expandedPaths[item.path] ? '▼' : '▶',
        color: COLORS.ACCENT,
      };
      titleRow.addChild(toggleIcon);

      // 名称
      const titleLabel = createBox('folder-label', {
        id: `label-${item.path}`,
        x: indent + DIMENSIONS.TRIANGLE_SIZE + DIMENSIONS.TRIANGLE_GAP,
        width: containerWidth - indent - DIMENSIONS.TRIANGLE_SIZE - DIMENSIONS.TRIANGLE_GAP - DIMENSIONS.ROW_PAD,
      });
      titleLabel.textStyle = {
        ...TEXT_STYLES.folderLabel,
        content: item.name,
        color: COLORS.DIR,
      };
      titleRow.addChild(titleLabel);

      rootBox.addChild(titleRow);
      currentY += DIMENSIONS.BOX_HEIGHT;

      // 展开 → 插入带边框的子容器（数据从 KFMState.files 读取，尚未异步加载时为 item.children 后备）
      if (ctx.expandedPaths[item.path]) {
        const cached = KFMState.files[item.path]?.children;
        const children = cached ?? item.children ?? [];
        const expandedContainer = buildExpandedContainer(item.path, children, baseDepth, ctx);
        expandedContainer.y = currentY;
        rootBox.addChild(expandedContainer);
        currentY += expandedContainer.height;
      }
    } else {
      // 文件行
      const indent = DIMENSIONS.INDENT * baseDepth + DIMENSIONS.ROW_PAD;
      const fileRow = createBox('file-row', {
        id: `file-${item.path}`,
        x: 0,
        y: currentY,
        width: containerWidth,
        height: DIMENSIONS.BOX_HEIGHT,
        backgroundColor: ctx.selectedFile === item.path ? COLORS.SELECTED_BG : 'transparent',
        data: { path: item.path, isDir: false },
        gesture: {
          passive: true,
          onTap: () => ctx.onFileClick(item.path),
        },
      });

      const fileLabel = createBox('file-label', {
        id: `label-${item.path}`,
        x: indent,
        width: containerWidth - indent - DIMENSIONS.ROW_PAD,
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