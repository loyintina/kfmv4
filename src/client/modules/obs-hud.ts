/**
 * obs-hud.ts — 观测台 HUD（8.5 史官制度 · L1 中央内容层，2026-08-05 立项）
 *
 * 背景信息窗·简约版（2026-08-06 用户定稿）：单张毛玻璃卡，三元素——
 *   deepseek 官方（标签）· 秒级时间 · 余额数字（2 位小数、5s 刷新）。
 * 纯展示（pointer-events: none，不挡手势/卡片/召唤按钮——z 低于 SUMMON_BTN）。
 *
 * 刷新策略（2026-08-06 用户定稿）：时间本地每秒；余额客户端每 5s fetch 本地
 * /api/obs/hud，服务端对 deepseek 外部余额接口做 5s 缓存（免费轻量，17280 次/天）。
 */
import { API } from './state.js';
import { Z } from './z-index-layers.js';

/** 余额轮询周期（5s） */
const BALANCE_REFRESH_MS = 5_000;

let inited = false;

/** 余额固定 2 位小数（用户定稿） */
function fmtBalance(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `¥${n.toFixed(2)}`;
}

export function initObsHud(): void {
  if (inited) return;
  inited = true;

  const hud = document.createElement('div');
  hud.className = 'obs-hud';
  hud.innerHTML = `
    <div class="obs-card">
      <div class="obs-provider">deepseek 官方</div>
      <div class="obs-clock">--:--:--</div>
      <div class="obs-balance">¥--</div>
    </div>
  `;
  hud.style.zIndex = String(Z.CENTER_CONTENT); // L1 中央内容层（< SUMMON_BTN 200，不盖按钮）
  document.body.appendChild(hud);

  const clockEl = hud.querySelector<HTMLElement>('.obs-clock')!;
  const balanceEl = hud.querySelector<HTMLElement>('.obs-balance')!;

  // 秒级时钟（本地）
  const tick = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);

  // 余额 5s 刷新（本地接口；服务端 5s 缓存外部 deepseek 调用）
  let lastTotal = '';
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { balance?: { total?: string; error?: string } };
      const b = j?.balance;
      if (b && !b.error && b.total != null) {
        balanceEl.textContent = fmtBalance(b.total);
        if (b.total !== lastTotal) {
          lastTotal = b.total;
          balanceEl.classList.remove('obs-flash');
          void balanceEl.offsetWidth; // 重触发刷新闪烁（余额真实变化时）
          balanceEl.classList.add('obs-flash');
        }
      } else {
        balanceEl.textContent = '—';
      }
    } catch {
      balanceEl.textContent = '—';
    }
  };
  refresh();
  setInterval(refresh, BALANCE_REFRESH_MS);
}
