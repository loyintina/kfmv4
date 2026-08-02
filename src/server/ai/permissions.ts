/**
 * permissions.ts — harness 权限引擎（8.5.0 骨架：RiskClass 映射 + evaluate + 审计日志）
 *
 * 设计：docs/active/harness-permission-engine.md（8.5 主战场）。
 * 8.5.0 = 影子模式：所有工具调用过 evaluate，判定 + 落审计日志，不拦截
 * （建立真实使用的破界率基线）；8.5.1 审批通道 + fail-closed 正式生效。
 *
 * RiskClass（124 臂实验依据见设计文档 §2）：
 *   read        → 永不 gate
 *   write_local → 路径限定（会话工作区内）
 *   exec        → 门控（bash/浏览器自动化——做事通道，与破界正相关）
 *   external    → 审批/无人拒绝（服务重启等外部副作用）
 */
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ToolContext } from './tools/types.js';

export type RiskClass = 'read' | 'write_local' | 'exec' | 'external';

/** 工具 → RiskClass 映射（8.5.0 定稿，加新工具必须在此登记——见 infra 契约） */
export const TOOL_RISK: Record<string, RiskClass> = {
  // 读类：永不 gate
  read: 'read',
  glob: 'read',
  grep: 'read',
  web_search: 'read',
  'kfm-logs': 'read',
  // 写类：路径限定 + 询问（8.5.1 起）
  write: 'write_local',
  edit: 'write_local',
  todo: 'write_local',
  checkpoint: 'write_local',
  rewind: 'write_local',
  // 执行类：门控（做事通道）
  bash: 'exec',
  eval: 'exec',
  browser: 'exec',
  browser_eval: 'exec',
  debug: 'exec',
  // 外部副作用类：审批/无人拒绝
  'kfm-restart': 'external',
};

/** shell 元字符拦截（8.5.2 完整白名单，8.5.0 先记录判定） */
const SHELL_META = /[;|&><`$()\n\r]/;

export type Decision =
  | { action: 'allow'; rule: string }
  | { action: 'deny'; rule: string; reason: string }
  | { action: 'ask'; rule: string; prompt: string };

export interface AuditEntry {
  ts: string;
  tool: string;
  paramsSummary: string;
  riskClass: RiskClass;
  decision: 'allow' | 'deny' | 'ask';
  rule: string;
  mode: 'attended' | 'unattended';
  cwd: string;
}

const AUDIT_PATH = process.env.KFM_AUDIT_PATH || join(homedir(), '.kfmv4', 'permission-audit.jsonl'); // 测试可用 KFM_AUDIT_PATH 重定向，防污染史官账本

export function riskClassOf(tool: string): RiskClass {
  return TOOL_RISK[tool] || 'exec'; // 未知工具默认 exec 级（fail-closed 方向）
}

/** 参数摘要（防密钥入日志：只取 path/command 前 40 字符，剥敏感字段） */
function summarize(params: Record<string, unknown>): string {
  const pick = (k: string) => (typeof params[k] === 'string' ? String(params[k]).slice(0, 40) : '');
  return ['path', 'command', 'cwd'].map(k => (pick(k) ? `${k}=${pick(k)}` : '')).filter(Boolean).join(' ') || '(无参数)';
}

/**
 * evaluate — 工具执行前判定（8.5.0 影子模式：判定 + 审计，不拦截）
 * 8.5.1 起：deny/ask 真正生效（审批通道接入后）。
 */
export function evaluate(
  tool: string,
  params: Record<string, unknown>,
  ctx: ToolContext,
  opts: { shadow: boolean } = { shadow: true },
): Decision {
  const rc = riskClassOf(tool);
  const mode: 'attended' | 'unattended' = (ctx as { mode?: 'attended' | 'unattended' }).mode || 'attended';
  const cwd = ctx.cwd || '';
  let decision: Decision;

  // 未登记工具：fail-closed（8.5.0 先 ask 记录；未知=不可信）
  if (!(tool in TOOL_RISK)) {
    decision = { action: 'ask', rule: 'unknown:fail-closed', prompt: `未知工具 ${tool}（未登记 RiskClass）` };
  } else switch (rc) {
    case 'read':
      decision = { action: 'allow', rule: 'risk:read' };
      break;
    case 'write_local': {
      // 路径作用域检查（8.5.2 完整 roots；8.5.0 记录判定）
      const p = typeof params.path === 'string' ? params.path : '';
      const inRoot = p.startsWith('.') || p.startsWith(cwd) || p.startsWith(homedir());
      decision = inRoot
        ? { action: 'allow', rule: 'write_local:in-root' }
        : { action: 'ask', rule: 'write_local:out-of-root', prompt: `写路径超出工作区：${p}` };
      break;
    }
    case 'exec': {
      const cmd = typeof params.command === 'string' ? params.command : '';
      if (cmd && SHELL_META.test(cmd)) {
        decision = { action: 'ask', rule: 'exec:shell-meta', prompt: `bash 命令含元字符：${cmd.slice(0, 30)}` };
      } else {
        decision = { action: 'allow', rule: 'exec:no-meta' };
      }
      break;
    }
    case 'external':
      decision = { action: 'ask', rule: 'external:approval', prompt: `外部副作用操作：${tool}` };
      break;
    default:
      decision = { action: 'ask', rule: 'unknown:fail-closed', prompt: `未知工具 ${tool}` };
  }

  // 影子模式：ask/deny 记录但不拦截；8.5.1 起按 opts.shadow=false 真正生效
  logAudit({ ts: new Date().toISOString(), tool, paramsSummary: summarize(params), riskClass: rc, decision: decision.action, rule: decision.rule, mode, cwd });
  return decision;
}

function logAudit(e: AuditEntry): void {
  try {
    mkdirSync(join(homedir(), '.kfmv4'), { recursive: true });
    appendFileSync(AUDIT_PATH, JSON.stringify(e) + '\n');
  } catch { /* 审计日志不可写不阻断工具执行 */ }
}
