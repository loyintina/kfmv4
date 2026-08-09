/**
 * scripts.card.ts — 脚本目录卡
 *
 * 双框布局（同 tools.card.ts）：
 * - 上方类工具卡：分类下拉 + 当前分类下的脚本列表（点击打开详情弹窗）
 * - 下方类池卡：分类列表（点击切换上方内容）
 * 数据来自 src/client/generated/scripts-catalog.ts（gen-scripts-catalog.mjs 生成，随包构建）
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { createCustomSelect } from '../../modules/custom-select.js';
import { Z } from '../../modules/z-index-layers.js';
import { innerCardStyle } from '../card-ui.js';
import { SCRIPTS_CATALOG, SCRIPT_CATEGORIES, type ScriptCatalogEntry } from '../../generated/scripts-catalog.js';

// ====== 脚本详情弹窗 ======

function showScriptDetail(script: ScriptCatalogEntry, c1: string, c2: string): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:' + Z.MODAL_DIALOG + ';display:flex;align-items:flex-start;justify-content:center;padding-top:50px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

  const dialog = document.createElement('div');
  dialog.style.cssText = `width:calc(94vw - 20px);max-width:460px;border-radius:12px;padding:0;background:linear-gradient(rgba(20,16,32,0.98),rgba(20,16,32,0.98)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column;max-height:85vh`;

  // 顶栏：脚本名
  const topBar = document.createElement('div');
  topBar.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0`;

  const topLabel = document.createElement('span');
  topLabel.style.cssText = `font-size:11px;font-weight:600;color:rgba(255,255,255,0.75)`;
  topLabel.textContent = script.name;
  topBar.appendChild(topLabel);

  // 主体
  const body = document.createElement('div');
  body.style.cssText = 'padding:12px 14px;overflow-y:auto;flex:1;min-height:0';

  function addField(label: string, value: string): void {
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5);margin-bottom:2px;margin-top:8px';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.8);line-height:1.5;white-space:pre-wrap;word-break:break-word';
    valueEl.textContent = value;
    body.appendChild(labelEl);
    body.appendChild(valueEl);
  }

  addField('文件', script.file);
  addField('分类', script.category);
  addField('描述', script.description);
  addField('权限模式', script.permission);
  addField('内置提示词', script.prompt);
  addField('效果', script.effect);

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

function createScriptsHandler(_meta: Record<string, unknown>): CardContentHandler {
  const allScripts = SCRIPTS_CATALOG;
  const categories = SCRIPT_CATEGORIES;
  let activeCategory = categories[0] || '';
  let _c1 = '#00d4ff', _c2 = '#7c3aed';
  let _categorySelect: ReturnType<typeof createCustomSelect> | null = null;
  let _scriptListEl: HTMLElement | null = null;
  let _poolListEl: HTMLElement | null = null;
  let _statsEl: HTMLElement | null = null;

  function scriptsInCategory(): ScriptCatalogEntry[] {
    return allScripts.filter(s => s.category === activeCategory);
  }

  // ---- 脚本列表渲染（上方二层卡内） ----
  function renderScriptList(): void {
    if (!_scriptListEl) return;
    _scriptListEl.innerHTML = '';

    const scripts = scriptsInCategory();
    if (scripts.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:12px 0';
      empty.textContent = '暂无脚本';
      _scriptListEl.appendChild(empty);
      return;
    }

    for (const script of scripts) {
      const item = document.createElement('div');
      item.style.cssText = `padding:5px 8px;margin-bottom:3px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s`;

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      nameEl.textContent = script.name;

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px';
      descEl.textContent = script.description;

      item.appendChild(nameEl);
      item.appendChild(descEl);

      item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.06)'; };
      item.onmouseleave = () => { item.style.background = 'rgba(255,255,255,0.03)'; };
      item.onclick = () => { showScriptDetail(script, _c1, _c2); };

      _scriptListEl!.appendChild(item);
    }
  }

  // ---- 类池渲染（下方二层卡内） ----
  function renderPoolList(): void {
    if (!_poolListEl) return;
    _poolListEl.innerHTML = '';

    if (_statsEl) {
      _statsEl.textContent = `共 ${categories.length} 个分类 / ${allScripts.length} 个脚本`;
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
      const count = allScripts.filter(s => s.category === cat).length;
      metaEl.textContent = `${count} 个脚本`;

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
    renderScriptList();
    renderPoolList();
  }

  return {
    async activate(contentEl, card, _reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      _c1 = c1;
      _c2 = c2;

      const stored = localStorage.getItem('kfm-fontsize-scripts');
      if (stored) {
        try {
          const p = JSON.parse(stored);
          if (typeof p.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', p.fontSize + 'px');
          }
        } catch {}
      }

      const { bodyEl } = buildCardLayout(contentEl, '脚本', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto;touch-action:pan-y';

      // ===== 上方：类工具卡（二层 c2→c1 反色） =====
      const scriptCard = document.createElement('div');
      scriptCard.style.cssText = `${innerCardStyle(c1, c2)};display:flex;flex-direction:column;flex:1 1 50%;min-height:0`;

      const scriptHeader = document.createElement('div');
      scriptHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      const scriptLabel = document.createElement('span');
      scriptLabel.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      scriptLabel.textContent = '分类';

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

      scriptHeader.appendChild(scriptLabel);
      scriptHeader.appendChild(_categorySelect.element);

      _scriptListEl = document.createElement('div');
      _scriptListEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;touch-action:pan-y';

      scriptCard.appendChild(scriptHeader);
      scriptCard.appendChild(_scriptListEl);
      bodyEl.appendChild(scriptCard);

      // ===== 下方：类池卡（二层 c2→c1 反色） =====
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `${innerCardStyle(c1, c2)};flex:1 1 50%;display:flex;flex-direction:column;min-height:0`;

      const poolHeader = document.createElement('div');
      poolHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      _statsEl = document.createElement('span');
      _statsEl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5)';
      poolHeader.appendChild(_statsEl);
      poolCard.appendChild(poolHeader);

      const listEl = document.createElement('div');
      listEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;touch-action:pan-y';
      _poolListEl = listEl;
      poolCard.appendChild(listEl);
      bodyEl.appendChild(poolCard);

      renderAll();
    },

    deactivate(contentEl) {
      _scriptListEl = null;
      _poolListEl = null;
      _statsEl = null;
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'scripts',
  icon: '\uD83D\uDCDC',
  name: '脚本',
  description: '查看项目的 agent 脚本目录：权限模式、内置提示词、效果',
  kind: 'tool',
  createHandler: createScriptsHandler,
});
