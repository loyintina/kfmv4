/**
 * config.card.ts — AI 配置卡
 *
 * 管理 Agent 配置组合（Provider + Model + Session）。
 * 类似 API 卡结构：顶部选择器 + 配置表单 + 池列表。
 * 数据存储于 .kfmv4/configs/ 文件夹。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { log } from '../../modules/logger.js';
import { createCustomSelect, type CustomSelect } from '../../modules/custom-select.js';
import { showConfirm } from '../../modules/confirm-dialog.js';

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

interface Session {
  id: string;
  title: string;
  manuallyNamed?: boolean;
  createdAt: string;
  updatedAt: string;
  providerId?: string;
  modelId?: string;
  messages: Array<{ role: string; text: string; reasoning?: string }>;
}

interface AgentConfig {
  id: string;
  providerId: string;
  modelId: string;
  sessionId: string;
  roleFile?: string;
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS_PATH = '.kfmv4/providers.json';
const CONFIGS_PATH = '.kfmv4/configs';
const SESSIONS_PATH = '.kfmv4/sessions';
const ACTIVE_PATH = '.kfmv4/active.json';

// ====== API 基础 ======

const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();

async function readFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(API_BASE + 'files/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    return data.content || null;
  } catch (e) { log('[config] 读取文件失败: ' + (e instanceof Error ? e.message : String(e))); return null; }
}

async function writeFile(path: string, content: string): Promise<void> {
  try {
    await fetch(API_BASE + 'files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
  } catch (e) { log('[Config] writeFile error:', e); }
}

async function listDir(dir: string): Promise<string[]> {
  try {
    const res = await fetch(API_BASE + 'files/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir }),
    });
    const data = await res.json();
    return (data.items || []).map((f: { name: string }) => f.name);
  } catch (e) { log('[config] 列出目录失败: ' + (e instanceof Error ? e.message : String(e))); return []; }
}

// ====== 数据操作 ======

async function loadProviders(): Promise<Provider[]> {
  const content = await readFile(PROVIDERS_PATH);
  if (content) {
    try { return JSON.parse(content); } catch (e) { log('[config] 解析 providers 失败: ' + (e instanceof Error ? e.message : String(e))); }
  }
  return [];
}

async function loadSessions(): Promise<Session[]> {
  const files = await listDir(SESSIONS_PATH);
  const sessions: Session[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await readFile(`${SESSIONS_PATH}/${file}`);
    if (content) {
      try {
        const session = JSON.parse(content);
        if (session.id && session.title) {
          sessions.push(session);
        }
      } catch (e) { log('[config] 解析 session 失败: ' + (e instanceof Error ? e.message : String(e))); }
    }
  }
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return sessions;
}

async function loadConfigs(): Promise<AgentConfig[]> {
  const files = await listDir(CONFIGS_PATH);
  const configs: AgentConfig[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await readFile(`${CONFIGS_PATH}/${file}`);
    if (content) {
      try {
        const config = JSON.parse(content);
        const name = file.replace('.json', '');
        // id 始终等于文件名
        configs.push({ ...config, id: name, _fileName: name });
      } catch (e) { log('[config] 解析配置失败: ' + (e instanceof Error ? e.message : String(e))); }
    }
  }
  configs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return configs;
}

async function saveConfig(config: AgentConfig, fileName: string): Promise<void> {
  const { providerId, modelId, sessionId, roleFile, createdAt, updatedAt } = config;
  await writeFile(`${CONFIGS_PATH}/${fileName}.json`, JSON.stringify({ id: fileName, providerId, modelId, sessionId, roleFile, createdAt, updatedAt }, null, 2));
}

async function deleteConfigFile(fileName: string): Promise<void> {
  await fetch(API_BASE + 'files/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: `${CONFIGS_PATH}/${fileName}.json` }),
  }).catch((e) => { log('[config] 删除配置文件失败: ' + (e instanceof Error ? e.message : String(e))); });
}

async function renameConfigFile(oldName: string, newName: string): Promise<void> {
  await fetch(API_BASE + 'files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: `${CONFIGS_PATH}/${oldName}.json`, newName: `${newName}.json` }),
  }).catch((e) => { log('[config] 重命名配置文件失败: ' + (e instanceof Error ? e.message : String(e))); });
}

async function loadActiveConfigFileName(): Promise<string> {
  const content = await readFile(ACTIVE_PATH);
  if (content) {
    try {
      const data = JSON.parse(content);
      return data.configFile || '';
    } catch (e) { log('[config] 解析活跃配置失败: ' + (e instanceof Error ? e.message : String(e))); }
  }
  return '';
}

async function saveActiveConfigFileName(fileName: string): Promise<void> {
  // merge 模式：读 → 更新 configFile → 写
  let current: Record<string, string> = {};
  const content = await readFile(ACTIVE_PATH);
  if (content) {
    try { current = JSON.parse(content); } catch (e) { log('[config] 解析活跃配置失败: ' + (e instanceof Error ? e.message : String(e))); }
  }
  current.configFile = fileName;
  await writeFile(ACTIVE_PATH, JSON.stringify(current));
}

async function saveActiveConfigField(key: string, value: string): Promise<void> {
  let current: Record<string, string> = {};
  const content = await readFile(ACTIVE_PATH);
  if (content) {
    try { current = JSON.parse(content); } catch (e) { log('[config] 解析活跃配置失败: ' + (e instanceof Error ? e.message : String(e))); }
  }
  current[key] = value;
  await writeFile(ACTIVE_PATH, JSON.stringify(current));
}

async function readActiveConfigAll(): Promise<Record<string, string>> {
  const content = await readFile(ACTIVE_PATH);
  if (content) {
    try { return JSON.parse(content); } catch (e) { log('[config] 解析活跃配置失败: ' + (e instanceof Error ? e.message : String(e))); }
  }
  return {};
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ====== DOM 辅助 ======

function inputStyle(): string {
  return 'font-size:var(--card-font-size,11px);padding:0.35em 0.7em;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex:1;min-width:0';
}

function btnStyle(accent: string): string {
  return `padding:0.3em 0.8em;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;user-select:none;border:1px solid ${accent}40;color:${accent};background:transparent;flex:1;text-align:center`;
}

function mkRow(label: string): { row: HTMLElement; wrap: HTMLElement } {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;margin-bottom:6px';
  
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5);flex-shrink:0;margin-right:8px;width:52px';
  lbl.textContent = label;
  
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex:1;min-width:0';
  
  row.appendChild(lbl);
  row.appendChild(wrap);
  return { row, wrap };
}

// ====== 卡片处理器 ======

function createConfigHandler(meta: Record<string, unknown>): CardContentHandler {
  let providers: Provider[] = [];
  let sessions: Session[] = [];
  let configs: AgentConfig[] = [];
  let currentConfigId = '';
  let editingConfig: AgentConfig | null = null;
  
  // 下拉框实例
  let configSelect: CustomSelect | null = null;
  let provSelect: CustomSelect | null = null;
  let modelSelect: CustomSelect | null = null;
  let sessionSelect: CustomSelect | null = null;

  function getProviderById(id: string): Provider | undefined {
    return providers.find(p => p.id === id);
  }

  function getSessionById(id: string): Session | undefined {
    return sessions.find(s => s.id === id);
  }

  function getCurrentConfig(): AgentConfig | null {
    return configs.find(c => c.id === currentConfigId) || null;
  }

  return {
    async activate(contentEl, card, reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, 'AI 配置', c1, c2);
      
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto';
      
      // 并行加载数据
      const [providersResult, sessionsResult, configsResult, activeConfigFile] = await Promise.all([
        loadProviders(),
        loadSessions(),
        loadConfigs(),
        loadActiveConfigFileName(),
      ]);
      providers = providersResult;
      sessions = sessionsResult;
      configs = configsResult;
      const activeConfig = configs.find(c => (c as AgentConfig & { _fileName: string })._fileName === activeConfigFile);
      currentConfigId = activeConfig?.id || '';
      
      // 如果没有配置，创建默认配置
      if (configs.length === 0) {
        const defaultConfig: AgentConfig = {
          id: '主会话',
          providerId: providers[0]?.id || '',
          modelId: providers[0]?.models?.[0] || '',
          sessionId: sessions[0]?.id || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const defaultName = '主会话';
        configs.push({ ...defaultConfig, _fileName: defaultName } as AgentConfig & { _fileName: string });
        await saveConfig(defaultConfig, defaultName);
        currentConfigId = defaultConfig.id;
        await saveActiveConfigFileName(defaultName);
      }
      
      if (!currentConfigId) {
        const first = configs[0] as AgentConfig & { _fileName: string };
        currentConfigId = first.id;
        await saveActiveConfigFileName(first._fileName);
      }
      
      // 配置表单（内卡样式）
      const formSection = document.createElement('div');
      formSection.style.cssText = `border-radius:10px;padding:8px 12px;margin-top:6px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column;max-height:70vh`;
      
      // 顶部选择器（自定义下拉，在卡片内部）
      const { row: configRow, wrap: configWrap } = mkRow('配置');
      configSelect = createCustomSelect({
        accent: c1,
        placeholder: '选择配置',
        minWidth: 100,
        onSelect: async (id) => {
          currentConfigId = id;
          const cfg = configs.find(c => c.id === id) as (AgentConfig & { _fileName: string }) | undefined;
          if (cfg) {
            await saveActiveConfigFileName(cfg._fileName || '');
            await saveActiveConfigField('providerId', cfg.providerId);
            await saveActiveConfigField('modelId', cfg.modelId);
            await saveActiveConfigField('sessionId', cfg.sessionId);
            if (cfg.roleFile) await saveActiveConfigField('roleFile', cfg.roleFile);
          }
          fillEditor(getCurrentConfig());
          renderPoolList(poolListEl, c1, c2);
        },
      });
      const formScroll = document.createElement('div');
      formScroll.style.cssText = 'flex:1;overflow-y:auto;min-height:0';
      configWrap.appendChild(configSelect.element);
      formScroll.appendChild(configRow);
      
      // 名称
      const { row: nameRow, wrap: nameWrap } = mkRow('名称');
      const nameInput = document.createElement('input');
      nameInput.id = 'config-name-input';
      nameInput.style.cssText = inputStyle();
      nameInput.placeholder = '配置名称';
      nameWrap.appendChild(nameInput);
      formScroll.appendChild(nameRow);
      
      // Provider（自定义下拉）
      const { row: provRow, wrap: provWrap } = mkRow('Provider');
      provSelect = createCustomSelect({
        accent: c1,
        placeholder: '选择 Provider',
        minWidth: 100,
        onSelect: async (id) => {
          const prov = getProviderById(id);
          if (prov?.models?.length && modelSelect) {
            modelSelect.updateItems(prov.models.map(m => ({ label: m, value: m })), prov.models[0]);
          }
          // 写入 active.json（merge 模式）
          await saveActiveConfigField('providerId', id);
          window.dispatchEvent(new CustomEvent('kfm-provider-change', { detail: { providerId: id, modelId: prov?.models?.[0] || '' } }));
        },
      });
      provWrap.appendChild(provSelect.element);
      formScroll.appendChild(provRow);
      
      // Model（自定义下拉）
      const { row: modelRow, wrap: modelWrap } = mkRow('Model');
      modelSelect = createCustomSelect({
        accent: c1,
        placeholder: '选择 Model',
        minWidth: 100,
        onSelect: async (modelId) => {
          await saveActiveConfigField('modelId', modelId);
          window.dispatchEvent(new CustomEvent('kfm-model-change', { detail: { modelId } }));
        },
      });
      modelWrap.appendChild(modelSelect.element);
      formScroll.appendChild(modelRow);
      
      const { row: sessionRow, wrap: sessionWrap } = mkRow('会话');
      sessionSelect = createCustomSelect({
        accent: c2,
        placeholder: '选择会话',
        minWidth: 100,
        onSelect: (sessionId) => {
          if (editingConfig) {
            editingConfig.sessionId = sessionId;
            // 触发会话变化事件
            window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId } }));
          }
        },
      });
      sessionWrap.appendChild(sessionSelect.element);
      formScroll.appendChild(sessionRow);

      // 操作按钮（在 formSection 内部）
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-shrink:0';

      const saveBtn = document.createElement('button');
      saveBtn.style.cssText = btnStyle(c1);
      saveBtn.textContent = '保存';
      saveBtn.onclick = async () => {
        if (!editingConfig) return;
        const newName = nameInput.value.trim();
        if (!newName) { alert('请输入配置名称'); return; }
        const oldCfg = editingConfig as AgentConfig & { _fileName: string };
        const oldName = oldCfg._fileName || '';
        editingConfig.providerId = provSelect?.getValue() || '';
        editingConfig.modelId = modelSelect?.getValue() || '';
        editingConfig.sessionId = sessionSelect?.getValue() || '';
        editingConfig.updatedAt = new Date().toISOString();
        if (oldName && oldName !== newName) { await renameConfigFile(oldName, newName); }
        await saveConfig(editingConfig, newName);
        const oldId = editingConfig.id;
        editingConfig.id = newName;
        (editingConfig as AgentConfig & { _fileName: string })._fileName = newName;
        if (currentConfigId === oldId) currentConfigId = newName;
        configs = configs.map(c => c.id === oldId ? editingConfig! : c);
        renderPoolList(poolListEl, c1, c2);
        configSelect?.updateItems(configs.map(c => ({ label: (c as AgentConfig & { _fileName: string })._fileName || c.id, value: c.id })), currentConfigId);
        window.dispatchEvent(new CustomEvent('kfm-config-change', { detail: { ...editingConfig, name: newName } }));
      };

      const newBtn = document.createElement('button');
      newBtn.style.cssText = btnStyle(c2);
      newBtn.textContent = '新建';
      newBtn.onclick = async () => {
        const newName = '新配置';
        const newConfig: AgentConfig = { id: newName, providerId: providers[0]?.id || '', modelId: providers[0]?.models?.[0] || '', sessionId: sessions[0]?.id || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const configWithName = { ...newConfig, _fileName: newName } as AgentConfig & { _fileName: string };
        configs.unshift(configWithName);
        await saveConfig(newConfig, newName);
        currentConfigId = newConfig.id;
        await saveActiveConfigFileName(newName);
        fillEditor(configWithName);
        renderPoolList(poolListEl, c1, c2);
        configSelect?.updateItems(configs.map(c => ({ label: (c as AgentConfig & { _fileName: string })._fileName || c.id, value: c.id })), currentConfigId);
      };

      btnRow.appendChild(saveBtn);
      btnRow.appendChild(newBtn);
      formSection.appendChild(formScroll);
      formSection.appendChild(btnRow);

      bodyEl.appendChild(formSection);

      // 池列表（内卡样式）
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `border-radius:10px;padding:8px 12px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px`;
      
      const poolTitle = document.createElement('div');
      poolTitle.style.cssText = 'font-size:var(--card-font-size,11px);font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:6px';
      poolTitle.textContent = '配置池';
      poolCard.appendChild(poolTitle);
      
      const poolListEl = document.createElement('div');
      poolListEl.style.cssText = 'flex-shrink:0';
      poolCard.appendChild(poolListEl);
      bodyEl.appendChild(poolCard);
      
      // 填充编辑器
      function fillEditor(config: AgentConfig | null): void {
        editingConfig = config;
        if (config) {
          const cfg = config as AgentConfig & { _fileName: string };
          nameInput.value = cfg._fileName || '';
          provSelect?.updateItems(providers.map(p => ({ label: p.name || p.id, value: p.id })), config.providerId);
          const prov = getProviderById(config.providerId);
          modelSelect?.updateItems((prov?.models || []).map(m => ({ label: m, value: m })), config.modelId);
          sessionSelect?.updateItems(sessions.map(s => ({ label: s.title, value: s.id })), config.sessionId);
        } else {
          nameInput.value = '';
          provSelect?.updateItems(providers.map(p => ({ label: p.name || p.id, value: p.id })), '');
          modelSelect?.updateItems([], '');
          sessionSelect?.updateItems(sessions.map(s => ({ label: s.title, value: s.id })), '');
        }
      }
      
      // 渲染池列表
      function renderPoolList(listEl: HTMLElement, c1: string, c2: string): void {
        listEl.innerHTML = '';

        if (configs.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:10px 0';
          empty.textContent = '暂无配置';
          listEl.appendChild(empty);
          return;
        }

        for (const config of configs) {
          const item = document.createElement('div');
          item.style.cssText = `padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s;position:relative`;

          if (config.id === currentConfigId) {
            item.style.background = `linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box`;
            item.style.borderColor = 'transparent';
          }

          const titleRow = document.createElement('div');
          titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
          
          const title = document.createElement('div');
          title.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
          const cfgName = (config as AgentConfig & { _fileName: string })._fileName || config.id;
          title.textContent = cfgName;
          
          const delBtn = document.createElement('span');
      delBtn.textContent = '\u2715';
          delBtn.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:12px;color:rgba(255,100,100,0.6);cursor:pointer';
          
          delBtn.onmouseenter = () => { delBtn.style.color = 'rgba(255,100,100,1)'; };
          delBtn.onmouseleave = () => { delBtn.style.color = 'rgba(255,100,100,0.6)'; };
          delBtn.onclick = async (e: MouseEvent) => {
            e.stopPropagation();
            const confirmed = await showConfirm({
              title: '删除配置',
              message: `确定删除配置「${cfgName}」？`,
              accent: c1,
              accent2: c2,
              confirmText: '删除',
              cancelText: '取消',
            });
            if (confirmed) {
              await deleteConfigFile(cfgName);
              configs = configs.filter(c => c.id !== config.id);
              if (currentConfigId === config.id) {
                currentConfigId = configs[0]?.id || '';
                const firstCfg = configs[0] as (AgentConfig & { _fileName: string }) | undefined;
                if (firstCfg?._fileName) await saveActiveConfigFileName(firstCfg._fileName);
                fillEditor(getCurrentConfig());
              }
              renderPoolList(listEl, c1, c2);
              configSelect?.updateItems(configs.map(c => ({ label: (c as AgentConfig & { _fileName: string })._fileName || c.id, value: c.id })), currentConfigId);
            }
          };
          
          titleRow.appendChild(title);
          titleRow.appendChild(delBtn);
          
          const metaRow = document.createElement('div');
          metaRow.style.cssText = 'display:flex;gap:8px;font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.4)';
          
          const prov = getProviderById(config.providerId);
          const provLabel = document.createElement('span');
          provLabel.textContent = prov?.name || config.providerId;
          
          const modelLabel = document.createElement('span');
          modelLabel.textContent = config.modelId;
          
          metaRow.appendChild(provLabel);
          metaRow.appendChild(modelLabel);
          
          item.appendChild(titleRow);
          item.appendChild(metaRow);
          
          item.onmouseenter = () => {
            if (config.id !== currentConfigId) {
              item.style.background = 'rgba(255,255,255,0.06)';
            }
          };
          item.onmouseleave = () => {
            if (config.id !== currentConfigId) {
              item.style.background = 'rgba(255,255,255,0.03)';
            }
          };
          item.onclick = async () => {
            currentConfigId = config.id;
            // 激活预设：展开写入 active.json
            const cfg = config as AgentConfig & { _fileName: string };
            await saveActiveConfigFileName(cfg._fileName || '');
            await saveActiveConfigField('providerId', config.providerId);
            await saveActiveConfigField('modelId', config.modelId);
            await saveActiveConfigField('sessionId', config.sessionId);
            if (config.roleFile) await saveActiveConfigField('roleFile', config.roleFile);
            window.dispatchEvent(new CustomEvent('kfm-config-change', { detail: { ...config, name: cfg._fileName } }));
            fillEditor(config);
            renderPoolList(listEl, c1, c2);
            configSelect?.updateItems(configs.map(c => ({ label: (c as AgentConfig & { _fileName: string })._fileName || c.id, value: c.id })), currentConfigId);
          };
          
          listEl.appendChild(item);
        }
      }

      // 初始化：优先显示 active.json 实时值，而非预设文件的旧值
      const current = getCurrentConfig();
      const av = await readActiveConfigAll();
      const displayConfig: AgentConfig = current
        ? { ...current, providerId: av.providerId || current.providerId, modelId: av.modelId || current.modelId, sessionId: av.sessionId || current.sessionId, roleFile: av.roleFile || current.roleFile }
        : { id: '', providerId: av.providerId || '', modelId: av.modelId || '', sessionId: av.sessionId || '', roleFile: av.roleFile || '', createdAt: '', updatedAt: '' };
      fillEditor(displayConfig);
      renderPoolList(poolListEl, c1, c2);
      
      // 监听外部会话变化
      const onSessionChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.sessionId) {
          // 更新当前配置的会话
          if (editingConfig) {
            editingConfig.sessionId = detail.sessionId;
            sessionSelect?.setValue(detail.sessionId);
          }
        }
        // 重新加载会话列表
        loadSessions().then(s => {
          sessions = s;
          sessionSelect?.updateItems(sessions.map(s => ({ label: s.title, value: s.id })), editingConfig?.sessionId || '');
        });
      };
      window.addEventListener('kfm-session-change', onSessionChange);

      // 监听面板的 Provider 变化
      const onProviderChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.providerId) {
          if (editingConfig) {
            editingConfig.providerId = detail.providerId;
            editingConfig.modelId = detail.modelId || '';
            provSelect?.setValue(detail.providerId);
            const prov = getProviderById(detail.providerId);
            if (prov?.models?.length) {
              modelSelect?.updateItems(prov.models.map(m => ({ label: m, value: m })), detail.modelId || prov.models[0]);
            }
          }
        }
      };
      window.addEventListener('kfm-provider-change', onProviderChange);

      // 监听面板的 Model 变化
      const onModelChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.modelId) {
          if (editingConfig) {
            editingConfig.modelId = detail.modelId;
            modelSelect?.setValue(detail.modelId);
          }
        }
      };
      window.addEventListener('kfm-model-change', onModelChange);
    },

    deactivate(contentEl) {
      // 清理下拉框实例
      configSelect?.destroy();
      provSelect?.destroy();
      modelSelect?.destroy();
      sessionSelect?.destroy();
      configSelect = null;
      provSelect = null;
      modelSelect = null;
      sessionSelect = null;
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'config',
  icon: '\u2699\uFE0F',
  name: '配置',
  description: 'AI 配置管理',
  kind: 'tool',
  createHandler: createConfigHandler,
});
