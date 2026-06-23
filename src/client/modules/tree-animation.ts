/**
 * tree-animation.ts — 文件树插入/移除行动画
 *
 * 复用 collapse 体系已有的 collectSiblingsAfter，不建 overlay，
 * 直接在主树上通过 anim. 做 GSAP tween。
 */

import { Box } from '../engine/v2/box.js';
import { anim } from './animation-registry.js';
import { collectSiblingsAfter } from './tree-overlay.js';

/** 插入动画：新行从高度 0 撑开 + 兄弟/祖先向下平移 */
export function animateInsertion(row: Box, realH: number): void {
  row.overflow = 'hidden';
  row.height = 0;

  // 直接兄弟（同 parent 内 row 后方）→ 先上移，再动画回原位
  const directSiblings = collectSiblingsAfter(row);
  const sibTargets: { box: Box; targetY: number }[] = [];
  for (const sib of directSiblings) {
    const postY = sib.y;
    sib.y = postY - realH;
    sibTargets.push({ box: sib, targetY: postY });
  }

  // 祖先链（沿 expanded-* 容器向上）
  let ancestor: Box | null = row.parent;
  const ancCtrTargets: { box: Box; targetH: number }[] = [];
  const ancSibTargets: { box: Box; targetY: number }[] = [];
  while (ancestor) {
    if (!ancestor.id?.startsWith('expanded-')) break;
    const postH = ancestor.height;
    ancestor.height = postH - realH;
    ancCtrTargets.push({ box: ancestor, targetH: postH });
    for (const sib of collectSiblingsAfter(ancestor)) {
      const postY = sib.y;
      sib.y = postY - realH;
      ancSibTargets.push({ box: sib, targetY: postY });
    }
    ancestor = ancestor.parent;
  }

  anim.to(row, { height: realH, duration: 0.22, ease: 'power2.out' });
  for (const s of sibTargets) anim.to(s.box, { y: s.targetY, duration: 0.22, ease: 'power2.out' });
  for (const a of ancCtrTargets) anim.to(a.box, { height: a.targetH, duration: 0.22, ease: 'power2.out' });
  for (const a of ancSibTargets) anim.to(a.box, { y: a.targetY, duration: 0.22, ease: 'power2.out' });
}

/** 移除动画：行缩小消失 + 兄弟/祖先向上回收。需在 loadFileTree 之前调用。 */
export function animateRemoval(row: Box, realH: number): Promise<void> {
  return new Promise((resolve) => {
    // 兄弟回收
    for (const sib of collectSiblingsAfter(row)) {
      anim.to(sib, { y: sib.y - realH, duration: 0.22, ease: 'power2.in' });
    }
    // 祖先链回收
    let ancestor: Box | null = row.parent;
    while (ancestor) {
      if (!ancestor.id?.startsWith('expanded-')) break;
      anim.to(ancestor, { height: ancestor.height - realH, duration: 0.22, ease: 'power2.in' });
      for (const sib of collectSiblingsAfter(ancestor)) {
        anim.to(sib, { y: sib.y - realH, duration: 0.22, ease: 'power2.in' });
      }
      ancestor = ancestor.parent;
    }
    // 行本身缩小 → 完成回调
    anim.to(row, {
      height: 0, duration: 0.22, ease: 'power2.in',
      onComplete() { resolve(); },
    });
    row.overflow = 'hidden';
  });
}
