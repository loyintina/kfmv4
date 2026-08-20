/**
 * src/client/main.ts — kfm-nz 客户端入口（骨架期）
 *
 * 骨架期只做一件事：根总线出生 + 自测，bootLog 渲染到页面，
 * 守视（browser-relay snapshot/eval）可直接验证。
 *
 * 8.7.3 接线（№14）：渲染宿主 + 手势分发两件内核件挂 rootCtx，
 * 插件经 ctx.host / ctx.gestures 消费（createContainer / registerGesture）。
 */
import { rootCtx, bootLog, bootCtxSelfTest, isHelloCleaned } from './ctx.js';
import { RenderHost } from './host.js';
import { GestureRegistry } from './gesture.js';

// ========== 内核件接线：宿主给盒子，手势管输入 ==========
const host = new RenderHost();
host.init(document);
rootCtx.provide('host', host);

const gestures = new GestureRegistry();
gestures.attach(document);
rootCtx.provide('gestures', gestures);

function render() {
  const el = document.getElementById('boot-log');
  if (!el) return;
  el.textContent = bootLog.join('\n') + '\n\nhelloCleaned=' + isHelloCleaned();
}

// 总线出生：rootCtx 在 import 时已创建（ctx.ts 模块副作用）
void bootCtxSelfTest().then(() => render());
// bootLog 是异步填充，轮询渲染（骨架期最简，后续换事件驱动）
setInterval(render, 250);

// 供守视 eval 直读
(window as unknown as Record<string, unknown>).__kfmNz = { rootCtx, bootLog, isHelloCleaned, host, gestures };
