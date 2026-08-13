/**
 * obs-emblem.ts — 深蓝意志动态徽标（2026-08-09 用户实拍裁决：留 A，B/C 取消）
 *
 * 点线移动连接的纯动态结构，作为项目动态 logo：
 *   A 聚散（中央口袋：脉搏/执勤/信箱/SYS 四框围出的竖区）——混沌漂移 ⇄ 收拢成
 *     深渊菱瞳（菱形框+竖瞳），秩序从无形浮现，聚的瞬间是节奏锚点
 *   （B 潮汐 / C 轨道试映后于 2026-08-09 裁决取消，三画布收敛为单画布）
 *
 * 纪律：单 rAF 单画布；pointer-events:none 纯展示；DPR 上限 1.5 + 30fps 节流
 *   （移动端降耗）；失焦由浏览器自停 rAF；mulberry32 定种子伪随机。
 */

import { Z } from './z-index-layers.js';

export interface EmblemRect { left: number; top: number; width: number; height: number }
export interface EmblemRects {
  pocket: EmblemRect; // A：中央口袋（系统/信箱/脉搏/执勤 围出）
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
  cv.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:${Z.CENTER_CONTENT};transition:opacity .9s ease`;
  // DPR 上限 1.5（原 2）：粒子/细线图标 1.5 足够清晰，像素量降 44%——
  // 移动端发热优化（2026-08-09 用户实拍徽标上线后手机发热明显）
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(rect.width * dpr));
  cv.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  document.body.appendChild(cv);
  return [cv, ctx, rect.width, rect.height];
}

// ============ A 聚散：随机闭环 ⇄ 深渊菱瞳 + 矩阵时刻 ============
// 设计（2026-08-09 两节点中点定稿）：一轮 T 内每个粒子沿「随机闭环」巡游——
// 闭环为**闭合二次 B 样条**：曲线精确穿过控制多边形每条边的中点且处处 C¹
// 光滑。成形位（形状位 g 与阵位 cell）**不做节点**，而是「两侧翼节点连边」
// 的中点：侧翼节点沿过点方向对称伸出，间距随机 2~7 格（48~168px）——
// 粒子穿过成形位时方向天然连续，无节点折角（用户实拍：三节点方案减速前
// 一个方向、减速后另一个方向）。计时分两段 Hermite：端点斜率直接给出
// 成形 0.1 倍 / 成阵 0.5 倍谷底速率，中点连续 C¹，精确过位无需修正。
// 跨轮界方向连续：新一轮形状位边方向 = 上轮抵达方向（gDir 留存）。
class EmblemGather {
  private glyph: { x: number; y: number }[] = [];
  private t0 = 0;
  private lastT = -1;
  private R: () => number;
  private thr = 0; // 连线阈值（单阈值）
  // 每粒子的本轮闭环：二次 B 样条采样点 + 弧长表；arcC=阵位（段4起点）弧长；
  // gDir=上轮形状位过点方向（跨轮界方向连续用）
  private paths: { xs: number[]; ys: number[]; cum: number[]; len: number }[] = [];
  private arcC: number[] = [];
  private gDir: ({ x: number; y: number } | undefined)[] = [];
  private cells: { x: number; y: number }[] = []; // 本轮阵位（守视验证/阵度用）
  private patName = '';
  private lastPat = -1;
  private posBuf: { x: number; y: number }[] = []; // 逐帧位置复用缓冲（免每帧 ~60 对象分配）
  private lastDbg = 0; // 守视钩子节流时钟（300ms）
  private static T = 16000;        // 一轮时长：形 → 散 → 阵 → 乱 → 形
  private static SHAPE_TAU = 2500; // 轮界前后形可读窗口（ms）
  private static MTAU = 1200;      // 矩阵时刻阵度窗口（ms，±1.2s）
  private static SEG = 60;         // 每段弧长采样数
  private static GRID = 24;        // 布局网格单元 px（obs-hud 定稿：半格 12px）
  private static FMIN = 0.1;       // 成形谷底速率比（相对本轮均速 len/T）
  private static FMIN2 = 0.5;      // 成阵谷底速率比（浅于成形——只稍微减速）
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
    this.thr = Math.min(w, h) * 0.15; // 连接距离收紧（徽标缩小至 60px 后阈值同步调小，2026-08-13）
    this.posBuf = this.glyph.map(() => ({ x: 0, y: 0 }));
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
      p.cum = cum; p.len = cum[cum.length - 1];
    }
    this.arcC = this.paths.map(p => p.cum[4 * EmblemGather.SEG]); // 阵位=段4起点
    this.gDir = this.gDir.map(d => {
      if (!d) return d;
      const x = d.x * fx, y = d.y * fy, l = Math.hypot(x, y) || 1;
      return { x: x / l, y: y / l };
    });
    this.thr = Math.min(nw, nh) * 0.15;
  }
  // 闭环边（同组相邻 + 首尾相接）：由形状描边层统一画，动态连线跳过以免叠亮
  private static loopEdge(i: number, j: number): boolean {
    return (j === i + 1 && EmblemGather.grp(i) === EmblemGather.grp(j))
      || (i === 0 && j === 11) || (i === 12 && j === 19);
  }
  // 控制多边形 → 闭合二次 B 样条采样 + 弧长表。
  // 二次 B 样条段 j 由控制点 (Cj, Cj+1, Cj+2) 张成，精确起于 mid(Cj,Cj+1)、
  // 止于 mid(Cj+1,Cj+2)，相邻段公共端点切线一致（C¹）——曲线穿过每条
  // 控制边的中点，所以「成形位=两侧翼节点连边中点」是精确到达，且过点
  // 方向=边方向，天然无折角（2026-08-09 两节点中点定稿）
  private buildSpline(C: { x: number; y: number }[]): { xs: number[]; ys: number[]; cum: number[]; len: number } {
    const M = C.length;
    const xs: number[] = [], ys: number[] = [];
    for (let k = 0; k < M; k++) {
      const c0 = C[k], c1 = C[(k + 1) % M], c2 = C[(k + 2) % M];
      for (let si = 0; si < EmblemGather.SEG; si++) {
        const u = si / EmblemGather.SEG, q = 1 - u;
        xs.push(Math.max(4, Math.min(this.w - 4, 0.5 * (q * q * c0.x + (-2 * u * u + 2 * u + 1) * c1.x + u * u * c2.x))));
        ys.push(Math.max(4, Math.min(this.h - 4, 0.5 * (q * q * c0.y + (-2 * u * u + 2 * u + 1) * c1.y + u * u * c2.y))));
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
      const cCols = [0.20, 0.5, 0.80], cRows = [0.15, 0.37, 0.59, 0.81];
      const vCols = [0.35, 0.65], vRows = [0.26, 0.48, 0.70, 0.90];
      for (let i = 0; i < 12; i++) { cells.push({ x: cCols[i % 3] * w, y: cRows[(i / 3 | 0)] * h }); dirs.push({ x: 0, y: 1 }); }
      for (let i = 0; i < 8; i++) { cells.push({ x: vCols[i % 2] * w, y: vRows[(i / 2 | 0)] * h }); dirs.push({ x: 0, y: -1 }); }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '交错阵', cells, dirs });
    }
    { // 同心环：青外环顺转，紫内环逆转，瞳心居中（像素正圆，切向过阵）
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI2;
        cells.push({ x: cx + 0.46 * mn * Math.cos(a), y: cy + 0.46 * mn * Math.sin(a) });
        dirs.push({ x: -Math.sin(a), y: Math.cos(a) });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI2 + 0.4;
        cells.push({ x: cx + 0.24 * mn * Math.cos(a), y: cy + 0.24 * mn * Math.sin(a) });
        dirs.push({ x: Math.sin(a), y: -Math.cos(a) });
      }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '同心环', cells, dirs });
    }
    { // 双链滑移：青两列竖链下行，紫一列竖链上行，DNA 错位
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      for (let i = 0; i < 12; i++) { cells.push({ x: (i % 2 === 0 ? 0.25 : 0.75) * w, y: (0.15 + 0.14 * (i / 2 | 0)) * h }); dirs.push({ x: 0, y: 1 }); }
      for (let i = 0; i < 8; i++) { cells.push({ x: 0.5 * w, y: (0.14 + 0.103 * i) * h }); dirs.push({ x: 0, y: -1 }); }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '双链滑移', cells, dirs });
    }
    { // 十字星：青拉对角 X（沿各自对角线外向），紫竖直十字上行，瞳心居十字心
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      const D = 0.7071;
      for (let i = 0; i < 6; i++) { const u = 0.10 + 0.16 * i; cells.push({ x: u * w, y: u * h }); dirs.push({ x: D, y: D }); }
      for (let i = 0; i < 6; i++) { const u = 0.10 + 0.16 * i; cells.push({ x: u * w, y: (1 - u) * h }); dirs.push({ x: D, y: -D }); }
      for (const u of [0.14, 0.34, 0.66, 0.86]) { cells.push({ x: cx, y: u * h }); dirs.push({ x: 0, y: -1 }); }
      for (const u of [0.16, 0.38, 0.62, 0.84]) { cells.push({ x: u * w, y: cy }); dirs.push({ x: 0, y: -1 }); }
      cells.push({ x: cx, y: cy }); dirs.push({ x: 0, y: 1 });
      pats.push({ name: '十字星', cells, dirs });
    }
    { // 横波阵：三横排混排（按粒子序 7/7/7 分排），0/2 排右行 1 排左行
      const cells: { x: number; y: number }[] = [], dirs: { x: number; y: number }[] = [];
      const rows = [0.25, 0.5, 0.75];
      for (let i = 0; i < 21; i++) {
        const row = (i / 7 | 0), col = i % 7;
        cells.push({
          x: (0.10 + col * 0.133) * w + 0.04 * mn * Math.sin(col * 2.2 + row * 1.7),
          y: rows[row] * h,
        });
        dirs.push({ x: row === 1 ? -1 : 1, y: 0 });
      }
      pats.push({ name: '横波阵', cells, dirs });
    }
    return pats;
  }
  // 每轮重生成随机闭环：抽一套秩序模式（不连庄）。控制多边形 =
  // [g侧翼A0, g侧翼B0, 随机, 随机, 阵侧翼A1, 阵侧翼B1, 随机, 随机]（闭合）——
  // 段0 起点 = mid(A0,B0) = 形状位 g；段4 起点 = mid(A1,B1) = 阵位 cell。
  // 侧翼节点沿过点方向对称伸出，间距随机 2~7 格（2026-08-09 用户定稿）；
  // 形状位边方向延续上轮抵达方向（gDir），跨轮界方向连续无折角
  private regen(): void {
    const pats = EmblemGather.matrixPats(this.w, this.h);
    let pi = Math.floor(this.R() * pats.length);
    if (pi === this.lastPat) pi = (pi + 1) % pats.length;
    this.lastPat = pi;
    const pat = pats[pi];
    this.patName = pat.name;
    this.cells = pat.cells;
    const G = EmblemGather.GRID;
    this.paths = this.glyph.map((g, i) => {
      const cell = pat.cells[i], dir = pat.dirs[i];
      // 两侧翼节点：中点=P、方向=d、半距随机 1~3.5 格，按 ±d 到边界
      // （12px 余量）的射线距离收紧——不做 clamp，保持中点精确 = 成形位
      const wing = (P: { x: number; y: number }, d: { x: number; y: number }) => {
        const ray = (sgn: number) => {
          let r = Infinity;
          if (d.x * sgn > 1e-6) r = Math.min(r, (this.w - 4 - P.x) / (d.x * sgn));
          if (d.x * sgn < -1e-6) r = Math.min(r, (4 - P.x) / (d.x * sgn));
          if (d.y * sgn > 1e-6) r = Math.min(r, (this.h - 4 - P.y) / (d.y * sgn));
          if (d.y * sgn < -1e-6) r = Math.min(r, (4 - P.y) / (d.y * sgn));
          return r;
        };
        const L = Math.max(8, Math.min(G * (1 + this.R() * 2.5), ray(1) - 8, ray(-1) - 8));
        return [
          { x: P.x - d.x * L, y: P.y - d.y * L },
          { x: P.x + d.x * L, y: P.y + d.y * L },
        ];
      };
      // 形状位过点方向：延续上轮抵达方向；首轮用指向阵位的方向
      let u = this.gDir[i];
      if (!u) {
        const dx = cell.x - g.x, dy = cell.y - g.y, l = Math.hypot(dx, dy) || 1;
        u = { x: dx / l, y: dy / l };
      }
      const [A0, B0] = wing(g, u);
      const [A1, B1] = wing(cell, dir);
      const gdx = B0.x - A0.x, gdy = B0.y - A0.y, gl = Math.hypot(gdx, gdy) || 1;
      this.gDir[i] = { x: gdx / gl, y: gdy / gl };
      const rp = () => ({
        x: 4 + this.R() * (this.w - 8),
        y: 4 + this.R() * (this.h - 8),
      });
      return this.buildSpline([A0, B0, rp(), rp(), A1, B1, rp(), rp()]);
    });
    this.arcC = this.paths.map(p => p.cum[4 * EmblemGather.SEG]); // 阵位=段4起点
  }
  // 弧长 → 位置（二分 + 线性插值），写入复用对象 out（不分配新对象）
  private at(path: { xs: number[]; ys: number[]; cum: number[]; len: number }, d: number, out: { x: number; y: number }): void {
    const { xs, ys, cum } = path;
    const n = xs.length;
    let lo = 0, hi = cum.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo] || 1;
    const u = Math.max(0, Math.min(1, (d - cum[lo]) / seg));
    out.x = xs[lo % n] + (xs[hi % n] - xs[lo % n]) * u;
    out.y = ys[lo % n] + (ys[hi % n] - ys[lo % n]) * u;
  }
  step(ctx: CanvasRenderingContext2D, now: number, _dt: number): void {
    const { w, h } = this;
    if (!this.t0) this.t0 = now;
    const T = EmblemGather.T;
    const t = (now - this.t0) % T;
    if (this.lastT >= 0 && t < this.lastT) this.regen(); // 跨轮界：新一轮随机轨迹+新模式
    this.lastT = t;
    const ease = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    // 形度 s：距轮界越近越成形（粒子物理上恰好同归形状位，s 只是描边的渐变窗）
    const s = ease(Math.max(0, 1 - Math.min(t, T - t) / EmblemGather.SHAPE_TAU));
    // 阵度 m：矩阵时刻前后 ±MTAU 窗——粒子微增亮 + 动态连线全隐（只有点在动）
    const mu = Math.min(1, Math.abs(t - T / 2) / EmblemGather.MTAU);
    const m = 1 - mu * mu * (3 - 2 * mu);
    // 弧长推进：两段 Hermite（前半 0→arcC，后半 arcC→len），端点斜率 =
    // 谷底速率（成形 FMIN、成阵 FMIN2，相对本轮均速 len/T）——中点斜率
    // 一致 C¹ 连续，t=T/2 精确过阵、t=0/T 精确成形，无需任何修正项；
    // 半轮中段自然巡航 ~1.5 倍均速（2026-08-09 两节点中点定稿）
    // 位置写入复用缓冲 posBuf（原每帧 map+at 分配 ~60 对象，30fps ≈ 1900/s GC 压力）
    const pos = this.posBuf;
    for (let i = 0; i < this.paths.length; i++) {
      const p = this.paths[i];
      const a = EmblemGather.FMIN * p.len / 2, b = EmblemGather.FMIN2 * p.len / 2;
      const arcC = this.arcC[i], L = p.len;
      const half = t < T / 2;
      const u = half ? t / (T / 2) : (t - T / 2) / (T / 2);
      const u2 = u * u, u3 = u2 * u;
      const d = half
        ? (u3 - 2 * u2 + u) * a + (-2 * u3 + 3 * u2) * arcC + (u3 - u2) * b
        : (2 * u3 - 3 * u2 + 1) * arcC + (u3 - 2 * u2 + u) * b + (-2 * u3 + 3 * u2) * L + (u3 - u2) * a;
      this.at(p, Math.min(L, Math.max(0, d)), pos[i]);
    }
    // escape-ok: 守视验证钩子——形度/阵度与「粒子-目标位平均距离」原子读出，绕过截图延迟。
    // 300ms 节流（eval 往返 ~2.7s，新鲜度足够；原逐帧 42 hypot + 模板拼串白烧）
    if (now - this.lastDbg >= 300) {
      this.lastDbg = now;
      const md = pos.reduce((acc, p, i) => acc + Math.hypot(p.x - this.glyph[i].x, p.y - this.glyph[i].y), 0) / pos.length;
      const mc = pos.reduce((acc, p, i) => acc + Math.hypot(p.x - this.cells[i].x, p.y - this.cells[i].y), 0) / pos.length;
      (window as unknown as { __emblemDbg: string }).__emblemDbg = `${s.toFixed(2)} md=${md.toFixed(1)} t=${(t / 1000).toFixed(1)} m=${m.toFixed(2)} mc=${mc.toFixed(1)} ${this.patName}`; // escape-ok: 守视验证钩子（原子读出绕过截图延迟）
      (window as unknown as { __emblemPhase: string }).__emblemPhase = s.toFixed(2); // escape-ok: 守视掐点拍成形帧用
    }
    const n = pos.length;
    const thr2 = this.thr * this.thr; // 距离²比较免开方：210 对/帧只在对内才 sqrt（移动端降耗）
    // 连线批量描边（2026-08-09 降耗批量化）：帧内 alpha 统一（0.85(1-s)(1-m)）、
    // 颜色仅蓝/紫两桶——两遍收集合并 path，~210 次 stroke → 2 次；
    // 连线随形度 s / 阵度 m 统一渐隐（成形只留两环一点，成阵只有点在动）；
    // 闭环边跳过（交给描边层，避免双线叠亮）。注意：合并 path 后同色线交点
    // 不再二次叠加增亮（原逐线 stroke 交点更亮），观感更均匀
    ctx.clearRect(0, 0, w, h);
    const lineA = 0.85 * (1 - s) * (1 - m);
    if (lineA > 0.01) {
      for (let vio = 0; vio < 2; vio++) {
        ctx.strokeStyle = `rgba(${vio ? VIOLET : BLUE},${lineA})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            if (EmblemGather.loopEdge(i, j)) continue;
            const isV = (i >= 12 && i < 20) || (j >= 12 && j < 20);
            if ((vio === 1) !== isV) continue;
            const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
            if (dx * dx + dy * dy >= thr2) continue;
            ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y);
            any = true;
          }
        }
        if (any) ctx.stroke();
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
    // 粒子批量填充：两色两径各一 path——21 次 fill → 2 次。
    // 青色组（菱形+瞳心）r1.9，竖瞳组紫色小粒 r1.4——三层层次感；
    // 亮度 = 基底 0.8 + 形度 0.15 + 阵度 0.1（矩阵时刻微增亮一拍）
    const dotA = 0.8 + 0.15 * s + 0.1 * m;
    const PI2 = Math.PI * 2;
    ctx.fillStyle = `rgba(${CYAN},${dotA})`;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i >= 12 && i < 20) continue;
      ctx.moveTo(pos[i].x + 1.9, pos[i].y);
      ctx.arc(pos[i].x, pos[i].y, 1.9, 0, PI2);
    }
    ctx.fill();
    ctx.fillStyle = `rgba(${VIOLET},${dotA})`;
    ctx.beginPath();
    for (let i = 12; i < 20 && i < n; i++) {
      ctx.moveTo(pos[i].x + 1.4, pos[i].y);
      ctx.arc(pos[i].x, pos[i].y, 1.4, 0, PI2);
    }
    ctx.fill();
  }
}

// ============ 装配：单画布单 rAF（A 聚散——C 轨道已迁出至 hand.ts，2026-08-11） ============
export function initObsEmblems(getRects: () => EmblemRects | null): { relayout: () => void } {
  let el: HTMLCanvasElement | null = null;
  let engine: { step: (ctx: CanvasRenderingContext2D, now: number, dt: number) => void; resize?: (nw: number, nh: number) => void } | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let curRect: EmblemRect | null = null;
  let renderOn = true;   // 绘制开关（淡出播完才关，淡入前就开——保证运动态渐变）
  let occState = false;  // 当前遮挡状态
  let fadeTimer = 0;

  const build = () => {
    const r = getRects();
    if (!r || r.pocket.width < 40 || r.pocket.height < 60) { // 区域太小宁缺毋滥
      el?.remove();
      el = null; ctx = null; engine = null; curRect = null;
      return;
    }
    curRect = r.pocket;
    // 尺寸基本没变（±2px）只挪画布位置——亚像素几何波动连画布都不用换
    if (el) {
      const same = Math.abs(r.pocket.width - parseFloat(el.style.width)) <= 2 &&
        Math.abs(r.pocket.height - parseFloat(el.style.height)) <= 2;
      if (same) {
        el.style.left = `${r.pocket.left}px`; el.style.top = `${r.pocket.top}px`;
        return;
      }
    }
    el?.remove();
    const [cv, c, w, h] = mkCanvas(r.pocket);
    // 遮挡期重建的画布直接以隐藏态落位（不播淡入，避免无故闪一下）
    if (occState) {
      cv.style.transition = 'none';
      cv.style.opacity = '0';
      void cv.offsetWidth;
      cv.style.transition = 'opacity .9s ease'; // 复位要还原过渡，置空会把 cssText 里的 transition 一并清掉
      renderOn = false;
    }
    el = cv; ctx = c;
    if (engine) engine.resize?.(w, h);
    else {
      (window as unknown as { __emblemRb: number }).__emblemRb = ((window as unknown as { __emblemRb: number }).__emblemRb || 0) + 1; // escape-ok: 守视计数（调试期临时）
      engine = new EmblemGather(w, h);
    }
  };

  build();
  // 遮挡淡出/淡入（2026-08-09 v2 用户实拍定稿：硬切停绘在关卡卡帧时会
  // 「卡住再跳变」，改透明度渐变藏交接）——检测到遮挡：动画继续运动播
  // 淡出（opacity .9s），淡完才停绘；检测到移除：先恢复绘制（运动态）
  // 再播淡入。1.5s 一次 elementFromPoint 五点探测，网格背景=.main 自身
  // （命中子元素=聊天消息/卡片=遮挡）；≥3/5 判遮挡、≤1/5 才判恢复，
  // 半遮边界迟滞不来回闪。粒子位置是当前时间的纯函数，停绘期时间照走。
  const mainEl = document.querySelector('.main');
  const applyOcc = (occ: boolean, animate: boolean) => {
    const cv = el;
    if (!animate) { // 首次探测直接落位，不播动画
      occState = occ; renderOn = !occ;
      if (cv) {
        cv.style.transition = 'none';
        cv.style.opacity = occ ? '0' : '1';
        void cv.offsetWidth;
        cv.style.transition = 'opacity .9s ease'; // 复位要还原过渡——置空曾致淡入淡出全失效（2026-08-09 用户实拍）
      }
      return;
    }
    if (occ === occState) return;
    occState = occ;
    clearTimeout(fadeTimer);
    if (occ) { // 淡出：ease-in 加速离场——截断 0 附近的拖沓长尾（用户实测：
      // 双向同用 ease 时淡出长尾可见、淡入慢头不可见，观感淡入比淡出短得多）
      if (cv) { cv.style.transition = 'opacity .9s ease-in'; cv.style.opacity = '0'; }
      fadeTimer = window.setTimeout(() => { renderOn = false; }, 950);
    } else {     // 淡入：ease-out 快速可见后缓收尾——可见段铺满全程
      renderOn = true;
      if (cv) { cv.style.transition = 'opacity .9s ease-out'; cv.style.opacity = '1'; }
    }
  };
  const probe = (first = false) => {
    if (!mainEl) { applyOcc(false, !first); return; } // 找不到网格背景宁可常画，不误杀
    if (!curRect || !el) { applyOcc(true, !first); return; }
    // 遮挡判定：命中 .main 自身或 HUD 面板（obs-*）都不算遮挡——HUD 面板是徽标的
    // 「邻居」不是覆盖物。真正的遮挡物 = 聊天消息/卡片堆/浮卡。
    let covered = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) {
      const t = document.elementFromPoint(curRect.left + curRect.width * fx, curRect.top + curRect.height * fy);
      if (t && t !== mainEl && !t.classList.contains('obs-emblem') && !(t.closest?.('.obs-hud, [class^="obs-"], [class*=" obs-"]'))) covered++;
    }
    applyOcc(occState ? covered > 1 : covered >= 3, !first);
  };
  setInterval(() => probe(), 1500);
  probe(true);
  let last = 0, lastStep = 0;
  const loop = (now: number) => {
    // 30fps 节流（原逐帧 60fps）：徽标运动极缓，30fps 观感无差，绘制功耗减半
    // （2026-08-09 移动端发热优化）；淡出完成后 renderOn=false 整段跳过
    // （连 30fps 都不画），rAF 空转帧成本可忽略，失焦浏览器自停
    if (renderOn && ctx && engine && now - lastStep >= 33) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now; lastStep = now;
      engine.step(ctx, now, dt);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return { relayout: build };
}
