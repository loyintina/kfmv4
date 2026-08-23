/**
 * src/client/main.ts — kfm-nz 客户端入口
 *
 * 8.8.3：刷新即全屏终端——bootLog 不再渲染上屏挡门，URL 带 ?debug 才
 * 显示开屏面板（守视/排障通道不变：__kfmNz eval 直读 bootLog 恒可用）。
 *
 * 8.7.3 接线（№14）：渲染宿主 + 手势分发两件内核件挂 rootCtx，
 * 插件经 ctx.host / ctx.gestures 消费（createContainer / registerGesture）。
 */
import { rootCtx, bootLog, bootCtxSelfTest, isHelloCleaned } from './ctx.js';
import { RenderHost } from './host.js';
import { GestureRegistry } from './gesture.js';
import { CardTypeBroker } from './card-types.js';
import { PermissionEngine } from './permission.js';
import { PlugtestRunner } from './plugtest.js';
import { mountDynamicPromptFiles } from './plugins/core/dynamic-prompt-files.js';
import { applyEyesBundle } from './plugins/eyes/index.js';
import { loadTermCoreShared, probeTermCore } from './term-core.js';
import { applyTermBundle } from './plugins/term/index.js';

// ========== 内核件接线：宿主给盒子，手势管输入，broker 管卡类型户口 ==========
const host = new RenderHost();
host.init(document);
rootCtx.provide('host', host);

const gestures = new GestureRegistry();
gestures.attach(document);
rootCtx.provide('gestures', gestures);

const cardTypes = new CardTypeBroker();
rootCtx.provide('cardTypes', cardTypes);

// 8.7.5 安全包影子（№15）：判定+审计不拦截。
// roots 暂空（fail-closed 方向：绝对路径写一律 ask 落日志）——
// 真实 roots 由 tool-host/配置落地时注入，骨架期不硬编码机器路径。
const permissions = new PermissionEngine();
rootCtx.provide('permissions', permissions);

// 8.7.7 kfm-plugtest 最小版（TASK §2.4）：插件验房师——装/卸/量残留 +
// 重载 + 缺失降级，串行纪律，八错误码机判
const plugtest = new PlugtestRunner({ host, gestures, cardTypes, permissions }, rootCtx);
rootCtx.provide('plugtest', plugtest);

// 8.7.6 眼睛最小包（№5 首个 bundle）：dynamic-prompt-files 基建先挂
// （眼睛 inject 它），再整包 apply；户口登记进验房师（DoD：新插件必过 plugtest）
mountDynamicPromptFiles(rootCtx);
applyEyesBundle(rootCtx);
plugtest.register('eyes', (ctx) => applyEyesBundle(ctx));

// 8.8.3：开屏面板只在 ?debug 时存在意义——无 ?debug 不启轮询渲染
// （bootLog 照常异步填充，守视走 __kfmNz.bootLog eval 直读，不受影响）
const debugOn = /[?&]debug([=&]|$)/.test(location.search);
function render() {
  const el = document.getElementById('boot-log');
  if (!el) return;
  el.textContent = bootLog.join('\n') + '\n\nhelloCleaned=' + isHelloCleaned();
}

// 总线出生：rootCtx 在 import 时已创建（ctx.ts 模块副作用）
if (debugOn) {
  void bootCtxSelfTest().then(() => render());
  // bootLog 是异步填充，轮询渲染（最简实现，后续换事件驱动）
  setInterval(render, 250);
} else {
  void bootCtxSelfTest();
}

// 8.8.2 探针：rio-vt WASM 解析核浏览器侧装载验证（结果进 bootLog + window 供守视直读）
void loadTermCoreShared()
  .then((glue) => { (window as unknown as Record<string, unknown>).__kfmNzTermProbe = probeTermCore(glue); })
  .catch((e) => { (window as unknown as Record<string, unknown>).__kfmNzTermProbe = `PROBE FAIL ${e}`; });

// 8.8.2③c 终端卡真链：WS 桥 ↔ wasm 解析核 ↔ 行级 DOM 渲染壳 ↔ 卡片户口。
// 静态演示（②的 TERM_DEMO）已退役——现在页面上跑的是真 PTY 会话。
applyTermBundle(rootCtx);
plugtest.register('term', (ctx) => applyTermBundle(ctx));
const termCards = rootCtx.get('termCards');
if (termCards) {
  void termCards.open().then((instId) => {
    (window as unknown as Record<string, unknown>).__kfmNzTermCard = instId;
  }).catch((e) => {
    (window as unknown as Record<string, unknown>).__kfmNzTermCard = `OPEN FAIL ${e}`;
  });
}

// 供守视 eval 直读
(window as unknown as Record<string, unknown>).__kfmNz = { rootCtx, bootLog, isHelloCleaned, host, gestures, cardTypes, permissions, plugtest };
