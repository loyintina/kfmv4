/**
 * viewport-visibility.ts — 当前视口可见性（眼睛「当前视口」段数据源，2026-08-12 立项）
 *
 * 问题（用户实拍）：全屏 tmux 卡 + 光球面板展开时，中央页面完全不可见，
 * 但眼睛文件照列待办坐标 → AI 把手按到 tmux 卡上还以为按的是待办框。
 * 眼睛给的是「DOM 存在」，手需要的是「视口露出」——本模块算后者。
 *
 * 方法：矩形减法。每区域被更高遮挡序区域的交集并集覆盖比例 →
 * full（≥99% 可见）/ partial / hidden（≤1% 可见）。零 DOM 探测：
 * 矩形与开合状态由装配点（ws-channel）从 snapshot 收集，本模块纯函数可离线钉测。
 *
 * 遮挡序 rank = 设计死的层级（对齐 z-index-layers.ts 层级图景）：
 *   hud.*(0) < card.fullscreen(1) < cards(2) < tree(3) < orb.panel(4) < orb(5)
 * present = 开合状态——面板收起 opacity:0、卡片堆关闭时 rect 是推算值，DOM/矩形
 * 不能作数，必须由装配方从 snapshot 的 content/elements 状态层取值。
 *
 * 边界（v1 不覆盖，实测需要再扩）：窗口态浮卡（L3，多实例动态 id）、
 * 模态框/toast（L8）不参与遮挡计算——全屏卡是唯一槽位（floating-fullscreen.ts），
 * 是中央页面的唯一全量遮蔽源。
 */

// ========== 类型 ==========
export interface RegionRect { x: number; y: number; w: number; h: number }
export interface RegionInput { id: string; rect: RegionRect | null; rank: number; present: boolean }
export type Cover = 'full' | 'partial' | 'hidden';
export interface RegionVisibility { id: string; cover: Cover; visiblePct: number; coveredBy: string[] }

/** 遮挡序：rank 高的盖 rank 低的；同 rank 互不遮挡；-1 = 不参与 */
export function rankOf(id: string): number {
  if (id.startsWith('hud.')) return 0;
  switch (id) {
    case 'card.fullscreen': return 1;
    case 'cards': return 2;
    case 'tree': return 3;
    case 'orb.panel': return 4;
    case 'orb': return 5;
    default: return -1;
  }
}

// ========== 几何原语 ==========
function intersect(a: RegionRect, b: RegionRect): RegionRect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w), bo = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bo > y ? { x, y, w: r - x, h: bo - y } : null;
}

/** 矩形并集面积（x 条带分解：唯一 x 界切条，条内 y 区间合并 × 条宽） */
function unionArea(rs: RegionRect[]): number {
  if (rs.length === 0) return 0;
  const xs = Array.from(new Set(rs.flatMap(r => [r.x, r.x + r.w]))).sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i], x2 = xs[i + 1];
    if (x2 <= x1) continue;
    const ys = rs.filter(r => r.x < x2 && r.x + r.w > x1)
      .map(r => [r.y, r.y + r.h] as [number, number]).sort((a, b) => a[0] - b[0]);
    let yLen = 0, cur: [number, number] | null = null;
    for (const [a, b] of ys) {
      if (!cur || a > cur[1]) { if (cur) yLen += cur[1] - cur[0]; cur = [a, b]; }
      else cur[1] = Math.max(cur[1], b);
    }
    if (cur) yLen += cur[1] - cur[0];
    area += (x2 - x1) * yLen;
  }
  return area;
}

// ========== 主函数 ==========
/** 计算各区域视口可见性。present=false / rect=null / 0 面积的区域直接出局。 */
export function computeVisibility(regions: RegionInput[]): RegionVisibility[] {
  const rs = regions.filter(r => r.rank >= 0 && r.present && r.rect !== null && r.rect.w > 0 && r.rect.h > 0);
  return rs.map(r => {
    const rect = r.rect!;
    const covers = rs.filter(o => o !== r && o.rank > r.rank)
      .map(o => ({ id: o.id, rect: intersect(rect, o.rect!) }))
      .filter((c): c is { id: string; rect: RegionRect } => c.rect !== null);
    const coveredArea = unionArea(covers.map(c => c.rect));
    const pct = Math.max(0, Math.min(100, Math.round(100 - (coveredArea / (rect.w * rect.h)) * 100)));
    return {
      id: r.id,
      cover: pct >= 99 ? 'full' : pct <= 1 ? 'hidden' : 'partial',
      visiblePct: pct,
      coveredBy: covers.map(c => c.id),
    };
  });
}

// ========== 装配（从 snapshot 提取区域，仍纯函数——状态全由入参给） ==========
interface SnapLike {
  elements?: Array<{ id?: string; state?: string }>;
  content?: Array<{ type?: string; detail?: unknown }>;
  coords?: Record<string, RegionRect | null>;
}

/** 从 Registry.snapshot() 装配 RegionInput：present 取自 content/elements 状态层。
 *  hud.* / card.fullscreen 无开合态（DOM 在即在），present 恒 true 由 rect 过滤。 */
export function assembleRegions(snap: SnapLike): RegionInput[] {
  const present: Record<string, boolean> = {};
  const treeDetail = (snap.content || []).find(c => c.type === 'file-tree')?.detail as Record<string, unknown> | undefined;
  present['tree'] = treeDetail?.['visible'] === true;
  const cardDetail = (snap.content || []).find(c => c.type === 'card-content')?.detail as Record<string, unknown> | undefined;
  present['cards'] = cardDetail?.['visible'] === true;
  const panel = (snap.elements || []).find(e => e.id === 'orb-panel');
  present['orb.panel'] = panel ? panel.state !== 'closed' : false;
  present['orb'] = true;   // 光球常驻
  return Object.entries(snap.coords || {})
    .map(([id, rect]) => ({ id, rect, rank: rankOf(id), present: present[id] ?? true }))
    .filter(r => r.rank >= 0);
}
