/**
 * src/client/host.ts — 渲染宿主：DOM 容器生灭唯一入口（契约 №14）
 *
 * v8 实况是 24 处 document.body 直挂各自为政；9.0 起全项目只有本文件
 * 碰 document.body。三方三分（№14）：
 *   渲染宿主：给盒子（create / 摘除 / 层级）
 *   布局插件：摆盒子（全屏层叠语义，向宿主要容器；№11）
 *   卡片插件：填盒子（盒子里画什么宿主不管）
 *
 * 四设计要件（№14 修订注②，生灭对照表 26 行普查推导）：
 *   1. 按 owner 连带清场（detachByOwner）——灭侧跨文件是 v8 常态模式；
 *   2. 容器绑 owner 生命周期：create 必须经插件 ctx，ctx.effect 白送摘除，
 *      owner 死自动摘（custom-select 泄漏教训）；
 *   3. attach/detach 与 show/hide 分档——真摘除 vs 伪生灭/常驻隐藏；
 *   4. 防重防护下沉宿主：同 owner+slot 重复创建默认摘旧建新，
 *      reuse:true 返回旧 handle——各调用点不再各写 inited 标志。
 */
import type { Context } from 'cordis';

/** 容器类别（№14 生灭对照表归纳；远期 floating 归多端适配包，v1 不立） */
export type ContainerKind = 'layout' | 'persistent' | 'overlay';

export interface ContainerHandle {
  readonly el: HTMLElement;
  readonly kind: ContainerKind;
  readonly owner: string;
  readonly slot: string;
  readonly attached: boolean;
  readonly visible: boolean;
  /** 真摘除：DOM remove + 登记清除（幂等） */
  detach(): void;
  /** 隐藏不摘（伪生灭 / 常驻隐藏档） */
  hide(): void;
  show(): void;
}

export interface CreateOpts {
  kind: ContainerKind;
  /** 槽位名：与 owner 合为防重键 */
  slot: string;
  /** 归属方标识：连带清场的键。必填——匿名容器是漏清场温床 */
  owner: string;
  /** true = 同 owner+slot 返回旧 handle（真常驻）；默认摘旧建新（重建式常驻） */
  reuse?: boolean;
}

/** 层根 z-index 与手势层带对齐：视觉在上层者手势先响应（№14） */
const LAYER_Z: Record<ContainerKind, number> = { layout: 100, persistent: 200, overlay: 300 };
const KINDS: ContainerKind[] = ['layout', 'persistent', 'overlay'];

class Container implements ContainerHandle {
  attached = true;
  visible = true;
  constructor(
    public readonly el: HTMLElement,
    public readonly kind: ContainerKind,
    public readonly owner: string,
    public readonly slot: string,
    private readonly _onDetach: (c: Container) => void,
  ) {}

  detach(): void {
    if (!this.attached) return; // 幂等
    this.attached = false;
    this.el.remove();
    this._onDetach(this);
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  show(): void {
    this.visible = true;
    this.el.style.display = '';
  }
}

export class RenderHost {
  private _doc: Document | null = null;
  private _layers = {} as Record<ContainerKind, HTMLElement>;
  private _bySlot = new Map<string, Container>();
  private _byOwner = new Map<string, Set<Container>>();

  /** 初始化：建三个层根挂 body（全项目唯一 body 入口）。幂等。 */
  init(doc: Document): void {
    if (this._doc) return;
    this._doc = doc;
    for (const kind of KINDS) {
      const layer = doc.createElement('div');
      layer.id = `kfm-layer-${kind}`;
      const s = layer.style;
      s.position = 'fixed';
      s.inset = '0';
      s.zIndex = String(LAYER_Z[kind]);
      doc.body.appendChild(layer);
      this._layers[kind] = layer;
    }
  }

  /** 给盒子：建容器挂到对应层根；ctx.effect 白送摘除（owner 死自动摘） */
  create(ctx: Context, opts: CreateOpts): ContainerHandle {
    if (!this._doc) throw new Error('[host] RenderHost 未 init');
    const key = `${opts.owner}:${opts.slot}`;
    const old = this._bySlot.get(key);
    if (old && old.attached) {
      if (opts.reuse) return old; // 真常驻：返回旧 handle
      old.detach(); // 防重下沉：摘旧建新
    }
    const el = this._doc.createElement('div');
    el.className = `kfm-container kfm-${opts.kind}`;
    el.dataset.kfmOwner = opts.owner;
    el.dataset.kfmSlot = opts.slot;
    this._layers[opts.kind].appendChild(el);

    const container = new Container(el, opts.kind, opts.owner, opts.slot, (c) => this._remove(c));
    this._bySlot.set(key, container);
    let owned = this._byOwner.get(opts.owner);
    if (!owned) this._byOwner.set(opts.owner, (owned = new Set()));
    owned.add(container);

    ctx.effect(() => () => container.detach());
    return container;
  }

  /** 连带清场：摘除某 owner 的全部容器（灭侧跨文件模式的正经入口） */
  detachByOwner(owner: string): number {
    const owned = this._byOwner.get(owner);
    if (!owned) return 0;
    const list = [...owned]; // detach 会改集合，先快照
    for (const c of list) c.detach();
    return list.length;
  }

  /** 登记清除（detach 的内部回调） */
  private _remove(c: Container): void {
    const key = `${c.owner}:${c.slot}`;
    if (this._bySlot.get(key) === c) this._bySlot.delete(key);
    const owned = this._byOwner.get(c.owner);
    if (owned) {
      owned.delete(c);
      if (owned.size === 0) this._byOwner.delete(c.owner);
    }
  }
}

// ========== 插件侧入口（cordis 服务经声明合并，类型安全） ==========

declare module 'cordis' {
  interface Context {
    /** 渲染宿主（内核件，main.ts 挂载到 rootCtx） */
    host: RenderHost;
  }
}

/**
 * 给盒子的插件入口：经调用方插件 ctx 创建，owner 死自动摘。
 * 宿主未挂载（内核未接线）时显式报错，不静默漏清场。
 */
export function createContainer(ctx: Context, opts: CreateOpts): ContainerHandle {
  const host = ctx.host;
  if (!host) throw new Error('[host] 内核未挂载（rootCtx.provide 缺失）');
  return host.create(ctx, opts);
}
