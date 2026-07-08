/**
 * settings.card.ts — 全局设置卡
 *
 * 分区标签页 + 滚动联动设置界面。
 * 数据存储于 localStorage，所有设置项通过 key 读写。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';

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
  // AI
  { key: 'ai.apiUrl',    label: 'API \u5730\u5740',     type: 'text',     tab: 'AI', placeholder: 'https://api.openai.com/v1' },
  { key: 'ai.apiKey',    label: 'API Key',               type: 'password', tab: 'AI', placeholder: 'sk-...' },
  { key: 'ai.model',     label: '\u6A21\u578B',          type: 'select',   tab: 'AI', options: [
    { label: 'deepseek-chat',   value: 'deepseek-chat' },
    { label: 'gpt-4o',        value: 'gpt-4o' },
    { label: 'gpt-4o-mini',   value: 'gpt-4o-mini' },
    { label: 'gemini-2.0-flash', value: 'gemini-2.0-flash' },
  ]},
  // 显示
  { key: 'file.showHidden', label: '\u663E\u793A\u9690\u85CF\u6587\u4EF6', type: 'toggle', tab: '\u663E\u793A' },
  { key: 'terminal.fontSize', label: '\u7EC8\u7AEF\u5B57\u53F7', type: 'select', tab: '\u663E\u793A', options: [
    { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' },
    { label: '10', value: '10' }, { label: '11', value: '11' }, { label: '12', value: '12' },
  ]},
  // 关于
  { key: '', label: '\u7248\u672C', type: 'text', tab: '\u5173\u4E8E', placeholder: '7.0.0' },
  { key: '', label: '\u6784\u5EFA\u65E5\u671F', type: 'text', tab: '\u5173\u4E8E', placeholder: '2026-07-07' },
];

const TABS = [...new Set(SETTINGS.map(f => f.tab))];

// ========== 内容处理器 ==========

function createSettingsHandler(_meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl) {
      contentEl.innerHTML = '';

      // --- 标题栏 ---
      const titleBar = document.createElement('div');
      titleBar.textContent = '\u8BBE\u7F6E';
      titleBar.style.cssText = 'font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);padding:8px 2px 4px;flex-shrink:0';

      // --- 标签栏（sticky） ---
      const tabBar = document.createElement('div');
      tabBar.style.cssText = 'display:flex;gap:6px;overflow-x:auto;flex-shrink:0;padding:4px 0 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:sticky;top:0;z-index:1;background:rgba(10,10,15,0.95)';
      (tabBar as HTMLElement & { style: CSSStyleDeclaration }).style.background = 'transparent';

      const tabBtns: HTMLElement[] = [];
      TABS.forEach((tab, i) => {
        const btn = document.createElement('div');
        btn.textContent = tab;
        btn.style.cssText = 'padding:4px 14px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;user-select:none;flex-shrink:0;background:' + (i === 0 ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.06)') + ';color:' + (i === 0 ? 'rgba(0,212,255,1)' : 'rgba(255,255,255,0.7)') + ';transition:all 0.15s';
        btn.dataset.tab = tab;
        tabBar.appendChild(btn);
        tabBtns.push(btn);
      });

      // --- 内容区（纵滑，横滑透传） ---
      const scrollArea = document.createElement('div');
      scrollArea.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;padding:0 2px';

      // 每类设置一张卡片
      const cardEls: HTMLElement[] = [];
      const fieldInputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};

      TABS.forEach(tab => {
        const card = document.createElement('div');
        card.dataset.tab = tab;
        card.style.cssText = 'border-radius:10px;padding:10px 12px;margin-bottom:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)';

        const cardTitle = document.createElement('div');
        cardTitle.textContent = tab;
        cardTitle.style.cssText = 'font-size:11px;font-weight:700;color:rgba(0,212,255,0.7);margin-bottom:8px;letter-spacing:0.5px';

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
            const toggle = document.createElement('div');
            toggle.style.cssText = 'width:36px;height:20px;border-radius:10px;cursor:pointer;transition:all 0.15s;flex-shrink:0';
            toggle.dataset.key = f.key;

            const saved = localStorage.getItem('kfm-' + f.key);
            let on = saved === 'true';
            const render = () => {
              toggle.style.background = on ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)';
            };
            render();
            toggle.addEventListener('click', () => {
              on = !on;
              render();
              localStorage.setItem('kfm-' + f.key, String(on));
              // 同步到 KFMState 全局变量
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
              op.value = opt.value;
              op.textContent = opt.label;
              sel.appendChild(op);
            });
            const saved = localStorage.getItem('kfm-' + f.key);
            if (saved) sel.value = saved;
            sel.addEventListener('change', () => localStorage.setItem('kfm-' + f.key, sel.value));
            fieldInputs[f.key] = sel;
            row.appendChild(sel);
          } else {
            const inp = document.createElement('input');
            inp.type = f.type;
            inp.placeholder = f.placeholder || '';
            inp.style.cssText = 'font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex:1;min-width:0;margin-left:8px';
            const saved = localStorage.getItem('kfm-' + f.key);
            if (saved) inp.value = saved;
            inp.addEventListener('input', () => {
              if (f.key) localStorage.setItem('kfm-' + f.key, inp.value);
            });
            if (f.key) fieldInputs[f.key] = inp;
            row.appendChild(inp);
          }

          card.appendChild(row);
        });

        scrollArea.appendChild(card);
        cardEls.push(card);
      });

      // --- 标签-内容联动（IntersectionObserver） ---
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const tab = (entry.target as HTMLElement).dataset.tab;
          tabBtns.forEach(btn => {
            const active = btn.dataset.tab === tab;
            btn.style.background = active ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.06)';
            btn.style.color = active ? 'rgba(0,212,255,1)' : 'rgba(255,255,255,0.7)';
          });
        });
      }, { root: scrollArea, threshold: 0.3 });

      cardEls.forEach(el => io.observe(el));

      // --- 点击标签 → 滚动到对应卡片 ---
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const target = cardEls.find(el => el.dataset.tab === btn.dataset.tab);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      // --- 组装 ---
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;height:100%';
      wrap.appendChild(titleBar);
      wrap.appendChild(tabBar);
      wrap.appendChild(scrollArea);
      contentEl.appendChild(wrap);
    },

    deactivate(contentEl) {
      contentEl.innerHTML = '';
    },
  };
}

// ========== 注册 ==========

registerCardType({
  typeId: 'settings',
  icon: '\u2699',
  name: '\u8BBE\u7F6E',
  description: '\u5168\u5C40\u8BBE\u7F6E',
  kind: 'tool',
  createHandler: createSettingsHandler,
});
