/**
 * KFM v4 — Capability Executor（能力执行引擎）
 *
 * 将 Registry 中注册的能力映射为可执行的函数。
 * 供 AI agent 通过统一接口调用浏览器端注册的能力。
 *
 * 职责：
 *   1. 维护能力名 → 执行函数的映射表
 *   2. 提供统一的 execute(capabilityId, params) 接口
 *   3. 每个能力实际调用服务端现有的 API 端点
 *
 * 设计参见 docs/UI_ELEMENT_REGISTRY_SPEC.md §5.2
 */

import fs from 'fs';
import path from 'path';

// ========== 类型定义 ==========

export interface CapabilityParam {
  name: string;
  type: string;
}

export interface CapabilityDef {
  id: string;
  name: string;
  description: string;
  parameters: CapabilityParam[];
  entry: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  capabilityId: string;
}

// ========== 能力执行器 ==========

export class CapabilityExecutor {
  /** 内置能力映射表（能力 id → 执行函数） */
  private _handlers = new Map<string, (params: Record<string, unknown>) => Promise<ExecutionResult>>();

  constructor() {
    this.registerBuiltin();
  }

  /** 注册内置能力 */
  private registerBuiltin(): void {
    this._handlers.set('file-search', async (params) => {
      const pattern = params.pattern as string;
      const dirPath = params.path as string || process.env.HOME || '/';
      if (!pattern) {
        return { success: false, error: '缺少 pattern 参数', capabilityId: 'file-search' };
      }
      try {
        const resolvedPath = path.resolve(dirPath);
        if (!fs.existsSync(resolvedPath)) {
          return { success: false, error: `目录不存在: ${resolvedPath}`, capabilityId: 'file-search' };
        }
        const results: { name: string; path: string; isDir: boolean }[] = [];
        const searchInDir = (dir: string, depth: number) => {
          if (depth > 5) return; // 限制递归深度
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue; // 跳过隐藏文件
              const fullPath = path.join(dir, entry.name);
              if (entry.name.includes(pattern)) {
                results.push({ name: entry.name, path: fullPath, isDir: entry.isDirectory() });
              }
              if (entry.isDirectory()) {
                searchInDir(fullPath, depth + 1);
              }
            }
          } catch { /* 跳过无权限目录 */ }
        };
        searchInDir(resolvedPath, 0);
        return {
          success: true,
          data: { pattern, path: resolvedPath, matches: results.slice(0, 200) }, // 最多 200 条
          capabilityId: 'file-search',
        };
      } catch (e: any) {
        return { success: false, error: e.message, capabilityId: 'file-search' };
      }
    });

    this._handlers.set('file-read', async (params) => {
      const filePath = params.path as string;
      if (!filePath) {
        return { success: false, error: '缺少 path 参数', capabilityId: 'file-read' };
      }
      try {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
          return { success: false, error: `文件不存在: ${resolvedPath}`, capabilityId: 'file-read' };
        }
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          return { success: false, error: `路径是目录: ${resolvedPath}`, capabilityId: 'file-read' };
        }
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        return {
          success: true,
          data: { path: resolvedPath, size: stat.size, content },
          capabilityId: 'file-read',
        };
      } catch (e: any) {
        return { success: false, error: e.message, capabilityId: 'file-read' };
      }
    });

    this._handlers.set('file-write', async (params) => {
      const filePath = params.path as string;
      const content = params.content as string;
      const append = params.append as boolean || false;
      if (!filePath || content === undefined) {
        return { success: false, error: '缺少 path 或 content 参数', capabilityId: 'file-write' };
      }
      try {
        const resolvedPath = path.resolve(filePath);
        // 确保父目录存在
        const parentDir = path.dirname(resolvedPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        if (append) {
          fs.appendFileSync(resolvedPath, content, 'utf-8');
        } else {
          fs.writeFileSync(resolvedPath, content, 'utf-8');
        }
        return {
          success: true,
          data: { path: resolvedPath, append, size: fs.statSync(resolvedPath).size },
          capabilityId: 'file-write',
        };
      } catch (e: any) {
        return { success: false, error: e.message, capabilityId: 'file-write' };
      }
    });
  }

  /** 注册自定义能力处理器 */
  register(id: string, handler: (params: Record<string, unknown>) => Promise<ExecutionResult>): void {
    this._handlers.set(id, handler);
  }

  /** 执行一个能力 */
  async execute(capabilityId: string, params: Record<string, unknown>): Promise<ExecutionResult> {
    const handler = this._handlers.get(capabilityId);
    if (!handler) {
      return {
        success: false,
        error: `未注册的能力: ${capabilityId}。可用能力: ${[...this._handlers.keys()].join(', ')}`,
        capabilityId,
      };
    }
    try {
      return await handler(params);
    } catch (e: any) {
      return { success: false, error: e.message, capabilityId };
    }
  }

  /** 列出所有已注册的能力定义 */
  listCapabilities(): CapabilityDef[] {
    return [
      {
        id: 'file-search',
        name: '文件搜索',
        description: '在当前目录下搜索文件名匹配的文件',
        parameters: [
          { name: 'pattern', type: 'string' },
          { name: 'path', type: 'string' },
        ],
        entry: 'capability-executor:file-search',
      },
      {
        id: 'file-read',
        name: '读取文件',
        description: '读取指定路径的文件内容',
        parameters: [{ name: 'path', type: 'string' }],
        entry: 'capability-executor:file-read',
      },
      {
        id: 'file-write',
        name: '写入文件',
        description: '写入内容到指定路径的文件（可追加）',
        parameters: [
          { name: 'path', type: 'string' },
          { name: 'content', type: 'string' },
          { name: 'append', type: 'boolean' },
        ],
        entry: 'capability-executor:file-write',
      },
    ];
  }
}

/** 全局单例 */
export const capabilityExecutor = new CapabilityExecutor();
