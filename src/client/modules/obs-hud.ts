/**
 * obs-hud.ts — 观测台顶栏（2026-08-13 重构：中央九格删除，回归网格线）
 *
 * 顶栏：deepseek + 系统三格（硬盘/内存/负载）+ 余额；徽标缩小锚定顶栏下方。
 * 刷新：余额 + 系统 30s 低频轮询（2026-08-13 用户定稿：信息不需要秒级新鲜，
 * 从 5s 提到 30s——移动端发热治理；时钟/翻页/端口滚动等定时器全部删除）。
 *
 * 重构背景（2026-08-13）：原 809 行九格面板（信箱/星轨/系统/脉搏/执勤/待办/
 * 角色框/权限）是移动端发热主因——7 个常驻定时器 + 5s 网络轮询，盖住也在跑。
 * 用户定稿：九格全删，界面还给人，数据还给文件（AI 路标仍在 eyes.ts 读文件）。
 */
import { API } from './state.js';
import { Registry } from './ui-registry.js';
import { Z } from './z-index-layers.js';
import { isCardStackOpen } from './card-stack.js';
import { initObsEmblems, type EmblemRects } from './obs-emblem.js';
import { initHand, type HandRect } from './hand.js';

/** 轮询周期（30s，2026-08-13 用户定稿：从 5s 提到 30s——信息参考，移动端发热治理） */
const REFRESH_MS = 30_000;

let inited = false;

/** 余额固定 2 位小数（用户定稿） */
function fmtBalance(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `¥${n.toFixed(2)}`;
}

interface SysMetric { label: string; value: string; pct: number | null }
interface SysData { metrics: SysMetric[] }

export function initObsHud(): void {
  if (inited) return;
  inited = true;

  const hud = document.createElement('div');
  hud.className = 'obs-hud';
  hud.innerHTML = `
    <div class="obs-card">
      <div class="obs-left">
        <div class="obs-provider">deepseek</div>
        <div class="obs-sys-mini"></div>
      </div>
      <div class="obs-balance">¥--</div>
    </div>
  `;
  hud.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(hud);

  const balanceEl = hud.querySelector<HTMLElement>('.obs-balance')!;
  const sysMiniEl = hud.querySelector<HTMLElement>('.obs-sys-mini')!;

  // 徽标：缩小锚定顶栏下方（2026-08-13 用户定稿：做小，运动不变）
  const emblemRects = (): EmblemRects => {
    const r = hud.getBoundingClientRect();
    return {
      pocket: {
        left: Math.round(r.left),
        top: Math.round(r.bottom + 6),
        width: 60,
        height: 60,
      },
    };
  };
  const emblems = initObsEmblems(emblemRects);

  // AI 的手：待机区锚定顶栏下方（2026-08-13 重构：原四框空区随九格删除）
  const handRect = (): HandRect => {
    const r = hud.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      top: Math.round(r.bottom + 80),
      width: 200,
      height: 120,
    };
  };
  const hand = initHand(handRect);

  // 眼睛坐标注册（2026-08-13：九格删除，只留顶栏 + 光球 + 文件树 + 卡片 + 全屏卡）
  const rectOf = (sel: string): { x: number; y: number; w: number; h: number } => {
    const el = document.querySelector(sel);
    if (!el) return { x: 0, y: 0, w: 0, h: 0 };
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  // 文件树坐标语义 = 「展开时占据的屏幕区域」（设计文档 (二)1.(1)）。
  // sidebar 用 transform: translateX(-100%) 隐藏，getBoundingClientRect 受 transform
  // 影响会返回负 x；布局位置恒 left:0 top:0，用 offsetWidth/offsetHeight（不受 transform
  // 影响）量取，隐藏时也返回展开后位置——AI 需知「展开后会遮挡哪里」。
  const treeRect = (): { x: number; y: number; w: number; h: number } => {
    const el = document.querySelector('.sidebar') as HTMLElement | null;
    if (!el) return { x: 0, y: 0, w: 288, h: 769 };   // 384×853 实测兜底
    return { x: 0, y: 0, w: el.offsetWidth || 288, h: el.offsetHeight || 769 };
  };
  // 卡片堆坐标：首张 .stack-card 的 rect（position:fixed right:0）。
  // 未打开时元素处于关闭/动画态（偏移出屏），量取无意义——按当前 viewport 推算
  // 展开位置（首卡 right:0 + width:155，top = innerHeight×0.12），而非回退
  // 1440 时代文档实测值（278 超 384 屏）。2026-08-11 内置 AI 校准发现。
  const cardsRect = (): { x: number; y: number; w: number; h: number } => {
    const el = document.querySelector('.stack-card') as HTMLElement | null;
    if (el && isCardStackOpen()) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    const w = window.innerWidth || 384;
    const cardW = 155;
    return { x: Math.max(0, w - cardW), y: Math.round((window.innerHeight || 853) * 0.12), w: cardW, h: 68 };
  };
  const coords = {
    'hud.top': '.obs-card',
    'orb': '.light-orb', 'orb.panel': '.orb-panel',
    // 全屏卡（2026-08-12 当前视口遮挡源）：全屏唯一槽位，无全屏卡时选择器
    // 落空 → rectOf 返回 0 面积 → 视口可见性计算自动出局
    'card.fullscreen': '.floating-card.fullscreen',
  };
  for (const [id, sel] of Object.entries(coords)) Registry.registerCoords(id, () => rectOf(sel));
  Registry.registerCoords('tree', treeRect);
  Registry.registerCoords('cards', cardsRect);

  window.addEventListener('resize', () => { emblems.relayout(); hand.relayout(); });

  // 余额 + 系统三格刷新（30s 低频；2026-08-13 用户定稿：信息不需要秒级新鲜）
  let lastTotal = '';
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { balance?: { total?: string; error?: string }; sys?: SysData };
      const b = j?.balance;
      if (b && !b.error && b.total != null) {
        balanceEl.textContent = fmtBalance(b.total);
        if (b.total !== lastTotal) {
          lastTotal = b.total;
          balanceEl.classList.remove('obs-flash');
          void balanceEl.offsetWidth;
          balanceEl.classList.add('obs-flash');
        }
      } else {
        balanceEl.textContent = '—';
      }
      const ms = j?.sys?.metrics ?? [];
      const parts = ms.filter(m => ['硬盘', '内存', '负载'].includes(m.label))
        .map(m => `${m.label} ${m.value}`).join(' · ');
      sysMiniEl.textContent = parts;
    } catch {
      balanceEl.textContent = '—';
    }
  };
  refresh();
  setInterval(refresh, REFRESH_MS);
  // 锁屏/失焦回前台：立即重同步
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
