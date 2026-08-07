> 这是什么：Bug 回归登记表——687 个历史 fix 蒸馏成「该不该测 / 测了没」的追踪地图。
> 别的去哪找：修 bug 流程 → ../workflows/bug-fix.yaml；测试方法论 → ../guides/testing.md；排查流程 → ../constraints/diagnostics.md。

# KFM v4 — Bug 回归登记表（Regression Registry）

> **把 687 个历史 `fix` 蒸馏成「该不该测 / 测了没」的追踪地图。**
>
> 配套设计文档：docs/archive/design/REGRESSION_TESTING_SYSTEM.md（方法论与实施步骤，v8.2 注销，git show v8.1.1 考古；素材摘要 → ../guides/testing.md#素材考古）。
> 编号体系复用 docs/archive/standards/BUG_AUDIT_REGISTRY.md 的 B.A.R. 命名空间（原文同上考古）。
> 隐性契约相关条目与 `../constraints/diagnostics.md` §一 一一呼应。
## 分类图例


| 标 | 含义 | 处置 |
|----|------|------|
| `L` | 逻辑：有明确对错、纯函数可测 | 写回归钉子 |
| `I` | 集成：跨模块时序/协作 | 写集成测试 |
| `V` | 视觉：观感，无对错 | 不测，冒烟层兜底 |
| `S` | 叠加：被后续 fix 覆盖的中间态 | 只测最终形态，合并计 |
| `D` | 死：涉及已删除/重写的代码 | 跳过 |

**状态**（枚举前缀，后可接括注）：`✅ 已钉` / `✅ 修复`（未钉，冒烟兜底）/ `待钉` / `兜底` / `跳过`。完整格式规约 → ../guides/doc-maintenance.md 各层 grammar。

---

## 登记表

> **分批滚动填充**，按实施批次推进，不要求一次填满 687 条。
> 表结构：`BAR编号 | commit | 一句话症状 | 类别 | 状态 | 测试位置`

### 第一批：AI 对话运行时（run-manager / chat / 重连）

| BAR | commit | 症状 | 类别 | 状态 | 测试位置 |
|-----|--------|------|------|------|---------|
| BAR-101 | `a5bf0c4` | 生成结束后 `__end__` 不发，发送按钮卡死 + 残留等待框（run.done finally 时序） | I | ✅ 已钉（revert 验证） | `tests/run-manager.test.ts` |
| BAR-102 | `f46a551` | 推理模型等待提示留白 + 删会话后再发送 400（空 sessionId） | I | ✅ 已钉（102a-e，服务端校验，revert 验证） | `tests/server-routes.test.ts` |
| BAR-103 | `1d9fdbc` | 删最后一个会话后统计行不更新（消息计数口径） | L | ✅ 已钉（103a-c 计数 + 103d/e 着色，剥离 countTextMessages，revert 验证） | `tests/client-logic.test.ts` |
| BAR-104 | `d4a60f7` | 挂机重连：已完成 run 补齐续读 / fromIndex 续读 / supersede 取代 | I | ✅ 已钉（104a/b/c，revert 验证） | `tests/run-manager.test.ts` |
| BAR-105 | `da39891` | 取消时未完成工具卡卡在「忙碌中」 | L | ✅ 已钉（105a-c，剥离 cancelPendingToolBlocks，revert 验证） | `tests/chat-protocol.test.ts` |
| BAR-106 | `7ac8f47` | Claude 工具块非零起始 index → content 空洞 → `reading type` 崩溃 | L | ✅ 已钉（106a-d，剥离 createClientIdxMapper，revert 验证） | `tests/chat-protocol.test.ts` |

### 第二批：服务端 + 安全边界

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-SEC-01…06 | `path-utils` | sanitizePath 路径逃逸守卫（目录遍历/绝对路径/前缀绕过/多段遍历） | L | ✅ 已钉（安全关键） | `tests/path-utils.test.ts` |

> files 路由 CRUD 校验待后续补充。

### 第三批：客户端逻辑

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-103a-c | `b8dec96`/`1d9fdbc` | 消息计数只算有正文的消息（工具/空白不计） | L | ✅ 已钉 | `tests/client-logic.test.ts` |
| BAR-103d-e | `427c960` | 切模式时临时卡按模式色系重着色（曾传空数组失效） | L | ✅ 已钉 | `tests/client-logic.test.ts` |
| tree-model | — | buildTree 空列表/单文件/折叠边界 | L | ✅ 已钉（基础） | `tests/client-logic.test.ts` |

> 滚动约束过滤折叠节点（光标 fix 串）逻辑与 canvas-cursor 渲染耦合，留待渲染剥离批。

### 渲染剥离批：canvas-cursor / canvas-scroll

| BAR | commit | 症状 | 类别 | 状态 | 测试位置 |
|-----|--------|------|------|------|---------|
| BAR-201 | `d4f658a` | 液体粒子不跟随光标右滑回弹（坐标系不含 transform.translateX） | L | ✅ 已钉（剥离 liquid-geometry，201a/b 平移协变，revert 验证）<br>注：适配器 `bx=cb.x+transform.translateX` 的接线由 tsc 保证，未单测（DOM 耦合） | `tests/liquid-geometry.test.ts` |
| BAR-202 | `9cb6622` | 右滑临时卡组 z-index 埋在文件树之下 | L | ✅ 已钉（202a-c，z-index 层级不变量，revert 验证） | `tests/invariants.test.ts` |

### 第四批：文件树 + AI 对话修复（v7.3.1）

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-TREE-HIDDEN-01 | `0f240ec` | showHidden=false 时隐藏文件不出现（节点数严格少于 true） | L | ✅ 已钉（revert 验证） | `tests/client-logic.test.ts` |
| BAR-TREE-HIDDEN-02 | `0f240ec` | showHidden=true 展开后包含隐藏文件（节点数 >=4） | L | ✅ 已钉（revert 验证） | `tests/client-logic.test.ts` |
| BAR-TREE-HIDDEN-03 | `0f240ec` | fetchDirRecursive 始终传 showHidden:true（源码检查，防止 toggle 变慢回归） | L | ✅ 已钉（revert 验证） | `tests/client-logic.test.ts` |
| BAR-SEC-07 | `7af0792` | .kfmv4/ 不再屏蔽（用户个人配置，不在仓库中） | L | ✅ 已钉（providers.json/sessions/roles 放行验证） | `tests/path-utils.test.ts` |
| BAR-TREE-HIDDEN-04 | `state` | showHidden 状态刷新后丢失（未持久化到 localStorage） | L | ✅ 已钉（源码检查，排除注释行，revert 验证） | `tests/client-logic.test.ts` |
| BAR-CHAT-LOOP-01 | `chat.ts` | filesChanged 只在成功时设 → bash 复合命令失败但文件已删时不刷新 | L | ✅ 已钉（源码检查：filesChanged 不在 !isError 条件内） | `tests/chat-protocol.test.ts` |
| BAR-CHAT-LOOP-02 | `chat.ts` | 循环里没有 yield tool_result → 客户端收不到事件 | L | ✅ 已钉（源码检查：循环内有 yield tool_result） | `tests/chat-protocol.test.ts` |
| BAR-CHAT-LOOP-03 | `chat.ts` | } 缩进错位 → continue 丢失 → AI 只能调一次工具 | L | ✅ 已钉（源码检查：有 continue） | `tests/chat-protocol.test.ts` |
| BAR-MSG-NULL | `3833945` | content 含 null block（AI 只调工具不说话）→ extractMessageText 崩 → session card 白屏 | L | ✅ 已钉（revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-REASON-01 | `aa26002` | 思考块套逐帧折叠 → 历史消息每条注册 _activeFoldAnims → rAF 无限重渲染 = 鬼畜滚动 | L | ✅ 已钉（源码检查：rid 不进 _activeFoldAnims，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-CSS-VER | `73bf449` | CSS link 无版本号 → 浏览器缓存旧样式 → 动画/布局改动不生效（多次动画 bug 根因） | L | ✅ 已钉（源码检查：build.mjs 给 CSS 加 ?v=） | `tests/client-logic.test.ts` |
| BAR-ORB-FOLLOW-01 | `59b202f` | 追底反复回归4次：suppressScroll 时间窗口吞掉流式期间用户上滑的 scroll 事件 → 取消不了追底 | L | ✅ 已钉（源码检查：无 suppressScroll 代码行 + 有 touchmove/wheel 手势监听，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-FOLLOW-02 | `6edb3cc` | 追底残留：等待提示 startWaitingIndicator 无条件 followBottom=true+滚底，工具轮次每轮抢追底 | L | ✅ 已钉（源码检查：函数体内 scrollToBottom 有 followBottom 守卫、无无条件 followBottom=true，revert 验证） | `tests/client-logic.test.ts` |

### 第五批：orb 工具框折叠状态机 + 会话持久化竞态（d64ba51 重构善后）

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-ORB-FOLD-01 | `d64ba51` | 工具框输出「一闪而过」：用「有结果+有参数」判折叠 → 输出一到 forceOpen 立即转 false 塌下，340ms 折叠动画被架空。正确态：结果到达进 reveal 停留期（展开播涌现动画）→ WAIT 后转 fold 播折叠动画 → 落定收起 | L | ✅ 修复（v8 渲染重写后 v7 foldPhase/computeToolFoldOpen 机制消亡：折叠=CSS class 即时切换 + `_foldState` 持久，无 forceOpen 竞态向量；打字机 reveal 等相邻行为有 BAR-ORB-PANEL-21 钉） | 架构吸收，冒烟兜底；复核日 2026-11-02 |
| BAR-ORB-LEAK-01 | `orb-chat` | 折叠动画 rAF 死循环：被视口裁剪滚出窗口的工具块，模板内清理路径永不执行 → `_activeFoldAnims` 条目永久滞留 → rAF 每帧无限 renderChatContent，CPU 打满卡死（BAR-ORB-REASON-01 孪生变体，裁剪触发） | L | ✅ 修复（v7 rAF 折叠动画注册表随渲染器删除（4601fdc）；v8 折叠=CSS class 无 rAF 注册表，泄漏向量消亡；REASON-01 相邻钉在） | 架构吸收，冒烟兜底；复核日 2026-11-02 |
| BAR-ORB-SESSION-01 | `session-store` | 新建会话覆盖旧会话：create() 只在内存 unshift 不写盘 + patchActiveConfig fire-and-forget → 随后 load() 重拉列表不含新会话、读旧 active.json 覆盖 activeId → 新会话丢失/旧会话被串写 | I | ✅ 修复（create 立即写盘 + await active.json；load 保护有效内存 activeId 不被覆盖） | 集成时序，冒烟兜底；复核日 2026-11-02 |
| BAR-ORB-SESSION-02 | `session-store` | 刷新吞记录：AI 回复仅在流全部结束才 saveMessages，多轮工具调用中途刷新/服务端 run 丢失 → 本轮记录未落盘丢失 | I | ✅ 修复（每轮 message_stop 增量落盘 onPersist；saveMessages 串行化防并发写交错） | 集成时序，冒烟兜底；复核日 2026-11-02 |
| BAR-ORB-SESSION-03 | `orb.ts` | 切会话内容错乱：切换监听器 await load 后 getMessages().then 覆盖 chatMessages，与进行中流式追加打架 | I | ✅ 修复（切换前 abort 进行中 run + _switchToken 丢弃过期加载结果） | 集成时序，冒烟兜底；复核日 2026-11-02 |

### 第六批：会话分段加载 + 视口裁剪滚动（性能优化善后）

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-ORB-PERF-01 | `session-store` | 会话卡加载慢/无内容：loadSessions N+1 逐文件全量读（单会话可达 600KB），3 会话串行传 ~900KB。改服务端 `/api/sessions/list` 单请求只返元数据（id/title/updatedAt/messageCount，剥离 messages），~200B/条 | I | ✅ 修复（元数据端点 + 客户端 messages 懒加载） | 冒烟兜底；复核日 2026-11-02 |
| BAR-ORB-SEG-01 | `files.ts` | 会话消息分段切片：`/api/sessions/messages` 按 head/tail 切片，避免大会话全量传输。面板追底用 tail、卡片预览用 head。切片边界算错会漏/重/错序消息 | L | ✅ 已钉（剥离 sliceMessages 纯函数，含 head++tail 拼接不变量） | `tests/server-routes.test.ts` |
| BAR-ORB-SEG-02 | `orb.ts` | 切换会话切不过去：sessionStore.init() 监听器抢先改 activeId，orb 监听器 guard `sid===activeId` 误成立 → return → 内容永不重载 | I | ✅ 已钉（源码检查：guard 比较 _renderedSessionId、且不比较 sessionStore.activeId，revert 验证咬合） | `tests/client-logic.test.ts` |
| BAR-ORB-SEG-03 | `orb.ts` | 分段加载黑屏：第一段 12 条未触发裁剪，prepend 补齐后超阈值触发裁剪，preserve 模式用失配的 prevScrollTop 定位窗口 → 底部移出渲染窗口黑屏 | I | ✅ 修复（补齐段改用 follow 保持追底，不用 preserve）·**不钉**：依赖「切换=追底」产品决策，源码断言 `'follow'` 无区分度、逻辑隐晦，注释说明即可 | 集成时序，冒烟兜底；复核日 2026-11-02 |
| BAR-ORB-SEG-04 | `orb-chat` | 上滑跨裁剪边界卡顿跳位：未测量消息按 DEFAULT_MSG_H=80 估算，进窗口后真实高度≠估算，padding 差值补偿突变 → scrollTop 突跳 | I | ✅ 已钉（钉见 BAR-ORB-SEG-02：源码断言同组「BAR-ORB-SEG-02 / SEG-04 会话分段加载两条隐性契约」） | `tests/client-logic.test.ts` |
| BAR-ORB-CULL-01 | `orb-chat` | 第二轮流式一帧一帧卡：视口裁剪按 `messages.length` 触发，但一条 AI 消息可含几十个工具框（每个是重 DOM 单元）；第一轮 20 工具框只算 1-2 条消息 → 不裁剪 → 每帧全量重建全部工具框 | L | ✅ 修复（v8 改用浏览器原生 content-visibility 逐元素裁剪（chat-dom 有注释），JS 权重计数 `_cullWeight` 随 v7 渲染器删除；逐元素机制天然无「工具框计数盲区」） | 架构吸收，冒烟兜底；复核日 2026-11-02 |

### 第七批：v8.1 光球面板性能架构（展开慢 2-3s + 拖拽卡顿根洽）

> 根因：v8.0 重写渲染路径时删除了 v7 的视口裁剪 + 渲染缓存（SEG-03/SEG-04/CULL-01
> 所钉的 v7 机制随之移除），历史挂载变成「每次展开全量同步渲染」。
> v8.1 用与增量 DOM 模型兼容的机制接替：面板 DOM 持久化 + 窗口化挂载 +
> content-visibility 原生裁剪 + 渲染产物缓存。

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-ORB-PANEL-01 | `orb.ts` | 点击展开 2-3s 无响应：每次展开 buildPanelContent 重建 innerHTML + 全量重挂历史（marked+hljs 全量同步跑），还制造 _contentArea 失效竞态需订阅补渲兜底。契约：expandPanel 只切显隐，面板创建收敛到 ensurePanel 幂等入口 | I | ✅ 已钉（源码检查：expandPanel 体内无 buildPanelContent/initChatDom/mountAiMessage/sessionStore.subscribe，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-02 | `orb.ts` | 同根因：loadSessionInto 全量挂载 + 「面板已展开则 clearChatDom 再全量挂一遍」双重渲染。契约：历史窗口化（首屏只挂尾部 MOUNT_WINDOW 条，滚动近顶部经 setHistoryLoader 翻页 prepend），loadSessionInto 只走 _mountHistoryWindow | I | ✅ 已钉（源码检查：loadSessionInto 体内无直接 mount/展开态补渲分支，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-03 | `chat-dom` | 拖拽卡顿主因：全量历史常驻 DOM，每条气泡渐变+阴影参与重栅格化；且批量挂载每消息读 scrollHeight = 每消息一次强制 reflow。契约：消息容器 content-visibility 原生裁剪 + _mdCache/_hlCache 产物缓存 + scrollToBottom 受 _scrollSuspend 抑制 + 翻页 withScrollAnchor 锚定 | L | ✅ 已钉（源码检查四要素，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-04 | `drag-handler` | 拖拽卡顿次因：backdrop-filter 让面板区域每帧重跑 GPU 模糊合成。契约：拖拽期 _suspendPanelBlur 挂起、onSavePosition 恢复；pointercancel 分支必须也调 onSavePosition（否则模糊挂起后永不恢复） | L | ✅ 已钉（源码检查：pointercancel 分支含 onSavePosition 调用，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-05 | `orb.ts` | 226c2fb 治卡顿整体跳过拖拽期面板更新（治标），破坏「面板随光球移动」设计契约 → 光球走了面板原地不动。契约：onMoveNormal 必须 rAF 合帧调 updatePanelPosition（性能根因已由 PANEL-01…04 根治，行为不需要再牺牲）；拖拽期间不调 _renderChat（scrollHeight=强制 reflow，松手统一滚） | I | ✅ 已钉（源码检查：onMoveNormal 含 updatePanelPosition、不含 _renderChat 调用，revert 验证） | `tests/client-logic.test.ts` |

### 第八批：v8.1 交互回归恢复 + 运行时/构建优化

> 恢复 v7 被砍的交互契约（scrollMode/等待提示门控、Todo 面板、复制按钮、打字机、
> 摸鱼轮换），及全项目前端优化盘点落地的修复（minify+gzip、浮卡模糊挂起、
> measureText 缓存、三处监听泄漏、仓库根目录暴露收敛）。

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-ORB-PANEL-06 | `orb.ts` | 上滑看历史被流式事件反复拽回底部：`_renderChat(scrollMode)` 收参但忽略、无条件滚底；等待提示出现也强制滚底。契约（v7 原设计）：follow 强制追底 / auto 走 `getFollowBottom()` 门控 / preserve 不动 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-07 | `orb-chat-hints` | Todo 浮动面板永不出现：v8 拆分丢 `renderTodoPanel` 调用方；且 dismiss 分支写反（进行中 5s 消失、全完成常驻）。契约：updateTodoFromTool 接通渲染；allDone→5s 淡出、进行中→常显 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-08 | `chat-dom` | 复制按钮纯装饰（只创建未接处理）；工具结果打字机 reveal、执行期摸鱼提示轮换两个 v7 特性被砍 | L | ✅ 已钉（源码检查四要素，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-09 | `chat-dom` | 每个 text_delta 同步 `scrollToBottom` = 每 delta 一次强制 reflow。契约：`_maybeScroll` rAF 合批；`scrollToBottom` 本体保持同步语义（显式调用方依赖） | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-CARD-BLUR-01 | `floating-card` | 浮卡拖拽卡顿：`blur(16px)` 背景每帧重算 + 位置直写无合批。契约：拖拽期 `_suspendCardBlur` 挂起、`onSavePosition` 恢复（orb 同款模式） | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-LEAK-01 | `config.card` | activate 挂 3 个 window 监听（session/provider/model-change）从不移除，每次激活泄漏 3 个闭包 | L | ✅ 已钉（源码检查：handler 存字段 + deactivate 移除，revert 验证） | `tests/client-logic.test.ts` |
| BAR-LEAK-02 | `session.card` | kfm-session-change 监听只挂不摘（与 LEAK-01 同模式） | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-LEAK-03 | `tree-render` | 每次开侧栏叠加一个匿名 resize 监听，开 N 次 = resize 调 N 次。契约：具名 handler + 单次注册守卫 | L | ✅ 已钉（源码检查：无匿名 resize 注册，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ENGINE-01 | `renderer` | 每个文本 Box 每帧 `measureText('Ag')`（常驻 60fps 全量重绘下的测量大头）。契约：字体度量按 font 缓存 | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUG-01 | `面板发送` | 面板发送消息无响应（2026-07-29 用户反馈，活 bug；08-03 确认早已修复——F2「bug 入口无强制通道」现场：以散文挂 STACK 未进 BAR，修完无人追）。追溯登记：F2 机械化后 bug 必须 BAR 登记（check-stack-status R4 入口门） | L | ✅ 修复（用户确认） | — | 复核日 2026-08-11 |
| BAR-BUILD-01 | `build.mjs` | bundle 1.9MB 未压缩源码上线（minify 后 1.07MB，-44%）；版本号正则吞不掉旧 query 叠加成 `?v=A?v=forceB` 畸形 | L | ✅ 已钉（源码检查：两处 minify + index.html 无双重 query，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-02 | `server/index` | 无 gzip（1.9MB 直传）；`express.static` 挂载仓库根把 `.git`/`src`/`node_modules` 暴露 HTTP。契约：compression filter 排除 `/ai/`（SSE 不缓冲）+ 禁止重挂根目录 | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-10 | `chat-dom` | 摸鱼提示跑到用户消息上方：`setWait(true)` 在 doSend 前执行，hint 先挂载，`_createMsgContainer` 裸 `appendChild` 把消息插到 hint 之后。契约：非 prepend 分支必须 `insertBefore(msgEl, hint)`，hint 恒在尾部 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-03 | `build.mjs` | **线上事故**：compression 未列入 server external，被打进 ESM bundle，其 CJS 依赖 `require("buffer")` → 启动即崩，systemd 重启风暴 76 次、全站 502，`kfm-restart` 后服务再也起不来。契约：server 构建 external 必须含全部 CJS 运行时依赖 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-11 | `chat-dom` | 思考框永不自动折叠：仅 tool_result 路径有折叠逻辑，纯文本回复摊到底。契约：首个 text_delta（思考结束）+ message_stop 兜底 + tool_result 三路径统一走 `_autoCollapseThinking`，尊重 `_foldState` 手动展开 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-12 | `chat-dom` | 流式期 textContent 裸奔 md 源码、block stop 时突变成渲染态。契约：`_scheduleStreamingMd` 120ms 节流轻管线（marked+高亮，跳过 KaTeX/mermaid）；final 渲染前 `_cancelStreamingMd` 防轻管线覆盖；部分渲染不进 `_mdCache`；clearChatDom 清计时器 | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-13 | `chat-dom` | 历史思考框显示 ▶ 标记却摊开着、点击无法折叠：折叠容器用 `orb-fold-open` 类，但 `.collapsed` CSS 只定义在 `.orb-fold-content.collapsed` 上——`orb-fold-open.collapsed` 无任何规则，toggle 的是无效果的类。契约：思考框折叠容器必须 `orb-fold-content`；死类 `.orb-fold-open` 从 SCSS 清除 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-14 | `chat-dom` | 摸鱼提示每 1.5s 覆盖已完成工具的真实输出、折叠再展开还在滚：`_createToolCard` 无条件 `setInterval`，历史挂载路径无人清计时器。契约：提示只在执行期由 patchEvent/mountAiMessage（无 result）经 `_startToolHint` 启动，tool_result 经 `_stopToolHint` 停 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-15 | `base.scss` | 摸鱼提示脉冲点不播动画：`@keyframes orb-hint-pulse` 靠 `startWaitingIndicator` 运行时注入 `<style>`，未触发过等待提示的页面（纯看历史）keyframes 缺失。契约：keyframes 必须静态定义在 base.scss，禁止 JS 注入 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-16 | `orb-chat-run` | 「请求失败/已取消/未收到回复/未配置 Provider」只 push 数据层永不上屏（发送失败界面毫无反应）；取消后工具卡永远"忙碌中"+提示无限轮转。契约：兜底一律新起消息 + `mountFallbackAiMessage` 上屏（append 进已挂载消息在增量 DOM 下不会投影）；两处 AbortError 必须 `settleToolCardsDom` | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-17 | `chat-dom` | 非思考模型每条回复多一条空壳"已思考"折叠条：block start 无条件建思考块。契约：`content_block_start(text)` 不建，首个 thinking_delta 懒创建（v7：reasoning 非空才渲染） | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-18 | `chat-dom` | 并行工具 input_json_delta 无视 event.index 全灌最后一张卡（JSON 错乱）。契约：`_blockToolIds` 路由表，delta/stop 按 index 寻址；stop 时 pretty-print 后再高亮 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-19 | `chat-dom` | read 读 .md 退化为等宽纯文本（`.orb-tool-md` 整套样式成死代码）；mermaid SVG 未就绪就写进 `_mdCache`，重挂后永远显示原始代码。契约：read+md 走 orb-tool-md 全管线；含 ```mermaid 文本不读写缓存 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-20 | `orb` | Todo 面板刷新/切会话后不再恢复（v7 每次渲染末尾重挂）；面板收起再展开无条件拽回底部。契约：`_mountHistoryWindow` 末尾 `_restoreTodoPanel`；`expandPanel` 追底走 `getFollowBottom()` 门控 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-21 | `chat-dom` | 细节组：新消息滑入动画丢失（`orb-msg-new` CSS 无使用者）；打字机 reveal 期间 pre 不滚底（长输出停在开头）；340ms 定时折叠把 500ms 打字机折进一半；无参数工具显示空输入框+分隔线。契约：live 挂载 animate=true；reveal tick 滚底；折叠由 onDone 回调触发（禁 setTimeout）；`_hideEmptyToolInput` | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-04 | `build/check` | 「接线丢失」类 bug（CSS 定义了没人用/JS 引用了没定义）反复出现却无防线。契约：`scripts/check/check-css-wiring.mjs` 双向检查 orb-* 类与 keyframes，挂在 build 和 npm run check 链 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |

| BAR-ORB-PANEL-22 | `orb-chat-hints` | Todo 面板 ✕ 关闭后刷新又弹出：关闭只清内存，`_restoreTodoPanel` 从数据层找回结果重挂。契约：`dismissTodoPanel` 记录列表指纹到 localStorage；`updateTodoFromTool` 同指纹跳过渲染、新列表（指纹不同）清记录并恢复显示 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-COMPACT-01 | `orb-chat-run` | doSend 发给 API 的载荷 ~90% 是工具 I/O（45 万 tokens/轮、TTFB 5-8s）；saveMessages 每轮全量上传冗余。契约：apiMessages 是压缩投影（会话文件全量不动），G1 最近 8 轮用户回合豁免（v8.3.x 边界实验定标，原「2 条 AI 消息」会让多工具回合证据跨回合蒸发）/ G4 最新 todo 结果豁免 / `kfm-no-compact=1` 逃生门 / `[compact]` 观测日志；saveMessages 仅新会话调用（服务端 /ai/chat/start 自己落盘） | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-COMPACT-02 | `build/check` | 新增工具若不登记压缩行为，上下文压缩策略随工具增多悄悄失效。契约：`scripts/check/check-tool-compaction.mjs` 双向核对注册工具 ↔ 压缩器登记（豁免型也要登记 + 注明 G 依据），挂 build 和 npm run check 链，失配 = 构建中断 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-COMPACT-03 | `omp/glob` | glob 默认上限 maxResults=200 命中时输出无截断标记（「未看全」类：匹配 500 个 AI 以为 200 是全部；实测 native totalMatches 顶格=返回数不可用；真实会话有一次顶格 200 行无法判断全否）。契约：+1 探针法（请求 maxResults+1，超出则只展示 maxResults 条 + `(结果被截断)` 标记行；恰好顶格不算截断），与 grep limitReached 同语义 | I | ✅ 已钉（真实 native 功能测试三边界：超限/未超/恰好顶格，revert 验证） | `tests/omp-glob.test.ts` |
| BAR-COLOR-01 | `8679cb3` | color-utils sat/lit 越出 0-100 范围 → 非法颜色输出 | L | ✅ 已钉（2026-07-29 交叉检查补登记） | `tests/client-logic.test.ts` |
| BAR-COLOR-02 | `8679cb3` | 边界 HSL（黑/白/全饱和）→ 非法 hex | L | ✅ 已钉（2026-07-29 交叉检查补登记） | `tests/client-logic.test.ts` |
| BAR-ORB-TREE-01 | `1c2ab9e` | sibling-switcher import 危险模块 → 循环依赖风险 | L | ✅ 已钉（2026-07-29 交叉检查补登记） | `tests/client-logic.test.ts` |
| BAR-ROOT-01 | `46df845` | setActiveRoot 后 getSafeRoot 不反映新根（skipSanitize 旁路遗留） | L | ✅ 已钉（2026-07-29 交叉检查补登记） | `tests/path-utils.test.ts` |
| BAR-SEC-08…13 | `53d47e4`/`a84ccef` | 软链 realpath 逃逸（08）+ Origin 校验五边界（09 跨源 403 / 10 回环放行 / 11 无 Origin 放行 / 12 畸形拒绝 / 13 局域网放行） | L | ✅ 已钉（2026-07-29 交叉检查补登记） | `tests/path-utils.test.ts` + `tests/server-routes.test.ts` |
| BAR-SEC-14 | `ai/routes`+`session-store` | sessionId 路径穿越（2026-07-31 冷启动实验 gpt-5.6-sol 臂发现，源码复核实锤）：/ai/chat/start 只查 truthy（routes.ts:31），session-store `join(SESSIONS_DIR, `${sessionId}.json`)` 读写删三点无格式校验（:40/:116/:174）——`../` 可逃逸 sessions/ 目录，服务端权限内任意 JSON 读写。契约：sessionId 格式白名单全入口统一校验 + join 后 containment 复查。**2026-08-01 续**：初版 ASCII 白名单（`^[A-Za-z0-9_-]{1,128}$`）把中文会话 id 全部误杀（生产 id 即中文标题，测试列表还把「中文」钉在拒绝侧）→ 放宽为 `^[\p{L}\p{N}_-]{1,128}$/u` + UTF-8 字节 ≤ 200（无 `.` 即无 `..` 逃逸，防线不变） | L | ✅ 已钉（白名单校验器 + 落盘单点守卫，revert 验证 2 钉真红；中文放行/超字节拒绝已补钉） | `tests/session-security.test.ts` |
| BAR-SEC-15 | `scripts/agent/tag-advisor` | tag-advisor.mjs:21 shell 注入（2026-07-31 冷启动实验同臂发现，源码复核实锤）：命令行 base/head ref 直插 `execSync(`git log ${baseTag}..${headRef}`)` 模板串——恶意 ref 带 shell 元字符即可以脚本用户权限执行命令。契约：改 execFileSync 参数数组 + ref 严格格式校验 + 恶意 ref 否定测试 | L | ✅ 已钉（execFileSync 参数数组 + REF_RE 白名单，revert 验证 3 钉真红含实锤） | `tests/tag-advisor.test.ts` |
| BAR-PROVIDER-01 | `chat.ts` | kimi-k3 面板发消息 400：tool 结果 content 以结构化对象透传给上游，宽松 provider 容忍、严格端点（api.kimi.com/coding）按 OpenAI 规范拒收。契约：边界规范化——非字符串 content 一律 `JSON.stringify`，tool null 兜底空串；上游错误体必须透传（只报状态码 = 扔掉诊断） | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-PROVIDER-02 | `orb-chat-run` | kimi-k3 真 400 根因（错误体透传后现形）：`assistant must not be empty`——纯思考/取消残留的 AI 消息零正文零工具，进载荷成空 assistant。契约：客户端跳过零正文 assistant（不动 G5 正文）+ 服务端边界 fail-closed 过滤 | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-06 | `build.mjs` | 构建自产永久脏树（接手审计 F4）：buildTime 用 Date.now() 烙进 bundle + index.html 版本戳用 Date.now() 重写 git 跟踪的 index.html → 每次构建产生未提交改动，「未提交=危险」铁律被噪声稀释。契约：确定性构建——BUILD_TIME 用 git 提交时间（%cI）+ index.html 版本戳用 bundle/css 内容 hash（内容不变戳不变） | I | ✅ 已钉（源码检查：无 Date.now 版本戳 + 内容 hash + BUILD_TIME git 提交时间；revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-05 | `build/deploy` | 「反复修反复没效果」历史高发模式：修复已提交但线上进程仍跑旧包（进程加载的是启动那一刻的包），白诊断反复发生。契约：build 写 `dist/build-info.json`（buildTime）+ `/api/system/info` 暴露 buildInfo + `scripts/deploy.sh` 构建→重启→版本握手三步闭环，bug-fix 工作流真机验证前必须 deploy 确认 | L | ✅ 已钉（源码检查 + deploy 端到端实测） | `tests/client-logic.test.ts` |
| BAR-ORB-EMPTY-01 | `orb-chat-run` | 回复错放 reasoning：某些模型/端点把最终回复全写进 reasoning_content、text 留空（todo工具测试尸检 3 条完整交付报告被埋）——显示成「已思考+无回复」，进载荷成空 assistant（PROVIDER-02 的 400 元凶）。契约：正常结束（message_stop）text 空且 reasoning 非空 → 归位为正文；历史加载读时归一化（不改文件）；取消残留不归位（真实历史） | L | ✅ 已钉（纯函数三态 + 接线源码断言，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-RESUME-01 | `orb.ts` | 冷恢复载荷脏（测绘 ai-chat#2，溯源引入 0ebea93，成因 D 复制粘贴漂移）：tryAutoResume 内联复制 doSend 格式转换简化版——无压缩投影、不过滤空壳、塞 `content: null`，严格端点（kimi）400 同款雷，刷新恢复路径必炸。契约：载荷构造唯一入口 `shared/chat-protocol/to-openai-messages.ts`（纯函数，压缩/标注/空壳过滤全在一处），**任何发送路径（doSend/tryAutoResume/未来第三条）必须经此函数**，禁止第三份手写转换；BAR-COMPACT-01/PROVIDER-02 钉子随迁移改指新正典 | L | ✅ 已钉（功能测试 5 项 + 双调用点源码断言，revert 验证真红） | `tests/to-openai-messages.test.ts` + `tests/client-logic.test.ts` |
| BAR-RENAME-01 | `eed2baf` | rename 后树不刷新（测绘 canvas-tree#7，成因 C 权宜——出生即无响应检查无刷新）：重命名成功界面原地不动。契约：submit 必须查 `data.success` + 成功后 `loadFileTree` 刷新 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-DELETE-01 | `cafcb58` | tree-swipe delete 不查响应（测绘 canvas-tree#8，成因 C 权宜——copy/move 都查唯独 delete 不查）：删除失败用户无感知。契约：delete 分支必须解析响应查 `data.success` 并记日志 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-PROXY-01 | `678c6d2` | proxy 非流式分支 method 未传时走 else 带 body（测绘 server#12）（引入实为 fbcc0c7 proxy 创建，678c6d2 为 v7.1.0 拆分迁移点——语义审计 E6）：fetch 对 GET/HEAD 带 body 抛 TypeError。契约：method 缺省、GET、HEAD 一律归无 body 分支 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-DEBUG-01 | `4e59339` | `debugger;` 语句随生产包发布（测绘 client-shell#15）：devtools 打开即冻结页面。契约：debug-assert 不得含 debugger 语句；DEBUG 常开为有意决策（本地单用户应用，断言日志即 bug 上报通道） | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-RESTART-GUARD-01 | `8b1dc57` | /api/system/restart 无 verifyLocalOrigin（测绘 server#7，成因 E 机制没人走——opt-in 机制出生未接入）：恶意网页跨源 POST 可触发服务重启。契约：端点必须挂 guard | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-ORIGIN-GUARD-01 | `683b9f2` | /ai/chat/start 无 verifyLocalOrigin（同 server#7，成因 E）：跨源可触发 AI run（烧额度）。契约：端点必须挂 guard | L | ✅ 已钉（中间件功能测试，跨源 403 真红验证） | `tests/server-routes.test.ts` |
| BAR-SAVE-01 | `0b12122` | 失焦静默保存吞错（测绘 floating-card#20，成因 C 权宜——出生即 `catch { /* swallow */ }` 不查响应）：写盘失败用户无感知且 `_rawContent` 已更新，静默丢写。契约：`_doSave` 查 `data.success` + 失败 toast + 失败不切预览保住文本 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-RECONNECT-01 | `b2f74bc` | WS 重连双开 PTY（测绘 floating-card#17，成因 C 权宜——注释声称 tmux 另行处理但代码无门控）：tmux 卡重连时通用回调与 tmux 回调各发一次 terminal-open，基础 PTY 成孤儿。契约：通用重连回调对 `terminalName === 'tmux'` 早退 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-FLOAT-Z-01 | `1a9a3ec` | 浮卡发射 zIndex 记录与 DOM 发散（测绘 floating-card#18，成因 B 接力——revert 恢复旧实现时未察觉双轨）：`item.zIndex` 用 `_allocZ()`、DOM 覆写为 BASE+length+1，首次 touch 前 `_cardAbove/_cardBelow` 比较失准。契约：`item.zIndex === el.style.zIndex` 全程一致，`_allocZ` 单调递增天然在上，禁止另算发射 z | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-CHAT-RETRY-01 | `ai/chat` | 上游瞬时网络错误杀死整轮 run（todo工具测试 msg 734 尸检：bash(date) 成功后续写 fetch failed 怼进正文，AI 无法接着说话）。契约：fetch 网络级错误（抛出，非 HTTP 状态码）最多重试 2 次（2s/4s 退避）；HTTP 错误透传不重试；用户取消立即上抛 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-FIX-TESTS-01 | `build/check` | 心法 24「修 bug 补钉」靠自觉 → 机械化收编（discipline-mechanize SOP）。契约：`check-fix-tests.mjs`——fix: 提交未触及 tests/ = 中断，`tests:na` 独立行豁免（仿 docs:na）；commit-msg 钩子 + 构建链双执法点 | I | ✅ 已钉（拦截实测 + 源码断言） | `tests/client-logic.test.ts` |
| BAR-CHAT-TS-01 | `ai/routes` | ts 前缀泄漏真相源（v8.3.x 时间戳特性自伤）：投影层给 user 文本加 `[MM-DD HH:MM]` 前缀后，服务端从 apiMessages 提取用户文本落盘 → 会话文件长出前缀、下轮投影再盖一层。契约：落盘必须走请求体 `userText` 原文通道，投影文本禁止回写真相源 | L | ✅ 已钉（源码断言 + 契约条款） | `tests/to-openai-messages.test.ts` |
| BAR-DEPLOY-01 | `build/check` | 旧包验证病灶机械化收编（kfmv4.0 起反复出现、反复靠自觉、反复意识不到）：修复已提交但用户验证的是旧包。契约：`check-deploy-freshness.mjs` 硬门入链（源码比包新=链红，口径 max(HEAD 提交时间, src 最新 .ts mtime) > buildTime）；build.mjs 内 --soft 防自锁；`deploy-fast.sh` 快通道保提交节奏；version-watch 浏览器横幅兜底（bundle define 与服务端 buildTime 同出 BUILD_TIME 单源） | I | ✅ 已钉（硬门实测拦截 + 源码断言） | `tests/client-logic.test.ts` |
| BAR-TS-MIMIC-01 | `ai/chat` | ts 前缀被 AI 当行文格式模仿：投影层给 assistant 历史消息盖前缀 → AI 学成自己的格式，正文开头复读时间戳。第一轮修复（`[ts ]` 标签 + 秒级 + 静态声明）实测**拦不住**——照旧复读，甚至产出 `[ts …] [ts …]` 双前缀杂交体（模仿新前缀 + 历史旧格式残留）。契约（终版）：**前缀只盖 user 侧**，assistant 消息一律不盖——投影里 AI 的历史回复全干净，没有可模仿的样本；静态 system 段声明兜底 | L | ✅ 已钉（源码断言 + 投影测试） | `tests/client-logic.test.ts` `tests/to-openai-messages.test.ts` |
| BAR-EYE-WRAP-01 | `ai/chat` | 动态感官注入无包裹 → AI 主动叙述注入本身（「蓝眼睛在页面状态上停留……」）：动态内容每轮刷新占据最新一条消息的注意力焦点，拟人化标题「（你的眼睛）」进一步诱发元叙述，出戏且稀释正文。契约：`assembleDynamicPrompt` 统一包裹（分隔线 + 使用规则：信息直接取用、勿主动提及注入本身、除非用户问起来源）；page-state 头部去自我指涉；chat.ts 注入不再自贴标签 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-SESSIONCARD-PROVIDER-01 | `ui/session-card` | 会话卡 metaRow 显示 providerId = 信息噪音（用户明令删除：provider 是配置态不是会话信息）。契约：metaRow 只渲染 时间/条数/双 token 三项 | L | ✅ 已钉（源码断言） | `tests/client-logic.test.ts` |
| BAR-PROVIDER-03 | `omp/todo` | gemini-3.1-pro（聚光）发消息 400：`function_declarations[10].properties[todos].items: missing field`——todo 的 todos 参数 type:'array' 缺 items，OpenAI 系宽松容忍、Gemini 严格校验拒收整次请求（非单工具不可用，是整轮 400）。契约：所有注册工具 schema 中任何 type:'array' 节点必须带 items（递归检查嵌套层）；todo items 描述任务项结构（content 必填） | L | ✅ 已钉（递归扫描 + 结构断言，revert 验证真红） | `tests/tool-schema.test.ts` |
| BAR-SESSION-01 | `session-store`+`routes/files` | 会话删除后服务端串档（2026-07-30 terra 臂尸检发现，2026-08-01 flash-10 臂实测实锤）：删除会话只删磁盘文件，`_sessions` 内存缓存不失效——同名新会话 appendUserMessage 接续旧 ctx：①旧消息全量发给 API（turn1 载荷 ~114KB/49,512 tokens vs 干净基线 ~20KB/9,042，5.7× 膨胀）；②flush 以旧 meta 落盘，两段历史合并一个文件（createdAt=旧会话）；③客户端新建会话本地状态为空 → 面板显示干净，污染全在服务端，肉眼测试不可见，刷新后旧消息「复活」。契约：session-store 新增 `invalidateSession()`（不 flush 脏数据——文件已删，flush 会把删掉的会话重新写出）；files.ts delete/rename/move 三路由对 `sessions/*.json` 目标同步失效 | L | ✅ 已钉（修复验证 + bug 机理复现负对照 + 路由接线 + 不 flush 断言，4 钉） | `tests/session-invalidate.test.ts` |
| BAR-BASH-HANG-01 | `omp/bash`+`run-manager` | bash 工具挂死整轮 run（2026-08-01 蔚然五测 live 实锤）：AI 单轮并发两个 bash，其一含进程替换 `comm -13 <(sort …) <(sort …)`——pi-natives spawn 把管道写端泄漏进 node 进程（/proc 实证：node 持有 4 个写端，fd 表 92/50 pipe 慢性泄漏），sort 退出后 EOF 永不到达，`comm` 阻塞 pipe_read 100 分钟 → executeShell Promise 悬挂 → `Promise.all` 悬挂 → for await 永卡 next() → run 永不完成 → 发送按钮永卡「生成中」、面板工具调用处「截断」。症状同构类：上游静默停摆（TCP 半开 `reader.read()` 无数据无错误永不返回）。契约（三层）：①bash 缺省必须带超时 300s（描述承诺的「默认 300」旧代码根本没传，缺省=原生层无超时）；②`ToolContext.signal` 中止信号透传 executeShell（看门狗/取消能杀原生子进程）；③run-manager 停摆看门狗 360s——生成器一个事件都不产出 → 中止 run + error 收尾，覆盖一切「悬挂但不抛错」故障类（**不可 await it.return()**：生成器卡死时 return() 排在 pending next() 后同样永不返回，只能 fire-and-forget）。**2026-08-01 续（后端换芯）**：bash 后端从 pi-natives executeShell 换为 `node:child_process`（/bin/bash -c + detached 进程组 + 负 pid 杀树）——kfmv4 只用 command/cwd/timeout/signal 四参，brush 会话态特性零使用；pi-natives/brush 进程替换 fd 泄漏类（急性死锁+慢性泄漏，每次 bash 漏 ~2 fd）从我们的用法里根除。源码调研：oh-my-pi 全栈 MIT 可得（vendored brush-core 同仓可改），泄漏嫌疑点 brush-core `interp.rs:2208 setup_process_substitution` 写端未回收——上游反馈录 STACK #11 | I | ✅ 已钉（停摆中止 + 持续产出不误伤 + 后端换芯源码断言 + 事故命令进程替换实测 + 超时杀 + abort 杀，6 钉） | `tests/run-manager.test.ts` |
| BAR-TEST-ENV-01 | `tests/preload` | 测试环境污染生产数据目录（蔚然五测尸检发现）：测试以真实 `$HOME` 跑，run-manager/session 类测试落盘把 `s-basic/s-stall/sess-x` 等 11 个垃圾会话写进 `~/.kfmv4/sessions/`——用户会话卡可见，每轮 npm test 再长。契约：`tests/preload.mjs` 头部把 `KFM_ROOT` 重定向到 mkdtemp 临时目录（path-utils import 时读 env 计算 KFM_DATA_DIR，preload 先于一切被测模块）；不改 HOME（smoke 需要）；测试不得假设数据根位置（path-utils 两枚旧钉的 HOME 硬编码已一并解除） | L | ✅ 已钉（隔离断言 + preload 源码断言；全量跑后生产 sessions 零增长实测） | `tests/path-utils.test.ts` |

> 新 bug 修复后：补一个回归钉子 → 在此登记 → 状态置「已钉」。见
> `../guides/testing.md` + `../constraints/invariants.md` §二 #24（修 bug 补钉子纪律）。
| BAR-CARD-GHOST-01 | `card-stack` | 幽灵卡片堆（2026-08-02 用户 live 实测，历史反复出现）：左滑召唤卡片堆后再次左滑投浮卡，正常应关堆——但关闭动画完成后卡片又被拉回展开位，形成「DOM 可见但 state=closed + pointerEvents=none」的幽灵堆：点击/手势全无响应，再次左滑召唤新堆才顶掉。机制=动画竞态：左滑投卡走 `launchFocusedCard(false)`+`closeCardStack()`，前者先启动 pull 反馈回弹补间（延迟 0~0.15s+0.2s 拉出+0.25s 回弹到展开位），后者 0.3s 关闭到 100vw 并置 closed——关闭完成后回弹补间才触发，把卡片从屏外拉回。点击路径走全屏发射（`!fullscreen` 跳过 pull 反馈）故不触发；自 43fcdd2 手势改造成「投卡即关堆」起潜伏。契约：closeCardStack 启动关闭时间线前必须 `killTweensOf` 全部卡片，杜绝任何补间在关闭后把卡片拉回 | I | ✅ 修复（2026-08-02 用户实机验证通过；动画时序无单测载体，冒烟层兜底） | —；复核日 2026-11-02 |
| BAR-CARD-GHOST-02 | `card-stack` | 幽灵堆 II 型——状态机卡死（2026-08-05 用户实测：快速双击召唤按钮必现，进入后手势/按钮全失响应）：closeCardStack 的 `killAllCardTweens()` 无条件执行，opening→closing 反向分支先杀补间再 `_tl.reverse()`——`killTweensOf` 把 _tl 内部补间一并杀掉，空壳 timeline 的 reverse 永不触发 onReverseComplete → state 永卡 'closing'，卡片停半开位=幽灵堆；后续所有 open/close 调用被 state 守卫 return。8-02 cabf697c 引入此路径时验证的是慢速手势（不命中 opening 窗口）故潜伏。契约：反向分支（opening→closing / closing→opening）走 `_tl.reverse()` 绝不杀在途补间；killAllCardTweens 只在全量关闭/打开分支（GHOST-01 防护点）。破案手段：状态迁移探针 `_trace` 上报 client-errors.jsonl（轨迹分叉点一眼定位），破案例后按纪律拆除 | I | ✅ 已钉（源码断言：反向分支先于 killAllCardTweens；2026-08-05 用户实测快速双击/手势/混用全过） | `tests/client-logic.test.ts` |
| BAR-CARD-GHOST-03 | `card-stack`+`gestures` | 按钮「关不上」双重触发竞态（2026-08-05 用户实测，GHOST-02 修复后暴露）：堆开着时点召唤按钮，手势 onEnd「堆外 tap 关堆」（touchend 先到）执行 closeCardStack → state=closing；紧随的按钮 click 看到 `isCardStackOpen()=false`（closing 不算 open）→ 走 openCardStack 反向重开——净效果 关→秒重开，表现为「按钮点了关不上」。探针日志 80ms 内 open/close 机枪交替实锤双触发。契约：手势「堆外 tap 关堆」必须豁免 `#cardStackToggleBtn`（它是控件不是堆外空白）；任何「点击空白关闭」类手势都要豁免会改变同一状态的控件 | I | ✅ 已钉（源码断言：豁免判断在 onEnd 的 closeCardStack 之前；用户实测通过） | `tests/client-logic.test.ts` |
| BAR-CARD-ACCENT-01 | `card-stack` | 反向重开可见跳色（2026-08-05 用户实测）：openCardStack 的 closing→opening 反向分支也调 `_generateRandomAccents()`+`_updateCardStyles()`——那是为「全新打开」设计的（全量路径卡片还在屏外，换色不可见）；反向分支卡片就在屏中央，换色直接可见=观感跳色。契约：随机配色只在全量打开路径（卡片屏外）；反向重开沿用本次打开已生成的 `_currentAccents` | L | ✅ 已钉（源码断言：反向分支先于 _generateRandomAccents；用户实测通过） | `tests/client-logic.test.ts` |
| BAR-CWD-DRIFT-01 | `chat.ts`+`path-utils` | 面板 bash 默认 cwd 漂移（2026-08-02 验证臂 2 实测）：toolCtx.cwd = process.cwd()，命令工作目录随服务启动位置漂移——臂的 bash 命令混入非预期仓库数据（它用 checkpoint+显式 cwd 自救）。契约：PROJECT_ROOT 基于文件位置推导（src/server/path-utils.ts 上两级），chat/rule-engine/files 全链路替换 process.cwd()；bash 工具描述写明「缺省=项目根（会话内固定），跨仓显式传 cwd」 | L | ✅ 已钉（PROJECT_ROOT 绝对性+根判据+关键路径，3 断言） | `tests/path-utils.test.ts` |
| BAR-PERM-01 | `permissions` | 工具 RiskClass 映射完整性（8.5.0 权限引擎）：16 工具四类映射（read 永不 gate / bash=exec / restart=external / 未知=exec 级 fail-closed 方向）；加新工具必须在此登记（infra 契约 #12） | L | ✅ 已钉（映射覆盖含未知默认 3 断言） | `tests/permissions.test.ts` |
| BAR-PERM-02 | `permissions` | evaluate 判定正确性（8.5.0）：read 放行 / bash 无元字符放行、含元字符 ask / 外部副作用 ask / 未知工具 ask（fail-closed——首版未知工具落 exec 分支被放行的 bug 已修） | L | ✅ 已钉（5 断言） | `tests/permissions.test.ts` |
| BAR-PERM-03 | `permissions` | 审计日志落盘（permission-audit.jsonl append-only）：evaluate 每次调用必落审计条目（ts/tool/riskClass/decision/rule） | L | ✅ 已钉（条目字段完整断言） | `tests/permissions.test.ts` |
| BAR-SEMCHAIN-01 | `scripts/agent/semantic-chain` | 巡逻 runner 静默死亡（2026-08-03 接手审计发现）：`921f6744`（08-02 豁免新鲜度机制）新增 checkExemptions 引用未定义变量 `ROOT`（本模块顶层定义的是 `REPO`，新代码沿用了 check 脚本家族的 ROOT 惯例）→ 08-03 04:17 cron 首跑即崩（ReferenceError:117），13 条发现已写 state 但信箱未投——崩溃点恰夹在两个落盘动作之间（非原子）。三处无主人：①runner 自身崩溃无信箱通道（💀 verdict 只覆盖腿一 provider 全灭）；②/var/log 无人消费；③scripts/agent/*.mjs 不在 tsc/check/测试任何覆盖内。修复（2026-08-03）：ROOT→REPO + 主体 try/catch 崩溃投信箱 💀（沉默不允许）+ check-inbox-heartbeat.mjs 挂链（36h 阈值，MECH-FLOW-10，巡逻失败全谱系的机械化主人——上岗即逮住现役停摆 42h） | I | ✅ 已钉（no-bare-root/crash-channel/heartbeat-wired 3 钉，首钉当场咬住注释里的裸 ROOT 字串） | `tests/semantic-chain.test.ts` + `tests/probes/inbox-heartbeat/` |
| BAR-SEMCHAIN-02 | `scripts/agent/agent-runner`+`semantic-audit` | 腿一探针工具流化（2026-08-04 用户拍板）实战暴露双根因：①`parseToolStream` 未解包服务端 SSE 封装（`{index,event}` + `__end__` 哨兵）→ 所有事件静默丢弃、text 永远空（首次实战暴露——此前验证只看会话落盘文件，解析器从未真工作）；②思考链计入 max_tokens：大 prompt 触发无限长思考（52k 字符）吃光 16384 预算 → text 为 0 → validate 必失败。修复（2026-08-04）：parseToolStream 解包 + 服务端 maxTokens/params 透传 + 官方 deepseek 接入（reasoning_content 必须随带 tools 的 assistant 回传，官方 400 实测）+ 任务级 provider/thinking/params + 试点定稿 `provider:'deepseek'` + `thinking enabled + reasoning_effort:'low'` + max_tokens 32000（1 次尝试通过校验，产出真实发现）。⚠️ 教训：中转 thinking disabled 致思考过程外溢进 text、拒不输出 JSON；官方 effort=max 必吃光预算（6272 字符 text 空） | L | ✅ 已钉（tooled-wired/server-extraSystem/task-tools-field/parse-tool-stream 4 钉，fixture 对齐真实 SSE 封装格式） | `tests/semantic-chain.test.ts` |
| BAR-SEMCHAIN-03 | `scripts/agent/semantic-audit` | 裁决轮验证基建提速（2026-08-05 裁决轮实践暴露）：①`--task` 只接受单 id → 5 个受影响探针只能串行验证（15+ 分钟/轮）；②纯文本分支 maxTokens 16000 被思考链吃光 → inter-workflows-infra（21 文件大 prompt）持续「空响应」（重试 3 次全空、provider 单臂链下无顺位）。修复（2026-08-05）：`--task=a,b,c` 逗号分隔多任务（走内部并发池 CONCURRENCY=10，单进程统一写 state 无竞态——多进程并发写 state 有读改写竞态，故不做外部并行）+ 纯文本分支对齐官方标配 maxTokens 32000 + thinking enabled + reasoning_effort low（修复后一次成功报 0，B 组 EX-009 验证通过） | I | ✅ 已钉（parse-only-multi/selected-includes 2 钉，含源码断言防退回 === 单任务退化） | `tests/semantic-audit.test.ts` |
| BAR-SEMCHAIN-04 | `scripts/agent/agent-runner` | 巡逻会话泄漏面板区（2026-08-06 用户发现 sessions/ 根目录冒出 3 个 patrol-* 会话）：分流机制（sessionClass:'script' → sessions/script/，routes.ts「2026-08-06 泄漏根治」）上岗，但巡逻唯一调用通道 `tooledOnce` 没传这个字段 → 探针会话落根目录 → /sessions/list 无过滤全列 → 裸奔进用户会话列表（script/ 里 53 个同类是旧时代客户端事后搬运的遗产）。修复（2026-08-06）：tooledOnce POST 负载补 `sessionClass:'script'`（显式 tools 透传不受影响——白名单判定 explicitTools 优先）+ 根目录 3 个泄漏文件挪入 sessions/script/。⚠️ 教训：机制上岗 ≠ 调用方接线——分流闸只认显式字段，每个 start 调用点都要自查 | L | ✅ 已钉（script-class-routed 1 钉：源码断言 sessionClass 在 start 负载内） | `tests/semantic-chain.test.ts` |
| BAR-FRESH-01 | `scripts/check/check-deploy-freshness` | deploy-freshness 自锁（2026-08-04 再遇，auto-push 注释 08-03 已记载）：旧口径「HEAD 提交时间 > buildTime」→ build 戳提交（chore(build) 只动 public/index.html）必然晚于 buildTime → 红 → 再部署 → 新 buildTime → 再提交戳 → 再红，死循环，一轮部署多卡 2-3 轮。修复（2026-08-04）：口径改「最后一个改 src/ 的提交时间 > buildTime」——只改非 src 的提交（构建戳）不算未部署；src mtime 检查（改了没提交）保留。验证：戳提交后绿（旧逻辑红）/ touch src 红 / 恢复绿，双向实测；auto-push 注释同步 | L | ✅ 已钉（src-only-commit 1 钉：裸 HEAD 时间断言 + src/ 限定断言 + lastSrcCommitMs 断言） | `tests/check-deploy-freshness.test.ts` |
| BAR-GENLIST-01 | `scripts/check/gen-contract-lists` | 契约清单生成器 `\Z` 截断（2026-08-03 裁决流 #12 发现）：节终止前瞻「下一节标题或字面 Z」中 JS 无 `\Z` 转义，被当字面字符 Z——域节内 exports 列含大写 Z（如 floating-shared 的 Z_FLOATING_BASE）时该节在 Z 处被截断，其后文件全丢（floating-card 丢 card-registry.ts 等 16 文件，client-shell/infra 同伤）；且 check-only 与生成共享同一坏解析 → 漂移检查看到的「事实」同样是截断的，链条全绿放行（体检者与被体检者同病相认）。修复（2026-08-03）：前瞻改「下一节标题或字符串真末尾」+ KFM_PROBE_ROOT 注入 + 负例夹具（exports 含 Z 的域节，旧版解析恰好凑齐清单 → 绿，修复后报漂移） | I | ✅ 已钉（探针负例： buggy 版绿/修复版红的构造） | `tests/probes/gen-contract-lists/` |
| BAR-GENINV-01 | `scripts/check/gen-code-inventory` | inventory 生成器静默丢弃显式登记的非代码文件（2026-08-03 裁决流发现，\Z 家族第二例）：DOMAIN_SRC 已登记 `scripts/deploy.sh`/`.githooks/`/`package.json` 入 infra，但展开分支 `isFile() && CODE_EXT.test(p)` 按代码扩展名过滤 → 声明了却蒸发，契约清单与 code-map 承重表脱节（contract-vs-map-infra 发现的真身）。修复（2026-08-03）：显式文件分支去扩展名过滤（声明即意图，目录递归仍过滤）+ .githooks 改逐文件登记 + experiments/coldstart/tools 入 infra 域 | I | ✅ 已钉（源码无过滤断言 + inventory 三文件行在场断言） | `tests/gen-pipeline.test.ts` |
| BAR-SYNCCOUNTS-01 | `scripts/check/sync-counts` | chain:auto 枚举静默丢 gen-* 验证步（2026-08-03 裁决流发现，\Z 家族第三例）：STEPS→短名映射对 gen-*-check-only 返回 null 被 filter(Boolean) 吞掉 → 51 步链只枚举 44 步，check-only 同构共享 → 漂移检查看不见自己漏的步。修复（2026-08-03）：映射补 gen-* 分支，枚举回 51 步，契约括注同步 | I | ✅ 已钉（STEPS 全步 ↔ chain:auto 区块逐一断言） | `tests/gen-pipeline.test.ts` |
| BAR-SYNCCOUNTS-02 | `scripts/check/sync-counts` + `scripts/agent/semantic-mutate` | 变异锚点 find 串内计数与文档耦合、每加钉须人工追平（M01/M11 测试数、M03 阈值，2026-08-03/04 三度打断部署）：锚点 find 嵌着 sync-counts 管理的数字，文档合法演进 → check-mutation-anchors 硬门拦构建。修复（2026-08-04，discipline-mechanize）：sync-counts 登记 semantic-mutate.mjs 为回写面，回写正则限定 find 行（replace 是故意错数=变异物料本体，碰了毁卷）；计数类锚点自此零人工。M03 类（裁决改措辞）仍人工——低频，检出信道已明确 | I | ✅ 已钉（源码断言 + sync-counts 探针夹具扩锚点漂移负例，revert 语义：删登记则探针 expect 行失踪即红） | `tests/gen-pipeline.test.ts` + `tests/probes/sync-counts/` |
| BAR-STACKNUM-01 | `docs/active/stack.yaml`（原 STACK.md，2026-08-06 迁移） + `scripts/check/check-stack-status` | STACK 编号碰撞（2026-08-04 接手审计 F3 裁决）：主列表插入序编号成 1,2,3,8..16,4..7 乱序，研究参考区 0./0b./9./10. 与主列表 #9/#10 撞号 → 引用歧义；check-stack-status 切分正则连研究参考条目一起吞。修复（2026-08-04）：主列表按物理顺序重排 1..17 + 研究参考区迁 R1-R4 独立命名空间 + 编号规范入 STACK 头注（新条目追加末尾）+ check 增 R3 编号纪律（「## 研究参考」前截断切分 + 断号/撞号即拦）+ 活引用面同步（code-map/契约/钉注释）；历史账本行按惯例保留当时编号 | I | ✅ 已钉（源码断言 + 临时夹具断号/撞号负例实测拦截） | `tests/stack-numbering.test.ts` |
| BAR-DOCSCRIPTS-01 | `docs/*`+`scripts/check/check-doc-scripts` | 文档脚本/源码引用 ghost（2026-08-04 语义审计收割，变异基准 M03/M05/M13 家族）：文档引用的脚本/文件不存在仍长期绿灯——M03 check-desc-freshness 已死仍被 workflows/ 引用、M05 tag-adviser 路径拼错、M13 bundle.mjs 幽灵（真身 build.mjs）——历来靠 LLM 探针读 code-map 才可逮（依赖推理）。结晶回路收割（变体 ≥3 → 移民确定区）：新增 check-doc-scripts 三通道——P 反引号完整路径存在性（M05 族）/ Z 反引号纯文件名全树存在性（M13 族，豁免 .card.ts、hello.card.ts 模式示例）/ C workflows/ 面裸 check-* 名现役性（M03 族）。诚实边界：裸 check-* 名限 workflows/（active/guides 讨论未来 check 是内容需要，实测 check-e2e/check-btns/check-superseded-coverage 均规划/历史）；非反引号路径不查（规范要求代码引用用反引号）。基线实测 0 误报（P/Z 全强制面 + C workflows 面）；M08 锚点随 sync-counts 39→40 迁移；变异基准 M03/M05/M13 注解机械化 | L | ✅ 已钉（探针负例三通道各一幽灵+真引用对照，KFM_PROBE_ROOT 注入；变异注解在场） | `tests/probes/doc-scripts/` |
| BAR-SESSION-FLUSH-01 | `session-store` | 会话文件落盘写并发交错（2026-08-04 并发标定实验实锤，bi-r2-t0p0m0r5.json「Extra data」实案）：`_writeToDisk` 异步 writeFile 无写锁——防抖 flush 与强制 flush（tool_result/done/abort）可并发写同一文件，大文件多块写交错 → JSON 拼接损坏。**2026-08-05 复发根治**：首版修复（async writeFile + writing/pendingWrite 锁）只挡得住同层调用——flushSync 的 writeFileSync 不与在途异步写互斥，异步 fd 线程池滞后把旧快照头覆盖在新快照上 → 完整旧档+新档尾巴交错（e9c-t0p0m0r3.json 尸检实锤：file=doc1 完整+doc2 尾，两 doc updatedAt 差 1ms）。根治：`_writeToDisk` 全面同步化（writeFileSync），事件循环单线程下同步写天然串行，锁字段拆除；防抖 200ms 合并频率，单次 sync 写毫秒级面板无感 | L | ✅ 已钉（源码断言：无异步 writeFile/必须 writeFileSync/锁字段清零 + 密集 append/flush 交错行为钉：大内容多块写后文件仍合法完整） | `tests/session-flush.test.ts` |
| BAR-TREE-PERF-01 | `tree-model` | 深层文件夹展开掉帧卡顿（2026-08-05 性能批，c9deb206）：`buildExpanded` 递归无深度限制。修复方案=MAX_EXPAND_DEPTH 深度上限（5→10 又回退 5）。**2026-08-05 整批回退**：该批（10a59fe4/4a8ca471/c9deb206/8534df52）上线后用户实测页面巨卡、卡片堆动画全灭、幽灵堆复发加重——回退前无深度限制也从未出现此症状，判定批次本身改坏了行为，客户端 6 文件整批 checkout 回 10a59fe4~1。教训：性能批没有真机验证就上线；深层掉帧原问题（V 类观感）留待文件树卡片折叠式重构一并解决 | V | 跳过（2026-08-05 整批回退，钉子随批次移除；原问题留待卡片折叠式重构） | — |
| BAR-TREE-PERF-02 | `tree-loader` | 文件树装载/展开 notify 风暴（2026-08-05 性能批，4a8ca471）：ingestTree 每层递归 notify + 展开动画循环重复 notify。修复方案=batch Map 单次 notify + triggerExpandAnimation。**2026-08-05 整批回退**：同 BAR-TREE-PERF-01——批次上线后页面巨卡/动画全灭/幽灵堆复发，整批 checkout 回 10a59fe4~1，原问题（深层展开掉帧）留待卡片折叠式重构 | V | 跳过（2026-08-05 整批回退，钉子随批次移除；原问题留待卡片折叠式重构） | — |
| BAR-SESSION-PROFILE-01 | `ai/routes`+`experiments/paradigm/tools` | 会话权限档案（2026-08-05 用户拍板，实验臂污染事故后立规——臂曾 write 污染 repo/sed 改源码/rm 删会话，experiments/paradigm/index.md §工具权限纪律）：面板与实验跑批共用 /ai/chat/start，实验臂与运维者同权限。契约：body 新增 `sessionClass`——`'script'` 且未显式传 tools 时服务端默认只读白名单 `['read','grep','glob']`（Enforcement by construction：模型根本看不到 bash/write）；panel（缺省）保持全量（undefined，向后兼容）；显式 tools 原样透传（工具行为实验责任在调用方：按纪律在 lab 副本跑）。配套：session-runner.mjs POST 固定带 `sessionClass:'script'`；batch-run.mjs 缺省 tools 同白名单 | L | ✅ 已钉（script 缺省/显式透传/panel 全量三断言） | `tests/server-routes.test.ts` |
| BAR-MSG-PAYLOAD-01 | `routes/files`+`batch-run` | 失控会话冻死面板（2026-08-05 用户实机，e9b-t0p4m0r7 实案）：实验失败臂残留面板会话区（runner 归档前失败不清源文件），面板刷新恢复「最新会话」选中 3.7MB 失控臂（GLM 免费端点循环生成），limit=12 尾部切片返回 1MB+（单条消息超 300KB）→ 移动端 JSON.parse+md 渲染主线程打满，页面加载 1-2 秒后完全冻死，卡片堆动画全灭/幽灵堆皆为其表症（nginx 日志实锤 1,060,795B 响应）。契约三层：①/sessions/messages 响应 `capMessagesPayload` 封顶（条数不变，单条 100KB/总量 400KB，截断标注）；②batch-run 重试耗尽后清理生产区孤儿会话（id+id-tN）；③实验残留整批隔离 script/_quarantine | L | ✅ 已钉（截断+标注/预算/小块不动/条数不变 5 断言） | `tests/server-routes.test.ts` |
| BAR-SANDBOX-JAIL-01 | `ai/routes` | 沙箱逃逸事故（2026-08-06 e13 实案，BAR-SESSION-PROFILE-01 白名单只管「看得见的工具」管不住「工具写到哪」）：T1 两臂（V3）直接 write 穿 fixture 模板把陷阱题预触发（limits.ts 10→12，45 臂数据作废）、一臂（27B）往模板塞 guide、四臂相对路径写文档落进真仓库 docs/ 与 src/client/——「模型只能写自己沙箱」此前只是提示词约定。契约：body 新增 `sandboxRoot`——仅 `sessionClass:'script'` 可设且必须落 `sessions/script/` 内（越界/面板会话一律忽略），透传为 startRun 第 12 参 | L | ✅ 已钉（script 合法透传/panel 忽略/越界忽略/缺省不限制 4 断言） | `tests/server-routes.test.ts` |
| BAR-SANDBOX-JAIL-02 | `tools/index` | 写监狱扼点（同事故）：`executeTool` 在 `ctx.sandboxRoot` 下对 write/edit 做 containment 强制——omp write/edit 用 fs 直写（相对路径按 process.cwd() 解析），与 ctx.cwd 语义并存，双解析任一越界即拒（fail-closed），拒绝文案指回沙箱引导模型改用沙箱内路径；沙箱内放行、未设根不限制（面板会话零影响） | L | ✅ 已钉（相对逃逸拒/绝对逃逸拒/沙箱内放行/无根不限制 4 断言） | `tests/server-routes.test.ts` |
| BAR-SESSION-FEEDBACK-01 | `session.card` | 保存按钮无成功反馈（2026-08-07 排查实锤）：saveName 只有 dirty 去重静默 return，无 flashSaved——blur 先保存成功、click 被去重吞掉，用户零视觉确认；config/paradigm 均复用 card-ui.flashSaved（config:349 / paradigm:171），session.card 缺失即「保存无反馈」回归点。契约：saveName 保存成功路径必须调 `flashSaved(saveBtn)` | L | ✅ 已钉（源码断言：import flashSaved + saveName 体内调用，revert 验证真红） | `tests/client-logic.test.ts` |
