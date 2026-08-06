/**
 * obs-hud.ts — 观测台 HUD（8.5 史官制度 · L1 中央内容层，2026-08-05 立项）
 *
 * 背景信息窗：主卡（deepseek 余额）+ 信箱卡（语义巡逻 verdict 时间线）。
 * 纯展示为主，信箱列表局部可触摸滚动（pointer-events auto 仅滚动区）。
 *
 * 呈现哲学（依据 semantic-compiler-seed）：信箱是概率区非阻断信号——柔和状态
 * 徽标而非警报条；数据单一出处（现场解析 inbox 文件，不缓存副本——语义生成原则）。
 *
 * 刷新：余额+信箱 5s 轮询（服务端 5s 缓存外部 deepseek 余额调用）；时间本地每秒。
 */
import { API } from './state.js';
import { Z } from './z-index-layers.js';

/** 轮询周期（5s，2026-08-06 用户定稿） */
const REFRESH_MS = 5_000;

let inited = false;

/** 余额固定 2 位小数（用户定稿） */
function fmtBalance(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `¥${n.toFixed(2)}`;
}

/** 信箱类型 → 徽标类名（柔和状态色，非警报化） */
const INBOX_DOT_CLASS: Record<string, string> = {
  warn: 'obs-dot-warn',
  ok: 'obs-dot-ok',
  dead: 'obs-dot-dead',
  stat: 'obs-dot-stat',
  other: 'obs-dot-other',
};
const INBOX_MARK: Record<string, string> = {
  warn: '⚠', ok: '✓', dead: '✕', stat: '▤', other: '·',
};
/** 类型中文标签（详情页徽标） */
const INBOX_LABEL: Record<string, string> = {
  warn: '待裁决', ok: '干净', dead: '崩溃', stat: '统计', other: '记录',
};

interface InboxEntry { date: string; time: string; type: string; text: string }

export function initObsHud(): void {
  if (inited) return;
  inited = true;

  const hud = document.createElement('div');
  hud.className = 'obs-hud';
  hud.innerHTML = `
    <div class="obs-card">
      <div class="obs-left">
        <div class="obs-provider">deepseek 官方</div>
        <div class="obs-clock">--:--:--</div>
      </div>
      <div class="obs-balance">¥--</div>
    </div>
    <div class="obs-inbox">
      <div class="obs-inbox-head">
        <span class="obs-inbox-title">信箱</span>
        <span class="obs-inbox-status"></span>
      </div>
      <div class="obs-inbox-list"></div>
    </div>
  `;
  hud.style.zIndex = String(Z.CENTER_CONTENT); // L1 中央内容层（< SUMMON_BTN 200）
  document.body.appendChild(hud);

  const clockEl = hud.querySelector<HTMLElement>('.obs-clock')!;
  const balanceEl = hud.querySelector<HTMLElement>('.obs-balance')!;
  const inboxListEl = hud.querySelector<HTMLElement>('.obs-inbox-list')!;
  const inboxStatusEl = hud.querySelector<HTMLElement>('.obs-inbox-status')!;

  let inboxEntries: InboxEntry[] = [];
  let inboxDetail: InboxEntry | null = null;

  // 本地时钟（每秒）
  const tick = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);

  // 渲染信箱列表（最新在前，历史渐淡；条目 = 圆点+日期+文字单行流，两行截断）
  function renderInboxList(): void {
    const latestWarn = inboxEntries.find(e => e.type === 'warn');
    const warnCount = latestWarn?.text.match(/^\d+\s*条待裁决/)?.[0];
    inboxStatusEl.textContent = latestWarn
      ? `${INBOX_MARK.warn} ${warnCount ?? latestWarn.text.slice(0, 10)}`
      : `${INBOX_MARK.ok} 干净`;
    inboxListEl.innerHTML = inboxEntries.map((e, i) => {
      const dot = INBOX_DOT_CLASS[e.type] ?? 'obs-dot-other';
      const date = e.date.slice(5).replace('-', '/'); // MM-DD → MM/DD
      const highlight = i === 0 ? ' obs-inbox-item-new' : '';
      return `<div class="obs-inbox-item${highlight}" data-i="${i}"><span class="obs-inbox-item-flow"><span class="obs-dot ${dot}"></span><span class="obs-inbox-meta">${date}${e.time ? ' ' + e.time : ''}</span> ${e.text}</span></div>`;
    }).join('');
  }

  // 详情视图：头部显示日期；滚动框内左上角返回按钮 + 类型徽标，下接完整原文
  function renderInboxDetail(): void {
    if (!inboxDetail) return;
    const dot = INBOX_DOT_CLASS[inboxDetail.type] ?? 'obs-dot-other';
    const mark = INBOX_MARK[inboxDetail.type] ?? '·';
    const label = INBOX_LABEL[inboxDetail.type] ?? inboxDetail.type;
    inboxStatusEl.textContent = inboxDetail.date + (inboxDetail.time ? ' ' + inboxDetail.time : '');
    inboxListEl.innerHTML = `
      <div class="obs-inbox-detail">
        <div class="obs-inbox-detail-top"><button class="obs-inbox-back">‹</button><span class="obs-dot ${dot}"></span><span class="obs-inbox-detail-meta">${mark} ${label}</span></div>
        <div class="obs-inbox-detail-text">${inboxDetail.text}</div>
      </div>`;
  }

  function showInboxDetail(i: number): void {
    const e = inboxEntries[i];
    if (!e) return;
    inboxDetail = e;
    renderInboxDetail();
  }
  function showInboxList(): void {
    inboxDetail = null;
    renderInboxList();
  }

  // 点击条目 → 详情；详情内返回按钮 → 列表（事件委托，滚动区已局部 pointer-events auto）
  inboxListEl.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('.obs-inbox-back')) { showInboxList(); return; }
    if (inboxDetail) return;
    const item = target.closest<HTMLElement>('.obs-inbox-item');
    if (item) {
      const i = Number(item.dataset.i);
      if (Number.isInteger(i)) showInboxDetail(i);
    }
  });

  // 余额 + 信箱刷新（5s 轮询；服务端缓存外部 deepseek 调用）
  let lastTotal = '';
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { balance?: { total?: string; error?: string }; inbox?: InboxEntry[] };
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
      if (Array.isArray(j?.inbox)) {
        inboxEntries = j.inbox;
        if (inboxDetail) renderInboxDetail(); else renderInboxList();
      }
    } catch {
      balanceEl.textContent = '—';
    }
  };
  refresh();
  setInterval(refresh, REFRESH_MS);
}
