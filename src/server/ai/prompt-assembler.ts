/**
 * prompt-assembler.ts — 服务端 system prompt 组装
 *
 * 架构决策（v7.4 眼睛系统）：
 *   system prompt 不再由客户端 doSend 冻结成字符串发来，而是服务端每轮 LLM
 *   调用前实时重组。数据源是角色卡（.kfmv4/roles/<roleFile>.json）声明的
 *   promptFiles 列表——每轮重读所有文件拼接。
 *
 * 为什么放服务端 + 每轮重组：
 *   - 组装 = 纯文件读取拼接，服务端 fs 直读比客户端 fetch /files/read 更直接。
 *   - 工具执行会改写某些 promptFile（如 page-state.md 记录页面新状态），
 *     每轮重读 → AI 自然看到刷新后的内容（"眼睛"）。无需特殊标记某文件是动态的：
 *     "每轮重组"这一条规则天然覆盖静态文件（内容不变）和动态文件（内容被工具改）。
 *   - 没在 promptFiles 里列 page-state 的角色 → 重组时不含它 → 无眼睛，零影响。
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';
import { sanitizePath } from '../path-utils.js';

interface RoleConfig {
  prompt?: string;
  promptFiles?: string[];
  dynamicPromptFiles?: string[];
}

/** 读取 active.json 中当前激活的 roleFile 名（不含 .json）。 */
export function getActiveRoleFile(): string {
  try {
    const raw = readFileSync(join(KFM_DATA_DIR, 'active.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'roleFile' in parsed) {
      const rf = parsed.roleFile;
      if (typeof rf === 'string') return rf;
    }
  } catch { /* 无配置 */ }
  return '';
}

/** 读取角色卡 JSON。roleFile 是不含 .json 的名字。 */
function loadRole(roleFile: string): RoleConfig | null {
  if (!roleFile || roleFile.includes('/') || roleFile.includes('..')) return null;
  try {
    const raw = readFileSync(join(KFM_DATA_DIR, 'roles', roleFile + '.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      return {
        prompt: typeof p['prompt'] === 'string' ? p['prompt'] : undefined,
        promptFiles: Array.isArray(p['promptFiles'])
          ? p['promptFiles'].filter((f): f is string => typeof f === 'string')
          : [],
        dynamicPromptFiles: Array.isArray(p['dynamicPromptFiles'])
          ? p['dynamicPromptFiles'].filter((f): f is string => typeof f === 'string')
          : [],
      };
    }
  } catch { /* 角色文件不存在或损坏 */ }
  return null;
}

/**
 * 组装角色 system prompt：role.prompt + 每个 promptFile 内容，\n\n 拼接。
 * 每轮 LLM 调用前调用 → 动态文件（如 page-state.md）的最新内容自然进入。
 *
 * promptFiles 路径经 sanitizePath 校验（限制在 SAFE_ROOT 内）。绝对路径若落在
 * SAFE_ROOT（=$HOME）内直接放行；越界路径跳过（安全）。
 */
export function assembleRoleSystemPrompt(roleFile?: string): string {
  const rf = roleFile || getActiveRoleFile();
  const role = loadRole(rf);
  if (!role) return '';
  const parts: string[] = [];
  if (role.prompt) parts.push(role.prompt);
  for (const pf of role.promptFiles || []) {
    const safe = sanitizePath(pf);
    if (!safe || !existsSync(safe)) continue;
    try {
      parts.push(readFileSync(safe, 'utf-8'));
    } catch { /* 读失败跳过该文件 */ }
  }
  return parts.join('\n\n');
}

/**
 * 组装动态反馈 prompt：只读 dynamicPromptFiles（如 page-state.md）。
 * 工具循环每轮调用，内容注入对话末尾（user message），不破坏 system 前缀缓存。
 */
export function assembleDynamicPrompt(roleFile?: string): string {
  const rf = roleFile || getActiveRoleFile();
  const role = loadRole(rf);
  if (!role || !role.dynamicPromptFiles || role.dynamicPromptFiles.length === 0) return '';
  const parts: string[] = [];
  for (const pf of role.dynamicPromptFiles) {
    const safe = sanitizePath(pf);
    if (!safe || !existsSync(safe)) continue;
    try {
      const content = readFileSync(safe, 'utf-8').trim();
      if (content) parts.push(content);
    } catch { /* 读失败跳过 */ }
  }
  return parts.join('\n\n');
}
