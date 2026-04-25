/**
 * tree-model.ts — 数据建模层
 *
 * 把 KFMState 里的文件树数据映射成 Box 树。
 * 所有视觉属性来自 style-registry.ts 注册表。
 * 改注册表 = 改所有盒子，不用动这文件。
 *
 * 建模规则：
 * - 每个文件夹 = 一个容器 Box（它就是那层盒子）
 * - 文件夹盒子自己带左边框（highlight），高度 = 子项总和
 * - 每个文件 = 一个行 Box，没有子项
 * - 展开/折叠 = 增删子项 → 文件夹盒子高度变化 → 左边框自动延长
 */

import { Box } from '../engine/v2/box.js';
import { KFMState, type FileNode } from './state.js';
import { DIMENSIONS, COLORS, TEXT_STYLES, styleRegistry, getFileColor, createBox } from './style-registry.js';

// ============================================================
// 上下文类型
// ============================================================

interface BuildCtx {
  expandedPaths: Record<string, boolean>;
  selectedFile: string | null;
  onDirToggle: (path: string, expand: boolean) => void;
  onFileClick: (path: string) => void;
}

// ============================================================
// 单个文件夹节点（递归构建 Box 树）
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

  // --- 标题行 ---
  const titleRow = createBox('folder-row', {
    id: `title-${path}`,
    y: 0,
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
    width: DIMENSIONS.SIDEBAR_WIDTH - indent - DIMENSIONS.TRIANGLE_SIZE - DIMENSIONS.TRIANGLE_GAP - DIMENSIONS.ROW_PAD,
  });
  titleLabel.textStyle = {
    ...TEXT_STYLES.folderLabel,
    content: path === '/root' ? 'root' : name,
    color: COLORS.DIR,
  };
  titleRow.addChild(titleLabel);

  // --- 子项容器 ---
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
          width: DIMENSIONS.SIDEBAR_WIDTH - DIMENSIONS.INDENT * (depth + 1) - DIMENSIONS.ROW_PAD,
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

  // 把子项全挂到标题行下
  for (const child of subItems) {
    titleRow.addChild(child);
  }

  // 总高度 = 标题行 + 所有子项
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
// 构建根文件夹
// ============================================================

export function buildSidebarTree(): Box {
  const state = KFMState;

  const rootBox = createBox('sidebar-root', {
    id: 'sidebar-root',
  });

  let currentY = 0;
  const ctx: BuildCtx = {
    expandedPaths: state.expandedPaths,
    selectedFile: state.selectedFile,
    onDirToggle: (path: string, expand: boolean) => state.setExpanded(path, expand),
    onFileClick: (path: string) => state.selectFile(path),
  };

  const rootNode = state.files['/root'];
  const filesList = rootNode?.children ?? [];

  for (const item of filesList) {
    if (item.isDir) {
      const folderBox = buildFolderBox(item.path, item.name, item.children || [], 1, ctx);
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
        x: DIMENSIONS.INDENT + DIMENSIONS.ROW_PAD,
        width: DIMENSIONS.SIDEBAR_WIDTH - DIMENSIONS.INDENT - DIMENSIONS.ROW_PAD,
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
