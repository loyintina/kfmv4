/**
 * rule-engine.ts — kfmv4 AI 规则引擎
 *
 * 加载 src/server/ai/rules/*.md，解析 frontmatter，
 * 在对话中实时注入约束：
 *   - alwaysApply: true  → 每轮对话注入到 systemPrompt
 *   - condition (正则)   → 工具调用前扫描，匹配则注入 warning
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface AiRule {
  name: string;
  description: string;
  alwaysApply: boolean;
  condition?: RegExp;
  scope: string[];
  content: string;
}

const RULES_DIR = join(process.cwd(), 'src', 'server', 'ai', 'rules');

let _rules: AiRule[] | null = null;

/** 解析 YAML-lite frontmatter（只处理简单 key: value） */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  if (!raw.startsWith('---')) return { meta, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { meta, body: raw };
  const fmLines = raw.slice(3, end).trim().split('\n');
  for (const line of fmLines) {
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim();
    meta[key] = val;
  }
  return { meta, body: raw.slice(end + 4).trim() };
}

/** 加载并缓存所有规则 */
export function loadRules(): AiRule[] {
  if (_rules) return _rules;
  _rules = [];
  try {
    const files = readdirSync(RULES_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const raw = readFileSync(join(RULES_DIR, file), 'utf-8');
      const { meta, body } = parseFrontmatter(raw);
      const name = file.replace(/\.md$/, '');
      const condition = meta['condition'] ? new RegExp(meta['condition']) : undefined;
      const scope = meta['scope']
        ? meta['scope'].split(',').map(s => s.trim())
        : [];
      _rules.push({
        name,
        description: meta['description'] || name,
        alwaysApply: meta['alwaysApply'] === 'true',
        condition,
        scope,
        content: body,
      });
    }
  } catch { /* rules dir absent — no rules */ }
  return _rules;
}

/** 返回所有 alwaysApply 规则的合并文本（注入到 systemPrompt） */
export function buildAlwaysApplyPrompt(): string {
  const rules = loadRules().filter(r => r.alwaysApply);
  if (rules.length === 0) return '';
  return [
    '## 项目规则（必须遵守）',
    '',
    ...rules.map(r => `### ${r.name}\n${r.content}`),
  ].join('\n');
}

/**
 * 检查工具调用是否触发任何条件规则。
 * 返回所有匹配规则的合并 warning 文本（空字符串表示无违规）。
 */
export function checkToolCallRules(toolName: string, params: Record<string, unknown>): string {
  const rules = loadRules().filter(r => !r.alwaysApply && r.condition);
  const warnings: string[] = [];
  const subject = toolName + ' ' + JSON.stringify(params);

  for (const rule of rules) {
    // 检查 scope：如果有 scope 配置，工具名必须匹配其中一个
    if (rule.scope.length > 0) {
      const toolScope = `tool:${toolName}`;
      const inScope = rule.scope.some(s => s === toolScope || s === 'tool:*');
      if (!inScope) continue;
    }
    if (rule.condition!.test(subject)) {
      warnings.push(`[规则警告: ${rule.name}] ${rule.description}\n\n${rule.content}`);
    }
  }
  return warnings.join('\n\n---\n\n');
}

/** 热重载规则（开发用） */
export function reloadRules(): void {
  _rules = null;
}
