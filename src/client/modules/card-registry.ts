/**
 * card-registry.ts — 卡片注册表
 *
 * 三层架构的数据核心：
 *   1. 静态类型声明 — registerCardType()
 *   2. 运行时实例追踪 — CardRegistry 类
 *   3. AI 工具层预留 — getAll() 供 Registry snapshot 读取
 *
 * 设计文档：docs/design/CARD_REGISTRY_SPEC.md
 */

import { log } from './logger.js';

// ========== 类型定义 ==========

export interface CardTypeDef {
  typeId: string;
  icon: string;
  name: string;
  description: string;
  kind: 'tool' | 'file';
  createHandler: (meta: Record<string, unknown>) => CardContentHandler;
}

export interface CardContentHandler {
  activate(contentEl: HTMLElement, card: CardInstance, reason: 'init' | 'compact'): void | Promise<void>;
  deactivate(contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss'): void;
}

export interface CardInstance {
  instanceId: string;
  typeId: string;
  el: HTMLElement;
  contentEl: HTMLElement;
  accents: { color1: string; color2: string };
  meta: Record<string, unknown>;
  createdAt: number;
}

// ========== 类型注册表 ==========

const _typeDefs = new Map<string, CardTypeDef>();

export function registerCardType(def: CardTypeDef): void {
  if (_typeDefs.has(def.typeId)) {
    log('[warn] [card-registry] 重复注册卡片类型: ' + def.typeId);
  }
  _typeDefs.set(def.typeId, def);
}

export function getCardType(typeId: string): CardTypeDef | undefined {
  return _typeDefs.get(typeId);
}

export function getAllCardTypes(): CardTypeDef[] {
  return [..._typeDefs.values()];
}

// ========== 运行时实例注册表 ==========

/** UUID v4 生成（替代 crypto.randomUUID，兼容旧浏览器） */
function _uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

class CardRegistry {
  private _instances = new Map<string, CardInstance>();
  private _byContentEl = new WeakMap<HTMLElement, CardInstance>();
  private _idPools = new Map<string, Set<number>>();

  /** 创建卡片实例（由 floating-card.ts 调用） */
  createInstance(
    typeId: string,
    el: HTMLElement,
    contentEl: HTMLElement,
    accents: { color1: string; color2: string },
  ): CardInstance {
    const instance: CardInstance = {
      instanceId: _uuid(),
      typeId,
      el,
      contentEl,
      accents,
      meta: {},
      createdAt: Date.now(),
    };
    this._instances.set(instance.instanceId, instance);
    this._byContentEl.set(contentEl, instance);
    return instance;
  }

  /** 销毁卡片实例（由 floating-card.ts 调用） */
  destroyInstance(instanceId: string): void {
    const inst = this._instances.get(instanceId);
    if (inst) {
      this._byContentEl.delete(inst.contentEl);
      this._instances.delete(instanceId);
    }
  }

  /** 按 instanceId 查询 */
  getInstance(instanceId: string): CardInstance | undefined {
    return this._instances.get(instanceId);
  }

  /** 按 contentEl 查询（内容处理器用） */
  getInstanceByContentEl(el: HTMLElement): CardInstance | undefined {
    return this._byContentEl.get(el);
  }

  /** 全部活跃实例 */
  getAll(): CardInstance[] {
    return [...this._instances.values()];
  }

  /** 按类型筛选 */
  getByType(typeId: string): CardInstance[] {
    return this.getAll().filter(i => i.typeId === typeId);
  }

  /** 在指定池中分配最小可用编号 */
  allocId(pool: string): number {
    let ids = this._idPools.get(pool);
    if (!ids) { ids = new Set(); this._idPools.set(pool, ids); }
    let id = 1;
    while (ids.has(id)) id++;
    ids.add(id);
    log('cr allocId pool=' + pool + ' result=' + id + ' used=' + [...ids].join(','));
    return id;
  }

  /** 在指定池中释放编号 */
  freeId(pool: string, id: number): void {
    this._idPools.get(pool)?.delete(id);
    const used = this._idPools.get(pool);
    log('cr freeId pool=' + pool + ' id=' + id + ' remaining=' + (used ? [...used].join(',') : 'none'));
  }

  /** 当前活跃实例数 */
  get count(): number { return this._instances.size; }
}

export const cardRegistry = new CardRegistry();
