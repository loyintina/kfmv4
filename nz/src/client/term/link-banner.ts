/**
 * src/client/term/link-banner.ts — 断链状态横幅（R1 断链自愈③）。
 *
 * 订阅 LinkTracker，相态上屏：重连中 / 服务器不可达 / 会话丢失（重建
 * chips）。OK 零存在感（display:none）。黑白灰极简，全部走 tokens.css
 * 既有变量（DESIGN.md 草案「不新增值」纪律）。动作经 CustomEvent 出手
 * （kfm-nz-link-rebuild / kfm-nz-link-ignore，detail.names），消费方是
 * tmux-tabs 插件——横幅不懂 tmux，只报事件（插件间零直连）。
 *
 * 挂载纪律（真机教训 2026-09-08）：**必须经 host.createContainer 挂
 * persistent 层**——裸 append body + z39 会被 layout 层根（z100）整层
 * 压住，按钮看得见点不中（elementFromPoint 实锤）。persistent 层与
 * 标签条同层：层内 z39 < 把手 41/标签排 40，层间 > layout、< overlay
 * （毛玻璃页盖横幅=正确语义）。
 */
import type { LinkSnapshot, LinkTracker } from './link-state.ts';

const PHASE_TEXT: Record<string, string> = {
  RECONNECTING: '⟳ 链路重连中',
  DOWN: '✗ 服务器不可达 · 自动探测重试中',
};

export function mountLinkBanner(tracker: LinkTracker, mount?: HTMLElement): () => void {
  const root = document.createElement('div');
  root.setAttribute('data-link-banner', '1');
  root.setAttribute('data-link-phase', '');
  const assign = root.style as CSSProperties;
  assign.position = 'fixed';
  assign.left = '12px';
  assign.right = '12px';
  assign.top = 'calc(var(--sat, 0px) + 52px)';
  assign.zIndex = '39'; // 终端内容之上、把手(41)/标签排(40)/毛玻璃(60)之下
  assign.display = 'none';
  assign.alignItems = 'center';
  assign.flexWrap = 'wrap';
  assign.gap = '6px';
  assign.padding = '7px 10px';
  assign.background = 'var(--kfm-bar-bg)';
  assign.border = '1px solid var(--kfm-line)';
  assign.borderRadius = 'var(--kfm-radius-md)';
  assign.fontSize = '12px';
  assign.color = 'var(--kfm-ink-2)';
  assign.lineHeight = '1.4';
  (mount ?? document.body).appendChild(root);

  const chip = (label: string, key: string, value: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset[key] = value;
    const bs = b.style as CSSProperties;
    bs.background = 'none';
    bs.border = '1px solid var(--kfm-line)';
    bs.color = 'var(--kfm-ink)';
    bs.font = 'inherit';
    bs.padding = '3px 8px';
    bs.cursor = 'pointer';
    bs.borderRadius = 'var(--kfm-radius-sm)';
    return b;
  };

  const fire = (type: string, names: string[]): void => {
    try {
      document.dispatchEvent(new CustomEvent(type, { detail: { names } }));
    } catch {
      /* 事件口失败不挡状态显示 */
    }
  };

  const render = (s: LinkSnapshot): void => {
    if (!s.visible) {
      root.style.display = 'none';
      return;
    }
    root.style.display = 'flex';
    root.setAttribute('data-link-phase', s.phase);
    root.textContent = '';

    if (s.phase === 'RECONNECTING' || s.phase === 'DOWN') {
      const t = document.createElement('span');
      t.textContent =
        s.phase === 'RECONNECTING'
          ? `${PHASE_TEXT.RECONNECTING}（第 ${s.retries} 次）…`
          : PHASE_TEXT.DOWN;
      root.appendChild(t);
      return;
    }

    // DEGRADED：缺失名单 + 逐名重建 chip + 全部重建 + 忽略
    const t = document.createElement('span');
    t.textContent = `△ 会话丢失：${s.missing.join('、')}`;
    root.appendChild(t);
    for (const name of s.missing) {
      const b = chip(`↻ ${name}`, 'rebuild', name);
      b.addEventListener('click', () => fire('kfm-nz-link-rebuild', [name]));
      root.appendChild(b);
    }
    const all = chip('全部重建', 'rebuildAll', '1');
    all.addEventListener('click', () => fire('kfm-nz-link-rebuild', [...s.missing]));
    root.appendChild(all);
    const ig = chip('忽略', 'ignore', '1');
    ig.addEventListener('click', () => fire('kfm-nz-link-ignore', [...s.missing]));
    ig.style.color = 'var(--kfm-ink-3)';
    root.appendChild(ig);
  };

  const off = tracker.subscribe(render);
  return () => {
    off();
    root.remove();
  };
}

type CSSProperties = CSSStyleDeclaration;
