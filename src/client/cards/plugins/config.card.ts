/**
 * config.card.ts — AI 配置卡
 *
 * 管理 Agent 配置组合（Provider + Model + 角色 + 行为预设）。
 * sessionId 是运行参数（每次调用不同），不绑配置——运行时传入。
 * 类似 API 卡结构：顶部选择器 + 配置表单 + 池列表。
 * 数据存储于 .kfmv4/agents/configs/ 文件夹。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { log } from '../../modules/logger.js';
import { createCustomSelect, type CustomSelect } from '../../modules/custom-select.js';
import { showConfirm } from '../../modules/confirm-dialog.js';
import { innerCardStyle, inputStyle, btnStyle, mkRow, flashSaved } from '../card-ui.js';

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

interface AgentConfig {
  id: string;
  providerId?: string; // 可选：空 = 用默认（active.json / 首选项）
  modelId?: string;
  roleFile?: string;
  paradigmFile?: string; // 范式包引用（.kfmv4/agents/paradigms/<name>.md，可选）
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS_PATH = '.kfmv4/providers.json';
const CONFIGS_PATH = '.kfmv4/agents/configs';
const PARADIGMS_PATH = '.kfmv4/agents/paradigms';
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
  const { providerId, modelId, roleFile, paradigmFile, createdAt, updatedAt } = config;
  await writeFile(`\${CONFIGS_PATH}/\${fileName}.json`, JSON.stringify({ id: fileName, providerId, modelId, roleFile, paradigmFile, createdAt, updatedAt }, null, 2));
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

// ====== 卡片处理器 ======

function createConfigHandler(meta: Record<string, unknown>): CardContentHandler {
  // 2026-08-09 用户拍板：配置组功能无实际作用（面板直接读写 active.json，
  // Provider/Model/角色/会话各有独立卡），清空为占位——保留 typeId 注册防断链。
  // 若未来重设计「配置组合」概念（多字段绑定成组、一键切换），在此重建。
  return {
    async activate(contentEl, card, reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, 'AI 配置', c1, c2);
      const box = document.createElement('div');
      box.style.cssText = 'padding:16px;font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.55);line-height:1.7';
      box.innerHTML = `
        <div style="font-weight:700;color:rgba(0,212,255,0.9);margin-bottom:8px">配置组（占位）</div>
        <div>配置组功能已暂停——面板直接读写 active.json，各项设置各有家：</div>
        <ul style="margin:8px 0 0 18px;padding:0">
          <li>Provider / Model → API 卡</li>
          <li>角色 → 角色卡</li>
          <li>会话 → 会话卡</li>
        </ul>
        <div style="margin-top:10px;color:rgba(255,255,255,0.35)">若未来需要「多字段绑定成组、一键切换」的配置组合概念，在此重建。</div>
      `;
      bodyEl.appendChild(box);
    },
    deactivate(contentEl) {
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
