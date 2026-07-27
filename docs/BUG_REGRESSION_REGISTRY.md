---
status: active
created_at: 2026-07-21
maintainer: AI agent
---

# KFM v4 — Bug 回归登记表（Regression Registry）

> **把 687 个历史 `fix` 蒸馏成「该不该测 / 测了没」的追踪地图。**
>
> 配套设计文档：`docs/archive/design/REGRESSION_TESTING_SYSTEM.md`（方法论与实施步骤，已归档）。
> 编号体系复用 `docs/archive/standards/BUG_AUDIT_REGISTRY.md` 的 B.A.R. 命名空间。
> 隐性契约相关条目与 `docs/DIAGNOSTICS.md` §一 一一呼应。

---

## 分类图例

| 标 | 含义 | 处置 |
|----|------|------|
| `L` | 逻辑：有明确对错、纯函数可测 | 写回归钉子 |
| `I` | 集成：跨模块时序/协作 | 写集成测试 |
| `V` | 视觉：观感，无对错 | 不测，冒烟层兜底 |
| `S` | 叠加：被后续 fix 覆盖的中间态 | 只测最终形态，合并计 |
| `D` | 死：涉及已删除/重写的代码 | 跳过 |

**状态**：`待钉` / `已钉` / `兜底`（冒烟覆盖）/ `跳过`。

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
| BAR-ORB-FOLD-01 | `d64ba51` | 工具框输出「一闪而过」：用「有结果+有参数」判折叠 → 输出一到 forceOpen 立即转 false 塌下，340ms 折叠动画被架空。正确态：结果到达进 reveal 停留期（展开播涌现动画）→ WAIT 后转 fold 播折叠动画 → 落定收起 | L | ✅ 已钉（01a-e，剥离 computeToolFoldOpen 纯函数，唯一真相源 foldPhase） | `tests/client-logic.test.ts` |
| BAR-ORB-LEAK-01 | `orb-chat` | 折叠动画 rAF 死循环：被视口裁剪滚出窗口的工具块，模板内清理路径永不执行 → `_activeFoldAnims` 条目永久滞留 → rAF 每帧无限 renderChatContent，CPU 打满卡死（BAR-ORB-REASON-01 孪生变体，裁剪触发） | L | ✅ 已钉（源码检查：rAF 前无条件扫除超时条目、且在 size 判定之前） | `tests/client-logic.test.ts` |
| BAR-ORB-SESSION-01 | `session-store` | 新建会话覆盖旧会话：create() 只在内存 unshift 不写盘 + patchActiveConfig fire-and-forget → 随后 load() 重拉列表不含新会话、读旧 active.json 覆盖 activeId → 新会话丢失/旧会话被串写 | I | ✅ 修复（create 立即写盘 + await active.json；load 保护有效内存 activeId 不被覆盖） | 集成时序，冒烟兜底 |
| BAR-ORB-SESSION-02 | `session-store` | 刷新吞记录：AI 回复仅在流全部结束才 saveMessages，多轮工具调用中途刷新/服务端 run 丢失 → 本轮记录未落盘丢失 | I | ✅ 修复（每轮 message_stop 增量落盘 onPersist；saveMessages 串行化防并发写交错） | 集成时序，冒烟兜底 |
| BAR-ORB-SESSION-03 | `orb.ts` | 切会话内容错乱：切换监听器 await load 后 getMessages().then 覆盖 chatMessages，与进行中流式追加打架 | I | ✅ 修复（切换前 abort 进行中 run + _switchToken 丢弃过期加载结果） | 集成时序，冒烟兜底 |

### 第六批：会话分段加载 + 视口裁剪滚动（性能优化善后）

| BAR | commit | 症状/契约 | 类别 | 状态 | 测试位置 |
|-----|--------|-----------|------|------|---------|
| BAR-ORB-PERF-01 | `session-store` | 会话卡加载慢/无内容：loadSessions N+1 逐文件全量读（单会话可达 600KB），3 会话串行传 ~900KB。改服务端 `/api/sessions/list` 单请求只返元数据（id/title/updatedAt/messageCount，剥离 messages），~200B/条 | I | ✅ 修复（元数据端点 + 客户端 messages 懒加载） | 冒烟兜底 |
| BAR-ORB-SEG-01 | `files.ts` | 会话消息分段切片：`/api/sessions/messages` 按 head/tail 切片，避免大会话全量传输。面板追底用 tail、卡片预览用 head。切片边界算错会漏/重/错序消息 | L | ✅ 已钉（剥离 sliceMessages 纯函数，含 head++tail 拼接不变量） | `tests/server-routes.test.ts` |
| BAR-ORB-SEG-02 | `orb.ts` | 切换会话切不过去：sessionStore.init() 监听器抢先改 activeId，orb 监听器 guard `sid===activeId` 误成立 → return → 内容永不重载 | I | ✅ 已钉（源码检查：guard 比较 _renderedSessionId、且不比较 sessionStore.activeId，revert 验证咬合） | `tests/client-logic.test.ts` |
| BAR-ORB-SEG-03 | `orb.ts` | 分段加载黑屏：第一段 12 条未触发裁剪，prepend 补齐后超阈值触发裁剪，preserve 模式用失配的 prevScrollTop 定位窗口 → 底部移出渲染窗口黑屏 | I | ✅ 修复（补齐段改用 follow 保持追底，不用 preserve）·**不钉**：依赖「切换=追底」产品决策，源码断言 `'follow'` 无区分度、逻辑隐晦，注释说明即可 | 集成时序，冒烟兜底 |
| BAR-ORB-SEG-04 | `orb-chat` | 上滑跨裁剪边界卡顿跳位：未测量消息按 DEFAULT_MSG_H=80 估算，进窗口后真实高度≠估算，padding 差值补偿突变 → scrollTop 突跳 | I | ✅ 已钉（源码检查：锚点三步 anchorMi+anchorOffset 捕捉 / anchorEl 查找 / preserve 分支内生效 + scrollAdjust 回退） | `tests/client-logic.test.ts` |
| BAR-ORB-CULL-01 | `orb-chat` | 第二轮流式一帧一帧卡：视口裁剪按 `messages.length` 触发，但一条 AI 消息可含几十个工具框（每个是重 DOM 单元）；第一轮 20 工具框只算 1-2 条消息 → 不裁剪 → 每帧全量重建全部工具框 | L | ✅ 已钉（01a-d，剥离 _cullWeight 纯函数=消息数+工具框数，revert 验证咬合） | `tests/client-logic.test.ts` |

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
| BAR-BUILD-01 | `build.mjs` | bundle 1.9MB 未压缩源码上线（minify 后 1.07MB，-44%）；版本号正则吞不掉旧 query 叠加成 `?v=A?v=forceB` 畸形 | L | ✅ 已钉（源码检查：两处 minify + index.html 无双重 query，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-02 | `server/index` | 无 gzip（1.9MB 直传）；`express.static` 挂载仓库根把 `.git`/`src`/`node_modules` 暴露 HTTP。契约：compression filter 排除 `/ai/`（SSE 不缓冲）+ 禁止重挂根目录 | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-10 | `chat-dom` | 摸鱼提示跑到用户消息上方：`setWait(true)` 在 doSend 前执行，hint 先挂载，`_createMsgContainer` 裸 `appendChild` 把消息插到 hint 之后。契约：非 prepend 分支必须 `insertBefore(msgEl, hint)`，hint 恒在尾部 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-BUILD-03 | `build.mjs` | **线上事故**：compression 未列入 server external，被打进 ESM bundle，其 CJS 依赖 `require("buffer")` → 启动即崩，systemd 重启风暴 76 次、全站 502，`kfm-restart` 后服务再也起不来。契约：server 构建 external 必须含全部 CJS 运行时依赖 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-11 | `chat-dom` | 思考框永不自动折叠：仅 tool_result 路径有折叠逻辑，纯文本回复摊到底。契约：首个 text_delta（思考结束）+ message_stop 兜底 + tool_result 三路径统一走 `_autoCollapseThinking`，尊重 `_foldState` 手动展开 | I | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |
| BAR-ORB-PANEL-12 | `chat-dom` | 流式期 textContent 裸奔 md 源码、block stop 时突变成渲染态。契约：`_scheduleStreamingMd` 120ms 节流轻管线（marked+高亮，跳过 KaTeX/mermaid）；final 渲染前 `_cancelStreamingMd` 防轻管线覆盖；部分渲染不进 `_mdCache`；clearChatDom 清计时器 | L | ✅ 已钉（源码检查，revert 验证） | `tests/client-logic.test.ts` |

> 新 bug 修复后：补一个回归钉子 → 在此登记 → 状态置「已钉」。见
> `docs/archive/design/REGRESSION_TESTING_SYSTEM.md` §3 微循环。
