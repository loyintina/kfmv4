/**
 * settings.card.ts — 全局设置卡
 *
 * 分区标签页 + 滚动联动设置界面。
 * 数据存储于 localStorage（前缀 kfm-），所有设置项通过 key 读写。
 *
 * 视觉规范：使用 buildCardLayout() + 主题色引用。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { currentTheme as theme } from '../../modules/theme.js';

// ========== 设置项定义 ==========

interface SettingsField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'toggle';
  tab: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

const SETTINGS: SettingsField[] = [
  { key: 'ai.apiUrl',    label: 'API 地址',  type: 'text',     tab: 'AI', placeholder: 'https://api.openai.com/v1' },
  { key: 'ai.apiKey',    label: 'API Key',   type: 'password', tab: 'AI', placeholder: 'sk-...' },
  { key: 'ai.model',     label: '模型',       type: 'select',   tab: 'AI', options: [
    { label: 'deepseek-chat',   value: 'deepseek-chat' },
    { label: 'gpt-4o',        value: 'gpt-4o' },
    { label: 'gpt-4o-mini',   value: 'gpt-4o-mini' },
    { label: 'gemini-2.0-flash', value: 'gemini-2.0-flash' },
  ]},
  { key: 'file.showHidden', label: '显示隐藏文件', type: 'toggle', tab: '显示' },
  { key: 'terminal.fontSize', label: '终端字号', type: 'select', tab: '显示', options: [
    { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' },
    { label: '10', value: '10' }, { label: '11', value: '11' }, { label: '12', value: '12' },
  ]},
  { key: '', label: '版本',     type: 'text', tab: '关于', placeholder: '7.0.0' },
  { key: '', label: '构建日期', type: 'text', tab: '关于', placeholder: '2026-07-07' },
];

const TABS = [...new Set(SETTINGS.map(f => f.tab))];
const ACCENT_1 = '#00d4ff';
const ACCENT_2 = '#7c3aed';

// ========== 内容处理器 ==========

function createSettingsHandler(_meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl, card) {
      const c1 = card?.accents?.color1 || ACCENT_1;
      const c2 = card?.accents?.color2 || ACCENT_2;
      const { bodyEl } = buildCardLayout(contentEl, '设置', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 10px';

      // --- 标签栏（sticky） ---
      const tabBar = document.createElement('div');
      tabBar.style.cssText = 'display:flex;gap:6px;overflow-x:auto;flex-shrink:0;padding:6px 0 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;touch-action:pan-x';
      tabBar.style.background = theme.surface?.bgLight || 'rgba(10,10,15,0.85)';
      const tabBtns: HTMLElement[] = [];
      TABS.forEach((tab, i) => {
        const btn = document.createElement('div');
        btn.textContent = tab;
        btn.style.cssText = `padding:4px 14px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;user-select:none;flex-shrink:0;transition:all 0.15s`;
        btn.style.background = i === 0 ? `rgba(0,212,255,0.2)` : 'rgba(255,255,255,0.06)';
        btn.style.color = i === 0 ? `rgba(0,212,255,1)` : 'rgba(255,255,255,0.7)';
        btn.dataset.tab = tab;
        tabBar.appendChild(btn);
        tabBtns.push(btn);
      });

      // --- 内容区 ---
      const scrollArea = document.createElement('div');
      scrollArea.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;touch-action:pan-y';

      const fieldInputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};
      const cardEls: HTMLElement[] = [];

      TABS.forEach(tab => {
        const card = document.createElement('div');
        card.style.cssText = `border-radius:10px;padding:8px 10px;margin-bottom:10px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px`;

        const cardTitle = document.createElement('div');
        cardTitle.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:8px;letter-spacing:0.5px';
        card.appendChild(cardTitle);

        const fields = SETTINGS.filter(f => f.tab === tab);
        fields.forEach(f => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0';

          const label = document.createElement('div');
          label.textContent = f.label;
          label.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
          row.appendChild(label);

          if (f.type === 'toggle') {
            const saved = localStorage.getItem('kfm-' + f.key);
            let on = saved === 'true';
            const toggle = document.createElement('div');
            toggle.style.cssText = `width:36px;height:20px;border-radius:10px;cursor:pointer;transition:all 0.15s;flex-shrink:0`;
            const render = () => { toggle.style.background = on ? `${c1}80` : 'rgba(255,255,255,0.12)'; };
            render();
            toggle.addEventListener('click', () => {
              on = !on; render();
              localStorage.setItem('kfm-' + f.key, String(on));
              if (f.key === 'file.showHidden' && typeof window.showHidden !== 'undefined') {
                window.showHidden = on;
              }
            });
            row.appendChild(toggle);
          } else if (f.type === 'select') {
            const sel = document.createElement('select');
            sel.style.cssText = 'font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex-shrink:0;max-width:120px';
            f.options?.forEach(opt => {
              const op = document.createElement('option');
              op.value = opt.value; op.textContent = opt.label;
              sel.appendChild(op);
            });
            const saved = localStorage.getItem('kfm-' + f.key);
            if (saved) sel.value = saved;
            sel.addEventListener('change', () => localStorage.setItem('kfm-' + f.key, sel.value));
            if (f.key) fieldInputs[f.key] = sel;
            row.appendChild(sel);
          } else {
            const inp = document.createElement('input');
            inp.type = f.type;
            inp.placeholder = f.placeholder || '';
            inp.style.cssText = 'font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex:1;min-width:0;margin-left:8px';
            const saved = localStorage.getItem('kfm-' + f.key);
            if (saved) inp.value = saved;
            inp.addEventListener('input', () => { if (f.key) localStorage.setItem('kfm-' + f.key, inp.value); });
            if (f.key) fieldInputs[f.key] = inp;
            row.appendChild(inp);
          }
          card.appendChild(row);
        });

        scrollArea.appendChild(card);
        cardEls.push(card);
      });

      // --- 标签-内容联动 ---
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const tab = (entry.target as HTMLElement).dataset.tab;
          tabBtns.forEach(btn => {
            const active = btn.dataset.tab === tab;
            btn.style.background = active ? `rgba(0,212,255,0.2)` : 'rgba(255,255,255,0.06)';
            btn.style.color = active ? `rgba(0,212,255,1)` : 'rgba(255,255,255,0.7)';
          });
        });
      }, { root: scrollArea, threshold: 0.3 });

      cardEls.forEach(el => io.observe(el));

      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const target = cardEls.find(el => el.dataset.tab === btn.dataset.tab);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      bodyEl.appendChild(tabBar);
      bodyEl.appendChild(scrollArea);
    },

    deactivate(contentEl) {
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'settings',
  icon: '\u2699',
  name: '\u8BBE\u7F6E',
  description: '\u5168\u5C40\u8BBE\u7F6E',
  kind: 'tool',
  createHandler: createSettingsHandler,
});
