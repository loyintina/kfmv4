/**
 * char-rain.ts — 字符散落/回收动画
 *
 * 在文件树展开时，将文字拆分为独立字符，
 * 每个字符从页面顶端散落掉落到目标位置。
 * 折叠时同理，字符从当前位置往回飞到屏幕上方。
 *
 * 展开和回收共用同一套字符创建逻辑，仅动画方向和参数不同。
 */

import { Box } from "../engine/v2/box.js";
import { Renderer } from "../engine/v2/renderer.js";
import { FONT, LINE_HEIGHT, MAX_LINES } from "./style-registry.js";
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";
import type { AnimTimeline } from "./animation-registry.js";
import { DOM } from "./dom-refs.js";
import type { Overflow } from "../engine/v2/types.js";

// ============================================================
// cleanup 信息（供外部在动画完成时清理字符 Box）
// ============================================================

export interface CharRainCleanup {
  container: Box;
  charBoxes: Box[];
  hiddenLabels: Box[];
  hiddenToggles: Box[];
  origOverflow: Overflow;
  parentOrigOverflow: Overflow | undefined;
}

/**
 * 创建字符 Box 并将动画 tween 添加到指定 timeline 上。
 * 展开和回收共用此函数，通过 direction 控制。
 *
 * @param container   展开的文件夹容器（expanded-*）
 * @param root        文件树根 Box
 * @param renderer    渲染器实例
 * @param rowTargetYs 每行在展开态时的 y 坐标
 * @param tl          目标 timeline（通常是 ts scope）
 * @param baseDelay   该层动画的起始时间偏移（用于 staggered）
 * @param direction   'expand' 或 'collapse'
 * @returns cleanup 信息，如果没有字符需要动画则返回 null
 */
export function setupCharRainTweens(
  container: Box,
  root: Box,
  renderer: Renderer | null,
  rowTargetYs: number[] | undefined,
  tl: AnimTimeline,
  baseDelay: number,
  direction: 'expand' | 'collapse' = 'expand',
): CharRainCleanup | null {
  const isCollapse = direction === 'collapse';
  const rows = container.children.filter((c) =>
    c.id?.startsWith("title-") || c.id?.startsWith("file-")
  );
  if (rows.length === 0) return null;

  const canvas = DOM.treeCanvas;
  const ctx = canvas?.getContext("2d");
  if (!ctx) return null;

  // 保存并临时修改 overflow。字符起始 Y 可能超出容器边界。
  const origOverflow = container.overflow;
  container.overflow = "visible";
  const parentOrigOverflow = container.parent?.overflow;
  if (container.parent && container.parent.overflow === 'hidden') {
    container.parent.overflow = 'visible';
  }

  const charBoxes: Box[] = [];
  const hiddenLabels: Box[] = [];
  const hiddenToggles: Box[] = [];
  const BASE_DUR = 0.22;
  const scrollY = root.scrollY ?? 0;
  const absY = container.getAbsolutePosition().y;
  const topY = scrollY - absY; // 容器空间中的屏幕顶部位置

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowExpandedY = rowTargetYs?.[rowIdx] ?? row.y;
    const label = row.children.find((c) => c.id?.startsWith("label-"));
    if (!label || !label.textStyle?.content) continue;

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
          container.addChild(box);
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
          container.addChild(box);
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
        container.addChild(tBox);
        charBoxes.push(tBox);
        tl.to(tBox, {
          x: tToX, y: tToY, opacity: 0,
          duration: tRandDur, ease: "back.in(1.05)",
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
        container.addChild(tBox);
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

    // 隐藏原始 label 和 toggle
    const labelBox = row.children.find((c) => c.id?.startsWith("label-"));
    if (labelBox) { labelBox.visible = false; hiddenLabels.push(labelBox); }

    const toggleHider = row.children.find((c) => c.id?.startsWith("toggle-"));
    if (toggleHider) { toggleHider.visible = false; hiddenToggles.push(toggleHider); }
  }

  if (charBoxes.length === 0) {
    container.overflow = origOverflow;
    return null;
  }

  renderer?.setRoot(root);

  return { container, charBoxes, hiddenLabels, hiddenToggles, origOverflow, parentOrigOverflow };
}

/**
 * 清理字符雨创建的字符 Box 和恢复原始状态。
 */
export function cleanupCharRain(cu: CharRainCleanup): void {
  for (const box of cu.charBoxes) {
    const idx = cu.container.children.indexOf(box);
    if (idx >= 0) cu.container.children.splice(idx, 1);
  }
  cu.hiddenLabels.forEach(l => { l.visible = true; });
  cu.hiddenToggles.forEach(t => { t.visible = true; });
  cu.container.overflow = cu.origOverflow;
  if (cu.container.parent && cu.parentOrigOverflow) {
    cu.container.parent.overflow = cu.parentOrigOverflow;
  }
}
