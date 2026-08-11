/**
 * hand.ts — 「AI 的手」操作代理（2026-08-11 立项，v8.6.0 手）
 *
 * 设计源起：用户提议给 AI 配一个可见的鼠标——页面上有一个「手」的 UI，
 * 平时停驻在轨道区待机巡逻，AI 要操作时手脱离轨道、移动到目标坐标、
 * 按下（注入 PointerEvent 复用 gesture-registry 全套手势），完成后回归。
 *
 * 待机态完全复刻自 obs-emblem.ts 的 EmblemOrbit（C 轨道，2026-08-09 试映
 * 取消、2026-08-11 复活）：意志核慢利萨如（3:2，周期 ~24s）+ 卫星邻近牵引
 * + 尾迹渐隐。rng(20260810) 定种子、resize 等比映射。
 *
 * 操作态（后续迭代）：ws 命令 hand-move(x,y) → GSAP 移到位 → hand-press
 * → 合成 PointerEvent 注入；用户触摸时手让位暂停。
 *
 * 层级：Z.HAND（AI 核心层，光球之上、焦点弹窗之下）。
 */

import { Z } from './z-index-layers.js';

// ========== 常量 ==========
const CYAN = '6,182,212';
const VIOLET = '139,92,246';
const BLUE = '59,130,246';

// 确定性伪随机（与 obs-emblem 同族：定种子，重绘不跳变）
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HandRect { left: number; top: number; width: number; height: number }

/**
 * 创建手画布（固定定位，pointer-events:none 纯展示——手是视觉代理，
 * 点击事件由合成 PointerEvent 注入，不占真实 DOM 命中）。
 */
function mkCanvas(rect: HandRect): [HTMLCanvasElement, CanvasRenderingContext2D, number, number] {
  const cv = document.createElement('canvas');
  cv.className = 'ai-hand';
  cv.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:${Z.HAND}`;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(rect.width * dpr));
  cv.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  document.body.appendChild(cv);
  return [cv, ctx, rect.width, rect.height];
}

// ============ 手引擎：待机利萨如巡逻（复刻自 EmblemOrbit） ============
class HandOrbit {
  private sats: { r0: number; om: number; ph: number }[] = [];
  private trail: { x: number; y: number }[] = [];
  private core = { x: 0, y: 0 };
  constructor(private w: number, private h: number) {
    const R = rng(20260810);
    for (let i = 0; i < 6; i++) {   // 用户拍板：青色卫星数量减半 12→6
      this.sats.push({ r0: (0.18 + R() * 0.26) * Math.min(w, h), om: (0.25 + R() * 0.4) * (R() > 0.5 ? 1 : -1), ph: R() * Math.PI * 2 });
    }
  }
  resize(nw: number, nh: number): void { // 轨道半径按短边比缩放，尾迹坐标等比映射
    const f = Math.min(nw, nh) / Math.min(this.w, this.h);
    const fx = nw / this.w, fy = nh / this.h;
    this.w = nw; this.h = nh;
    for (const s of this.sats) s.r0 *= f;
    for (const p of this.trail) { p.x *= fx; p.y *= fy; }
  }
  step(ctx: CanvasRenderingContext2D, now: number): void {
    const { w, h } = this;
    const t = now / 1000;
    const cx = w / 2, cy = h / 2;
    // 意志核：慢利萨如（3:2，周期 ~24s）
    const T = t * (Math.PI * 2 / 24);
    this.core = {
      x: cx + w * 0.30 * Math.sin(3 * T + 1.7),
      y: cy + h * 0.34 * Math.sin(2 * T + 0.4),
    };
    this.trail.push(this.core);
    if (this.trail.length > 126) this.trail.shift();   // 用户拍板：尾迹拉长 3 倍（42→126）
    ctx.clearRect(0, 0, w, h);
    // 尾迹渐隐折线（用户定稿：头部亮度上限 0.6）
    for (let i = 1; i < this.trail.length; i++) {
      const a = Math.pow(i / this.trail.length, 1.5) * 0.60;
      ctx.strokeStyle = `rgba(${VIOLET},${a})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y); ctx.lineTo(this.trail[i].x, this.trail[i].y); ctx.stroke();
    }
    // 卫星：本位轨道 + 核邻近牵引
    for (const s of this.sats) {
      const bx = cx + Math.cos(s.ph + t * s.om) * s.r0;
      const by = cy + Math.sin(s.ph + t * s.om) * s.r0 * 1.25; // 竖区拉纵向
      const d = Math.hypot(bx - this.core.x, by - this.core.y);
      const k = 0.22 * Math.exp(-(d * d) / (2 * 26 * 26));
      const x = bx * (1 - k) + this.core.x * k, y = by * (1 - k) + this.core.y * k;
      const a = 0.18 + 0.5 * Math.exp(-(d * d) / (2 * 30 * 30));
      ctx.strokeStyle = `rgba(${BLUE},${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(this.core.x, this.core.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(${CYAN},0.75)`;
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // 核：紫光焦点 + 光圈（用户定稿：单层 5.5px 透明度 0.25）
    ctx.fillStyle = `rgba(${VIOLET},0.95)`;
    ctx.beginPath(); ctx.arc(this.core.x, this.core.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${VIOLET},0.25)`;
    ctx.beginPath(); ctx.arc(this.core.x, this.core.y, 5.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ============ 装配：单画布单 rAF（待机巡逻） ============
export function initHand(getRect: () => HandRect | null): { relayout: () => void } {
  let el: HTMLCanvasElement | null = null;
  let engine: HandOrbit | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let curRect: HandRect | null = null;
  let renderOn = true;

  const build = () => {
    const r = getRect();
    if (!r || r.width < 20 || r.height < 20) { // 区域太小宁缺毋滥
      el?.remove();
      el = null; ctx = null; engine = null; curRect = null;
      return;
    }
    curRect = r;
    // 尺寸基本没变（±2px）只挪画布位置
    if (el) {
      const same = Math.abs(r.width - parseFloat(el.style.width)) <= 2 &&
        Math.abs(r.height - parseFloat(el.style.height)) <= 2;
      if (same) {
        el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
        return;
      }
    }
    el?.remove();
    const [cv, c, w, h] = mkCanvas(r);
    el = cv; ctx = c;
    if (engine) engine.resize(w, h);
    else engine = new HandOrbit(w, h);
  };

  build();
  let lastStep = 0;
  const loop = (now: number) => {
    if (renderOn && ctx && engine && now - lastStep >= 33) {
      lastStep = now;
      engine.step(ctx, now);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return { relayout: build };
}