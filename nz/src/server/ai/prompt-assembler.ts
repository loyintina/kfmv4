/**
 * prompt-assembler.ts — 角色激活→system 的最小拼装（A2a.5 §三；v8
 * prompt-assembler.ts 123 行的 nz 最小落点：静态 promptFiles 拼接 +
 * 出厂基线；globalPrompts/工具文档/alwaysApply 不搬）。
 *
 * 语义（§3.1）：每次 /ai/chat/start 重读总账+角色文件拼接（nz 无工具循环，
 * 一轮 run 恰一次 LLM 调用；用户改角色文件→下一条消息即生效，零缓存失效）。
 *
 * A2b 留口（§3.5）：assembleDynamicPrompt() 空实现——眼睛机制挂载点在
 * 角色卡 dynamicPromptFiles 字段（config-pool §3.3 已保读写），注入方式
 * （对话尾部 user 消息+包裹文案 BAR-EYE-WRAP-01）随工具循环一并设计。
 */

import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { readActive, poolDir, rolesDir } from '../pool/store.ts';
import { getPool } from '../pool/pools.ts';

/** sanitizePath 最小版（v8 path-utils SAFE_ROOT 同语义，§八⑨适配点）：
 *  绝对路径须落在 $HOME 内（放行区），越界返回 null——调用方跳过不崩。 */
function sanitizePath(p: string): string | null {
  try {
    const abs = resolve(p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
    const root = homedir() + sep;
    return abs.startsWith(root) ? abs : null;
  } catch {
    return null;
  }
}

/** v8 chat.ts:245 出厂基线（ts 前缀声明——nz 简版投影给 user 消息盖 [ts]
 *  前缀但 A1 从未声明，BAR-TS-MIMIC-01 的复读风险在此补上声明半阙） */
const BASELINE_TS_DECLARATION = '用户消息前的 [ts MM-DD HH:MM:SS] 是系统加盖的时间元数据，不是用户说的话的一部分；你的回复从不带这个前缀，也不要模仿或复述它。';

/** 角色 prompt 的文件读取：路径净化后逐个读，单文件失败/越界→跳过不崩（v8 同款） */
function readPromptFile(p: string): string | null {
  const safe = sanitizePath(p);
  if (!safe) return null;
  try {
    const text = readFileSync(safe, 'utf-8');
    return typeof text === 'string' && text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** assembleDynamicPrompt——A2b 眼睛挂载占位（§3.5）：阶段①恒空串。
 *  实现时读角色 dynamicPromptFiles + 包裹文案，注入形态随工具循环设计。 */
function assembleDynamicPrompt(_roleFiles: string[]): string {
  return '';
}

/**
 * 组装 system（每次 /ai/chat/start 调用一次，§3.1）：
 *   角色拼接（role.prompt + promptFiles 逐文件）＋无角色时出厂基线，
 *   \n\n 连接；无内容就不返回 system（v8 systemMessages.length 判空同款——
 *   省 token 且兼容对 system 位置挑剔的端点）。
 * 摘要段位（§3.3）已预留：阶段②在返回值尾部追加「# 此前对话的固化摘要」段。
 */
export function assembleRoleSystemPrompt(): string | null {
  const dir = poolDir();
  const ledger = readActive(dir);
  const roleFile = typeof ledger.roleFile === 'string' ? ledger.roleFile : '';
  const parts: string[] = [];

  if (roleFile) {
    const rolePool = getPool('prompt');
    const role = rolePool?.loadRaw?.(dir, roleFile) ?? null;
    if (role) {
      // v8 语义：role.prompt 字段（nz 池 schema 未收录但 loadRaw merge 语义下
      // kfmv4 实录文件可能在场）拼在最前
      if (typeof role.prompt === 'string' && role.prompt.trim()) parts.push(role.prompt);
      const files = Array.isArray(role.promptFiles) ? (role.promptFiles as string[]) : [];
      for (const f of files) {
        const text = readPromptFile(f);
        if (text) parts.push(text);
      }
      // A2b 眼睛挂载占位：dynamicPromptFiles 阶段①注入恒空
      const dyn = assembleDynamicPrompt(Array.isArray(role.dynamicPromptFiles) ? (role.dynamicPromptFiles as string[]) : []);
      if (dyn) parts.push(dyn);
    }
  }

  if (parts.length === 0) {
    // 无角色/角色缺失/坏文件 → 出厂基线（§3.2）；不注空 system
    parts.push(BASELINE_TS_DECLARATION);
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}

/** roles 目录的绝对定位（promptFiles 相对路径的解析基点；sanitizePath 只放行
 *  $HOME 内，rolesDir 是缺省锚点）。导出供考卷断言拼接来源。 */
export const promptRolesDir = (): string => rolesDir(poolDir());
