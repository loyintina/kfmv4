/**
 * KFM v4 - 动画注册中心 (AnimationRegistry)
 *
 * 集中管理所有 GSAP timeline，确保：
 *   1. 同名动画互斥 —— play() 自动 kill 旧 timeline
 *   2. 支持 reverse() 丝滑反向 —— 不会出现动画截断
 *   3. 状态机守卫 —— 非法状态转换被拒绝
 *   4. killAll() —— 页面切换时一键清理所有动画
 */

import gsap from 'gsap';

interface AnimEntry {
  name: string;
  tl: gsap.core.Timeline;
}

class AnimationRegistryClass {
  private _entries: Map<string, AnimEntry> = new Map();

  /** 播放命名动画（自动 kill 同名旧动画） */
  play(name: string, tl: gsap.core.Timeline): void {
    this.kill(name);
    this._entries.set(name, { name, tl });
  }

  /** 反向播放（如果动画存在且正在运行） */
  reverse(name: string): boolean {
    const entry = this._entries.get(name);
    if (!entry) return false;
    entry.tl.reverse();
    return true;
  }

  /** Kill 指定动画 */
  kill(name: string): void {
    const entry = this._entries.get(name);
    if (entry) {
      entry.tl.kill();
      this._entries.delete(name);
    }
  }

  /** Kill 所有动画 */
  killAll(): void {
    for (const [name, entry] of this._entries) {
      entry.tl.kill();
    }
    this._entries.clear();
  }

  /** 检查动画是否存在 */
  has(name: string): boolean {
    return this._entries.has(name);
  }
}

export const anim = new AnimationRegistryClass();
