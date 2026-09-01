/**
 * src/client/kernel/react-adapter.tsx — React 适配器（plugin-contract §1
 * 第 3 层「可替换的底座」）：reactMount=createRoot 生命周期桥接；
 * _react-smoke 夹具=契约的活样例+kernel 考卷②的判据（证明 jsx automatic
 * 链与 react-dom 在真 bundle 内端到端可用）。换底座时只动本文件，
 * 内核与各插件脑层不动。
 */
import { createElement, type ComponentType, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { UiPluginHandle } from './ui-kernel.js';

export function reactMount(Comp: ComponentType, slot: HTMLElement, props?: Record<string, unknown>): UiPluginHandle {
  const root: Root = createRoot(slot);
  root.render(createElement(Comp, props) as ReactElement);
  return {
    unmount: () => root.unmount(), // react-dom 卸载=摘 DOM+清 Effect，契约 §2 语义由适配器兜
  };
}

// 冒烟夹具（kernel 考卷专用，非产品 UI）：一个 data-react-smoke 节点。
export const ReactSmoke = (): ReactElement => <div data-react-smoke="1">react-smoke</div>;

export const reactSmokePlugin = {
  id: '_react-smoke',
  mount(slot: HTMLElement): UiPluginHandle {
    return reactMount(ReactSmoke, slot);
  },
};
