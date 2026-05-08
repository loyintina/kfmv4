/**
 * char-rain.ts — 字符散落动画
 *
 * 在文件树展开时，将文字拆分为独立字符，
 * 每个字符从页面顶端（sidebar 可视区域顶部）散落掉落到目标位置。
 * 用 Canvas measureText 逐字测量宽度，GSAP 驱动动画。
 * 渲染器 rAF 循环自动读取 GSAP 更新的 Box 值，无需额外 onUpdate。
 */

import { Box } from "../engine/v2/box.js";
import { Renderer } from "../engine/v2/renderer.js";
import { FONT, LINE_HEIGHT, MAX_LINES } from "./style-registry.js";
import { prepareWithSegments, layoutWithLines } from "@chenglou/pretext";
import { anim, type AnimTimeline } from "./animation-registry.js";
import { DOM } from "./dom-refs.js";

// 活跃的 char-rain 时间线引用，供外部 killActiveCharRain() 中断
let _activeTl: ReturnType<typeof anim.timeline> | null = null;

/** 中断当前正在运行的字符雨动画 */
export function killActiveCharRain(): void {
  if (_activeTl) {
    _activeTl.kill();
    _activeTl = null;
  }
}

interface CharTarget {
  box: Box;
  targetX: number;
  targetY: number;
  isToggle?: boolean;
}

/**
 * 对展开容器内的所有文字行应用字符雨落体动画。
 * 字符从 sidebar 可视区域顶部掉落到目标位置。
 *
 * @param container - 展开的文件夹容器（expanded-*）
 * @param root      - 文件树根 Box
 * @param renderer  - 渲染器实例
 */
export async function animateCharRain(
  container: Box,
  root: Box,
  renderer: Renderer | null,
  rowTargetYs?: number[]
): Promise<void> {
  // 1. 收集需要动画的行
  const rows = container.children.filter((c) =>
    c.id?.startsWith("title-") || c.id?.startsWith("file-")
  );
  if (rows.length === 0) return;

  const canvas = DOM.treeCanvas;
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  // 2. 保存并临时修改 overflow。字符起始 Y 为负，会被自身及父容器的
  //    overflow:hidden 裁掉。两个都要改成 visible。
  const origOverflow = container.overflow;
  container.overflow = "visible";
  const parentOrigOverflow = container.parent?.overflow;
  if (container.parent && container.parent.overflow === 'hidden') {
    container.parent.overflow = 'visible';
  }

  // 3. 计算坐标：字符初始位置在屏幕顶部（sidebar 可视区 y=0）
  const absY = container.getAbsolutePosition().y;
  const scrollY = root.scrollY ?? 0;
  const topY = scrollY - absY; // 容器空间中对应屏幕 y=0 的值

  renderer?.setRoot(root);

  // 4. 逐行逐字创建字符 Box
  const allTargets: CharTarget[] = [];
  const lineGroups: CharTarget[][] = [];
  let currentLineGroup = 0;
  const hiddenLabels: Box[] = [];
  const hiddenToggles: Box[] = [];

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
      // Pretext 失败时回退到单行
      layoutLines = [{ text, width: ctx.measureText(text).width }];
    }

    // 截断处理（与 renderer._drawText 逻辑一致）
    const maxVis = label.textStyle.maxLines || MAX_LINES;
    const isTrunc = layoutLines.length > maxVis;
    const visLines = layoutLines.slice(0, maxVis);

    // 计算垂直居中偏移（与 renderer._drawText 的 verticalAlign middle 逻辑一致）
    const totalTextHeight = visLines.length * lineH;
    const verticalOffset = Math.max(0, (row.height - totalTextHeight) / 2);

    const rowFirstLineGroup = currentLineGroup;
    for (let li = 0; li < visLines.length; li++) {
      const line = visLines[li];
      let chars: string[];

      // 省略号替换（与 renderer._drawText 一致：最后可见行末字符 → \u2026）
      if (li === maxVis - 1 && isTrunc) {
        chars = [...line.text.slice(0, -1), "\u2026"];
      } else {
        chars = [...line.text];
      }

      // 逐字测量宽度
      const charWidths = chars.map((ch) => ctx.measureText(ch).width);

      if (!lineGroups[currentLineGroup]) lineGroups[currentLineGroup] = [];
      let cx = 0;
      for (let ci = 0; ci < chars.length; ci++) {
        // 目标位置（容器空间中的最终坐标）
        const targetX = row.x + label.x + cx;
        const targetY = rowExpandedY + label.y + verticalOffset + li * lineH;

        // 初始位置：水平随机偏摆����垂直在屏幕顶部
        const initX = targetX + (Math.random() - 0.5) * 100;
        const initY = targetY - 80 - Math.random() * 140;

        const box = new Box({
          id: `cr-${row.id}-L${li}-C${ci}`,
          x: initX,
          y: initY,
          width: charWidths[ci] + 2,
          height: lineH,
          opacity: 0,
          backgroundColor: "transparent", // 透明背景，消除阴影
          interactive: false,
          zIndex: 99,
          overflow: "visible",
        });
        box.textStyle = {
          content: chars[ci],
          color,
          font,
          lineHeight: lineH,
          align: "left",
          verticalAlign: "middle",
          overflow: "visible",
          maxLines: 1,
        };

        container.addChild(box);
        allTargets.push({ box, targetX, targetY });
        lineGroups[currentLineGroup].push({ box, targetX, targetY });
        cx += charWidths[ci];
      }
      currentLineGroup++;
    }

    // --- 三角 (▶) 字符雨 ---
    // 让 toggle 图标也一起掉落
    const toggleBox = row.children.find((c) => c.id?.startsWith("toggle-"));
    if (toggleBox && toggleBox.textStyle?.content) {
      const tChar = toggleBox.textStyle.content;
      const tFont = toggleBox.textStyle.font || font;
      ctx.font = tFont;
      const tWidth = ctx.measureText(tChar).width;
      const tTargetX = row.x + toggleBox.x;
      const tTargetY = rowExpandedY + toggleBox.y;
      const tInitX = tTargetX + (Math.random() - 0.5) * 100;
      const tInitY = tTargetY - 80 - Math.random() * 140;

      const tBox = new Box({
        id: `cr-${row.id}-toggle`,
        x: tInitX,
        y: tInitY,
        width: toggleBox.width,
        height: toggleBox.height || LINE_HEIGHT,
        opacity: 0,
        backgroundColor: "transparent",
        interactive: false,
        zIndex: 99,
        overflow: "visible",
      });
      tBox.textStyle = {
        ...toggleBox.textStyle,
        overflow: "visible",
        maxLines: 1,
      };

      container.addChild(tBox);
      const togTarget = { box: tBox, targetX: tTargetX, targetY: tTargetY, isToggle: toggleBox.transform.rotate > 0.1 };
      allTargets.push(togTarget);
      lineGroups[rowFirstLineGroup].push(togTarget);
    }

    // 隐藏原始 label（字符 Box 不隐藏，等 GSAP 后删除）
    const labelBox = row.children.find((c) => c.id?.startsWith("label-"));
    if (labelBox) { labelBox.visible = false; hiddenLabels.push(labelBox); }

    const toggleHider = row.children.find((c) => c.id?.startsWith("toggle-"));
    if (toggleHider) { toggleHider.visible = false; hiddenToggles.push(toggleHider); }
  }

  // 没有字符需要动画（空文本等）
  if (allTargets.length === 0) {
    container.overflow = origOverflow;
    return;
  }

  // 推送初始状态（字符在屏幕顶部）
  renderer?.setRoot(root);

  // 5. GSAP 动画：逐字随机延迟，碎片化散落
  const BASE_DUR = 0.22;

  try {
    await new Promise<void>((resolve) => {
      const tl = anim.timeline({ onComplete: resolve });
      _activeTl = tl;

      for (let gi = 0; gi < lineGroups.length; gi++) {
        const group = lineGroups[gi];
        if (!group || group.length === 0) continue;

        for (let ci = 0; ci < group.length; ci++) {
          const t = group[ci];
          // 每个字符独立随机延迟和微变时长，打破排队感
          const randDelay = Math.random() * 0.1 + gi * 0.008;
          const randDur = BASE_DUR + Math.random() * 0.06;

          tl.to(t.box, {
            x: t.targetX,
            y: t.targetY,
            opacity: 1,
            duration: randDur,
            ease: "back.out(1.05)",
            onUpdate: () => { renderer?.setRoot(root); },
          }, randDelay);

          if (t.isToggle) {
            tl.to(t.box.transform, {
              rotate: Math.PI / 2,
              duration: randDur,
              ease: "power2.out",
            }, randDelay);
          }
        }
      }
    });
  } finally {
    _activeTl = null;
    // 根检查：如果树已被重建（renderer 的当前 root 不是我们记住的那个），跳过所有操作
    const currentRoot = renderer?.getRoot();
    if (currentRoot !== root) return;

    // 清理字符 tiles
    for (const t of allTargets) {
      const idx = container.children.indexOf(t.box);
      if (idx >= 0) container.children.splice(idx, 1);
    }

    // 恢复原始 label 和 toggle 可见性
    hiddenLabels.forEach(l => { l.visible = true; });
    hiddenToggles.forEach(t => { t.visible = true; });

    container.overflow = origOverflow;
    if (container.parent && parentOrigOverflow) {
      container.parent.overflow = parentOrigOverflow;
    }
    renderer?.setRoot(root);
  }
}