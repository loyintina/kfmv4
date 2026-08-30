# kfm-nz 唯一开发任务图（ROADMAP）

> 本文件是 **kfm-nz / 9.0 Web 重构的唯一开发任务图**。
> 任何 agent 接手 kfm-nz，先读本文件即可续跑；本文件是**索引**，实现具体小步前，
> 按需阅读 kfmv4 对应契约章节（见第 5/6 节与各小步契约），避免凭空发明 API 形状。
> kfmv4 文档是规格书参考层，不是开发任务入口。
>
> 进度更新**只改本文件**：状态快照 + 各小步“状态”列 + 决策记录。
> 其他任何文档不再承担 NZ 开发任务职责。

---

## 0. 当前状态快照

> **⏸ 2026-08-26 用户拍板：nz 实验台（设备代理）为最高优先——8.x/9.x 全部版本号「后推」，实验台先做出来，其余再说。** 见 §0.5。

> 每次进度更新只改本节。

- **当前阶段**：**nz 实验台（设备代理，device-agent）· 最高优先**——可控真机 APK（真机渲染截图 + 输入注入 + 遥测回传 + 插件/热更/自重启），最终当 nz 启动器。见 §0.5 计划。
- **后推**：原 8.7 内核/8.8 终端/8.9 自观测/8.10-8.13/9.x 里程碑**整体后推**，等实验台落地后再续（版本号暂不改，避免全图级联重编号；要整体重编号另议）。
- **刚完成**：8.8.x 终端系列（终端连接家族 / 渲染卡 / 全屏 / 按键栏 / scrollback / 两区改单区底锚定 / TUI 键栏在底 / CJK 墨迹对齐——详见下表，均已核）。
- **下一步**：实验台 **P0**——nz 终端补「程序化注入输入 + 读当前屏」钩子（`__kfmNzTermInject` / `__kfmNzTermScreen`），这是「能动手」的前提。
- **阻塞**：无

---

## 0.5 nz 实验台（设备代理 device-agent）· 最高优先（2026-08-26 用户拍板）

> **一句话**：做一个**可控真机 APK**，nz 线自己的工具——真机渲染截图 + 输入注入 + 遥测回传 + 插件/热更/自重启，最终当 **nz 启动器**（替代手机浏览器 + 桌面网页快捷方式）。完全镜像 NA「自己握住渲染/输入/网格」哲学，但渲染走 **wry WebView（Android 系统 WebView=Chromium）= 真机光栅化**（中文居上这类问题直接现形）。

### 架构（镜像 NA gate/report/plugin）

| 层 | nz 实验台 | 对应 NA |
|---|---|---|
| 渲染 | **wry WebView** 加载 nz 终端 | Rust 软渲染+内存网格 |
| 截图 | **WebView 捕获**（App 拥有自己的 View→不需权限；真机 Chromium 光栅化） | 离屏光栅化 in-memory 网格 |
| 输入 | **JS 注入 nz 输入钩子** `__kfmNzTermInject` | keys-in→PTY 裸字节 |
| 读状态 | **`__kfmNzTermScreen`/`__kfmNzTermScroll`** | text-req→网格导出 |
| 闸门 | **文件信号 gate**：DUMP_DIR + 值守线程 300ms（shot/keys-in/text/ping/restart/trace/stats）+ **nz 自己的端口**（ssh 可达） | NA gate.rs |
| 遥测 | **report 隧道**（SSH 反隧到服务器，nz 端口，`report()/report_sync()`） | NA report.rs |
| 插件/热更/自重启 | 镜像 NA：cordis 插件面 + gate `restart-req`（记遗言→exit→守护 am start 拉回） | NA |

**为何绕开权限墙**：App 拥有自己的 WebView（截图不需权限）+ JS 桥注入输入 + 读终端钩子——三件事全在自己手里，**无需 adb/root/调试端口**。

### 分阶段执行（每步有验收，遇问题中途变向）

- **P0 · nz 终端前置钩子**（能动手的前提，必须最先）：给 nz 终端补 `window.__kfmNzTermInject(str)`（程序化注入输入）+ `window.__kfmNzTermScreen()`（读当前可视屏文本/网格）。验收：headless 这两个钩子可用。
- **P1 · wry WebView 壳**：Rust wry 加载 nz 终端 + `setWebContentsDebuggingEnabled(true)` + 反隧道（nz 端口）。验收：APK 起 nz；服务器 CDP attach 成功；**首张真机渲染终端截图**。
- **P2 · 文件信号闸门 gate**（镜像 NA gate.rs）：DUMP_DIR + 值守线程（shot/keys-in/text/ping）+ nz 端口 ssh 可达 + `scripts/nz-shot.sh / nz-text.sh / nz-type.sh`。验收：服务器一键拿 shot.rgb（真机渲染）+ screen.txt + keys-in 注入生效。
- **P3 · report 遥测 + 插件/热更/自重启**：report 隧道回传落 `/tmp`；cordis 插件面（镜 NA）；restart-req→守护拉回。验收：遥测落服务器、插件 push 生效、热更重启闭环。
- **P4 · 启动器化**：App 前台常驻、开机进工作台；弃用手机浏览器/网页快捷方式。验收：日常工作只用这个 APK 进 nz。

### 关键决策点（执行中可能变向）

1. **端口分配**：nz 自己的端口对（闸门+report），避开 NA 的 8021/8024/8027。
2. **插件/热更机制**：照搬 NA cordis，还是面向 nz 简化（nz 是 web，插件=JS 包推送？）。
3. **截图途径**：WebView 捕获（推荐，真机 Chromium）——nz 是 web，内存栅格不可行。
4. **nz 终端钩子接口形态**：注入/读屏的粒度（整字 vs 键码；文本 vs 网格）。**P0 定案**。

### 待深入研究（P1/P3 细看）

- NA 精确的插件加载/热更/守护拉回代码（P3 读透再照抄）。
- wry WebView 在 Android 的截图 API + JS 注入可靠性（P1 先验证）。
- 实验台 WebView 视口/DPR（设成你手机规格——顺带解决 headless 校准）。

---

## 1. 这是什么 / 怎么用

### 1.1 目标

从零实现 9.0 Web 版 kfm-nz，逐步替换 kfmv4 8.6。每个小版本都是一个可运行、
可验证、可回滚的完整状态。最终整体迁回 kfmv4，发布 v9.0.0。

### 1.2 唯一文档原则

- 本文件是唯一开发任务图；
- 所有 dsh 取材、Rust 共享内核、测试标准、待裁决项都登记在本文件；
- 不确定的插件/功能标“待用户裁决”，遇到时由用户决定，不预判；
- 任何 agent 开发时，先看状态快照 → 找对应小步 → 做完更新状态；
- **主线单写者**：9.0/nz 主线同时只有一个 agent 在动 TASK.md；并发纪律
  写后即交 / 改前重读 / 链红先归因。
- **文档归宿（2026-08-30 用户拍板）**：kfmv4 本体是半死宿主，nz 是借躯体
  长的新花——**新产生的经验/案例/方法统一收 nz/**（本文件 + nz/docs/），
  不往 kfmv4 docs/ 长新枝。kfmv4 docs/ledger 只保留跨线通信与在役共享
  基建（agent-inbox 信箱、test-methods 方法库——评审线在用，指针可指
  回 nz/docs）；kfmv4 旧记忆的提取留到未来合并时统一做，日常不碰。

### 1.3 版本号语义

- `8.x` = 一类主题；
- `8.x.y` = 该主题内的一个可运行、可验收、可回滚的小步；
- 每个小步完成后，在总表和详细表中把状态改为 ✅；
- `9.0` = 收口：整体迁入 kfmv4，过 kfmv4 检查链，发布 v9.0.0；
- `9.x` = 9.0 收口后的工坊线阶段（文档世界重评与重建，见 4.7）——接着
  主线后面走，不是搁置。
- **步号口径**：nz 步号独立编号，与 kfmv4 规格书层的步号无对应关系
  （nz 8.7.2 = 测试 runner；kfmv4 侧 8.7.2 曾指渲染宿主）。引用 kfmv4 侧
  步号必须注明出处（如 0-4b、步 0-2），防两层步号歧义。

---

## 2. 全局开发与测试纪律

### 2.1 三档考题

| 档 | 适用 | 做法 |
|----|------|------|
| A 档 | 纯逻辑：协议、状态机、几何、压缩、token 计量、解析核 | 先写考题并验证红，再写代码到绿；必须带变异抽检（故意改坏答案，考题必须能抓） |
| B 档 | 平台/胶水：DOM 宿主、Cordis 接线、构建、打包 | 答案先行，冒烟测试钉住防退化 |
| C 档 | 感官：手机手感、动画、布局、终端滚动 | 人工实拍判卷；自动化只覆盖可测边角 |

### 2.2 每个小步 DoD（缺一不可）

- [ ] 功能对照表/考题全绿
- [ ] `npm run typecheck` 零错
- [ ] `npm run smoke` 通过
- [ ] 涉及 UI 时，守视截图/手机实拍通过
- [ ] 热插拔自测：对新插件跑 `kfm-plugtest test-one`（8.7.7 落地前的小步
  以考题/冒烟替代本项）
- [ ] 删旧完成（从零实现时对应 v8 旧件标记为“收编时删”）
- [ ] git commit（小步关账入库，nz 仓库 git 可回查）
- [ ] 发布注记登记（版本/主题/dsh/Rust/测试结果）

### 2.3 常用验证命令

- 开发期服务端口：**8023**（避开 kfmv4 8.6 的 8021）。

```bash
cd /root/kfm-nz
npm run typecheck   # tsc --noEmit
npm run build       # esbuild bundle
npm run smoke       # node 侧 Cordis 全链冒烟
```

浏览器实拍/守视：启动本地静态服务打开 `public/index.html`，通过 `window.__kfmNz`
读取 bootLog 与自测状态。

### 2.4 热插拔自测工具 kfm-plugtest

- 最小版在 **8.7.7** 落地；
- 8.12.2 转正为 tool-host 工具；
- 能力：枚举插件 / 加载-卸载-重载 / DOM+事件+服务残留检查 / 模拟缺失降级；
- 错误码：`PLUGTEST_OK`、`PLUGTEST_UNLOAD_FAIL`、`PLUGTEST_LEAK_DOM`、
  `PLUGTEST_LEAK_EVENT`、`PLUGTEST_LEAK_SERVICE`、`PLUGTEST_DEGRADE_CRASH`、
  `PLUGTEST_RECOVER_FAIL`、`PLUGTEST_UNKNOWN_PLUGIN`；
- 权限：riskClass `exec`，默认禁止测内核件，生产默认 ask/deny，审计写
  ledger `ns=plugtest`；
- 纪律：串行执行；发射类只验证“停止”，不验证“撤销”。

### 2.5 数据区策略

- 开发期使用**独立数据区**，不碰 `~/.kfmv4`，避免与 kfmv4 8.6 并行时抢写
  sessions.jsonl / active.json / 日志；
- 替换完成后继承正式数据区。

### 2.6 跨线运维公约（2026-08-28 评审裁决 ops-convention-verdict 全批准）

- **公约①重 IO 窗口制**：连续型重 IO（全量构建/变异复跑/多卷连跑）
  排在 22:00-07:00 窗口，且必须 `ionice -c3` 双甲（nice 只挡 CPU 不挡
  磁盘）。自评：nz 考卷大跑（npm 多卷连跑）属连续型重 IO，照守；
  日常单发测试（单卷/单文件）按边界条款豁免。判例=10:17 用户态团灭
  +13:00 PSI some=96，同一根因一天两犯。
- **公约③push 遇阻分流**：未提交闸→留本地等闸；链超时→错峰重试；
  机械红→当场修。③a「知会当事线」统一走信箱 notice 或塞话，不留口头。

### 2.7 观测与自验收手段总表（2026-08-28 用户拍板统一登记）

> 新 agent 接手读这一节就够：每个手段=入口/能看什么/保真边界/前后台
> 限制。**任何新观测手段落地必须登记进本表**（不登记=不存在）。

**CDP 真机通道纪律（所有真机手段共用，血泪换来）**：
①按 target id 前缀精确选目标，禁按下标猜（live=description 含
`"attached":true` 是用户活会话，**勿导航勿 reload**；spare=
empty/never_attached 是空页，用它做实验）②relay 8026 只听 IPv6 ::1，
必须 `localhost` 连（127.0.0.1 挂死）③spare 用完导航回 about:blank
收尸（导航 8023 会起 PTY）④App 后台时 Android 合成器不产帧，
`captureScreenshot` 必超时——像素需求走后台路径（画布重画/帧序列）。

| 手段 | 入口 | 能看什么 | 保真边界 | 前后台 |
|---|---|---|---|---|
| DOM 眼 | `scripts/cdp-device.mjs eval "<js>"` | 真机页面任意 JS 读数（rect/computedStyle/textContent） | 精确（读的是真 DOM） | 后台可用 |
| 画布重画眼 | `cshot <id> <png> [url]`；页内钩子 `__kfmNzCanvasShot(scale?)` | 终端可视区像素图（行>段>宽字叶段+光标块逐元素重画） | 颜色/几何同源真渲染态；抗锯齿/下划线不保真 | **后台可用**（CPU 侧光栅化不过合成器） |
| 动效帧序列眼 | `seq <id> <url含{t}> <png前缀> <t1,t2,..>` | 动效逐帧形态（配合页面 ?t= 冻结帧，块字符 fillRect 同源重画） | 每帧「画什么」全对；实时掉帧测不了（要前台 screencast） | **后台可用**（rAF 后台不跑，合成时间驱动是正道） |
| 合成器实拍 | `shot` / `evshot` / `navshot` | 真机实际屏幕帧（含原生渲染一切细节） | 全保真 | **App 前台限定**（后台不产帧必超时） |
| 读屏 | 页内钩子 `__kfmNzTermScreen()` | 当前可视屏纯文本（塌尾行不计） | 与渲染态同源 | 后台可用 |
| 注入动手 | 页内钩子 `__kfmNzTermInject(str)`（`\r`=回车） | 走现有输入管线（粘滞/回底纪律同 kb/IME） | 不绕过任何输入纪律 | 后台可用 |
| 滚动状态 | 页内钩子 `__kfmNzTermScroll()` | scrollTop/clientHeight/isAtBottom/cellW/cellH | 精确 | 后台可用 |
| ?debug 遥测 | URL 加 `?debug` → `/tmp/nz-ime-events.log` | 渲染健康字段 f/rp/sc/rz + 专症字段随症注册 | 真实设备自报，agent 直读日志 | 后台可用（页面需开着） |
| 开屏覆层 | URL 加 `?splash` 或 `__kfmNzSplash(true/false)` | 休眠覆层唤醒/收起（CDP evaluate 可玩，不导航不杀会话） | — | 后台可用 |
| A/B 档考卷 | `tests/browser/*.test.mjs`（headless playwright） | 终端行为回归（bottom-anchor/scrollback/keybar/term-hooks/cjk-width-c4…） | headless 合成环境 | 服务器本地 |
| Rust 层判卷 | `cd term-core && cargo test` | 核层语义（宽度/换行/模式位） | 纯净无竞态 | 服务器本地 |
| 真机四单自验收 | `scripts/device-verify.mjs` | 真机行为清单（评审抽查节奏收录） | 真机实证 | 后台可用 |

**判卷层选择纪律**（C4 对拍换来）：可打印串/文本类断言浏览器层可判；
**定位类序列（CUP/CHA）必须 Rust 层判**——CoreFeed 与活体 PTY 共享
核，zsh 重绘竞态会污染定位读数（x86→88 假红实例）。真机专属症状遵守
方法库「真机取证纪律」（先埋探针/探针过备/数字收口），评审线方法库
`docs/ledger/test-methods/index.md` 是上位文件。

---

## 3. 总时间线（一页总表）

> 状态：⬜ 待办 · 🔄 进行中 · ✅ 完成 · ⏸ 待用户裁决
> **⏸ 2026-08-26 用户拍板「后推」**：本总表及 §4 的 8.7/8.8/8.9/8.10-8.13/9.x 里程碑**整体后推**（版本号暂不改、避免全图级联重编号），**先做 §0.5 实验台（device-agent）**，实验台落地后再续本表。已完成项（✅）不回退。

| 小步 | 做什么 | dsh 参考 | Rust 共享 | 测试/考题 | 状态 |
|------|--------|----------|-----------|-----------|------|
| 8.7.1 | Cordis 根总线（rc.8 锁版 + hello 见证 + 自测） | 无 | 无 | A 档：注册/注入/注销/清理全链，churn 20 轮 | ✅ |
| 8.7.2 | 测试 runner 移植（kfmv4 runner.ts + harness.ts） | 无 | 无 | A 档：先写考题验证红 + 变异抽检可跑 | ✅ |
| 8.7.3 | 渲染宿主 + 手势分发 | 无 | 无 | A+B：容器生灭唯一入口、手势层带、验收三数字、0-4b NA 互证 | ✅ |
| 8.7.4 | card-types broker | dsh host/plugin-inventory 参考 | 无 | A 档：headless 枚举/注册/摘除 | ✅ |
| 8.7.5 | 安全包影子 | dsh guard/scope 参考 | cedar-policy 远期评估 | A+B：只记录不拦截，决策全量落日志 ✅ |
| 8.7.6 | 眼睛最小包（bundle 骨架：dynamic-prompt-files 基建 + eyes 总插件 + coords 契约段 + 骨架自态段） | 无 | 无 | A 档：抽文件测试两式；禁用后系统无损；过 plugtest | ✅（2026-08-21） |
| 8.7.7 | kfm-plugtest 最小版 | 无 | 无 | A 档：list/test/残留检查 ✅ |
| 8.8.1 | 终端连接家族（PTY/tmux 管理） | dsh terminal-bash | NA portable-pty（仅 NA）；kfmv4 侧 Node 不 Rust | A 档：open/input/resize/close/重连 | ✅（2026-08-21，tmux 管理留 8.8.5 完整管理步） |
| 8.8.2 | 终端渲染卡 | 无 | **rio-vt→WASM**（评估翻盘：alacritty 被 polling 阻断上不了 wasm32；复活触发=rio-vt 功能缺口/行为考卷长期不齐） | A+B+C：终端功能对照 + M3 基线；考卷全集差分硬门移作 8.8.5 闭环前置（2026-08-23 拍板） | ✅（2026-08-23：IME 三症真机全解 + 轻收口三件落地——对照表 nz/docs/term-checklist.md、M3 基线 nz/tests/m3-baseline/、通报信 kfmv4-9.0-nz-882-closeout-notice；考卷硬门按拍板归 8.8.5 闭环） |
| 8.8.3 | 刷新默认全屏终端 | dsh ui-layout 思想 | 无 | C 档：刷新即终端；真机数字收口 | ✅（2026-08-23：守视双态实拍绿 + 用户真机确认「确实没问题」） |
| 8.8.3b | 仿 Termux 按键栏（keybar UI 随键盘上浮）+ keymap 纯逻辑（粘滞修饰/控制字节/SS3-CSI 方向键） | NA keybar.rs/keymap.rs | 核加 `app_cursor()` 暴露（cursor_visible 同款小改） | A：keymap 考题（Ctrl+ASCII→字节 / Alt=ESC x / 方向键 ?1h SS3 vs CSI / 粘滞一次读走清零）；C：栏随软键盘上浮实拍 + 真机数字收口 | ✅（2026-08-24 收口：A 8 题绿 + 核 ?1h/?1l 钉 + B 守视真链绿 + 评审通过；上浮被盖症五轮讨伐落幕——判尺 vm=vv 真尺 / 钉 vv 移出防抖治过渡闪帧 / `?kbOff=<px>` 常驻代字适配 Via 有栏 vv 虚报 ~42px（浏览器硬限制，用户拍板接受现状）；专症字段+双轨色条随症拆，kboff 命中标记保留） |
| 8.8.3c | scrollback 历史渲染上屏（2026-08-23 用户拍板：随手上滑翻历史=基础体验，9.0 不得比 8 倒退；tmux copy-mode 不作替代）——核已存 1000 行历史，壳从「只画当前屏」扩为「历史+当前屏」同渲，容器 overflow:hidden→auto 开真滚动 | 无 | 核需历史行读取 API（grid 回退区遍历，评估 rio-vt 暴露面） | A：壳考题（历史行渲染 / 跟底判定：新输出仅当已在底部才跟底，用户上滚不拽回）；B：长输出装配冒烟；C：真机上滑翻历史实拍 + IME 纪律兼容（上滚中输入跳回底部再发）+ 真机数字收口 | 🔄（2026-08-24：实现落地 @ 6d261e15——核三 API+壳增量历史块+集中状态机+钩子；A 档裁决两红=考卷 artifact，修卷后 5/5 绿（评审复核+本地复核同数）；B 档千行冒烟绿；待 C 档真机上滑实拍收口） |
| 8.8.3d | 单区底锚定终端（2026-08-24 用户拍板**回退两区**，评审契约信 kfmv4-9.0-single-zone-bottom-anchor-review）：单一连续终端区——最底=最新、输出续输入下上滚、空屏提示符也在视口底行（壳塌尾空行 + flex 底锚 margin-top:auto）、去掉独立固定输入行；滚动/状态机复用 8.8.3c，按键栏流内垫底不动 | 无 | 核 `alt_screen()` 保留（TUI 整屏不塌行，行列恒定） | A：bottom-anchor 考卷（空屏提示符底行/输出续输入下/超屏最底=最新/键盘占位整体上移底锚不回退）+ scrollback 5/5 + keybar 17/17 不回退；B：千行不卡；C：真机实拍底锚定视觉+上滑翻历史+键盘弹起整体上移 | 🔄（2026-08-24：两区落地 a082f87f+5e3dd75c 后用户拍板回退→单区底锚定 @ 7aa1962b；A 档新考卷 5/5 一遍绿 + scrollback 5/5 + keybar 17/17 不回退 + B 千行绿；`__kfmNzTermInputRow` 退役明示；待 C 档真机收口） |
| 8.8.4 | 顶栏最小版：tmux 标签 | dsh ui-slots/ui-layout | 无 | C 档：标签切换实拍；真机数字收口 | ⬜ |
| 8.8.5 | tmux 完整管理 + 闭环 | dsh terminal-bash | 无 | A+B：tmux 考题全档；闭环前置=考卷全集差分绿（硬门后移不取消） | ⬜ |
| 8.8.6 | 手单实例（最小：press=视觉+注入一体，对真 UI 验证；坐标对齐眼睛 coords 段） | 无 | 无 | A+B：press 链路考题 + 过 plugtest | ⬜ |
| 8.9.1 | 自观测·运行时状态导出 + 标准化事件日志（能观地基；替代 ad-hoc console → 带版本结构化事件流） | 无 | 结构化事件流（自研薄） | A 档：状态可查询 + 事件流带版本+可回放 | ⬜ |
| 8.9.2 | 自观测·按需自插桩（命名点现场插探针，重跑读精确值，不重启服务） | 无 | 插桩点注册表 | A 档：插桩读精确值钉 | ⬜ |
| 8.9.3 | 自观测·确定性回放（PTY/WS 轨迹捕获→慢放复现） | 无 | 轨迹捕获/重放（复用 replayTail 扩） | B 档：轨迹回放复现 bug | ⬜ |
| 8.9.4 | 自观测·假设-干预-再观察 + 变异抽检（因果定位 + 判据可信） | 无 | 注入受控输入 | A+B：因果定位 + 变异抓判据 | ⬜ |
| 8.9.5 | 自观测·决策轨迹语义化 + 一致性检查（最小；长线研究） | 无 | 语义分类器雏形 | A：功能分类 + 偏离检测最小值 | ⬜ |
| 8.10.1 | tree-data 服务（懒加载） | dsh fs/directory-picker | ignore/globset 候选（实测驱动） | A 档：千级目录响应达标 | ⬜ |
| 8.10.2 | 文件树卡 DOM 化（Obsidian 文件卡） | dsh ui-directory-picker | 无 | A+B+C：10–15 层不卡，截图 diff 为零 | ⬜ |
| 8.10.3 | 文件编辑卡 + file-io | dsh fs 参考 | similar / pulldown-cmark / syntect 候选（实测驱动） | A+B+C：双态、跟随同步、点开全屏 | ⬜ |
| 8.10.4 | engine/v2 退役核验 + 闭环 | 无 | 无 | A 档：引用扫描为零 + 构建通过 | ⬜ |
| 8.11.1 | pool-system 数据层（基础四池 + workspaces 仅数据层） | dsh credentials/settings | 无 | A 档：池数据读写/持久化 | ⬜ |
| 8.11.2 | 池卡容器 | dsh ui-settings | 无 | B+C：保留性考题 | ⬜ |
| 8.11.3 | 七 tab 路由同一窗口 | dsh ui-settings | 无 | B+C：七 tab 实拍 | ⬜ |
| 8.11.4 | 卡片堆消解 + 最小全屏布局 + 闭环 | dsh ui-layout/ui-slots | 无 | A+B+C：堆卡全部有归宿 | ⬜ |
| 8.12.1 | session-store 换心 | dsh session-persistence/projection | 共享 JSONL schema | A 档：旧会话 hash 对账迁移 | ⬜ |
| 8.12.2 | tool-host + ledger-service + kfm-plugtest 转正 | dsh core/tools | hash 链 sha2+serde 薄自研 | A+B：工具调用对照、账只加不改、plugtest 可调用 | ⬜ |
| 8.12.3 | agent-service | dsh agent-loop/llm/system-prompt/token-meter | tiktoken-rs→WASM | A 档：M2 双轨语义等价；**眼睛投影接入装配线** | ⬜ |
| 8.12.4 | 压缩挂点 | dsh compaction/pruner/spill | 修剪核薄自研 + tiktoken-rs | A 档：压缩语义保持抽检 | ⬜ |
| 8.12.5 | 新对话卡 UI | dsh ui-conversation/ui-tool | 无 | B+C：M3 diff 受控 | ⬜ |
| 8.12.6 | 命令系统 + 闭环 | dsh ui-input-trigger/ui-commands | 无 | A+B：命令对照表 | ⬜ |
| 8.13.1 | 窗口卡完全体（无工作区层） | dsh ui-conversation 多实例 | 无 | A+B+C：多实例持久化 | ⬜ |
| 8.13.2 | 启动器 | dsh ui-slots 枚举 | 无 | A+B：抽屉与注册表同源 | ⬜ |
| 8.13.3 | 顶栏完整版 + 完整布局 | dsh ui-layout/ui-sidebar | 无 | A+B+C：全档考题 | ⬜ |
| 8.13.4 | 皮肤包 + todo 卡 | dsh ui-theme / dsh todo | 无 | B+C：换肤热切换、工具附属卡 | ⬜ |
| 8.13.6 | 眼睛全量段（数据源触发制：viewport/file-tree/orb-panel/card-stack 各段随对应卡落地补齐；失败写占位/卸载遗言全段对齐） | 无 | 无 | A：全段投影内容快照钉 | ⬜ |
| 8.13.7 | 安全包转正（deny/ask 真生效 + ask 批准卡内联窗口卡 + 会话级 allowlist 三档；启动 cedar-policy 评估）。承接 875 评审发现：../ 逃逸洞（已修+钉 8-21）/ exec 空 command 口径（已修+钉 8-21）/ 审计缓冲上限（转正接 ledger-service 时截断/背压） | dsh guard/scope/permission-presets | cedar-policy 评估本步启动 | A+B：№15 考题全档（含卸载安全包宿主基线仍拒）；C 档判定分布对账 | ⬜ |
| 8.13.8 | 手全量（多实例 + 角色定制样式 + orbitAnchor 接布局锚区） | 无 | 无 | A+B+C：№4 全档；多实例实拍 | ⬜ |
| 8.13.5 | 启动引导收口 + 闭环（执行序最后：含 8.13.6–8.13.8） | dsh boot 参考 | 无 | A+B：拓扑激活、调试桥确认删 | ⬜ |
| 9.0 | 整体迁入 kfmv4，过检查链，发 v9.0.0；插件热重载而会话不断（kfm-restart 自然退役判据）；**deploy-freshness 本步以 nz 部署目标为对象重生**（2026-08-21 拍板①+延迟②） | 全部 | 全部 | 全套 kfmv4 检查链 + 测试基线 | ⬜ |
| 9.x | 工坊线：文档世界重评与重建（重评 D1–D6 → 按需实施，见 4.7） | — | — | 重评会结论先行，分步落地 | ⬜（9.0 后启动） |

---

## 4. 分主题详细步骤

### 4.1 8.7 内核地基

> 无可见变化；工坊线 ⏸ 推迟，nz 不依赖（工坊线排在 9.0 后，见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.7.1 | cordis@4.0.0-rc.8 进 lockfile；rootCtx 最早创建；hello 见证插件；bootCtxSelfTest | 无 | 无 | A：注册/注入/注销/清理全链；churn 20 轮 | ✅ |
| 8.7.2 | 测试 runner 移植（kfmv4 runner.ts + harness.ts） | 无 | 无 | A：先写考题验证红；变异抽检可跑 | ✅ |
| 8.7.3 | 渲染宿主（容器生灭唯一入口）+ 手势分发（gesture-registry + 层带公约） | 无 | 无 | A+B：容器生灭、手势层带、验收三数字、0-4b NA 互证 | ✅ |
| 8.7.4 | card-types broker（注册表 + singleton） | dsh plugin-inventory 参考 | 无 | A：headless 枚举/注册/摘除可脚本验证 | ✅ |
| 8.7.5 | 安全包影子（只记录不拦截；强制 riskClass 声明） | dsh guard/scope | cedar-policy 留转正期评估 | B：决策全量落日志，零行为变化 ✅ |
| 8.7.6 | 眼睛最小包（Cordis 全流程首例 bundle；数据源=骨架自态：broker 账/审计账/体检记录/手势流/bootLog） | 无 | 无 | A：抽文件测试两式，禁用后系统无损，过 plugtest | ✅（2026-08-21） |
| 8.7.7 | kfm-plugtest 最小版 | 无 | 无 | A：list/test/残留检查；错误码可机检 ✅ |

### 4.2 8.8 终端/tmux 优先

> 第一个可见变化；工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.8.1 | 终端连接家族（PTY/tmux 管理） | dsh terminal-bash | NA portable-pty；kfmv4 侧 Node 不 Rust；本步前完成 alacritty_terminal vs rio-vt WASM 评估 | A：连接五动作对照旧实现 | ✅（2026-08-21，tmux 留 8.8.5；WASM 评估挪 8.8.2 门口待拍板） |
| 8.8.2 | 终端渲染卡 | 无 | **rio-vt→WASM**（2026-08-21 用户拍板；NA 侧 alacritty 不动，行为一致靠两线同源考卷保证） | A+B+C：终端功能对照表全绿；M3 终端基线；开工先补：僵尸会话 list 口径 + open 挂权限判定；**收口硬门（评审前置要求，用户 2026-08-21 接受；2026-08-23 拍板后移挂点）：功能覆盖考卷全集对跑——NA 在用的解析序列全集差分（非抽查），rio-vt 缺序列即触发复活重议；硬门移作 8.8.5 闭环前置，8.8.3–8.8.5 开工不等它** | ✅（2026-08-23：IME 三症真机全解 + 轻收口三件落地——对照表 nz/docs/term-checklist.md、M3 基线 nz/tests/m3-baseline/、通报信 kfmv4-9.0-nz-882-closeout-notice；考卷硬门归 8.8.5 闭环） |
| 8.8.3 | 刷新默认全屏终端 | dsh ui-layout 思想 | 无 | C：实拍刷新即终端；不得依赖 №11 完整布局；**真机数字收口**（2026-08-23 拍板：tmux 线=用户迁 9.0 判据） | ✅（2026-08-23：守视双态实拍绿——无参刷新即终端 panel=none / ?debug 面板照常；用户真机确认「确实没问题」收口） |
| 8.8.3b | 仿 Termux 按键栏 + keymap（2026-08-23 评审建议信 kfmv4-9.0-term-keybar-review，用户提过缺口；tmux 刚需：手机无 Ctrl+B 前缀）：两排七列照 NA keybar.rs 定稿（上 Esc/Alt/Home/PgUp/↑/PgDn/Shift，下 Tab/Ctrl/End/←/↓/→/Enter）；四条纪律照抄——①修饰键一次性粘滞（点亮后下次落字读走清零）②keymap 纯逻辑 A 档有题（Ctrl+ASCII→控制字节；Alt+X=ESC x；方向键/End 吃 app_cursor 模式位，?1h 发 SS3 `ESC O A` 否则 CSI `ESC [ A`）③栏随软键盘上浮（贴可视区底，防被键盘盖）④键位序按 NA KEYS 表；核需加 `app_cursor()` 暴露（cursor_visible 同款小改）；keymap 独立纯逻辑模块，keybar UI 进 term 插件包 | NA keybar.rs/keymap.rs | 核 `app_cursor()` | A：keymap 考题（Ctrl+字节/Alt/方向键 SS3-CSI/粘滞清零各一）+ B：栏装配冒烟 + C：上浮跟随真机实拍 | ✅（2026-08-24 收口：A/B 绿+评审通过+点击不可达修复（f99fc67a）；上浮被盖症五轮落幕=判尺 vm=vv 真尺（575a7eb2 单基准 top 锚 vv）+过渡帧闪帧=钉 vv 移出防抖（be5f95b1）+`?kbOff=<px>` 常驻代字（02739919）适配 Via 有栏 vv 虚报 ~42px（浏览器硬限制，用户拍板接受现状）；专症字段/双轨色条随症拆，kboff 命中标记保留） |
| 8.8.3c | scrollback 历史渲染上屏（2026-08-23 用户拍板：随手上滑翻历史=基础体验，9.0 体验不得比 8 倒退；AI 长对话场景必须可回翻；tmux copy-mode 不作替代——用户从没用过）：核侧 1000 行历史已在（8.8.2 起配置），本步改渲染壳——从「只画当前屏、overflow:hidden」扩为「历史+当前屏同渲、overflow:auto 真滚动」；跟底纪律=终端惯例：新输出到来仅当视口已在底部才跟底，用户上滚阅读时不拽回；输入即回底（xterm 同款：按键/上屏先把视口送回光标处再发字节，与 placeKb 钉光标格纪律兼容——上滚时诱饵在屏外，focus preventScroll 不拽，发字节前显式回底）；容器高度跟随软键盘的既有逻辑不变（8.8.2 吞末行根治保留） | 无 | 核需历史行读取面（评估 rio-vt grid 回退区遍历 API；若缺，cursor_visible 同款小改暴露） | A：壳考题（历史行逐行进屏 / 跟底判定两向 / 回底再发）；B：千行长输出装配冒烟（渲染不卡、内存有界）；C：真机上滑翻历史实拍 + 上滚中收新输出不拽回 + 真机数字收口 | 🔄（2026-08-24：实现落地 @ 6d261e15——核三 API+壳增量历史块+集中状态机+钩子；A 档裁决两红=考卷 artifact，修卷后 5/5 绿（评审复核+本地复核同数）；B 档千行冒烟绿；待 C 档真机上滑实拍收口） |
| 8.8.3d | 单区底锚定终端（2026-08-24 用户拍板**回退两区**，评审契约信 kfmv4-9.0-single-zone-bottom-anchor-review；两区 fixed-input-row 模型作废）：单一连续终端区——历史+屏幕行同一滚动区（复用 8.8.3c 状态机/增量渲染），无独立输入行；底锚定=壳塌尾空行（渲染到 max(光标行, 最后非空行)）+ 容器 flex 列画布 margin-top:auto：空屏提示符贴视口底行（上方留白）、新内容从底往上顶、超屏真滚动；光标行模式/ALT 统一进滚动区 + nearest 兜底；placeKb 钉光标格可视位（cursorOffset−scrollTop）；按键栏流内垫底、?kbOff/钉 vv 纪律不动 | 无 | 核 `alt_screen()` 保留（TUI 不塌行） | A：bottom-anchor.test.mjs 5 断言 + scrollback 5/5 + keybar-click 17/17 不回退；B：千行长输出上滚不卡；C：真机实拍（底锚定视觉+上滑+键盘弹起整体上移）+ 数字收口 | 🔄（2026-08-24：两区 a082f87f+5e3dd75c 后用户拍板回退→单区 @ 7aa1962b；A 档 5/5 一遍绿+不回退双全绿+B 千行绿；fixed-input-row.test.mjs 作废删除、`__kfmNzTermInputRow` 退役明示；已知悉单区下输入行会被输出顶动（自然终端手感优先，缓解再议不回滚）；待 C 档真机收口） |
| 8.8.4 | 顶栏最小版：tmux 标签 | dsh ui-slots/ui-layout | 无 | C：标签切换实拍；**真机数字收口** | ⬜ |
| 8.8.5 | tmux 完整管理（新建/清空/挂起/状态检测）+ 闭环 | dsh terminal-bash | 无 | A+B：tmux 考题全档；**闭环前置：考卷全集差分绿** | ⬜ |
| 8.8.6 | 手单实例（最小）：overlay 容器 + hand-press 事件 + press 一体链路，对终端卡真按 | 无 | 无 | A+B：press 注入经手势分发实测；过 plugtest | ⬜ |

### 4.3 8.9 自观测补全（2026-08-25 立项，方向纲领见 kfmv4 `library/notes/自我进化理论地图-自观测到控制论-2026-08-24.md`）

> 自观测 = 让 nz 能看清自己的运行时状态与决策，是自我进化（能观/能控/反馈）的前提。
> 顺序：A（状态导出+事件日志）→ B（插桩+回放）→ C（实验+变异+判据外部化）→ D（决策轨迹语义化，长线）。

| 步号 | 内容 | dsh取材 | 核 | 考题/验收 | 状态 |
|---|---|---|---|---|---|
| 8.9.1 | 运行时状态导出 + 标准化事件日志（能观地基；替代 ad-hoc console） | 无 | 结构化事件流（自研薄） | A：状态可查询 / 事件流带版本+可回放 | ⬜ |
| 8.9.2 | 按需自插桩（命名点现场插探针，重跑读精确值，不重启服务） | 无 | 插桩点注册表 | A：插桩读精确值钉 | ⬜ |
| 8.9.3 | 确定性回放（PTY/WS 轨迹捕获→慢放复现） | 无 | 轨迹捕获/重放（复用 replayTail 扩） | B：轨迹回放复现 bug | ⬜ |
| 8.9.4 | 假设-干预-再观察 + 变异抽检（因果定位 + 判据可信） | 无 | 注入受控输入 | A+B：因果定位 + 变异抓判据 | ⬜ |
| 8.9.5 | 决策轨迹语义化 + 一致性检查（最小——推理步功能分类→标准路径→偏离检测→修正信号；长线研究） | 无 | 语义分类器雏形 | A：功能分类 + 偏离检测最小值 | ⬜ |

### 4.4 8.10 Obsidian 文件卡

> 文件树 + 文件编辑，复刻 Obsidian 模式；工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.10.1 | tree-data 服务（懒加载） | dsh fs/directory-picker | ignore/globset 候选（实测驱动） | A：千级文件目录数据层响应达标 | ⬜ |
| 8.10.2 | 文件树卡 DOM 化（UI 不变；mode-system 收编） | dsh ui-directory-picker | 无 | A+B+C：10–15 层展开/收起/滚动不卡；截图 diff 为零 | ⬜ |
| 8.10.3 | 文件编辑卡（双态；扼点事件化跟随）+ file-io | dsh fs 参考 | similar / pulldown-cmark / syntect 候选（实测驱动） | A+B+C：外部改动跟随；点开=全屏、再点=关重开 | ⬜ |
| 8.10.4 | engine/v2 退役核验 + 闭环 | 无 | 无 | A：引用扫描为零 + 构建通过 | ⬜ |

### 4.5 8.11 池卡/配置

> 工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.11.1 | pool-system 数据层（基础四池 + workspaces 组合池结构；workspaces 仅数据层，UI 层不做工作区切换——见 8.13.1） | dsh credentials/settings | 无 | A：池数据读写/持久化对照旧池 | ⬜ |
| 8.11.2 | 池卡容器（上配置下池） | dsh ui-settings | 无 | B+C：保留性考题（拼接/拖拽柄/预览/动静加载） | ⬜ |
| 8.11.3 | 七 tab 路由同一窗口（复用 tmux 标签件） | dsh ui-settings | 无 | B+C：七 tab 实拍；标签组件同源 | ⬜ |
| 8.11.4 | 卡片堆消解 + 最小全屏布局 + 闭环 | dsh ui-layout/ui-slots | 无 | A+B+C：堆卡全部有归宿；M3 池卡基线 | ⬜ |

### 4.6 8.12 对话卡

> 换心最重，拆最细；工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.12.1 | session-store 换心 | dsh session-persistence/projection/checkpoint | 共享 JSONL schema；浏览器侧续用 dsh TS 件 | A：旧会话逐条 hash 对账迁移；过步 0-2 指标口径 | ⬜ |
| 8.12.2 | tool-host（四家族工具包）+ ledger-service + kfm-plugtest 转正 | dsh core/tools | hash 链 sha2+serde 薄自研；修剪核薄自研 | A+B：工具调用一致对照；账只加不改；plugtest 可经 tool-host 调用 | ⬜ |
| 8.12.3 | agent-service（对话循环/工具循环/prompt 装配线） | dsh agent-loop/llm/system-prompt/token-meter | tiktoken-rs→WASM（拿来） | A：M2 双轨同 prompt 新旧管线输出语义等价；**眼睛投影接入装配线（消费者挂接，防白看）** | ⬜ |
| 8.12.4 | 压缩挂点（pruner/spill/摘要） | dsh compaction/pruner/spill | 修剪核薄自研；计量复用 tiktoken-rs | A：压缩语义保持抽检；投影链挂点生效 | ⬜ |
| 8.12.5 | 新对话卡 UI（光球面板+全局输入栏收编） | dsh ui-conversation/ui-tool | 无 | B+C：M3 对话/光球 diff 受控；全局单例优先级不变 | ⬜ |
| 8.12.6 | 命令系统 + 闭环 | dsh ui-input-trigger/ui-commands | 无 | A+B：命令对照表；8.12 主题闭环 | ⬜ |

### 4.7 8.13 工作台/收尾

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.13.1 | 窗口卡完全体（五部件/四元组/收起≠销毁；**UI 层不做工作区切换**——用户拍板：调出窗口自己配置；多光球状态持久化、光球入口数量可自定义） | dsh ui-conversation 多实例 | 无 | A+B+C：多实例持久化实拍 | ⬜ |
| 8.13.2 | 启动器（手势抽屉 → broker 枚举 → 开卡） | dsh ui-slots 枚举 | 无 | A+B：抽屉与注册表严格同源 | ⬜ |
| 8.13.3 | 顶栏完整版（五槽位 + 观测台）+ 完整布局 | dsh ui-layout/ui-sidebar | 无 | A+B+C：全档考题 | ⬜ |
| 8.13.4 | 皮肤包（深蓝意志；皮肤=覆盖层，组件自带基础样式——基础包随功能，覆盖包做拓展）+ todo 卡 | dsh ui-theme / dsh todo | 无 | B+C：换肤热切换；工具附属卡模式 | ⬜ |
| 8.13.6 | 眼睛全量段（数据源触发制：数据源卡落地一个补一段） | 无 | 无 | A：全段投影快照钉；失败写占位不抛逐段核验 | ⬜ |
| 8.13.7 | 安全包转正（№15 收口：真拦截 + 批准卡 + allowlist 三档 + cedar 评估；承接 875 发现：../ 逃逸/空 command 已修+钉，审计缓冲上限转正期处置） | dsh guard/scope/permission-presets | cedar-policy 评估本步启动 | A+B：№15 考题全档；C 档判定分布对账（转正不改判定只改执行） | ⬜ |
| 8.13.8 | 手全量（多实例/角色定制样式/锚区接布局） | 无 | 无 | A+B+C：№4 全档 | ⬜ |
| 8.13.5 | 启动引导收口（拓扑激活 + ws-server 一拆三收尾）+ 闭环——**执行序最后（含 8.13.6–8.13.8）** | dsh boot 参考 | 无 | A+B：启动链拓扑与实现一致；调试桥确认已删 | ⬜ |

### 4.8 9.x 工坊线（文档世界重建，9.0 收口后启动）

> 2026-08-20 用户拍板：工坊线**不是搁置，是顺序调整**——接着主线后面走。
> nz 开发期不依赖工坊线；9.0 收口（v9.0.0 落地）后启动本阶段。
> 六族契约 0–9 设计稿保留定稿状态（kfmv4 规格书层，不删不撤），实施冻结至今。

| 小步 | 做什么 | 契约出处（kfmv4 规格书层） | 状态 |
|------|--------|---------------------------|------|
| 9.x.0 | **重评会**：D1–D6 逐项判「有用 / 合并 / 废弃」，结合下方重评输入材料出重建方案 | 六族契约 0–9 全览 | ⬜ |
| 9.x.1 | D1 A 注册表（七字段改造 + 回填规约出处 / 豁免区 / check-mechanism-registry 守卫四件） | 契约 0/2/5 | ⏸ 待重评 |
| 9.x.2 | D2 B 降生链（`_birth.yaml` 双链 / gen-birth 生成器 / check-birth-wiring） | 契约 1/6 | ⏸ 待重评 |
| 9.x.3 | D3 C 信箱（信封四字段 + 回执表入 README / inbox-scan 归属行扫描器 / git 卫生脚本） | 契约 3 | ⏸ 待重评 |
| 9.x.4 | D4 D 部署运维（部署运河/数据卫生登记 + kfm-restart 退役判据 + auto-push 外向条件） | 契约 7 | ⏸ 待重评 |
| 9.x.5 | D5 E 各族缺口（exp 脚本退役 / docprobe 结晶迁移 / paradigm 归档 + harness-studies 已迁 library（2026-08-21）/ 实验索引考古字段） | 契约 8/9 | ⏸ 待重评 |
| 9.x.6 | D6 F 户籍警（扫描器 v1 影子 → v2 增量执法） | 契约 4 | ⏸ 待重评 |

**重评输入材料**（第二阶段讨论结论，重评会上逐项过）：

- 信箱四流型细化：私聊（链条）/ 征集（单对多）/ 汇总（多对单）/ 线程
  （多对多）的落地形态——目前只有一个信箱，多 agent 协作成熟后需拆分；
- 文档守望机制：扫描项目各位置，新 md/文档文件出现即有反应（归属哪个
  机制待定，重评时定）；
- 实验区组织：自由生长 + 考古字段，未来给 agent 翻历史数据找灵感；
- 活性探针议题（kfmv4 `nine-point-zero.md` 待讨论节第一条，防 agent-runner
  类静默失效）；
- 三脚本归宿：守视 / api 工具脚本 / agent 工具脚本（用户拍板真正重要的
  三件套）在 9.x 的收编位置——观测台、独立工具卡，还是工坊机制，届时定。

---

## 5. dsh 取材总表

> 状态：⬜ 待搬 · 🔄 搬运中 · ✅ 已搬 · ⏸ 待用户裁决

| dsh 件 | 用途 | 落到 NZ 哪个小步 | 状态 |
|--------|------|------------------|------|
| terminal-bash | 终端连接/tmux 管理语义 | 8.8.1 / 8.8.5 | ⬜ |
| ui-layout / ui-slots | 全屏布局、顶栏槽位、启动器枚举 | 8.8.3 / 8.8.4 / 8.11.4 / 8.13.2 / 8.13.3 | ⬜ |
| ui-directory-picker | 文件树浏览交互 | 8.10.2 | ⬜ |
| fs | 文件 CRUD / 沙箱 / 权限面 | 8.10.3 | ⬜ |
| credentials / settings | provider/model/配置管理 | 8.11.1 | ⬜ |
| ui-settings / ui-model-selection | 池卡 UI | 8.11.2 / 8.11.3 | ⬜ |
| session-persistence / projection / checkpoint | 会话存储 | 8.12.1 | ⬜ |
| core/tools | 工具宿主 | 8.12.2 | ⬜ |
| agent-loop / llm / system-prompt / token-meter | 对话循环 | 8.12.3 | ⬜ |
| compaction / pruner / spill | 上下文压缩 | 8.12.4 | ⬜ |
| ui-conversation / ui-tool | 对话 UI | 8.12.5 | ⬜ |
| ui-input-trigger / ui-commands | 命令系统 | 8.12.6 | ⬜ |
| ui-theme | 皮肤 | 8.13.4 | ⬜ |
| todo | todo 工具语义 | 8.13.4 | ⬜ |
| guard / scope | 权限裁决 | 8.7.5 / 8.13.7（+permission-presets） | ⬜ |
| boot | 启动引导参考 | 8.13.5 | ⬜ |

---

## 6. Rust 共享内核总表

> 状态：⬜ 待评估 · 🔄 评估/移植中 · ✅ 已落地 · ⏸ 待实测痛点

| Rust 核 | 对应小步 | 来源 | 触发条件 | 状态 |
|---------|----------|------|----------|------|
| rio-vt | 8.8.2 终端解析核 | 拿来（2026-08-21 评估翻盘定案：alacritty 被 polling 阻断上不了 wasm32，rio-vt 解析层 plain 4.9x 且开箱过 wasm32） | 8.8.2 开工 | ⬜ |
| portable-pty | 8.8.1 PTY 管理 | NA 拿来 | 仅 NA 侧；kfmv4 侧 Node 不 Rust | ⬜ |
| tiktoken-rs | 8.12.3 token 计量 | 拿来（Zed 在用） | 8.12 落地 | ⬜ |
| 压缩修剪核 | 8.12.4 压缩挂点 | 薄自研 + tiktoken-rs | 8.12 落地 | ⬜ |
| similar | 8.10.3 编辑卡 diff | 拿来改 | 实测痛点驱动 | ⏸ |
| pulldown-cmark / comrak | 8.10.3 md 渲染 | 拿来改 | 手机端大 md 实测掉帧才立项 | ⏸ |
| syntect | 8.10.3 语法高亮 | 拿来改 | 同上 | ⏸ |
| ignore / globset | 8.10.1 文件树过滤 | 拿来改 | 实测驱动 | ⏸ |
| cedar-policy | 8.13.7 安全包转正 | 远期评估 | 影子期薄自研已落（8.7.5）；评估动作挂 8.13.7 启动 | ⬜（触发条件已锚定） |
| sha2 + serde | 8.12.2 账本 hash 链 | 薄自研 | 8.12 落地 | ⬜ |
| JSONL schema | 8.12.1 session 格式 | 只共享格式 | 8.12 落地 | ⬜ |

---

## 7. 待用户裁决项

> 这些不预判，遇到时由用户决定后移入决策记录。

- 日志卡：用户已表态几乎没用过（8.6 低频），倾向不迁移，收口终审确认；
- 范式卡：用户已表态可取消（kfmv4 自产实验物，远期再说），收口终审确认；
- apk 卡：用户已表态废弃（8022 直连手机，NA 线直接编译），收口终审确认；
- 多端适配/桌面浮卡：远期，待确认；
- 动画插件包：v1 组件零动画，是否要单独做动画包待确认；
- 开屏动画插件（用户 2026-08-22 实拍提议）：启动期 bootLog 文字先于
  终端卡出现（wasm 装载 + WS 连接 + PTY 孵化约数秒），视觉上已是
  「事实开屏」。若未来做开屏动画插件，正好填这段加载真空期，可作为
  动画插件包的首个用例，待确认；
- 其他 dsh 远期能力（subagent/workflow/mcp/lsp/acp 等）：9.x 再说，待确认。

---

## 8. 决策记录

> 用户每拍板一个“做/不做/缓做/顺序调整”，在此追加一行。

- 2026-08-18：kfm-nz 独立项目成立；TASK.md 为唯一开发任务图。
- 2026-08-18：8.10 定为 Obsidian 文件卡，8.11 定为池卡/配置。
- 2026-08-18：kfm-plugtest 立项，8.7.7 最小版，8.12.2 转正。
- 2026-08-18：开发期免 kfmv4 检查链；收口时整体过链。
- 2026-08-18：发版冻结 v4——kfmv4 version 冻结 8.6.0 至替换日；nz package
  version 恒 `9.0.0-dev`。
- 2026-08-18：工坊线整体推迟（六族契约 0–9 实施冻结），nz 不依赖工坊线；
  代码完成后重评重建。
- 2026-08-18：kfmv4 文档降级为规格书参考层；TASK.md 是唯一开发任务图。
- 2026-08-18：dsh 线按 9.0 线评审 8 条修订（测试 runner 插入、工坊线推迟、
  数据区策略、端口 8023、单写者、决策补全等）。
- 2026-08-18（补录）：**渲染底座本身不插件化**——宿主三分已是合适粒度
  （契约 №14），否定性拍板入档，防重新发起同题讨论。
- 2026-08-18（补录）：**窗口卡不自建工作区层**——调出窗口自己配置（四元组
  + 会话加载）；多光球状态持久化、光球入口数量可自定义。workspaces 仅作
  数据层组合池结构保留。
- 2026-08-20：9.0 线全面性补漏——0-4b NA 互证钩子挂 8.7.3（版本平移遗留）、
  待裁决区三项按用户已表态更新、DoD 第 5 条 plugtest 空窗说明、皮肤包
  基础包/覆盖包分层原则入 8.13.4。
- 2026-08-20：用户拍板——**工坊线非搁置，是顺序调整**：接着主线（9.0 收口）
  后面走；新增 9.x 工坊线阶段（4.7：重评会 → D1–D6 按需实施），9.0 收口
  加「热重载而会话不断」作 kfm-restart 自然退役判据。
- 2026-08-20：8.7.2 测试 runner 移植完成——nz 适配两处（declare process /
  assert helper），红验证（exit=1）+ 变异抽检双过；tests 纳入 typecheck
  （`allowImportingTsExtensions` 入 tsconfig）。
- 2026-08-20：8.7.3 渲染宿主 + 手势分发完成——四设计要件全落（连带清场 /
  owner 生命周期绑摘 / attach-detach 与 show-hide 分档 / 防重下沉）+
  层带公约强制校验（裸数字注册即抛）；守视实拍 + churn 基线
  （2000 次生灭 173ms、堆净增量 +1.1MB、零残留）；0-4b NA 互证待回填。
- 2026-08-20：用户拍板——**dsh = 9.0 线的双向讨论通道**（非独立线）；
  nz 实现由 9.0 线主力负责，落地通报由 9.0 线署名。
- 2026-08-20：评审 5 条处置——①nz 补 git 仓库（必修采纳：版本历史自
  骨架期状态起补齐）；②步号口径入 1.3（nz 独立编号，引 kfmv4 步号须注
  出处）；③dsh 分工入本记录；④package version 对齐拍板口径
  `9.0.0-dev`；⑤nz-taskmap-review 8 条处置闭环确认（数据区 2.5 /
  端口 8023 在 2.3 / 单写者在 1.2，8-18 已落实）。
- 2026-08-20：8.7.4 card-types broker 完成——№6 全语义落地（注册=效果
  回滚白送 / relied 守卫 / 拓扑+name 序枚举 / singleton 聚焦 / 实例户口
  serialize 交班）；契约双变异靶子实测抓获；考题总数 30 钉。
- 2026-08-20：**kfmv4 仓内提交纪律**（8.7.4 commit `6b1ba5ce` 混入事故
  整改）——入仓后 nz 提交只 `git add nz/...` 白名单式路径，提交前
  `git status` 全量核对；禁用 `git add -A`。事故全貌及处置见信箱
  `kfmv4-9.0-nz-874-landing-report.md` 第四节。
- 2026-08-20：评审复核混入事故处置——三条批准，追加两条：①混入错位
  的不只是归属，还有「未达可提交状态」的内容（bugs.md 把一处
  check-state-freshness 红带进 master，评审已补 BAR-AGENT-RUNNER-01
  复核日 2026-08-27，链复绿）；若再发生混入，入仓后第一动作=跑全链
  验红。②git 卫生 v0 检查立项（评审认领）：commit 时暂存区路径 vs
  线归属白名单比对，v0 只警告不拦截。详见 `kfmv4-9.0-nz-874-review.md`。
- 2026-08-20：8.7.5 安全包影子完成——permission.ts（№15 影子期：只记录
  不拦截）；v8 8.5.0 三处 nz 适配（内存审计+sink 口子 / declareRisk 动态
  登记替代静态表 / roots 显式注入）；dsh 参考：scope 父链（注册视图向下
  继承、事件许可向上延伸）与 permission-presets（preset=sandbox+approval
  两旋钮打包）确认留转正期；scope 口子 v1 只落日志。43 钉全绿，双变异
  靶子抓获；roots 骨架期置空（fail-closed）。
- 2026-08-20：8.7.7 kfm-plugtest 最小版完成——plugtest.ts（§2.4 八错误码
  全实现；残留检查=四 broker 快照 diff + 事件探针；串行纪律内部排队；
  降级探针语义定稿：公约错误/cordis without inject=有意降级合格，裸
  TypeError=DEGRADE_CRASH）；宿主/手势/安全各加一个计数探针口子
  （containerCount/handlerCount/declaredCount）。53 钉全绿，双变异靶
  抓获。DoD「新插件必过 plugtest」自此可执行。
- 2026-08-20：877 评审收讫——核实属实，观察两条：①clearTimeout 尾巴
  已顺手修（_disposeWithTimeout finally 清理，53 钉复绿）；②探针事件
  全局发射的误报风险留转正期（开放第三方插件时加被测者标识）。
  评审建议：「`[xxx]` 前缀 = 有意抛出的公约错误」应登记为全局公约
  （现散在各模块注释）——待契约文档下次修订时收录。
- 2026-08-20：用户拍板——**8.7.6 修订 + 任务图补扩充步**。①8.7.6 改
  「眼睛最小包（数据源=骨架自态）」（原试点三件套的手移 8.8.6）；②新增
  8.8.6 手单实例 / 8.13.6 眼睛全量段（数据源触发制）/ 8.13.7 安全包转正
  （契约 №15「9.0 真生效」的承接步，此前悬空）/ 8.13.8 手全量；③8.12.3
  验收追加「眼睛投影接入装配线」（消费者挂接防白看）；④cedar-policy
  触发条件锚定 8.13.7。**新规矩：凡「最小版/影子/单实例」进任务图，
  必须同时登记扩充步 + 触发条件**（防「最小即终点」第三次再犯）。

- 2026-08-20：用户拍板——**迁移总账机制落地**（v8→v9 完备性从信任问题
  变机械问题）。四层动作：①`check-ledger-coverage.mjs` 立（清单层
  code-inventory 机械生成 × 归宿层 nine-point-zero 组件台账咬合；三类红：
  无归宿行/死账/死锚）；②43 条 covers 机读锚点落台账 18 行（首跑 43 处
  无归宿全部裁决归组，含 capability-review 8-16 五缺口的闭环确认）；
  ③capability-review 初稿转正「✅ 已收编」；④挂检查链常驻。
  **方法论入档**：任务图自上而下、总账自下而上，双向咬合才算完备；
  凡「最小/影子/单实例」必登记扩充步（昨日新规矩）由本检查长期值守。
- 2026-08-20：№10 修订注② 插件作者指南入契约（零新文件——规范层寄生
  契约层）：新工具五件齐 / 附属 UI 卡=投影非旁路 / Rust 化三判据 /
  工具清单=gen-permission-map 活清单。
- 2026-08-21：用户拍板——**v8 部署新鲜度红不处置**：不为将死版本做
  仪式性部署（混入事故 commit 碰 src/ 触发，8-18 包 vs 8-20 源码）；
  9.0 收口 nz 迁入时自然消解。此前全链绿到此闸门为止。
- 2026-08-21：**875 评审两条代码发现修复 + 补钉**（影子期判定基线不
  能脏——转正期 8.13.7 的 C 档对账锚就是它）：①`_inRoot` 相对路径
  无条件界内 → 加 `_resolve` 归一化（相对路径以 roots[0] 为基准展开、
  逐段消解 `..`，roots 为空 fail-closed 落 ask），`../../etc/passwd`
  逃逸洞封死；②exec 空 command 短路放行 → 新 rule `exec:empty-command`
  落 ask，与 write_local 空 path 同 fail-closed 口径。各补对称钉，
  55 钉全绿。审计缓冲无上限的观察记入 8.13.7 承接范围（转正接
  ledger-service 时截断/背压）。
- 2026-08-21：**链红复发处置收讫**（评审升级 git 卫生 v0 = 白名单 +
  commit 时秒级快链子集进钩）。本线整改 = commit 后第一动作跑全链
  写为铁律，不依赖记性。
- 2026-08-21：用户拍板——**check-deploy-freshness 退役（①+延迟②）**。
  v8 侧按退役协议退役：脚本+钉删（守护代码已删=正常退役），chain STEPS
  除名，build.mjs --soft 摘除，机制注册表部署运河行/infra 台账/bugs 账
  同步标注，派生文件（scripts-catalog/code-inventory/sync-counts）gen
  回写；浏览器侧 version-watch 横幅仍在役（现唯一防线，注释已更新）。
  **重生条件锚定 9.0 收口步**：nz 部署目标存在时以新对象重生该检查
  （任务图 9.0 行已点名）。此前全链末端永久噪声自此消除。
- 2026-08-21：**8.7.6 眼睛最小包落地**（Cordis 全流程首例 bundle，用户
  发话开工）。实现要点：①dynamic-prompt-files 基建 = 骨架期内存版
  （接口按读写删列+变更事件设计，fs 后端留 server 落地步换实现不换
  接口；文件名纪律=裸文件名拒逃逸，公约错误）；②eyes 总插件挂
  「eyes/refresh-requested」公开触发口 + 段注册即刷新（真触发
  tool/finished、snapshot/updated 等生产者 8.12.x 落地后改挂——数据源
  触发制）；③探针实证入档：ctx.inject 回调式在依赖缺失时不卡 fiber
  （fiber 照常 ACTIVE，回调等待），裸 context 降级探针因此天然合格；
  ④整包启停原子性 = 成员挂为调用者 fiber 子插件，父 dispose 逆序连带
  （cordis 纤维树白送）。验收三件套齐：抽文件两式钉（变异抽检=broker
  账变化投影反映 / 配置禁用=关段缺段）+ 禁用无损钉（遗言占位+broker
  零变化+基建独立）+ plugtest PLUGTEST_OK。62 钉全绿。
- 2026-08-21：用户拍板——**nz 服务端先跑起来（8023）**，8.8.1 首件 =
  服务端最小出生（HTTP 静态 + 服务端 cordis 根总线），真端口可验证
  优先于会话管理内核。落实两条惯例迁移：静态路径原样拒 `..`（403
  显形 fail-closed，875 教训第二次迁移）；hello 见证插件模式从客户端
  复用到服务端（双侧总线同款出生仪式）。端口口径：8022 = v8 生产，
  8023 = nz，并存互不打扰，9.0 收口归位。tsconfig 加 @types/node
  （nz 不再是纯客户端工程）。WASM 终端芯评估挪 8.8.2 门口的提议
  待用户拍板（本步未执行该评估）。
- 2026-08-21：**评审代改收编（commit 95ee8a04）**——`server.listen(port)`
  裸绑 `*` 等于公网直开，而 slog 声称 127.0.0.1：声称的语义与代码实际
  不一致，日志是给后来者的承诺，承诺错了比没有承诺更糟。代改 = 默认
  绑 127.0.0.1（访问通道 = kalo 隧道 -L 8023），NZ_HOST=0.0.0.0 显式
  可选——「显式选择可达性」而非「默认可达」。收编入档。
- 2026-08-21：**通报纪律再进半格**（876 隔夜补、8.8.1a 用户捅破，两次
  漏通报后升级）：通报与落地 commit **同批或紧随**，间隔以小时计就会
  漏。自查口径：TASK 快照「刚完成」翻步时，信箱必须已有对应通报——
  先靠自觉，再漏一次就机械化（进检查链）。
- 2026-08-21：**8.8.1 终端连接家族落地**（用户发话开工；设计要点经
  用户讨论确认：先跑服务→会话管家；PTY 不 Rust 化三判据对账——非
  计算密集/node-pty 已验证/接入复杂度净增，Rust 化发生在 8.8.2 解析
  核而非连接层）。传输无关化后的重连语义定稿：会话不绑定消费者，
  attach(sessionId) 复挂 + replayTail 封顶尾迹补断档——比 v8「WS 重挂」
  干净（消费者生死与会话生死解耦）。tmux 管理服务（TmuxService 六
  方法）不在本步——任务图 tmux 完整管理归 8.8.5，本步只交连接层
  五动作。
- 2026-08-21：用户拍板——**终端芯 WASM 评估挪 8.8.2 开工第一步**
  （kfmv4 图 v10 修订同步）：评估对象是渲染芯（解析层），连接家族
  不消费它。8.8.2 动作序列定稿：①WASM 工具链 + alacritty/rio-vt
  解析层基准（只计解析层——NA 方法学）→ ②解析核 WASM 包 →
  ③TS 渲染壳 → ④卡壳接卡片系统。
- 2026-08-21：用户拍板——**终端解析芯裁决翻盘：nz 用 rio-vt→WASM**
  （评估报告 nz/experiments/term-core-eval/REPORT.md）。翻盘理由：
  ①alacritty_terminal 根本上不了 wasm32（非 target-gated 的 polling
  依赖 compile_error!，不是 feature 能关掉的）；②rio-vt 关默认
  feature 开箱过 wasm32，且解析层吞吐 plain 4.9x / color 2.1x /
  fullscreen 1.25x / cjk 持平。NA 侧 alacritty 不动；两线行为一致
  靠「同源解析行为考卷」保证（同语料喂两家解析器 diff 网格，比同
  crate 更强的机制——crate 可以换，考卷不过不许发版）。复活触发：
  rio-vt 功能缺口或行为考卷长期不齐 → 重议。
- 2026-08-21：**8.8.2 探针落地**（rio-vt WASM 包装 crate 第一小件）：
  `nz/term-core/`（kfm-term-core：new/feed/resize/text/cursor，解析
  入口与评估靶场 rio harness 同款，保证评估数字=线上路径）+ TS 装载
  壳 `src/client/term-core.ts`（浏览器动态 import / node initSync 两
  条装载路径）。验证：cargo test 3/3（含 SGR+CJK 宽字符、resize 保留
  内容）；node 冒烟 PROBE OK；typecheck/70 钉/build 全绿；8023 四个
  资产全 200。两个网格事实入档：空白格 c='\0'（非空格，dump 归一）；
  宽字符有 spacer 占位格（dump 跳过）。wasm 产物（public/term-core/）
  与 target/ 不入仓，build:term 一键再生成。浏览器侧运行时当日晚
  守视实拍补上（8023 eval `__kfmNzTermProbe` = PROBE OK cursor=1,2，
  与 node initSync 路径同结果）——两条装载路径均实证。
- 2026-08-21：**采纳 NA 线重编译降压建议**（kfm-na-heavy-build-nice-notice）：
  build:term 的 cargo build 包 `nice -n 10 ionice -c2 -n7`——本线两次
  未降压编译曾把 NA pre-commit 链拖超时 30 分钟（4 核机 load 6+）。
  机器空闲时速度不变，撞车时交互进程优先。本线后续手动跑的长编译
  同样自觉包降压。
- 2026-08-21：评审 882 复核收讫（用户逐项拍板）：
  ①**功能覆盖考卷前置接受**——升为 8.8.2 收口硬门，插在渲染壳前
  做：NA 在用解析序列全集差分（非抽查），rio-vt 缺序列即触发复活
  重议。吞吐+wasm 过关 ≠ 功能覆盖过关，考卷先堵这个口。
  ②**跨线依赖登记**（本条即登记）：NA harness 接语料出口。
  交付判据 = NA 侧 harness 能读 `nz/experiments/term-core-eval/corpus/
  *.bin`（同字节）并 dump 出网格文本/状态供两线 diff；追责点 = 覆盖
  考卷对跑开工时 NA 出口未就绪即停滞。③编译 cgroup 隔离立项——
  用户委托评审线全权（视角更全），本线不另立。
- 2026-08-21：**功能覆盖考卷 v1 落地，45/45 全等**（nz/experiments/
  term-core-eval：src/bin/exam.rs 题面 + src/dump.rs 双侧网格同一文本
  协议；题面三来源=REPORT 未评估清单+NA 源码核查消费清单+xterm 常规
  面）。首跑唯一 DIFF 是亮色枚举命名差（BrightRed vs LightRed，同一
  槽位非行为差），token 归一后全等——rio-vt 行为面零差异，复活触发
  无弹药。判读纪律：DIFF≠rio 错，逐题人工研判谁是 xterm 标准行为。
  考卷进发版硬门的接线留 8.8.2 收口。跨线依赖（NA harness 语料出口）
  状态：题面已自备（exam.rs 内嵌 + corpus/*.bin 落盘），NA 出口未
  就绪不挡 nz 侧考卷，只挡「NA 侧反向对跑」。
- 2026-08-21：**行级 DOM 渲染壳（选型 C）留白登记**——浏览器原生选中
  复制白送，但有两个已知毛边，留待 selection 插件治理（勿忘）：
  ①**软换行复制断行**：逻辑行跨屏折行时，原生复制中间多一个换行符
  （浏览器不知它俩本是一条）。治法：selection 插件拦 copy 事件，按
  WRAPLINE/软换行标记把续行接回（rio 网格有 wrap 标记可查）。
  ②**可选范围=渲染范围**：回退 1000 行但 DOM 只放当前屏附近（虚拟
  化），一次最多选当前屏上下一段——xterm 同款行为，不算退化；若
  未来要「整段回退可选」，selection 插件拦 copy 时从 wasm 网格取
  全文而非依赖 DOM 选区。另：selection 插件远期候选——矩形块选、
  「一键选中本命令全部输出」（均需自研，参考 v8 terminal-card-04.ts
  手柄层 + NA termview.rs 选择状态机两份自家答案）。
- 2026-08-21：**8.8.2② 渲染壳落地**（选型 C 行级 DOM）：wasm 侧新增
  `render_frame()` 取数协议（逐行 `text\x1f样式边界表`，边界含回默认
  的空 token；start 为字节下标）；TS 侧 `src/client/term/palette.ts`
  （16 色/256 立方/灰阶/rgb，token 词汇与考卷同源）+ `term/shell.ts`
  （行 div + 样式段 span，行缓存只重排变行，光标反色块）。守视实拍
  PASS：蓝目录/绿粗体/品红压缩包/粗黄警告/256 色/真彩色/反色条/
  CJK/下划线/删除线/光标块全对。两个坑入档：①Rust doc 注释含 `*/`
  会被 wasm-bindgen 抄进 JS 块注释提前封顶（`Bright*/idx` 教训）；
  ②空样式边界必须出全字段 `N,,,;`——少逗号时 JS split 拿到
  undefined，字符串 'undefined' 含 u/i/d 三个字母会误中样式判定。
  复制/选择手柄/系统放大镜=浏览器原生（行 DOM 白送，零自研）。
- 2026-08-22：**8.8.2③a 评审两条前置消化完毕**：①list 口径——exited
  会话不向 list() 暴露（客户端不见尸体），死会话仍可 attach 捞
  exit code/尾迹直到 close/卸载；尸体 linger 无 reaper 记留白。
  ②open 挂权限判定——permission.ts 是同构纯 TS，服务端同引擎各挂
  各总线；term.open 登记 exec 户口，交互 shell 以 shell 路径送审
  （no-meta→allow），-c 命令含元字符→ask；影子期只落审计（sink 进
  serverBootLog），转正期在 WS 桥边界生效。新钉 2 枚（72 钉全绿）。
  cordis 纪律新知：ctx 访问未 inject 的服务抛「without inject」——
  可选服务一律 ctx.get(name) 非严格访问。
- 2026-08-22：**8.8.2③bc 落地，终端真链全通**。③b 服务端 WS 桥
  （`src/server/ws-bridge.ts`）：帧↔方法翻译层，协议 open/attach/
  input/resize/close/list → opened/attached+tail/output/exit/error；
  订阅退订必须挪到 exit 帧发出之后，否则 exit 帧发不出去。钉 2 枚
  （全链 echo 回环 + 断线会话不死 attach 补断档），74 钉全绿。
  ③c 客户端合龙：`term/bridge.ts`（重连指数退避；replay 帧标记；
  open() 返回 Promise、opened 帧 FIFO 配对）+ `plugins/term/index.ts`
  （卡型注册 'term' + ctx.provide('termCards')；open() 建容器
  （layout 层/owner 'term'）+ TermCore + TermShell + keydown→PTY
  字节映射；**replay 帧先重建 TermCore 再喂 tail**——tail 是快照
  尾迹非增量，喂旧网格会花屏；shell 加 setCore() 清行缓存）。
  静态 TERM_DEMO 演示退役。守视实拍 PASS：真 PTY 提示符 +
  `echo NZ-TERM-OK && pwd` 全链回环（浏览器 keydown→WS→PTY→wasm
  解析→行 DOM）。**本步最大坑入档：wasm-bindgen glue 禁止二次
  init**——main.ts 探针与终端卡各自调 loadTermCoreBrowser()，第二
  次 init 把 glue 的 wasm 导出绑定换成新实例，旧实例出生的
  TermCore 指针喂进新实例函数表 → RuntimeError: memory access out
  of bounds（OPEN FAIL）。修法：term-core.ts 新增
  `loadTermCoreShared()` 全局单例 promise，探针与终端卡同走一路。
  依赖新增 ws@8 + @types/ws（服务端 WS 桥用）。
- 2026-08-22：**终端卡软键盘入口**（用户手机实测发现）：移动浏览器只在
  可编辑元素聚焦时弹软键盘，div+tabIndex 无效。采用 xterm 同款隐藏
  textarea 诱饵（.kfm-term-kb，1px 透明）：pointerdown 聚焦诱饵；桌面
  按键走 keydown（原 keyToBytes 映射），手机 IME/软键盘走 input 事件
  整段取走后清空（换行 \n→\r）。守视回归 PASS（KB-OK 回显）。
- 2026-08-22：**软键盘弹不出的真凶=空 overlay 层根吃点击**（宿主级
  修复）：三个层根 position:fixed inset:0 全屏叠放，persistent/overlay
  空层也拦截全部指针事件——点终端实际点在空 overlay 上，焦点永远落
  不下去（守视合成 click 直调处理器发现不了，真实 CDP 点击才暴露：
  事件日志全空 → elementFromPoint 揪出 #kfm-layer-overlay）。修法：
  上层根 pointer-events:none 透明放行，容器落上层时单独开回 auto。
  同批教训：聚焦诱饵必须挂 click 而非 pointerdown（按下默认行为会把
  焦点抢回 body，且 preventDefault 会杀死原生选中复制）。宿主补钉
  1 枚（层根放行 + 容器开回），76 钉全绿。守视真实点击→focus 落
  kb→echo FOCUS-OK 全链 PASS。
- 2026-08-22：**键盘跟随**（用户手机实测②）：软键盘弹起后光标行被盖
  住。两手：①index.html viewport 加 `interactive-widget=resizes-content`
  （Chrome 108+ 键盘弹起时收缩布局视口，fixed 层跟着矮）；②光标跟随
  ——shell.renderFrame 摆完光标后 `scrollIntoView({block:'nearest'})`
  （能不滚就不滚），插件侧 visualViewport resize 兜底滚到底（iOS 不认
  ①时用）。v1 留白：终端核尺寸仍固定 80×24，行列实测量 + resize 帧
  下行留后续小步。守视回归 PASS（FOLLOW-OK 回显），真机键盘挤压
  效果待用户实测。
- 2026-08-22：**终端卡半屏+无法滚动的真因=样式覆盖**（用户手机实测③）：
  TermShell 构造函数对根元素整句 cssText 赋值，而插件把容器本体传了
  进去——容器的 inset:0 全屏定位被冲掉，缩成内容高（24 行≈半屏），
  滚动视口同步失效。修法：容器只做全屏滚动视口，壳画在新建的内层
  div 上。纪律入档：**给别人的元素设样式只能追加，不得整句覆盖
  cssText**。另澄清 v1 口径：DOM 只画当前屏 24 行，回退历史在 wasm
  核里未渲染上屏（虚拟化留白，后续小步做），所以现在「没有可滚的
  内容」是预期行为而非 bug。
- 2026-08-22：**实测定尺寸落地**（用户手机实测④「还是不能全屏」——
  写死 80×24 的双症状：列溢出裁字 + 24 行只填半屏）：①插件 open 前
  用与壳同字体探针量字格（cellW/cellH），按容器 clientWidth/Height
  实测行列（下限 20×5，量不到回落 80×24）；②visualViewport resize
  时核/壳/PTY 三方同步（core.resize + shell.resize 增删行 div +
  bridge.resize 下行 PTY）；③replay 重建核用实例当前行列不再用常量。
  守视实拍 PASS：stty size=52×49（PTY 真实尺寸=实测尺寸），40 行
  输出铺满全屏不裁字。本步提前消化了原留白「按容器实测 + resize
  帧下行」。
- 2026-08-22：**滚动/闪烁/吞行三连修**（用户手机实测⑤）：根因两条。
  ①scrollIntoView 会把所有可滚祖先（含背景 boot 页）一起滚——每敲
  一字回显都带全页从头滚=闪烁；改手写 nearest 语义只滚终端容器
  （光标在视野内就一动不动）。②背景页本身可滚（boot 日志比屏高），
  与终端抢滚动=「能滚动一部分」错觉；终端卡全屏期间 body overflow
  hidden 锁死（dispose 复原），容器 v1 改 overflow:hidden（没有可滚
  内容，scrollback 渲染落地时改回 auto）。③吞最后一行：部分浏览器
  不认 interactive-widget，键盘直接盖页面——visualViewport resize 时
  若可视高<窗口高-40px（阈值防动态工具栏误判），手动把容器高度压到
  可视高（JS 模拟 resizes-content），再重测行列三方同步。守视实拍
  PASS：51 行正好铺到屏底，提示符完整露出，scrollTop=0 不乱滚。
- 2026-08-22：**resize 防抖**（用户手机实测⑥「打英文从上往下闪」）：
  IME 候选栏每敲一字伸缩可视高几十像素 → 立刻跟改行列 = 核重排 +
  全屏重绘 + PTY SIGWINCH 三重闪烁。修：容器高度即时跟上（不吞字），
  行列变更 150ms 防抖等稳定。**Termux 纪律入档**：①尺寸量化（整行
  整列变，像素抖动忽略——floor 已做）；②布局稳定才改尺寸（键盘
  动画/候选栏伸缩绝不触发 SIGWINCH——本步补上的）；③渲染与缓冲
  分离。守视回归 PASS（DEBOUNCE-OK）。
- 2026-08-22：**IME 合成纪律 + 真机诊断角标**（用户手机实测⑦：中文
  光标漂移变灰、英文仍闪）：①合成（composition）中间态曾全量发给
  shell 且每次清空诱饵打断合成——拼音碎片（n/ni/nih…）+最终汉字
  全灌进 shell，行内垃圾字符把光标越推越远。修：compositionstart/
  end 标记合成态，中间态 keydown/input 一律不转发不清空，上屏
  （compositionend）才发最终文本。②诊断角标（overlay 层，右下
  半透明小字）：vp=可视区事件 rz=落地行列变更 f=渲染帧 rp=重排行，
  每字健康值≈1帧1行——手机无控制台也能读数，守视可 eval
  __kfmNzTermDebug。排查期常驻，收口移除。
- 2026-08-22：**IME 合成纪律 v2 + 高度跟随防抖**（用户手机实测⑧）：
  ①英文仍闪真凶=高度跟随没防抖（上一轮只防抖了行列变更）——vp 实测
  每字 +1（候选栏每键伸缩），容器高度每字跳一下=肉眼闪烁。修：高度
  压可视高也挪进 150ms 防抖块。②中文光标仍漂移=合成结束读输入框
  拿到的是拼音残影+部分浏览器 compositionend 后补发同内容 input
  （"你"发两遍）。修：compositionend 只认 e.data，记 justCommitted
  吞掉补发事件。
- 2026-08-22：**计数口径定规**（评审 ③bc 信问「75 vs 76」，③a 也曾
  差 2——根因=commit 题手写「钉」数是会腐坏的快照，且「钉/考点」
  与 npm test「passed/用例」本两个口径）：即日起 commit 题与通报信
  不手写钉数；引用计数以当时 HEAD 实测 `npm test` passed 数为准并
  注 HEAD 短哈希（如「76 passed @ da8b714d」）；「钉」只作概念词。
- 2026-08-22：**光标列号探针**（评审 IME 取证信）：window.__kfmNzTermCursor
  () → { col, row, cols, cellW }，纯读无副作用。评审 headless 已证字节
  层一字不差（20/20 汉字），光标漂移是列号累积偏而非双发；探针落地
  后评审出逐词漂移曲线。守视侧自验：基线 col=32，打「你好」后 col=36
  （CJK 一字两列，直发字节路径正确）。英文闪的怀疑链收窄到「软键盘
  resize→整网格重绘」，真机盯角标 rz 是否每击 +1 坐实。
- 2026-08-23：**IME 事件流探针**（评审取证信：干净合成零漂移，真凶在
  真机真实事件序列）：URL 带 ?debug 时，composition 四事件 + input +
  keydown + viewport 事件逐条 sendBeacon 到服务端 POST /debug/ime-log
  落 /tmp/nz-ime-events.log（JSON 行：t/data/composing/v=输入框残影值）。
  纪律：诊断监听必须注册在业务监听**之前**（否则读到的 kb.value 是被
  清空后的残影）；诊断通道失败不挡主流程；落盘 /tmp 易失不入仓。
  角标加 col（首卡光标列号，评审次选项同步落地）。守视端到端验证：
  ?debug 开页打 ab → 日志逐条 keydown 落盘。8023 服务重启纪律补记：
  pgrep 按命令行模式找不到 tsx 包装进程时用 ss -tlnp 按端口找 PID。
- 2026-08-23：**IME 黑匣子两根因落地**（评审回放 168 事件实锤）：
  ①光标漂移=格网光标 vs CJK 字形自然推进不裁格（每字累积偏 0.4 格）
  ——修：宽字符（EAW W/F + emoji 区间）渲染时逐个裁进 2×cellW 固定
  格（inline-block 裁切），真终端同款纪律。自验：col=42 时字形右缘
  =42×cellW=328.10px 与光标 x 精确对齐。②英文抖=有滚动内容时 resize
  无条件滚到底挤兑——修：砍掉 viewport 事件里的 followBottom，光标
  露出只由 shell renderFrame 的 nearest 滚动兜底（被遮才滚）。
  ③黑匣子新知入档：真机小鹤音形(Via) 走纯 input 分支（0 条
  composition 事件，v==data 无拼音残影）——composition 纪律那套
  在该 IME 上根本不触发，input 分支才是主路。④测量纪律：row 文本
  尾部有填充空格，量文本右缘要用末字符节点而非整行 range。
- 2026-08-23：**IME 讨伐收官**（用户真机确认三症全解）：二次根因修复
  f1de48db——①双光标=DECTCEM ?25 藏显未从核暴露（TUI ?25l 藏终端光标
  自绘反色块，壳光标不藏变灰鬼影）：term-core 新增 cursor_visible()
  传导壳层；②英文抖=诱饵 textarea 钉死 0,0，浏览器每 input 把它滚进
  视野拽回 scrollTop=0 与 nearest 兜底拔河：诱饵改钉光标格（placeKb，
  xterm 同款）+ focus preventScroll。③复盘四条裁决（评审
  ime-retro-review）：探针骨架常驻/临时字段移除/计数单源=gen/方法库
  开工前扫/agent-send C-m 自验进脚本。
  **收口口径修订（裁决①）**：8.8.2 收口时 ?debug 黑匣子**不整体移除**——
  sendBeacon 管道 + 字段注册点为常备基建保留；col/cv/cb 等 IME 专用
  字段随症状收口移除；诊断角标移除。此前日志里「排查期常驻，收口移除」
  的旧口径以本条为准。
- 2026-08-23：**用户拍板·tmux 线提速 + 弃 8.x**（会话拍板，评审同步盯梢）：
  ①8.x 有一个修不动的 IME 滚焦坑，用户决定弃 8.x——nz 终端已自带
  preventScroll + 诱饵钉光标格（8.x 缺的解），九线不用担心 IME 滚焦/
  闪烁回归，8.x 不再投 IME 修复工时；②「9.0 至少 tmux 窗口功能好了」
  = 用户直接迁用的判据——8.8.3（刷新全屏终端）→ 8.8.4（tmux 标签）→
  8.8.5（tmux 完整管理）为当前最高优先；③8.8.2 收口硬门（考卷全集
  差分）与 tmux 三步零代码耦合（验的是解析核，三步不动核），可并行——
  硬门不取消，挂点从「8.8.2 收口前置」后移为「8.8.5 闭环前置」，风险
  敞口期由真机实拍 + NA 差分双覆盖；④评审盯 tmux 落地：A/B/C 档 +
  真机数字收口（C 档实拍为准，headless 只配写「待真机对账」）。
  轻量收口三件（对照表核对/M3 基线/通报信+探针按新口径收口）先行，
  量小不关 tmux 线闸门。
- 2026-08-23：**8.8.2 收口**（轻量三件落地，考卷硬门按拍板归 8.8.5 闭环
  前置）：①功能对照表核对落档 `nz/docs/term-checklist.md`（连接/渲染/
  输入/尺寸滚动/诊断五族全绿，验证依据分自动化/守视/真机三级，真机
  专属症状以真机数字收口）；②M3 终端视觉基线存档 `nz/tests/m3-baseline/`
  （term-fresh + term-sgr-cjk 两态 + sha256 清单 + 复拍口径）；③诊断
  探针按复盘裁决①收口：角标移除、IME 专症字段（col/cv/cb）+ 两个
  window 探针（__kfmNzTermDebug/__kfmNzTermCursor）+ cursorBlocks()
  移除，?debug 骨架（sendBeacon 管道 + /debug/ime-log 端点 + 通用健康
  字段 f/rp/sc/rz）常驻。通报信 kfmv4-9.0-nz-882-closeout-notice。
- 2026-08-23：**8.8.3 落地（守视绿，待真机收口）**：刷新即全屏终端——
  开屏日志面板默认隐藏（index.html 首屏前内联脚本判定，无 ?debug 加
  `nz-term-first` 类，bundle 加载前生效杜绝闪帧），?debug 时面板与
  轮询渲染照常（双态守视 eval 实测：无参 panel=none card=ci-1 /
  ?debug panel=block 日志正常）；main.ts 轮询渲染收进 ?debug 门控，
  bootLog 填充不受影响（__kfmNz eval 直读恒可用）。守视实拍：首开即
  终端提示符全屏，无开屏文字。typecheck 0 / npm test 76 passed /
  build OK（62932B）/ smoke PASS。真机数字收口：用户当日刷新确认
  「确实没问题」✅，本步关账。
- 2026-08-23：**8.8.3c 立项·scrollback 历史渲染上屏**（用户拍板）：
  随手上滑翻历史=基础体验，9.0 体验不得比 8 倒退；AI 长对话场景
  必须可回翻；tmux copy-mode 不作替代（用户从没用过翻页模式）。
  排序挂 8.8.3b 之后、8.8.4 之前——tmux 三步开工前终端本体体验
  先齐。关键纪律：跟底判定（新输出仅当视口在底部才跟底）、输入
  即回底（xterm 同款）、与 IME 钉光标格/吞末行根治两纪律兼容。
- 2026-08-23：**8.8.3b 落地（A+B 绿，待真机收口+评审）**：仿 Termux
  按键栏两排七列（键序照 NA KEYS 逐格对齐，键序有考题盯）+ keymap
  纯逻辑（term/keymap.ts，语义逐行移植 NA keymap.rs）。核加
  `app_cursor()` 暴露（Mode::APP_CURSOR，?1h/?1l 两向有钉）。四纪律
  落地：①一次性粘滞（ModifierState toggle/take，落字读走清零+灭灯）
  ②keymap A 档 8 题（Ctrl+ASCII→控制字节/Alt=ESC x/SS3-CSI 两模式/
  粘滞清零）③栏随键盘上浮（overlay 条带贴可视区底，vv resize/scroll
  双追；终端容器底部常驻预留 KEYBAR_H=84，手动压高路径同扣）
  ④键序考题。浏览器侧特有纪律：pointerdown preventDefault 保焦点
  （焦点离诱饵=软键盘收摊）。验证：cargo test 5 绿（含 app_cursor
  新钉）/ npm test 84 passed（+8）/ typecheck 0 / build OK（65898B）
  / smoke PASS；守视真链冒烟：ENTER 提示符 3→4→5、Ctrl→c=^C 提示符
  5→6 且灯自灭、按键栏按压焦点不丢诱饵。真机收口（上浮跟随/手感）
  待用户实测，评审信随后。
  **同日评审通过**（kfmv4-9.0-8.8.3b-keybar-review）：A/B 档全过、
  粘滞三路径无陈旧 bug；③键序按评审建议留 NA 一致不自定义
  （肌肉记忆资产，自定义等真实需求再开口）；①上浮可靠性=C 档
  真机对账（用户弹键盘看栏跟不跟、盖不盖，OK 即收口）。
  **同日修 bug**（keybar-click-bug-review，红测先立后修）：cssText
  全量赋值冲掉宿主内联 pointer-events:auto → 整条栏对真实点击透明
  （合成事件不走命中测试，故 dispatch 自测漏检）；修复=条带 cssText
  补回 pointer-events:auto + 注释立戒。tests/browser/keybar-click
  .test.mjs 0/3→3/3 绿（playwright E2E 首例，进 CI 立项留 8.8.5 前
  tooling 清单）。fix @ f99fc67a。
- 2026-08-24：**8.8.3b 收口 ✅（上浮被盖症五轮讨伐落幕）**：
  判尺结论 vm=vv 真尺（575a7eb2 barStrip 单基准 top 锚 vv + 容器
  出生即钉 + bundle 哈希缓存破坏）→ 过渡帧闪帧真凶=150ms 防抖滞后，
  修法=pinToVv/updateBottom 当拍钉 vv、重测行列留防抖（be5f95b1）
  → Via 有栏+键盘态 vv.height 虚报 ~42px 属浏览器硬限制，落地
  `?kbOff=<px>` URL 代字（栏底=vv底−kbOff，无参数=0 现状不改，
  ?debug 报 kboff 命中值，02739919）；用户拍板「Via 硬限制接受
  现状」收口。专症字段（ih/vh/ot/dch/kbb/kbc/brt/brb/fx/vm）+
  双轨校准色条随症拆除（复盘裁决①），kboff 命中标记随常驻代字
  保留；?debug 骨架（f/rp/sc/rz + 字段注册点 reportViewport）常驻。
  验证：84 单测 / smoke / 点击 E2E 17/17 全绿，bundle v=739a975a。
  用户若日后想调：Via 链接加 ?kbOff=42（±2 试）即生效。
- 2026-08-24：**8.8.3c 落地（实现全绿，A 档 3/5 待修卷裁决）**：核加
  history_len/lines_evicted/history_frame(from,to) 三 API（绝对游标
  =evicted+相对下标；GridIterator 先走一格再出账，从目标行上一格
  起跳）；dump_frame 与 render_frame 共体。cargo 钉 6/6（攒行/区间
  切片/截断丢最旧）。壳：历史 DOM 块增量渲染（截断摘顶/错位整段
  重建/正常只 append 尾巴），光标 nearest 兜底加 autoScroll 闸门。
  插件：集中状态机落地（新输出仅在底跟底/滚动双向翻转/打字+按键
  栏+IME 落字回底/合成中不回底）+ __kfmNzTermScroll 钩子契约。
  容器 overflow:auto。A 档实测 ①a✓②a✓③✓；①b 卡考卷 textContent
  无换行假设（div 拼接无 \n，行锚正则失效，塞 \n 会毁掉原生复制），
  ②b 与③同流程期望互斥（输入回底纪律下不可能同时成立）——证据
  +修卷建议已回函评审（kfmv4-9.0-scrollback-response）。B 档千行
  冒烟绿：2000 行灌入历史恒 1000 封顶、截断稳定、无崩溃。
  fix/feat @ 6d261e15。
- 2026-08-24：**8.8.3d 两区模型·固定底部输入行（用户拍板设计变更）**：
  根治「无代字时正在打的命令行被输出顶出视野」（?kbOff 只是碰巧
  掩盖）。行模式：光标行剥出滚动区恒钉底，输出只进滚动区输入行
  不动；滚动区复用 8.8.3c 增量渲染+状态机；光标块迁入输入行。
  ALT_SCREEN 切单区整屏（核 alt_screen() 模式位钉；两模式行列恒定，
  切模式不触发 PTY resize）。布局红利：按键栏+输入行改容器流内
  绝对分区（8.x aux-bar 存活模式），条带追 vv 的判尺/过渡帧/双基准
  复杂度结构性退役，updateBottom 无操作化，?kbOff 迁至容器钉高。
  钩子 __kfmNzTermInputRow 已暴露。考卷：fixed-input-row A 档 5/5
  一遍过 + scrollback 5/5 + keybar-click 17/17 + B 千行（输入行
  620→620 不动）全绿。fix/feat @ a082f87f。待 C 档守视/真机。
- 2026-08-24：**8.8.3d 布局更正**（用户实拍定序）：命令行移至按键栏
  上方、按键栏垫底拇指区（inputRowEl bottom:0→KEYBAR_H、barStrip
  →bottom:0；钩子 isAtBottom 锚随迁）。scrollback 5/5 + keybar 17/17
  不回退；fixed-input-row ①红=考卷锚点仍是旧布局基准（bottom=536=
  innerHeight−84 正是设计位）。**①修卷裁决（评审 2026-08-24）**：①红
  =考卷 artifact 属实，采纳 isAtBottom 语义锚（不锚像素，键栏高可调
  不碎），①块改断 isAtBottom+底部区域（test 1d68bf2d），重跑 A 档
  5/5 绿 → A 档修正通过、实现正确；待用户真机 C 档收口。
  fix/feat @ a082f87f（两区模型）· 5e3dd75c（布局更正）。
- 2026-08-24：**8.8.3d 单区底锚定（用户拍板回退两区）**：评审契约信
  kfmv4-9.0-single-zone-bottom-anchor-review——不要两区，要单一连续
  终端区：最底=最新 / 输出续输入下上滚 / 空屏提示符也在底行 / 去掉
  独立固定输入行；两区 C 档作废由新信 A/B/C 接管。实现 @ 7aa1962b：
  壳塌尾空行（渲染到 max(光标行, 最后非空行)，尾空行 display:none）
  + 容器 flex 列画布 margin-top:auto 底锚（空屏提示符贴底行、上方
  留白、超屏真滚动）；光标行模式/ALT 统一进滚动区同式摆位 + nearest
  兜底；placeKb 钉光标格可视位（cursorOffset.y−scrollTop）；钩子
  __kfmNzTermInputRow 退役明示、__kfmNzTermScroll 保留、cursorEl 加
  .nz-term-cursor 取证锚；按键栏流内垫底、?kbOff/钉 vv 纪律不动。
  考卷处置：fixed-input-row.test.mjs 作废删除，bottom-anchor.test.mjs
  接管 A 档 **5/5 一遍绿**；不回退：scrollback 5/5 + keybar 17/17 +
  npm 84 + smoke + cargo 7/7 全绿。已知悉拍板：单区下输入行会被后续
  输出顶动（自然终端手感优先，如后续要缓解再议），不回滚两区。
  待 C 档真机（底锚定视觉+上滑翻历史+键盘弹起整体上移）。
- 2026-08-24：**PTY 登录 shell 根治**（用户发现 web 终端无 oh-my-zsh，
  评审信 kfmv4-9.0-pty-login-shell-review）：根因=默认 shell 取
  process.env.SHELL（服务拉立方 /bin/bash）而非 /etc/passwd 登录 shell
  （/usr/bin/zsh）。修法=resolveLoginShell()（passwd 按 uid 取末字段，
  校验绝对路径+存在性，受限环境退回 env.SHELL→/bin/sh 不硬报错）+
  spawn env 覆写 SHELL=登录 shell；-c 分支不变；-l 权衡不加（oh-my-zsh
  在 .zshrc，交互态已够，.zprofile 副作用非必须不引入）。回归钉 4 断
  言入 term-connection.test.ts（npm 85 绿）。8023 服务已重启生效，
  headless 实证提示符变 oh-my-zsh ⚡ 主题。fix @ fb9b6841。
  遗留：keybar-click 点 ENTER 断言偶红（17/17 与 16/17 交替）=考卷
  artifact（clickSends 零等待快照，zsh RTT 慢于 bash），修法建议已随
  回函请评审裁决。待 C 档真机（oh-my-zsh 提示符+字形无乱码）随单区
  底锚定 C 档一并收口。
- 2026-08-24：**配色换 NA 板 + 捆绑 Nerd Font**（用户守视拍板，评审信
  kfmv4-9.0-palette-font-na-review）：palette.ts 16 色逐值对齐 NA
  ANSI_16（黄=VGA 棕/蓝=品牌正蓝 #3B82F6）+ TERM_FG 白/TERM_BG 黑；
  捆绑 JetBrainsMonoNL NFM（NoLigatures Mono 变体，2.4MB ttf 入仓
  public/fonts/）治 U+E0B0 箭头色块；字体栈抽 TERM_FONT_STACK 共享
  常量（NF 打头+CJK fallback 栈尾兜中文），壳渲染与量字格探针同栈；
  字体就绪门（open 量格前 await document.fonts.load——异步加载不等
  会拿 fallback 字宽致光标/裁切错位）。feat @ 1f1fb05a。三考卷不回
  退+npm 85 绿；headless 截图人审：箭头成色/黑底白字/中文不塌/底锚
  正常。M3 基线两图预期失效，C 档真机收口后重拍。待 C 档真机（配色
  比照 NA/箭头正常/中文正常）随底锚定+oh-my-zsh 三单并验。
- 2026-08-24：**两痛点修复**（用户真机反馈，评审信 kfmv4-9.0-button-ime-tui-overflow-review）：
  ①点 keybar 按钮弹输入法=按钮 pointerdown preventDefault 拦不住 click
  派发、冒泡到容器触发 kb.focus()；修法=按钮 click stopPropagation（点按
  钮=发字节不激活 IME，点文本区聚焦通路不动），回归钉两向入 keybar 卷
  （19/19）。②TUI 被常驻按键栏挤占（container−84）：恢复 syncAlt 帧后
  翻转——ALT 收栏+scrollEl 占满，行模式放回，高度变走 scheduleResize
  （onViewportResize 防抖块抽出复用）；headless 实证 htop 占满整屏
  F1-F10 贴底、退出 keybar 恢复。?debug 加 rows/cols/cellH/cellW/ch 专
  症字段（真机超屏排查用，随症收口）。fix @ fde0d792。遗留：真机「超屏
  需上滑」headless 未复现，待真机 ?debug 取证。待 C 档真机（点按钮不弹
  键盘+TUI 占满不超屏）随底锚定/oh-my-zsh/配色字体四单并验。
- 2026-08-24：**TUI 真机行列失配两症修复**（用户真机截图实证，评审信五节）：
  图A 帮助栏右侧截断=cellW 竞态（NF 晚到渲染变宽、cols 按 fallback 窄宽
  算多）——字体晚到自适应：measureCell() 可重测 + fonts loadingdone/
  loadingerror 兜底 + shell.invalidateMetrics() 新增；图B 顶栏带出底行
  切半=地址栏伸缩走 vv scroll 不触发 resize——onViewportScroll 补
  scheduleResize() 行列同缩。fix @ d1884a38（tests:na：真机/浏览器差异
  向 headless 不可补钉，防线=三考卷不回退+?debug 取证字段）。headless
  复核 htop 占满 F1-F10 贴底、vv scroll 后尺寸稳定。待真机复核。
- 2026-08-25：**8.0 全屏卡机制移植**（用户拍板根治 TUI 超屏，评审信
  kfmv4-9.0-fullscreen-card-port-review）：放弃「算对高度」改「物理
  裁剪」——①卡身 position:fixed inset:0 锚布局视口（viewport meta
  interactive-widget=resizes-content 下=真实可视区，不信 vv 数值；
  pinToVv 钉法与 ?kbOff 代字就此退役）；②卡身 overflow:hidden 硬裁剪，
  内容物理画不出卡外；③行数对卡身量（scrollEl.clientHeight 源自
  fixed 卡身，rows×cellH 恒 ≤ 可视区）。syncAlt 补 ALT 态
  overflow:hidden（TUI 填满不滚、行模式 auto 可回翻）；vv 监听改纯
  重测（reportViewport+scheduleResize）。bottom-anchor 考卷④修卷：
  原 vv height mock 对 fixed 锚定失效→setViewportSize 真缩窗（键盘
  占位同款物理）。fix @ 1d38ae16。三考卷不回退（bottom-anchor 5/5、
  scrollback 5/5、keybar-click 19/19）+npm 85 绿；headless htop 截图
  实证占满整屏（ch=620=vh）、F1-F10 贴底无截断、退出 keybar 复原。
  待真机 C 档：htop/ranger 占满不超屏（顶栏伸缩+键盘弹起两态），随
  底锚定/oh-my-zsh/配色字体四单并验收口。
- 2026-08-25：**卡身改锚视觉视口**（评审扰动实验证伪上轮 fixed inset:0
  等价锚，评审信 kfmv4-9.0-card-visual-viewport-anchor-review）：fixed
  inset:0 锚的是布局视口 innerHeight，地址栏 chrome 覆盖布局视口不缩它
  （resizes-content 只管键盘）——真机有栏态 innerH=915/vvH=855，ranger
  仍超屏被裁。修正：卡身 top=vv.offsetTop、height=vv.height 锚真可见区
  （8.0 卡高=barTop−2、输入栏用 vv 锚视觉视口的同款边界），vv 事件当拍
  即钉不防抖；overflow:hidden 硬裁剪保留兜底（vv 个别态失真时裁的是
  超出部分，卡身先锚对就不裁「该看到的」）；无 vv API 时 height:100%
  贴布局视口兜底。bottom-anchor 补④b扰动钉：布局视口 620 不动 mock
  vv=400，锚视觉=316/锚布局=536 可分——headless 从此能量这个坑。
  fix @ e4e9ad95。bottom-anchor 6/6+scrollback 5/5+keybar-click 19/19
  +npm85 绿；headless htop+地址栏扰动实证 ch=480=vvH、F1-F10 贴 480
  边界无截断。待真机 C 档：地址栏+键盘两态 ranger/htop 占满真可见区
  不超屏，随四单并验收口。教训（评审立）：黑盒诊断用扰动实验自观测，
  不用用户当测试员。
- 2026-08-26：**自观测基建 Stage① 几何遥测**（评审信
  kfmv4-9.0-self-observation-telemetry-review——观测层是瓶颈非修法：
  headless 模拟只能看见想象中的病，真实设备须自报实际状态）：?debug
  补全五组几何字段（视口 vvOffsetTop/vvHeight/innerH、卡身 cardTop/
  cardH/cardBottom、滚动区 scrollTop/scrollH/scrollClientH/scrollRectTop/
  Bottom、行列 rows/cols/cellH/cellW、派生 layoutMinusVisual=innerH−
  vvHeight/overflowBeyondVisible=scrollH−scrollClientH），四处出口=开页
  即报 open+视口事件 viewport/viewport-scroll+ALT 翻转 alt-enter/exit+
  行列落地 resized（补全事件→落地闭环）；ch 并入 scrollClientH 正名。
  feat @ 4cbe24a2。kb 态判读不交前端猜（layoutMinusVisual 够区分），
  随症可拆纪律沿用。三卷（6/6、5/5、19/19）+npm85 不回退；headless
  ?debug 实证字段齐全值域合理（620→400 缩窗：open/viewport/resized
  三条闭环，rows 32→19、rz 0→1）。真机用法：Via 开 ?debug 跑 ranger，
  agent 直读 /tmp/nz-ime-events.log 判定病灶层。
- 2026-08-26：**rows 未随视口缩自愈**（真机 ranger 遥测定位，评审信
  kfmv4-9.0-ranger-rows-not-shrink-review）：Stage① 数据改写诊断——
  卡身锚已修对（cardH 随 vvHeight：805/226/853），残留=rows 卡 58
  （地址栏态溢 137、键盘态溢 716）。真机 rz=27 证明重测在跑，卡的是
  cellH 停在 fallback 值（805/13.88=58）——字体落地后无事件触发重量；
  且 vv 事件在 Via 地址栏态可能不送达。修法两路自愈：①ResizeObserver
  直盯 scrollEl 几何（布局落定必触发，不依赖 vv 事件）；②字体 1s/3s
  幂等复量兜底（loadingdone 整组不送达/fonts.load 提前 resolve 量到
  fallback 字格的卡死路径）。均幂等（行列没变=no-op）。④c 回归钉：
  直接改卡身高度不派发 vv 事件，rows 必须经 RO 落地（19→25）——无 RO
  旧实现必红；钩子补 rows/cols 供判卷。fix @ 10ad116b。bottom-anchor
  7/7+scrollback 5/5+keybar 19/19+npm85 绿。待真机：地址栏+键盘两态
  ranger/htop overflowBeyondVisible=0、resized 记录 rows≈49/13。
- 2026-08-26：**ranger 瞬态错量自愈**（真机遥测实锤「正常几帧后溢出」，
  评审信 kfmv4-9.0-ranger-alt-enter-rows-measure-review）：alt-enter
  rows=32 正常→resized rows=38 溢 83——重测在键盘/地址栏动画瞬态读到
  尖峰高度、落定后无任何事件再触发（10ad116b 的 RO/字体两路不覆盖
  此路：cellH 对、vv 事件到）。修法两层：①钉-量同拍——scheduleResize
  防抖块里先 pinToVv 再 measure（pin 落在量后=瞬态错读的根）；②帧级
  漂移自检 checkDrift——每个输出帧先直读 live vv 属性钉卡身（属性
  直读不依赖事件送达），再校验 rows/cols 与当前几何一致，不符走防抖
  重测：事件不送达/落定无事件/RO 净零不触发全路径封死，一两帧自愈。
  ④c 重写：旧考法（直接改卡身高度）与钉-量同拍冲突，改考真实 Via
  失败模式——mock vv 不派发事件，输出帧驱动收敛（卡身 400→300、
  rows 19→13），无帧级自愈必红。fix @ 353a4a0b。bottom-anchor 7/7+
  scrollback 5/5+keybar 19/19+npm85 绿。待真机：地址栏态 ranger
  resized 记录 rows=floor(scrollClientH/cellH)≈32、overflow=0。
- 2026-08-26：**checkDrift 空闲覆盖洞补齐**（评审清测证伪输出门控，
  评审信 kfmv4-9.0-checkdrift-idle-gap-review）：checkDrift 原仅
  onOutput/onExit 触发——mock vv=300 无事件无输出 rows=38 不自愈，
  输入 j 才自愈；真机「落定近 2 秒无事件」正是 ranger 空闲无输出态。
  修法=500ms 空闲巡查（方案 B：无 PTY 输出也自愈；幂等一致即 no-op，
  量算仍归 scheduleResize 防抖块）+pinToVv 同值跳过（高频调用不写
  同值 style 防空转）。④d 空闲自愈钉：mock vv 无事件无输入，卡身
  300→340、rows 13→15 落地，无巡查必红。fix @ 805602a4。
  bottom-anchor 8/8+scrollback 5/5+keybar 19/19+npm85 绿。待真机：
  地址栏态 ranger resized rows=floor(scrollClientH/cellH)、overflow=0。
  教训（评审清测立）：「结构封死」要用干净实验证伪——④c 靠输入驱动
  输出帧，恰恰没覆盖真机落的空闲洞。
- 2026-08-26：**ranger runaway 根治**（真机遥测 rows 32→38→58→61 持续
  增长、scrollTop 0→72→89→137 失控，评审信
  kfmv4-9.0-ranger-runaway-rows-growth-review）。重定性：不是反馈
  循环，是**两套字格度量各量各的**——measure() 闭包 cellH 卡停旧值
  ≈13.8（三跳反推 floor(534/x)=38、floor(805/x)=58、floor(853/x)=61
  → x∈(13.76,13.88] 全中），壳渲染尺 16.25 是对的；遥测只报壳的值
  =观测盲区。scrollTop 失控=ALT 下游标 nearest 兜底滚动与插件
  followOutput/inputToBottom 没禁滚（overflow:hidden 挡不住程序化
  赋值）；评审假设③（alt 内容进 scrollback）不成立——shell.ts 行
  模式历史块 ALT 已 display:none。修法：①字格单源——measure 吃壳
  metrics（量自真实渲染行）优先、闭包探针兜底，遥测补
  mCellH/mCellW/rawH/src 四字段封盲区；②ALT 三路禁滚——壳
  renderFrame 游标块加 alt 判定、插件两路早退、syncAlt ALT 进入
  清零残留 scrollTop。④e 钉：htop ALT 缩窗 rows 38→24→24 跟随、
  scrollTop 恒 0、空闲 1.2s 不跑飞（headless 双源本一致，绿色两可
  回归护栏非 red-first；真凶 divergence 实锤靠新遥测字段真机取证）。
  fix @ 048be6f8。bottom-anchor 9/9+scrollback 5/5+keybar 19/19+
  npm85 绿。待真机：ranger/htop 地址栏+键盘两态空闲放着，rows 不
  增、scrollTop=0、overflowBeyondVisible=0；?debug 遥测 mCellH 应
  ≈16.25 与 cellH 一致。教训（评审立）：单帧快照会骗人，要看多帧
  演化序列；本轮补一条——遥测只报单侧值=观测盲区，双源并存时两侧
  都要上报。
- 2026-08-26：**TUI 底部要求落地**（用户拍板，评审信
  kfmv4-9.0-tui-keybar-bottom-review）：进 ranger/htop 类 TUI 时
  按键栏应在视口底端可见、TUI 窗口=视口−KEYBAR_H 不占满——推翻
  2026-08-24 两痛点②的「ALT 藏键栏+scrollEl 占满」方案（那套让
  TUI 里发不了 Ctrl/方向键）。修法=syncAlt ALT 分支摘除
  barStrip display:none 与 scrollEl bottom 翻 0 两行，键栏两态恒
  在流内垫底；overflow 切换（ALT hidden 硬裁剪/行模式 auto 回翻）
  与 runaway 轮的 ALT 三路禁滚（壳游标 !alt/插件两路早退/syncAlt
  清零）保留不丢——正交。钉=bottom-anchor ④f（TUI 态
  scrollClientH==vh−KEYBAR_H、keybar display!=none 且矩形底=视口
  底）；④e 期望随需求改（rows 38→32、24→19）。fix @ c9b0b011。
  bottom-anchor 10/10+scrollback 5/5+keybar 19/19+npm85 绿。待真
  机：ranger/htop 进入后键栏按钮在视口底可见、TUI 窗口更小、
  overflow=0、rows=floor(视口−键栏/cellH)（≈少 5 行）。悬而未决
  （评审四点④）：htop 自带 F1-F10 底栏贴在 TUI 底=键栏上方两层
  底栏并存，用户是否接受待真机观感。
- 2026-08-26：**CJK 基线探针**（真机 ranger 中文行内容上移几 px，
  评审信 kfmv4-9.0-ranger-cjk-baseline-review）：headless 双测复现
  不出——canvas 墨迹盒 中 asc11/desc2 vs A asc10/desc0（1px 级正
  常设计差），DOM 复刻宽字 span shift=0/spanH=16.25。评审机制猜
  测=CJK fallback 字体度量差；但另有候选真凶没排除——宽字 span 的
  inline-block+overflow:hidden 触发 CSS「baseline=盒底边」规则，
  真机 CJK 字体（Android Noto）行盒若高于 16.25 会把整盒往上顶
  （headless 的 CJK 字体行盒恰好同高=不发作）。纪律=别盲改：先落
  ?debug 随症探针（cjk-probe：shift/spanH/inkA/inkZhong/nfLoaded/
  cjkLoaded，复刻壳宽字 span 结构、字体就绪后量），真机开页即自报
  基线，拿到 shift/spanH 真值再定修法（候选：span 高固定 1.25em+
  vertical-align:top 消基线规则 / overflow 改 clip 轴分离 / 换基线
  兼容 CJK 字体——各有裁剪风险，等数字）。feat @ 44d679ca。
  headless 对照组 shift=0 已录。待真机：开 8023/?debug 一次即落盘。
- 2026-08-26：**终端字体切栈 NA 同款**（用户拍板，评审信
  kfmv4-9.0-nz-font-adapt-review；取代 cjk-probe 等数定修法路线——
  真机截图实锤中英混排中文更高更满，probe 裸单字 span 测不到=假
  阴性）：@font-face NaMain（用户商业主字体，私有 gitignore）+
  NaCJK（FusionPixelMono12-gb2312，SIL OFL，烘焙含终端符号补丁+
  合成 powerline 实心三角）；TERM_FONT_STACK 换双栈打头；字体就绪
  门 load 主+CJK 两个。排雷：na-main.ttf 的 vhea 表版本 0x00010001
  非法，Chromium OTS 整字体重拒（NA 原生端不查）——
  scripts/sanitize-na-main.py 幂等修版本+校验和，BUILD 拷字体后必
  跑。实测：NaMain 严格等宽 7px（全 ASCII 同宽）、NaCJK E0B0/⚡ 命
  中、cellH=16.25 不变（line-height 驱动，④e/④f rows 期望不动）。
  feat @ eece8681。三卷 10/10+5/5+19/19+npm85 绿。待真机：ranger
  中文行与 ASCII 同基线（收口判据）、2 cell 宽、清晰、powerline/
  符号正常。
- 2026-08-26：**CJK 墨迹顶对齐**（评审信
  kfmv4-9.0-ranger-cjk-baseline-fix-review，像素+读图双证：13px 中
  inkTop13 vs A14、40px 中18 vs A20；换 FusionPixel 同症=字形墨迹
  几何 vs 固定 cell，非字体选择——换字体轮治标）：中英同基线
  （spanH/shift 已证行盒无恙），真凶=CJK 字形 em 方设计 ink 顶高
  1-2px。修法=measure() canvas 同栈量 ascC−ascA=cjkDrop（clamp
  0-3），宽字 span position:relative;top:cjkDrop 整盒下移——挪视
  觉不动布局、不裁不压、行高亮背景（外层样式 span）不受影响；
  invalidateMetrics 同重置。新钉 cjk-inktop.test.mjs 4 断言（补偿
  落 DOM/残余≤1px——headless ascC11 ascA9 top2 残余 0.00/2 cell
  宽不回退；旧实现残余 2px 必红=真 red-first）。fix @ f09e9a89。
  cjk-inktop 4/4+bottom-anchor 10/10+scrollback 5/5+keybar 19/19+
  npm85 绿。待真机：ranger 中英混排行（hermes-蔚然/ts工具/知乎-
  VibeCoding理论-images）ink 顶对齐、光标切中文行不上移、中文清
  晰不裁。cjk-probe 随症字段随本症收口可拆。
- 2026-08-27：**实验台 P0 可编程钩子落地**（评审信
  kfmv4-9.0-nz-device-agent-p0-review；§0.5 P0「能动手」前提，用
  户拍板最高优先）：`__kfmNzTermInject(str)`=注入走现有输入管线
  （takeMods 粘滞同路+inputToBottom 落字回底+bridge.input，\n→\r、
  \r=回车，不绕过输入纪律）；`__kfmNzTermScreen()`=当前可视屏纯文
  本（壳 screenText() 取实际渲染行、塌尾不计，与 Scroll 钩同源不
  建副本；语义=屏幕格网，scrollback 历史区后补 ScreenGrid/ScreenAt
  并列钩子覆盖）。可并列扩展铁律落注释：InjectKey/InjectRaw/
  ScreenGrid/ScreenAt 后补同款并列加不改这版。考卷
  term-hooks.test.mjs 5 断言全绿（中文 echo 双命中/Screen 行数==
  壳可见行/回底纪律在位；一处判卷修正：可见行选择器要按结构特征
  white-space:pre+height:1.25em 过滤，.nz-term 直属 div 含 history
  Div/光标层）。feat @ b820ad2e。五卷 5/5+10/10+5/5+19/19+4/4+
  npm85 绿。
- 2026-08-27：**实验台 P1 三点先验完成 + 选型拍板**（评审信
  kfmv4-9.0-nz-device-agent-p1-review；回函
  kfmv4-9.0-nz-device-agent-p1-response）：①wry on Android 能构建
  但需 cargo-mobile2+8 Kotlin 文件+androidx.appcompat/webkit/
  activity/lifecycle AAR 链=kfm-na 当年特意逃掉的 gradle/AAR 世界
  （wry 0.56.1 crates.io 源码实证）；②wry 能透出调试（main_pipe.
  rs:255 JNI 调 setWebContentsDebuggingEnabled，devtools feature
  控制）——逃生门理由是链成本非不透出；③路由=手机直连 8023，
  端口普查 8021/8022/8023/8024/8027 已占、8025/8026 空闲。用户
  拍板**纯 Java WebView 壳**（P1 功能集 Java 原生三行级，壳内零
  Rust 活；复用 package-apk.sh 模式，新目录 nz/lab/device-agent/，
  Rust 化留给插件层）。架构零 adb：APK 中继线程连自己进程
  localabstract webview_devtools_remote_<pid> ⇅ 出站 TCP 反连服务
  器 8025（断线重连自维护），服务器 8026 loopback 供评审
  playwright connectOverCDP 管道接入，Page.captureScreenshot 拿首
  张真机渲染截图。视口/DPR 不阻塞=attach 后 CDP 自上报+?debug
  遥测交叉。待评审认可后按五节序列开工。
- 2026-08-27：**实验台 P1 服务器侧+APK 落地**（评审信
  kfmv4-9.0-nz-device-agent-p1-review，回函 p1-response 后用户拍板
  直接开工）：`nz/lab/device-agent/`（AndroidManifest.xml +
  MainActivity.java + CdpRelay.java + scripts/package.sh/deploy.sh）=
  纯 Java WebView 壳（dev.kfm.nz.agent），WebView 加载
  http://127.0.0.1:8023/（kalo 隧道 -L 8023，与 Via 同姿势）+
  setWebContentsDebuggingEnabled(true) + 中继线程连自己进程
  localabstract webview_devtools_remote_<pid> ⇄ 出站 127.0.0.1:8025
  （kalo -L 8025）；干净桥断开立刻补新（CDP 多次顺序连接每连配新
  桥）、连不上才指数退避（1s→15s）；usesCleartextTraffic=true
  （targetSdk28 起明文默认禁，回环+隧道无暴露面）；打包复用
  package-apk.sh 链去 cargo/.so/res（javac→d8→aapt2→zipalign→
  apksigner；服务器分支补 JDK PATH——d8 内部 exec java）；APK 13K
  纯 Java 皮。服务器侧 `nz/scripts/cdp-relay.ts`：8025 桥口 FIFO 待
  命+8026 客户端口配对管道（纯字节不解协议，任一头关另一头陪葬），
  两端口绑 loopback 零公网面，setsid 常驻（/tmp/nz-cdp-relay.log）。
  考卷 cdp-relay.test.ts 4 断言（桥先/客先两序配对/客断桥陪葬/顺序
  三连各配新桥——模拟 connectOverCDP 的 /json/version→list→WS）。
  npm 85→89 绿。待真机：装 APK+kalo 加 -L 8025+CDP attach 首截图。
- 2026-08-27：**P1 验收补充要求落地**（评审 verdict 信：8025 桥加
  attach 状态可见性——attach 失败时要分得清 APK 未连还是 CDP 协议
  不通）：cdp-relay.ts 加 statusFile（默认 /tmp/nz-cdp-relay.status.
  json），桥起/桥关/客等/配对每次状态变化落 JSON（pendingBridges/
  waitingClients/paired/lastEvent）；考卷加第⑤钉（起服务即落盘/
  桥到场 pending=1/配对 paired=1；openRelay 传 statusFile:null 防
  考卷污染真守护状态盘——考卷教训：共享默认路径会被并行实例踩）。
  npm 90 绿；守护已重启装载（status 文件实证 init 态落盘）。
- 2026-08-27：**P1 评审验收通过**（kfmv4-9.0-nz-device-agent-p1-accept-
  verdict：五条独立复核全过——APK badging/签名实测、manifest 清晰、
  中继架构与 FIFO 配对咬合、考卷 5/5+npm90 本机复核、双口监听+status
  落盘活）。kalo 隧道 -L 8025 已由 9.0 经 8022 上手机自加（~/bin/kalo
  autossh 行，备份 kalo.bak-20260827，kr8025.sh  detached 重启，8025/
  8023/8021 实测全通）；APK 已 deploy.sh 推送+安装器调起。**记账**
  （不挡收口）：cdp-relay 是 setsid 游离进程，服务器重启会丢——跑顺
  后定归宿（挂 kfm-nz.service 或 cron @reboot），现在不动。待用户：
  点安装+开 NZ-Agent，之后 connectOverCDP 8026 拿首张真机渲染截图
  （实验台第一次睁眼，单独落账）。
- 2026-08-27：**实验台首睁，P1 关账**（kfmv4-9.0-nz-p1-first-vision-
  verdict）：用户装 APK 开 NZ-Agent，评审 connectOverCDP 8026 一次
  attach 成功，/json/list 枚举到 kfm-nz 页（visible/attached），首张
  真机渲染截图落 docs/active/nine-zero/assets/first-device-shot.png
  （1260×1775 物理像素，真机 Chromium 147 光栅化）；几何自上报兑现
  =screen 384×854@dpr3.28125、vv=384×540 offsetTop=0（IQOO Neo 9S
  Pro 无键盘全屏态）。relay status 分锅面实战验证（attach 前
  pendingBridges=1 秒配 paired=1）。**从此真机四单并验（runaway/
  TUI 底栏/字体/中文行）评审用实验台自验，不再等用户转述**——「只有
  用户能看见」类问题闭环。P1→P2（文件信号闸门）可接。
- 2026-08-27：**评审角色调整明规则生效**（kfmv4-review-role-shift-
  notice）：nz 线单元级收口=自验收+信箱通报免检（不再逐项复跑），
  评审保留随机独立抽查权（直接 attach 实验台截图对照「已解决」点，
  查出问题按原流程开信），评审主业转两线审计对比+进度把控+设计讨
  论。9.0 含义：真机四单并验直接用实验台做、做到哪报到哪；大事照
  旧先请示用户。
- 2026-08-27：**真机四单并验全绿收口**（kfmv4-9.0-nz-device-verify-
  four-green-report，角色调整后首单自验收通报免检）：device-verify.mjs
  12/12 断言两连跑全绿+前台亮屏补三图（device-verify-font-cjk/
  tui-htop/after-quit.png）。①runaway：空闲 rows 28 恒/scrollTop 恒 0/
  overflow 恒 0；②TUI 底栏：键栏 display=grid kbBottom=540=innerH、
  scrollClientH=456=vvH−84 精确；③字体：NaMain 栈生效、中文 2cell
  （spanW=10.395≈2×cellW）、行高=cellH 不撑盒；④中文行：cjkDrop=2px
  vs 真机 asc 差 1、残余 1px 达标，像素图中英同基线。考卷自修三处
  artifact（教训）：tmux 假设错——WebView 是独立 PTY 干净 zsh 非用户
  tmux 会话，\x02c 在 readline 留脏字符拼出 cprintf；span 锚定层级错
  ——命令回显行是行 span 套字 span 嵌套，锚行盒 DIV 直下才对；
  exitCode 未声明 ReferenceError。四封「待真机 C 档」原信（runaway/
  TUI底栏/字体/中文行 verify-review）状态已翻真机收口。**9.0 的
  「8.x  IME/TUI/字体遗留账」自此全部真机清零**，P2/8.8.4 可接。
- 2026-08-27：**两线终端审计 nz 核对回信**（kfmv4-audit-term-parity-
  nz-response）：矩阵 nz 侧逐行核码基本属实，一处补正=B 表「实测恒
  1000」是人工冒烟非考卷钉。三条漂移表态落地两条挂单：①scrollback
  按用户拍板「各线显式钉值」——nz 钉 1000（三处散写字面量抽
  SCROLLBACK_LINES 常量单源+理由注「DOM 节点成本 vs na GPU 网格，
  数量级差=平台成本本征」+压帽考题，夹缝落）；②mouse SGR 1006
  **实现缺失**实锤（全库零命中，TUI 内点击定位静默不可用）——登记
  待办，排期建议挂 tmux 线（8.8.4/8.8.5）后交用户拍板；③蓝系例外
  支持收编 term-contract.md 共同契约。抄作业：flight-rec/--trend/
  stats 咬合闸三条接受进评估，IME 注入通道=已达意不补（composition-
  end 与 P0 钩子同入口：takeMods+inputToBottom+bridge.input 同路）。
- 2026-08-27：**抽查权首轮行使·四单验收认可**（kfmv4-9.0-device-
  verify-spotcheck-verdict）：评审随机挑单②独立量测——活页面滚动区
  457=vvH−84 分毫不差、键栏钉底 541=innerH、三图人审通过。**8.x 遗
  留真机账清零成立**。新周期登记：以后每 3-4 封自验收通报随机抽 1 单。
  审计征集信 nz 侧核对回信同步落（kfmv4-audit-term-parity-nz-response）：
  漂移#1 scrollback 钉 1000 三件套挂单、#2 mouse SGR 1006 实现缺失
  登记、#3 支持收编契约。
- 2026-08-27：**【纠正】8.8.4 未获拍板，误开工已全撤**（用户口谕）：
  评审抽查通报里「P2/8.8.4 继续走用户请示」被我误读为 tmux 优先已
  定，未经拍板即开工 8.8.4（服务端 tmux 分支/WS 帧/客户端标签带/
  A 档考卷四文件）——改动全未入库，当轮 checkout 全撤+考卷删除，
  **代码零残留**。tmux 线（8.8.4/8.8.5）维持未立项，等用户拍板。当前
  方向按用户口谕：自观测方向议题 + 双线横向审计对比先行；P2 文件
  信号闸门与抄作业三件（flight-rec/--trend/stats 咬合闸）在册待序。
- 2026-08-27：**scrollback 钉值三件套落地完成**（审计终裁#1 nz 件，
  kfmv4-audit-term-parity-final-verdict 承诺兑现）：①单源=SCROLLBACK_
  LINES=1000 常量（plugins/term/index.ts，TermCore 三处实例化全引此，
  理由注 DOM 成本本征 vs na GPU 网格）；②压帽考卷=scrollback-cap.
  test.mjs 4 断言（灌 1200 行 histLen 恒 1000/evicted>0/再灌仍恒 1000/
  evicted 单调增 170→371）全绿；③钩子补 histLen/evicted 两字段（__
  kfmNzTermScroll）。回归：scrollback 5/5+bottom-anchor 10/10+npm 586
  全绿。排雷两枚（教训入账）：①nz/build.mjs entryPoints 是 cwd 相对
  路径——从主仓根跑 node nz/build.mjs 会把 kfmv4 本体 bundle 覆盖
  （public/index.html/build-info 连坐，已 checkout 恢复+nz/public 的
  新 bundle 为准）；②机器 load>10 时 chromium 起不来（launch 挂死/
  createBrowserContext 失败），考卷假红先看负载。
- 2026-08-27：**热更新+重启闭环跑通**（用户拍板「自观测重走 na 路子，
  先热更+重启」；§0.5 P3 切片，镜 na gate.rs/na-restart.sh/na-push-so）：
  ①重启腿=server 值守 /tmp/nz-gate/restart-req（1s 轮询，见文件→摘触发+
  同步遗言 last-will.log+exit(0)，镜 restart_check「exit 不给异步入队留
  活路」）+supervisor.sh 守护（boot 行日志=拉回判据，镜 Termux am start
  腿）+nz-restart.sh 一键五步判卷；考卷 hot-restart.test.mjs 8 断言全绿
  （两轮真进程闭环：死透/拉回/遗言/摘除/循环稳定）。②前端腿=热更自刷
  （main.ts 轮询 build-info.json，builtAt 变→reload）+会话续命（
  sessionStorage nzTermLastSession→reload 后 attachSession 回旧会话，
  tail 回放补屏=「热重载而会话不断」）+服务端重启自愈（重连 attach 撞
  「会话不存在」→onSessionDead→摘账+防循环 reload）；考卷 hot-update.
  test.mjs 6 断言全绿（续命同会话/标记回放/账本一致/假 build-info 触发
  自刷/死账自愈）。③现役 8023 已迁 supervisor 托管（setsid，log=/tmp/
  nz-server.log）；真机端到端两轮：restart 闭环✅、error 帧到+摘账✅、
  **reload 执行被后台 WebView 推迟**（App 回前台补执行，CDP 强刷等效；
  headless 6/6 证逻辑对）——真机前台 C 档待用户亮屏并验。排雷：pkill
  -f 自匹配炸自己 shell（按 pid 杀）；「会话不断」reload 后靠续命 attach
  而非 WS 重连（重连是同页面的，reload 换文档必须重 attach）。
- 2026-08-27：**term-contract 立项 nz 三单**（kfmv4-term-contract-
  landing-notice）：①SCROLLBACK_LINES 三件套 ✅（前条，压帽卷 4/4）；
  ③鼠标报告 SGR 1006 正式挂单——**功能缺口（实现缺失非考卷缺失，全库
  零命中），排期定案=tmux 线（8.8.4/8.8.5）之后**，桌面浏览器场景权重
  上调时重议；影响面=TUI 内点击定位（htop 点列头/ranger 点选），手机
  滚动主场景不受影响。②C4 混排宽度互验考题 ✅=cjk-width-c4.test.mjs
  5/5 绿（判据=同串光标推进列数，核层直喂；契约串 A中A→+4/中中→+4/
  U+E0B0→+1/中文A→+5；na 侧请落同表 Rust 卷）。**教训（artifact 入册）**：
  经 PTY 注入测「串宽度」会混入 zsh ZLE 对 PUA 字符的转义回显（E0B0
  实测被画成 4 列）——C4 判据必须直喂核（__kfmNzTermCoreFeed 判卷
  钩子，只绕 shell 不绕核管线）；cursor() 打包=(row<<16)|col 列在低位。
- 2026-08-27：**运维拓扑变更知悉+亲验**（评审通报，restart 语义零
  改动）：①双守护竞态已除——原 systemd kfm-nz.service（Restart=always）
  与 standalone supervisor 抢 8023 致 EADDRINUSE 崩溃循环 695 次（boot
  计数一度成噪声，nz-restart 判据险被污染）；②统一后分层=systemd 只
  守护 supervisor.sh 本身+开机自启（enabled），拉回逻辑全归 supervisor
  循环（ExecStart=/bin/bash supervisor.sh，单守护者原则）；③亲验：
  systemctl active+进程树 systemd→supervisor→tsx 正确+nz-restart.sh
  一轮闭环绿（遗言 pid=17210+拉回+ping 200）。**C 档可安全约用户亮屏**。
  联动：cdp-relay 守护归宿挂单现成先例——照 kfm-nz.service 模式挂
  systemd 即可（待办不急）。
- 2026-08-27：**热更前台 C 档收口（真根因=壳缺 WebViewClient）**：
  无观测判卷轮用户读数「NZ-Agent 前台但 3 次跳浏览器开 8023」——
  自愈链一直在跑，reload 导航被 ActionView **外部化到系统浏览器**，
  WebView 内页面纹丝不动=「被吞」假象真凶。壳修一行：MainActivity
  补 setWebViewClient(new WebViewClient())（空 Client=导航自持），
  重打 APK 用户覆盖安装。终验全绿：restart 自愈=timeOrigin 变+新会话
  可用+注入通；build 自刷=页面自动换血+**续命同会话+屏幕内容不空
  （tail 回放）**。诚实修正：此前「CDP 观测扰动致 reload 被吞」推测
  被证伪——headless 绿/CDP 直刷绿/页面内刷被外部化，三读数合指
  WebViewClient 缺失，观测扰动论废弃。热更+重启闭环（§0.5 P3 切片）
  全链收口：进程腿 8/8+前端腿 6/6+真机 C 档两幕。
- 2026-08-27：**前台观测闸落地**（用户拍板「观测只在后台，拒绝前台
  行为」）：判卷钩子家族（Inject/Screen/CoreFeed/CursorX/Session）页面
  级硬闸——前台态（visibilityState=visible）一律返回 REJECTED-
  FOREGROUND，放行三口=后台 / URL ?observe=1（取证会话显式授权）/ 
  navigator.webdriver=true（headless 考卷）。真机实弹：前台+CDP 下
  Inject/Screen 全拒 ✓；headless 考卷全绿不破（term-hooks 5/5+hot-
  update 6/6，webdriver 放行生效）。不闸项与理由：自愈 reload（保命
  非观测）/ ?debug 遥测（被动、用户显式开）/ CDP attach 本身（无行为
  链路）。诚实边界：CDP 引擎级 evaluate/截图闸不住（debug 口本质，
  保留给实验台+评审抽查权），本闸挡「经钩子的观测/操作」，agent 纪律
  层（观测脚本自查 visibilityState）后续新卷跟进。用户新姿势：日常
  前台用终端，agent 观测全在后台做；要真机取证时说一声，开带
  ?observe=1 的页。
- 2026-08-27：**P3 热更切片评审关账**（C 档通报已读，三点赞：①归因
  跟读数不跟面子的判据外部化示范②navigation 计数坑判据钉入库③最小
  干预修复）。**壳完整性评估裁决**：WebChromeClient 缺失**现可接受不
  加**——CDP attach 场景 console 经 Runtime 域本就可见；未来实验台需
  要页面 console 落盘给 agent 离线读时再加 onConsoleMessage 转发（此
  条为裁决记录，防重复提案）。热更+重启闭环（§0.5 P3 切片）正式闭账。
- 2026-08-27：**【设计反转】前台观测闸整层撤除**（用户质疑「限制前
  台有什么好处」后复盘=过度矫正）：①读钩（Screen/CursorX/数值）零打
  扰，闸它纯损失——误伤用户围观 agent 跑测试的真场景；②写钩（Inject）
  与用户输入流是各自独立 PTY 无串扰；③CDP 引擎级闸不住=连安全价值都
  没有。**「不打扰」的真保障在架构层且已全落地**：Service 离屏
  WebView 观测永不抢前台 + 安装器只在 deploy 时弹装包必手点 + 开机
  自启只拉 Service 零 UI。钩子恢复直通，原 REJECTED-FOREGROUND 机制
  删除（历史注记留码内）。复盘教训入注记：听需求先问语义——「拒绝
  前台行为」的主语是 App 抢前台，不是 agent 读终端。自动安装获准：
  确需装包时可自动调起安装器（一次一弹用户点装，不频繁即可）。
  同包顺带：KeepAliveService 养离屏观测 WebView+BootReceiver 开机自启
  （Service 层，零 UI），APK versionCode=1787833032 已部署待装。
- 2026-08-28：**冷启动 7-15s bug 复现+归因+第一刀修复**（用户报障，
  第一个走自观测机制的 bug 闭环）：复现方法=①Termux sshd（kalo -R
  8022 遗产通道）am start 冷启动打 T0；②gate 新信号 app-restart
  （server 端点 /api/gate/app-restart 查摘 /tmp/nz-gate/app-restart+
  KeepAliveService 5s 轮询线程查到即 exit(0)——P2 闸门第一片交付，
  APK 1787845487 部署）；③CDP attach 读 performance 资源账+open 链
  步进标记（__kfmNzTermBootMarks：open-start/glue/fonts/ws-open/
  first-frame，判卷取数口常驻）。**归因账**：原始 15s=字体 3.3MB
  （na-main 1.86MB 7.6s+na-cjk 1.46MB 5.7s）走隧道全量重传（server
  无缓存头）+文档出生 2s（WebView 冷启固有）+wasm 编译 ~2s+WS/PTY
  0.7s。**第一刀=静态服务缓存头**（ttf/wasm/带 hash 的 bundle=
  immutable 强缓存；html/json=no-cache 保自刷腿）——字体零传输，
  UI 15s→6.4s。**残余 5.6s 分解**：WebView 冷启 2s（固有）+模块链
  wasm 编译/init 2s（open-start=文档后 2.05s，探针先行的 singleton
  init）+WS/PTY/首帧 0.7s+渲染上屏 0.8s。待拍板方向：开屏 loading
  骨架（等待可感知化，用户 C 档时提过此意）/wasm 编译缓存（IDB 存
  compiled module，工程大）/字体子集化。**依赖雷顺手修**：playwright
  原寄生 /tmp/nztest（服务器重启 /tmp 清空=考卷全瘫，今日实撞）——
  npm i -D playwright 入 nz devDeps（1.62.1，launch 验证过）。

- 2026-08-28 · 开屏动画打样（未拍板在途）：深蓝意志菱瞳 splash
  demo（nz/public/splash-demo.html，omp 开屏移植改造），用户逐版
  拍板已到 v4——竖长双菱形环+孤瞳单块+紫蓝 8-邻接硬隔离+环边
  笔直（随机=整段缺口/外向碎块/字形混杂），唯一动效=瞳心向外
  亮度波；JS 死有静态兜底帧不清屏。拍板后接进 index.html
  （boot-marks 驱动状态行+first-frame 淡出），demo 文件届时删除。
  今日教训：demo 首版纯 JS 渲染违反「骨架不依赖 JS」纪律，真机
  偶发 length 报错=黑屏一次（10 连跑未复现，已加逐帧 try/catch）。
- 2026-08-28 · 评审侦察#3 点将应卯：runaway 三连物证呈堂
  （10ad116b 前置→353a4a0b 钉-量同拍/帧级自检→805602a4 空闲巡查
  →048be6f8 双源错尺根治；实锤信 54244952 多帧序列/6206bd00
  定性认可/8e055b72 清测证伪/ab15ee89 复核；遥测管道常驻
  /tmp/nz-ime-events.log，当轮原始日志随重启消散已诚实声明）+
  splash-demo 卷入 d141b4dc 知会（有意在 public=用户预览通道，
  保留，转正后自然退出）。回函=runaway-sample-evidence-report。
- 2026-08-28 · 评审裁定知悉（trace-schema-four-bucket-verdict）：
  runaway 物证收讫够用、na 侦察#3 动工、splash-demo 保留无异议。
  收编一条惯例建议：今后遥测关键序列随信归档进标注文档——/tmp
  这次靠信引用兜住，下次未必（自观测线纪律，下轮遥测通报起执行）。
- 2026-08-28 · 复述环回应（trace-restate-response）：#2/#3 归属
  无异议（评审自正属实），提两勘误——na 标注漏 353a4a0b 事件
  （四拍变三拍）+事件序倒挂（11:05/11:29 排到 09:13 前）。
  教训：当事线核对时 git log --date 时序是最便宜的勘误尺。
- 2026-08-28 · 复述环勘误裁决策（restate-errata-verdict）知悉：
  两勘误 git 时间戳独立验证采信，na 重排重算；翻案发起侧补记
  我线 e5a0bbaf（「nz 发起、评审被正」）；「仪器居首」暂准以
  重算为准。复述环首实战记功，并实例方法论注脚=v2 §五：
  跨线标注必须过当事人复述环+关键事件 git 时间戳对齐。
- 2026-08-28 · 真机看 demo 事故：CDP relay 不能 /json/new 开新页，
  playwright contexts().pages() 顺序与 /json/list 相反——误把 live
  终端页导航到 splash-demo（终端会话被杀一次，已导航回 8023/
  恢复）。纪律：借备用目标必须按 target id 精确选择（先读
  /json/list 的 id→webSocketDebuggerUrl 直连），禁按下标猜；
  真机看 demo 的正道=在 index.html 里做 ?splash 预览参数
  （不离开终端页），不在 WebView 间跳转。
- 2026-08-28 · 真机眼建成（cdp-device.mjs 固化 nz/scripts/）：
  上次事故后补齐三纪律——①按 target id 精确操作（live=attached，
  spare=empty/never_attached，禁按下标猜）②relay 8026 只听
  IPv6 ::1，必须 localhost 连（127.0.0.1 挂死）③App 后台时
  Android 不产帧，captureScreenshot 必超时——像素眼=App 前台
  限定；后台用眼=DOM 级读数（evaluate 量 getBoundingClientRect/
  computedStyle/textContent，不受产帧限制）。
  实证：spare 目标导航 8023/?splash，DOM 眼读数 overlayOn=true
  display=flex、徽标 19×27 竖长（preW193×preH432）、外圈蓝
  z-outer-3..7 亮度分层（波在传播）、内圈紫 rgb(70,46,123)，
  收工导航回 about:blank（顺带杀掉误起的 PTY）。四模式：
  eval/shot/evshot/navshot。term-hooks 5/5+bottom-anchor 10/10
  确认休眠覆层不破考卷。
- 2026-08-28 · 画布重画眼固化（__kfmNzCanvasShot，用户拍板）：
  动机=na 线后台截图原理（gate.rs 离屏光栅化自帧缓冲，不经过
  Android 合成器）vs nz WebView 后台不产帧 CDP 截图必超时——
  补法=2D canvas 软件光栅化在 CPU 侧不经过合成器，后台照常出图
  （真机探针实证 toDataURL 正常）。实现=shell.canvasShot 把可视区
  DOM（历史块+屏幕行>样式段>宽字叶段+光标块）逐元素按 rect 重画，
  颜色/几何/cjkDrop 同源真实渲染态；后台塌视口退化路径=全内容幅面
  （真机实测后台 innerWidth=0 视口驱动元素量出 0×0，内容驱动行
  rect 仍是真值）。cdp-device.mjs 加 cshot 模式一键取图。
  真机后台实证：spare 目标注入 echo→canvas 出图，oh-my-zsh 提示符
  +powerline 箭头蓝块+中文可读。边界=重画非合成器实拍，抗锯齿/
  下划线级细节不保真。term-hooks 6/6（⑤新钉：出图非空+内容像素
  >500）+bottom-anchor 10/10+scrollback 5/5+keybar 19/19 全绿。
- 2026-08-28 · C4 宽字符对拍（na 样例包 kfm-na-term-contract-c4-landing）：
  5 串（中文AB=6/English=7/あいui=6/中A中B=6/┌─┐=3）nz 核层直喂复测
  逐行同表，cjk-width-c4 扩至 10 断言全绿；期望值表回贴
  term-contract §C4 成契约机械载体。原子样（行尾剩1格灌中→整字
  换行）判卷归 Rust 层（term-core cargo test
  c4_wide_char_at_row_end_wraps_whole 绿，cargo 8/8）——浏览器层
  假红一次实锤：CoreFeed 与活体 PTY 共享核，zsh 重绘竞态污染
  定位类序列（CHA 行尾 x86→88 假象）。新教训：直喂核只净化 ZLE
  回显不净化会话竞态——可打印串表浏览器可判，定位类序列必须
  Rust 层判。侦察#3 归属（翻案发起=nz e5a0bbaf/公开自正=评审）
  无异议定稿。回函 kfmv4-9.0-term-contract-c4-response。
- 2026-08-28 · 观测手段统一登记（用户拍板）+ 开屏 v8 port：
  ①TASK 新增 §2.7「观测与自验收手段总表」——11 手段各带入口/
  能看什么/保真边界/前后台限制，CDP 四纪律（target id/localhost/
  spare 收尸/后台不产帧）+判卷层选择纪律（定位类必 Rust 层）入册，
  新规：任何新观测手段落地必须登记进表（不登记=不存在）。
  ②动效帧序列眼固化 cdp-device.mjs seq 模式（真机后台拍 ?t= 冻结
  帧，fillRect 同源重画），/tmp 8 个脚手架清零（能力全并正式脚本）。
  ③开屏 v8 port index.html 休眠覆层（逐行精确菱形+重心钉线+定种子
  满覆盖，与 splash-demo.html 同源）——顺手修 z-index：覆层 90 被
  Cordis 层根（host.ts LAYER_Z layout 100/persistent 200/overlay
  300）压住，底部漏出按键栏/终端，提至 400 遮挡一切（注释记因）。
  考卷：term-hooks 6/6+bottom-anchor 10/10+scrollback 5/5+keybar
  19/19+cjk-width-c4 10/10 全绿。
- 2026-08-29 · 开屏 v12 基线固化（splash-demo.html，用户拍板为基准版）：
  探照灯显形版——纯黑开场，蓝色扫线从下入、紫色扫线从上出（速度
  一致全程 1.5s 基准），线前方 ±2 行幽影窗（GHOST_MAX=0.30）照出
  标准菱形暗结构（探照灯感），线后方逐块固化为随机大小+随机亮度
  的最终形态（外环 U(0.45,0.90)/内环 U(0.20,0.70)/孤瞳 1.0，均值
  层级中央>外环>内环但允许外环比内环暗的个体）。菱形几何：
  一行一方块、块宽随机、重心钉理想直线（观感直+随机感兼得）、
  无卫星碎块无缺行、环间隙>环宽、竖长构图。定种子 mulberry32
  (20260828) 每次渲染同一形态。编排按几何反解钉光束位置
  （inStart/pupilHi/purpleIn/purpleOut 四相位点），19×27 真空格
  网格 priming 防 geom 量到兜底帧（v9f「亮得比线快」根因修复，
  勿回退）。冻结帧验证全绿：t=0 零字符、幽影窗外零泄漏、窗内
  全标准件、线后活块数对、真机三帧确认。omp 对照研究（录屏
  /tmp/omp-intro.txt 逐帧判读）：omp=固定字符画+调色板旋转
  （蓝青紫粉色带永动环流），我们扫过后静止=动感差距根因；
  v13 方向=固化后接入环流呼吸（亮度按角度相位正弦调制沿环流动，
  孤瞳脉冲），待用户拍板。
- 2026-08-30 · 开屏 v13→v14f 动感化系列（逐版用户拍板，定稿）：
  omp 对照研究（script 录屏逐帧判读）：omp=固定字符画+调色板旋转
  永动色带，动感=每帧每块都在变；我们扫完即静止=死图。落地链：
  ①v13 环流呼吸——固化后亮度 base×(1+0.22·sin(ωt+K·ang)) 沿环流动
  +孤瞳脉冲，周期整除 LOOP 无缝；②v14 渲染换 HSL（8 档 class 色阶
  退役，每块内联 hsl 连续值），形状/颜色两层分离：shapes（字形/宽度/
  基础亮度）钉槽位、colors（色相/饱和度）沿槽位循环移位=色带绕环转
  而形状不转；色相收敛蓝紫/青紫主题（外环 210→196°、内环 262→278°，
  ±4° 抖动，大花环拍回两轮）；双环亮波一顺一逆且与色带自转反向；
  亮波速度双正弦叠加解析积分=时快时慢不可预测；③亮度天花板 0.95→
  0.85（白太亮拍回），孤瞳脉冲 0.62–0.82；④v14e 蓝2：第二条蓝光束
  与紫线在瞳孔行精确会师（机器断言同落 399px），孤瞳此刻才点火
  （此前中央黑洞）；顺手修 ghostL 线已过方向误显形（0.60 杂块）；
  ⑤v14f 双蓝同底出发蓝2 慢速（速度几何反解保会师）+整体延迟 1s
  动线（治半空出现观感）+demo 不循环（扫一遍后永久活跃动画，刷新
  重播；?t= 冻结帧为含延迟绝对毫秒）。全程冻结帧机器断言验证
  （形状钉死/颜色在动/会师同像素/瞳孔格状态），零 JS 报错。
  未来方向（用户设想）：渲染 UI 层做高清版开屏，字符版保留为兜底。
- 2026-08-30 · 开屏落地 + 插件化（8.8.5，用户拍板「落地吧，做成插件，
  未来改这个可以直接覆盖」）：「静态资源动画本体 + Cordis 生命周期壳」
  分层首例——①public/splash-core.js=动画唯一真源（v14f 工厂
  NzSplashCore.create(refs)→show/hide/render(t)，CSS 也内聚其中
  ensureStyle 注入），服务器对它单独 no-cache（其余 .js immutable）——
  覆盖本文件刷新即新版，不动 bundle.js；②splash-demo.html 改薄壳
  共用同一文件（?t= 冻结帧走 handle.render，数值与 v14f 逐值一致）；
  ③src/client/plugins/splash：壳管 DOM 挂载（host overlay 容器，
  owner 死自动摘）/本体脚本注入/唤醒通道（?splash、__kfmNzSplash
  CDP 口、click 关闭）/ctx.provide('splash') 服务/降级（本体加载失败
  →兜底 CSS+静态徽标帧）；④index.html 内联 v8 全拆（CSS+DOM+script
  清零），覆层 DOM 由插件挂。plugtest 实钉出「主/影分流」纪律：
  root 直挂后 provide 必撞（registered at <root>）+同 slot 建容器触发
  host 防重下沉摘真覆层——非主挂载换 slot=splash-shadow 全生命周期
  照跑但不抢全局口不抢户口（eyes 绿=inject 吞冲突的假绿，term 同样
  未过，登记在案）。验收：plugtest PLUGTEST_OK 零泄漏（降级有意/
  装卸/残留/重载四轮）+主挂载 ?splash 唤醒（瞳孔 rgb(157,192,227)
  version=v14f CDP 口在）+影子折腾完主挂载存活+五卷（bottom-anchor
  10/10、scrollback 5/5、keybar 19/19、term-hooks 6/6、cjk-inktop
  4/4）+npm 90 全绿+typecheck+build 过。
- 2026-08-30 · 开屏进开机链（8.8.5 续，用户拍板「把开机动画加进去，
  保证动画结束时三线正好扫完，按时间重新定线速」）：①splash-core
  v15——T_OUT/T_IN 从常量变实例变量，show({introMs}) 等比缩放编排骨架
  （全部编排点从这两个值几何反解，缩放后三线会师/孤瞳点火相对关系
  不变；k clamp 0.15–8 防离谱预测），新增 complete()=首帧收口（没扫完
  =时钟平移跳到扫完帧定帧 SETTLE 500ms 后自动淡出；已扫完=短停留
  300ms；幂等），render(t) 冻结帧恒用基准速度（自验收确定性）；
  ②term 插件 mark() 派发 nz-term-mark 事件（判卷取数口不变）；
  ③splash 壳开机自播（?nosplash 关、?splash 只看动画不挂收口）——
  localStorage 'nz-splash-intro-ms' 存上次「开屏→首帧」实测做本次
  预测（无记录=首次安装=冷启动 11000 默认，clamp 400–20000），showFb
  立即盖静态帧、本体就绪换动画从 t=0 起播，first-frame 到达=实测回写
  +complete() 收口，看门狗 max(3×预测,30s) 防 OPEN FAIL 永远盖屏，
  首帧比本体加载快的极端时序等 ready 再 complete；④顺带定罪两个
  存量 bug（真机首验 3/6 红钓出来的）：服务器缓存头 immutable 变量
  只算不用——splash-core.js 实际吃一年强缓存，已中毒 WebView/Via 对
  裸 URL 永不再验证（真机实锤 5ms 缓存命中拿 v14f，complete() 不存在
  开屏永不退场），修复=no-cache 真用上+壳侧 ?v=15 一次性越狱中毒
  缓存键。验收：真机 CDP 两轮 6/6（scripts/splash-boot-verify.mjs：
  开屏先盖屏/首帧后 .out 433ms 收口/预测写账/覆层摘除/scaled 路径
  同样收口）+截图证据（splash-boot-mid/terminal.png，开屏退后
  oh-my-zsh 提示符在底行）+plugtest PLUGTEST_OK 零泄漏+五卷+npm 90
  +typecheck+build 全绿（nz-restart 闭环绿）。
- 2026-08-30 · 开机序列三段闪修复（8.8.5 续，用户实拍「长黑屏→闪到
  终端页面+字符标志→跳动画→跳终端，行为奇怪」并质问「你确实能接收
  到画面渲染的过程吗」）：先补观测再修——CDP screencast 真机 0 帧
  （WebView 后台不出帧）改 headless 150ms×40 逐帧实录，定罪三处：
  ①showFb 静态 FALLBACK_ART 小钻标先闪（与真徽标形状完全不同）；
  ②动画 T0=1000ms 死黑（v14f 为手动重播拍的仪式感，开机时序里是
  纯等待）；③body #101014 与覆层 #05070f 两截深色色差。修复：
  splash-core v15 加 opts.noDelay（T0 变实例变量，render(t) 恒基准
  不受影响）；壳开机路径纯暗场盖屏（pre 清空不出小钻标，FALLBACK_CSS
  主挂载即常驻管底色/显隐——此前覆层在本体加载前无样式，徽标浮在
  裸容器上；只有本体挂掉才回退静态徽标）；index.html body 底色对齐
  #05070f。修后逐帧复验序列=暗场扫线即起→完整徽标定帧→渐隐融合→
  干净终端（~1.5s），闪烁消除。纪律候选：DOM 类状态断言≠画面——
  观感问题必须逐帧实录（screencast/连拍）验证，「你确实能看到渲染
  过程吗」是对的质问。
- 2026-08-30 · 壳层开屏落地（8.8.5 续，用户拍板「从 apk 壳层点击就
  播放动画，持续到能操作再切换」）：①MainActivity 双层 WebView——
  底=终端（8023/?nosplash 页面内开屏让位壳层，_tApk=点击墙钟入账），
  顶=splash WebView 载 file:///android_asset/splash（零网络等待，
  动画本体 splash-core.js 与页面侧唯一真源同文件，package.sh 打包
  时机械拷贝）；主题 windowBackground=同款静态徽标帧（experiments/
  gen-splash-static.mjs 从 demo ?t=4000 冻结帧生成）盖住点击→
  WebView 初始化盲窗（连渲染体都不存在的一段，任何 App 都只能
  静态帧）。②盲窗自监控（用户拍板「让它自己监控自己的数据传
  过来」）：onCreate/webview-created/loadUrl/splash-first-picture
  （postVisualStateCallback，弃 PictureListener——API 18 起废弃
  且现代 WebView 常不回调）/term-page-started/finished/
  native-first-frame/splash-dismissed 逐拍墙钟 POST /__boot-marks
  落 /tmp/nz-boot-marks.log——「点击→页面出生」这段页面
  performance 永远看不到的账由壳记。③桥：终端页 first-frame →
  window.NzNative.firstFrame() → 壳令 splash 层 __complete() 收口
  →渐隐摘除。三轮冷启动数字账稳定：动画点击后 ~0.16s 起跑、
  ~2.7s 可操作、~3.8s 开屏退净。④盲窗像素取证走 CDP（scripts/
  boot-splash-capture.mjs：ssh nz_exit 杀→am start 冷启→8026 轮询
  出 splash target→attach 连拍真合成器像素，帧落 docs/active/
  nine-zero/assets/boot-splash-f*.jpg）——f0 实证外蓝内紫菱瞳
  徽标在真机盲窗期真实上屏，f1=渐隐帧。定罪并废弃 decorView
  自绘路线：View.draw() 抓不到硬件加速 WebView 内容（自证图全黑，
  Android 已知限制），壳侧 sendDecorShot+服务器 /__boot-shot 端点
  已拆；点击→splash-first-picture ~0.16s 静态帧段声明盲区（内容
  =windowBackground 固定图，时长有账）。⑤自杀令两连坑定罪：
  裸 am start 的 extras 被 Intent.filterEquals 吸收（不带 extras
  比较）=纯「带回前台」谁都不收，对活进程下自杀令必须
  FLAG_ACTIVITY_CLEAR_TOP（-f 0x04000000）销毁重建走 onCreate；
  nz-exit mark 与 System.exit(0) 抢跑输赢不定=正常，死透判据=
  CDP target 消失不赌日志。⑥观测脚本纪律新增：CDP relay 死在
  App 里，App 一死 8026 黑洞（connect 挂起不拒绝），fetch 必须
  带 AbortSignal.timeout 否则轮询环整体卡死（实踩一次）。验收：
  端到端对活 App 全自治闭环绿（杀→死透判→冷启→取证→终端回）+
  五卷（bottom-anchor 10/10、scrollback 5/5、keybar-click 19/19、
  term-hooks 6/6、cjk-inktop 4/4）+npm 90 全绿+typecheck+build 过；
  bottom-anchor ②一次红复跑绿=考卷时序抖动（clickSends 同类
  脆弱点）。待：用户真眼过开机序列观感。
- 2026-08-30 · 卡开屏事故定罪+双治本（用户实拍「进入后只有启动
  画面不会进入了」）：逐拍账+CDP 会诊还原——隧道 flap 期 WebView
  吃旧缓存 bundle（无 NzNative 桥调用版本），摘屏信号永远不到=
  壳层开屏有「卡死永远出不去」路径；另实锤 standard launchMode
  反复 am start 叠出多 MainActivity 实例（B 卡死/C 正常同框）。
  修复：①壳层 15s 看门狗——任何原因 15s 无 first-frame 强摘层
  放行进终端（页面侧开屏早有同款 max(3×预测,30s)，壳层补齐）；
  ②launchMode=singleTask 单实例 kiosk 壳，am start 走 onNewIntent，
  自杀令裸 am start 即可送达（CLEAR_TOP 变备用）。同日盲窗纯暗化
  （用户实拍定罪：静态徽标帧→动画暗场开场接不上=闪帧「很不专业」）：
  windowBackground/root/WebView 三处钉 #05070f 与动画第一帧同色，
  splash_img.png+gen-splash-static.mjs 拆除，WebView 默认白底
  setBackgroundColor 防首绘前闪白。验收（nz-agent-1788063209）：
  冷启动闭环绿（onNewIntent 自杀令首验过）+数字账稳定（动画
  0.15s/可操作 2.7s/退净 3.8s）+看门狗不误伤（无 splash-watchdog
  行）+f0 徽标帧实证。纪律：任何「盖住等信号」的 UI 都必须有
  看门狗——信号链路上每一环都可能缺席（缓存/断网/桥丢）。
- 2026-08-30 · 开屏时间线两连修（用户拍板「进行一轮修正，关于启动
  速度」）：①问答定罪「存不存在终端就绪但动画不结束不放行」=
  存在——壳侧写死 700+400ms 猜 JS 行为，双时间源，终端就绪后白盖
  ~1.1s；修=complete() 返回剩余毫秒（settle+320，唯一真源时间线），
  壳按回报延时摘层，白盖 1.1s→0.62s。②预测驱动退场（用户拍板
  「隐去结束后刚好赶上准备完毕，而不是准备完毕后开始隐去」）：
  壳把上次实测「点击→就绪」存 SharedPreferences，下次开机 #bye=
  预测−320（hash 传参不赌 file:// query）传开屏页，splash-core
  byeMs 到点自行渐隐——渐隐完正好赶上就绪；bye 不得早于 intro
  扫完+余量（≥1600 防扫线途中断帧）；首启无数据=安全行为；预测
  偏慢=complete 先走 bye 作废；偏快=露纯暗终端（WebView 底同色）
  可接受降级。配套：removeSplashNow 幂等摘层（complete 回报/bye
  硬摘/看门狗三路共用）、complete 回报 0（bye 已隐）=100ms 快摘、
  bye 路径 pred+1s 硬摘保险（透明层挡触摸）。验收（1788065453，
  两轮冷启动）：r1 无锚走旧路径（gap 634ms）顺便写锚，r2 URL 实锤
  #bye=2271，就绪 2581ms/摘层 2686ms——**就绪→摘层 1.1s→0.1s**，
  渐隐结束与就绪差 10ms；页面侧 splash-boot-verify 6/6 不回退；
  boot-splash-capture 改判据（0 帧=开屏 attach 前已摘=bye 生效
  特征非故障）。
- 2026-08-30：**鼠标报告 SGR 1006 转正**（term-contract 挂单核销，
  用户痛点=tmux attach 后无法滚动）。双堵定罪：①tmux 走 alt screen
  →ALT 三路禁滚无回滚区；②滚轮→SGR 1006 未实现→tmux(mouse on)
  收不到滚轮进不了 copy-mode。实现：核 mouse_mode() 位图（bit0=
  MOUSE_MODE 任一/bit1=SGR_MOUSE，rio-vt 的 MOUSE_MODE 掩码不含编码
  位故分报）；壳层=wheel(passive:false) 激活时 preventDefault 发
  `\x1b[<64/65;c;rM`、触摸拖拽合成滚轮（2 行 px=1 notch，上滑=64）、
  tap=左键 press+release、touchmove 兜底拦本地滚动；坐标换算=shell
  .cellAtPoint（历史区/越界 null 不上报）。未激活时一切照旧。
  验收：A 档 mouse-report.test.mjs 8/8（真 PTY+真 tmux scrtest：
  服务端 pane_in_mode/scroll_position 判、WS 帧字节断言 1 基坐标、
  行模式/ALT 无鼠标零鼠标帧、触摸合成）+真机 C 档 4/4（实验台
  attach，copy-mode 截图取证 assets/mouse-device-copymode.png）
  +五卷 10+5+19+6+4+npm90+rust9 零回退。**顺手两条真机实锤修复**：
  ①term-core glue/wasm 缓存头 immutable→no-cache（URL 无 hash，wasm
  重编函数表移位，真机抱旧 wasm 配新 glue=null pointer passed to
  rust——热更闭环的断腿）；②__kfmNzTermScroll 闭包裸抓 core const，
  replay 重连 free 换新核后全钩抛锈错，改 card.core 活引用（服务器
  重启即触发，真机 C 档的实证价值）。**实验台边界记档**：CDP
  Input.dispatchMouseEvent/dispatchTouchEvent 与 Page.captureScreenshot
  经 cdp-relay 无应答/超时（首 send 即挂），本期用页内合成事件+
  canvasShot 像素眼绕行，引擎级输入待 relay 排查；最终手感球交用户
  真指。边界：编码一律 SGR（X10/UTF8 不覆盖）、拖拽选择 motion 未做。
- 2026-08-30 · 触控方向反转修（用户真指拍板）：初版触摸拖拽按滚轮
  逻辑映射（上滑=64 翻历史）被实测判反——触屏直觉是「拖内容」不是
  「滚轮」：手指下滑=把上面的历史拉下来=64、上滑=回新内容=65。滚轮
  方向不变（桌面惯例对）。考卷同步：⑥拆 a/b 双向钉（下滑=64/上滑
  =65）；detach 改服务端 detach-client -s（打字 detach 依赖
  copy-mode 状态两次真红：在内被键位吞、不在则 q 污染命令行拼
  qtmux）。A 档 9/9+真机 C 档 4/4+五卷/npm90 零回退。
- 2026-08-30 · **tmux attach「大滚动」观测定罪**（用户报告：进入 tmux
  窗口后有很大滚动才落地，窗口够长滚得久；脚本 experiments/dbg-tmux-
  attach-scroll.mjs，100ms×12s 逐帧采样实锤）：**nz 本地滚动全程无辜**
  （scrollTop=0/scrollHeight=728 恒定）——滚动观感=对端 kimi TUI 的
  **整史重绘洪峰**：attach 触发 tmux 窗口 resize（最小客户端规则）→
  SIGWINCH → kimi 把整个会话历史按新尺寸重排重绘，洪峰时长∝会话长度
  （dsh 4638 行历史滚 12s+ 未净）。对照：纯 zsh 会话 attach 瞬时落地
  无洪峰。修向候选（待用户拍板）：①tmux window-size 策略 ②kimi 侧
  别整史重绘 ③nz 渲染吞吐优化（洪峰必须流完，但流速有头部空间待量）。
  **观测纪律两钉**：①实验台选页按容器非零筛前台——App 有前台
  Activity(?nosplash)+离屏 Service(裸 URL,0×0,回退格网 20x5)双
  WebView，find includes 会错拿离屏页（实测离屏 20x5 attach 把 dsh
  窗口压到 20 列，殃及其它客户端）；②detach-client -t 只认
  client_tty 不认 client_id（两轮残留 20x5/73x44 观测客户端实测）。
- 2026-08-30 · **洪峰节流渲染落地**（用户拍板「直接把最尾部信息替换
  贴上」；attach 大滚动定罪后续）：字节时间线实锤洪峰 246KB/1.2s
  到齐、旧实现 135 消息=135 次全屏 DOM 渲染——瓶颈在逐消息渲染非
  源头。修法=字节照全喂核（终态正确性不可跳）+渲染按档合并：平常
  16ms（打字手感不变）、洪峰（500ms 窗>16KB）150ms 跳帧、尾帧必画
  （makeRenderScheduler，plugins/term/index.ts）。验收：A 档
  render-throttle 3/3（24KB 洪峰仅 5 帧/终态不丢/平常档 600ms 上屏）
  +真机 A/B：attach dsh 收敛 2740→1585ms、渲染 135→29 帧；六卷
  10+5+19+6+4+9+npm90 零回退。边界：omp/opencode 等全屏 TUI 的
  resize 整史重绘是行业通病，洪峰字节必须流完（节流只省中间帧），
  治本在对端别重绘。
