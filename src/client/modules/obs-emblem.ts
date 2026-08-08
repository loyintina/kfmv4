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

// ============ A 聚散：随机闭环 ⇄ 深渊菱瞳 + 矩阵时刻 ============
// 设计（2026-08-08 用户定稿）：无相位状态机。一轮 T 内每个粒子沿「随机闭环」
// 巡游——起点=终点=自己的形状位，轨迹每轮重生成。轮界瞬间 21 点同归形状位，
// 形自然浮现；随后各自散入随机路径。**矩阵时刻**：周期中点（T/2）全员恰好
// 穿过一套「秩序模式」阵位（交错阵/同心环/双链滑移/十字星/横波阵，每轮随机
// 不连庄），混乱中段闪出第二次小秩序。速率全程缓动：成形前 4s smoothstep
// 缓减速到 0.1 倍谷底（不停顿），再 4s 缓加速；矩阵时刻另有浅减速窗
// （0.2 倍谷底、半宽 T/8）。减速点到加速点正好半个周期，中段回到满缓速。
class EmblemGather {
  private glyph: { x: number; y: number }[] = [];
  private t0 = 0;
  private lastT = -1;
  private R: () => number;
  private v = 0;   // 全员统一速率（缓，均值），px/s
  private thr = 0; // 连线阈值（单阈值）
  // 每粒子的本轮路径：采样点 + 弧长表；prog=弧长进度累计；
  // arcC=阵位所在弧长，k1/k2=前半轮/后半轮推进系数（px/s@f=1）
  private paths: { xs: number[]; ys: number[]; cum: number[]; len: number }[] = [];
  private prog: number[] = [];
  private arcC: number[] = [];
  private k1: number[] = [];
  private k2: number[] = [];
  private cells: { x: number; y: number }[] = []; // 本轮阵位（守视验证/阵度用）
  private patName = '';
  private lastPat = -1;
  private static T = 16000;        // 一轮时长：形 → 散 → 阵 → 乱 → 形
  private static SHAPE_TAU = 2500; // 轮界前后形可读窗口（ms）
  private static MTAU = 1200;      // 矩阵时刻阵度窗口（ms，±1.2s）
  private static SEG = 60;         // 每段弧长采样数
  private static FMIN = 0.1;       // 主成形缓动谷底速率比
  private static FMIN2 = 0.2;      // 矩阵时刻缓动谷底速率比（浅于主成形）
  constructor(private w: number, private h: number) {
    this.R = rng(20260808);
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
    this.thr = Math.min(w, h) * 0.22; // 连接距离收紧（线网太密，2026-08-08 实拍）
    this.v = Math.hypot(w, h) * 0.13; // 缓速略提：路径更长、轨迹更发散
    this.regen();
  }
  // 分组：0-11 菱形 / 12-19 竖瞳 / 20 瞳心（独组）
  private static grp(i: number): number { return i < 12 ? 0 : i < 20 ? 1 : 2; }
  // 尺寸变化原地适配：采样坐标等比缩放 + 弧长表重建 + 进度按比例映射——
  // 周期时钟/随机路径全保留，不重启不瞬移（2026-08-08：翻屏几何波动频繁触发
  // relayout，重建引擎导致周期反复归零、形每 ~7s 瞬移一次）
  resize(nw: number, nh: number): void {
    const fx = nw / this.w, fy = nh / this.h;
    this.w = nw; this.h = nh;
    this.glyph = this.glyph.map(g => ({ x: g.x * fx, y: g.y * fy }));
    this.cells = this.cells.map(c => ({ x: c.x * fx, y: c.y * fy }));
    for (let pi = 0; pi < this.paths.length; pi++) {
      const p = this.paths[pi];
      for (let i = 0; i < p.xs.length; i++) { p.xs[i] *= fx; p.ys[i] *= fy; }
      const cum = [0];
      for (let i = 1; i <= p.xs.length; i++) {
        const a = i % p.xs.length;
        cum.push(cum[i - 1] + Math.hypot(p.xs[a] - p.xs[i - 1], p.ys[a] - p.ys[i - 1]));
      }
      const oldLen = p.len;
      p.cum = cum; p.len = cum[cum.length - 1];
      this.prog[pi] = oldLen > 0 ? (this.prog[pi] / oldLen) * p.len : 0;
      this.arcC[pi] = cum[3 * EmblemGather.SEG];
    }
    const intH = EmblemGather.halfInt();
    this.k1 = this.paths.map((p, i) => this.arcC[i] / intH);
    this.k2 = this.paths.map((p, i) => (p.len - this.arcC[i]) / intH);
    this.thr = Math.min(nw, nh) * 0.22;
    this.v = Math.hypot(nw, nh) * 0.13;
  }
  // 闭环边（同组相邻 + 首尾相接）：由形状描边层统一画，动态连线跳过以免叠亮
  private static loopEdge(i: number, j: number): boolean {
    return (j === i + 1 && EmblemGather.grp(i) === EmblemGather.grp(j))
      || (i === 0 && j === 11) || (i === 12 && j === 19);
  }
  // 形状位 + 随机路点 → 闭合 Catmull-Rom 采样 + 弧长表
  private buildPath(g: { x: number; y: number }, wps: { x: number; y: number }[]): { xs: number[]; ys: number[]; cum: number[]; len: number } {
    const P = [g, ...wps];
    const M = P.length;
    const xs: number[] = [], ys: number[] = [];
    const cr = (a: number, b: number, c: number, d: number, u: number) =>
      0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    for (let k = 0; k < M; k++) {
      const p0 = P[(k - 1 + M) % M], p1 = P[k], p2 = P[(k + 1) % M], p3 = P[(k + 2) % M];
      for (let si = 0; si < EmblemGather.SEG; si++) {
        const u = si / EmblemGather.SEG;
        xs.push(Math.max(4, Math.min(this.w - 4, cr(p0.x, p1.x, p2.x, p3.x, u))));
        ys.push(Math.max(4, Math.min(this.h - 4, cr(p0.y, p1.y, p2.y, p3.y, u))));
      }
    }
    const cum = [0];
    for (let i = 1; i <= xs.length; i++) {
      const a = i % xs.length;
      cum.push(cum[i - 1] + Math.hypot(xs[a] - xs[i - 1], ys[a] - ys[i - 1]));
    }
    return { xs, ys, cum, len: cum[cum.length - 1] };
  }
  // ============ 秩序模式库（矩阵时刻，2026-08-08 五套定稿）============
  // 每套给出 21 粒子的阵位 cells（像素）与过阵方向 dirs（切向约束用）
  private static matrixPats(w: number, h: number): { name: string; cells: { x: number; y: number }[]; dirs: { x: number; y: number }[] }[] {
    const cx = w / 2, cy = h / 2, mn = Math.min(w, h), PI2 = Math.PI * 2;
    const pats: { name: string; cells: { x: number; y: number }[]; dirs: { x: number; y: number }[] }[] = [];
    { // 交错阵：青 3×4 下行，紫 2×4 上行，两阵擦肩
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      const cCols = [0.28, 0.5, 0.72], cRows = [0.26, 0.42, 0.58, 0.74];
      const vCols = [0.39, 0.61], vRows = [0.34, 0.50, 0.66, 0.82];
      for (let i = 0; i < 12; i++) { cells.push({ x: cCols[i % 3] * w, y: cRows[(i / 3 | 0)] * h }); dirs.push({ x: 0, y: 1 }); }
      for (let i = 0; i < 8; i++) { cells.push({ x: vCols[i % 2] * w, y: vRows[(i / 2 | 0)] * h }); dirs.push({ x: 0, y: -1 }); }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '交错阵', cells, dirs });
    }
    { // 同心环：青外环顺转，紫内环逆转，瞳心居中（像素正圆，切向过阵）
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI2;
        cells.push({ x: cx + 0.40 * mn * Math.cos(a), y: cy + 0.40 * mn * Math.sin(a) });
        dirs.push({ x: -Math.sin(a), y: Math.cos(a) });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI2 + 0.4;
        cells.push({ x: cx + 0.20 * mn * Math.cos(a), y: cy + 0.20 * mn * Math.sin(a) });
        dirs.push({ x: Math.sin(a), y: -Math.cos(a) });
      }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '同心环', cells, dirs });
    }
    { // 双链滑移：青两列竖链下行，紫一列竖链上行，DNA 错位
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      for (let i = 0; i < 12; i++) { cells.push({ x: (i % 2 === 0 ? 0.32 : 0.68) * w, y: (0.25 + 0.1 * (i / 2 | 0)) * h }); dirs.push({ x: 0, y: 1 }); }
      for (let i = 0; i < 8; i++) { cells.push({ x: 0.5 * w, y: (0.22 + 0.08 * i) * h }); dirs.push({ x: 0, y: -1 }); }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '双链滑移', cells, dirs });
    }
    { // 十字星：青拉对角 X（沿各自对角线外向），紫竖直十字上行，瞳心居十字心
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      const D = 0.7071;
      for (let i = 0; i < 6; i++) { const u = 0.18 + 0.128 * i; cells.push({ x: u * w, y: u * h }); dirs.push({ x: D, y: D }); }
      for (let i = 0; i < 6; i++) { const u = 0.18 + 0.128 * i; cells.push({ x: u * w, y: (1 - u) * h }); dirs.push({ x: D, y: -D }); }
      for (const u of [0.22, 0.38, 0.62, 0.78]) { cells.push({ x: cx, y: u * h }); dirs.push({ x: 0, y: -1 }); }
      for (const u of [0.24, 0.40, 0.60, 0.76]) { cells.push({ x: u * w, y: cy }); dirs.push({ x: 0, y: -1 }); }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '十字星', cells, dirs });
    }
    { // 横波阵：三横排混排（按粒子序 7/7/7 分排），0/2 排右行 1 排左行
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      const rows = [0.32, 0.5, 0.68];
      for (let i = 0; i < 21; i++) {
        const row = (i / 7 | 0), col = i % 7;
        cells.push({
          x: (0.14 + col * 0.12) * w + 0.04 * mn * Math.sin(col * 2.2 + row * 1.7),
          y: rows[row] * h,
        });
        dirs.push({ x: row === 1 ? -1 : 1, y: 0 });
      }
      pats.push({ name: '横波阵', cells, dirs });
    }
    return pats;
  }
  // 缓动速率因子 f(t)：主成形窗（半宽 T/4，谷底 FMIN）+ 矩阵时刻浅窗
  // （半宽 T/8，谷底 FMIN2）——两个秩序时刻各自缓减速再缓加速
  private static speedF(tMs: number): number {
    const T = EmblemGather.T;
    const sm = (x: number) => x * x * (3 - 2 * x);
    const b1 = 1 - sm(Math.min(1, Math.min(tMs, T - tMs) / (T / 4)));
    const b2 = 1 - sm(Math.min(1, Math.abs(tMs - T / 2) / (T / 8)));
    return 1 - (1 - EmblemGather.FMIN) * b1 - (1 - EmblemGather.FMIN2) * b2;
  }
  // 半轮 ∫f dt（秒）：T/2 − (1−FMIN)·W1/2 − (1−FMIN2)·W2/2（两半对称）
  private static halfInt(): number {
    const Ts = EmblemGather.T / 1000;
    return Ts / 2 - (1 - EmblemGather.FMIN) * (Ts / 8) - (1 - EmblemGather.FMIN2) * (Ts / 16);
  }
  // 每轮重生成随机轨迹：抽一套秩序模式（不连庄），路径节点 =
  // 形状位 → 随机点 → 阵前切向点 → 阵位 → 阵后切向点 → 随机点（闭合）；
  // 长度归一（绕形心缩放随机点，阵位钉死不动）
  private regen(): void {
    const target = this.v * (EmblemGather.T / 1000);
    const intH = EmblemGather.halfInt();
    const pats = EmblemGather.matrixPats(this.w, this.h);
    let pi = Math.floor(this.R() * pats.length);
    if (pi === this.lastPat) pi = (pi + 1) % pats.length;
    this.lastPat = pi;
    const pat = pats[pi];
    this.patName = pat.name;
    this.cells = pat.cells;
    const tangD = Math.min(this.w, this.h) * 0.07; // 切向约束臂长
    const clampP = (p: { x: number; y: number }) => ({
      x: Math.max(12, Math.min(this.w - 12, p.x)),
      y: Math.max(12, Math.min(this.h - 12, p.y)),
    });
    this.paths = this.glyph.map((g, i) => {
      const cell = pat.cells[i], dir = pat.dirs[i];
      let wps = [
        { x: 12 + this.R() * (this.w - 24), y: 12 + this.R() * (this.h - 24) },
        clampP({ x: cell.x - dir.x * tangD, y: cell.y - dir.y * tangD }),
        clampP({ x: cell.x, y: cell.y }),
        clampP({ x: cell.x + dir.x * tangD, y: cell.y + dir.y * tangD }),
        { x: 12 + this.R() * (this.w - 24), y: 12 + this.R() * (this.h - 24) },
      ];
      let path = this.buildPath(g, wps);
      // 归一带 ±40%：只缩两个随机点，阵位/切向点钉死
      if (path.len > 1 && Math.abs(path.len - target) / target > 0.4) {
        const lam = target / path.len;
        const c = { x: this.w / 2, y: this.h / 2 };
        wps = wps.map((p, wi) => (wi === 0 || wi === 4) ? clampP({
          x: c.x + (p.x - c.x) * lam, y: c.y + (p.y - c.y) * lam,
        }) : p);
        path = this.buildPath(g, wps);
      }
      return path;
    });
    // 阵位是节点 3 → 采样点 3*SEG 处的弧长；k1/k2 分半反推，
    // 保证缓动积分后半轮恰好到阵位、一轮后恰好回形状位
    this.arcC = this.paths.map(p => p.cum[3 * EmblemGather.SEG]);
    this.k1 = this.paths.map((p, i) => this.arcC[i] / intH);
    this.k2 = this.paths.map((p, i) => (p.len - this.arcC[i]) / intH);
    this.prog = this.paths.map(() => 0);
  }
  // 弧长 → 位置（二分 + 线性插值）
  private at(path: { xs: number[]; ys: number[]; cum: number[]; len: number }, d: number): { x: number; y: number } {
    const { xs, ys, cum } = path;
    const n = xs.length;
    let lo = 0, hi = cum.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo] || 1;
    const u = Math.max(0, Math.min(1, (d - cum[lo]) / seg));
    return {
      x: xs[lo % n] + (xs[hi % n] - xs[lo % n]) * u,
      y: ys[lo % n] + (ys[hi % n] - ys[lo % n]) * u,
    };
  }
  step(ctx: CanvasRenderingContext2D, now: number, dt: number): void {
    const { w, h } = this;
    if (!this.t0) this.t0 = now;
    const T = EmblemGather.T;
    const t = (now - this.t0) % T;
    if (this.lastT >= 0 && t < this.lastT) this.regen(); // 跨轮界：新一轮随机轨迹+新模式
    // 跨中点：进度钉到阵位弧长，消积分漂移——t=T/2 全员精确各就各位
    if (this.lastT >= 0 && this.lastT < T / 2 && t >= T / 2) this.prog = this.arcC.slice();
    this.lastT = t;
    const ease = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    // 形度 s：距轮界越近越成形（粒子物理上恰好同归形状位，s 只是描边的渐变窗）
    const s = ease(Math.max(0, 1 - Math.min(t, T - t) / EmblemGather.SHAPE_TAU));
    (window as unknown as { __emblemPhase: string }).__emblemPhase = s.toFixed(2); // escape-ok: 守视掐点调试钩子（eval 读形度拍成形帧，试映期临时）
    // 阵度 m：矩阵时刻前后 ±MTAU 窗——粒子微增亮 + 连线阈值放宽让阵形浮现
    const mu = Math.min(1, Math.abs(t - T / 2) / EmblemGather.MTAU);
    const m = 1 - mu * mu * (3 - 2 * mu);
    // 缓动弧长推进：双窗速率因子，k1/k2 分半归一
    const f = EmblemGather.speedF(t);
    const half = t < T / 2;
    const pos = this.paths.map((p, i) => {
      this.prog[i] = Math.min(p.len, this.prog[i] + f * (half ? this.k1[i] : this.k2[i]) * dt);
      return this.at(p, this.prog[i]);
    });
    // escape-ok: 守视验证钩子——形度/阵度与「粒子-目标位平均距离」原子读出，绕过截图延迟
    const md = pos.reduce((acc, p, i) => acc + Math.hypot(p.x - this.glyph[i].x, p.y - this.glyph[i].y), 0) / pos.length;
    const mc = pos.reduce((acc, p, i) => acc + Math.hypot(p.x - this.cells[i].x, p.y - this.cells[i].y), 0) / pos.length;
    (window as unknown as { __emblemDbg: string }).__emblemDbg = `${s.toFixed(2)} md=${md.toFixed(1)} t=${(t / 1000).toFixed(1)} m=${m.toFixed(2)} mc=${mc.toFixed(1)} ${this.patName}`; // escape-ok: 守视验证钩子（试映期临时）
    // 连线：同一套距离规则，全部动态连线随形度 s 统一渐隐——成形后只留
    // 两环一点；闭环边跳过（交给描边层，避免双线叠亮）；
    // 阵度窗内阈值放宽 0.7 倍——阵位邻点刚好够得着，矩阵结构显形
    ctx.clearRect(0, 0, w, h);
    const n = pos.length;
    const thrEff = this.thr * (1 + 0.7 * m);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (EmblemGather.loopEdge(i, j)) continue;
        const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
        if (d >= thrEff) continue;
        // 全局同亮 0.85；但所有动态连线随形度 s 统一渐隐——成形后只留两环一点，
        // 同组隔点线（紫环内的弦）也不能出现（2026-08-08 用户定稿）
        const a = 0.85 * (1 - s);
        ctx.strokeStyle = `rgba(${i >= 12 && i < 20 || j >= 12 && j < 20 ? VIOLET : BLUE},${a})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke();
      }
    }
    // 形状描边：只要两圈（菱形闭环 + 竖瞳闭环），随形度 s 渐显渐隐
    if (s > 0.01) {
      const loop = (from: number, to: number, rgb: string, a: number, lw: number) => {
        ctx.strokeStyle = `rgba(${rgb},${a})`;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = from; i <= to; i++) {
          const p = pos[i];
          if (i === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath(); ctx.stroke();
      };
      loop(0, 11, CYAN, s * 0.85, 1.1);
      loop(12, 19, VIOLET, s * 0.77, 0.9);
    }
    // 粒子：青色组（菱形+瞳心）r1.9，竖瞳组紫色小粒 r1.4——三层层次感；
    // 亮度 = 基底 0.8 + 形度 0.15 + 阵度 0.1（矩阵时刻微增亮一拍）
    for (let i = 0; i < n; i++) {
      const pupil = i >= 12 && i < 20;
      ctx.fillStyle = `rgba(${pupil ? VIOLET : CYAN},${0.8 + 0.15 * s + 0.1 * m})`;
      ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, pupil ? 1.4 : 1.9, 0, Math.PI * 2); ctx.fill();
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
  resize(nw: number, nh: number): void { this.w = nw; this.h = nh; } // 全场由 w/h 逐帧推导，改数即可
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
  let engines: { step: (ctx: CanvasRenderingContext2D, now: number, dt: number) => void; resize?: (nw: number, nh: number) => void }[] = [];
  let ctxs: CanvasRenderingContext2D[] = [];

  const build = () => {
    const r = getRects();
    if (!r || r.pocket.width < 40 || r.pocket.height < 60) { // 区域太小宁缺毋滥
      for (const el of els) el.remove();
      els = []; ctxs = []; engines = [];
      return;
    }
    // 尺寸基本没变（±2px）只挪画布位置——亚像素几何波动连画布都不用换
    const rects = [r.pocket, r.stripTop, r.stripBot];
    if (els.length === 3) {
      const same = rects.every((rc, i) =>
        Math.abs(rc.width - parseFloat(els[i].style.width)) <= 2 &&
        Math.abs(rc.height - parseFloat(els[i].style.height)) <= 2);
      if (same) {
        rects.forEach((rc, i) => { els[i].style.left = `${rc.left}px`; els[i].style.top = `${rc.top}px`; });
        return;
      }
    }
    for (const el of els) el.remove();
    els = []; ctxs = [];
    const [cvA, ctxA, wA, hA] = mkCanvas(r.pocket);
    const [cvB, ctxB, wB, hB] = mkCanvas(r.stripTop);
    const [cvC, ctxC, wC, hC] = mkCanvas(r.stripBot);
    els = [cvA, cvB, cvC]; ctxs = [ctxA, ctxB, ctxC];
    if (engines.length === 3) {
      // 尺寸真变了：画布换新，引擎原地 resize——周期/进度连续，不重启不瞬移
      (window as unknown as { __emblemRz: number }).__emblemRz = ((window as unknown as { __emblemRz: number }).__emblemRz || 0) + 1; // escape-ok: 守视计数（试映期临时）
      engines[0].resize?.(wA, hA); engines[1].resize?.(wB, hB); engines[2].resize?.(wC, hC);
    } else {
      (window as unknown as { __emblemRb: number }).__emblemRb = ((window as unknown as { __emblemRb: number }).__emblemRb || 0) + 1; // escape-ok: 守视计数（试映期临时）
      engines = [new EmblemGather(wA, hA), new EmblemTide(wB, hB), new EmblemOrbit(wC, hC)];
    }
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
