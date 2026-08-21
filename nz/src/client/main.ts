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
import { CardTypeBroker } from './card-types.js';
import { PermissionEngine } from './permission.js';
import { PlugtestRunner } from './plugtest.js';
import { mountDynamicPromptFiles } from './plugins/core/dynamic-prompt-files.js';
import { applyEyesBundle } from './plugins/eyes/index.js';
import { loadTermCoreBrowser, probeTermCore } from './term-core.js';
import { TermShell } from './term/shell.js';

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

function render() {
  const el = document.getElementById('boot-log');
  if (!el) return;
  el.textContent = bootLog.join('\n') + '\n\nhelloCleaned=' + isHelloCleaned();
}

// 总线出生：rootCtx 在 import 时已创建（ctx.ts 模块副作用）
void bootCtxSelfTest().then(() => render());
// bootLog 是异步填充，轮询渲染（骨架期最简，后续换事件驱动）
setInterval(render, 250);

// 8.8.2 探针：rio-vt WASM 解析核浏览器侧装载验证（结果进 bootLog + window 供守视直读）
void loadTermCoreBrowser()
  .then((glue) => { (window as unknown as Record<string, unknown>).__kfmNzTermProbe = probeTermCore(glue); })
  .catch((e) => { (window as unknown as Record<string, unknown>).__kfmNzTermProbe = `PROBE FAIL ${e}`; });

// 8.8.2② 渲染壳实拍演示（选型 C 行级 DOM）：喂一段多彩语料渲染成真画面，
// 守视截图可验。卡片插件化（№1 卡型注册）是后续小步，此处先证渲染管线。
const TERM_DEMO =
  '$ ls --color\r\n' +
  '\x1b[34mdir1\x1b[0m  \x1b[32;1mrun.sh\x1b[0m  README.md  \x1b[35mdata.tar.gz\x1b[0m\r\n' +
  '\x1b[1;33m警告：演示语料\x1b[0m  \x1b[38;5;196m256色\x1b[0m  \x1b[38;2;80;200;120m真彩色\x1b[0m\r\n' +
  '\x1b[7m 反色状态栏 INVERSE \x1b[0m\r\n' +
  '宽字符：红色测试CJK\x1b[4m下划线\x1b[24m\x1b[9m删除线\x1b[29m\r\n' +
  '$ ';
void loadTermCoreBrowser()
  .then((glue) => {
    const core = new glue.TermCore(80, 24, 1000);
    core.feed(new TextEncoder().encode(TERM_DEMO));
    const el = document.createElement('div');
    el.id = 'nz-term-demo';
    document.body.appendChild(el);
    const shell = new TermShell(core, el, { cols: 80, rows: 24 });
    shell.renderFrame();
    (window as unknown as Record<string, unknown>).__kfmNzTermDemo = 'RENDERED rows=24';
  })
  .catch((e) => { (window as unknown as Record<string, unknown>).__kfmNzTermDemo = `RENDER FAIL ${e}`; });

// 供守视 eval 直读
(window as unknown as Record<string, unknown>).__kfmNz = { rootCtx, bootLog, isHelloCleaned, host, gestures, cardTypes, permissions, plugtest };
