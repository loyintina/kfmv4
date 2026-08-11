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
  // Verlet 积分 + 距离约束（成熟方案，2026-08-11 用户确认方向）：
  // 青球 = Verlet 质点（记录当前/前一帧位置，速度隐含在位置差——天然稳定
  // 不爆炸）。距离约束**只拉不推**：青球到核距离 > r0 时沿连线拉回 r0，
  // 距离 ≤ r0 时约束松弛（自由飞行）——核移动时后方被拽（有惯性滞后）、
  // 前方不受影响。青球初始有切向速度（绕核转），核是约束锚点。
  private sats: { r0: number; om: number; ph: number; x: number; y: number; px: number; py: number }[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  private core = { x: 0, y: 0 };        // 核当前位置（视口绝对坐标）
  private coreV = { x: 0, y: 0 };       // 核速度（弹簧动力学）
  private target: { x: number; y: number } | null = null;  // 目标点（视口绝对坐标）
  private targetT0 = 0;                 // 目标设置时间戳（1.5s 后清除）
  private orbit: HandRect | null = null; // 待机轨道区（视口绝对坐标）
  constructor() {
    // 3 颗青球（2026-08-11 用户拍板数量 12→3）——约束半径/切向角速/相位定种子
    const R = rng(20260810);
    for (let i = 0; i < 3; i++) {
      this.sats.push({
        r0: (0.30 + R() * 0.45) * 60,                       // 距离约束长度（自然轨道半径）
        om: (0.25 + R() * 0.4) * (R() > 0.5 ? 1 : -1),      // 切向角速（绕核转的初始速度）
        ph: R() * Math.PI * 2,                              // 初始相位
        x: 0, y: 0, px: 0, py: 0,                           // Verlet 位置（当前/前一帧）
      });
    }
  }
  /** 设置待机轨道区（视口绝对坐标）——relayout 时更新 */
  setOrbit(rect: HandRect): void {
    if (!this.orbit) {
      // 首次：核从轨道中心出发；青球放在轨道位并给切向速度（Verlet 用前一帧偏移表达）
      const cx0 = rect.left + rect.width / 2, cy0 = rect.top + rect.height / 2;
      this.core = { x: cx0, y: cy0 };
      for (const s of this.sats) {
        s.x = cx0 + Math.cos(s.ph) * s.r0;
        s.y = cy0 + Math.sin(s.ph) * s.r0 * 1.25;
        // 切向速度（垂直半径方向）：前一帧位置 = 当前位置 - 速度×dt
        const v = s.r0 * Math.abs(s.om) * 0.35 * Math.sign(s.om);
        s.px = s.x + Math.sin(s.ph) * v * (1 / 60);
        s.py = s.y - Math.cos(s.ph) * v * (1 / 60) * 1.25;
      }
    } else {
      // 尺寸变化：核/青球/尾迹等比映射到新锚点
      const fx = rect.width / this.orbit.width, fy = rect.height / this.orbit.height;
      if (this.orbit.width > 0 && this.orbit.height > 0 && (fx !== 1 || fy !== 1)) {
        for (const p of this.trail) { p.x = rect.left + (p.x - this.orbit.left) * fx; p.y = rect.top + (p.y - this.orbit.top) * fy; }
        this.core.x = rect.left + (this.core.x - this.orbit.left) * fx;
        this.core.y = rect.top + (this.core.y - this.orbit.top) * fy;
        for (const s of this.sats) {
          s.x = rect.left + (s.x - this.orbit.left) * fx;
          s.y = rect.top + (s.y - this.orbit.top) * fy;
          s.px = rect.left + (s.px - this.orbit.left) * fx;
          s.py = rect.top + (s.py - this.orbit.top) * fy;
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
    // Verlet 青球：位置积分（速度隐含在位置差，稳定不爆炸）+ 距离约束
    // **只拉不推**——到核距离 > r0 时拉回 r0（核远离→被拽），≤ r0 松弛
    // （核靠近→自由飞行）。核移动时后方青球被拽（惯性滞后）、前方不受影响。
    const dtV = Math.min(0.05, 33 / 1000);
    const SOLVE = 3;            // 约束迭代次数（收敛更快、更硬）
    const DAMP_V = 0.985;       // Verlet 阻尼（每帧速度衰减，防永久振荡）
    for (const s of this.sats) {
      // 1. Verlet 积分：新位置 = 当前位置 + (当前位置 - 前一帧位置)×阻尼
      const nx = s.x + (s.x - s.px) * DAMP_V;
      const ny = s.y + (s.y - s.py) * DAMP_V;
      s.px = s.x; s.py = s.y;
      s.x = nx; s.y = ny;
      // 2. 距离约束（只拉不推）：超过 r0 沿连线拉回（迭代求硬约束）
      for (let it = 0; it < SOLVE; it++) {
        const dx = s.x - this.core.x, dy = s.y - this.core.y;
        const d = Math.hypot(dx, dy);
        if (d > s.r0 && d > 0.001) {
          const corr = (d - s.r0) / d;         // 超标比例
          s.x -= dx * corr;
          s.y -= dy * corr;
        }
      }
      // 3. 绘制（连线随距离渐隐：近核亮远核暗）
      const d = Math.hypot(s.x - this.core.x, s.y - this.core.y);
      const a = 0.18 + 0.5 * Math.exp(-(d * d) / (2 * 30 * 30));
      ctx.strokeStyle = `rgba(${BLUE},${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(this.core.x, this.core.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = `rgba(${CYAN},0.75)`;
      ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
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
