/**
 * KFM v4 — UI Element Registry
 *
 * 被动索引（黄页），不存储业务状态、不监听事件、不启动 rAF。
 * 职责：回答「当前页面上有什么可交互的、可查看的、可调用的」。
 *
 * 设计参见 docs/UI_ELEMENT_REGISTRY_SPEC.md §S（已定稿）。
 *
 * 使用方式：
 *   在模块的 init*() 函数末尾调用 Registry.register({...})。
 *   AI 通过 Registry.snapshot() 获取当前页面描述。
 *   npm run check 通过 MANIFEST 验证确保无遗漏。
 */

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
  | 'closed'
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

// ========== Registry 类 ==========

export class UIElementRegistry {
  private _elements = new Map<string, InteractiveElement>();
  private _content = new Map<string, ContentBlock>();
  private _capabilities = new Map<string, Capability>();

  /** 注册一个交互元素（由各模块在初始化时调用一次） */
  register(el: InteractiveElement): void {
    if (this._elements.has(el.id)) {
      console.warn(`[ui-registry] 重复注册 UI 元素: ${el.id}，覆盖旧值`);
    }
    this._elements.set(el.id, el);
  }

  /** 注销（元素不再存在时） */
  unregister(id: string): void {
    this._elements.delete(id);
  }

  /** 注册内容块 */
  registerContent(block: ContentBlock): void {
    if (this._content.has(block.id)) {
      console.warn(`[ui-registry] 重复注册内容块: ${block.id}，覆盖旧值`);
    }
    this._content.set(block.id, block);
  }

  /** 注册扩展能力 */
  registerCapability(cap: Capability): void {
    if (this._capabilities.has(cap.id)) {
      console.warn(`[ui-registry] 重复注册能力: ${cap.id}，覆盖旧值`);
    }
    this._capabilities.set(cap.id, cap);
  }

  /** 获取当前页面的完整描述（AI 主入口） */
  snapshot(): PageDescription {
    return {
      elements: Array.from(this._elements.values()),
      content: Array.from(this._content.values()),
      capabilities: Array.from(this._capabilities.values()),
      timestamp: Date.now(),
    };
  }

  /** 按 id 查询交互元素 */
  get(id: string): InteractiveElement | undefined {
    return this._elements.get(id);
  }

  /** 返回所有已注册的交互元素 id */
  getRegisteredIds(): string[] {
    return Array.from(this._elements.keys());
  }

  /**
   * 验证 MANIFEST：检查所有列在 MANIFEST 中的 id 是否已注册。
   * 返回缺失的 id 列表（空 = 全部通过）。
   */
  validate(manifest: string[]): string[] {
    const registered = new Set(this._elements.keys());
    return manifest.filter(id => !registered.has(id));
  }
}

/** 全局单例 */
export const Registry = new UIElementRegistry();
