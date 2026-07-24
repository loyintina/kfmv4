/**
 * sibling-switcher.ts — 文件树侧栏底栏"兄弟目录切换"按钮
 *
 * 零外部依赖。画布元素已在 index.html 中。切换目录后刷新页面。
 */

let _popup: HTMLDivElement | null = null;
const _API = '/kfmv4/api';

function _textW(text: string): number {
  const c = document.getElementById('siblingSwitcherBtn') as HTMLCanvasElement | null;
  if (!c) return 0;
  const ctx = c.getContext('2d');
  if (!ctx) return 0;
  ctx.font = '600 13px -apple-system, sans-serif';
  return ctx.measureText(text).width;
}

function renderText(text: string): void {
  const c = document.getElementById('siblingSwitcherBtn') as HTMLCanvasElement | null;
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  const w = r.width, h = r.height;
  if (w <= 0 || h <= 0) return;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const tw = _textW(text);
  const tx = (w - tw) / 2;
  const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#00d4ff');
  ctx.fillStyle = g; ctx.textBaseline = 'middle';
  ctx.font = '600 13px -apple-system, sans-serif';
  ctx.fillText(text, tx, h / 2);
}

function siblingName(resolved: string): string {
  const parts = resolved.split('/').filter(Boolean);
  return parts.pop() || resolved;
}

function renderLabel(): void {
  const c = document.getElementById('siblingSwitcherBtn') as HTMLCanvasElement | null;
  if (!c) return;
  const label = localStorage.getItem('kfmv4_currentRoot') || '.';
  const text = siblingName(label);
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  const w = r.width, h = r.height;
  if (w <= 0 || h <= 0) return;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const maxW = w - 16;
  let fontSize = 13;
  let displayText = text;
  for (; fontSize >= 8; fontSize--) {
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    if (ctx.measureText(displayText).width <= maxW) break;
  }
  if (fontSize < 8) {
    fontSize = 8;
    ctx.font = '600 8px -apple-system, sans-serif';
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

function destroyPopup(): void {
  if (_popup) { _popup.remove(); _popup = null; }
}

function updateRootPath(): void {
  fetch(_API + '/files/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.' }),
  }).then(r => r.json()).then(data => {
    if (data?.path && document.getElementById('siblingSwitcherBtn')) {
      localStorage.setItem('kfmv4_currentRoot', data.path);
      renderLabel();
    }
  }).catch(() => {});
}

function parentPath(path: string): string {
  const parts = path.replace(/\/+$/, '').split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') || '/' : '/';
}

async function openPopup(): Promise<void> {
  destroyPopup();
  const anchor = document.getElementById('siblingSwitcherBtn');
  if (!anchor) return;
  const current = localStorage.getItem('kfmv4_currentRoot') || '.';
  const parent = parentPath(current);
  renderText('\u23F3'); // 加载指示
  try {
    const res = await fetch(_API + '/files/list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: parent, showHidden: true }),
    });
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) {
      renderText('\u26A0'); return; // 请求异常
    }
    const dirs: Array<{ name: string; path: string }> = (data.items as Array<unknown>)
      .filter(i => i && typeof i === 'object' && (i as Record<string, unknown>)['isDir'] === true)
      .map(i => {
        const d = i as Record<string, unknown>;
        return { name: typeof d['name'] === 'string' ? d['name'] : '', path: typeof d['path'] === 'string' ? d['path'] : '' };
      });
    renderLabel(); // 恢复标签
    if (dirs.length <= 1) return; // 无兄弟目录

    const popup = document.createElement('div');
    popup.className = 'sibling-switcher-popup';
    popup.style.cssText = [
      'position:fixed;z-index:9999;min-width:160px;max-height:60vh;overflow-y:auto', // zindex-ok
      'background:rgba(10,15,30,0.96);border:1px solid rgba(255,255,255,0.12);border-radius:8px',
      'padding:4px 0;box-shadow:0 4px 24px rgba(0,0,0,0.5);touch-action:pan-y',
    ].join(';');
    const rect = anchor.getBoundingClientRect();
    popup.style.top = rect.bottom + 2 + 'px';
    popup.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';

    for (const d of dirs) {
      const row = document.createElement('div');
      const isCurrent = d.path === current || d.name === siblingName(current);
      row.style.cssText = [
        'padding:8px 12px;font-size:12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
        'color:' + (isCurrent ? 'rgba(0,212,255,0.9)' : 'rgba(255,255,255,0.75)'),
        'background:' + (isCurrent ? 'rgba(0,212,255,0.1)' : 'transparent'),
        'font-weight:' + (isCurrent ? '600' : '400'),
      ].join(';');
      row.textContent = d.name;
      row.onclick = () => {
        destroyPopup();
        if (d.path === current) return;
        localStorage.setItem('kfmv4_currentRoot', d.path);
        window.location.reload();
      };
      popup.appendChild(row);
    }
    document.body.appendChild(popup);
    _popup = popup;
    const onDocClick = (e: MouseEvent) => {
      if (e.target !== popup && !popup.contains(e.target as Node) && e.target !== anchor) {
        destroyPopup();
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
  } catch {
    renderText('\u26A0'); // 网络错误
  }
}

export function initSiblingSwitcher(): void {
  const btn = document.getElementById('siblingSwitcherBtn');
  if (!btn) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); if (_popup) { destroyPopup(); return; } openPopup(); });
  renderLabel();
  updateRootPath();
}

export function isSwitcherOpen(): boolean { return !!_popup; }
export function closeSwitcher(): void { destroyPopup(); }

initSiblingSwitcher();
