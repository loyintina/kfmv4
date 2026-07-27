/**
 * orb-panel.ts — AI 对话面板内容构建
 *
 * 从 orb.ts 拆分出 Provider/Session/Model/Role 下拉框的创建与事件绑定。
 * orb.ts 负责光球 UI / 手势 / 状态机，本模块负责面板 DOM 内容。
 */

import { sessionStore } from './session-client.js';
import { createCustomSelect, type CustomSelect } from './custom-select.js';

// ========== 类型 ==========

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
}

export interface PanelConfig {
  /** 面板 DOM 元素 */
  panelEl: HTMLDivElement;
  /** 会话下拉框实例引用（由 buildPanelContent 写入） */
  setOrbSessionSelect: (s: CustomSelect | null) => void;
  /** 读取活跃配置 */
  readActiveConfig: () => Promise<Record<string, string>>;
  /** 写入活跃配置 */
  patchActiveConfig: (patch: Record<string, string>) => Promise<void>;
}

// ========== 面板内容构建 ==========

export function buildPanelContent(cfg: PanelConfig): void {
  const { panelEl, setOrbSessionSelect, readActiveConfig, patchActiveConfig } = cfg;

  const c1 = 'rgba(0,212,255,0.8)';
  const c2 = 'rgba(124,58,237,0.7)';

  panelEl.innerHTML = `
<div class="orb-header-bar" style="
  display:flex;align-items:center;justify-content:space-between;
  padding:8px 14px;flex-shrink:0;
  border-bottom:1px solid rgba(255,255,255,0.06)
">
  <div id="orb-role-select-container"></div>
  <div id="orb-session-select-container"></div>
</div>
<div class="orb-panel-content" style="
  flex:1;overflow-y:auto;padding:12px 14px;min-height:0;touch-action:pan-y
"></div>
<div style="height:1px;flex-shrink:0;margin:0 10px;background:linear-gradient(90deg,${c1},${c2})"></div>
<div class="orb-model-bar" style="
  display:flex;gap:8px;padding:6px 10px;flex-shrink:0
">
  <div id="orb-prov-container" style="flex:1;min-width:0"></div>
  <div id="orb-model-container" style="flex:1;min-width:0"></div>
</div>
  `;

  const base = window.location.pathname.replace(/\/+$/, '') + '/api/';
  let providers: Provider[] = [];

  function saveConfig(): void {
    const provId = provSelect?.getValue() || '';
    const modelId = modelSelect?.getValue() || '';
    patchActiveConfig({ providerId: provId, modelId: modelId });
  }

  let provSelect: CustomSelect | null = null;
  let modelSelect: CustomSelect | null = null;

  async function updateProviderSelect(): Promise<void> {
    if (!provSelect || !modelSelect) return;
    const active = await readActiveConfig();
    const curProv = active.providerId
      ? providers.find((p: Provider) => p.id === active.providerId)
      : undefined;
    provSelect.updateItems(
      providers.map((p: Provider) => ({ label: p.name || p.id, value: p.id })),
      curProv?.id || ''
    );
    if (curProv) {
      modelSelect.updateItems(
        (curProv.models || []).map((m: string) => ({ label: m, value: m })),
        active.modelId || ''
      );
    }
  }

  // --- Role 下拉 ---
  const roleContainer = document.getElementById('orb-role-select-container');
  if (roleContainer) {
    const roleSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '角色', minWidth: 70, maxWidth: 110,
      onSelect: async (roleFile) => {
        await patchActiveConfig({ roleFile });
        window.dispatchEvent(new CustomEvent('kfm-role-change', { detail: { roleId: roleFile } }));
      },
    });
    roleContainer.appendChild(roleSelect.element);
    (async () => {
      let roleFiles: string[] = [];
      try {
        const res = await fetch(base + 'files/list', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '.kfmv4/roles' }),
        });
        const data = await res.json();
        roleFiles = (data.items || []).map((f: { name: string }) => f.name.replace('.json', '')).filter((n: string) => n);
      } catch {}
      const active = await readActiveConfig();
      const currentRole = active.roleFile || (roleFiles[0] || '');
      roleSelect.updateItems(roleFiles.map((n: string) => ({ label: n, value: n })), currentRole);
    })();
    window.addEventListener('kfm-role-change', ((e: CustomEvent) => {
      if (e.detail?.roleId) roleSelect.setValue(e.detail.roleId);
    }) as EventListener);
  }

  // --- Session 下拉 ---
  const sessionContainer = document.getElementById('orb-session-select-container');
  if (sessionContainer) {
    // 新建会话的 + 按钮
    var newBtn = document.createElement('div');
    newBtn.textContent = '+ 新建会话';
    newBtn.style.cssText = 'padding:6px 8px;border-radius:4px;font-size:var(--card-font-size,11px);cursor:pointer;text-align:center;color:rgba(0,212,255,0.85);border-top:1px solid rgba(255,255,255,0.06);margin-top:2px';
    newBtn.onmouseenter = function() { newBtn.style.background = 'rgba(0,212,255,0.1)'; };
    newBtn.onmouseleave = function() { newBtn.style.background = ''; };
    newBtn.onclick = async function(ev) { ev.stopPropagation(); await sessionStore.create(); sessionSelect.updateItems(sessionStore.list.map(function(s) { return { label: s.title, value: s.id }; }), sessionStore.activeId || ''); sessionSelect.panel.style.display = 'none'; };

    var sessionSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '选择会话', minWidth: 80, maxWidth: 120,
      onSelect: function(sessionId) { sessionStore.switchTo(sessionId); },
      footerElement: newBtn,
    });
    sessionContainer.appendChild(sessionSelect.element);
    
    // 初始化时立即更新一次（如果 sessionStore.list 已有数据）
    if (sessionStore.list.length > 0) {
      sessionSelect.updateItems(
        sessionStore.list.map(function(s) { return { label: s.title, value: s.id }; }),
        sessionStore.activeId || sessionStore.list[0]?.id || ''
      );
    }
    setOrbSessionSelect(sessionSelect);
    
    // 订阅 sessionStore 变化，数据加载完成后自动更新下拉栏
    sessionStore.subscribe(() => {
      sessionSelect.updateItems(
        sessionStore.list.map(function(s) { return { label: s.title, value: s.id }; }),
        sessionStore.activeId || ''
      );
    });
  }

  // --- Provider / Model 下拉 ---
  const provSelectContainer = document.getElementById('orb-prov-container') as HTMLDivElement | null;
  const modelSelectContainer = document.getElementById('orb-model-container') as HTMLDivElement | null;
  if (provSelectContainer && modelSelectContainer) {
    provSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '—', minWidth: 80, direction: 'up',
      onSelect: (id) => {
        const p = providers.find((x: Provider) => x.id === id);
        if (!p) return;
        modelSelect?.updateItems((p.models || []).map((m: string) => ({ label: m, value: m })), p.models?.[0] || '');
        saveConfig();
        window.dispatchEvent(new CustomEvent('kfm-provider-change', { detail: { providerId: id, modelId: p.models?.[0] || '' } }));
      },
    });
    provSelectContainer.appendChild(provSelect.element);
    modelSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '—', minWidth: 80, direction: 'up',
      onSelect: (model) => {
        saveConfig();
        window.dispatchEvent(new CustomEvent('kfm-model-change', { detail: { modelId: model } }));
      },
    });
    modelSelectContainer.appendChild(modelSelect.element);
  }

  // --- 加载 providers.json ---
  fetch(base + 'files/read', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.kfmv4/providers.json' }),
  }).then(r => r.json()).then(data => {
    const raw: Array<Record<string, unknown>> = data.content ? JSON.parse(data.content) : [];
    providers = raw.map(p => ({ id: p.id as string, name: p.name as string, baseUrl: p.baseUrl as string, models: p.models as string[] }));
    updateProviderSelect();
  }).catch(() => {});

  // --- 外部事件监听 ---
  window.addEventListener('kfm-provider-change', ((e: CustomEvent) => {
    if (e.detail?.providerId) {
      const p = providers.find((x: Provider) => x.id === e.detail.providerId);
      if (p) {
        provSelect?.setValue(e.detail.providerId);
        modelSelect?.updateItems((p.models || []).map((m: string) => ({ label: m, value: m })), e.detail.modelId || p.models?.[0] || '');
      }
    }
  }) as EventListener);
  window.addEventListener('kfm-model-change', ((e: CustomEvent) => {
    if (e.detail?.modelId) modelSelect?.setValue(e.detail.modelId);
  }) as EventListener);
  window.addEventListener('kfm-config-change', ((e: CustomEvent) => {
    const d = e.detail;
    if (!d) return;
    if (d.providerId) {
      const p = providers.find((x: Provider) => x.id === d.providerId);
      if (p) {
        provSelect?.setValue(d.providerId);
        modelSelect?.updateItems((p.models || []).map((m: string) => ({ label: m, value: m })), d.modelId || p.models?.[0] || '');
      }
    }
    // 同步 sessionStore，保证面板 session 下拉与配置卡一致
    if (d.sessionId && d.sessionId !== sessionStore.activeId) {
      sessionStore.activeId = d.sessionId;
    }
    patchActiveConfig({ providerId: d.providerId || '', modelId: d.modelId || '', sessionId: d.sessionId || '' });
  }) as EventListener);
}
