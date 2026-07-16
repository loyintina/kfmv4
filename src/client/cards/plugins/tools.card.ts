/**
 * tools.card.ts — AI 工具卡
 *
 * 双框布局：类选择框 + 工具池。
 * - 类选择框：分类下拉切换 + 选中工具详情（参数 JSON Schema）
 * - 工具池：当前分类下的工具列表
 * 数据来自 GET /api/ai/tools
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { createCustomSelect, type CustomSelect } from '../../modules/custom-select.js';

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

// ====== 卡片处理器 ======

function createToolsHandler(_meta: Record<string, unknown>): CardContentHandler {
  let allTools: ToolDef[] = [];
  let categories: string[] = [];
  let activeCategory = '';
  let selectedTool = '';
  let _c1 = '#00d4ff', _c2 = '#7c3aed';
  let _categorySelect: ReturnType<typeof createCustomSelect> | null = null;
  let _detailEl: HTMLElement | null = null;
  let _poolListEl: HTMLElement | null = null;
  let _statsEl: HTMLElement | null = null;

  function toolsInCategory(): ToolDef[] {
    return allTools.filter(t => t.category === activeCategory);
  }

  // ---- 工具详情渲染 ----
  function renderDetail(): void {
    if (!_detailEl) return;
    const tool = allTools.find(t => t.name === selectedTool);
    if (!tool) {
      _detailEl.innerHTML = '<div style="font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.4);text-align:center;padding:12px 0">选择左侧列表中的工具查看详情</div>';
      return;
    }
    const paramsJson = JSON.stringify(tool.parameters, null, 2);
    _detailEl.innerHTML = `
      <div style="font-size:var(--card-font-size,11px);font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:4px">${escapeHtml(tool.name)}</div>
      <div style="font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.65);margin-bottom:10px;line-height:1.5">${escapeHtml(tool.description)}</div>
      <div style="font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.5);margin-bottom:2px">参数 Schema</div>
      <pre style="font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.55);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit">${escapeHtml(paramsJson)}</pre>
    `;
  }

  // ---- 工具池渲染 ----
  function renderToolList(): void {
    if (!_poolListEl) return;
    _poolListEl.innerHTML = '';

    const tools = toolsInCategory();
    if (_statsEl) {
      _statsEl.textContent = `共 ${tools.length} 个工具`;
    }

    if (tools.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:20px 0';
      empty.textContent = '暂无工具';
      _poolListEl.appendChild(empty);
      return;
    }

    for (const tool of tools) {
      const item = document.createElement('div');
      item.style.cssText = `padding:5px 8px;margin-bottom:3px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s`;

      if (tool.name === selectedTool) {
        item.style.background = `linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${_c1} 30%,${_c2} 70%) border-box`;
        item.style.borderColor = 'transparent';
      }

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      nameEl.textContent = tool.name;

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px';
      descEl.textContent = tool.description;

      item.appendChild(nameEl);
      item.appendChild(descEl);

      item.onmouseenter = () => {
        if (tool.name !== selectedTool) item.style.background = 'rgba(255,255,255,0.06)';
      };
      item.onmouseleave = () => {
        if (tool.name !== selectedTool) item.style.background = 'rgba(255,255,255,0.03)';
      };
      item.onclick = () => {
        selectedTool = tool.name;
        renderDetail();
        renderToolList();
      };

      _poolListEl!.appendChild(item);
    }
  }

  // ---- 全量刷新 ----
  function renderAll(): void {
    if (_categorySelect) {
      _categorySelect.updateItems(categories.map(c => ({ label: c, value: c })), activeCategory);
    }
    if (!selectedTool && toolsInCategory().length > 0) {
      selectedTool = toolsInCategory()[0].name;
    }
    renderDetail();
    renderToolList();
  }

  return {
    async activate(contentEl, card, _reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      _c1 = c1;
      _c2 = c2;

      // 加载字号偏好
      const stored = localStorage.getItem('kfm-fontsize-tools');
      if (stored) {
        try {
          const p = JSON.parse(stored);
          if (typeof p.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', p.fontSize + 'px');
          }
        } catch {}
      }

      const { bodyEl } = buildCardLayout(contentEl, 'AI 工具', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto';

      // ===== 类选择框（二层 c2→c1 反色） =====
      const classCard = document.createElement('div');
      classCard.style.cssText = `border-radius:10px;padding:8px 12px;margin-top:6px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column`;

      // 顶栏：分类选择器
      const classHeader = document.createElement('div');
      classHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      const classLabel = document.createElement('span');
      classLabel.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      classLabel.textContent = '分类';

      _categorySelect = createCustomSelect({
        accent: c1,
        accent2: c2,
        placeholder: '选择分类',
        minWidth: 80,
        onSelect: (cat) => {
          activeCategory = cat;
          const tools = toolsInCategory();
          selectedTool = tools.length > 0 ? tools[0].name : '';
          renderAll();
        },
      });

      classHeader.appendChild(classLabel);
      classHeader.appendChild(_categorySelect.element);

      // 工具详情区
      _detailEl = document.createElement('div');
      _detailEl.style.cssText = `border-radius:8px;padding:8px;background:linear-gradient(rgba(10,10,15,0.94),rgba(10,10,15,0.94)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box;border:1px solid transparent;border-left-width:3px;min-height:80px`;

      classCard.appendChild(classHeader);
      classCard.appendChild(_detailEl);
      bodyEl.appendChild(classCard);

      // ===== 工具池（二层 c2→c1 反色） =====
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `border-radius:10px;padding:8px 12px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px;flex:1;display:flex;flex-direction:column;min-height:0`;

      const poolHeader = document.createElement('div');
      poolHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      _statsEl = document.createElement('span');
      _statsEl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5)';
      _statsEl.textContent = '加载中...';
      poolHeader.appendChild(_statsEl);
      poolCard.appendChild(poolHeader);

      const listEl = document.createElement('div');
      listEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0';
      _poolListEl = listEl;
      poolCard.appendChild(listEl);
      bodyEl.appendChild(poolCard);

      // 加载数据
      try {
        const res = await fetch(API_BASE + 'ai/tools');
        const data = await res.json();
        allTools = data.tools as ToolDef[] || [];
        categories = data.categories as string[] || [];
        if (categories.length > 0) {
          activeCategory = categories[0];
        }
        renderAll();
      } catch {
        if (_statsEl) _statsEl.textContent = '加载失败';
      }
    },

    deactivate(contentEl) {
      _poolListEl = null;
      _detailEl = null;
      _statsEl = null;
      contentEl.innerHTML = '';
    },
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

registerCardType({
  typeId: 'tools',
  icon: '\uD83D\uDD27',
  name: 'AI 工具',
  description: '查看 AI 可调用的工具及参数',
  kind: 'tool',
  createHandler: createToolsHandler,
});
