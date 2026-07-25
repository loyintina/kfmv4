/**
 * page-state.ts — 「眼睛」动态页面状态文件
 *
 * 把浏览器持续推上来的 PageDescription（ws-server._latestSnapshot）渲染成
 * MUD/文字冒险风格的「房间描述」markdown，写入 .kfmv4/page-state.md。
 *
 * 这个文件是普通文件——角色卡把它列进 promptFiles 即获得「眼睛」，不列则无。
 * 服务端每轮 LLM 调用前重组 system 时重读它 → AI 看到工具执行后的最新页面。
 *
 * 三段式（对齐文字游戏）：你在哪里 / 你能看到什么 / 你能做什么。
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';
import type { WsServer } from '../ws-server.js';

export const PAGE_STATE_PATH = join(KFM_DATA_DIR, 'page-state.md');

interface Element {
  id: string; type: string; label: string; description: string;
  state?: string; enabled: boolean; effect: string;
}
interface Content { id: string; type: string; summary: string; }
interface Capability { id: string; name: string; description: string; parameters: { name: string; type: string }[]; }

function asStr(v: unknown): string { return typeof v === 'string' ? v : ''; }
function asBool(v: unknown): boolean { return v === true; }

/** 从 unknown snapshot 安全提取三层数组。 */
function parseSnapshot(snap: unknown): { elements: Element[]; content: Content[]; capabilities: Capability[] } {
  const empty = { elements: [], content: [], capabilities: [] };
  if (!snap || typeof snap !== 'object') return empty;
  const s = snap as Record<string, unknown>;
  const elements: Element[] = Array.isArray(s['elements']) ? s['elements'].map((e): Element => {
    const o = (e && typeof e === 'object') ? e as Record<string, unknown> : {};
    return {
      id: asStr(o['id']), type: asStr(o['type']), label: asStr(o['label']),
      description: asStr(o['description']), state: asStr(o['state']) || undefined,
      enabled: asBool(o['enabled']), effect: asStr(o['effect']),
    };
  }) : [];
  const content: Content[] = Array.isArray(s['content']) ? s['content'].map((c): Content => {
    const o = (c && typeof c === 'object') ? c as Record<string, unknown> : {};
    return { id: asStr(o['id']), type: asStr(o['type']), summary: asStr(o['summary']) };
  }) : [];
  const capabilities: Capability[] = Array.isArray(s['capabilities']) ? s['capabilities'].map((c): Capability => {
    const o = (c && typeof c === 'object') ? c as Record<string, unknown> : {};
    const params = Array.isArray(o['parameters']) ? o['parameters'].map((p) => {
      const po = (p && typeof p === 'object') ? p as Record<string, unknown> : {};
      return { name: asStr(po['name']), type: asStr(po['type']) };
    }) : [];
    return { id: asStr(o['id']), name: asStr(o['name']), description: asStr(o['description']), parameters: params };
  }) : [];
  return { elements, content, capabilities };
}

/** 渲染成 MUD 风格房间描述。 */
export function renderPageState(snap: unknown): string {
  const { elements, content, capabilities } = parseSnapshot(snap);
  const lines: string[] = [];
  lines.push('# 当前页面状态（你的眼睛）');
  lines.push('');
  lines.push('> 本节由系统在每次工具调用后自动刷新，反映你的操作对页面的实际影响。');
  lines.push('');

  // 你能看到什么 —— 内容层摘要
  lines.push('## 你能看到什么');
  if (content.length === 0) {
    lines.push('（页面暂无可读内容摘要）');
  } else {
    for (const c of content) {
      lines.push(`- **${c.type}**：${c.summary || '(无摘要)'}`);
    }
  }
  lines.push('');

  // 当前元素 —— 交互层
  lines.push('## 当前页面元素');
  if (elements.length === 0) {
    lines.push('（页面暂无可交互元素）');
  } else {
    for (const e of elements) {
      const st = e.state ? ` [${e.state}]` : '';
      const dis = e.enabled ? '' : ' （禁用）';
      const eff = e.effect ? ` — 操作后：${e.effect}` : '';
      lines.push(`- **${e.label || e.id}**（${e.type}）${st}${dis}${eff}`);
    }
  }
  lines.push('');

  // 你能做什么 —— 能力层
  lines.push('## 你能做什么');
  if (capabilities.length === 0) {
    lines.push('（当前无额外可调用能力）');
  } else {
    for (const c of capabilities) {
      const params = c.parameters.length > 0
        ? '（' + c.parameters.map(p => `${p.name}:${p.type}`).join(', ') + '）'
        : '';
      lines.push(`- \`${c.name}\`${params} — ${c.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * 从 wsServer 读最新 snapshot，渲染并写入 page-state.md。
 * 工具执行后 + 每轮组装前调用。无连接/无快照时写占位，避免旧内容误导。
 */
export function refreshPageState(wsServer: WsServer): void {
  try {
    const snap = wsServer.getLatestSnapshot();
    const md = snap
      ? renderPageState(snap)
      : '# 当前页面状态（你的眼睛）\n\n> 暂无页面快照（浏览器未连接或未推送状态）。';
    writeFileSync(PAGE_STATE_PATH, md, 'utf-8');
  } catch (e) {
    console.error('[page-state] 写入失败:', e instanceof Error ? e.message : e);
  }
}
