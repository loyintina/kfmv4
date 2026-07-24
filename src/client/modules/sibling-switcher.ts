/**
 * sibling-switcher.ts — 文件树侧栏底栏"兄弟目录切换"按钮
 *
 * 零外部依赖。列出系统根 / 下的所有顶层目录供用户切换。
 */
let _popup: HTMLDivElement | null = null;
let _opening = false;
const _API = '/kfmv4/api';

function renderLabel(label?: string): void {
  const c = document.getElementById('siblingSwitcherBtn') as HTMLCanvasElement | null;
  if (!c) return;
  const text = label || siblingName(localStorage.getItem('kfmv4_currentRoot') || '.');
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  const w = r.width, h = r.height;
  if (w <= 0 || h <= 0) return;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const maxW = w - 16;
  let fontSize = 13, displayText = text;
  for (; fontSize >= 8; fontSize--) {
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    if (ctx.measureText(displayText).width <= maxW) break;
  }
  if (fontSize < 8) {
    fontSize = 8; ctx.font = '600 8px -apple-system, sans-serif';
    while (displayText.length > 1) {
      displayText = displayText.slice(0, -1);
      if (ctx.measureText(displayText + '…').width <= maxW) { displayText += '…'; break; }
    }
  }
  const tw = ctx.measureText(displayText).width;
  const tx = (w - tw) / 2;
  const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#00d4ff');
  ctx.fillStyle = g; ctx.textBaseline = 'middle';
  ctx.fillText(displayText, tx, h / 2);
}

function siblingName(resolved: string): string {
  const parts = resolved.split('/').filter(Boolean);
  return parts.pop() || resolved;
}

function destroyPopup(): void {
  if (_popup) { _popup.remove(); _popup = null; }
}

function syncRootFromServer(): void {
  fetch(_API + '/root/current').then(r => r.json()).then(data => {
    if (data?.root && document.getElementById('siblingSwitcherBtn')) {
      localStorage.setItem('kfmv4_currentRoot', data.root);
      renderLabel();
    }
  }).catch(() => {});
}

async function openPopup(): Promise<void> {
  if (_opening || _popup) return;
  _opening = true;
  destroyPopup();
  const anchor = document.getElementById('siblingSwitcherBtn');
  if (!anchor) { _opening = false; return; }
  try {
    const res = await fetch(_API + '/roots');
    const data: unknown = await res.json();
    _opening = false;
    if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) {
      renderLabel('\u26A0'); return;
    }
    const dirs: string[] = data.items.filter((n: unknown) => typeof n === 'string');
    const current = localStorage.getItem('kfmv4_currentRoot') || '.';
    renderLabel();
    if (dirs.length === 0) return;

    const popup = document.createElement('div');
    popup.className = 'sibling-switcher-popup';
    popup.style.cssText = [
      'position:fixed;z-index:9999;min-width:160px;max-height:60vh;overflow-y:auto', // zindex-ok
      'background:rgba(10,15,30,0.96);border:1px solid rgba(255,255,255,0.12);border-radius:8px',
      'padding:4px 0;box-shadow:0 4px 24px rgba(0,0,0,0.5);touch-action:pan-y',
    ].join(';');
    const rect = anchor.getBoundingClientRect();
    popup.style.bottom = window.innerHeight - rect.top + 2 + 'px';
    popup.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';

    for (const d of dirs) {
      const fullPath = '/' + d;
      const isCurrent = fullPath === current || '/' + siblingName(current) === fullPath;
      const row = document.createElement('div');
      row.style.cssText = [
        'padding:8px 12px;font-size:12px;cursor:pointer;white-space:nowrap',
        'color:' + (isCurrent ? 'rgba(0,212,255,0.9)' : 'rgba(255,255,255,0.75)'),
        'background:' + (isCurrent ? 'rgba(0,212,255,0.1)' : 'transparent'),
        'font-weight:' + (isCurrent ? '600' : '400'),
      ].join(';');
      row.textContent = '/' + d;
      row.onclick = async () => {
        destroyPopup();
        try {
          const res = await fetch(_API + '/root/switch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath }),
          });
          const data = await res.json();
          if (data?.success) {
            localStorage.setItem('kfmv4_currentRoot', data.root);
            localStorage.removeItem('expandedPaths');
          }
        } catch { /* reload 后 establishRoot 会重试 */ }
        window.location.reload();
      };
      popup.appendChild(row);
    }
    document.body.appendChild(popup);
    _popup = popup;
    const onDocClick = (e: MouseEvent) => {
      if (e.target !== popup && !popup.contains(e.target as Node) && e.target !== anchor) {
        destroyPopup(); document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
  } catch {
    _opening = false;
    renderLabel('\u26A0');
  }
}

export function initSiblingSwitcher(): void {
  const btn = document.getElementById('siblingSwitcherBtn');
  if (!btn) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); if (_popup) { destroyPopup(); return; } openPopup(); });
  renderLabel();
  syncRootFromServer();
}

export function isSwitcherOpen(): boolean { return !!_popup; }
export function closeSwitcher(): void { destroyPopup(); }

initSiblingSwitcher();
