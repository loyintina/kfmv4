/**
 * obs-roles.ts — 角色卡关系面板（观测台 · 环形弦图）
 *
 * 2026-08-09 用户定稿 v8：回归信息显示本质——**环形弦图**（chord diagram）：
 * 外环=角色分段弧（紫系，活跃角色段青色描边+呼吸）、内环=文件分段弧（青系，
 * 共用文件段更长更亮）、弦线=角色→文件引用关系（活跃青亮/普通紫暗）。
 * 4 角色 × 8 文件在窄面板内清晰可读；段长 ∝ 引用数（信息即长度）。
 *
 * 演进史：v1 青紫瞳三层 → v2 尺寸/间距 → v3 出界修复 → v4 三体 N 体 →
 * v5 行星绕母星 → v6 能量守恒真三体 → v7 波纹脉冲 → **v8 环形弦图**
 * （用户裁决：星点与徽标粒子重复，回归信息显示）。
 *
 * 性能：零 N²、纯 canvas 弧线绘制（段数 ≤24+60 但只画弦 ≤引用边数，
 * 截断阈值 ROLE_MAX/FILE_MAX 保证绘制量恒定）；DPR≤1.5、30fps、
 * 五点探测遮挡淡出（同徽标家族）。
 */
import { Z } from './z-index-layers.js';

interface FileRef { path: string; name: string; dir: string; size: number; mtime: number; refCount: number; missing: boolean }
interface RoleNode { id: string; name: string; updatedAt: string; static: FileRef[]; dynamic: FileRef[] }
export interface RolesData { roles: RoleNode[]; activeRoleId: string; totalRoles: number; totalFiles: number }
export interface RolesRect { left: number; top: number; width: number; height: number }

const CYAN = '0,212,255';
const VIOLET = '139,92,246';
const GREY = '110,120,145';

const ROLE_MAX = 24;
const FILE_MAX = 60;
// v9 双环反向旋转（2026-08-09 用户定稿）：外环顺转/内环逆转，弦线持续变换
const ROT_A = 0.06;  // 外环（角色）角速度 rad/s，正=顺时针
const ROT_B = -0.09; // 内环（文件）逆时针（更快，层次错动）

class RoleConstellation {
  private roles: RoleNode[] = [];
  private activeId = '';
  // 渲染缓存（setData 算一次，draw 复用）
  private roleSegs: { a0: number; a1: number; active: boolean }[] = [];
  private fileSegs: { a0: number; a1: number; refCount: number; missing: boolean }[] = [];
  private chords: { from: number; to: number; active: boolean }[] = []; // from=角色段角, to=文件段角
  private extraRoles = 0;
  private extraFiles = 0;
  private w: number;
  private h: number;
  private cx: number;
  private cy: number;

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.cx = w / 2;
    this.cy = h / 2;
  }

  resize(nw: number, nh: number): void {
    this.w = nw; this.h = nh;
    this.cx = nw / 2; this.cy = nh / 2;
    this.rebuild();
  }

  /** 数据驱动：角色/文件分段 + 弦线（段长∝引用数，信息即长度） */
  setData(d: RolesData): void {
    this.roles = d.roles;
    this.activeId = d.activeRoleId;
    this.extraRoles = Math.max(0, d.totalRoles - ROLE_MAX);
    this.rebuild();
  }

  private rebuild(): void {
    const wantRoles = this.roles.slice(0, ROLE_MAX);
    // 文件集合（截断聚合）
    const fileAgg: { name: string; refCount: number; missing: boolean; by: number[] }[] = [];
    const seen = new Map<string, number>();
    for (let i = 0; i < wantRoles.length; i++) {
      for (const f of [...wantRoles[i].static, ...wantRoles[i].dynamic]) {
        let idx = seen.get(f.path);
        if (idx === undefined) {
          idx = fileAgg.length;
          seen.set(f.path, idx);
          fileAgg.push({ name: f.name, refCount: f.refCount, missing: f.missing, by: [] });
        }
        fileAgg[idx].by.push(i);
      }
    }
    fileAgg.sort((a, b) => b.refCount - a.refCount);
    const keptFiles = fileAgg.slice(0, FILE_MAX);
    this.extraFiles = Math.max(0, fileAgg.length - keptFiles.length);

    // —— 分段：外环=角色（∝引用数）、内环=文件（∝refCount）——
    const roleWeight = wantRoles.map(r => Math.max(1, r.static.length + r.dynamic.length));
    const roleTotal = roleWeight.reduce((s, x) => s + x, 0) || 1;
    const fileWeight = keptFiles.map(f => Math.max(1, f.refCount));
    const fileTotal = fileWeight.reduce((s, x) => s + x, 0) || 1;

    this.roleSegs = [];
    let acc = -Math.PI / 2; // 12 点起
    wantRoles.forEach((r, i) => {
      const span = (roleWeight[i] / roleTotal) * Math.PI * 2;
      this.roleSegs.push({ a0: acc, a1: acc + span, active: r.id === this.activeId });
      acc += span;
    });
    this.fileSegs = [];
    acc = -Math.PI / 2;
    keptFiles.forEach((f, i) => {
      const span = (fileWeight[i] / fileTotal) * Math.PI * 2;
      this.fileSegs.push({ a0: acc, a1: acc + span, refCount: f.refCount, missing: f.missing });
      acc += span;
    });
    // —— 弦：角色段中心角 → 文件段中心角（共用文件多弦汇聚）——
    this.chords = [];
    keptFiles.forEach((f, i) => {
      const to = (this.fileSegs[i].a0 + this.fileSegs[i].a1) / 2;
      for (const roleIdx of f.by) {
        const from = (this.roleSegs[roleIdx].a0 + this.roleSegs[roleIdx].a1) / 2;
        this.chords.push({ from, to, active: this.roleSegs[roleIdx].active });
      }
    });
  }

  /** 守视钩子用：当前弦数 */
  chordCount(): number { return this.chords.length; }

  /** 绘制环形弦图（外环角色段/内环文件段/弦线） */
  draw(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.clearRect(0, 0, this.w, this.h);
    // v14 落日定稿（2026-08-09 用户裁决）：尺寸最大——R 顶满左右（w/2-3），
    // 圆心保持 v13 位置（cy=w/2-1）——上缘留 2px 不超上界，下界作地平线
    // 把外环/内环都截断一部分（canvas 自然裁剪）
    const R1 = this.w / 2 - 3;
    const R2 = R1 * 0.62;
    const rotA = now / 1000 * ROT_A;   // 外环顺转
    const rotB = now / 1000 * ROT_B;   // 内环逆转
    const cx = this.cx;
    const cy = this.w / 2 - 1;
    const activeIdx = this.roleSegs.findIndex(s => s.active);
    const pt = (ang: number, r: number) =>
      ({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });

    // 弦线（先画，压在环下）：外环段中心(旋转后) → 内环段中心(反向旋转后)
    for (const c of this.chords) {
      const a = c.from + rotA, b = c.to + rotB;
      const p0 = pt(a, R1);
      const p1 = pt(b, R2);
      const pm = pt((a + b) / 2, (R1 + R2) / 2);
      ctx.strokeStyle = c.active ? `rgba(${CYAN},0.4)` : `rgba(${VIOLET},0.22)`;
      ctx.lineWidth = c.active ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(pm.x, pm.y, p1.x, p1.y);
      ctx.stroke();
    }

    // 外环：角色分段弧（随 rotA 顺转，活跃段青色固定加亮——无呼吸脉冲）
    this.roleSegs.forEach((s, i) => {
      ctx.strokeStyle = s.active ? `rgba(${CYAN},0.6)` : `rgba(${VIOLET},0.4)`;
      ctx.lineWidth = s.active ? 4 : 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, R1, s.a0 + rotA + 0.04, s.a1 + rotA - 0.04);
      ctx.stroke();
    });

    // 内环：文件分段弧（随 rotB 逆转，refCount>1 加亮、missing 灰）
    this.fileSegs.forEach((s) => {
      const col = s.missing ? GREY : CYAN;
      const bright = s.missing ? 0.3 : 0.4 + Math.min(0.45, s.refCount * 0.18);
      ctx.strokeStyle = `rgba(${col},${bright})`;
      ctx.lineWidth = s.refCount > 1 ? 2.6 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, R2, s.a0 + rotB + 0.05, s.a1 + rotB - 0.05);
      ctx.stroke();
    });

    // 中心：活跃角色小核（固定亮度，信息锚点）
    ctx.fillStyle = `rgba(${CYAN},0.55)`;
    ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${CYAN},0.28)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 6.2, 0, Math.PI * 2); ctx.stroke();

    // 聚合截断计数（灰细弧提示还有更多）
    if (this.extraRoles > 0 || this.extraFiles > 0) {
      ctx.strokeStyle = `rgba(${GREY},0.35)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, R1 + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function initObsRoles(
  getRect: () => RolesRect | null,
): { onData: (d: RolesData) => void; relayout: () => void } {
  const container = document.createElement('div');
  container.className = 'obs-roles';
  // v15：标题栏回归其他框格式（.obs-inbox-head 标准高 38px + 角色/文件计数）
  container.innerHTML = `
    <div class="obs-inbox-head"><span class="obs-inbox-title">角色</span><span class="obs-inbox-status"></span></div>
    <canvas class="obs-roles-canvas"></canvas>
  `;
  container.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(container);
  const headEl = container.querySelector<HTMLElement>('.obs-inbox-head')!;
  const statusEl = container.querySelector<HTMLElement>('.obs-inbox-status')!;
  const cv = container.querySelector<HTMLCanvasElement>('.obs-roles-canvas')!;
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  let engine: RoleConstellation | null = null;
  let lastData: RolesData | null = null;
  let renderOn = true;
  let occState = false;
  let fadeTimer = 0;

  // 标准标题栏高度（2026-08-09 v15 定稿：回归其他框格式）
  const sizeCanvas = (): [number, number] => {
    const hh = headEl.offsetHeight || 38;
    const cw = container.clientWidth, ch = container.clientHeight - hh;
    cv.style.cssText = `position:absolute;left:0;top:${hh}px;width:100%;height:${ch}px;pointer-events:none`;
    cv.width = Math.max(1, Math.round(cw * dpr));
    cv.height = Math.max(1, Math.round(ch * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [cw, ch];
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
    // 引擎几何必须用 canvas 实际尺寸（不含标题栏）——用面板尺寸曾致
    // 环心偏下、外环超 canvas 下界（v8 实拍抓获，2026-08-09）
    const [cw, ch] = sizeCanvas();
    if (!engine) engine = new RoleConstellation(cw, ch);
    else engine.resize(cw, ch);
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
      chords: engine ? engine.chordCount() : -1, renderOn, now: Math.round(now),
    };
    if (renderOn && engine && now - lastStep >= 33) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now; lastStep = now;
      try {
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
      statusEl.textContent = `${d.totalRoles}卡 · ${d.totalFiles}文件`;
      if (engine) engine.setData(d);
    },
    relayout: build,
  };
}
