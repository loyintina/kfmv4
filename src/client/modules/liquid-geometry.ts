/**
 * liquid-geometry.ts — 光标玻璃管液体粒子的纯几何计算
 *
 * 从 canvas-cursor.ts 剥离：原本 _emitLiquidSegments 把 DOM/单例访问
 * （L.cursorBox / L.renderer / GSAP proxy）和纯几何混在一起，无法离线测。
 * 本模块只做「给定盒子尺寸 + 路径进度 + 配置 → 算出各粒子段的坐标」，
 * 零 DOM、零单例、纯函数，可单测。canvas-cursor 退化为收集输入的适配器。
 *
 * 几何模型：粒子沿光标盒的「上线 → 竖线 → 下线」三段管道流动（不含圆角处）。
 * 竖线段用 verticalMul（vm）在路径空间放慢遍历、加密粒子。
 */

export interface LiquidPoint {
  x: number;
  y: number;
  angle: number;
  w: number;
  len: number;
}

export interface LiquidGeomParams {
  /** 盒子左上角物理 x（已含 transform.translateX——BAR-201：粒子跟随右滑回弹） */
  bx: number;
  /** 盒子左上角物理 y（已减 scrollY、已含 transform.translateY） */
  by: number;
  /** 盒子高度 */
  h: number;
  /** 上线宽度 */
  topW: number;
  /** 下线宽度 */
  botW: number;
  /** 圆角半径 */
  R: number;
  /** 当前路径进度（0..pathLen 的原始值，内部取模） */
  pos: number;
  /** 粒子数量 */
  count: number;
  /** 上/下线段长 */
  segLenH: number;
  /** 竖线段长 */
  segLenV: number;
  /** 竖线路径倍率 */
  vm: number;
}

/** 路径坐标 → 物理坐标（竖线段用 vm 逆缩放） */
export function pathToPhysical(t: number, topW: number, realVert: number, vm: number): number {
  if (t < topW) return t;
  t -= topW;
  const vPath = realVert * vm;
  if (t < vPath) return topW + t / vm;
  return topW + realVert + (t - vPath);
}

/** 路径总长（上线 + 竖线*vm + 下线）。<=0 表示盒子太小无有效管道。 */
export function liquidPathLen(topW: number, botW: number, h: number, R: number, vm: number): number {
  return topW + (h - 2 * R) * vm + botW;
}

/**
 * 计算所有液体粒子段的物理坐标。纯函数：相同输入恒定输出。
 * pathLen <= 0 时返回空数组。
 */
export function computeLiquidSegments(p: LiquidGeomParams): LiquidPoint[] {
  const { bx, by, h, topW, botW, R, count, segLenH, segLenV, vm } = p;
  const realVert = h - 2 * R;
  const pathLen = topW + realVert * vm + botW;
  const segs: LiquidPoint[] = [];
  if (pathLen <= 0) return segs;
  const pos = p.pos % pathLen;

  for (let i = 0; i < count; i++) {
    const pathC = (pos + (i * pathLen) / count) % pathLen;
    const physC = pathToPhysical(pathC, topW, realVert, vm);

    if (physC < topW) {
      // 上线管道：右→左，w=1
      const distL = physC;
      const distR = topW - physC;
      const len = Math.min(segLenH, 2 * Math.min(distL, distR));
      const half = len / 2;
      const cs = Math.max(0, physC - half);
      const ce = Math.min(topW, physC + half);
      if (ce > cs) segs.push({ x: bx + R + topW - (cs + ce) / 2, y: by, angle: Math.PI, w: 1, len: ce - cs });
    } else if (physC < topW + realVert) {
      // 竖线管道：上→下，w=3
      const vert = physC - topW;
      const distT = vert;
      const distB = realVert - vert;
      const len = Math.min(segLenV, 2 * Math.min(distT, distB));
      const half = len / 2;
      const cs = Math.max(0, vert - half);
      const ce = Math.min(realVert, vert + half);
      if (ce > cs) segs.push({ x: bx, y: by + R + (cs + ce) / 2, angle: Math.PI / 2, w: 3, len: ce - cs });
    } else {
      // 下线管道：左→右，w=1
      const horiz = physC - topW - realVert;
      const distL = horiz;
      const distR = botW - horiz;
      const len = Math.min(segLenH, 2 * Math.min(distL, distR));
      const half = len / 2;
      const cs = Math.max(0, horiz - half);
      const ce = Math.min(botW, horiz + half);
      if (ce > cs) segs.push({ x: bx + R + (cs + ce) / 2, y: by + h, angle: 0, w: 1, len: ce - cs });
    }
  }
  return segs;
}
