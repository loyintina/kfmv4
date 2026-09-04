/**
 * pool-page.ts — PoolPage 接口 + client 侧池注册表（设计清单 §1.4/§1.5）
 *
 * PoolPage = 9.0 契约 №3 list()/edit(entry)/readonly? 的 nz 版 + nz 追加的
 * 激活双态接口（activeId/activate，只读池不实现）。list() 经统一池数据层
 * （/pool/:pool 路由族），禁自 fetch 文件（P5）。
 *
 * PoolPageRegistry：插件装配期注册，标签行/路由只问注册表——新池=写一个
 * PoolPage 实现+注册一行（「池类可追加」在 client 侧的兑现点）；与 server
 * 侧池描述表同源互证（/pool/list 投影，B 档钉）。
 */

export type PoolId = string; // v0 在册：'basic' | 'provider' | 'prompt' | 'session'

export interface PoolPage<T = unknown> {
  readonly pool: PoolId;
  /** 标签行显示名 */
  readonly title: string;
  /** 系统组只读标记（v0 四池可写；基本池=true 为首用例） */
  readonly readonly?: boolean;
  /** 经统一池数据层取条目集（/pool/:pool），禁自 fetch 文件 */
  list(): Promise<T[]>;
  /** 上配置区载入编辑目标；null=新建草稿（edit 载入不改激活标——P2） */
  edit(entry: T | null): void;
  /** 当前激活条目（读激活总账投影；可读池定义，只读池不实现） */
  activeId?(): Promise<string | null>;
  /** 切换激活（POST /pool/active，激活唯一路径——P2） */
  activate?(id: string): Promise<void>;
}

export class PoolPageRegistry {
  private pages = new Map<PoolId, PoolPage>();

  register(page: PoolPage): void {
    this.pages.set(page.pool, page);
  }

  get(pool: PoolId): PoolPage | undefined {
    return this.pages.get(pool);
  }

  /** 注册顺序即标签行顺序 */
  list(): PoolPage[] {
    return [...this.pages.values()];
  }

  ids(): PoolId[] {
    return this.list().map((p) => p.pool);
  }
}
