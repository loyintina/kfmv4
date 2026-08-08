/**
 * obs-emblem.ts — 深蓝意志动态徽标（2026-08-08 用户定稿：三方案同屏试映）
 *
 * 点线移动连接的纯动态结构，作为项目动态 logo。三案并映待用户实拍裁决：
 *   A 聚散（中央口袋：脉搏/执勤/信箱/SYS 四框围出的竖区）——混沌漂移 ⇄ 收拢成
 *     深渊菱瞳（菱形框+竖瞳），秩序从无形浮现，聚的瞬间是节奏锚点
 *   B 潮汐（待办左侧竖带上半）——竖向波层上升流，纯氛围无图形
 *   C 轨道（待办左侧竖带下半）——意志核利萨如绕行，牵引余点拖尾
 *
 * 纪律：单 rAF 三画布共享；pointer-events:none 纯展示；DPR 适配；
 *   失焦由浏览器自停 rAF（复用观测台既有能耗纪律）；mulberry32 定种子伪随机。
 */

import { Z } from './z-index-layers.js';

export interface EmblemRect { left: number; top: number; width: number; height: number }
export interface EmblemRects {
  pocket: EmblemRect;   // A：中央口袋
  stripTop: EmblemRect; // B：待办左竖带上半
  stripBot: EmblemRect; // C：待办左竖带下半
}

// 确定性伪随机（与 pulseStyle 同族：定种子，重绘不跳变）
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CYAN = '6,182,212';
const VIOLET = '139,92,246';
const BLUE = '59,130,246';

interface Pt { x: number; y: number; vx: number; vy: number }

function mkCanvas(rect: EmblemRect): [HTMLCanvasElement, CanvasRenderingContext2D, number, number] {
  const cv = document.createElement('canvas');
  cv.className = 'obs-emblem';
  cv.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:${Z.CENTER_CONTENT}`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(rect.width * dpr));
  cv.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  document.body.appendChild(cv);
  return [cv, ctx, rect.width, rect.height];
}

// ============ A 聚散：混沌 ⇄ 深渊菱瞳 ============
class EmblemGather {
  private pts: Pt[] = [];
  private glyph: { x: number; y: number }[] = [];
  private t0 = 0;
  private R: () => number;
  // 连线阈值（单阈值：小于即连、大于即断——2026-08-08 用户实拍：滞回带让长线
  // 挂太多，看不见的原因是亮度不是长度；亮度已同步形状描边峰值 0.75）
  private thr = 0;
  // 相位时长：漂 11s → 聚 2.6s → 定 2.4s → 散 1.8s
  private static DRIFT = 11000; private static GATHER = 2600;
  private static HOLD = 2400; private static RELEASE = 1800;
  constructor(private w: number, private h: number) {
    this.R = rng(20260808);
    for (let i = 0; i < 21; i++) {
      this.pts.push({
        x: this.R() * w, y: this.R() * h,
        vx: (this.R() - 0.5) * 8, vy: (this.R() - 0.5) * 8,
      });
    }
    // 深渊菱瞳目标形：菱形 4 顶点 + 每边 2 等分点（12），竖瞳椭圆 8 点，瞳心 1 点
    const g: { x: number; y: number }[] = [];
    const V = [[0.5, 0.05], [0.88, 0.5], [0.5, 0.95], [0.12, 0.5]];
    for (let e = 0; e < 4; e++) {
      const [x1, y1] = V[e]; const [x2, y2] = V[(e + 1) % 4];
      for (const k of [0, 1 / 3, 2 / 3]) g.push({ x: x1 + (x2 - x1) * k, y: y1 + (y2 - y1) * k });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.push({ x: 0.5 + 0.10 * Math.cos(a), y: 0.5 + 0.24 * Math.sin(a) });
    }
    g.push({ x: 0.5, y: 0.5 });
    this.glyph = g.map(p => ({ x: p.x * w, y: p.y * h }));
    this.thr = Math.min(w, h) * 0.30;
  }
  private phase(now: number): [string, number] {
    if (!this.t0) this.t0 = now;
    const c = (now - this.t0) % (EmblemGather.DRIFT + EmblemGather.GATHER + EmblemGather.HOLD + EmblemGather.RELEASE);
    if (c < EmblemGather.DRIFT) return ['drift', c / EmblemGather.DRIFT];
    if (c < EmblemGather.DRIFT + EmblemGather.GATHER) return ['gather', (c - EmblemGather.DRIFT) / EmblemGather.GATHER];
    if (c < EmblemGather.DRIFT + EmblemGather.GATHER + EmblemGather.HOLD) return ['hold', (c - EmblemGather.DRIFT - EmblemGather.GATHER) / EmblemGather.HOLD];
    return ['release', (c - EmblemGather.DRIFT - EmblemGather.GATHER - EmblemGather.HOLD) / EmblemGather.RELEASE];
  }
  step(ctx: CanvasRenderingContext2D, now: number, dt: number): void {
    const { w, h } = this;
    const [ph, k] = this.phase(now);
    (window as unknown as { __emblemPhase: string }).__emblemPhase = ph; // escape-ok: 守视掐点调试钩子（eval 读相位拍 hold 帧，试映期临时）
    const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // 形度 s：聚期渐入、定期满、散期渐出——形状描边与粒子增亮都随它渐变，无突变
    const s = ph === 'gather' ? ease(k) : ph === 'hold' ? 1 : ph === 'release' ? 1 - ease(k) : 0;
    for (let i = 0; i < this.pts.length; i++) {
      const p = this.pts[i];
      if (ph === 'drift') {
        p.vx += (this.R() - 0.5) * 1.2; p.vy += (this.R() - 0.5) * 1.2;
        const sp = Math.hypot(p.vx, p.vy), cap = 9;
        if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 2 || p.x > w - 2) p.vx = -p.vx;
        if (p.y < 2 || p.y > h - 2) p.vy = -p.vy;
        p.x = Math.max(2, Math.min(w - 2, p.x)); p.y = Math.max(2, Math.min(h - 2, p.y));
      } else if (ph === 'gather' || ph === 'hold') {
        // 转向式收拢：速度矢量连续，从漂移方向缓缓转向目标——不停顿、不重来
        // （期望速度正比于剩余距离，指数收敛；turn 是转向率，越小弧线越缓）
        const dx = this.glyph[i].x - p.x, dy = this.glyph[i].y - p.y;
        const dist = Math.hypot(dx, dy);
        const tau = ph === 'gather' ? 0.6 : 0.3;
        const sp = dist / tau;
        const dvx = dist > 0.1 ? (dx / dist) * sp : 0;
        const dvy = dist > 0.1 ? (dy / dist) * sp : 0;
        const turn = Math.min(1, 3.0 * dt);
        p.vx += (dvx - p.vx) * turn;
        p.vy += (dvy - p.vy) * turn;
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else { // release：从瞳形散开，赋新速度回归漂移
        p.vx = (p.x - w / 2) * 0.06 + (this.R() - 0.5) * 6;
        p.vy = (p.y - h / 2) * 0.06 + (this.R() - 0.5) * 6;
        p.x += p.vx * dt * ease(k); p.y += p.vy * dt * ease(k);
      }
    }
    // 连线：全相位同一套距离规则——漂移结成什么就连着什么走，聚形途中远了断、
    // 近了结；形状描边只是随 s 渐显的叠加层，不发生「线突然全变」的切换
    ctx.clearRect(0, 0, w, h);
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(this.pts[i].x - this.pts[j].x, this.pts[i].y - this.pts[j].y);
        if (d >= this.thr) continue;
        // 越近越亮，峰值 0.75 与形状描边同亮；瞳族粒子（12 起）及其连线紫色
        const a = 0.25 + 0.5 * (1 - d / this.thr);
        ctx.strokeStyle = `rgba(${i >= 12 || j >= 12 ? VIOLET : BLUE},${a})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(this.pts[i].x, this.pts[i].y); ctx.lineTo(this.pts[j].x, this.pts[j].y); ctx.stroke();
      }
    }
    // 形状描边叠加层：随形度 s 渐显渐隐（菱形 0-11 闭环 + 竖瞳 12-19 闭环）
    if (s > 0.01) {
      const loop = (from: number, to: number, rgb: string, a: number, lw: number) => {
        ctx.strokeStyle = `rgba(${rgb},${a})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = from; i <= to; i++) {
          const p = this.pts[i];
          if (i === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath(); ctx.stroke();
      };
      loop(0, 11, CYAN, s * 0.75, 1.1);
      loop(12, 19, VIOLET, s * 0.68, 0.9);
    }
    // 粒子：统一形状态半径；瞳族常紫；亮度随 s 渐变（0.8 → 0.95）
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      ctx.fillStyle = `rgba(${i >= 12 ? VIOLET : CYAN},${0.8 + 0.15 * s})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.9, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ============ B 潮汐：竖向波层上升流 ============
class EmblemTide {
  private cols: { phase: number; speed: number; off: number }[] = [];
  constructor(private w: number, private h: number) {
    const R = rng(20260809);
    for (let c = 0; c < 7; c++) {
      this.cols.push({ phase: R() * Math.PI * 2, speed: 0.75 + R() * 0.5, off: R() });
    }
  }
  step(ctx: CanvasRenderingContext2D, now: number): void {
    const { w, h } = this;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    const per = 9;
    const grid: { x: number; y: number; a: number }[][] = [];
    for (let c = 0; c < this.cols.length; c++) {
      const col = this.cols[c];
      const cx = (c + 0.5) * (w / this.cols.length);
      const pts: { x: number; y: number; a: number }[] = [];
      for (let j = 0; j < per; j++) {
        // 上升循环：底部淡入顶部淡出，各列错位
        const prog = ((j / per) + t * col.speed / 16 + col.off) % 1;
        const y = h + 6 - prog * (h + 12);
        const x = cx + Math.sin(y * 0.05 + t * 1.1 + col.phase) * w * 0.055;
        const a = Math.sin(prog * Math.PI); // 两端淡出
        pts.push({ x, y, a });
        ctx.fillStyle = `rgba(${CYAN},${0.75 * a})`;
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      grid.push(pts);
    }
    // 相邻波层同排连线（潮纹横索）
    for (let c = 0; c < grid.length - 1; c++) {
      for (let j = 0; j < per; j++) {
        const p = grid[c][j], q = grid[c + 1][j];
        const a = Math.min(p.a, q.a) * 0.34;
        ctx.strokeStyle = `rgba(${BLUE},${a})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }
  }
}

// ============ C 轨道：意志核利萨如绕行 ============
class EmblemOrbit {
  private sats: { r0: number; om: number; ph: number }[] = [];
  private trail: { x: number; y: number }[] = [];
  constructor(private w: number, private h: number) {
    const R = rng(20260810);
    for (let i = 0; i < 12; i++) {
      this.sats.push({ r0: (0.18 + R() * 0.26) * Math.min(w, h), om: (0.25 + R() * 0.4) * (R() > 0.5 ? 1 : -1), ph: R() * Math.PI * 2 });
    }
  }
  step(ctx: CanvasRenderingContext2D, now: number): void {
    const { w, h } = this;
    const t = now / 1000;
    const cx = w / 2, cy = h / 2;
    // 意志核：慢利萨如（3:2，周期 ~24s）
    const T = t * (Math.PI * 2 / 24);
    const core = {
      x: cx + w * 0.30 * Math.sin(3 * T + 1.7),
      y: cy + h * 0.34 * Math.sin(2 * T + 0.4),
    };
    this.trail.push(core);
    if (this.trail.length > 42) this.trail.shift();
    ctx.clearRect(0, 0, w, h);
    // 尾迹渐隐折线
    for (let i = 1; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.30;
      ctx.strokeStyle = `rgba(${VIOLET},${a})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y); ctx.lineTo(this.trail[i].x, this.trail[i].y); ctx.stroke();
    }
    // 卫星：本位轨道 + 核邻近牵引
    const satPos: { x: number; y: number }[] = [];
    for (const s of this.sats) {
      const bx = cx + Math.cos(s.ph + t * s.om) * s.r0;
      const by = cy + Math.sin(s.ph + t * s.om) * s.r0 * 1.25; // 竖区拉纵向
      const d = Math.hypot(bx - core.x, by - core.y);
      const k = 0.22 * Math.exp(-(d * d) / (2 * 26 * 26));
      const x = bx * (1 - k) + core.x * k, y = by * (1 - k) + core.y * k;
      satPos.push({ x, y });
      const a = 0.18 + 0.5 * Math.exp(-(d * d) / (2 * 30 * 30));
      ctx.strokeStyle = `rgba(${BLUE},${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(core.x, core.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(${CYAN},0.75)`;
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // 核：紫光焦点
    ctx.fillStyle = `rgba(${VIOLET},0.95)`;
    ctx.beginPath(); ctx.arc(core.x, core.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${VIOLET},0.22)`;
    ctx.beginPath(); ctx.arc(core.x, core.y, 5.5, 0, Math.PI * 2); ctx.fill();
  }
}

// ============ 装配：三画布共享单 rAF ============
export function initObsEmblems(getRects: () => EmblemRects | null): { relayout: () => void } {
  let els: HTMLCanvasElement[] = [];
  let engines: { step: (ctx: CanvasRenderingContext2D, now: number, dt: number) => void }[] = [];
  let ctxs: CanvasRenderingContext2D[] = [];

  const build = () => {
    for (const el of els) el.remove();
    els = []; ctxs = []; engines = [];
    const r = getRects();
    if (!r || r.pocket.width < 40 || r.pocket.height < 60) return; // 区域太小宁缺毋滥
    const [cvA, ctxA, wA, hA] = mkCanvas(r.pocket);
    const [cvB, ctxB, wB, hB] = mkCanvas(r.stripTop);
    const [cvC, ctxC, wC, hC] = mkCanvas(r.stripBot);
    els = [cvA, cvB, cvC]; ctxs = [ctxA, ctxB, ctxC];
    engines = [new EmblemGather(wA, hA), new EmblemTide(wB, hB), new EmblemOrbit(wC, hC)];
  };

  build();
  let last = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    for (let i = 0; i < engines.length; i++) engines[i].step(ctxs[i], now, dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return { relayout: build };
}
