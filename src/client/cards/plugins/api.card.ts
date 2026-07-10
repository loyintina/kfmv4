/**
 * api.card.ts — API 接入设置卡
 *
 * 管理 Provider（地址/Key/模型列表）的编辑、测试、选择。
 * 数据存储于 localStorage（kfm-providers / kfm-api-current）。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { log } from '../../modules/logger.js';
interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}
const PROVIDERS_PATH = 'kfmv4/.kfmv4/providers.json';
const STATE_PATH = 'kfmv4/.kfmv4/state.json';

// ====== 持久化（文件优先，localStorage 缓存） ======

// Detect API prefix for nginx reverse proxy support
// When accessed via /kfmv4/, APIs are at /kfmv4/api/... instead of /api/...
const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();
const API_FILES_PREFIX = API_BASE + 'files/';
const API_PROXY = API_BASE + 'proxy/fetch';

async function readFile(path: string): Promise<string | null> {
  try {
    const url = API_FILES_PREFIX + 'read';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.content) { log('[API] readFile OK:', url, 'size:', data.content.length); return data.content; }
    log('[API] readFile: no content for', url);
    return null;
  } catch (e) { log('[API] readFile error:', e); return null; }
}

async function writeFile(path: string, content: string): Promise<void> {
  try {
    const url = API_FILES_PREFIX + 'write';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    const data = await res.json();
    if (data.success) log('[API] writeFile OK:', url, 'size:', content.length);
    else log('[API] writeFile failed:', url, data);
  } catch (e) { log('[API] writeFile error:', e); }
}

async function loadProviders(): Promise<Provider[]> {
  log('[API] loadProviders: reading file');
  const content = await readFile(PROVIDERS_PATH);
  if (content) {
    try {
      const ps: Provider[] = JSON.parse(content);
      localStorage.setItem('kfm-providers', JSON.stringify(ps));
      log('[API] loadProviders: from file, count:', ps.length);
      return ps;
    } catch (e) { log('[API] loadProviders: parse error', e); }
  }
  log('[API] loadProviders: falling back to localStorage');
  try {
    const ls = localStorage.getItem('kfm-providers');
    if (ls) { const ps: Provider[] = JSON.parse(ls); log('[API] loadProviders: from localStorage, count:', ps.length); return ps; }
    log('[API] loadProviders: localStorage also empty');
    return [];
  } catch { log('[API] loadProviders: localStorage parse error'); return []; }
}

async function saveProviders(ps: Provider[]): Promise<void> {
  log('[API] saveProviders: count:', ps.length);
  localStorage.setItem('kfm-providers', JSON.stringify(ps));
  log('[API] saveProviders: localStorage written');
  await writeFile(PROVIDERS_PATH, JSON.stringify(ps, null, 2));
  log('[API] saveProviders: file written');
}

async function loadCurrentId(): Promise<string> {
  log('[API] loadCurrentId: reading file');
  const content = await readFile(STATE_PATH);
  if (content) {
    try {
      const s = JSON.parse(content);
      if (s.currentId) {
        localStorage.setItem('kfm-api-current', s.currentId);
        log('[API] loadCurrentId: from file:', s.currentId);
        return s.currentId;
      }
    } catch (e) { log('[API] loadCurrentId: parse error', e); }
  }
  log('[API] loadCurrentId: falling back to localStorage');
  const id = localStorage.getItem('kfm-api-current') || '';
  log('[API] loadCurrentId:', id || '(empty)');
  return id;
}

async function saveCurrentId(id: string): Promise<void> {
  log('[API] saveCurrentId:', id);
  localStorage.setItem('kfm-api-current', id);
  await writeFile(STATE_PATH, JSON.stringify({ currentId: id }));
  log('[API] saveCurrentId: done');
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ====== DOM 辅助 ======

function inputStyle(): Record<string, string> {
  return {
    fontSize: 'var(--card-font-size, 11px)',
    padding: '0.35em 0.7em',
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
  lbl.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px;width:52px';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex:1;min-width:0';
  row.appendChild(lbl);
  row.appendChild(wrap);
  return { row, inputWrap: wrap };
}

function btnStyle(color: string): string {
  return `padding:0.3em 0.8em;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;user-select:none;border:1px solid ${color}40;color:${color};background:transparent;flex:1;text-align:center`;
}

// ====== Handler ======

function createApiHandler(_meta: Record<string, unknown>): CardContentHandler {
  let providers: Provider[] = [];
  let currentId = '';
  let c1 = '#00d4ff', c2 = '#7c3aed';

  // DOM refs
  let selTriggerEl!: HTMLDivElement;
  let selPanelEl!: HTMLDivElement;
  let selTriggerText!: HTMLSpanElement;
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

  async function commitCurrent(): Promise<void> {
    let cur = getCurrent();
    if (!cur) {
      cur = { id: uid(), name: nameEl.value.trim(), baseUrl: urlEl.value.trim(), apiKey: keyEl.value.trim(), models: [] };
      providers.push(cur);
      currentId = cur.id;
      await saveCurrentId(currentId);
    } else {
      cur.name = nameEl.value.trim();
      cur.baseUrl = urlEl.value.trim();
      cur.apiKey = keyEl.value.trim();
    }
    await saveProviders(providers);
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
      tag.style.cssText = `display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:4px;font-size:var(--card-font-size,10px);background:${c1}20;color:rgba(255,255,255,0.8);margin:2px 4px 2px 0`;
      const label = document.createElement('span');
      label.textContent = m;
      tag.appendChild(label);
      const x = document.createElement('span');
      x.textContent = '×';
      x.style.cssText = 'cursor:pointer;opacity:0.5;font-size:var(--card-font-size,12px);line-height:1;margin-left:2px;padding:0 1px';
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
    const baseUrl = urlEl.value.trim();
    const key = keyEl.value.trim();
    if (!baseUrl || !key) return [];
    try {
      const res = await fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: baseUrl + '/models',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${key}` },
        }),
      });
      const result = await res.json();
      if (!result.ok || !result.data?.data) return [];
      return result.data.data.map((m: { id: string }) => m.id).filter(Boolean);
    } catch { return []; }
  }

  async function addModel(): Promise<void> {
    let cur = getCurrent();
    if (!cur) {
      await commitCurrent();
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
    // Update trigger text
    const cur = getCurrent();
    selTriggerText.textContent = cur?.name || '(无)';

    providers.forEach(p => {
      // Pool row
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;margin-bottom:3px;background:rgba(255,255,255,0.03)';

      const left = document.createElement('div');
      left.style.cssText = 'display:flex;align-items:center;gap:5px;flex:1;min-width:0';

      const dot = document.createElement('span');
      dot.textContent = p.id === currentId ? '◉' : '○';
      dot.style.cssText = `font-size:var(--card-font-size,9px);flex-shrink:0;color:${p.id === currentId ? c1 : 'rgba(255,255,255,0.25)'}`;
      left.appendChild(dot);

      const nm = document.createElement('span');
      nm.textContent = p.name || '(unnamed)';
      nm.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      left.appendChild(nm);

      const cnt = document.createElement('span');
      cnt.textContent = `${p.models.length} 模型`;
      cnt.style.cssText = 'font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.35);flex-shrink:0';
      left.appendChild(cnt);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;align-items:center';

      if (p.id !== currentId) {
        const setBtn = document.createElement('span');
        setBtn.textContent = '设为当前';
        setBtn.style.cssText = `font-size:var(--card-font-size,9px);cursor:pointer;color:${c1};padding:1px 4px;border-radius:3px`;
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
      editBtn.style.cssText = 'font-size:var(--card-font-size,9px);cursor:pointer;color:rgba(255,255,255,0.5);padding:1px 4px;border-radius:3px';
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
      delBtn.style.cssText = 'font-size:var(--card-font-size,9px);cursor:pointer;color:rgba(255,80,80,0.7);padding:1px 4px;border-radius:3px';
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
      testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;user-select:none;border:1px solid rgba(255,160,0,0.4);color:rgba(255,160,0,0.9);background:transparent;flex:1;text-align:center`;
      setTimeout(() => { testBtn.style.cssText = btnStyle(c1); testBtn.textContent = '🔗 测试'; }, 2500);
      return;
    }
    testBtn.textContent = '⏳ 测试中...';
    testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:default;user-select:none;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.4);background:transparent;flex:1;text-align:center`;
    try {
      const res = await fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url + '/models',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${key}` },
        }),
      });
      const result = await res.json();
      if (result.ok) {
        testBtn.textContent = '✓ 连接成功';
        testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:default;user-select:none;border:1px solid rgba(0,212,80,0.4);color:rgba(0,212,80,0.9);background:transparent;flex:1;text-align:center`;
      } else {
        testBtn.textContent = `✗ ${result.status} ${result.data?.error?.message || ''}`;
        testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:default;user-select:none;border:1px solid rgba(255,80,80,0.4);color:rgba(255,80,80,0.9);background:transparent;flex:1;text-align:center`;
      }
    } catch {
      testBtn.textContent = '✗ 连接失败';
      testBtn.style.cssText = `padding:3px 10px;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:default;user-select:none;border:1px solid rgba(255,80,80,0.4);color:rgba(255,80,80,0.9);background:transparent;flex:1;text-align:center`;
    }
    setTimeout(() => {
      testBtn.style.cssText = btnStyle(c1);
      testBtn.textContent = '🔗 测试';
    }, 3000);
  }

  return {
    async activate(contentEl, card) {
      c1 = card?.accents?.color1 || '#00d4ff';
      c2 = card?.accents?.color2 || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, 'API', c1, c2);
      // 加载存储的字号偏好（设在 bodyEl 上，避免 _renderFloatingContent 覆盖 contentEl.style）
      const storedFontSize = localStorage.getItem('kfm-fontsize-api');
      if (storedFontSize) {
        try {
          const parsed = JSON.parse(storedFontSize);
          if (typeof parsed.fontSize === 'number') {
            bodyEl.style.setProperty('--card-font-size', parsed.fontSize + 'px');
          }
        } catch { /* ignore */ }
      }


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
      selLabel.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      selRow.appendChild(selLabel);

      // Custom dropdown trigger
      const selWrapper = document.createElement('div');
      selWrapper.style.cssText = 'position:relative;flex-shrink:0';
      selTriggerEl = document.createElement('div');
      selTriggerEl.style.cssText = 'font-size:var(--card-font-size,11px);padding:0.3em 0.6em;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between';
      selTriggerText = document.createElement('span');
      selTriggerText.textContent = '(无)';
      const selArrow = document.createElement('span');
      selArrow.textContent = '\u25BC';
      selArrow.style.cssText = 'font-size:var(--card-font-size,10px);opacity:0.6;margin-left:4px';
      selTriggerEl.appendChild(selTriggerText);
      selTriggerEl.appendChild(selArrow);

      // Dropdown panel (fixed position, appears below trigger)
      selPanelEl = document.createElement('div');
      selPanelEl.style.cssText = 'position:fixed;z-index:9999;display:none;border-radius:8px;padding:4px;background:rgba(20,16,32,0.96);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);overflow:hidden;min-width:120px';
      bodyEl.appendChild(selPanelEl);

      let panelOpen = false;
      const openPanel = () => {
        selPanelEl.innerHTML = '';
        providers.forEach(p => {
          const item = document.createElement('div');
          const isCur = p.id === currentId;
          item.style.cssText = `padding:5px 8px;border-radius:4px;font-size:var(--card-font-size,11px);cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:${isCur ? c1 : 'rgba(255,255,255,0.8)'}`;
          item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.06)'; };
          item.onmouseleave = () => { item.style.background = ''; };
          const ns = document.createElement('span');
          ns.textContent = p.name || '(unnamed)';
          item.appendChild(ns);
          if (isCur) {
            const ck = document.createElement('span');
            ck.textContent = '✓';
            ck.style.cssText = `font-size:var(--card-font-size,9px);color:${c1}`;
            item.appendChild(ck);
          }
          item.onclick = (ev: PointerEvent) => { ev.stopPropagation(); selectProvider(p.id); };
          selPanelEl.appendChild(item);
        });
        const r = selTriggerEl.getBoundingClientRect();
        selPanelEl.style.left = r.left + 'px';
        selPanelEl.style.top = r.bottom + 'px';
        selPanelEl.style.minWidth = Math.max(r.width, 120) + 'px';
        selPanelEl.style.display = 'block';
        panelOpen = true;
      };
      const closePanel = () => { selPanelEl.style.display = 'none'; panelOpen = false; };
      const selectProvider = (id: string) => {
        currentId = id;
        saveCurrentId(currentId);
        fillEditor(getCurrent() || null);
        rebuildPool();
        closePanel();
      };

      selTriggerEl.onclick = (e: PointerEvent) => {
        e.stopPropagation();
        panelOpen ? closePanel() : openPanel();
      };
      document.addEventListener('pointerdown', (e: PointerEvent) => {
        if (panelOpen && !selPanelEl.contains(e.target as Node) && e.target !== selTriggerEl) {
          closePanel();
        }
      });

      selWrapper.appendChild(selTriggerEl);
      selRow.appendChild(selWrapper);
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
      ml.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);margin-bottom:4px';
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
      addBtn.style.cssText = `font-size:var(--card-font-size,14px);cursor:pointer;color:${c1};padding:0.2em 0.6em;border-radius:6px;border:1px solid ${c1}40;flex-shrink:0`;
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

      // === Provider Pool Card ===
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `border-radius:10px;padding:8px 12px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px`;
      const pt = document.createElement('div');
      pt.textContent = 'Provider 池';
      pt.style.cssText = 'font-size:var(--card-font-size,11px);font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:6px;flex-shrink:0';
      poolCard.appendChild(pt);
      poolEl = document.createElement('div');
      poolEl.style.cssText = 'flex-shrink:0';
      poolCard.appendChild(poolEl);
      scrollArea.appendChild(poolCard);

      log('[API] activate: starting init');
      providers = await loadProviders();
      currentId = await loadCurrentId();
      log('[API] activate: loaded', providers.length, 'providers, current:', currentId);
      if (!currentId && providers.length > 0) {
        currentId = providers[0].id;
        await saveCurrentId(currentId);
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
