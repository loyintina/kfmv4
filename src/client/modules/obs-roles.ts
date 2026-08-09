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
  // 锚位（布局目标，仅淡入滑入期混合用）与物理位置
  tx: number; ty: number;
  x: number; y: number;
  // N 体引力（三体式，2026-08-09 用户定稿：紫=恒星、青=行星，
  // 全 N 体牛顿引力 + 软化解 + 恒星锚弹性 + 阻尼；ox/oy 轨道模型废弃）
  vx: number; vy: number;
  m: number;          // 质量（恒星大、行星小）
  active: boolean;
  bright: number;   // 亮度 0~1（refCount 等）
  fade: number;     // 淡入淡出 0~1
  missing: boolean;
  refCount: number;
  refs: number;     // 引用该文件的角色数（画线用：找角色星）
  roleIdx: number;  // 角色在 roles 数组的下标（-1=文件）
  parentKey: string; // 行星母恒星 key（文件星专属，v5 引力源）
}

const ROLE_MAX = 24;
const FILE_MAX = 60;
// N 体引力常量（v5 用户定稿：行星绕母星、恒星间弱引力+强锚弹性）
const G_P = 260;    // 行星-母星引力
const G_S = 800;    // 恒星间弱引力（扰动源）
const SOFT = 40;    // 软化解 ε²（防 r→0 奇点）
const DAMP_T = 0.06; // 阻尼系数（每帧 exp(-dt·DAMP_T)）

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

    // —— 新增星（淡入 + 边缘起始 + 初始切向速度入轨）——
    wantRoles.forEach((r, i) => {
      const key = `r:${r.id}`;
      if (keep.has(key)) return;
      const n = r.static.length + r.dynamic.length;
      const edge = this.R();
      const st: Star = {
        key, kind: 'role', r: i === activeIdx ? 3.2 : Math.min(2.6, 1.7 + Math.sqrt(n) * 0.25),
        tx: this.cx + Math.cos(roleAng[i]) * roleRad[i],
        ty: this.cy + Math.sin(roleAng[i]) * roleRad[i],
        x: edge < 0.5 ? 6 : this.w - 6, y: this.R() * this.h,
        vx: (this.R() - 0.5) * 20, vy: (this.R() - 0.5) * 20,
        m: this.massOfRole(i, activeIdx, n),
        active: i === activeIdx, bright: 1, fade: 0, missing: false, refCount: 1, refs: 0, roleIdx: i,
        parentKey: '',
      };
      this.stars.push(st); keep.add(key);
    });
    for (const f of keptFiles) {
      const key = `f:${f.path}`;
      if (keep.has(key)) continue;
      const a = fileAnchor(f.roleIdx);
      // 行星切向初速（绕母星椭圆轨道）：v = sqrt(G_P·m_star/r0)·0.82
      const parentIdx = f.roleIdx[0];
      const parentM = this.massOfRole(parentIdx, activeIdx, wantRoles[parentIdx].static.length + wantRoles[parentIdx].dynamic.length);
      const dx0 = a.x - (this.cx + Math.cos(roleAng[parentIdx]) * roleRad[parentIdx]);
      const dy0 = a.y - (this.cy + Math.sin(roleAng[parentIdx]) * roleRad[parentIdx]);
      const r0 = Math.max(8, Math.hypot(dx0, dy0));
      const vt = Math.sqrt((G_P * parentM) / r0) * 0.82;
      const nx = -dy0 / r0, ny = dx0 / r0; // 径向垂直 = 切向
      const st: Star = {
        key, kind: 'file', r: f.refCount > 1 ? 1.9 : 1.4,
        tx: a.x, ty: a.y,
        x: this.R() < 0.5 ? 6 : this.w - 6, y: this.R() * this.h,
        vx: nx * vt, vy: ny * vt,
        m: 0.4 + f.refCount * 0.25,
        active: false, bright: Math.min(1, 0.55 + f.refCount * 0.2), fade: 0, missing: f.missing,
        refCount: f.refCount, refs: f.roleIdx.length, roleIdx: f.roleIdx[0],
        parentKey: `r:${wantRoles[parentIdx].id}`,
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

  /** 恒星质量：引用文件越多越重（活跃主星最重） */
  private massOfRole(i: number, activeIdx: number, n: number): number {
    const base = 1.6 + n * 0.35;
    return i === activeIdx ? base + 2.2 : base;
  }

  /** 每帧：行星绕母星引力 + 恒星间弱引力/锚弹性（v5 修正：不聚团不漂移）。
   *  行星只受母恒星引力（软化解）→ 稳定椭圆轨道；恒星受彼此弱引力 +
   *  较强锚弹性 → 在布局位附近缓慢推挤扰动（三体感），系统整体不漂移。
   *  淡入期（fade<1）位置与锚位混合——新星滑入入轨。 */
  step(now: number, dt: number): void {
    const stars = this.stars;
    const byKey = new Map(stars.map(s => [s.key, s]));
    const DAMP = Math.exp(-dt * DAMP_T);
    const ANCHOR_K = 0.9;
    const ACTIVE_K = 0.65;
    for (const a of stars) {
      let ax = 0, ay = 0;
      if (a.kind === 'file') {
        const parent = a.parentKey ? byKey.get(a.parentKey) : undefined;
        if (parent) {
          const dx = parent.x - a.x, dy = parent.y - a.y;
          const r2 = dx * dx + dy * dy + SOFT;
          const f = G_P * parent.m / r2;
          const inv = 1 / Math.sqrt(r2);
          ax += f * dx * inv;
          ay += f * dy * inv;
        }
      } else {
        // 恒星间弱引力（扰动源）+ 锚弹性（防聚团/漂移）
        for (const b of stars) {
          if (b.kind !== 'role' || b === a) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const r2 = dx * dx + dy * dy + SOFT;
          const f = G_S * b.m / r2;
          const inv = 1 / Math.sqrt(r2);
          ax += f * dx * inv;
          ay += f * dy * inv;
        }
        const k = a.active ? ACTIVE_K : ANCHOR_K;
        ax -= k * (a.x - a.tx);
        ay -= k * (a.y - a.ty);
      }
      a.vx = (a.vx + ax * dt) * DAMP;
      a.vy = (a.vy + ay * dt) * DAMP;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.fade < 1) {
        const mix = Math.min(1, a.fade);
        a.x += (a.tx - a.x) * (1 - mix) * 0.25;
        a.y += (a.ty - a.y) * (1 - mix) * 0.25;
      }
      a.fade = Math.min(1, a.fade + 0.03);
    }
  }

  /** 守视钩子用：当前星数 */
  starCount(): number { return this.stars.length; }

  /** 绘制（调用方负责 renderOn 节流） */
  draw(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.clearRect(0, 0, this.w, this.h);
    const byKey = new Map(this.stars.map(s => [s.key, s]));
    // 连线：角色→文件（只画已淡入的）
    for (const s of this.stars) {
      if (s.kind !== 'file' || s.fade < 0.2) continue;
      const refs = this.roles
        .map((r, i) => ({ r, i }))
        .filter(({ r, i }) => s.roleIdx !== undefined && (r.static.some(f => f.path === s.key.slice(2)) || r.dynamic.some(f => f.path === s.key.slice(2))));
      // 用 refCount 对应角色数：直接连所有引用角色（≤2 根线，多引用用平均锚位表达）
      for (const { i } of refs) {
        const roleStar = byKey.get(`r:${this.roles[i].id}`);
        if (!roleStar) continue;
        const active = roleStar.active;
        ctx.strokeStyle = active ? `rgba(${CYAN},${0.4 * s.fade})` : `rgba(${VIOLET},${0.22 * s.fade})`;
        ctx.lineWidth = active ? 0.7 : 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(roleStar.x, roleStar.y);
        ctx.stroke();
      }
    }
    // 点
    for (const s of this.stars) {
      if (s.fade <= 0.01) continue;
      const a = Math.min(1, s.fade);
      const p = s;
      if (s.kind === 'role') {
        const col = s.active ? VIOLET : VIOLET;
        const r = s.r;
        // 光晕（2026-08-09 定稿：整体缩小——星偏大）
        ctx.fillStyle = `rgba(${col},${0.2 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${col},${0.95 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        // 活跃：外圈淡光圈（呼吸）
        if (s.active) {
          const br = 2.4 + Math.sin(now / 900) * 0.4 + 1.8;
          ctx.strokeStyle = `rgba(${CYAN},${(0.16 + 0.14 * Math.sin(now / 900)) * a})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, br, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        const col = s.missing ? GREY : CYAN;
        const bright = s.missing ? 0.35 : s.bright;
        ctx.fillStyle = `rgba(${col},${(0.55 + 0.45 * bright) * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.refCount > 1) { // 共用文件微晕
          ctx.fillStyle = `rgba(${col},${0.12 * a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, s.r * 2.1, 0, Math.PI * 2); ctx.fill();
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
