/**
 * tools.card.ts — AI 工具卡
 *
 * 双框布局：
 * - 上方类工具卡：分类下拉 + 当前分类下的工具列表（三级框，点击打开详情弹窗）
 * - 下方类池卡：分类列表（点击切换上方内容）
 * 数据来自 GET /api/ai/tools
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { createCustomSelect, type CustomSelect } from '../../modules/custom-select.js';
import { Z } from '../../modules/z-index-layers.js';
import { innerCardStyle } from '../card-ui.js';

interface ToolDef {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
}

const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====== 工具详情弹窗（参照 showMessageEditor 模式） ======

function showToolDetail(tool: ToolDef, c1: string, c2: string): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:' + Z.MODAL_DIALOG + ';display:flex;align-items:flex-start;justify-content:center;padding-top:50px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

  const dialog = document.createElement('div');
  dialog.style.cssText = `width:calc(94vw - 20px);max-width:460px;border-radius:12px;padding:0;background:linear-gradient(rgba(20,16,32,0.98),rgba(20,16,32,0.98)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column;max-height:85vh`;

  // 顶栏：工具名称
  const topBar = document.createElement('div');
  topBar.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0`;

  const topLabel = document.createElement('span');
  topLabel.style.cssText = `font-size:11px;font-weight:600;color:rgba(255,255,255,0.75)`;
  topLabel.textContent = tool.name;

  topBar.appendChild(topLabel);

  // 内容区
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 14px;min-height:0;touch-action:pan-y';

  const descEl = document.createElement('div');
  descEl.style.cssText = 'font-size:var(--card-font-size,12px);color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:14px';
  descEl.textContent = tool.description;

  const schemaLabel = document.createElement('div');
  schemaLabel.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5);margin-bottom:4px';
  schemaLabel.textContent = '参数 Schema';

  const schemaPre = document.createElement('pre');
  schemaPre.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.6);line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.2);padding:8px;border-radius:6px';
  schemaPre.textContent = JSON.stringify(tool.parameters, null, 2);

  body.appendChild(descEl);
  body.appendChild(schemaLabel);
  body.appendChild(schemaPre);

  // 底栏：关闭
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'padding:10px 14px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;display:flex';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.cssText = `flex:1;padding:0.5em 0;border-radius:6px;font-size:var(--card-font-size,12px);font-weight:600;cursor:pointer;border:1px solid ${c1}40;color:${c1};background:transparent`;
  closeBtn.onclick = () => overlay.remove();

  bottomBar.appendChild(closeBtn);

  dialog.appendChild(topBar);
  dialog.appendChild(body);
  dialog.appendChild(bottomBar);
  overlay.appendChild(dialog);

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ====== 卡片处理器 ======

function createToolsHandler(_meta: Record<string, unknown>): CardContentHandler {
  let allTools: ToolDef[] = [];
  let categories: string[] = [];
  let activeCategory = '';
  let _c1 = '#00d4ff', _c2 = '#7c3aed';
  let _categorySelect: ReturnType<typeof createCustomSelect> | null = null;
  let _toolListEl: HTMLElement | null = null;
  let _poolListEl: HTMLElement | null = null;
  let _statsEl: HTMLElement | null = null;

  function toolsInCategory(): ToolDef[] {
    return allTools.filter(t => t.category === activeCategory);
  }

  // ---- 工具列表渲染（上方二层卡内） ----
  function renderToolList(): void {
    if (!_toolListEl) return;
    _toolListEl.innerHTML = '';

    const tools = toolsInCategory();
    if (tools.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:12px 0';
      empty.textContent = '暂无工具';
      _toolListEl.appendChild(empty);
      return;
    }

    for (const tool of tools) {
      const item = document.createElement('div');
      item.style.cssText = `padding:5px 8px;margin-bottom:3px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s`;

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      nameEl.textContent = tool.name;

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px';
      descEl.textContent = tool.description;

      item.appendChild(nameEl);
      item.appendChild(descEl);

      item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.06)'; };
      item.onmouseleave = () => { item.style.background = 'rgba(255,255,255,0.03)'; };
      item.onclick = () => { showToolDetail(tool, _c1, _c2); };

      _toolListEl!.appendChild(item);
    }
  }

  // ---- 类池渲染（下方二层卡内） ----
  function renderPoolList(): void {
    if (!_poolListEl) return;
    _poolListEl.innerHTML = '';

    if (_statsEl) {
      _statsEl.textContent = `共 ${categories.length} 个分类`;
    }

    if (categories.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:20px 0';
      empty.textContent = '暂无分类';
      _poolListEl.appendChild(empty);
      return;
    }

    for (const cat of categories) {
      const item = document.createElement('div');
      item.style.cssText = `padding:5px 8px;margin-bottom:3px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s`;

      if (cat === activeCategory) {
        item.style.background = `linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${_c1} 30%,${_c2} 70%) border-box`;
        item.style.borderColor = 'transparent';
      }

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      nameEl.textContent = cat;

      const metaEl = document.createElement('div');
      metaEl.style.cssText = 'font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.5);margin-top:1px';
      const count = allTools.filter(t => t.category === cat).length;
      metaEl.textContent = `${count} 个工具`;

      item.appendChild(nameEl);
      item.appendChild(metaEl);

      item.onmouseenter = () => {
        if (cat !== activeCategory) item.style.background = 'rgba(255,255,255,0.06)';
      };
      item.onmouseleave = () => {
        if (cat !== activeCategory) item.style.background = 'rgba(255,255,255,0.03)';
      };
      item.onclick = () => {
        activeCategory = cat;
        renderAll();
      };

      _poolListEl!.appendChild(item);
    }
  }

  // ---- 全量刷新 ----
  function renderAll(): void {
    if (_categorySelect) {
      _categorySelect.updateItems(categories.map(c => ({ label: c, value: c })), activeCategory);
    }
    renderToolList();
    renderPoolList();
  }

  return {
    async activate(contentEl, card, _reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      _c1 = c1;
      _c2 = c2;

      const stored = localStorage.getItem('kfm-fontsize-tools');
      if (stored) {
        try {
          const p = JSON.parse(stored);
          if (typeof p.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', p.fontSize + 'px');
          }
        } catch {}
      }

      const { bodyEl } = buildCardLayout(contentEl, 'tool', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto;touch-action:pan-y';

      // ===== 上方：类工具卡（二层 c2→c1 反色） =====
      const toolCard = document.createElement('div');
      toolCard.style.cssText = `${innerCardStyle(c1, c2)};display:flex;flex-direction:column;flex:1 1 50%;min-height:0`;

      const toolHeader = document.createElement('div');
      toolHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      const toolLabel = document.createElement('span');
      toolLabel.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      toolLabel.textContent = '分类';

      _categorySelect = createCustomSelect({
        accent: c1,
        accent2: c2,
        placeholder: '选择分类',
        minWidth: 80,
        onSelect: (cat) => {
          activeCategory = cat;
          renderAll();
        },
      });

      toolHeader.appendChild(toolLabel);
      toolHeader.appendChild(_categorySelect.element);

      _toolListEl = document.createElement('div');
      _toolListEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;touch-action:pan-y';

      toolCard.appendChild(toolHeader);
      toolCard.appendChild(_toolListEl);
      bodyEl.appendChild(toolCard);

      // ===== 下方：类池卡（二层 c2→c1 反色） =====
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `${innerCardStyle(c1, c2)};flex:1 1 50%;display:flex;flex-direction:column;min-height:0`;

      const poolHeader = document.createElement('div');
      poolHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      _statsEl = document.createElement('span');
      _statsEl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5)';
      _statsEl.textContent = '加载中...';
      poolHeader.appendChild(_statsEl);
      poolCard.appendChild(poolHeader);

      const listEl = document.createElement('div');
      listEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;touch-action:pan-y';
      _poolListEl = listEl;
      poolCard.appendChild(listEl);
      bodyEl.appendChild(poolCard);

      try {
        const res = await fetch(API_BASE + 'ai/tools');
        const data = await res.json();
        allTools = data.tools as ToolDef[] || [];
        categories = data.categories as string[] || [];
        if (categories.length > 0 && !activeCategory) {
          activeCategory = categories[0];
        }
        renderAll();
      } catch {
        if (_statsEl) _statsEl.textContent = '加载失败';
      }
    },

    deactivate(contentEl) {
      _toolListEl = null;
      _poolListEl = null;
      _statsEl = null;
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'tools',
  icon: '\uD83D\uDD27',
  name: 'tool',
  description: '查看 AI 可调用的工具及参数',
  kind: 'tool',
  createHandler: createToolsHandler,
});
