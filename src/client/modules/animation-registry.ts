/**
 * KFM v4 - 动画注册中心 (AnimationRegistry)
 *
 * GSAP 的统一 import 口 + 轻薄透传封装（ADR-004 裁决二后重新定位）：
 *   1. 一次性补间 —— to()/fromTo()/set()/timeline() 直透 GSAP，调用方自行管理
 *   2. killTweensOf() 直透 —— 官方用法，需要停动画时直接调它
 *   3. scope() —— 按需的模块级 timeline 隔离
 *      （现仅 tree-render 单租户；不是必须走的机制，新模块默认用直透即可）
 *
 * 已删除的历史声称（240dbcf）：play() 同名互斥、reverse() 丝滑反向、
 * killAll() 页面切换一键清理——这些机制已不存在，勿再按旧注释使用。
 */

import gsap from 'gsap';

// ========== 导出类型（供其他模块使用，避免直接 import gsap） ==========
export type AnimTimeline = gsap.core.Timeline;
export type AnimTween = gsap.core.Tween;

// ========== 注册中心 ==========

class AnimationRegistryClass {
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

  // ========== 模块级 scope（按需隔离，非必经机制） ==========

  /**
   * 获取或创建模块级独立 timeline（现仅 tree-render 单租户）。
   *
   * 适用场景：模块需要一把 clear() 清掉自己的整组动画、且不想误杀别人时：
   *   const ts = anim.scope('tree-render');
   *   ts.to(box, { height: 100 });
   *   ts.clear();   // 只影响本 scope
   *
   * 不需要整组清理的模块请直接用 to()/killTweensOf() 直透（官方用法）。
   */
  scope(name: string): gsap.core.Timeline {
    let tl = this._scopes.get(name);
    if (!tl) {
      tl = gsap.timeline();
      this._scopes.set(name, tl);
    }
    return tl;
  }

}

export const anim = new AnimationRegistryClass();
