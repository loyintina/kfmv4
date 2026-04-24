/**
 * tree-model.ts — 数据建模层
 *
 * 把 KFMState 里的文件树数据映射成 Box 树。
 * 纯数据转换，不做任何渲染。
 *
 * 建模规则：
 * - 每个文件夹 = 一个容器 Box（它就是那层盒子）
 * - 文件夹盒子自己带左边框（highlight），高度 = 子项总和，引导线自延伸
 * - 每个文件 = 一个行 Box（32px），没有子项
 * - 文件夹盒子内容 = 标题行(32px) + 展开时所有子项平铺在 children 里
 * - 子项缩进 = depth+1 级
 * - 展开/折叠 = 增删子项 → 文件夹盒子高度变化 → 左边框自动延长
 */

import { Box } from '../engine/v2/box.js';
import { KFMState, type FileNode } from './state.js';

// ============================================================
// 常量（对齐原版 kfm sidebar.css + base.css）
// ============================================================

const BOX_HEIGHT = 32;              // .tree-row 高度推算
const SIDEBAR_WIDTH = 280;          // .sidebar width
const INDENT = 18;                  // 每层缩进：原版 10px(margin-left) + 8px(padding-left) ≈ 18px
const ROW_PAD = 8;                  // .tree-row padding 4px 8px
const DIR_COLOR = '#7c3aed';        // var(--primary)
const FILE_COLOR = '#e0e0e0';       // var(--text)
const ACCENT_COLOR = '#00d4ff';     // var(--accent) 引导线/折叠三角颜色
const TRIANGLE_SIZE = 10;           // .tree-toggle::before font-size: 10px
const TRIANGLE_GAP = 6;            // .tree-toggle margin-right: 6px

// ============================================================
// 文件扩展名 → 颜色映射
// ============================================================

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return FILE_COLOR;
  const map: Record<string, string> = {
    ts: '#3178c6', js: '#f7df1e', json: '#292929',
    html: '#e34f26', css: '#1572b6', md: '#083fa1',
    py: '#3776ab', rs: '#dea584', go: '#00add8',
    rsync: '#7c3aed', zip: '#f39c12', gz: '#f39c12',
    tar: '#f39c12', bak: '#888', old: '#888',
  };
  return map[ext] || FILE_COLOR;
}

// ============================================================
// 单个文件夹节点（递归构建 Box 树）
// ============================================================

function buildFolderBox(
  path: string,
  name: string,
  children: FileNode[],
  depth: number,
  ctx: { expandedPaths: Record<string, boolean>; selectedFile: string | null; onDirToggle: (path: string, expand: boolean) => void; onFileClick: (path: string) => void },
): Box {
  const isExpanded = !!ctx.expandedPaths[path];
  const indent = INDENT * depth + ROW_PAD;

  // --- 标题行 ---
  const titleRow = new Box({
    id: `title-${path}`,
    x: 0,
    y: 0,
    width: SIDEBAR_WIDTH,
    height: BOX_HEIGHT,
    backgroundColor: ctx.selectedFile === path ? 'rgba(124,58,237,0.15)' : 'transparent',
    borderRadius: 0,
    interactive: true,
    overflow: 'hidden',
    data: { path, isDir: true, isExpanded },
    gesture: {
      passive: true,
      onTap: () => ctx.onDirToggle(path, !isExpanded),
    },
  });

  // 折叠三角
  const toggleIcon = new Box({
    id: `toggle-${path}`,
    x: indent,
    y: 0,
    width: TRIANGLE_SIZE,
    height: BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
  });
  toggleIcon.textStyle = {
    content: isExpanded ? '▼' : '▶',
    color: ACCENT_COLOR,
    font: `${TRIANGLE_SIZE}px system-ui, sans-serif`,
    lineHeight: BOX_HEIGHT,
    align: 'center',
    verticalAlign: 'middle',
  };
  titleRow.addChild(toggleIcon);

  // 标题文字
  const titleLabel = new Box({
    id: `label-${path}`,
    x: indent + TRIANGLE_SIZE + TRIANGLE_GAP,
    y: 0,
    width: SIDEBAR_WIDTH - indent - TRIANGLE_SIZE - TRIANGLE_GAP - ROW_PAD,
    height: BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
  });
  titleLabel.textStyle = {
    content: path === '/root' ? 'root' : name,
    color: DIR_COLOR,
    font: '13px system-ui, sans-serif',
    lineHeight: BOX_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    overflow: 'ellipsis',
    maxLines: 1,
  };
  titleRow.addChild(titleLabel);

  // --- 子项容器 ---
  const subItems: Box[] = [];
  let currentY = titleRow.y + BOX_HEIGHT;

  if (isExpanded) {
    for (const item of children) {
      if (item.isDir) {
        const folderBox = buildFolderBox(item.path, item.name, item.children || [], depth + 1, ctx);
        folderBox.y = currentY;
        subItems.push(folderBox);
        currentY += folderBox.height;
      } else {
        const fileRow = new Box({
          id: `file-${item.path}`,
          x: 0,
          y: currentY,
          width: SIDEBAR_WIDTH,
          height: BOX_HEIGHT,
          backgroundColor: ctx.selectedFile === item.path ? 'rgba(124,58,237,0.15)' : 'transparent',
          borderRadius: 0,
          interactive: true,
          overflow: 'hidden',
          data: { path: item.path, isDir: false },
          gesture: {
            passive: true,
            onTap: () => ctx.onFileClick(item.path),
          },
        });

        const fileLabel = new Box({
          id: `label-${item.path}`,
          x: INDENT * (depth + 1) + ROW_PAD,
          y: 0,
          width: SIDEBAR_WIDTH - INDENT * (depth + 1) - ROW_PAD,
          height: BOX_HEIGHT,
          backgroundColor: 'transparent',
          borderRadius: 0,
        });

        fileLabel.textStyle = {
          content: item.name,
          color: getFileColor(item.name),
          font: '13px system-ui, sans-serif',
          lineHeight: BOX_HEIGHT,
          align: 'left',
          verticalAlign: 'middle',
          overflow: 'ellipsis',
          maxLines: 1,
        };

        fileRow.addChild(fileLabel);
        subItems.push(fileRow);
        currentY += BOX_HEIGHT;
      }
    }
  }

  // 把标题行和子项全部设为 titleRow 的 children
  for (const child of subItems) {
    titleRow.addChild(child);
  }

  // 计算总高度：标题行 + 所有子项高度之和
  const totalChildrenHeight = subItems.reduce((sum, c) => sum + c.height, 0);
  titleRow.height = BOX_HEIGHT + totalChildrenHeight;

  // 左边框（highlight）—— 让文件夹盒子自身带颜色边框
  titleRow.highlight = {
    color: ACCENT_COLOR,
    width: 3,
    side: 'left',
  };

  return titleRow;
}

// ============================================================
// 构建根文件夹（递归展开所有可见节点）
// ============================================================

export function buildSidebarTree(): Box {
  const state = KFMState;

  const rootBox = new Box({
    id: 'sidebar-root',
    x: 0,
    y: 0,
    width: SIDEBAR_WIDTH,
    height: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'hidden',
  });

  let currentY = 0;
  const ctx = {
    expandedPaths: state.expandedPaths,
    selectedFile: state.selectedFile,
    onDirToggle: (path: string, expand: boolean) => state.setExpanded(path, expand),
    onFileClick: (path: string) => state.selectFile(path),
  };

  // 直接渲染 /root 下的所有子项
  const rootNode = state.files['/root'];
  const filesList = rootNode?.children ?? [];
  for (const item of filesList) {
    if (item.isDir) {
      const folderBox = buildFolderBox(item.path, item.name, item.children || [], 1, ctx);
      folderBox.y = currentY;
      rootBox.addChild(folderBox);
      currentY += folderBox.height;
    } else {
      const fileRow = new Box({
        id: `file-${item.path}`,
        x: 0,
        y: currentY,
        width: SIDEBAR_WIDTH,
        height: BOX_HEIGHT,
        backgroundColor: ctx.selectedFile === item.path ? 'rgba(124,58,237,0.15)' : 'transparent',
        borderRadius: 0,
        interactive: true,
        overflow: 'hidden',
        data: { path: item.path, isDir: false },
        gesture: {
          passive: true,
          onTap: () => ctx.onFileClick(item.path),
        },
      });

      const fileLabel = new Box({
        id: `label-${item.path}`,
        x: INDENT + ROW_PAD,
        y: 0,
        width: SIDEBAR_WIDTH - INDENT - ROW_PAD,
        height: BOX_HEIGHT,
        backgroundColor: 'transparent',
        borderRadius: 0,
      });

      fileLabel.textStyle = {
        content: item.name,
        color: getFileColor(item.name),
        font: '13px system-ui, sans-serif',
        lineHeight: BOX_HEIGHT,
        align: 'left',
        verticalAlign: 'middle',
        overflow: 'ellipsis',
        maxLines: 1,
      };

      fileRow.addChild(fileLabel);
      rootBox.addChild(fileRow);
      currentY += BOX_HEIGHT;
    }
  }

  rootBox.height = currentY;

  // 添加滚动监听
  rootBox.scrollY = 0;
  return rootBox;
}