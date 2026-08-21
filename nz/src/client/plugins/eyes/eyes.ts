/**
 * src/client/plugins/eyes/eyes.ts — 眼睛总插件（№5：触发 / 段序 / MD 外壳 /
 * 写盘 / 失败降级）。
 *
 * 眼睛 = 把系统状态投影成动态文件 eyes.md，供 prompt 装配线每轮拼接
 * （装配线 8.11.3 才存在——本步验收只验投影内容正确，「真消费者有效」
 * 留 8.11.3，边界已入档）。
 *
 * 投影格式（v8 珍贵设计保留）：每段 = MD 语义外壳（给 AI 语义引导）+
 * YAML 数据内核（精确数据）+ source 审计字段（数据从哪来的）。
 *
 * 触发：骨架期挂 'eyes/refresh-requested' 公开触发口 + 段注册即刷新；
 * tool/finished、snapshot/updated 等真触发等生产者（8.11.x）落地后改挂。
 *
 * 失败降级：段 collect 抛错 → 该段写占位不抛——眼睛不阻断工具循环。
 * 卸载遗言（№5 新立）：unload 时最后写一次「眼睛已关闭」占位——发射类
 * 收不回，但补偿性遗言防止 AI 把过期视力当最新。
 */
import { Context } from 'cordis';

declare module 'cordis' {
  interface Events {
    /** 投影已刷新（emit 同步观察） */
    'eyes/refreshed'(name: string): void;
    /** 公开触发口：请求刷新投影（骨架期触发；真触发生产者落地后改挂） */
    'eyes/refresh-requested'(): void;
  }
  interface Context {
    /** 眼睛总插件服务：段注册 / 手动刷新 */
    eyes: EyesService;
  }
}

/** 段插件（包内供稿，不对外 provide） */
export interface EyesSection {
  id: string;
  title: string;
  /** 审计字段：数据从哪来的 */
  source: string;
  /** 返回 YAML 数据对象；抛错 = 该段写占位不抛 */
  collect(): unknown;
}

export const EYES_FILE = 'eyes.md';

/** 卸载遗言内容（发射类补偿：防止 AI 把过期视力当最新） */
export const EYES_FAREWELL = '眼睛已关闭（eyes 包已卸载）——本文件是投影不是真相源，以下内容已过期，不要相信它。';

// ========== 极简 YAML 序列化（只服务眼睛投影的数据形：对象/数组/标量） ==========

function yamlScalar(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  // 含特殊字符或多行 → JSON 引用式（YAML 兼容双引号标量）
  return /[:#\n"'{}\[\],&*?|<>=!%@`]/.test(s) ? JSON.stringify(s) : s;
}

export function toYaml(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (Array.isArray(v)) {
    if (v.length === 0) return pad + '[]';
    return v.map((item) => {
      if (item !== null && typeof item === 'object') {
        return pad + '-\n' + toYaml(item, indent + 1);
      }
      return pad + '- ' + yamlScalar(item);
    }).join('\n');
  }
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return pad + '{}';
    return entries.map(([k, val]) => {
      if (val !== null && typeof val === 'object' && (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0)) {
        return pad + k + ':\n' + toYaml(val, indent + 1);
      }
      return pad + k + ': ' + (val !== null && typeof val === 'object' ? (Array.isArray(val) ? '[]' : '{}') : yamlScalar(val));
    }).join('\n');
  }
  return pad + yamlScalar(v);
}

// ========== 总插件服务 ==========

export class EyesService {
  /** 段注册表：插入序 = 段序（登记类，unload 逆序摘） */
  private _sections = new Map<string, EyesSection>();

  constructor(private _ctx: Context) {}

  /** 段注册（包内事务，外部不可见）；重名即抛（单一来源纪律）。
   *  注册即刷新——段落地马上反映到投影。返回 disposer。 */
  registerSection(section: EyesSection): () => void {
    if (this._sections.has(section.id)) {
      throw new Error(`[eyes] 段 ${section.id} 重复注册（单一来源纪律）`);
    }
    this._sections.set(section.id, section);
    this.refresh();
    return () => {
      this._sections.delete(section.id);
    };
  }

  get sectionIds(): string[] {
    return [...this._sections.keys()];
  }

  /** 组装投影并写盘：MD 语义外壳 + YAML 数据内核，逐段 source 审计字段 */
  refresh(): void {
    const dyn = this._ctx.dynFiles;
    if (!dyn) return; // 基建缺失（卸载途中）= 静默不刷，遗言流程兜底
    const parts: string[] = [
      '# 眼睛投影（eyes.md）',
      '',
      '> 投影不是真相源（真相源 = 各 broker 账 / 审计账 / 日志），每轮即弃。',
      `> 生成：${new Date().toISOString()}`,
    ];
    for (const s of this._sections.values()) {
      parts.push('', `## ${s.title}`, '', `source: ${s.source}`, '');
      let data: unknown;
      try {
        data = s.collect();
      } catch (e) {
        // 失败写占位不抛——眼睛不阻断工具循环
        data = { error: `段采集失败（占位）：${(e as Error).message}` };
      }
      parts.push('```yaml', toYaml(data), '```');
    }
    dyn.write(EYES_FILE, parts.join('\n') + '\n');
    this._ctx.emit('eyes/refreshed', EYES_FILE);
  }

  /** 卸载遗言：最后写一次占位（发射类收不回，补偿性遗言） */
  farewell(): void {
    try {
      this._ctx.dynFiles?.write(EYES_FILE, `# 眼睛投影（eyes.md）\n\n> ${EYES_FAREWELL}\n`);
    } catch { /* 遗言失败不阻断卸载 */ }
  }
}

/** 眼睛总插件（bundle 成员，拓扑序首位：段插件 inject 它） */
export function eyesPlugin(ctx: Context): void {
  ctx.inject(['dynFiles'], (ctx) => {
    const svc = new EyesService(ctx);
    ctx.provide('eyes', svc);
    ctx.on('eyes/refresh-requested', () => svc.refresh());
    ctx.effect(() => () => {
      svc.farewell();
    });
  });
}
