/**
 * settings.card.ts — AI 设置卡
 *
 * API 地址 / API Key / 模型选择。
 * 数据存储于 localStorage（前缀 kfm-）。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';

interface SettingsField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  options?: { label: string; value: string }[];
}

const SETTINGS: SettingsField[] = [
  { key: 'ai.apiUrl',  label: 'API 地址', type: 'text',     placeholder: 'https://api.openai.com/v1' },
  { key: 'ai.apiKey',  label: 'API Key',   type: 'password', placeholder: 'sk-...' },
  { key: 'ai.model',   label: '模型',       type: 'select',   options: [
    { label: 'deepseek-chat',   value: 'deepseek-chat' },
    { label: 'gpt-4o',        value: 'gpt-4o' },
    { label: 'gpt-4o-mini',   value: 'gpt-4o-mini' },
    { label: 'gemini-2.0-flash', value: 'gemini-2.0-flash' },
  ]},
];

function createSettingsHandler(_meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl, card) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, 'AI 设置', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 10px';

      // 标签栏
      const tabBar = document.createElement('div');
      tabBar.style.cssText = 'display:flex;gap:6px;overflow-x:auto;flex-shrink:0;padding:6px 0 8px;scrollbar-width:none;touch-action:pan-x';

      const tabBtn = document.createElement('div');
      tabBtn.textContent = 'AI';
      tabBtn.style.cssText = `padding:4px 14px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;user-select:none;flex-shrink:0;background:${c1}30;color:${c1};border:1px solid ${c1}40`;
      tabBar.appendChild(tabBtn);

      // 内容区
      const scrollArea = document.createElement('div');
      scrollArea.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;touch-action:pan-y';

      // 内卡（渐变边框 + 标题行 + 设置项）
      const inner = document.createElement('div');
      inner.style.cssText = `border-radius:10px;padding:10px 12px 12px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px`;

      const title = document.createElement('div');
      title.textContent = 'AI';
      title.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:8px;letter-spacing:0.5px';
      inner.appendChild(title);

      SETTINGS.forEach(f => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0';

        const label = document.createElement('div');
        label.textContent = f.label;
        label.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
        row.appendChild(label);

        if (f.type === 'select') {
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
          row.appendChild(sel);
        } else {
          const inp = document.createElement('input');
          inp.type = f.type;
          inp.placeholder = f.placeholder || '';
          inp.style.cssText = 'font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex:1;min-width:0;margin-left:8px';
          const saved = localStorage.getItem('kfm-' + f.key);
          if (saved) inp.value = saved;
          inp.addEventListener('input', () => localStorage.setItem('kfm-' + f.key, inp.value));
          row.appendChild(inp);
        }

        inner.appendChild(row);
      });

      scrollArea.appendChild(inner);
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
  name: '设置',
  description: 'AI 设置',
  kind: 'tool',
  createHandler: createSettingsHandler,
});
