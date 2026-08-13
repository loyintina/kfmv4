/**
 * hand.ts — 「AI 的手」操作代理（2026-08-11 立项，v8.6.0 手；2026-08-12 重构）
 *
 * 设计源起：用户提议给 AI 配一个可见的鼠标——页面上有一个「手」的 UI，
 * 平时停驻在轨道区待机巡逻，AI 要操作时手脱离轨道、移动到目标坐标、
 * 按下（注入 PointerEvent 复用 gesture-registry 全套手势），完成后回归。
 *
 * 2026-08-12 重构（用户拍板）：涌现式物理（引力/弹簧/Verlet/互斥/硬约束，
 * 十余轮调参始终「不按设想运动」）→ **状态机骨头 + 参数轨道皮肤**：
 * - 骨头（重心层）：idle 噪声游走 / move 补间过冲 / press 收轨涟漪 / return 回归，
 *   每帧位置可预测、可调参、可复现——发散在构造上不可能
 * - 皮肤（结构层）：玻尔原子——紫核 + 3 颗电子各自沿固定椭圆轨道参数绕行
 *   （倾斜 + 进动），核物理模型的视觉，零数值积分
 *
 * 画布全屏（覆盖整个视口）：手可移动到屏幕任意位置，轨道区 rect 只是
 * 待机游走的中心锚点。全部用**视口绝对坐标**。
 *
 * 层级：Z.HAND（AI 核心层，光球之上、焦点弹窗之下）。
 */

import { Z } from './z-index-layers.js';
import { wsChannel } from './ws-channel.js';
import { handHitTest } from './hand-geometry.js';

// ========== 常量 ==========
const CYAN = '6,182,212';
const VIOLET = '139,92,246';
const BLUE = '59,130,246';

// 确定性伪随机（定种子，重绘不跳变）
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

/** 1D 值噪声（512 梯度定种子 + smoothstep 插值）——待机游走的「有机随机」源。
 *  游戏业标准做法（NPC 游荡/镜头呼吸同族）：平滑、有界、永不发散。 */
function makeNoise(seed: number): (t: number) => number {
  const R = rng(seed);
  const N = 512;
  const g: number[] = [];
  for (let i = 0; i < N; i++) g.push(R() * 2 - 1);
  return (t: number) => {
    const i = Math.floor(t) % N, f = t - Math.floor(t);
    const u = f * f * (3 - 2 * f);
    return g[(i + N) % N] * (1 - u) + g[(i + 1) % N] * u;
  };
}

// 缓动（画布 rAF 手动驱动，不走 GSAP——check-anim 白名单外禁直引 gsap）
const easeOutBack = (p: number, s = 1.15): number => { const q = p - 1; return 1 + q * q * ((s + 1) * q + s); };
const easeInOutCubic = (p: number): number => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

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

// ============ 手引擎：状态机（idle/move/press/return）+ 玻尔原子皮肤 ============

type HandState = 'idle' | 'move' | 'press' | 'return' | 'drag';

interface Electron {
  rx: number;    // 椭圆轨道半长轴（px）
  om: number;    // 角速度（rad/s，符号 = 方向）
  ph: number;    // 初相位
  tilt: number;  // 轨道倾角（rad，伪 3D）
  prec: number;  // 进动角速度（rad/s，椭圆长轴缓转）
}

const HOLD_MS = 1500;        // 移动到位后停留时长（沿用用户定稿的 1.5s 回归语义）
const RETURN_MS = 700;       // 回归补间时长
const PRESS_IN_MS = 240;     // 按下：电子收轨时长
const PRESS_OUT_MS = 420;    // 按下：电子恢复时长
const ECHO_LAG_MS = 110;     // 电子轨道中心滞后核的时间（移动时「甩着走」）

class HandEngine {
  private state: HandState = 'idle';
  private center = { x: 0, y: 0 };              // 核当前位置（视口绝对坐标）
  private trail: { x: number; y: number; t: number }[] = [];
  private orbit: HandRect | null = null;         // 待机游走锚区
  private noiseX = makeNoise(20260810);
  private noiseY = makeNoise(20260811);
  // move/return 补间
  private tw = { fx: 0, fy: 0, tx: 0, ty: 0, t0: 0, dur: 1 };
  private pressQueued = false;
  private pressT0 = 0;
  private ripples: { t0: number }[] = [];
  private electrons: Electron[] = [];
  // 用户拖动（2026-08-13 用户定稿：我也能拖动它，松手 1.5s 后回归）
  private userDrag = false;         // 指针按下接管中（pointermove 直接驱动 center）
  private dragReleaseT0 = 0;        // 松手时刻——HOLD_MS 后回归待机

  constructor() {
    // 3 颗电子（沿用用户拍板的数量）：半径渐远、倾角 60° 均布、异速异向、缓进动
    // 2026-08-12 明显化二批：最内轨道 13→17px（用户实拍「最短的那个轨道加长」）
    const R = rng(20260812);
    for (let i = 0; i < 3; i++) {
      this.electrons.push({
        rx: 17 + i * 6,                            // 17/23/29px——贴身原子，不摊大饼
        om: (1.3 + R() * 0.8) * (i % 2 === 0 ? 1 : -1),
        ph: (i / 3) * Math.PI * 2,
        tilt: i * Math.PI / 3,
        prec: 0.10 + R() * 0.10,
      });
    }
  }

  /** 设置待机游走锚区（视口绝对坐标）——relayout 时更新 */
  setOrbit(rect: HandRect): void {
    if (!this.orbit) {
      this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    } else {
      // 尺寸变化：核/尾迹等比映射到新锚区
      const fx = rect.width / this.orbit.width, fy = rect.height / this.orbit.height;
      if (this.orbit.width > 0 && this.orbit.height > 0 && (fx !== 1 || fy !== 1)) {
        this.center.x = rect.left + (this.center.x - this.orbit.left) * fx;
        this.center.y = rect.top + (this.center.y - this.orbit.top) * fy;
        for (const p of this.trail) { p.x = rect.left + (p.x - this.orbit.left) * fx; p.y = rect.top + (p.y - this.orbit.top) * fy; }
      }
    }
    this.orbit = rect;
  }

  /** 移动手到视口坐标（服务端 hand-move 命令入口） */
  moveTo(x: number, y: number, now: number): void {
    this.tw = { fx: this.center.x, fy: this.center.y, tx: x, ty: y, t0: now, dur: 1 };
    const dist = Math.hypot(x - this.center.x, y - this.center.y);
    this.tw.dur = Math.min(900, Math.max(300, 300 + dist * 0.45));
    this.state = 'move';
    this.userDrag = false;            // AI 命令打断用户拖动
  }

  /** 用户指针按下（命中核附近）——接管核位置直接跟随指针 */
  userDragStart(x: number, y: number, now: number): void {
    this.userDrag = true;
    this.dragReleaseT0 = 0;
    this.center.x = x; this.center.y = y;
    this.trail = [];
    this.state = 'drag';
  }

  /** 命中测试：指针是否落在核附近（复用纯函数 handHitTest，半径 48px） */
  hitTest(px: number, py: number): boolean {
    return handHitTest(px, py, this.center.x, this.center.y);
  }

  /** 用户拖动中：pointermove 直接驱动 center（不做补间） */
  userDragMove(x: number, y: number): void {
    if (!this.userDrag) return;
    this.center.x = x; this.center.y = y;
  }

  /** 用户松手：记录松手时刻，HOLD_MS 后回归待机轨道 */
  userDragEnd(now: number): void {
    if (!this.userDrag) return;
    this.userDrag = false;
    this.dragReleaseT0 = now;
  }

  /** 按下（服务端 hand-press 命令入口）：给了坐标就先移过去再按 */
  press(x: number | null, y: number | null, now: number): void {
    if (x !== null && y !== null) {
      this.moveTo(x, y, now);
      this.pressQueued = true;
    } else {
      this.pressQueued = false;
      this.pressT0 = now;                 // 原地按：收轨 + 涟漪，然后回归
      this.ripples.push({ t0: now + PRESS_IN_MS * 0.8 });
      this.state = 'press';
    }
  }

  /** 待机游走目标位置（live——回归时对着它降落，落地即接轨游走）
   * 增益放大到半尺寸 0.60（噪声开区间达不到 ±1，理论最大会被吃掉），
   * clamp 到距边 2px——上下左右轨迹都能真实贴到栏边框（2026-08-13 用户定稿）
   */
  private idlePos(now: number): { x: number; y: number } {
    const ob = this.orbit!;
    const cx = ob.left + ob.width / 2, cy = ob.top + ob.height / 2;
    const t = now / 1000;
    const nx = this.noiseX(t * 0.13) * ob.width * 0.60;
    const ny = this.noiseY(t * 0.11) * ob.height * 0.60;
    return {
      x: Math.min(Math.max(ob.left + 2, cx + nx), ob.left + ob.width - 2),
      y: Math.min(Math.max(ob.top + 2, cy + ny), ob.top + ob.height - 2),
    };
  }

  /** 核位置状态机推进 */
  private stepCenter(now: number): void {
    if (this.state === 'idle') {
      this.center = this.idlePos(now);
    } else if (this.state === 'drag') {
      // 用户拖动：center 由 pointermove 直接驱动（不重算）；
      // 松手后停留 HOLD_MS（1.5s）再回归待机轨道
      if (!this.userDrag && this.dragReleaseT0 > 0 && now - this.dragReleaseT0 >= HOLD_MS) {
        this.tw = { fx: this.center.x, fy: this.center.y, tx: 0, ty: 0, t0: now, dur: RETURN_MS };
        this.state = 'return';
      }
    } else if (this.state === 'move') {
      const p = Math.min(1, (now - this.tw.t0) / this.tw.dur);
      const e = easeOutBack(p);
      this.center.x = this.tw.fx + (this.tw.tx - this.tw.fx) * e;
      this.center.y = this.tw.fy + (this.tw.ty - this.tw.fy) * e;
      if (p >= 1) {
        if (this.pressQueued) {
          this.pressQueued = false;
          this.pressT0 = now;
          this.ripples.push({ t0: now + PRESS_IN_MS * 0.8 });
          this.state = 'press';
        } else if (now - this.tw.t0 >= HOLD_MS) {
          this.tw = { ...this.tw, fx: this.center.x, fy: this.center.y, t0: now };
          this.state = 'return';
        }
      }
    } else if (this.state === 'press') {
      if (now - this.pressT0 >= PRESS_IN_MS + PRESS_OUT_MS) {
        this.tw = { ...this.tw, fx: this.center.x, fy: this.center.y, t0: now };
        this.state = 'return';
      }
    } else { // return
      const p = Math.min(1, (now - this.tw.t0) / RETURN_MS);
      const e = easeInOutCubic(p);
      const live = this.idlePos(now);
      this.center.x = this.tw.fx + (live.x - this.tw.fx) * e;
      this.center.y = this.tw.fy + (live.y - this.tw.fy) * e;
      if (p >= 1) this.state = 'idle';
    }
  }

  /** 滞后核位置（电子轨道中心）：从尾迹取 now-ECHO_LAG_MS 的点 */
  private echoCenter(now: number): { x: number; y: number } {
    const target = now - ECHO_LAG_MS;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (this.trail[i].t <= target) return this.trail[i];
    }
    return this.trail[0] ?? this.center;
  }

  /** 按下收轨系数：1 → 0.12（收进核）→ 1（恢复） */
  private orbitScale(now: number): number {
    if (this.state !== 'press') return 1;
    const dt = now - this.pressT0;
    if (dt < PRESS_IN_MS) return 1 - (dt / PRESS_IN_MS) * 0.88;
    return 0.12 + Math.min(1, (dt - PRESS_IN_MS) / PRESS_OUT_MS) * 0.88;
  }

  step(ctx: CanvasRenderingContext2D, now: number): void {
    const ob = this.orbit;
    if (!ob || ob.width < 20 || ob.height < 20) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
    this.stepCenter(now);

    // 尾迹（沿用用户定稿：1.5s 时间衰减，幂次渐隐；2026-08-12 明显化批：头部上限 0.6→0.7、线宽 0.8→1.2）
    this.trail.push({ x: this.center.x, y: this.center.y, t: now });
    const TRAIL_MS = 1500;
    while (this.trail.length > 0 && now - this.trail[0].t > TRAIL_MS) this.trail.shift();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let i = 1; i < this.trail.length; i++) {
      const age = (now - this.trail[i].t) / TRAIL_MS;
      const a = Math.pow(1 - age, 1.5) * 0.70;
      ctx.strokeStyle = `rgba(${VIOLET},${a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y); ctx.lineTo(this.trail[i].x, this.trail[i].y); ctx.stroke();
    }

    // 玻尔原子皮肤：3 条倾斜椭圆轨道（参数方程，非积分）+ 电子
    const t = now / 1000;
    const echo = this.echoCenter(now);
    const scale = this.orbitScale(now);
    for (const el of this.electrons) {
      const rx = el.rx * scale, ry = el.rx * 0.38 * scale;
      const tilt = el.tilt + t * el.prec;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      // 轨道环（2026-08-12 明显化二批：双层绘制——先暗底衬保白底轮廓，
      // 再蓝色辉光出发光感；透明度 0.22→0.38。暗底衬 = 光标/选中环同款
      // 白底对比方案，小而淡，不影响底下阅读）
      ctx.strokeStyle = `rgba(${BLUE},0.38)`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(echo.x, echo.y, rx, ry, tilt, 0, Math.PI * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4; ctx.stroke();
      ctx.shadowColor = `rgba(${BLUE},0.9)`; ctx.shadowBlur = 8; ctx.stroke();
      ctx.shadowBlur = 0;
      // 电子（参数绕行，永不发散；同样双层：暗底衬 + 青色辉光 6→8px）
      const a = el.om * t + el.ph;
      const lx = Math.cos(a) * rx, ly = Math.sin(a) * ry;
      const ex = echo.x + lx * ct - ly * st;
      const ey = echo.y + lx * st + ly * ct;
      ctx.fillStyle = `rgba(${CYAN},0.95)`;
      ctx.beginPath(); ctx.arc(ex, ey, 2.0, 0, Math.PI * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 4; ctx.fill();
      ctx.shadowColor = `rgba(${CYAN},0.95)`; ctx.shadowBlur = 8; ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 按下涟漪（声纳：扩散圈，macOS 定位光标同款）
    this.ripples = this.ripples.filter(r => now - r.t0 < 600);
    for (const r of this.ripples) {
      const p = Math.max(0, (now - r.t0) / 600);
      if (p <= 0 || p >= 1) continue;
      ctx.strokeStyle = `rgba(${VIOLET},${(1 - p) * 0.55})`;
      ctx.lineWidth = 1.2 * (1 - p) + 0.4;
      ctx.beginPath(); ctx.arc(this.center.x, this.center.y, 4 + p * 30, 0, Math.PI * 2); ctx.stroke();
    }

    // 核：紫光焦点 + 光圈（2026-08-12 明显化批——用户实拍「太不明显」：
    // 核 2.2→3.2px + 紫色辉光 12px，光圈 5.5→8px/0.25→0.35，
    // idle 加呼吸脉冲（±18%，1.6rad/s）——静止时也有存在感，macOS 找光标思路；
    // 按下时光圈脉冲放大语义不变）
    const pulse = this.state === 'press' ? 1 + 0.8 * (1 - this.orbitScale(now)) : 1;
    const breathe = this.state === 'idle' ? 1 + 0.18 * Math.sin(t * 1.6) : 1;
    // 双层：暗底衬（白字/白底保住焦点轮廓）→ 紫色辉光（黑底发光）
    ctx.fillStyle = `rgba(${VIOLET},0.95)`;
    ctx.beginPath(); ctx.arc(this.center.x, this.center.y, 3.2, 0, Math.PI * 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 5; ctx.fill();
    ctx.shadowColor = `rgba(${VIOLET},0.95)`; ctx.shadowBlur = 12; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(${VIOLET},0.35)`;
    ctx.beginPath(); ctx.arc(this.center.x, this.center.y, 8 * pulse * breathe, 0, Math.PI * 2); ctx.fill();
  }
}

/** 命中测试委托：hand-geometry.js 提供（纯函数，可离线单测） */

// ============ 装配：全屏画布单 rAF（待机巡逻 + 目标移动 + 按下 + 用户拖动） ============
export function initHand(getOrbit: () => HandRect | null): { relayout: () => void; moveTo: (x: number, y: number) => void } {
  let el: HTMLCanvasElement | null = null;
  let engine: HandEngine | null = null;
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
      if (!engine) engine = new HandEngine();
    }
    if (ob) engine?.setOrbit(ob);
  };

  build();
  // AI 的手：接收服务端命令（工具广播）
  let moveFn: ((x: number, y: number) => void) | null = null;
  wsChannel.onCommand('hand-move', (_action, params) => {
    const x = Number(params.x);
    const y = Number(params.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    moveFn?.(x, y);
  });
  wsChannel.onCommand('hand-press', (_action, params) => {
    const x = Number(params.x), y = Number(params.y);
    const has = Number.isFinite(x) && Number.isFinite(y);
    engine?.press(has ? x : null, has ? y : null, performance.now());
  });

  // 用户交互：拖动核到任意位置，松手 1.5s 后回归待机轨道
  // （2026-08-13 用户定稿：手不只 AI 能动，用户也能拖）
  // capture:true + stopPropagation——命中核时拦截事件，防止继续传播到
  // gesture-registry 触发其他手势（召唤卡片堆/全屏卡滚动，2026-08-13 用户反馈）
  let dragPointerId: number | null = null;
  const onPointerDown = (e: PointerEvent) => {
    if (!engine || dragPointerId !== null) return;
    if (!engine.hitTest(e.clientX, e.clientY)) return;
    dragPointerId = e.pointerId;
    engine.userDragStart(e.clientX, e.clientY, performance.now());
    e.stopPropagation();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragPointerId !== e.pointerId) return;
    engine?.userDragMove(e.clientX, e.clientY);
    e.stopPropagation();
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragPointerId !== e.pointerId) return;
    dragPointerId = null;
    engine?.userDragEnd(performance.now());
    e.stopPropagation();
  };
  document.addEventListener('pointerdown', onPointerDown, { capture: true });
  document.addEventListener('pointermove', onPointerMove, { capture: true });
  document.addEventListener('pointerup', onPointerUp, { capture: true });
  document.addEventListener('pointercancel', onPointerUp, { capture: true });
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
    /** 移动手到视口坐标（服务端 hand-move 命令入口）。
     *  时基 = performance.now()——必须与 rAF 回调的 now 同源
     *  （2026-08-12 事故：Date.now 混入，epoch 与页面时基差 1.7e12，
     *  补间进度算出巨负值，easeOutBack 直接把手抛出屏幕永不回归） */
    moveTo(x: number, y: number): void {
      engine?.moveTo(x, y, performance.now());
    },
  };
  moveFn = api.moveTo;
  return api;
}
