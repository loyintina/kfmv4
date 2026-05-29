# KFM v4 Bug Audit Registry (B.A.R.)

> **诊断手册**。遇到 bug 时先翻阅这里，而不是从头排查。
> 第一章 记录已知的隐性契约（破坏它们就会出问题），第二章 记录根因案例和排查路径。
>
> **关联文档**：
> - `KFM_V4_INVARIANTS.md` — 修改代码前的自查清单（预防性）
> - `CLAUDE.md` — 项目总入口

---

## 第一章：隐性契约

> 这些约定在代码中没有显式表达，但违反它们会产生难以调试的 bug。
> 修改对应模块前必须检查这些契约是否被破坏。

### 1.1 事件系统：全项目统一使用 PointerEvent

**涉及模块**：`gesture-registry.ts`、`canvas-scroll.ts`、`card-stack.ts`、`tree-render.ts`、`orb.ts`、所有 CSS 文件

**契约内容**：
- 所有触摸/鼠标输入必须走 `gesture-registry.ts` 的 PointerEvent 调度
- 不要在任何模块中直接添加原生 `touchstart/touchmove/touchend` 监听器
- 如果新模块需要手势，通过 `gestures.register()` 注册，不要自行绑定

**违规后果**：touch 和 pointer 两套事件系统在同一 DOM 元素上互相干扰，导致 `pointermove` 被浏览器提前终止，手势响应不完整。

**历史案例**：2026-05-25 B.A.R. #001

### 1.2 touch-action：全屏单页应用必须全局设为 none

**涉及模块**：`public/css/base.css`、所有 `position:fixed` 的覆盖层

**契约内容**：
- `body`、`.main`、所有全屏覆盖层必须设 `touch-action: none`
- 任何新添加的 `position:fixed` 元素如果覆盖了触摸区域，必须同步设 `touch-action: none`
- **不要**使用 `touch-action: pan-y` 或 `auto`——本项目没有浏览器原生滚动，所有滚动由代码实现

**违规后果**：浏览器检测到垂直滑动后接管触摸，停止派发 `pointermove`，导致手势在外部区域失效。

**历史案例**：2026-05-25 B.A.R. #001

### 1.3 卡片堆是全局模式，不是局部组件

**涉及模块**：`card-stack.ts`、`gestures.ts`

**契约内容**：
- 卡片堆打开后，整屏都是它的操作区域
- 手势系统中的 `targetFilter: () => true` 不是设计缺陷——它服务于"不分内部/外部"的全局模式需求
- 任何试图"精确"限定卡片堆手势区域的做法都会破坏外部触摸体验

**违规后果**：外部区域的手势被其他模块拦截，卡片堆只能在其 DOM 区域内操作。

**历史案例**：2026-05-25 B.A.R. #002（手势区域限定）

### 1.4 点击 BR 光球的切换行为必须双向（togglePanel 模式）

**涉及模块**：`card-stack.ts`（浮卡状态机）

**契约内容**：
- 紧凑态 → 点击 BR → 展开
- 展开态 → 点击 BR → 折叠回紧凑态
- 状态机必须闭环（compact ↔ active），不能单向

**违规后果**：未实现折叠路径时，只能用 dismiss 关闭浮卡，无法回到紧凑态。

**历史案例**：2026-05-24（浮卡折叠缺失）

---

## 诊断流程（视觉/CSS bug 快速排查）

> 遇到视觉效果不符合预期时，先按这个顺序排查，不要跳步去改 CSS 值。

### 第一步：CSS 解析检查
- 在浏览器 DevTools 检查 `document.styleSheets`：争议规则是否存在于 `cssRules` 中？
- 如果规则不存在 → **CSS 语法错误**：检查该规则前最近一条未闭合的 `{`/`(`/`[`
- 如果规则存在但计算样式不匹配 → 检查 **CSS 优先级**（是否有更高优先级的规则覆盖）
- 如果规则存在且优先级正确 → 检查 **选择器是否匹配**（className 拼写、空格/伪类/specificity）

### 第二步：工具编辑安全
- `edit` 工具替换行范围时，检查替换的最后一行是否包含了 `}`/`;`/`)` 等闭合字符
- 如果替换范围外的下一行恰好是结束括号 → 修改替换范围将其纳入
- 如果替换 CSS 块 → 始终在替换内容末尾显式写 `}`，即使原范围外也有

### 第三步：浏览器二次确认
- 修改后刷新页面，用 `getComputedStyle(el)` 验证争议属性的**计算值**
- 不要只看 Elements 面板的 Styles 区——它有时显示的是级联规则而不是实际生效值

---

## 第二章：根因案例库

> 每条案例记录一次完整的 bug 诊断过程。
> 遇到相似症状时，先按"根因类型"和"症状关键词"匹配。
>
> **新流程**: 在翻阅案例库之前，先按上面的诊断流程快速排查。

---

### B.A.R. #006 — `}` 缺失导致 `.sidebar-nav-label` 全部 CSS 规则被浏览器丢弃

**日期**：2026-05-29  
**根因类型**：CSS 语法错误 / 工具编辑遗漏  
**症状关键词**：边框看不见、CSS 规则不生效、计算样式为默认值、样式表规则数量异常

#### 症状
`.sidebar-nav-label` 的边框、背景、display:flex、border-radius、flex:1 全部不生效。
表现为无边框的扁平文字，完全不像 `sidebar-tools` 中的交互元素。
左右两个 button 的样式正常（渐变边框可见）。

#### 根因（一句话）
`edit` 工具替换行范围 165-167 时，`.sidebar-close-btn:hover span{ opacity:1; box-shadow:... }` 的 `}` 在第 168 行（范围外），替换后被丢弃，规则未闭合。
浏览器将此后的所有规则（`.sidebar-nav-label` ~ 文件尾）当作 CSS Nesting 嵌套语法处理，全部丢弃。

#### 排查关键发现
1. 服务器提供的 CSS 文件内容正确，`.sidebar-nav-label` 规则完整
2. `document.styleSheets[1].cssRules` 仅 55 条，正常应为 69+ 条
3. 最后一条规则为 `.sidebar-close-btn:hover span { & .sidebar-nav-label:hover { ...`（断裂）
4. `getComputedStyle(.sidebar-nav-label)` 返回 border/background/display/borderRadius 全为默认值
5. `.sidebar-tools button`（规则在第 54 条之前）样式正常

#### 解决方案
补上缺失的 `}` 和 `;`：

```css
.sidebar-close-btn:hover span{
  opacity:1;
  box-shadow:0 0 8px rgba(0,212,255,.3);
}
```

#### 心法/自查关联
- 新增"诊断流程"第一条：视觉 bug 先检查 CSS 解析，不要分析颜色/透明度
- `edit` 工具行范围替换：替换 CSS 块末尾必须包含 `}`，或扩大替换范围

---

### B.A.R. #001 — 外部区域卡片堆滑动失效（Touch → PointerEvent 迁移断裂）

**日期**：2026-05-25  
**根因类型**：事件系统混用 / 隐式依赖断裂  
**症状关键词**：外部区域、卡片堆、滑动切换、不跟手、偶尔跳变

#### 症状
卡片堆打开后，在 `.stack-card` 内部的垂直滑动能正常切换聚焦卡片；
在外部空白区域的垂直滑动只触发 2-3 次 `onMove` 就终止，焦点不切换。

#### 根因（一句话）
`gesture-registry` 从 TouchEvent 改为 PointerEvent 时，没有同步迁移 `canvas-scroll.ts` 和 CSS 中的 `touch-action`，
两套事件系统在同一 DOM 上互相干扰，浏览器检测到垂直滑动后接管触摸并停止派发 `pointermove`。

#### 排查关键发现
1. 内部滑动：dy 累积到 40+，触发 20+ 次 onMove
2. 外部滑动：dy 最多 11，只有 2-3 次 onMove，且没有 `_handleEnd` 被调用
3. 没有 `_handleEnd`、没有 `condition false`、没有新的 `pointerdown`——_active 被浏览器级截断
4. 排查链路：gestures-page-swipe → canvas-scroll import → sidebarTouchArea → `.main` 的 `touch-action: pan-y`

#### 解决方案
三步迁移（全部在同一 commit 中完成，见 `6294a0d` + `a177b74` + `cca2098`）：
1. `canvas-scroll.ts`：`touchstart/touchmove/touchend` → `pointerdown/pointermove/pointerup`
2. `tree-render.ts`：sidebarTouchArea 的滑动关闭改用 PointerEvent
3. `card-stack.ts`：brOrb 拖拽改用 PointerEvent
4. CSS：`.main` 的 `touch-action: pan-y` → `none`
5. 全局：`gesture-registry.init()` 中设 `document.body.style.touchAction = 'none'`

#### 心法/自查关联
- 第〇章第 6 条（先理解整体，再拆解局部）：跳过这一步就没有同步迁移其他模块
- 自查清单"功能系统关联检查"：改动事件系统时，项目里还有谁在消费触摸事件？

---

### B.A.R. #002 — 手势区域限定导致卡片堆外部滑动失效

**日期**：2026-05-25  
**根因类型**：全局模式误判为局部组件  
**症状关键词**：外部区域、卡片堆、手势注册、targetFilter

#### 症状
卡片堆打开后，外部区域无法通过左滑召唤浮卡、垂直滑动切换焦点。

#### 根因（一句话）
`gestures-page-swipe` 的 `targetFilter` 排除了 `.stack-card` 外部区域，
但卡片堆打开后整屏都应当是它的操作区域。

#### 解决方案
在 `gestures.ts` 中给 `gestures-page-swipe` 增加 `condition: () => !isCardStackOpen()`，
卡片堆打开时否决自身，让 `card-stack-global`（priority 80）全权接管。

#### 心法/自查关联
- 第〇章第 6 条（先理解整体，再拆解局部）：`targetFilter: () => true` 不是粗心
- 隐性契约 1.3（卡片堆是全局模式）

---

### B.A.R. #003 — _currentAccents 初始化时序导致卡片堆崩溃

**日期**：2026-05-24  
**根因类型**：初始化路径遗漏  
**症状关键词**：卡片堆、无法召唤、buildCards 失败、_currentAccents 为 null

#### 症状
页面加载后立即召唤卡片堆，buildCards 抛出 `Cannot read properties of null (reading '0')`。

#### 根因（一句话）
重构后 `_currentAccents` 的默认值为 ``，但 `initCardStack()` → `buildCards()` → `createCard(i)` 在 `_generateRandomAccents()` 之前执行。

#### 解决方案
在 `initCardStack()` 开头加 `_generateRandomAccents()`，确保构建卡片前配色已就位。

#### 心法/自查关联
- 自查清单"初始化路径检查"：这个改动直接催生了这条检查项

---

### B.A.R. #004 — 浮卡折叠缺失（BR 光球只能展开不能折叠）

**日期**：2026-05-24  
**根因类型**：状态机不完整  
**症状关键词**：浮卡、BR 光球、展开后无法缩回

#### 症状
从紧凑态点击 BR 光球展开后，BR 光球的点击不再做任何事情。

#### 根因（一句话）
BR 光球的 click 事件只写了 `compact → expanding` 方向，没有写 `active → compact` 的折叠路径。

#### 解决方案
在 BR 光球的 click 事件中增加 `else if (item.state === 'active')` 分支，实现反向动画（缩回紧凑态并移除 TL/TR/BL 光球）。

#### 心法/自查关联

---

### B.A.R. #005 — 端口冲突 + `tsc` 僵尸进程耗尽服务器资源

**日期**：2026-05-28  
**根因类型**：环境冲突 / 资源管理  
**症状关键词**：服务器卡死、构建超时、API 返回 HTML 而不是 JSON、CPU/内存 99%

#### 症状
`npm run build` 超时 60s 仍未完成，服务器 CPU 和内存占用 99%，API 请求返回 HTML 页面而非 JSON。

#### 根因（一句话）
一个误启动的 `npx serve public -l 8021` 进程抢占 8021 端口且不受 `kill -9` 影响，
导致 Express 服务无法绑定正确端口。同时多次超时的 `tsc --noEmit` 进程在后台堆积，
累积消耗全部 CPU 和内存。

#### 排查关键发现
1. `ss -tlnp` 显示 8021 端口有非 Express 进程占用
2. `ps aux | grep serve` 发现 `npx serve public` 进程
3. `pkill -f tsc` 后发现多个残留 tsc 进程
4. `kill -9` 对 serve 进程无效（需 `fuser -k` 或等其自然退出）

#### 解决方案
1. 清除残留 serve 进程（`fuser -k 8021/tcp`）
2. 在 `package.json` start 脚本中加入 `fuser -k 8021/tcp` 前置清理
3. 在 `build.mjs` 开头加入 `pkill -f "tsc"` 清理残留 tsc

#### 心法/自查关联
- 自查清单"硬编码常量检查"：端口号 8021 不应隐式依赖
- 新增建议：构建入口和启动入口应做资源清理前置

## 附录：根因类型索引

| 类型 | 典型场景 | 排查方向 |
|------|---------|---------|
| 事件系统混用 | touch 和 pointer 同时使用 | 检查所有 addEventListener 的回调类型 |
| 隐式依赖断裂 | 改了一个模块，另一个关联模块失效 | 检查功能系统关联清单 |
| 初始化路径遗漏 | 新数据模型在加载时没初始化 | 检查 buildCards / initXxx 调用链 |
| 全局模式误判 | 把全屏操作区域限定为局部 DOM | 检查 targetFilter 是否过于精确 |
| 状态机不完整 | 交互只有一条路径 | 检查状态迁移图中是否有未实现的方向 |
| CSS 配置冲突 | JS 逻辑正确但视觉效果不对 | 检查 touch-action / pointer-events / z-index |
| 环境冲突/资源管理 | 构建超时、端口冲突、API 返回 HTML | 检查端口占用情况 + pkill 残留 tsc |
| CSS 语法错误 | 规则在 `styleSheets.cssRules` 中缺失 | 检查最近一条规则是否未闭合 `{`/`(`/`[` |

### 1.5 卡片背景和边框必须正交解耦

**涉及模块**：`card-stack.ts`（双层 DOM 结构）

**契约内容**：
- 边框不能寄生在背景的 `background` 层叠上
- 物理结构：外层壳负责渐变边框（通过 `padding` 挤出），内层独立元素负责毛玻璃
- 任何企图在单个 `background` 属性里用 `padding-box`/`border-box` 分层模拟边框的做法都是补丁

**违规后果**：背景透明度或渐变方向一改，边框就消失。边框和背景耦合越紧，改成随机配色时越容易出"边框看不见"的 bug。

**历史案例**：2026-05-24（边框从背景层叠改为双层 DOM，`cbf12f3`）

### 1.6 浮卡和卡片堆卡片必须共享同一套 DOM 结构

**涉及模块**：`card-stack.ts`（`createCard` 和 `launchFocusedCard`）

**契约内容**：
- 浮卡不是独立的视觉元素——它是"从卡片堆飞出去的卡片"，必须和卡片堆卡片保持样式一致
- 内层毛玻璃必须用 `flow` 布局（由外层壳的 `padding` 自然约束），不能用 `inset:0` 的 absolute 定位
- 修改任何一方的背景/边框/布局时，必须同步另一方

**违规后果**：浮卡出现时和卡片堆风格不统一，或者浮卡的毛玻璃覆盖了边框区。

**历史案例**：2026-05-24（浮卡内层毛玻璃改为 flow 布局，`5ed368d`）

### 1.7 卡片双色渐变的颜色对应关系有固定规则

**涉及模块**：`card-stack.ts`（`cardGradient`、光球颜色、图标颜色）

**契约内容**：
- 渐变方向：135deg（右上→左下）
- color1（渐变起点）对应：右侧光球（TR、BR）、图标背景
- color2（渐变终点）对应：左侧光球（TL、BL）、图标数字
- 文字颜色统一用白色，不派生自任何卡片色（视觉舒适 > 派生规则）

**违规后果**：光球颜色与接触的边框区域不匹配，或者文字在深色背景上看不清。

**历史案例**：2026-05-24（光球颜色修正 + 文字改为白色，`68f0b32`、`1e256f1`、`e652a43`）

### 1.8 颜色随机的种子在 `openCardStack` 时生成，不在 `initCardStack` 时

**涉及模块**：`card-stack.ts`（`_generateRandomAccents`）

**契约内容**：
- `_generateRandomAccents()` 在 `openCardStack()` 开头调用，每次召唤都重新随机
- `initCardStack()` 只在页面加载时调用一次，也需预生成一次配色避免 null 崩溃
- 初始化路径上的任何消费者（`createCard`、`buildCards`）必须保证 `_currentAccents` 已赋值

**违规后果**：页面加载时 `_currentAccents` 为 null，`createCard` 崩溃，卡片堆完全无法初始化。

**历史案例**：2026-05-24（`_currentAccents` 初始化时序 bug，`ccaeaf3`）
