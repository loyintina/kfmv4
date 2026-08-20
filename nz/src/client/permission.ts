/**
 * src/client/permission.ts — 安全包影子：权限裁决引擎（契约 №15 影子期）
 *
 * v8《harness 权限引擎设计》8.5.0 影子骨架（src/server/ai/permissions.ts）
 * 的 nz 移植 + 契约化升级。影子期铁律：**只记录不拦截**——所有工具调用
 * 过 evaluate 拿判定，判定全量落审计日志，行为零变化。攒真实破界率基线，
 * 转正期（tool-host №10 落地后）deny/ask 才真生效；cedar-policy 等现成
 * 策略引擎留转正期评估，影子期薄自研。
 *
 * RiskClass 四级（№15 定稿）：
 *   read        → 永不拦
 *   write_local → 路径限定（roots 硬边界内）
 *   exec        → 门控（shell 元字符等）
 *   external    → 审批（外部副作用）
 *
 * 与 v8 的三处 nz 适配：
 *   ①账本：v8 写 Node 文件；nz 在浏览器侧，改内存 append-only 缓冲 +
 *     可注入 sink（转正期接 ledger-service ns=permission-audit）；
 *   ②登记：v8 静态 TOOL_RISK 表；nz 走 declareRisk 动态登记（tool-host
 *   落地后由 registerTool 强制携带，缺登记 = fail-closed）；
 *   ③roots：v8 用 cwd/homedir；nz 显式 roots 列表（宿主基线「不得写出
 *     项目根」留 tool-host，本引擎只管判定）。
 *
 * 留口子（v1 不实现，№15 定稿）：evaluate 收 scope 标签落审计——
 * per-agent 权限档位的数据口子先开，策略后补。
 */

export type RiskClass = 'read' | 'write_local' | 'exec' | 'external';

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
  /** 影子期恒 'shadow'（只记录不拦截）；转正期 'enforce' */
  mode: 'shadow' | 'enforce';
  attended: boolean;
  /** per-agent 档位口子（v1 只记录不裁决） */
  scope?: string;
}

export interface EvaluateInput {
  tool: string;
  params?: Record<string, unknown>;
  attended?: boolean;
  scope?: string;
}

/** shell 元字符（exec 门控依据；v8 同口径） */
const SHELL_META = /[;|&><`$()\n\r]/;

/** 参数摘要（防密钥入日志：只取 path/command/cwd 前 40 字符，剥其余字段） */
function summarize(params: Record<string, unknown>): string {
  const pick = (k: string) => (typeof params[k] === 'string' ? String(params[k]).slice(0, 40) : '');
  return ['path', 'command', 'cwd'].map((k) => (pick(k) ? `${k}=${pick(k)}` : '')).filter(Boolean).join(' ') || '(无参数)';
}

export class PermissionEngine {
  /** 影子期恒 shadow：判定只落日志，永不拦截 */
  readonly mode = 'shadow' as const;

  private _risk = new Map<string, RiskClass>();
  private _roots: string[] = [];
  private _audit: AuditEntry[] = [];
  /** 审计 sink（转正期接 ledger-service；默认内存 append-only） */
  private _sink: ((e: AuditEntry) => void) | null = null;

  // ========== 风险登记（declareRisk = 户口；tool-host 落地后由 registerTool 强制携带） ==========

  /** 登记工具的 RiskClass，返回 disposer（销户）。重名登记即抛（单一来源纪律）。 */
  declareRisk(tool: string, riskClass: RiskClass): () => void {
    if (this._risk.has(tool)) {
      throw new Error(`[permission] 工具 ${tool} 重复登记 RiskClass（单一来源纪律）`);
    }
    this._risk.set(tool, riskClass);
    return () => {
      this._risk.delete(tool);
    };
  }

  /** 未登记 = exec 级（fail-closed 方向：未知 = 不可信） */
  riskClassOf(tool: string): RiskClass {
    return this._risk.get(tool) ?? 'exec';
  }

  declared(tool: string): boolean {
    return this._risk.has(tool);
  }

  /** 在册 RiskClass 登记数（plugtest 快照探针：登记残留 = 本计数 diff） */
  get declaredCount(): number {
    return this._risk.size;
  }

  // ========== roots 硬边界（write_local 判定依据） ==========

  setRoots(roots: string[]): void {
    this._roots = [...roots];
  }

  get roots(): readonly string[] {
    return this._roots;
  }

  private _inRoot(p: string): boolean {
    if (!p) return false;
    if (!p.startsWith('/')) return true; // 相对路径：相对项目根，天然界内
    return this._roots.some((r) => p === r || p.startsWith(r.endsWith('/') ? r : r + '/'));
  }

  // ========== evaluate：判定 + 审计（影子期不拦截） ==========

  evaluate(input: EvaluateInput): Decision {
    const { tool, params = {}, attended = true, scope } = input;
    const rc = this.riskClassOf(tool);
    let decision: Decision;

    if (!this.declared(tool)) {
      decision = { action: 'ask', rule: 'unknown:fail-closed', prompt: `未知工具 ${tool}（未登记 RiskClass）` };
    } else switch (rc) {
      case 'read':
        decision = { action: 'allow', rule: 'risk:read' };
        break;
      case 'write_local': {
        const p = typeof params.path === 'string' ? params.path : '';
        decision = this._inRoot(p)
          ? { action: 'allow', rule: 'write_local:in-root' }
          : { action: 'ask', rule: 'write_local:out-of-root', prompt: `写路径超出 roots 硬边界：${p}` };
        break;
      }
      case 'exec': {
        const cmd = typeof params.command === 'string' ? params.command : '';
        decision = cmd && SHELL_META.test(cmd)
          ? { action: 'ask', rule: 'exec:shell-meta', prompt: `命令含 shell 元字符：${cmd.slice(0, 30)}` }
          : { action: 'allow', rule: 'exec:no-meta' };
        break;
      }
      case 'external':
        decision = { action: 'ask', rule: 'external:approval', prompt: `外部副作用操作：${tool}` };
        break;
    }

    this._appendAudit({
      ts: new Date().toISOString(),
      tool,
      paramsSummary: summarize(params),
      riskClass: rc,
      decision: decision.action,
      rule: decision.rule,
      mode: this.mode,
      attended,
      ...(scope !== undefined ? { scope } : {}),
    });
    return decision;
  }

  // ========== 审计账（append-only；只增不删，影子期的存在意义） ==========

  private _appendAudit(e: AuditEntry): void {
    this._audit.push(e);
    try {
      this._sink?.(e);
    } catch { /* sink 故障不阻断判定 */ }
  }

  /** 审计只读视图（append-only：外部拿不到可写引用） */
  get audit(): readonly AuditEntry[] {
    return this._audit;
  }

  setSink(sink: ((e: AuditEntry) => void) | null): void {
    this._sink = sink;
  }
}

// ========== 插件侧入口（登记 = 效果，回滚白送销户） ==========

declare module 'cordis' {
  interface Context {
    /** 安全包影子：权限裁决引擎（内核服务，main.ts 挂载到 rootCtx） */
    permissions: PermissionEngine;
  }
}

import type { Context } from 'cordis';

/**
 * 工具插件的标准写法：declareToolRisk(ctx, tool, riskClass)——登记进 fiber
 * 效果，插件 unload 时逆序回滚 → RiskClass 自动销户，零注销代码。
 * （tool-host №10 落地后，此入口由 registerTool 内部强制调用。）
 */
export function declareToolRisk(ctx: Context, tool: string, riskClass: RiskClass): void {
  const engine = ctx.permissions;
  if (!engine) throw new Error('[permission] 内核未挂载（rootCtx.provide 缺失）');
  const dispose = engine.declareRisk(tool, riskClass);
  ctx.effect(() => dispose);
}
