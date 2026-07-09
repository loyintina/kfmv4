/**
 * api.card.ts — API 接入设置卡
 *
 * 管理 Provider（地址/Key/模型列表）的编辑、测试、选择。
 * 数据存储于 localStorage（kfm-providers / kfm-api-current）。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

// ====== 工具函数 ======

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadProviders(): Provider[] {
  try { return JSON.parse(localStorage.getItem('kfm-providers') || '[]'); }
  catch { return []; }
}

function saveProviders(ps: Provider[]): void {
  localStorage.setItem('kfm-providers', JSON.stringify(ps));
}

function loadCurrentId(): string {
  return localStorage.getItem('kfm-api-current') || '';
}

function saveCurrentId(id: string): void {
  localStorage.setItem('kfm-api-current', id);
}

// ====== DOM 辅助 ======

function inputStyle(): Record<string, string> {
  return {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.85)',
    outline: 'none',
    flex: '1',
    minWidth: '0',
  };
}

function mkRow(label: string): { row: HTMLElement; inputWrap: HTMLElement } {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;margin-bottom:8px';
  const lbl = document.createElement('div');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px;width:52px';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex:1;min-width:0';
  row.appendChild(lbl);
  row.appendChild(wrap);
  return { row, inputWrap: wrap };
}

function btnStyle(color: string): string {
  return `padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;user-select:none;border:1px solid ${color}40;color:${color};background:transparent;flex:1;text-align:center`;
}

// ====== Handler ======

function createApiHandler(_meta: Record<string, unknown>): CardContentHandler {
  let providers: Provider[] = [];
  let currentId = '';
  let c1 = '#00d4ff', c2 = '#7c3aed';

  // DOM refs
  let selEl!: HTMLSelectElement;
  let nameEl!: HTMLInputElement;
  let urlEl!: HTMLInputElement;
  let keyEl!: HTMLInputElement;
  let modelTagsEl!: HTMLDivElement;
  let modelInput!: HTMLInputElement;
  let poolEl!: HTMLDivElement;
  let testBtn!: HTMLDivElement;

  function getCurrent(): Provider | undefined {
    return providers.find(p => p.id === currentId);
  }

  function commitCurrent(): void {
    let cur = getCurrent();
    if (!cur) {
      // Auto-create a provider from current field values
      cur = { id: uid(), name: nameEl.value.trim(), baseUrl: urlEl.value.trim(), apiKey: keyEl.value.trim(), models: [] };
      providers.push(cur);
      currentId = cur.id;
      saveCurrentId(currentId);
    } else {
      cur.name = nameEl.value.trim();
      cur.baseUrl = urlEl.value.trim();
      cur.apiKey = keyEl.value.trim();
    }
    saveProviders(providers);
  }

  function fillEditor(p: Provider | null): void {
    if (p) {
      nameEl.value = p.name;
      urlEl.value = p.baseUrl;
      keyEl.value = p.apiKey;
      renderModels(p.models);
    } else {
      nameEl.value = '';
      urlEl.value = '';
      keyEl.value = '';
      renderModels([]);
    }
  }

  function renderModels(models: string[]): void {
    modelTagsEl.innerHTML = '';
    models.forEach(m => {
      const tag = document.createElement('span');
      tag.style.cssText = `display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:4px;font-size:10px;background:${c1}20;color:rgba(255,255,255,0.8);margin:2px 4px 2px 0`;
      const label = document.createElement('span');
      label.textContent = m;
      tag.appendChild(label);
      const x = document.createElement('span');
      x.textContent = '×';
      x.style.cssText = 'cursor:pointer;opacity:0.5;font-size:12px;line-height:1;margin-left:2px;padding:0 1px';
      x.onclick = () => {
        const cur = getCurrent();
        if (!cur) return;
        cur.models = cur.models.filter(mm => mm !== m);
        renderModels(cur.models);
      };
      tag.appendChild(x);
      modelTagsEl.appendChild(tag);
    });
  }

  async function fetchAvailableModels(): Promise<string[]> {
    const url = urlEl.value.trim();
    const key = keyEl.value.trim();
    if (!url || !key) return [];
    try {
      const res = await fetch(url + '/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      // OpenAI format: { data: [{ id: string }, ...] }
      // DeepSeek format: same
      if (data?.data && Array.isArray(data.data)) {
        return data.data.map((m: { id: string }) => m.id).filter(Boolean);
      }
      return [];
    } catch { return []; }
  }

  async function addModel(): Promise<void> {
    let cur = getCurrent();
    if (!cur) {
      commitCurrent();
      cur = getCurrent();
      if (!cur) {
        modelInput.placeholder = '⚠ 请先填写名称和地址';
        modelInput.style.borderColor = 'rgba(255,160,0,0.5)';
        setTimeout(() => {
          modelInput.placeholder = '输入模型名，回车添加';
          modelInput.style.borderColor = 'rgba(255,255,255,0.1)';
        }, 2000);
        return;
      }
    }
    const v = modelInput.value.trim();
    if (v) {
      // Manual add: typed a model name
      if (!cur.models.includes(v)) {
        cur.models.push(v);
        renderModels(cur.models);
      }
      modelInput.value = '';
      modelInput.focus();
    } else {
      // Auto-fetch: input empty, try to get models from API
      modelInput.placeholder = '⏳ 获取模型列表...';
      modelInput.style.borderColor = `${c1}60`;
      const models = await fetchAvailableModels();
      if (models.length === 0) {
        modelInput.placeholder = '⚠ 未能获取模型列表，请手动输入';
        modelInput.style.borderColor = 'rgba(255,160,0,0.5)';
        setTimeout(() => {
          modelInput.placeholder = '输入模型名，回车添加';
          modelInput.style.borderColor = 'rgba(255,255,255,0.1)';
        }, 3000);
        return;
      }
      // Merge new models
      let added = 0;
      models.forEach(m => {
        if (!cur!.models.includes(m)) {
          cur!.models.push(m);
          added++;
        }
      });
      renderModels(cur.models);
      modelInput.placeholder = added > 0 ? `✓ 添加了 ${added} 个模型` : '✓ 模型已是最新';
      modelInput.style.borderColor = 'rgba(0,212,80,0.4)';
      setTimeout(() => {
        modelInput.placeholder = '输入模型名，回车添加';
        modelInput.style.borderColor = 'rgba(255,255,255,0.1)';
      }, 2000);
    }
  }

  function rebuildPool(): void {
    poolEl.innerHTML = '';
    selEl.innerHTML = '';

    providers.forEach(p => {
      // Selector option
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || '(unnamed)';
      if (p.id === currentId) opt.selected = true;
      selEl.appendChild(opt);

      // Pool row
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;margin-bottom:3px;background:rgba(255,255,255,0.03)';

      const left = document.createElement('div');
      left.style.cssText = 'display:flex;align-items:center;gap:5px;flex:1;min-width:0';

      const dot = document.createElement('span');
      dot.textContent = p.id === currentId ? '◉' : '○';
      dot.style.cssText = `font-size:9px;flex-shrink:0;color:${p.id === currentId ? c1 : 'rgba(255,255,255,0.25)'}`;
      left.appendChild(dot);

      const nm = document.createElement('span');
      nm.textContent = p.name || '(unnamed)';
      nm.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      left.appendChild(nm);

      const cnt = document.createElement('span');
      cnt.textContent = `${p.models.length} 模型`;
      cnt.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.35);flex-shrink:0';
      left.appendChild(cnt);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;align-items:center';

      if (p.id !== currentId) {
        const setBtn = document.createElement('span');
        setBtn.textContent = '设为当前';
        setBtn.style.cssText = `font-size:9px;cursor:pointer;color:${c1};padding:1px 4px;border-radius:3px`;
        setBtn.onclick = () => {
          currentId = p.id;
          saveCurrentId(currentId);
          rebuildPool();
          fillEditor(p);
        };
        actions.appendChild(setBtn);
      }

      const editBtn = document.createElement('span');
      editBtn.textContent = '编辑模型';
      editBtn.style.cssText = 'font-size:9px;cursor:pointer;color:rgba(255,255,255,0.5);padding:1px 4px;border-radius:3px';
      editBtn.onclick = () => {
        currentId = p.id;
        saveCurrentId(currentId);
        fillEditor(p);
        rebuildPool();
        setTimeout(() => modelInput.focus(), 50);
        nameEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      actions.appendChild(editBtn);

      const delBtn = document.createElement('span');
      delBtn.textContent = '删除';
      delBtn.style.cssText = 'font-size:9px;cursor:pointer;color:rgba(255,80,80,0.7);padding:1px 4px;border-radius:3px';
      delBtn.onclick = () => {
        providers = providers.filter(pp => pp.id !== p.id);
        if (currentId === p.id) {
          currentId = providers.length > 0 ? providers[0].id : '';
          saveCurrentId(currentId);
        }
        saveProviders(providers);
        rebuildPool();
        fillEditor(getCurrent() || null);
      };
      actions.appendChild(delBtn);

      row.appendChild(left);
      row.appendChild(actions);
      poolEl.appendChild(row);
    });
  }

  async function testConnection(): Promise<void> {
    const url = urlEl.value.trim();
    const key = keyEl.value.trim();
    if (!url || !key) {
      testBtn.textContent = '⚠ 请先填地址和 Key';
      testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;user-select:none;border:1px solid rgba(255,160,0,0.4);color:rgba(255,160,0,0.9);background:transparent;flex:1;text-align:center`;
      setTimeout(() => { testBtn.style.cssText = btnStyle(c1); testBtn.textContent = '🔗 测试'; }, 2500);
      return;
    }
    testBtn.textContent = '⏳ 测试中...';
    testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:default;user-select:none;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.4);background:transparent;flex:1;text-align:center`;
    try {
      const res = await fetch(url + '/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        testBtn.textContent = '✓ 连接成功';
        testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:default;user-select:none;border:1px solid rgba(0,212,80,0.4);color:rgba(0,212,80,0.9);background:transparent;flex:1;text-align:center`;
      } else {
        testBtn.textContent = `✗ ${res.status} ${res.statusText}`;
        testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:default;user-select:none;border:1px solid rgba(255,80,80,0.4);color:rgba(255,80,80,0.9);background:transparent;flex:1;text-align:center`;
      }
    } catch {
      testBtn.textContent = '✗ 连接失败';
      testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:default;user-select:none;border:1px solid rgba(255,80,80,0.4);color:rgba(255,80,80,0.9);background:transparent;flex:1;text-align:center`;
    }
    setTimeout(() => {
      testBtn.style.cssText = btnStyle(c1);
      testBtn.textContent = '🔗 测试';
    }, 3000);
  }

  return {
    activate(contentEl, card) {
      c1 = card?.accents?.color1 || '#00d4ff';
      c2 = card?.accents?.color2 || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, 'API', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:8px 10px 4px';

      const scrollArea = document.createElement('div');
      scrollArea.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;touch-action:pan-y';

      // === Editor Card ===
      const inner = document.createElement('div');
      inner.style.cssText = `border-radius:10px;padding:10px 12px 12px;margin-top:6px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px`;

      // --- Current Provider Selector ---
      const selRow = document.createElement('div');
      selRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
      const selLabel = document.createElement('div');
      selLabel.textContent = '当前 Provider';
      selLabel.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      selEl = document.createElement('select');
      Object.assign(selEl.style, {
        fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', outline: 'none', flex: '1', minWidth: '0', maxWidth: '200px',
      });
      selEl.onchange = () => {
        currentId = selEl.value;
        saveCurrentId(currentId);
        fillEditor(getCurrent() || null);
        rebuildPool();
      };
      selRow.appendChild(selLabel);
      selRow.appendChild(selEl);
      inner.appendChild(selRow);

      // --- Name ---
      const nr = mkRow('名称');
      nameEl = document.createElement('input');
      nameEl.type = 'text';
      nameEl.placeholder = 'OpenAI';
      Object.assign(nameEl.style, inputStyle());
      nr.inputWrap.appendChild(nameEl);
      inner.appendChild(nr.row);

      // --- API 地址 ---
      const ur = mkRow('API 地址');
      urlEl = document.createElement('input');
      urlEl.type = 'text';
      urlEl.placeholder = 'https://api.openai.com/v1';
      Object.assign(urlEl.style, inputStyle());
      ur.inputWrap.appendChild(urlEl);
      inner.appendChild(ur.row);

      // --- API Key ---
      const kr = mkRow('API Key');
      keyEl = document.createElement('input');
      keyEl.type = 'password';
      keyEl.placeholder = 'sk-...';
      Object.assign(keyEl.style, inputStyle());
      kr.inputWrap.appendChild(keyEl);
      inner.appendChild(kr.row);

      // --- Models ---
      const ml = document.createElement('div');
      ml.textContent = '模型';
      ml.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.75);margin-bottom:4px';
      inner.appendChild(ml);

      modelTagsEl = document.createElement('div');
      modelTagsEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin-bottom:4px;min-height:16px';
      inner.appendChild(modelTagsEl);

      const mar = document.createElement('div');
      mar.style.cssText = 'display:flex;gap:4px;margin-bottom:8px';
      modelInput = document.createElement('input');
      modelInput.type = 'text';
      modelInput.placeholder = '输入模型名，回车添加';
      Object.assign(modelInput.style, { ...inputStyle(), flex: '1', minWidth: '0' });
      modelInput.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); addModel(); }
      };
      const addBtn = document.createElement('span');
      addBtn.textContent = '+';
      addBtn.style.cssText = `font-size:14px;cursor:pointer;color:${c1};padding:2px 8px;border-radius:6px;border:1px solid ${c1}40;flex-shrink:0`;
      addBtn.onclick = addModel;
      mar.appendChild(modelInput);
      mar.appendChild(addBtn);
      inner.appendChild(mar);

      // --- Action Buttons ---
      const ar = document.createElement('div');
      ar.style.cssText = 'display:flex;gap:6px;margin-top:2px';

      const newBtn = document.createElement('div');
      newBtn.textContent = '新建';
      newBtn.style.cssText = btnStyle(c1);
      newBtn.onclick = () => {
        const p: Provider = { id: uid(), name: '', baseUrl: '', apiKey: '', models: [] };
        providers.push(p);
        currentId = p.id;
        saveCurrentId(currentId);
        saveProviders(providers);
        rebuildPool();
        fillEditor(p);
        nameEl.focus();
      };
      ar.appendChild(newBtn);

      const saveBtn = document.createElement('div');
      saveBtn.textContent = '保存';
      saveBtn.style.cssText = btnStyle(c1);
      saveBtn.onclick = () => {
        commitCurrent();
        rebuildPool();
        saveBtn.textContent = '✓ 已保存';
        saveBtn.style.color = 'rgba(0,212,80,0.9)';
        setTimeout(() => { saveBtn.textContent = '保存'; saveBtn.style.color = c1; }, 1500);
      };
      ar.appendChild(saveBtn);

      testBtn = document.createElement('div');
      testBtn.textContent = '🔗 测试';
      testBtn.style.cssText = btnStyle(c1);
      testBtn.onclick = () => { commitCurrent(); testConnection(); };
      ar.appendChild(testBtn);

      inner.appendChild(ar);
      scrollArea.appendChild(inner);

      // === Divider ===
      const dv = document.createElement('div');
      dv.style.cssText = `height:1px;background:linear-gradient(90deg,${c1} 0%,${c2} 100%);margin-top:25px;margin-bottom:10px;flex-shrink:0`;
      scrollArea.appendChild(dv);

      // === Provider Pool Header ===
      const pt = document.createElement('div');
      pt.textContent = 'Provider 池';
      pt.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:6px;flex-shrink:0';
      scrollArea.appendChild(pt);

      poolEl = document.createElement('div');
      poolEl.style.cssText = 'flex-shrink:0';
      scrollArea.appendChild(poolEl);

      // === Init ===
      providers = loadProviders();
      currentId = loadCurrentId();
      if (!currentId && providers.length > 0) {
        currentId = providers[0].id;
        saveCurrentId(currentId);
      }
      rebuildPool();
      fillEditor(getCurrent() || null);

      bodyEl.appendChild(scrollArea);
    },

    deactivate(contentEl) {
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'api',
  icon: '\uD83D\uDD0C',
  name: 'API',
  description: 'API 接入设置',
  kind: 'tool',
  createHandler: createApiHandler,
});
