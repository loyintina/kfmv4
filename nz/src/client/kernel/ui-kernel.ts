/**
 * src/client/kernel/ui-kernel.ts — UI 内核（plugin-contract §1/§2，2026-09-01
 * 宪法 v0 Step 1 落地）。内核=「可替换一切」的担保人：插件注册表+生命周期，
 * 不知道任何具体插件、不知道 React 的存在（React 只是当前适配器）。
 *
 * 契约：UI 插件 = { id, mount(slot, ctx) → handle{unmount} }。
 * ctx v0 只带今天就存在的字段（host/debug）——契约 §2 目标形态的
 * bridge/settings/theme/events 随对应系统落地逐字段扩充，不预造空壳。
 */
export interface UiPluginHandle {
  unmount(): void;
  suspend?(): void;
  resume?(): void;
}
export interface UiPlugin {
  id: string;
  /** 状态机清单路径（契约 §7：词汇表真源，机检锚点） */
  stateMachine: string;
  mount(slot: HTMLElement, ctx: PluginCtx): UiPluginHandle;
}
export interface PluginCtx {
  host: HTMLElement;
  debug: boolean;
}
export interface UiKernel {
  ctx: PluginCtx;
  mount(id: string, plugin: UiPlugin, slot: HTMLElement): UiPluginHandle;
  unmount(id: string): boolean;
  get(id: string): UiPluginHandle | undefined;
  list(): string[];
}

export function createUiKernel(ctx: PluginCtx): UiKernel {
  // 注册表：id → { handle, slot }。unmount 后留痕（tombstone）防
  // 「卸载又同名重挂」静默混淆——重挂请换 id 或先 tombstone 清理。
  const live = new Map<string, { handle: UiPluginHandle; slot: HTMLElement }>();
  return {
    ctx,
    mount(id, plugin, slot) {
      if (live.has(id)) throw new Error(`[ui-kernel] duplicate plugin id: ${id}`);
      const handle = plugin.mount(slot, ctx);
      live.set(id, { handle, slot });
      return handle;
    },
    unmount(id) {
      const rec = live.get(id);
      if (!rec) return false;
      live.delete(id);
      rec.handle.unmount(); // 契约 §2：删干净是插件的责任，内核负责强制调用
      return true;
    },
    get(id) { return live.get(id)?.handle; },
    list() { return [...live.keys()]; },
  };
}
