/**
 * src/client/card-types.ts — 卡片类型 broker（契约 №6：9.0 第一个 ctx broker 服务）
 *
 * v8 的 card-registry 两本账只办出生不办死亡，且与 ctx 服务仓库两套机制
 * 管同一件事（插件已卸载、卡类型还在册 → 幽灵入口）。9.0 换思想：
 * **注册 = 登记进 fiber 的效果，注销由回滚机制白送**——插件活着类型在册，
 * 插件卸载 Cordis 逆序回滚，类型自动销户，零注销代码。
 *
 * 三本账分清（№6 防合并谬误）：fiber 表内核私有 / ctx 服务仓库管服务键 /
 * 本 broker 管卡类型集合（卡类型不各自 provide 服务键，集合归 broker 管）。
 *
 * 语义规则（№6 定稿 + 修订注）：
 *   - relied 守卫：类型还有活实例 → disposer 拒绝执行（先关实例再销户）；
 *   - 枚举顺序 = 依赖拓扑序 + name 字典序兜底（两条确定性规则，可复现可断言）；
 *   - singleton 卡类型重复开卡 = 聚焦已有实例，不新建（池卡/主光球用）；
 *   - 实例户口走 serialize 交班：broker reload 时 serialize → 新实例 restore，
 *     户口不随服务生灭清零。
 */
import type { Context } from 'cordis';

export interface CardTypeDef {
  /** 类型 id（唯一，单一来源纪律：重名注册即抛） */
  id: string;
  /** 显示名（兄弟枚举序的字典序兜底键） */
  name: string;
  /** 单例声明：重复开卡聚焦已有实例（默认 false，多实例语义） */
  singleton?: boolean;
  /** 类型级依赖（枚举拓扑序依据：依赖排前） */
  dependsOn?: string[];
}

export interface CardInstance {
  id: string;
  typeId: string;
}

/** 实例户口快照（serialize 交班用；位置等运行时态随 №11 布局扩展） */
export interface CardInstanceSnapshot {
  instances: CardInstance[];
  focusedId: string | null;
}

export class CardTypeBroker {
  private _types = new Map<string, CardTypeDef>();
  private _instances = new Map<string, CardInstance>();
  private _focusedId: string | null = null;
  private _seq = 0;

  // ========== 类型账 ==========

  /** 注册卡类型，返回 disposer（销户）。relied 守卫：有活实例时 disposer 抛错。 */
  registerType(def: CardTypeDef): () => void {
    if (this._types.has(def.id)) {
      throw new Error(`[card-types] 类型 ${def.id} 重复注册（单一来源纪律：同名不二次注册）`);
    }
    this._types.set(def.id, def);
    return () => this._unregisterType(def.id);
  }

  private _unregisterType(typeId: string): void {
    const alive = this.getByType(typeId);
    if (alive.length > 0) {
      throw new Error(`[card-types] 类型 ${typeId} 还有 ${alive.length} 个活实例，先关实例再销户（relied 守卫）`);
    }
    this._types.delete(typeId);
  }

  /** 枚举：依赖拓扑序 + name 字典序兜底（兄弟序与注册/激活时序无关） */
  list(): CardTypeDef[] {
    const result: CardTypeDef[] = [];
    const visited = new Set<string>();
    const visit = (def: CardTypeDef): void => {
      if (visited.has(def.id)) return;
      visited.add(def.id);
      for (const dep of def.dependsOn ?? []) {
        const d = this._types.get(dep);
        if (d) visit(d);
      }
      result.push(def);
    };
    const siblingsByName = [...this._types.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const def of siblingsByName) visit(def);
    return result;
  }

  get(typeId: string): CardTypeDef | undefined {
    return this._types.get(typeId);
  }

  // ========== 实例户口（第二本账收编为服务内部状态） ==========

  /** 开卡：singleton 类型已有活实例 → 聚焦已有不新建 */
  createInstance(typeId: string): CardInstance {
    const def = this._types.get(typeId);
    if (!def) throw new Error(`[card-types] 未注册类型 ${typeId}`);
    if (def.singleton) {
      const existing = this.getByType(typeId)[0];
      if (existing) {
        this._focusedId = existing.id;
        return existing;
      }
    }
    const inst: CardInstance = { id: `ci-${++this._seq}`, typeId };
    this._instances.set(inst.id, inst);
    this._focusedId = inst.id;
    return inst;
  }

  destroyInstance(instanceId: string): void {
    this._instances.delete(instanceId);
    if (this._focusedId === instanceId) this._focusedId = null;
  }

  getByType(typeId: string): CardInstance[] {
    return [...this._instances.values()].filter((i) => i.typeId === typeId);
  }

  get focused(): CardInstance | null {
    return this._focusedId ? (this._instances.get(this._focusedId) ?? null) : null;
  }

  // ========== serialize 交班（reload 时户口不清零） ==========

  serialize(): CardInstanceSnapshot {
    return { instances: [...this._instances.values()], focusedId: this._focusedId };
  }

  restore(snap: CardInstanceSnapshot): void {
    this._instances = new Map(snap.instances.map((i) => [i.id, { ...i }]));
    this._focusedId = snap.focusedId;
    this._seq = snap.instances.reduce((m, i) => {
      const n = Number(i.id.replace('ci-', ''));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
  }

  // ========== broker 自身卸载：全部类型销户（实例户口清零，拓扑序销类型） ==========

  disposeAll(): void {
    this._instances.clear();
    this._focusedId = null;
    for (const def of this.list()) this._unregisterType(def.id);
  }
}

// ========== 插件侧入口（注册 = 效果，回滚白送注销） ==========

declare module 'cordis' {
  interface Context {
    /** 卡片类型 broker（内核服务，main.ts 挂载到 rootCtx） */
    cardTypes: CardTypeBroker;
  }
}

/**
 * 卡插件的标准写法：registerCardType(ctx, def)——注册登记进 fiber 效果，
 * 插件 unload 时逆序回滚 → 注销自动发生，零注销代码。
 */
export function registerCardType(ctx: Context, def: CardTypeDef): void {
  const broker = ctx.cardTypes;
  if (!broker) throw new Error('[card-types] 内核未挂载（rootCtx.provide 缺失）');
  const dispose = broker.registerType(def);
  ctx.effect(() => dispose);
}
