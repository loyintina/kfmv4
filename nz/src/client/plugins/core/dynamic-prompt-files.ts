/**
 * src/client/plugins/core/dynamic-prompt-files.ts — prompts/dynamic 目录唯一
 * 管理者（№5 附属基建，8.7.6 眼睛最小包第一件）。
 *
 * 定位：任何插件想往动态 prompt 目录写投影文件，都必须走本服务——眼睛是
 * 第一个客户，未来记忆/待办插件同为发布者。目录有唯一管理者，投影才
 * 不会长成多方乱写的野文件。
 *
 * 骨架期实现 = 内存映射（Map）。服务端/fs 同步留待 server 落地步——
 * 接口按「读写删列 + 变更事件」设计，fs 后端到时换实现不换接口。
 *
 * 三状态归属：本服务的状态 = 文件映射（数据类）；写进的字节属发射类
 * （投影不是真相源，每轮即弃）。卸载清理 = 清空内存映射 + 摘除服务；
 * fs 版落地时此处改「不删盘，只摘服务」（发射类收不回）。
 */
import { Context } from 'cordis';

declare module 'cordis' {
  interface Events {
    /** 动态文件写入（name = 文件名，如 eyes.md） */
    'dynfiles/written'(name: string): void;
    /** 动态文件删除 */
    'dynfiles/deleted'(name: string): void;
  }
  interface Context {
    /** prompts/dynamic 目录唯一管理者 */
    dynFiles: DynamicPromptFiles;
  }
}

/** 文件名纪律：裸文件名（拒路径分隔/逃逸/空名）——投影目录不接受子路径 */
const NAME_RE = /^[\w.-]+$/;

export class DynamicPromptFiles {
  private _files = new Map<string, string>();

  constructor(private _ctx: Context) {}

  private _checkName(name: string): void {
    if (!name || !NAME_RE.test(name) || name.includes('..')) {
      throw new Error(`[dynfiles] 非法文件名：${JSON.stringify(name)}（只接受裸文件名）`);
    }
  }

  write(name: string, content: string): void {
    this._checkName(name);
    this._files.set(name, content);
    this._ctx.emit('dynfiles/written', name);
  }

  read(name: string): string | undefined {
    return this._files.get(name);
  }

  list(): string[] {
    return [...this._files.keys()];
  }

  delete(name: string): void {
    if (this._files.delete(name)) this._ctx.emit('dynfiles/deleted', name);
  }

  get size(): number {
    return this._files.size;
  }

  /** 卸载清理用：清空内存投影（fs 版落地时改不删盘） */
  clear(): void {
    this._files.clear();
  }
}

/** 挂载到传入 ctx（main.ts 挂 rootCtx；考题挂测试 ctx） */
export function mountDynamicPromptFiles(ctx: Context): void {
  const svc = new DynamicPromptFiles(ctx);
  ctx.provide('dynFiles', svc);
  ctx.effect(() => () => {
    svc.clear();
  });
}
