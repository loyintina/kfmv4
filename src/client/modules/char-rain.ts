/**
 * char-rain.ts — 字符散落/回收动画
 *
 * 在文件树展开时，将文字拆分为独立字符，
 * 每个字符从页面顶端散落掉落到目标位置。
 * 折叠时同理，字符从当前位置往回飞到屏幕上方。
 *
 * 展开和回收共用同一套字符创建逻辑，仅动画方向和参数不同。
 *
 * 双树设计：字符盒子建在 overlay 树的容器克隆上，不碰主树。
 * 主树的 container 参数仅用于读取行数据（标签文字、字体、颜色等）。
 */

import { Box } from "../engine/v2/box.js";
import { FONT, LINE_HEIGHT, MAX_LINES } from "./style-registry.js";
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";
import type { AnimTimeline } from "./animation-registry.js";
import { DOM } from "./dom-refs.js";
import { debugLog } from "./debug-panel.js";

// ============================================================
// cleanup 信息（供外部在动画完成时清理字符 Box）
// ============================================================

export interface CharRainCleanup {
  /** overlay 容器（字符盒在此创建，cleanup 时从此移除） */
  container: Box;
  charBoxes: Box[];
}

// ============================================================
// 核心：给定行列表，为每行创建字符雨动画
// ============================================================

/**
 * 核心函数：为 explicit 行列表创建字符雨动画。
 *
 * @param rows           要动画的行（main tree 的 title-* / file-* Box）
 * @param rowTargetYs    每行的最终 y（与 rows 同顺序）
 * @param referenceBox   用于计算 topY 的参考 Box（通常是行们的父容器）
 * @param overlayContainer 字符盒创建在此（charLayer）
 * @param root           文件树根 Box
 * @param tl             timeline
 * @param baseDelay      起始延迟
 * @param direction      'expand' 或 'collapse'
 */
function _charRainCore(
  rows: Box[],
  rowTargetYs: number[] | undefined,
  referenceBox: Box,
  overlayContainer: Box,
  root: Box,
  tl: AnimTimeline,
  baseDelay: number,
  direction: 'expand' | 'collapse',
): CharRainCleanup | null {
  const isCollapse = direction === 'collapse';
  if (rows.length === 0) return null;

  const canvas = DOM.treeCanvas;
  const ctx = canvas?.getContext("2d");
  if (!ctx) return null;

  const charBoxes: Box[] = [];
  const BASE_DUR = 0.22;
  const scrollY = root.scrollY ?? 0;
  const absY = referenceBox.getAbsolutePosition().y;
  const topY = scrollY - absY;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowExpandedY = rowTargetYs?.[rowIdx] ?? row.y;
    const label = row.children.find((c) => c.id?.startsWith("label-"));
    if (!label || !label.textStyle?.content) {
      debugLog(`[charRain] SKIP row[${rowIdx}] id=${row.id} label=${!!label} content=${!!label?.textStyle?.content}`);
      continue;
    }

    const text = label.textStyle.content;
    const font = label.textStyle.font || FONT;
    const color = label.textStyle.color;
    const lineH = label.textStyle.lineHeight || LINE_HEIGHT;

    ctx.font = font;

    // 用 Pretext 获取多行排版信息
    let layoutLines: { text: string; width: number }[];
    try {
      const prepared = prepareWithSegments(text, font);
      const layout = layoutWithLines(prepared, label.width, lineH);
      layoutLines = layout.lines;
    } catch {
      layoutLines = [{ text, width: ctx.measureText(text).width }];
    }

    const maxVis = label.textStyle.maxLines || MAX_LINES;
    const isTrunc = layoutLines.length > maxVis;
    const visLines = layoutLines.slice(0, maxVis);

    const totalTextHeight = visLines.length * lineH;
    const verticalOffset = Math.max(0, (row.height - totalTextHeight) / 2);

    for (let li = 0; li < visLines.length; li++) {
      const line = visLines[li];
      let chars: string[];

      if (li === maxVis - 1 && isTrunc) {
        chars = [...line.text.slice(0, -1), "\u2026"];
      } else {
        chars = [...line.text];
      }

      const charWidths = chars.map((ch) => ctx.measureText(ch).width);

      let cx = 0;
      for (let ci = 0; ci < chars.length; ci++) {
        const fromX = row.x + label.x + cx;
        const fromY = rowExpandedY + label.y + verticalOffset + li * lineH;

        const randDelay = Math.random() * 0.1 + baseDelay;
        const randDur = BASE_DUR + Math.random() * 0.06;

        if (isCollapse) {
          const toX = fromX + (Math.random() - 0.5) * 100;
          const toY = topY - 80 - Math.random() * 140;
          const box = new Box({
            id: `cc-${row.id}-L${li}-C${ci}`,
            x: fromX, y: fromY,
            width: charWidths[ci] + 2, height: lineH,
            opacity: 1,
            backgroundColor: "transparent",
            interactive: false,
            zIndex: 99,
            overflow: "visible",
          });
          box.textStyle = {
            content: chars[ci], color, font,
            lineHeight: lineH, align: "left",
            verticalAlign: "middle", overflow: "visible", maxLines: 1,
          };
          overlayContainer.addChild(box);
          charBoxes.push(box);

          tl.to(box, {
            x: toX, y: toY, opacity: 0,
            duration: randDur,
            ease: "back.in(1.05)",
          }, randDelay);
        } else {
          const initX = fromX + (Math.random() - 0.5) * 100;
          const initY = fromY - 80 - Math.random() * 140;
          const box = new Box({
            id: `cr-${row.id}-L${li}-C${ci}`,
            x: initX, y: initY,
            width: charWidths[ci] + 2, height: lineH,
            opacity: 0,
            backgroundColor: "transparent",
            interactive: false,
            zIndex: 99,
            overflow: "visible",
          });
          box.textStyle = {
            content: chars[ci], color, font,
            lineHeight: lineH, align: "left",
            verticalAlign: "middle", overflow: "visible", maxLines: 1,
          };
          overlayContainer.addChild(box);
          charBoxes.push(box);

          tl.to(box, {
            x: fromX, y: fromY, opacity: 1,
            duration: randDur,
            ease: "back.out(1.05)",
          }, randDelay);
        }

        cx += charWidths[ci];
      }
    }
    debugLog(`[charRain] row[${rowIdx}] id=${row.id} text="${text}" y=${rowExpandedY}`);

    // toggle 图标
    const toggleBox = row.children.find((c) => c.id?.startsWith("toggle-"));
    if (toggleBox && toggleBox.textStyle?.content) {
      const tFont = toggleBox.textStyle.font || font;
      ctx.font = tFont;
      const tTargetX = row.x + toggleBox.x;
      const tTargetY = rowExpandedY + toggleBox.y;
      const tRandDelay = Math.random() * 0.1 + baseDelay;
      const tRandDur = BASE_DUR + Math.random() * 0.06;

      if (isCollapse) {
        const tToX = tTargetX + (Math.random() - 0.5) * 100;
        const tToY = topY - 80 - Math.random() * 140;
        const tBox = new Box({
          id: `cc-${row.id}-toggle`,
          x: tTargetX, y: tTargetY,
          width: toggleBox.width, height: toggleBox.height || LINE_HEIGHT,
          opacity: 1,
          backgroundColor: "transparent",
          interactive: false, zIndex: 99, overflow: "visible",
        });
        tBox.textStyle = { ...toggleBox.textStyle, overflow: "visible", maxLines: 1 };
        // 折叠 toggle 从主树当前旋转开始（展开态是 PI/2）
        tBox.transform.rotate = toggleBox.transform.rotate;
        overlayContainer.addChild(tBox);
        charBoxes.push(tBox);
        tl.to(tBox, {
          x: tToX, y: tToY, opacity: 0,
          duration: tRandDur, ease: "back.in(1.05)",
        }, tRandDelay);
        tl.to(tBox.transform, {
          rotate: 0, duration: tRandDur,
          ease: "back.in(1.05)",
        }, tRandDelay);
      } else {
        const tInitX = tTargetX + (Math.random() - 0.5) * 100;
        const tInitY = tTargetY - 80 - Math.random() * 140;
        const tBox = new Box({
          id: `cr-${row.id}-toggle`,
          x: tInitX, y: tInitY,
          width: toggleBox.width, height: toggleBox.height || LINE_HEIGHT,
          opacity: 0,
          backgroundColor: "transparent",
          interactive: false, zIndex: 99, overflow: "visible",
        });
        tBox.textStyle = { ...toggleBox.textStyle, overflow: "visible", maxLines: 1 };
        overlayContainer.addChild(tBox);
        charBoxes.push(tBox);
        tl.to(tBox, {
          x: tTargetX, y: tTargetY, opacity: 1,
          duration: tRandDur, ease: "back.out(1.05)",
        }, tRandDelay);
        if (toggleBox.transform.rotate > 0.1) {
          tl.to(tBox.transform, {
            rotate: Math.PI / 2, duration: tRandDur,
            ease: "power2.out",
          }, tRandDelay);
        }
      }
    }
  }

  if (charBoxes.length === 0) return null;

  return { container: overlayContainer, charBoxes };
}

// ============================================================
// 便捷入口 1：从容器自动找行（现有调用方不变）
// ============================================================

/**
 * 从容器 children 中过滤 title-* / file-* 行，创建字符雨。
 * 与旧签名完全兼容，调用方无需修改。
 */
export function setupCharRainTweens(
  container: Box,
  overlayContainer: Box,
  root: Box,
  rowTargetYs: number[] | undefined,
  tl: AnimTimeline,
  baseDelay: number,
  direction: 'expand' | 'collapse' = 'expand',
): CharRainCleanup | null {
  const rows = container.children.filter((c) =>
    c.id?.startsWith("title-") || c.id?.startsWith("file-")
  );
  return _charRainCore(rows, rowTargetYs, container, overlayContainer, root, tl, baseDelay, direction);
}

// ============================================================
// 便捷入口 2：为显式指定的行创建字符雨（兄弟行用）
// ============================================================

/**
 * 为显式指定的行列表创建字符雨。
 * referenceBox 用于计算 topY — 通常传行们的父容器。
 */
export function setupCharRainForSiblings(
  rows: Box[],
  rowTargetYs: number[] | undefined,
  referenceBox: Box,
  overlayContainer: Box,
  root: Box,
  tl: AnimTimeline,
  baseDelay: number,
  direction: 'expand' | 'collapse' = 'expand',
): CharRainCleanup | null {
  return _charRainCore(rows, rowTargetYs, referenceBox, overlayContainer, root, tl, baseDelay, direction);
}

// ============================================================
// 清理
// ============================================================

/**
 * 清理字符雨创建的字符 Box。
 */
export function cleanupCharRain(cu: CharRainCleanup): void {
  for (const box of cu.charBoxes) {
    const idx = cu.container.children.indexOf(box);
    if (idx >= 0) cu.container.children.splice(idx, 1);
  }
}
