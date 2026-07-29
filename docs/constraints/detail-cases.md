> 这是什么：根因案例库（8 例全文）——遇相似症状先按「根因类型/症状关键词」匹配。
> 别的去哪找：排查流程 → diagnostics.md；各域陷阱 → ../domains/。

# 根因案例库

## B.A.R. #007 — terminal 滚动 15 轮 debug：方向反 + 截断（过程性教训）

**日期**：2026-06-29 ｜ **根因类型**：过程性——未先查诊断手册 + 未确认事件到达就改渲染逻辑
**症状关键词**：终端滑动、方向反、截断、pointercancel、touch-action

**症状**：终端卡 Canvas 上滑画面下落（方向反），每手势仅 1-2 帧 move 就截断、松手跳转一行。
日志卡每 gesture 只有 1-2 条 `[TERM] move`，dy 仅 3-15px。

**根因（三重叠）**：
1. 方向映射：`deltaPx = startY - rawY` 是自然滚动，用户要 finger-tracking。修复：翻转 delta + 过滚 + 松手弹回。
2. touch-action 缺失：终端 Canvas 未显式设 `touch-action: none`，浏览器接管触控 → pointercancel 秒杀手势。
3. 渲染层双机制打架：逐行 `py - pixelOff` + `visibleStart` 整数跳变边界打架。修复：全 buffer 画连续长条，`ctx.translate` 整体平移。

**过程教训（比技术细节更重要）**：
1. **先确认事件是否完整到达，再改处理事件的代码**——病灶在触控层，却往渲染层追了 15 轮。
2. `npm run dev` 自动先跑 bundle 再启服务端；dev 在跑时增量重编即可，无需重启。
3. **诊断手段要选对**：console.log 手机不可见、Canvas 7px 小字不可见 → `log()` 推日志卡拿真实数据。

## B.A.R. #006a — `}` 缺失导致全部后续 CSS 规则被丢弃

**日期**：2026-05-29 ｜ **根因类型**：CSS 语法错误 / 工具编辑遗漏
**症状**：`.sidebar-nav-label` 的边框/背景/flex 全部不生效。

**根因**：`edit` 替换行范围 165-167 时，上一条规则的 `}` 在第 168 行（范围外）被丢弃，
规则未闭合，浏览器将此后所有规则当 CSS Nesting 全部丢弃。

**排查关键**：服务端 CSS 内容正确；`document.styleSheets[1].cssRules` 仅 55 条（正常 69+）；
最后一条规则断裂；`getComputedStyle` 全默认值；断裂点之前的样式正常。
**关联**：视觉 bug 先查 CSS 解析；edit 替换 CSS 块末尾必须包含 `}`。

## B.A.R. #001 — 外部区域卡片堆滑动失效（Touch → PointerEvent 迁移断裂）

**日期**：2026-05-25 ｜ **根因类型**：事件系统混用 / 隐式依赖断裂
**症状**：卡片堆内部滑动正常；外部空白区域只触发 2-3 次 onMove 就终止，无 `_handleEnd`。

**根因**：gesture-registry 从 TouchEvent 改 PointerEvent 时未同步迁移 canvas-scroll 与
CSS touch-action，两套事件系统互相干扰，浏览器接管触摸并停发 pointermove。

**解法**（`6294a0d`+`a177b74`+`cca2098`）：canvas-scroll / sidebarTouchArea / brOrb 全部
迁移 PointerEvent；`.main` touch-action `pan-y`→`none`；gesture-registry.init() 设
`document.body.style.touchAction='none'`。
**关联**：改动事件系统时先查「项目里还有谁在消费触摸事件」。

## B.A.R. #002 — 手势区域限定导致卡片堆外部滑动失效

**日期**：2026-05-25 ｜ **根因类型**：全局模式误判为局部组件
**根因**：`gestures-page-swipe` 的 targetFilter 排除 `.stack-card` 外部，
但卡片堆打开后整屏都是操作区域。
**解法**：page-swipe 增加 `condition: () => !isCardStackOpen()`，打开时否决自身，
让 card-stack-global（priority 80）全权接管。
**关联**：`targetFilter: () => true` 不是粗心；见 floating-card#陷阱「卡片堆是全局模式」。

## B.A.R. #003 — _currentAccents 初始化时序导致卡片堆崩溃

**日期**：2026-05-24 ｜ **根因类型**：初始化路径遗漏
**症状**：页面加载后立即召唤卡片堆，buildCards 抛 `Cannot read properties of null`。
**根因**：重构后 `_currentAccents` 默认 null，initCardStack → buildCards → createCard
在 `_generateRandomAccents()` 之前执行。
**解法**：initCardStack 开头加 `_generateRandomAccents()`。催生了「初始化路径检查」自查项。

## B.A.R. #004 — 浮卡折叠缺失（BR 光球只能展开不能折叠）

**日期**：2026-05-24 ｜ **根因类型**：状态机不完整
**根因**：BR 光球 click 只写了 `compact → expanding`，没写 `active → compact`。
**解法**：补 `else if (item.state === 'active')` 分支实现反向动画。

## B.A.R. #005 — 端口冲突 + tsc 僵尸进程耗尽服务器资源

**日期**：2026-05-28 ｜ **根因类型**：环境冲突 / 资源管理
**症状**：build 超时、CPU/内存 99%、API 返回 HTML 而非 JSON。
**根因**：误启动的 `npx serve public -l 8021` 抢占端口且 `kill -9` 无效；
超时堆积的 `tsc --noEmit` 进程耗尽资源。
**解法**：`fuser -k 8021/tcp` 清端口（已进 start 脚本前置）；build.mjs 开头 `pkill -f tsc`。

## B.A.R. #006b — SGR 鼠标事件批量发送被 tmux 忽略

**日期**：2026-07-09 ｜ **根因类型**：协议假设错误——假设终端逐条处理缓冲区全部 SGR 序列
**症状**：tmux 卡中无论手势多大，终端只滚 1 行。
**根因**：多条 SGR 滚轮事件拼成一条字符串经 WS 发送时，tmux 只处理第一条。
**解法**：每条 SGR 事件独立 `wsChannel.sendMessage()` 逐条发送，禁止拼接。

## B.A.R. #008 — 浮卡内原生滚动失效：exitFullscreen 批量覆盖 touch-action

**日期**：2026-07-14 ｜ **根因类型**：CSS 配置冲突 + 隐藏覆盖
**症状**：浮卡（非全屏）内无法上下滚动，全屏卡正常。

**根因（三重叠）**：
1. `exitFullscreen` 用 `querySelectorAll('*')` 逐后代设 `style.touchAction='none'`——
   inline 值永久粘住，父级 pan-y 再也传不下去。
2. gesture-registry 以 `{passive:false}` 注册，浏览器必须等 JS 返回才敢接管滚动。
3. 文档当时写反了「touch-action 不是继承属性」，诱导了错误「修复」。

**解法**：`passive:false→true`；外层 + contentEl 设 `pan-y`；退出全屏只设
`contentEl.style.touchAction='pan-y'`，删后代遍历；文档改分层策略。

**关键教训**：
1. `querySelectorAll('*')` + inline style = 继承链毒药。
2. `touch-action` 是继承属性（inherited: yes）。
3. `getComputedStyle()` 是诊断利器——直接打印有效值，不要猜。
4. `passive:true` ≠ 放弃手势控制：浏览器只在 touch-action 允许的方向接管，
   其余方向仍发 pointermove 给 JS——手势系统与原生滚动可共存。
5. inline style 优先级最高也最难清理：innerHTML='' 不碰 style；批量给继承属性赋值尤其危险。

**组合语义**：pan-y 区域垂直滑 → 浏览器接管（JS 收 pointercancel）；横向滑 → 浏览器
不接管 → JS 手势处理；none 区域 → 浏览器完全不干预。
