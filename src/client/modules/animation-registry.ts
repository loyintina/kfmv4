/**
 * KFM v4 - 动画注册中心 (AnimationRegistry)
 *
 * 集中管理所有 GSAP 动画，确保：
 *   1. 同名动画互斥 —— play() 自动 kill 旧 timeline
 *   2. 支持 reverse() 丝滑反向 —— 不会出现动画截断
 *   3. 模块级 scope —— 隔离各模块动画，替代 globalTimeline.clear()
 *   4. 一次性补间 —— to()/fromTo()/set() 轻薄封装
 *   5. killAll() —— 页面切换时一键清理所有动画
 */

import gsap from 'gsap';

// ========== 导出类型（供其他模块使用，避免直接 import gsap） ==========
export type AnimTimeline = gsap.core.Timeline;
export type AnimTween = gsap.core.Tween;
export type AnimTimelineVars = gsap.TimelineVars;
export type AnimTweenVars = gsap.TweenVars;

// ========== 内部类型 ==========

interface AnimEntry {
  name: string;
  tl: gsap.core.Timeline;
}

// ========== 注册中心 ==========

class AnimationRegistryClass {
  private _entries: Map<string, AnimEntry> = new Map();
  private _scopes: Map<string, gsap.core.Timeline> = new Map();

  // ========== 一次性补间（轻薄封装，直接透传 GSAP） ==========

  /** 一次性补间 —— 直接透传 gsap.to()，返回 Tween 供调用方自行管理 */
  to(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.to(target, vars);
  }

  /** fromTo 补间 —— 透传 gsap.fromTo() */
  fromTo(target: gsap.TweenTarget, fromVars: gsap.TweenVars, toVars: gsap.TweenVars): gsap.core.Tween {
    return gsap.fromTo(target, fromVars, toVars);
  }

  /** 瞬设属性 —— 透传 gsap.set() */
  set(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.set(target, vars);
  }

  /** 创建新 timeline —— 透传 gsap.timeline()，供模块自行管理 */
  timeline(vars?: gsap.TimelineVars): gsap.core.Timeline {
    return gsap.timeline(vars);
  }

  /** 清除目标的补间 —— 透传 gsap.killTweensOf() */
  killTweensOf(target: gsap.TweenTarget): void {
    gsap.killTweensOf(target);
  }

  // ========== 模块级 scope（替代 globalTimeline.clear()） ==========

  /**
   * 获取或创建模块级独立 timeline。
   *
   * 所有该模块的动画都应添加到这个 timeline 上：
   *   const ts = anim.scope('tree-render');
   *   ts.to(box, { height: 100 });     // 而非 gsap.to()
   *   ts.add(subTimeline, 0);
   *   ts.clear();                       // 而非 gsap.globalTimeline.clear()
   *
   * 这样 clear() 只影响本模块，不会误杀其他模块的动画。
   */
  scope(name: string): gsap.core.Timeline {
    let tl = this._scopes.get(name);
    if (!tl) {
      tl = gsap.timeline();
      this._scopes.set(name, tl);
    }
    return tl;
  }

  /** 清除 scope 中的所有动画并销毁 */
  clearScope(name: string): void {
    const tl = this._scopes.get(name);
    if (tl) {
      tl.clear();
      this._scopes.delete(name);
    }
  }

  // ========== 命名动画（有状态管理） ==========

  /** 播放命名动画（自动 kill 同名旧动画） */
  play(name: string, tl: gsap.core.Timeline): void {
    this.kill(name);
    this._entries.set(name, { name, tl });
  }

  /** 反向播放命名动画（如果存在且正在运行） */
  reverse(name: string): boolean {
    const entry = this._entries.get(name);
    if (!entry) return false;
    entry.tl.reverse();
    return true;
  }

  /** Kill 指定命名动画 */
  kill(name: string): void {
    const entry = this._entries.get(name);
    if (entry) {
      entry.tl.kill();
      this._entries.delete(name);
    }
  }

  /** Kill 所有命名动画 + 所有 scope */
  killAll(): void {
    for (const [, entry] of this._entries) {
      entry.tl.kill();
    }
    this._entries.clear();
    for (const [, tl] of this._scopes) {
      tl.clear();
    }
    this._scopes.clear();
  }

  /** 检查命名动画是否存在 */
  has(name: string): boolean {
    return this._entries.has(name);
  }
}

export const anim = new AnimationRegistryClass();
