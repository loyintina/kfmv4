/**
 * obs-hud.ts — 观测台 HUD（8.5 史官制度 · L1 中央内容层，2026-08-05 立项）
 *
 * 背景信息窗：全屏分框骨架，纯展示（pointer-events: none，不挡手势/卡片/文件树）。
 * 骨架版：顶栏本地时钟（每秒）+ 主区 deepseek 官方余额（30s 轮询 /api/obs/hud，
 * 服务端每次实时拉官方 /user/balance）；其余框（GATEWAY/ACTIVE/SESS/BREACH/CRON/
 * SYS/PATROL）按设计占位待填——数据面逐步接入。
 */
import { API } from './state.js';
import { Z } from './z-index-layers.js';

const OBS_REFRESH_MS = 30_000;

let inited = false;

export function initObsHud(): void {
  if (inited) return;
  inited = true;

  const hud = document.createElement('div');
  hud.className = 'obs-hud';
  hud.innerHTML = `
    <div class="obs-top">
      <span class="obs-clock">--:--:--</span>
      <span class="obs-top-right"></span>
    </div>
    <div class="obs-main">
      <div class="obs-balance">—</div>
      <div class="obs-balance-sub">deepseek 官方 · 加载中</div>
    </div>
    <div class="obs-row2">
      <div class="obs-box" data-title="GATEWAY"></div>
      <div class="obs-box" data-title="ACTIVE"></div>
    </div>
    <div class="obs-row3">
      <div class="obs-box" data-title="SESS"></div>
      <div class="obs-box" data-title="BREACH"></div>
      <div class="obs-box" data-title="CRON"></div>
    </div>
    <div class="obs-row4">
      <div class="obs-box" data-title="SYS"></div>
      <div class="obs-box" data-title="PATROL"></div>
    </div>
    <div class="obs-bar"></div>
  `;
  hud.style.zIndex = String(Z.CENTER_CONTENT); // L1 中央内容层（预留层，恰为 HUD 用途）
  document.body.appendChild(hud);

  const clockEl = hud.querySelector<HTMLElement>('.obs-clock')!;
  const balanceEl = hud.querySelector<HTMLElement>('.obs-balance')!;
  const subEl = hud.querySelector<HTMLElement>('.obs-balance-sub')!;

  // 本地时钟（每秒）
  const tick = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);

  // 余额（30s 轮询；服务端每次实时拉 deepseek 官方）
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { balance?: { total?: string; granted?: string; toppedUp?: string; fetchedAt?: string; error?: string } };
      const b = j?.balance;
      if (b && !b.error && b.total != null) {
        balanceEl.textContent = `¥${Number(b.total).toFixed(2)}`;
        subEl.textContent =
          `deepseek 官方 · 充值 ¥${Number(b.toppedUp ?? 0).toFixed(2)} · 赠送 ¥${Number(b.granted ?? 0).toFixed(2)}` +
          (b.fetchedAt ? ` · ${new Date(b.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '');
        balanceEl.classList.remove('obs-flash');
        void balanceEl.offsetWidth; // 重触发刷新闪烁
        balanceEl.classList.add('obs-flash');
      } else {
        subEl.textContent = b?.error ? `余额获取失败：${b.error}` : '余额数据缺失';
        balanceEl.textContent = '—';
      }
    } catch (e) {
      subEl.textContent = `余额获取失败：${e instanceof Error ? e.message.slice(0, 40) : '网络错误'}`;
      balanceEl.textContent = '—';
    }
  };
  refresh();
  setInterval(refresh, OBS_REFRESH_MS);
}
