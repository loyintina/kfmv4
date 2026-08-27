/**
 * obs-hud.ts — 观测台顶栏（2026-08-13 重构：中央九格删除，回归网格线）
 *
 * 顶栏：deepseek + glm 双余额 + 系统三格（硬盘/内存/负载）；徽标缩小锚定顶栏下方。
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
  // 双层结构（2026-08-27 二改）：5col 网格只装五个活部件；积分长行做成卡底
  // 通栏——此前塞在 deepseek 栏格内，把该列 auto 撑宽 ~200px，sys 列被挤到
  // 向左溢出压住 glm 栏（真机截图 Screenshot_20260827_094810 实锤）
  hud.innerHTML = `
    <div class="obs-card obs-card-stack">
      <div class="obs-card-5col">
        <div class="obs-emblem-slot"></div>
        <div class="obs-id-col">
          <div class="obs-provider">deepseek</div>
          <div class="obs-balance obs-balance-ds">¥--</div>
        </div>
        <div class="obs-id-col">
          <div class="obs-provider">glm</div>
          <div class="obs-balance obs-balance-glm">¥--</div>
        </div>
        <div class="obs-sys-col"></div>
        <div class="obs-hand-slot"></div>
      </div>
      <div class="obs-quota-glm">--</div>
    </div>
  `;
  hud.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(hud);

  const balanceEls: Record<'ds' | 'glm', HTMLElement> = {
    ds: hud.querySelector<HTMLElement>('.obs-balance-ds')!,
    glm: hud.querySelector<HTMLElement>('.obs-balance-glm')!,
  };
  const quotaEl = hud.querySelector<HTMLElement>('.obs-quota-glm')!;
  const sysColEl = hud.querySelector<HTMLElement>('.obs-sys-col')!;

  // 徽标：锚定最左槽位（40×60 最小门槛，2026-08-13 用户定稿）
  const emblemRects = (): EmblemRects => {
    const slot = hud.querySelector<HTMLElement>('.obs-emblem-slot')!.getBoundingClientRect();
    return {
      pocket: {
        left: Math.round(slot.left),
        top: Math.round(slot.top),
        width: Math.round(slot.width),
        height: Math.round(slot.height),
      },
    };
  };
  const emblems = initObsEmblems(emblemRects);

  // AI 的手：待机区 = 第四栏（顶栏内部右侧），栏内活动不越界
  // （2026-08-13 用户定稿：四栏之一，图标在栏内右侧区域活动）
  const handRect = (): HandRect => {
    const slot = hud.querySelector<HTMLElement>('.obs-hand-slot')!.getBoundingClientRect();
    return {
      left: Math.round(slot.left),
      top: Math.round(slot.top),
      width: Math.round(slot.width),
      height: Math.round(slot.height),
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
  // 双余额（2026-08-27）：balance=deepseek、balanceGlm=智谱按量计费钱包，各自闪动
  const lastTotals: Record<'ds' | 'glm', string> = { ds: '', glm: '' };
  const applyBalance = (
    which: 'ds' | 'glm',
    b?: { total?: string; available?: string; error?: string },
  ) => {
    const el = balanceEls[which];
    const v = which === 'glm' ? b?.available : b?.total;
    if (b && !b.error && v != null) {
      el.textContent = fmtBalance(v);
      if (v !== lastTotals[which]) {
        lastTotals[which] = v;
        el.classList.remove('obs-flash');
        void el.offsetWidth;
        el.classList.add('obs-flash');
      }
    } else {
      el.textContent = '—';
    }
  };
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as {
        balance?: { total?: string; error?: string };
        balanceGlm?: { available?: string; error?: string };
        quotaGlm?: { win5h?: { limit: number; used: number; remaining: number }; week?: { limit: number; used: number; remaining: number }; error?: string };
        sys?: SysData;
      };
      applyBalance('ds', j?.balance);
      applyBalance('glm', j?.balanceGlm);
      // 套餐积分两窗口（2026-08-27）：5h 滚动窗 + 周，卡底通栏行
      // 「5h 12000/12000 · 周60000/60000」，不占网格列宽
      const q = j?.quotaGlm;
      if (q && !q.error && q.win5h && q.week) {
        quotaEl.textContent = `5h ${q.win5h.remaining}/${q.win5h.limit} · 周${q.week.remaining}/${q.week.limit}`;
      } else {
        quotaEl.textContent = '';
      }
      const ms = j?.sys?.metrics ?? [];
      const rows = ms.filter(m => ['硬盘', '内存', '负载'].includes(m.label))
        .map(m => `<div class="obs-sys-row">${m.label} ${m.value}</div>`).join('');
      sysColEl.innerHTML = rows;
    } catch {
      balanceEls.ds.textContent = '—';
      balanceEls.glm.textContent = '—';
      quotaEl.textContent = '';
    }
  };
  refresh();
  setInterval(refresh, REFRESH_MS);
  // 锁屏/失焦回前台：立即重同步
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  // 首次加载统一淡入 v2（2026-08-13 用户反馈 v1 失效——钱先 -- 再跳字、
  // 徽标直接显示，因为三结构各自的初始化抢跑了淡入）：
  //  1) 钱：refresh() 是异步 fetch，v1 在 fetch 返回前就淡入 → 显示 -- 后跳真值；
  //     改为等首个 refresh 完成（拿到真值）再触发淡入，淡入时钱已是真值
  //  2) 徽标：initObsEmblems 内部 probe(true) 首次探测直接落位 opacity 1（无动画）
  //     覆盖 v1 的 opacity 0；且其 canvas 的 transition 会被 applyOcc 复位——
  //     用 transition:none + 强制 reflow + 再设 transition 的「双复位」确保过渡生效
  //  3) 手：无内部 opacity 冲突，v1 已生效，本次保持
  const fadeEls = [
    hud,
    document.querySelector<HTMLElement>('.obs-emblem'),
    document.querySelector<HTMLElement>('.ai-hand'),
  ].filter((el): el is HTMLElement => el !== null);
  // 先全部隐藏（transition none 立即落位 0，不给内部逻辑覆盖窗口）
  for (const el of fadeEls) {
    el.style.transition = 'none';
    el.style.opacity = '0';
  }
  const fadeIn = () => {
    for (const el of fadeEls) {
      el.style.transition = 'opacity .9s ease';
      void el.offsetWidth;               // 强制 reflow——确保过渡从 0 起播
      el.style.opacity = '1';
    }
  };
  refresh().then(fadeIn).catch(fadeIn);  // 等首个 fetch 完成再淡入；失败也淡入（显示 —）
}
