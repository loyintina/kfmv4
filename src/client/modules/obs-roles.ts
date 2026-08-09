/**
 * obs-roles.ts — 角色卡星座图（观测台 · 全角色关系网）
 *
 * 2026-08-09 用户定稿 v2：活跃角色=紫点+淡光圈（中心锚）、其余角色=统一紫点
 * 外环分布、引用文件=小青色点、连线=角色→文件（活跃青亮/其他紫暗，无角色-角色
 * 直连——共用文件经 refCount 隐式表达）。每颗星沿自身椭圆轨道绕锚位**极缓**
 * 公转（C 轨道方案，周期 20~60s 随机、相位/倾角各异——视觉不机械同步）。
 * 纯光点：星旁无任何文字；面板 head 承载「N卡 · M文件」计数。
 *
 * 数据同步增星：新角色→新紫点从面板边缘淡入滑向轨道；文件引用新增→新青点淡入；
 * 消失的星淡出——不重建引擎、不瞬移（同徽标 resize 原地适配手法）。
 *
 * 性能（同 obs-emblem 家族）：DPR≤1.5、30fps 节流、elementFromPoint 五点探测
 * 遮挡淡出（淡完停绘、露出先恢复运动再淡入）、聚合阈值（角色>24/文件>60 截断
 * +「×N」灰点）保证绘制量恒定。
 */
import { Z } from './z-index-layers.js';

interface FileRef { path: string; name: string; dir: string; size: number; mtime: number; refCount: number; missing: boolean }
interface RoleNode { id: string; name: string; updatedAt: string; static: FileRef[]; dynamic: FileRef[] }
export interface RolesData { roles: RoleNode[]; activeRoleId: string; totalRoles: number; totalFiles: number }
export interface RolesRect { left: number; top: number; width: number; height: number }

const CYAN = '0,212,255';
const VIOLET = '139,92,246';
const GREY = '110,120,145';

/** 固定种子 rng（同徽标）：轨道参数/相位稳定，数据不变时视觉不跳变 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Star {
  key: string;
  kind: 'role' | 'file';
  r: number;
  // 锚位（布局目标）与当前位置（淡入期混合滑入）
  tx: number; ty: number;
  x: number; y: number;
  // 基线呼吸（v7 波纹脉冲：星锚定，每星独立相位慢脉动）
  breathPhase: number;
  breathPeriod: number;
  // 运行时（非创建字段）：呼吸量 0~1、波纹激发量 0~1（step 每帧写）
  breath: number;
  pulse: number;
  active: boolean;
  bright: number;   // 基线亮度 0~1（refCount 等）
  fade: number;     // 淡入淡出 0~1
  missing: boolean;
  refCount: number;
  refs: number;     // 引用该文件的角色数（画线用：找角色星）
  roleIdx: number;  // 角色在 roles 数组的下标（-1=文件）
}

const ROLE_MAX = 24;
const FILE_MAX = 60;
// 波纹脉冲常量（v7 用户定稿：声呐式扫描——星锚定，活跃角色周期扩散波纹，
// 星随波激发闪亮。零 N² 计算、永不相撞永不漂移，性能最低）
const PULSE_PERIOD = 7;    // 脉冲周期 s（中心发一次波）
const PULSE_WIDTH = 16;    // 波纹激发带宽 px
const PULSE_TAIL = 3;      // 保留最近 N 个脉冲的残环（渐隐层次）

class RoleConstellation {
  private stars: Star[] = [];
  private w: number;
  private h: number;
  private R: () => number;
  private cx: number;
  private cy: number;
  private roles: RoleNode[] = [];
  private activeId = '';
  private lastKey = '';

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.R = rng(20260809);
    this.cx = w / 2;
    this.cy = h / 2;
  }

  resize(nw: number, nh: number): void {
    const fx = nw / this.w, fy = nh / this.h;
    this.w = nw; this.h = nh;
    this.cx = nw / 2; this.cy = nh / 2;
    for (const s of this.stars) {
      s.x *= fx; s.y *= fy; s.tx *= fx; s.ty *= fy;
    }
  }  /** 数据驱动：布局锚位表变化 → 星缓动迁移/增星淡入/消失淡出（不重建） */
  setData(d: RolesData): void {
    const sig = JSON.stringify({ r: d.roles.map(x => [x.id, x.static.length, x.dynamic.length]), a: d.activeRoleId });
    this.roles = d.roles;
    this.activeId = d.activeRoleId;
    const wantRoles = d.roles.slice(0, ROLE_MAX);
    const wantFiles = new Map<string, { path: string; name: string; refCount: number; missing: boolean; roleIdx: number[] }>();
    // 文件集合（含截断聚合计数）
    const fileAgg: Array<{ path: string; name: string; refCount: number; missing: boolean; roleIdx: number[] }> = [];
    const seen = new Map<string, typeof fileAgg[number]>();
    for (let i = 0; i < wantRoles.length; i++) {
      for (const f of [...wantRoles[i].static, ...wantRoles[i].dynamic]) {
        let rec = seen.get(f.path);
        if (!rec) {
          rec = { path: f.path, name: f.name, refCount: f.refCount, missing: f.missing, roleIdx: [] };
          seen.set(f.path, rec);
          fileAgg.push(rec);
        }
        rec.roleIdx.push(i);
      }
    }
    fileAgg.sort((a, b) => b.refCount - a.refCount);
    const keptFiles = fileAgg.slice(0, FILE_MAX);
    const extra = fileAgg.length - keptFiles.length;
    for (const f of keptFiles) wantFiles.set(f.path, f);

    // —— 锚位表 ——
    // 2026-08-09 用户定稿：星整体缩小 + 环半径内缩（轨道公转不再推出界）
    const R1 = Math.min(this.w, this.h) * 0.26;
    const nRole = wantRoles.length;
    const roleAng: number[] = [];
    const roleRad: number[] = [];
    let activeIdx = -1;
    wantRoles.forEach((r, i) => {
      if (r.id === this.activeId) activeIdx = i;
    });
    // 活跃角色居中；其余均分外环（>12 双环交错）
    let k = 0;
    wantRoles.forEach((_, i) => {
      if (i === activeIdx) { roleAng[i] = 0; roleRad[i] = 0; return; }
      const total = Math.max(1, nRole - (activeIdx >= 0 ? 1 : 0));
      const ring = total > 12 && k % 2 === 1 ? 1 : 0;
      const per = Math.ceil(total / (ring ? 2 : 1));
      const slot = k - (ring ? Math.floor(total / 2) : 0);
      roleAng[i] = ring ? (slot / per + 0.5 / per) * Math.PI * 2 : (slot / total + 0.5 / total) * Math.PI * 2;
      roleRad[i] = ring ? R1 * 0.72 : R1;
      k++;
    });
    // 文件锚位：角度=引用角色平均角，半径=min(引用角色半径)*0.55 上抬 0.28R1 保底（活跃引用→内圈）
    const fileAnchor = (roleIdx: number[]): { x: number; y: number; rad: number } => {
      let aSum = 0, radSum = 0, radMin = Infinity;
      let hasActive = false;
      for (const i of roleIdx) {
        aSum += roleAng[i];
        radSum += roleRad[i];
        if (roleRad[i] < radMin) radMin = roleRad[i];
        if (roleAng[i] === 0 && roleRad[i] === 0) hasActive = true;
      }
      const ang = aSum / roleIdx.length;
      const rad = hasActive ? R1 * 0.45 : Math.max(R1 * 0.28, radMin * 0.55);
      return { x: this.cx + Math.cos(ang) * rad, y: this.cy + Math.sin(ang) * rad, rad };
    };

    // —— 对齐现有星 ——
    const keep = new Set<string>();
    const roleKeys = new Set(wantRoles.map((_, i) => `r:${wantRoles[i].id}`));
    for (const s of this.stars) {
      const keepStar = s.kind === 'role' ? roleKeys.has(s.key) : wantFiles.has(s.key.slice(2));
      if (!keepStar) { s.fade -= 0.04; if (s.fade <= 0) continue; keep.add(s.key); continue; }
      // 目标锚位
      if (s.kind === 'role') {
        const i = wantRoles.findIndex(r => r.id === s.key.slice(2));
        s.tx = this.cx + Math.cos(roleAng[i]) * roleRad[i];
        s.ty = this.cy + Math.sin(roleAng[i]) * roleRad[i];
        s.active = i === activeIdx;
        s.roleIdx = i;
        keep.add(s.key);
      } else {
        const f = wantFiles.get(s.key.slice(2));
        if (!f) { s.fade -= 0.04; if (s.fade > 0) keep.add(s.key); continue; }
        const a = fileAnchor(f.roleIdx);
        s.tx = a.x; s.ty = a.y;
        s.refCount = f.refCount;
        s.bright = Math.min(1, 0.55 + f.refCount * 0.2);
        s.roleIdx = f.roleIdx[0];
        keep.add(s.key);
      }
    }

    // —— 新增星（淡入 + 边缘起始，锚定布局位）——
    wantRoles.forEach((r, i) => {
      const key = `r:${r.id}`;
      if (keep.has(key)) return;
      const n = r.static.length + r.dynamic.length;
      const edge = this.R();
      const ang = roleAng[i], rad = roleRad[i];
      const st: Star = {
        key, kind: 'role', r: i === activeIdx ? 3.2 : Math.min(2.6, 1.7 + Math.sqrt(n) * 0.25),
        tx: this.cx + Math.cos(ang) * rad,
        ty: this.cy + Math.sin(ang) * rad,
        x: edge < 0.5 ? 6 : this.w - 6, y: this.R() * this.h,
        breathPhase: this.R() * Math.PI * 2,
        breathPeriod: 3 + this.R() * 4,
        breath: 0, pulse: 0,
        active: i === activeIdx, bright: 1, fade: 0, missing: false, refCount: 1, refs: 0, roleIdx: i,
      };
      this.stars.push(st); keep.add(key);
    });
    for (const f of keptFiles) {
      const key = `f:${f.path}`;
      if (keep.has(key)) continue;
      const a = fileAnchor(f.roleIdx);
      const st: Star = {
        key, kind: 'file', r: f.refCount > 1 ? 1.9 : 1.4,
        tx: a.x, ty: a.y,
        x: this.R() < 0.5 ? 6 : this.w - 6, y: this.R() * this.h,
        breathPhase: this.R() * Math.PI * 2,
        breathPeriod: 3 + this.R() * 4,
        breath: 0, pulse: 0,
        active: false, bright: Math.min(1, 0.55 + f.refCount * 0.2), fade: 0, missing: f.missing,
        refCount: f.refCount, refs: f.roleIdx.length, roleIdx: f.roleIdx[0],
      };
      this.stars.push(st); keep.add(key);
    }
    // 移除淡完的星
    this.stars = this.stars.filter(s => keep.has(s.key) || s.fade > 0);
    // 聚合灰点：被截断的文件数/角色数（画在边缘，静态）
    this.extraRoles = nRole < d.totalRoles ? d.totalRoles - nRole : 0;
    this.extraFiles = extra;
    if (this.extraFiles > 0 || this.extraRoles > 0) {
      const rng2 = this.R;
      this.extraPts = [];
      const total = Math.min(4, this.extraFiles + this.extraRoles);
      for (let i = 0; i < total; i++) {
        const a = (i / total + rng2() * 0.2) * Math.PI * 2;
        this.extraPts.push({ x: this.cx + Math.cos(a) * (R1 + 8), y: this.cy + Math.sin(a) * (R1 + 8), kind: 'other' as const });
      }
    } else {
      this.extraPts = [];
    }
    this.lastKey = sig;
  }

  private extraRoles = 0;
  private extraFiles = 0;
  private extraPts: { x: number; y: number; kind: 'other' }[] = [];

  /** 脉冲源：活跃角色的声呐波纹（半径/激发，每帧由 step 推进） */
  private pulseT = 0;           // 距上次脉冲的时间 s
  private pulseN = 0;           // 脉冲序号（残环计数用）
  private lastPulseT = 0;       // 上次脉冲的 t（残环相对年龄）

  /** 每帧（v7 波纹脉冲）：锚位缓动（淡入期）+ 星基线呼吸 + 脉冲相位推进。
   *  零 N² 计算——纯三角函数，性能最低。 */
  step(now: number, dt: number): void {
    // 脉冲推进：每 PULSE_PERIOD 中心发一次波
    this.pulseT += dt;
    if (this.pulseT >= PULSE_PERIOD) {
      this.pulseT -= PULSE_PERIOD;
      this.pulseN++;
      this.lastPulseT = this.pulseT;
    }
    const maxR = Math.max(this.w, this.h) * 0.6;
    // 激发量：每帧清零重算（波纹带扫过即亮、离开回落）
    const distToCenter = (s: Star): number => Math.hypot(s.x - this.cx, s.y - this.cy);
    for (const s of this.stars) {
      s.pulse = 0;
      if (s.fade < 1) {
        const mix = Math.min(1, s.fade);
        s.x += (s.tx - s.x) * (1 - mix) * 0.25;
        s.y += (s.ty - s.y) * (1 - mix) * 0.25;
      }
      s.fade = Math.min(1, s.fade + 0.03);
    }
    for (let k = 0; k < PULSE_TAIL; k++) {
      // 残环年龄：当前环 age=0（半径 0→maxR），第 k 个残环已传播 k·PERIOD
      const age = this.pulseT + k * PULSE_PERIOD;
      const rr = (age / (PULSE_TAIL * PULSE_PERIOD)) * maxR;
      const alpha = Math.max(0, 1 - age / (PULSE_TAIL * PULSE_PERIOD));
      if (alpha <= 0.02) continue;
      for (const s of this.stars) {
        const d = distToCenter(s);
        const hit = Math.max(0, 1 - Math.abs(d - rr) / PULSE_WIDTH);
        s.pulse = Math.max(s.pulse, hit * alpha * (s.active ? 0.9 : 1));
      }
    }
    // 呼吸
    for (const s of this.stars) {
      s.breath = 0.5 + 0.5 * Math.sin(now / 1000 * (Math.PI * 2 / s.breathPeriod) + s.breathPhase);
    }
  }

  /** 守视钩子用：当前星数 */
  starCount(): number { return this.stars.length; }

  /** 绘制（调用方负责 renderOn 节流） */
  draw(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.clearRect(0, 0, this.w, this.h);
    const byKey = new Map(this.stars.map(s => [s.key, s]));
    // 波纹环（声呐脉冲：活跃角色为中心，PULSE_TAIL 个残环渐隐）
    const maxR = Math.max(this.w, this.h) * 0.6;
    for (let k = 0; k < PULSE_TAIL; k++) {
      const age = this.pulseT + k * PULSE_PERIOD;
      const rr = (age / (PULSE_TAIL * PULSE_PERIOD)) * maxR;
      const alpha = Math.max(0, 1 - age / (PULSE_TAIL * PULSE_PERIOD));
      if (alpha <= 0.02 || rr <= 0.5) continue;
      ctx.strokeStyle = `rgba(${CYAN},${(0.1 + 0.16 * alpha) * (1 - rr / maxR + 0.3)})`;
      ctx.lineWidth = 0.6 + alpha * 0.7;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 连线：角色→文件（透明度受激发抬升——波纹扫过时连线也亮）
    for (const s of this.stars) {
      if (s.kind !== 'file' || s.fade < 0.2) continue;
      const refs = this.roles
        .map((r, i) => ({ r, i }))
        .filter(({ r, i }) => s.roleIdx !== undefined && (r.static.some(f => f.path === s.key.slice(2)) || r.dynamic.some(f => f.path === s.key.slice(2))));
      for (const { i } of refs) {
        const roleStar = byKey.get(`r:${this.roles[i].id}`);
        if (!roleStar) continue;
        const active = roleStar.active;
        const boost = 0.25 + Math.min(1, s.pulse) * 0.75;
        ctx.strokeStyle = active ? `rgba(${CYAN},${0.4 * boost * s.fade})` : `rgba(${VIOLET},${0.22 * boost * s.fade})`;
        ctx.lineWidth = active ? 0.7 : 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(roleStar.x, roleStar.y);
        ctx.stroke();
      }
    }
    // 点：亮度 = 基线呼吸 + 波纹激发（扫过闪亮后回落）
    for (const s of this.stars) {
      if (s.fade <= 0.01) continue;
      const a = Math.min(1, s.fade);
      const exc = Math.min(1, s.pulse);
      const size = s.r * (1 + s.breath * 0.14 + exc * 0.5);
      if (s.kind === 'role') {
        const col = VIOLET;
        const glow = 0.2 + exc * 0.5 + s.breath * 0.08;
        ctx.fillStyle = `rgba(${col},${glow * a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, size * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${col},${(0.7 + exc * 0.3) * a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, Math.PI * 2); ctx.fill();
        // 活跃：外圈淡光圈（呼吸）+ 脉冲源标记
        if (s.active) {
          const br = (2.4 + Math.sin(now / 900) * 0.4 + 1.8) * (1 + exc * 0.4);
          ctx.strokeStyle = `rgba(${CYAN},${(0.16 + 0.14 * Math.sin(now / 900) + exc * 0.4) * a})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(s.x, s.y, br, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        const col = s.missing ? GREY : CYAN;
        const bright = s.missing ? 0.35 : s.bright;
        ctx.fillStyle = `rgba(${col},${(0.5 + 0.3 * bright + exc * 0.5 + s.breath * 0.1) * a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, Math.PI * 2); ctx.fill();
        if (s.refCount > 1) { // 共用文件微晕
          ctx.fillStyle = `rgba(${col},${(0.1 + exc * 0.25) * a})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, size * 2.1, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // 聚合灰点
    for (const p of this.extraPts) {
      ctx.fillStyle = `rgba(${GREY},0.4)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function initObsRoles(
  getRect: () => RolesRect | null,
): { onData: (d: RolesData) => void; relayout: () => void } {
  const container = document.createElement('div');
  container.className = 'obs-roles';
  container.innerHTML = `<div class="obs-roles-head">角色</div><canvas class="obs-roles-canvas"></canvas>`;
  container.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(container);
  const headEl = container.querySelector<HTMLElement>('.obs-roles-head')!;
  const cv = container.querySelector<HTMLCanvasElement>('.obs-roles-canvas')!;
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  let engine: RoleConstellation | null = null;
  let lastData: RolesData | null = null;
  let renderOn = true;
  let occState = false;
  let fadeTimer = 0;

  // 2026-08-09 v5 用户定稿：标题栏加回（「角色」字样，行高做小），大部分空间留星图
  const sizeCanvas = () => {
    const hh = headEl.offsetHeight || 18;
    const cw = container.clientWidth, ch = container.clientHeight - hh;
    cv.style.cssText = `position:absolute;left:0;top:${hh}px;width:100%;height:${ch}px;pointer-events:none`;
    cv.width = Math.max(1, Math.round(cw * dpr));
    cv.height = Math.max(1, Math.round(ch * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const build = () => {
    const r = getRect();
    if (!r || r.width < 60 || r.height < 60) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.style.left = `${r.left}px`;
    container.style.top = `${r.top}px`;
    container.style.width = `${r.width}px`;
    container.style.height = `${r.height}px`;
    sizeCanvas();
    if (!engine) engine = new RoleConstellation(r.width, r.height);
    else engine.resize(r.width, r.height);
    if (lastData) engine.setData(lastData);
  };

  // 遮挡淡出/淡入（同 obs-emblem v2 方案：五点探测 + 迟滞 + 运动态渐变）
  const mainEl = document.querySelector('.main');
  const applyOcc = (occ: boolean, animate: boolean) => {
    if (!animate) {
      occState = occ; renderOn = !occ;
      cv.style.transition = 'none';
      cv.style.opacity = occ ? '0' : '1';
      void cv.offsetWidth;
      cv.style.transition = 'opacity .9s ease';
      return;
    }
    if (occ === occState) return;
    occState = occ;
    clearTimeout(fadeTimer);
    if (occ) {
      cv.style.transition = 'opacity .9s ease-in'; cv.style.opacity = '0';
      fadeTimer = window.setTimeout(() => { renderOn = false; }, 950);
    } else {
      renderOn = true;
      cv.style.transition = 'opacity .9s ease-out'; cv.style.opacity = '1';
    }
  };
  const probe = (first = false) => {
    if (!mainEl) { applyOcc(false, !first); return; }
    const rect = container.getBoundingClientRect();
    if (rect.width < 10) { applyOcc(true, !first); return; }
    let covered = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) {
      const el = document.elementFromPoint(rect.left + rect.width * fx, rect.top + rect.height * fy);
      if (el && el !== mainEl && !container.contains(el)) covered++;
    }
    applyOcc(occState ? covered > 1 : covered >= 3, !first);
  };
  setInterval(() => probe(), 1500);
  probe(true);

  let last = 0, lastStep = 0;
  const loop = (now: number) => {
    (window as unknown as Record<string, unknown>).__rolesDbg = { // escape-ok: 守视钩子（同徽标 __emblemDbg 模式）
      stars: engine ? engine.starCount() : -1, renderOn, lastStep: Math.round(lastStep), now: Math.round(now), el: container.style.display,
    };
    if (renderOn && engine && now - lastStep >= 33) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now; lastStep = now;
      try {
        engine.step(now, dt);
        engine.draw(ctx, now);
      } catch (e) {
        (window as unknown as Record<string, unknown>).__rolesDbg = { err: e instanceof Error ? e.message : String(e) }; // escape-ok: 守视钩子
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    onData(d: RolesData) {
      lastData = d;
      if (engine) engine.setData(d);
      (window as unknown as Record<string, unknown>).__rolesDbg = { stars: engine ? engine.starCount() : -1 }; // escape-ok: 守视钩子
    },
    relayout: build,
  };
}
