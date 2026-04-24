/**
 * KFM v3 — Flex 布局算法
 *
 * 决策：A-002（三层解耦）
 * 创建：2026-04-13
 * 维护：卡萝
 *
 * 实现基础 Flex 布局能力，使 Box 的 children 能自动排列。
 * 支持特性：direction / justify / align / flex-grow / gap
 * 暂不支持：wrap / flex-shrink / flex-basis 复杂计算
 */

import type { FlexStyle, FlexItemStyle, Box } from './types.js';

/** 默认 Flex 样式 */
const DEFAULT_FLEX: Required<FlexStyle> = {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  flexWrap: 'nowrap',
  gap: 0,
  rowGap: 0,
  columnGap: 0,
};

/** 默认 Flex Item 样式 */
const DEFAULT_FLEX_ITEM: Required<FlexItemStyle> = {
  flex: 0,
  flexShrink: 1,
  flexBasis: 'auto',
  alignSelf: 'auto',
  minWidth: 0,
  maxWidth: Infinity,
  minHeight: 0,
  maxHeight: Infinity,
};

/**
 * 应用 Flex 布局到父容器的子元素
 * 只处理 parent.layout 存在的 Box
 * 布局计算只修改子元素的 x/y/width/height，不修改父元素
 */
export function applyFlexLayout(parent: Box): void {
  if (!parent.layout) return;
  if (parent.children.length === 0) return;

  const layout = parent.layout;
  const style: Required<FlexStyle> = { ...DEFAULT_FLEX, ...layout };
  const isRow = style.flexDirection === 'row' || style.flexDirection === 'row-reverse';
  const isReverse = style.flexDirection === 'row-reverse' || style.flexDirection === 'column-reverse';

  // 获取 gap：rowGap/columnGap 优先，fallback 到 gap
  const gap = layout.gap ?? 0;
  const rowGap = layout.rowGap ?? gap;
  const columnGap = layout.columnGap ?? gap;
  
  // 根据 direction 决定 main gap 和 cross gap
  const mainGap = isRow ? columnGap : rowGap;
  const crossGap = isRow ? rowGap : columnGap;

  // 父容器内容区域（去掉 padding）
  const contentX = parent.padding.left;
  const contentY = parent.padding.top;
  const contentWidth = parent.width - parent.padding.left - parent.padding.right;
  const contentHeight = parent.height - parent.padding.top - parent.padding.bottom;

  // 收集子元素
  const children = parent.children.slice(); // 复制，避免修改原数组

  // ===== 第一遍：计算每个子元素的主轴尺寸 =====
  // 考虑 flex / flexBasis / minWidth / maxWidth

  interface ChildLayout {
    child: Box;
    itemStyle: Required<FlexItemStyle>;
    mainSize: number;   // 主轴尺寸（width 或 height）
    crossSize: number;   // 交叉轴尺寸
    mainPos: number;     // 主轴位置
    crossPos: number;    // 交叉轴位置
    flexGrow: number;
  }

  const layouts: ChildLayout[] = children.map(child => {
    const itemStyle: Required<FlexItemStyle> = { ...DEFAULT_FLEX_ITEM, ...child.layoutItem };
    
    // 初始尺寸
    let mainSize = isRow ? child.width : child.height;
    let crossSize = isRow ? child.height : child.width;

    // flexBasis 覆盖
    if (itemStyle.flexBasis !== 'auto') {
      mainSize = itemStyle.flexBasis;
    }

    // 应用 min/max 约束
    if (isRow) {
      mainSize = Math.max(itemStyle.minWidth, Math.min(itemStyle.maxWidth, mainSize));
      crossSize = Math.max(itemStyle.minHeight, Math.min(itemStyle.maxHeight, crossSize));
    } else {
      mainSize = Math.max(itemStyle.minHeight, Math.min(itemStyle.maxHeight, mainSize));
      crossSize = Math.max(itemStyle.minWidth, Math.min(itemStyle.maxWidth, crossSize));
    }

    return {
      child,
      itemStyle,
      mainSize,
      crossSize,
      mainPos: 0,
      crossPos: 0,
      flexGrow: itemStyle.flex ?? 0,
    };
  });

  // ===== 第二遍：分配剩余空间（flex-grow）=====

  const totalFlexGrow = layouts.reduce((sum, l) => sum + l.flexGrow, 0);
  const totalMainSize = layouts.reduce((sum, l) => sum + l.mainSize, 0);
  const totalGaps = mainGap * (children.length - 1);
  const availableMainSpace = isRow ? contentWidth : contentHeight;
  const remainingSpace = availableMainSpace - totalMainSize - totalGaps;

  if (totalFlexGrow > 0 && remainingSpace > 0) {
    // 有 flex-grow，分配剩余空间
    layouts.forEach(l => {
      if (l.flexGrow > 0) {
        const extra = (remainingSpace * l.flexGrow) / totalFlexGrow;
        l.mainSize += extra;
        
        // 再次应用 max 约束
        if (isRow) {
          l.mainSize = Math.min(l.itemStyle.maxWidth, l.mainSize);
        } else {
          l.mainSize = Math.min(l.itemStyle.maxHeight, l.mainSize);
        }
      }
    });
  }

  // ===== 第三遍：根据 justifyContent 分配主轴位置 =====

  // 重新计算总尺寸（因为 flex-grow 可能改变了尺寸）
  const finalTotalMainSize = layouts.reduce((sum, l) => sum + l.mainSize, 0);
  const finalRemaining = availableMainSpace - finalTotalMainSize - totalGaps;

  let mainOffset = contentX;
  let gapBetween = mainGap;

  switch (style.justifyContent) {
    case 'flex-start':
      mainOffset = contentX;
      break;
    case 'flex-end':
      mainOffset = contentX + finalRemaining;
      break;
    case 'center':
      mainOffset = contentX + finalRemaining / 2;
      break;
    case 'space-between':
      mainOffset = contentX;
      if (children.length > 1) {
        gapBetween = mainGap + finalRemaining / (children.length - 1);
      }
      break;
    case 'space-around':
      if (children.length > 0) {
        const spacePer = finalRemaining / children.length;
        mainOffset = contentX + spacePer / 2;
        gapBetween = mainGap + spacePer;
      }
      break;
    case 'space-evenly':
      if (children.length > 0) {
        const spacePer = finalRemaining / (children.length + 1);
        mainOffset = contentX + spacePer;
        gapBetween = mainGap + spacePer;
      }
      break;
  }

  // 处理 reverse
  if (isReverse) {
    // 反向排列：从右/下开始
    mainOffset = isRow
      ? contentX + contentWidth - layouts[0].mainSize
      : contentY + contentHeight - layouts[0].mainSize;
    
    // 先按正常顺序计算位置，然后反向
    let pos = mainOffset;
    layouts.forEach((l, i) => {
      l.mainPos = pos;
      pos -= l.mainSize + gapBetween;
    });
  } else {
    // 正向排列
    let pos = mainOffset;
    layouts.forEach((l, i) => {
      l.mainPos = pos;
      pos += l.mainSize + gapBetween;
    });
  }

  // ===== 第四遍：根据 alignItems 分配交叉轴位置 =====

  const crossSpace = isRow ? contentHeight : contentWidth;
  const crossStart = isRow ? contentY : contentX;

  layouts.forEach(l => {
    // alignSelf 可以覆盖父容器的 alignItems
    const align = l.itemStyle.alignSelf === 'auto' ? style.alignItems : l.itemStyle.alignSelf;

    switch (align) {
      case 'flex-start':
        l.crossPos = crossStart;
        break;
      case 'flex-end':
        l.crossPos = crossStart + crossSpace - l.crossSize;
        break;
      case 'center':
        l.crossPos = crossStart + (crossSpace - l.crossSize) / 2;
        break;
      case 'stretch':
        // stretch: 交叉轴方向拉伸到容器大小
        l.crossSize = crossSpace;
        l.crossPos = crossStart;
        break;
    }
  });

  // ===== 应用布局结果到子元素 =====

  layouts.forEach(l => {
    if (isRow) {
      l.child.x = l.mainPos;
      l.child.y = l.crossPos;
      l.child.width = l.mainSize;
      l.child.height = l.crossSize;
    } else {
      l.child.x = l.crossPos;
      l.child.y = l.mainPos;
      l.child.width = l.crossSize;
      l.child.height = l.mainSize;
    }
  });
}