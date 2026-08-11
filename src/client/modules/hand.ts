/**
 * hand.ts — 「AI 的手」操作代理（2026-08-11 立项，v8.6.0 手）
 *
 * 设计源起：用户提议给 AI 配一个可见的鼠标——页面上有一个「手」的 UI，
 * 平时停驻在轨道区待机巡逻，AI 要操作时手脱离轨道、移动到目标坐标、
 * 按下（注入 PointerEvent 复用 gesture-registry 全套手势），完成后回归。
 *
 * 画布全屏（覆盖整个视口）：手可移动到屏幕任意位置，轨道区 rect 只是
 * 待机利萨如巡逻的中心锚点。核/卫星/尾迹全部用**视口绝对坐标**——
 * 2026-08-11 用户实拍：画布只有轨道区大小时，核出界即被裁剪消失。
 *
 * 待机态复刻自 obs-emblem.ts 的 EmblemOrbit（C 轨道）：意志核慢利萨如
 * （3:2，周期 ~24s）+ 卫星邻近牵引 + 尾迹渐隐。rng(20260810) 定种子。
 *
 * 操作态：ws 命令 hand-move(x,y) → 核弹簧物理移动到目标，1.5s 后回归。
 *
 * 层级：Z.HAND（AI 核心层，光球之上、焦点弹窗之下）。
 */

import { Z } from './z-index-layers.js';
import { wsChannel } from './ws-channel.js';

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
 * 创建全屏手画布（固定定位覆盖整个视口，pointer-events:none 纯展示——
 * 手是视觉代理，点击事件由合成 PointerEvent 注入，不占真实 DOM 命中）。
 */
function mkCanvas(vw: number, vh: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.className = 'ai-hand';
  cv.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;pointer-events:none;z-index:${Z.HAND}`;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(vw * dpr));
  cv.height = Math.max(1, Math.round(vh * dpr));
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  document.body.appendChild(cv);
  return [cv, ctx];
}

// ============ 手引擎：待机利萨如巡逻 + 目标移动（弹簧物理） ============
class HandOrbit {
  // 星系模型（2026-08-11 用户拍板）：三层结构
  // 1. 紫核：可移动（弹簧驱动），星系中心大质量天体
  // 2. 青球的「轨道中心」anchor：每颗独立——围绕紫核附近随机游走 +
  //    延迟跟随紫核（紫核移动时 anchor 滞后，像引力波传播延迟）
  // 3. 青球：绕自己的 anchor 转（本位轨道），同时受紫核**距离相关引力**
  //    （近强远弱，高斯衰减）
  // anchor 用软弹簧追核（AK/AC）+ 自身慢速环绕游走；无刚体耦合 → 天然星系感
  private sats: { r0: number; om: number; ph: number; ax: number; ay: number; avx: number; avy: number; wa: number }[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  private core = { x: 0, y: 0 };        // 核当前位置（视口绝对坐标）
  private coreV = { x: 0, y: 0 };       // 核速度（弹簧动力学）
  private target: { x: number; y: number } | null = null;  // 目标点（视口绝对坐标）
  private targetT0 = 0;                 // 目标设置时间戳（1.5s 后清除）
  private orbit: HandRect | null = null; // 待机轨道区（视口绝对坐标）
  constructor() {
    // 3 颗青球（2026-08-11 用户拍板数量 12→3）——轨道参数 + anchor 环绕角速定种子
    const R = rng(20260810);
    for (let i = 0; i < 3; i++) {
      this.sats.push({
        r0: (0.30 + R() * 0.45) * 60,                       // 青球绕 anchor 的轨道半径
        om: (0.25 + R() * 0.4) * (R() > 0.5 ? 1 : -1),      // 青球绕 anchor 角速
        ph: R() * Math.PI * 2,                              // 青球轨道相位
        ax: 0, ay: 0, avx: 0, avy: 0,                       // anchor 位置/速度（延迟跟随）
        wa: (0.15 + R() * 0.2) * (R() > 0.5 ? 1 : -1),      // anchor 环绕紫核的角速（慢）
      });
    }
  }
  /** 设置待机轨道区（视口绝对坐标）——relayout 时更新 */
  setOrbit(rect: HandRect): void {
    if (!this.orbit) {
      // 首次：核与各 anchor 从轨道中心出发
      this.core = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      for (const s of this.sats) { s.ax = this.core.x; s.ay = this.core.y; s.avx = 0; s.avy = 0; }
    } else {
      // 尺寸变化：核/anchor/尾迹等比映射到新锚点
      const fx = rect.width / this.orbit.width, fy = rect.height / this.orbit.height;
      if (this.orbit.width > 0 && this.orbit.height > 0 && (fx !== 1 || fy !== 1)) {
        for (const p of this.trail) { p.x = rect.left + (p.x - this.orbit.left) * fx; p.y = rect.top + (p.y - this.orbit.top) * fy; }
        this.core.x = rect.left + (this.core.x - this.orbit.left) * fx;
        this.core.y = rect.top + (this.core.y - this.orbit.top) * fy;
        for (const s of this.sats) {
          s.ax = rect.left + (s.ax - this.orbit.left) * fx;
          s.ay = rect.top + (s.ay - this.orbit.top) * fy;
        }
      }
    }
    this.orbit = rect;
  }
  /** 设置目标点（视口绝对坐标）——客户端命令入口 */
  moveTo(x: number, y: number, now: number): void {
    this.target = { x, y };
    this.targetT0 = now;
  }
  step(ctx: CanvasRenderingContext2D, now: number): void {
    const t = now / 1000;
    const ob = this.orbit;
    if (!ob || ob.width < 20 || ob.height < 20) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
    const cx = ob.left + ob.width / 2, cy = ob.top + ob.height / 2;
    // 待机轨道位置：慢利萨如（3:2，周期 ~24s），以轨道区中心为锚
    const T = t * (Math.PI * 2 / 24);
    const basePos = {
      x: cx + ob.width * 0.30 * Math.sin(3 * T + 1.7),
      y: cy + ob.height * 0.34 * Math.sin(2 * T + 0.4),
    };
    // 目标点超时（1.5s）后清除 → 核弹回待机轨道
    if (this.target && now - this.targetT0 > 1500) this.target = null;
    // 弹簧物理：加速度 = k×(目标或待机位 - 当前位置) - 阻尼×速度
    const goal = this.target ?? basePos;
    const K = this.target ? 0.028 : 0.004;   // 移动时硬弹簧（快速到位+小过冲）；回归时软弹簧（平滑回轨）
    const C = this.target ? 0.16 : 0.02;
    const dt = Math.min(0.05, 33 / 1000);
    this.coreV.x += (K * (goal.x - this.core.x) - C * this.coreV.x) * dt * 60;
    this.coreV.y += (K * (goal.y - this.core.y) - C * this.coreV.y) * dt * 60;
    this.core.x += this.coreV.x * dt * 60;
    this.core.y += this.coreV.y * dt * 60;
    this.trail.push({ x: this.core.x, y: this.core.y, t: now });
    // 尾迹按时间衰减：超过 1.5s 的旧点移除（核静止时尾迹自然消散，
    // 移动时拉出真实轨迹——不再按点数堆积重合；2026-08-11 用户实拍：
    // 全屏后 126 点挤在核周围，尾迹视觉消失）
    const TRAIL_MS = 1500;
    while (this.trail.length > 0 && now - this.trail[0].t > TRAIL_MS) this.trail.shift();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // 尾迹渐隐折线（用户定稿：头部亮度上限 0.6，幂次渐隐）
    for (let i = 1; i < this.trail.length; i++) {
      const age = (now - this.trail[i].t) / TRAIL_MS;      // 0=新 1=将消
      const a = Math.pow(1 - age, 1.5) * 0.60;
      ctx.strokeStyle = `rgba(${VIOLET},${a})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y); ctx.lineTo(this.trail[i].x, this.trail[i].y); ctx.stroke();
    }
    // 星系模型（2026-08-11 用户拍板）：三层结构
    // 1. anchor：青球的轨道中心——软弹簧延迟跟随紫核 + 自身环绕紫核慢速游走
    // 2. 青球：绕自己的 anchor 转（本位轨道）
    // 3. 距离引力：青球离紫核近 → 高斯引力系数大 → 被拉向核（近强远弱）
    const dtS = Math.min(0.05, 33 / 1000);
    const AK = 0.02;          // anchor 弹簧刚度（软——延迟跟随，像引力波传播）
    const AC = 0.08;          // anchor 阻尼（防振荡）
    const AR = 22;            // anchor 环绕紫核的游走半径（px）
    const GRAV = 0.30;        // 紫核距离引力强度
    const GSIG = 42;          // 引力高斯 σ（px，越大作用范围越广）
    for (const s of this.sats) {
      // anchor：软弹簧追核（延迟）+ 自身环绕游走（慢速，独立相位 wa）
      const awx = Math.cos(s.ph * 2 + t * s.wa) * AR;
      const awy = Math.sin(s.ph * 3 + t * s.wa) * AR;
      s.avx += (AK * ((this.core.x + awx) - s.ax) - AC * s.avx) * dtS * 60;
      s.avy += (AK * ((this.core.y + awy) - s.ay) - AC * s.avy) * dtS * 60;
      s.ax += s.avx * dtS * 60;
      s.ay += s.avy * dtS * 60;
      // 青球：绕自己的 anchor 转
      const bx = s.ax + Math.cos(s.ph + t * s.om) * s.r0;
      const by = s.ay + Math.sin(s.ph + t * s.om) * s.r0 * 1.25; // 竖区拉纵向
      // 距离引力：离核近 → 高斯系数大 → 位置被拉向核（近强远弱）
      const d = Math.hypot(bx - this.core.x, by - this.core.y);
      const k = GRAV * Math.exp(-(d * d) / (2 * GSIG * GSIG));
      const x = bx * (1 - k) + this.core.x * k;
      const y = by * (1 - k) + this.core.y * k;
      // 连线亮度：随引力同向（近核亮、远核暗）
      const a = 0.18 + 0.5 * Math.exp(-(d * d) / (2 * 30 * 30));
      ctx.strokeStyle = `rgba(${BLUE},${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(this.core.x, this.core.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(${CYAN},0.75)`;
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 核：紫光焦点 + 光圈（用户定稿：单层 5.5px 透明度 0.25）
    ctx.fillStyle = `rgba(${VIOLET},0.95)`;
    ctx.beginPath(); ctx.arc(this.core.x, this.core.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${VIOLET},0.25)`;
    ctx.beginPath(); ctx.arc(this.core.x, this.core.y, 5.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ============ 装配：全屏画布单 rAF（待机巡逻 + 目标移动） ============
export function initHand(getOrbit: () => HandRect | null): { relayout: () => void; moveTo: (x: number, y: number) => void } {
  let el: HTMLCanvasElement | null = null;
  let engine: HandOrbit | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let renderOn = true;

  const build = () => {
    const ob = getOrbit();
    const vw = window.innerWidth, vh = window.innerHeight;
    // 画布尺寸变化（resize）才重建；轨道区变化只 setOrbit（引擎原地映射）
    if (el) {
      const wSame = Math.abs(vw - parseFloat(el.style.width)) <= 2;
      const hSame = Math.abs(vh - parseFloat(el.style.height)) <= 2;
      if (!wSame || !hSame) {
        el.remove();
        el = null; ctx = null;
      }
    }
    if (!el) {
      const [cv, c] = mkCanvas(vw, vh);
      el = cv; ctx = c;
      if (!engine) engine = new HandOrbit();
    }
    if (ob) engine?.setOrbit(ob);
  };

  build();
  // AI 的手：接收服务端 hand-move 命令（工具 kfm-hand-move 广播）
  let moveFn: ((x: number, y: number) => void) | null = null;
  wsChannel.onCommand('hand-move', (_action, params) => {
    const x = Number(params.x);
    const y = Number(params.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    moveFn?.(x, y);
  });
  let lastStep = 0;
  const loop = (now: number) => {
    if (renderOn && ctx && engine && now - lastStep >= 33) {
      lastStep = now;
      engine.step(ctx, now);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const api = {
    relayout: build,
    /** 移动手到视口坐标（服务端 hand-move 命令入口） */
    moveTo(x: number, y: number): void {
      engine?.moveTo(x, y, Date.now());
    },
  };
  moveFn = api.moveTo;
  return api;
}
