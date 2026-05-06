/**
 * KFM v4 - AbortController (generational token)
 *
 * 替代手动 root !== capturedRoot 检查。
 * 每次 rebuildTree() 调用 cancel() 递增 generation，
 * 所有 async 动画函数持有 start() 返回的 token，
 * 在 async 恢复点调用 isCancelled(token) 即可安全中止。
 */

export class AbortController {
  private _generation = 0;

  /** 开始新的操作世代，返回令牌 */
  start(): number {
    return this._generation;
  }

  /** 取消当前世代（递增 generation） */
  cancel(): void {
    this._generation++;
  }

  /** 检查令牌是否已被取消 */
  isCancelled(token: number): boolean {
    return token !== this._generation;
  }
}

/** 共享单例：文件树 rebuildTree 每次调用时 cancel() */
export const treeAbort = new AbortController();
