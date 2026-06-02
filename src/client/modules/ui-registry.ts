/**
 * KFM v4 — UI Element Registry
 *
 * 被动索引（黄页），不存储业务状态、不监听事件、不启动 rAF。
 * 职责：回答「当前页面上有什么可交互的、可查看的、可调用的」。
 *
 * 设计参见 docs/UI_ELEMENT_REGISTRY_SPEC.md §S（已定稿）。
 *
 * 使用方式：
 *   在模块的 init*() 函数末尾调用：
 *     Registry.registerElement({ id, type, label, ... }, () => getState());
 *   如果元素不需要 state getter（纯静态），可拆分为：
 *     Registry.register({ id, type, label, ... });
 *   如果内容块需要动态生成，调用：
 *     Registry.registerContentGenerator(id, generator);
 *   AI 通过 Registry.snapshot() 获取当前页面描述。
 *   npm run check 通过 MANIFEST 验证确保无遗漏。
 *
 * 推荐使用 registerElement() 便捷方法，它自动配对 register + registerStateGetter，
 * 避免遗漏 state getter 导致 snapshot 返回过期状态。
 */

// ========== 导入 ==========

import { warn } from './debug-assert.js';
import { KFMState } from './state.js';

// ========== 类型定义 ==========

export type UIElementType =
  | 'button'
  | 'text-input'
  | 'floating-button'
  | 'floating-card'
  | 'panel'
  | 'icon';

export type UIElementState =
  | 'collapsed'
  | 'expanded'
  | 'compact'
  | 'active'
  | 'inactive'
  | 'editing'
  | 'focused'
  | 'open'
  | 'opening'
  | 'closed'
  | 'closing'
  | 'visible'
  | 'hidden'
  | 'enabled';

/** 交互层 —— 页面上能点/能交互的 UI 元素 */
export interface InteractiveElement {
  id: string;
  type: UIElementType;
  label: string;
  description: string;
  state?: UIElementState;
  enabled: boolean;
  /** 操作此元素后的预期效果（供 AI 理解操作后果） */
  effect: string;
  /** 引用来源：该元素在哪个模块定义 */
  source?: string;
}

/** 内容层 —— 页面上能看到的信息摘要 */
export interface ContentBlock {
  id: string;
  type: 'file-tree' | 'card-content' | 'text-output' | 'status-bar';
  summary: string;
  /** 详细内容（可选 —— 可能很大，需要单独请求） */
  detail?: string | Record<string, unknown>;
}

/** 能力层 —— AI 可以调用的扩展操作 */
export interface Capability {
  id: string;
  name: string;
  description: string;
  parameters: { name: string; type: string }[];
  entry: string;
}

/** snapshot 输出 —— 三层合并 */
export interface PageDescription {
  elements: InteractiveElement[];
  content: ContentBlock[];
  capabilities: Capability[];
  timestamp: number;
}

// ========== 工具类型 ==========

type StateGetter = () => UIElementState;
type ContentGenerator = () => ContentBlock;

/**
 * 变更回调类型。
 * 当 Registry 内容发生变化时调用，供外部（如 ws-channel）监听变化。
 */
export type RegistryChangeHandler = (changeType: 'register' | 'state-getter' | 'content' | 'content-generator' | 'capability' | 'unregister' | 'state-change', id: string) => void;

// ========== Registry 类 ==========

export class UIElementRegistry {
  private _elements = new Map<string, InteractiveElement>();
  private _stateGetters = new Map<string, StateGetter>();
  private _content = new Map<string, ContentBlock>();
  /** 内容生成器 —— 如果注册了 generator，snapshot 时优先调用它生成实时内容 */
  private _contentGenerators = new Map<string, ContentGenerator>();
  private _capabilities = new Map<string, Capability>();
  private _changeHandlers = new Set<RegistryChangeHandler>();

  /** 注册一个交互元素（由各模块在初始化时调用一次） */
  register(el: InteractiveElement): void {
    if (this._elements.has(el.id)) {
      console.warn(`[ui-registry] 重复注册 UI 元素: ${el.id}，覆盖旧值`);
    }
    this._elements.set(el.id, el);
    this._notifyChange('register', el.id);
  }

  /** 注销（元素不再存在时） */
  unregister(id: string): void {
    this._elements.delete(id);
    this._stateGetters.delete(id);
    this._notifyChange('unregister', id);
  }

  /**
   * 注册一个状态 getter，使 snapshot() 能返回该元素的实时状态。
   * 可选——如果不注册，snapshot() 返回 register() 时传入的静态 state 值。
   */
  registerStateGetter(id: string, getter: StateGetter): void {
    this._stateGetters.set(id, getter);
    this._notifyChange('state-getter', id);
  }

  /**
   * 便捷方法：一次完成 register + registerStateGetter。
   *
   * 大多数交互元素的 state 会在运行时变化，调用此方法可避免忘记配对的 registerStateGetter。
   * 等价于：
   *   Registry.register(el);
   *   Registry.registerStateGetter(el.id, getter);
   *
   * @param el      交互元素定义
   * @param getter  可选的状态 getter。不传则只注册，不设 getter。
   * @returns 元素的 id，方便链式调用
   */
  registerElement(el: InteractiveElement, getter?: StateGetter): string {
    this.register(el);
    if (getter) {
      this.registerStateGetter(el.id, getter);
    }
    return el.id;
  }

  /** 注册内容块（静态） */
  registerContent(block: ContentBlock): void {
    if (this._content.has(block.id)) {
      console.warn(`[ui-registry] 重复注册内容块: ${block.id}，覆盖旧值`);
    }
    this._content.set(block.id, block);
    // 如果已有同 id 的 generator，移除（静态覆盖动态）
    this._contentGenerators.delete(block.id);
    this._notifyChange('content', block.id);
  }

  /**
   * 注册内容生成器（v1.1 扩展）。
   *
   * 与 registerContent 的区别：
   * - registerContent 是一次性注册静态 summary，snapshot 始终返回注册时的值
   * - registerContentGenerator 注册一个回调函数，snapshot 时调用它获取实时内容
   *
   * 如果同一 id 同时有静态内容和生成器，生成器优先。
   */
  registerContentGenerator(id: string, generator: ContentGenerator): void {
    this._contentGenerators.set(id, generator);
    this._notifyChange('content-generator', id);
  }

  /** 注册扩展能力 */
  registerCapability(cap: Capability): void {
    if (this._capabilities.has(cap.id)) {
      console.warn(`[ui-registry] 重复注册能力: ${cap.id}，覆盖旧值`);
    }
    this._capabilities.set(cap.id, cap);
    this._notifyChange('capability', cap.id);
  }

  /**
   * 注册变更回调。
   * 当 Registry 内容（元素/内容/能力）发生变化时，调用 handler。
   * 返回一个取消注册函数。
   */
  onChange(handler: RegistryChangeHandler): () => void {
    this._changeHandlers.add(handler);
    return () => {
      this._changeHandlers.delete(handler);
    };
  }

  /** 获取当前页面的完整描述（AI 主入口） */
  snapshot(): PageDescription {
    const elements = Array.from(this._elements.values()).map(el => {
      const getter = this._stateGetters.get(el.id);
      if (getter) {
        return { ...el, state: getter() };
      }
      // 开发时警告：元素没有注册 state getter，snapshot 可能返回过期状态
      warn(`[ui-registry] "${el.id}" 没有注册 state getter，snapshot() 将返回注册时的静态值。建议注册 getter 或使用 Registry.registerElement()。`);
      return el;
    });

    // 内容层：优先使用生成器（实时），fallback 到静态内容
    // 顺序：先按静态注册顺序排列（生成器覆盖同名静态），再追加仅有生成器的内容块
    const content = Array.from(this._content.entries()).map(([id, block]) => {
      const generator = this._contentGenerators.get(id);
      if (generator) {
        return generator();
      }
      return block;
    });

    // 追加只注册了生成器但没有静态内容的内容块
    for (const [id, generator] of this._contentGenerators) {
      if (!this._content.has(id)) {
        content.push(generator());
      }
    }

    return {
      elements,
      content,
      capabilities: Array.from(this._capabilities.values()),
      timestamp: Date.now(),
    };
  }

  /** 按 id 查询交互元素（返回实时状态） */
  get(id: string): InteractiveElement | undefined {
    const el = this._elements.get(id);
    if (!el) return undefined;
    const getter = this._stateGetters.get(id);
    if (getter) {
      return { ...el, state: getter() };
    }
    return el;
  }

  /** 返回所有已注册的交互元素 id */
  getRegisteredIds(): string[] {
    return Array.from(this._elements.keys());
  }

  /** 返回所有已注册的能力列表 */
  getCapabilities(): Capability[] {
    return Array.from(this._capabilities.values());
  }

  /**
   * 验证 MANIFEST：检查所有列在 MANIFEST 中的 id 是否已注册。
   * 返回缺失的 id 列表（空 = 全部通过）。
   */
  validate(manifest: string[]): string[] {
    const registered = new Set(this._elements.keys());
    return manifest.filter(id => !registered.has(id));
  }

  /**
   * 通知 Registry 某个元素的状态在运行时发生了变化。
   *
   * 各模块在关键状态变化处调用此方法（如侧栏打开/关闭、光球展开/折叠），
   * 触发 onChange 回调，从而让 ws-channel 等监听方自动推送最新 snapshot。
   *
   * @param id 可选。发生状态变化的元素 id，为空时表示通用状态变化。
   */
  notifyStateChange(id?: string): void {
    this._notifyChange('state-change', id ?? '');
  }

  /** 通知所有变更回调 */
  private _notifyChange(changeType: 'register' | 'state-getter' | 'content' | 'content-generator' | 'capability' | 'unregister' | 'state-change', id: string): void {
    for (const handler of this._changeHandlers) {
      try {
        handler(changeType, id);
      } catch (e) {
        console.error('[ui-registry] 变更回调执行失败:', e);
      }
    }
  }
}

/** 全局单例 */
export const Registry = new UIElementRegistry();

// 自动订阅 KFMState 变化：通过 KFMState 的状态变更会触发 Registry 通知，
// 自动推送 snapshot 到服务端（ws-channel）。
// 当前覆盖：KFMState.toggleHidden() → 'eye-btn'、KFMState.setExpanded() → 'file-tree'。
// 不覆盖 GSAP 动画回调中的状态切换和直接 DOM classList 操作——这些路径仍需手动通知。
// 即使覆盖有限，此订阅作为安全网可以确保任何未来新增的 KFMState 驱动变更自动可见。
KFMState.subscribe(() => Registry.notifyStateChange());
