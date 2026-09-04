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
import { applySplashBundle } from './plugins/splash/index.js';
import { loadTermCoreShared, probeTermCore } from './term-core.js';
import { applyTermBundle } from './plugins/term/index.js';
import { createUiKernel } from './kernel/ui-kernel.js';
import { reactSmokePlugin } from './kernel/react-adapter.js';
import { createTmuxTabsPlugin } from './plugins/tmux-tabs/index.js';
import { createAiChatPlugin } from './plugins/ai-chat/index.js';

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

// 8.8.5 开屏插件（2026-08-30 用户拍板落地）：动画本体=public/splash-core.js
// 静态资源（唯一真源，demo 同源，服务器 no-cache——覆盖即生效不动 bundle）；
// 壳管 DOM 挂载/唤醒通道/服务。开机自播（?nosplash 关）：intro 时长按
// localStorage 上次实测预测，终端 first-frame 到达=complete() 收口退场；
// ?splash / __kfmNzSplash 可手动重播（基准速度，不挂收口）。
applySplashBundle(rootCtx);
plugtest.register('splash', (ctx) => applySplashBundle(ctx));

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

// ========== UI 内核（plugin-contract §6 Step 1，2026-09-01 宪法 v0） ==========
// 契约 docs/plugin-contract.md：UI 插件 = { id, mount(slot, ctx) → handle }。
// 本步零 UI 变化：只建内核+暴露观测钩子，不自动 mount 任何东西（term 等
// 存量插件仍走各自 apply*Bundle，迁移见宪法 §6 路线）。__kfmNzKernel 供
// kernel 考卷/守视 eval 判卷（mount/unmount/list+React 冒烟夹具）。
const uiKernel = createUiKernel({ host: document.body, debug: debugOn });
(window as unknown as Record<string, unknown>).__kfmNzKernel = {
  mount: uiKernel.mount.bind(uiKernel),
  unmount: uiKernel.unmount.bind(uiKernel),
  list: uiKernel.list.bind(uiKernel),
  plugins: { reactSmoke: reactSmokePlugin },
};

// tmux 标签条（宪法 §6 Step 2 client 侧）：0902 四次仲裁标签=服务器全部
// tmux 会话（会话表轮询），?tmuxSession 参数退役。
// 槽位落 overlay 层（z=300 层系正主，create 自动开回 pointerEvents）——
// 挂 body 会被 layout 层（z=100）整面盖住（tmux-tabs ③考卷实锤）。
const tmuxContainer = host.create(rootCtx, { kind: 'overlay', owner: 'tmux-tabs', slot: 'tmux-tabs' });
uiKernel.mount('tmux-tabs', createTmuxTabsPlugin(), tmuxContainer.el);

// ai-chat（设计 §2.2/§3.0 + 2026-09-04 真机拍板改版）：常驻 orb（右中，唯一
// 开关）+ 滑入式 AI 页 + 全局钉底 composer，槽位同落 overlay 层（tmux-tabs
// 同款教训：挂 body 会被 layout 层整面盖住）。
const aiChatContainer = host.create(rootCtx, { kind: 'overlay', owner: 'ai-chat', slot: 'ai-chat' });
uiKernel.mount('ai-chat', createAiChatPlugin(), aiChatContainer.el);

// ========== 热更自刷（前端腿：build → 页面自动换血，会话靠续命 attach 不断） ==========
// boot 记当前 builtAt，10s 轮询 /build-info.json（build.mjs 每次构建重写），
// 变了 = 新 bundle 已就位 → location.reload()。服务端代码热更走另一腿
// （gate restart-req → supervisor 拉回），两腿解耦。
// 看门狗（2026-08-31 僵尸页实锤：reload 导航撞隧道抖挂起→页面网络栈全瘫、
// WS 悄死、热更失效）：reload 调了但 15s 后页面还活着=导航卡死→重试，
// 至多 3 次（成功则页面已死、定时器随之消失）；3 次都卡=终端 WS 心跳
// 看门狗（bridge onSilentDead）兜底。重试有效已实证：事故当天 CDP 补发
// 一次 location.reload() 即复活。
const BUILD_INFO = '/build-info.json';
void fetch(BUILD_INFO).then((r) => r.json() as Promise<{ builtAt?: string }>).then((info) => {
  const bornAt = info.builtAt ?? '';
  if (!bornAt) return;
  setInterval(() => {
    void fetch(BUILD_INFO, { cache: 'no-store' }).then((r) => r.json() as Promise<{ builtAt?: string }>)
      .then((now) => {
        if (!now.builtAt || now.builtAt === bornAt) return;
        let tries = 0;
        const attempt = (): void => {
          if (++tries > 3) return; // 放弃，心跳看门狗兜底
          setTimeout(attempt, 15000);
          location.reload();
        };
        attempt();
      })
      .catch(() => { /* 服务端重启间隙取不到——WS 自愈腿管，这里静默 */ });
  }, 10000);
}).catch(() => { /* build-info 缺失（裸静态服务）→ 不自刷 */ });
