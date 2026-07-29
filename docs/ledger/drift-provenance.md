> 这是什么：99 条漂移的全量成因普查（轨道 A）+ 8 案修法定向深潜（轨道 B）。
> 方法：22 subagent git 考古（blame/log -L/log -S/tag --contains），分类法 A-F/X 见下。
> 基准：测绘 0cecc62/3906707 · 考古 2026-07-29。

# 漂移溯源档案（drift-provenance）

## 成因分类法

- **A 时代合理但过时**：引入时是正当设计/修复，后续架构演进把它甩下，无人回头收编。
- **B 接力理解偏差**：后来者（含文档作者）误读或未知晓既有约定/机制，按错误理解继续建设。
- **C 权宜遗留**：引入时明知是临时手段（赶工、泄压、豁免），事后未拆除未收尾，固化成永久。
- **D 复制粘贴漂移**：同一份逻辑被拷贝成多份（常在同 commit 或相近时期），之后各自演化分叉。
- **E 机制没人走**：机制/接口/门面建成即零调用或很快被绕过，从未真正接线。
- **F 文档滞后**：代码正当演进，契约/注释/文档未同步（含迁移时原样搬运旧失真）。
- **X 无法确定**：证据不足（非跟踪文件、无 commit 记录），无法定引入成因。

## 成因分布统计

### 全量分布（普查总表共 105 行；99 条漂移，其中 ai-chat#3、client-shell#16、infra#14 各拆为 a/b/c 三行）

| 标签 | 含义 | 数量 | 占比 |
|---|---|---|---|
| E | 机制没人走 | 23 | 21.9% |
| A | 时代合理但过时 | 21 | 20.0% |
| C | 权宜遗留 | 18 | 17.1% |
| F | 文档滞后 | 17 | 16.2% |
| B | 接力理解偏差 | 15 | 14.3% |
| D | 复制粘贴漂移 | 10 | 9.5% |
| X | 无法确定 | 1 | 1.0% |
| 合计 | | 105 | 100% |

### 分域分布（行 × 标签）

| 域 | A | B | C | D | E | F | X | 行数 |
|---|---|---|---|---|---|---|---|---|
| ai-chat | 5 | 1 | 1 | 1 | 2 | 0 | 0 | 10 |
| canvas-tree | 2 | 2 | 3 | 1 | 3 | 3 | 0 | 14 |
| client-shell | 1 | 5 | 4 | 2 | 5 | 1 | 0 | 18 |
| floating-card | 2 | 4 | 2 | 4 | 4 | 6 | 0 | 22 |
| server | 5 | 0 | 2 | 1 | 3 | 2 | 0 | 13 |
| infra | 3 | 2 | 2 | 0 | 3 | 5 | 1 | 16 |
| cross-domain | 3 | 1 | 4 | 1 | 3 | 0 | 0 | 12 |
| 合计 | 21 | 15 | 18 | 10 | 23 | 17 | 1 | 105 |

**结论：E（机制没人走，23 行）与 A（时代合理但过时，21 行）两类占绝对主导，合计 44 行、41.9%** ——漂移的主因不是写错，而是「机制建成无人接线」与「正当设计被演进甩下」。

> 口径说明：本档案普查总表以 14 个普查 subagent（按域分工）的行为准。深潜 subagent agent-109 曾附带给出一份自算的 99 行全量表，其多行的引入 commit/标签与普查行不一致（如 ai-chat#1 标 A vs 普查 C、infra#1 标 D vs 普查 C），未采用；有实质分歧处在深潜八案对应节标注。

## 普查总表（轨道 A）

### ai-chat（8 条，拆 3a/3b/3c，共 10 行）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | 1e37909 | 2026-07-28 | v8.1.0 | feat: v8.1.0 工具 I/O 上下文压缩 — 压缩器注册表 | C | 收窄 saveMessages 仅新会话用，写链路刻意留作双轨 |
| 2 | 0ebea93 | 2026-07-26 | v8.0.0 | feat: 冷恢复自动 resume（kfm-restart 后 AI 自动 | D | 冷恢复内联重写 doSend 转换简化版，后各自演化 |
| 3a | dcb55f0 | 2026-07-15 | v7.2.0 | fix: orb 面板复用完整 markdown 管线（preprocess | A | 共享管线取代 renderMarkdownAsync，调用点当日消失 |
| 3b | 4601fdc | 2026-07-27 | v8.0.0 | refactor: 删除 v7 renderChatContent + 八个状态补丁 | A | 唯一调用 getToolHint(tc.id) 随 v7 渲染路径删除 |
| 3c | a2745f1 | 2026-07-26 | v8.0.0 | feat: 服务端 SessionStore（Phase 3 核心，待接入） | E | isIncomplete 标注"待接入"，判据被同日 0ebea93 客户端重写 |
| 4 | 03da8c9 | 2026-07-29 | （无tag） | docs: 代码测绘校准件——ai-chat code-map + 机械层 | A | 域划分系事后补登，orb.ts 持 ai-chat 状态是 v7 前域时代遗留 |
| 5 | 1e37909 | 2026-07-28 | v8.1.0 | feat: v8.1.0 工具 I/O 上下文压缩 — 压缩器注册表 | A | 五 key 跨 v7.2–v8.1 各自零散引入，登记制度此前不存在 |
| 6 | 9deaa16 | 2026-07-26 | v8.0.0 | feat: v8 渲染器接入（?renderer=v8 dev flag 双跑） | E | 树刷新已被 96d172d 指纹机制接管，onFilesChanged 钩子出生即空 TODO |
| 7 | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 | B | switchTo 出生即缺 await，作者未意识 active.json 写盘竞态 |
| 8 | 4dedefc | 2026-06-27 | v6.10.0 | feat: Phase 8.2 服务端 PTY 会话管理 | A | v6 单 WS 通道合理，PTY/tmux/AI 桥逐 Phase 堆叠成混杂 |

注：条目 3 是三处独立死代码，成因 commit 各不相同，拆 3a/3b/3c 三行；其中 3a/3b 按约定取「最后调用方消失的 commit」而非函数引入 commit。

### canvas-tree（14 条）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | f28999d | 2026-04-22 | baseline | refactor: 全面迁移至 TypeScript + Pretext 文本布局引擎 | A | kfmv2 移植版当日合理，次日 be893c6 引入 npm 包，生产全走 npm，port 成死代码 |
| 2 | 74d1b42 | 2026-04-25 | baseline | style: 视觉优化 — 字体缩小 + 递减缩进 + 统一配色 | E | 「统一配色」有意摘掉 getFileColor 接线改硬编码，机制弃用；theme.ts 后立约无人执行 |
| 3 | 9479e89 | 2026-07-24 | v7.3.3 | feat: 眼睛系统 + 裁剪权重 + 会话中文名 + 兄弟目录切换 | E | 唯一调用方 root-picker 被纯 DOM sibling-switcher 取代，pushContext 机制成孤儿 |
| 4 | 341d68f | 2026-06-26 | v6.9.1 | fix(scroll): 扇形65°+竖滚死区瞬跳修复 | F | 方向锁 6/26 三连 fix 正当演进（45°→扇形→12px→65°），契约停在 45° 未更新 |
| 5 | 94645b4 | 2026-05-02 | baseline | feat: 事件堆栈架构 + 字符雨动画 + 会话隔离 | F | 事件堆栈有意改为 markAnimatingPath→notify；3s 实为 baa4832 等锁放弃被契约误读 |
| 6 | 9479e89 | 2026-07-24 | v7.3.3 | feat: 眼睛系统 + 裁剪权重 + 会话中文名 + 兄弟目录切换 | B | 同 commit 代码导出 initSiblingSwitcher，文档却凭空写 create/destroy*，后迁入契约 |
| 7 | eed2baf | 2026-06-20 | v6.9.0 | feat(phase7): ③c — 重命名透明 input + rename API | C | phase7 三天 15+ 赶工 fix，删除/新建均补 loadFileTree，rename submit 出生即漏刷新 |
| 8 | cafcb58 | 2026-06-17 | v6.8.0 | feat: ✓ 按钮联动模式 — copy/move/delete API + 卡 | C | delete 分支引入时即未查 success（copy/move 均查），756cc55 又有意让动画与 API 并行 |
| 9 | 67a9208 | 2026-05-31 | v6.0.0 | P3 feat: RenderContext 原子化上下文切换 | E | 混合源：5/9 符号自引入即零调用，余为调用方被清理/回退后残留定义 |
| 10 | 207e73b | 2026-05-30 | v6.0.0 | docs: CLAUDE.md + HANDOFF_AUDIT.md 同步至 v5.0 | F | tree-model.ts 全史无任何 KFMState 写操作，陷阱文写入时即已失真 |
| 11 | 9b46dd9 | 2026-06-11 | v6.7.0 | refactor: tree-render 拆分 (tree-overlay + tree | A | 拆分按手势入口命名，后续 copy/move/delete/prompt 陆续并入致名实不符 |
| 12 | 6628b34 | 2026-05-03 | v4.0.1 | feat: GSAP 平滑光标动画 — 移除 killTweensOf + p | D | 同 commit 写入 touch/fling 两份近似罚步进，wheel 再添一份 |
| 13 | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 + | B | promptSelectSingle 诞生即绕过 setSelectedFile，与 onFileClick 正常路径脱节 |
| 14 | 8769f2b | 2026-05-28 | v5.0.0 | feat: 02卡接入日志面板 + 清除全部 debugLog 调用 | C | 机械清除 debugLog 留 10 行空 `;`；乱码系编码受损逐 commit 累积 |

注：条目 9、12、14 为复合条目，hash 取代表性 commit（分别为「机制没人走」典型 67a9208、「罚步进复制形成点」6628b34、「`;` 残留引入点」8769f2b）；条目 9 的 9 个符号与条目 12/14 的子案例完整 commit 清单见深潜叙事与考古记录。

### client-shell（16 条，拆 16a/16b/16c，共 18 行）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | 97394bd | 2026-07-28 | v8.2.0 | feat(newdoc): HANDBOOK 迁移填充（1/19）— 5 域 co | B | 契约链出生即错：initCardStack自55f0b43起就在loadFileTree前同步跑 |
| 2 | 97394bd | 2026-07-28 | v8.2.0 | feat(newdoc): HANDBOOK 迁移填充（1/19）— 5 域 co | B | picker-lock全史仅现于文档（源流CARD_DEV_GUIDE c7b8ccb），代码从未有过 |
| 3 | 678c6d2 | 2026-07-15 | v7.2.0 | release: v7.1.0 — orb/floating-card 拆分 + ser | E | nextOrbState出生即零调用，orb.ts仅re-export，状态机从未接线 |
| 4 | 7e23ee1e | 2026-05-09 | v4.0.1 | refactor: 动画系统重构 step1 — char-rain 合入 t | F | 故意合入ts主时间线（commit明言），旧契约描述后被原样搬进新contract |
| 5 | 240dbcf | 2026-06-09 | v6.7.0 | feat: Box Location Map + dead code cleanup (v6 | C | 死码清理删了play/reverse/killAll方法体，留头注释与_entries空壳 |
| 6 | 98a4c28a | 2026-07-28 | v8.2.0 | feat(newdoc): DIAGNOSTICS 迁移填充（2/19）— 契 | B | setExpanded自90138f0起内部从无守卫，守卫一直在调用侧，文档写错位置 |
| 7 | 54b18cf | 2026-07-26 | v8.0.0 | feat: chat-dom.ts 增量 DOM 投影模块（Phase 2 | B | 新模块作者自绑touchstart/move，未走已有GestureRegistry（契约禁直绑） |
| 8 | 678c6d2 | 2026-07-15 | v7.2.0 | release: v7.1.0 — orb/floating-card 拆分 + ser | C | 「拆分」只搬出渲染层，handleSend/chatMessages编排留在orb.ts成为永久 |
| 9 | 25a295e | 2026-06-02 | v6.1.0 | v6.1.0: UI Registry 全面接入 + 三层 MANIFEST 验证 | D | 同一commit刚改showToast却在ws-channel内联拷贝（3000ms/无消失notify）；showToast原生调用方在bf73996（05-04日志面板移除）已删光，ea35f1a又删window.showToast赋值 |
| 10 | ea35f1a | 2026-06-02 | v6.0.0 | v6.0.0: 独立代码审计清理 | A | declare块在f28999d(TS迁移）时与真实window赋值一一对应；本commit删光15处赋值却留声明，次日462fe49只清掉5个声明、剩7个至今 |
| 11 | 102d749 | 2026-06-09 | v6.7.0 | feat: extend KFMState for card workbench (WORKBENCH_SPE | E | commit message自述"no UI/gesture changes"；cart*/openCards/focusCard/setViewport九方法出生即零调用，git log -S全仓仅此一个commit触碰 |
| 12 | 4a287df | 2026-05-05 | baseline | refactor: 三个注册中心 + 项目文档 + 全局变量收拢 | E | 注册中心批量预留API从未接线：registerListener/removeAllListeners(4a287df)、gestures.disable/enable/destroy(03fb1b2)、clearScope(bdca4c1）均生产零调用；例外pushContext/popContext与warn曾用、调用方分别死于9479e89/f83fa94（子项属A） |
| 13 | 4a287df | 2026-05-05 | baseline | refactor: 三个注册中心 + 项目文档 + 全局变量收拢 | B | 「唯一入口」头注诞生时card-stack/demo-leafer已在直查；后续79669a0（双指缩放）、7c2f421（终端辅助栏）、678c6d2(orb-panel拆分）各自继续绕过，无人知道/遵守约定 |
| 14 | 9e63f88 | 2026-06-11 | v6.7.0 | refactor: 拖动逻辑去重 (drag-handler.ts) | E | 提取时把minEditW/H设计成DragConfig必填字段、两调用方都传值，但钳制逻辑留在各自onMove回调里，createDragHandler从不读——字段出生即死 |
| 15 | 4e59339 | 2026-05-08 | baseline | feat: 运行时断言层 + _stateSub/rebuildTree 守卫加固 | C | message明说"线上设DEBUG=false即可零开销关闭"——靠手动切换的部署步骤从未有人执行，DEBUG=true+debugger语句随生产包发布至今 |
| 16a | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 + 手势修复 | C | gesture-registry.ts:237-238空if块（card-stack-global）在"手势修复"中诞生即空，疑似调试占位/删体忘删壳的权宜残留 |
| 16b | dc9843e | 2026-04-23 | baseline | feat: smooth position animation for input b | D | 为键盘弹出动画新增getPanelTargetPosition时拷贝了updatePanelPosition的尺寸钳制逻辑，此后两份各自演化（:234-235 availRight/availBottom算了不用） |
| 16c | da98111 | 2026-06-18 | v6.9.0 | feat: Phase 7 长按抽屉栏 + rename API + GestureRegistry 长按支持 | E | 注册表新增longPressMs机制时未迁移既有自计时（orb长按600ms经9e63f88提取进drag-handler），机制存在但被旧实现绕过 |

注：条目 16 原文把三个次要项捆在一条，三者引入 commit 与成因各不相同（C/D/E），按「每条仅一个主标签」原则拆为 16a/16b/16c。条目 9 是复合条目（showToast 之死属 A、双份实现属 D），主标签取 D——25a295e 同一 commit 刚给 showToast 加过 notify，作者知情仍拷贝分叉，排除 B。条目 12 主标签 E，其中 pushContext/popContext（调用方死于 9479e89）与 debug-assert.warn（调用方死于 f83fa94）两个子项若单列应标 A。

### floating-card（22 条）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | 84419a1 | 2026-06-13 | v6.7.0 | refactor(floating-card): Phase 2-3 — 模板提取 + launchFoc | F | launchFocusedCard迁至card-stack后契约出口清单未改 |
| 2 | 811cda8 | 2026-06-23 | v6.9.1 | feat(card): 卡片尺寸升级 — 紧缩态 155×68（旧展开态），展 | F | 尺寸正当升级改了HANDBOOK但契约状态机行没跟上 |
| 3 | 2db143f | 2026-05-24 | v4.2.0 | feat: 浮卡紧凑态 + 点击展开动画 | B | 代码当日"修正"为左color1，次日契约从历史提炼出相反规则 |
| 4 | 9de2a8c | 2026-07-08 | v6.11.1 | feat: 卡片插件系统 — src/client/cards/ 目录 + 4 个插件文 | F | 插件系统静态import terminal-card-04，"导入数0是特性"过期 |
| 5 | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 + 手势修复 | B | 重构刻意删掉exit的后代touchAction恢复，不知enter侧仍写 |
| 6 | 2d58f3f | 2026-07-05 | v6.11.0 | feat: 全屏卡片功能 — 标题栏统一化 + topMidOrb + 全屏态 + | E | 硬规则2(6-11订立)后首个新违规：全屏按钮直接addEventListener |
| 7 | 0124c4b | 2026-07-15 | v7.2.0 | feat: 终端长按选择 + 构建管线加固（build.mjs 修复 + chec | F | 长按选择整套是正当新功能，契约从未补记 |
| 8 | 5c675e9 | 2026-07-01 | v6.10.0 | feat: 键盘避让 — 卡片引擎内置能力（getMaxY读vvH, needsK | F | 引擎级避让正当落地，4天后全屏侧又加一套，契约均未提 |
| 9 | 05a886a | 2026-06-02 | v6.1.1 | fix: UI Element Registry 文档-代码对照审计修复 | F | 4条AI指令+内容生成器随Registry审计正当落地，契约从未补登 |
| 10 | 9de2a8c | 2026-07-08 | v6.11.1 | feat: 卡片插件系统 — src/client/cards/ 目录 + 4 个插 | E | types.ts门面出生即无人import，同commit插件全直import card-registry |
| 11 | 678c6d2 | 2026-07-15 | v7.2.0 | release: v7.1.0 — orb/floating-card 拆分 + server | E | 拆分时新写纯状态机只供测试调用，生产转换从未接线（内联赋值） |
| 12 | 7c4ecdc | 2026-06-04 | v6.4.0 | refactor: card-stack.ts 拆分为面板 + 浮卡两个文件 | E | 拆分链遗留"备用导出面"无人消费；dismiss外部调用死于2e52a9b |
| 13 | 7c4ecdc | 2026-06-04 | v6.4.0 | refactor: card-stack.ts 拆分为面板 + 浮卡两个文件 | D | 拆文件两半各留一份hexToRgba，之后两张卡再各抄一份凑成四份 |
| 14 | 0b12122 | 2026-06-23 | v6.9.1 | feat(renderer): Phase 4B 预览/编辑双模式 — marke | D | handler-factory照抄debug卡头骨架；buildCardLayout统一后未回迁 |
| 15 | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 + 手 | D | 三张管理卡照抄api卡API_BASE/readFile/writeFile，tools卡再抄 |
| 16 | bdafdc1 | 2026-07-06 | v6.11.0 | feat: 所有卡片支持双指缩放字号 | D | "所有卡片支持"以逐卡复制方式铺开，后续新卡（api/tools/orb）各自再抄 |
| 17 | b2f74bc | 2026-07-21 | v7.3.0 | fix(ws/tmux): WS 断线后终端卡自动重新打开 PTY | B | 重连钩加进共享 initTerminalCore 又给 tmux 单开一路，两路都发 terminal-open |
| 18 | 84419a1 | 2026-06-13 | v6.7.0 | refactor(floating-card): Phase 2-3 — 模板提取 | A | 发射时 DOM 压栈是视觉刚需，item.zIndex 另轨记录彼时无害，后无人归并 |
| 19 | 5ee0321 | 2026-07-10 | v7.2.0 | fix: API 卡字号改 --card-font-size + 终端方向 | B | 插件卡自建 kfm-fontsize-api 读取，不知 gestures.ts 钳制表需同步加 typeId |
| 20 | 0b12122 | 2026-06-23 | v6.9.1 | feat(renderer): Phase 4B 预览/编辑双模式 | C | Phase 赶工特性，catch /* swallow */ 为保静默保存明知吞错，留成永久 |
| 21 | f5ee84c | 2026-07-26 | v7.3.3 | fix: 暴露 __L/__anim/__cardRegistry 到 window | C | 为让 AI debug 视图脚本找到 registry 权宜挂 window，escape-ok 自认破例 |
| 22 | 056657e | 2026-06-29 | v6.10.0 | refactor: 删自研终端，card03 由 xterm.js 接管 | A | 207a9cd 命名时确为 04 号卡；此 commit 改注册 card03 复用旧名未改 |

注：条目 3 的契约历史依据引用 68f0b32/1e256f1/e652a43 三个 commit，三者均已不在当前历史（疑被 rebase/压缩丢失），无法直接核对原始意图；可确定的是 2db143f 的 message 明写「左 color1/右 color2」，而 dc238a6 次日提炼契约时写反。条目 6 中 floating-card.ts TL/TR/BL 与 card-stack.ts:178 的 click 监听早于规则，属祖父代码；取规则后首个违规 commit 为代表。条目 8 两套机制为同作者 4 天内叠加（引擎级 5c675e9 / 全屏级 2d58f3f），条目归「契约没提」类定 F。

### server（13 条）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | a2745f1 | 2026-07-26 | v8.0.0 | feat: 服务端 SessionStore（Phase 3 核心，待接入） | D | message 自证「与旧 saveSessionFile 口径一致」，另起炉灶未动 files.ts 旧拷贝 |
| 2 | a2745f1 | 2026-07-26 | v8.0.0 | feat: 服务端 SessionStore（Phase 3 核心，待接入） | E | 自述「待接入」；register/getSession 公开即无外部调用方（4dedefc/25a295e 同型） |
| 3 | 25a295e | 2026-06-02 | v6.1.0 | v6.1.0: UI Registry 全面接入 + 三层 MANIFEST 验证 | E | ui/snapshot 等端点全史无 HTTP 调用方，AI 工具改直连 wsServer，HTTP façade 从未接线 |
| 4 | 4dedefc | 2026-06-27 | v6.10.0 | feat: Phase 8.2 服务端 PTY 会话管理 | A | PTY 首次并入 WS 层（当时合理），后 tmux(8c2e4e3)/eval(82cfbca) 相继堆积成四合一 |
| 5 | 61ac02a | 2026-07-26 | v7.3.3 | fix: 端口 8021→8022 避开阿里云安全 Agent 误杀 | F | 端口修复 commit 夹带 57 行探针进 index.ts，未更新「只做装配」头注释（678c6d2 写时属实） |
| 6 | 426425c | 2026-07-24 | v7.3.3 | fix: 兄弟目录切系统根+skipSanitize+roots端点 | F | 例外是 sibling-switcher 正当设计（46df845 已正规化），陷阱 1 绝对化措辞未随代码更新 |
| 7 | 8b1dc57 | 2026-07-26 | v7.3.3 | feat: /api/system/restart 安全重启端点（先响应后spawn detached子进程） | E | verifyLocalOrigin 只在 files.ts 逐路由 opt-in，restart/ai-tools/ai-chat 从未接入该机制 |
| 8 | 4dedefc | 2026-06-27 | v6.10.0 | feat: Phase 8.2 服务端 PTY 会话管理 | A | 单用户本地工具假设下无需鉴权；terminalSessions 集合仅为断线清理追踪，从未接校验 |
| 9 | 4e6f6df | 2026-07-25 | v7.3.3 | fix: 审计修复 — 删除死工具、cwd 硬编码、eval 广播… | C | 修「广播致多标签重复执行」时权宜改发第一个客户端，落点不确定性留为永久 |
| 10 | bfbd2ad | 2026-07-24 | v7.3.2 | feat(orb): v7.3.2 会话加载分段传输 + 竞态修复 | A | 会话即 JSON 文件读写，就近挂 files 路由当时合理；路由契约细化后成越界 |
| 11 | 25a295e | 2026-06-02 | v6.1.0 | v6.1.0: UI Registry 全面接入 + 三层 MANIFEST 验证 | A | 客户端元数据+服务端处理器+WS 优先兜底系同 commit 有意设计，演进后成双源重复 |
| 12 | fbcc0c7 | 2026-07-10 | v7.2.0 | fix: AI API 请求走服务端代理（绕过 CORS） | C | 赶工绕 CORS，按唯一调用方（恒传 method）形状实现，GET+body 隐患潜伏至今 |
| 13 | f28999d | 2026-04-22 | baseline | refactor: 全面迁移至 TypeScript + Pretext 引擎… | A | 双挂载支持 /kfmv4/ 子路径部署（state.ts:6 仍硬编码使用）；ping 残留系 e477264 有意兼容保留 |

注：条目 3 的「外部 agent 是否调用」仓库内不可证（缺运行时访问日志），成因按「仓内从未接线」判 E，若外部确有调用方应改判 A（详见深潜八）。条目 13 四个子项成因不一（双挂载 A、ping 残留 C、死条件 D 倾向），按格式要求取首个子项双挂载定行，余见该域深潜叙事。

### infra（14 条，拆 14a/14b/14c，共 16 行）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | 0124c4b | 2026-07-15 | v7.2.0 | feat: 终端长按选择 + 构建管线加固（build.mjs 修复 + | C | message称"阻断"，同commit的build.mjs内嵌拷贝却try/catch降级——引入时即知权宜 |
| 2 | 8ce26fd | 2026-07-29 | —（未入tag） | feat(v8.3.0): agent-runner 落地——骨架（兜底链/校 | F | release-radar头注释明写"warning模式exit 0"是正当设计；同commit改了契约却没登记例外 |
| 3 | 8ce26fd | 2026-07-29 | —（未入tag） | feat(v8.3.0): agent-runner 落地——骨架（兜底链/校 | E | 引入时头注释即声明exit 1语义，代码从来只有exit 0/2——契约从未接线 |
| 4 | 720c223 | 2026-07-29 | —（未入tag） | feat(v8.3.0): tag-advisor 二轮调参——回放 47% 基线 | F | 该commit把floor从feat→minor改为total>0→patch（家规调参，正当），头注释未同步 |
| 5 | 8ce26fd | 2026-07-29 | —（未入tag） | feat(v8.3.0): agent-runner 落地——骨架（兜底链/校 | E | git log -S 'renderTemplate(' 全史仅引入一次，从未有调用方——设计支柱从未接线 |
| 6 | 03da8c9 | 2026-07-29 | —（未入tag） | docs: 代码测绘校准件——ai-chat code-map + 机械层 | B | 引入domain-src.mjs时infra条目即缺契约清单早已声称的4项；盲区检查只扫src/报不出 |
| 7 | 9c8e880 | 2026-07-06 | v6.11.0 | docs: 补充隐式契约 — 语言规范 + touch-action 非 | B | 写下"base.scss→base.css"时sidebar.scss已双编译一个月（v5.0.0起）；作者不知sass整目录编译 |
| 8 | 539650b | 2026-07-28 | v8.1.0 | feat(check): 新增 3 个管线检查 — 描述新鲜度/测试模式完整性 | F | 注释写入时正确（当时计数确在 consistency）；次日 5149771 重写移走计数，注释未跟 |
| 9 | 36866eb | 2026-07-21 | v7.3.1 | test(smoke): 步骤7 — 浏览器冒烟层（11 条，~9s） | F | 287 是引入时真实计数（commit message 自证）；测试增至 456，sync-counts TARGETS 不覆盖 smoke.mjs |
| 10 | 7d1c0d3 | 2026-07-18 | v7.2.0 | fix: build.mjs 自动更新 bundle.js 版本号，防止浏览器缓存旧 bundle | A | 缓存破坏是正当修复，但 ?v= 时间戳使每次构建必脏 tracked index.html，后与 check-uncommitted 形成张力 |
| 11 | 03da8c9 | 2026-07-29 | 无（未发布） | docs: 代码测绘校准件——ai-chat code-map + 机械层清单生成器 | E | 生成器随测绘当日落地，挂管线留作显式待办，机制存在但从未接线 |
| 12 | 8ce26fd | 2026-07-29 | 无（未发布） | feat(v8.3.0): agent-runner 落地——骨架（兜底链/校验重试） | F | commit message 自证「kimi 系仅允许 temperature=1」，值属故意修复；仅缺行内注释说明原因 |
| 13 | 4acb8a9 | 2026-05-29 | v5.0.0 | fix: 构建/启动添加进程清理 + B.A.R. #005 端口冲突记录 | A | 杀端口启动当时合理（无 restart 机制）；7-26 安全重启端点落地后 npm start 未迁移，文档未对齐 |
| 14a | 9e3e6d4 | 2026-07-21 | v7.3.1 | test(infra): 步骤0 — 测试运行器升级（隔离/分类标签/回归钉子） | A | 核心迁 harness.ts 时保留 runner.ts 再导出兼容旧 import，合理过渡设计遗留成双门面 |
| 14b | -（非跟踪文件） | mtime 2026-07-25 | - | -（git 无史） | X | base.css.map 未被跟踪，git 无法定引入；.gitignore 自 v5.0.0 排除 *.css.map，缺「何时何命令生成」证据 |
| 14c | 96e19fe | 2026-06-09 | v6.7.0 | fix: build.mjs sass path — execSync missing node_modules/.bin | C | 只修 build.mjs 爆点改 npx sass；package.json 裸 sass 在 npm 语境本可用，最小修复留下写法分叉 |

注：8ce26fd / 720c223 / 03da8c9 均不被任何 tag 包含（`git tag --contains` 为空）——是 v8.3.0 tag 之后的未发版提交，标题里的「v8.3.0」是批次命名非 tag。漂移 12 的【存疑】已被 commit message 直接证伪为「故意且正确」，实际只需补注释。14b 是全表唯一 X。

### cross-domain（12 条）

| 条目 | 引入commit | 日期 | 首个tag | commit标题 | 标签 | 依据 |
|---|---|---|---|---|---|---|
| 1 | a2745f1 | 2026-07-26 | v8.0.0 | feat: 服务端 SessionStore（Phase 3 核心，待接入） | C | 唯一写者设计标注"待接入"，pre-run 双写刻意保留后无人收尾 |
| 2 | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 + 手势修复 | A | 三写者同commit诞生，读合并写当时够用，无锁风险随体量显现 |
| 3 | 116b0c6 | 2026-07-10 | v7.2.0 | feat: orb 聊天面板接入 API（读 providers.json + 适配 nginx 前缀） | D | ef04bee 单点修复 nginx 前缀，本commit首次拷贝，后散至8处 |
| 4 | bdca4c1 | 2026-05-06 | baseline | refactor: 动画治理 — 全部 GSAP 调用迁移至 AnimationRegistry | E | scope 机制存在，但 killTweensOf 直透+check 只查 import，被三域绕过 |
| 5 | 7e23ee1 | 2026-05-09 | baseline | refactor: 动画系统重构 step1 — char-rain 合入 ts 主时间线 | C | 为反转动画"改 state 不 notify"直写字段，权宜手段固化成范式 |
| 6 | 056657e | 2026-06-29 | v6.10.0 | refactor: 删自研终端，card03 由 xterm.js 接管 | E | 唯一 error 监听随 terminal-card.ts 删除消失，服务端仍发无人补位 |
| 7 | 8b1dc57 | 2026-07-26 | v7.3.3 | feat: /api/system/restart 安全重启端点（先响应后spawn de | B | 双挂载约定自 f28999d(04-22)已存在，commit只挂/api且message未提前缀 |
| 8 | 1e37909 | 2026-07-28 | v8.1.0 | feat: v8.1.0 工具 I/O 上下文压缩 — 压缩器注册表 + doSend | C | message明写「kfm-no-compact=1逃生门」，灰度期手动门，灰度结束未拆未登记 |
| 9 | 7cee557 | 2026-04-21 | baseline | init: kfmv4 基于kfm复制，API已配置为本地服务器 | A | 首个key(expandedPaths)随init继承自kfm，单key无需登记；key增至10+后制度仍缺席 |
| 10 | 90d4b76 | 2026-07-14 | v7.2.0 | feat: 卡片系统重构 — 统一视觉规范 + 会话管理 + 手势修复 | A | KFMState本是公认全局单例；域边界v8测绘才立，彼时直读不算越界 |
| 11 | 102d749 | 2026-06-09 | v6.7.0 | feat: extend KFMState for card workbench (WORKBENCH_SPEC §8) | E | 按WORKBENCH_SPEC§8预建9方法+notify全接线，workbench UI从未实现，仓内零调用 |
| 12 | b77fe21 | 2026-07-02 | v6.10.1 | fix: card04 — PTY 直接 spawn tmux attach (无回显) + 键盘避让 | C | 修「无回显」的fix直通裸协议terminal-open重开PTY，绕过card03封装，成第二写者 |

注：条目 9 是「制度缺席」类，没有真正的引入 commit，填仓 init commit 7cee557（最早 localStorage key 出现点）作锚。条目 12 的第一写者 terminal-card-04.ts 在 82e808e（Phase 8 步骤 6）引入 terminal-open；b77fe21 让 tmux-card 自成第二写者，后续 b2f74bc 又加固了这条旁路。

## 深潜八案（轨道 B）

### 一、text-layout 死亡（canvas-tree#1；深潜 agent-102）

因果叙事：

- 当时意图：f28999d（2026-04-22）TS 全面迁移时把 Pretext 从 kfmv2 整体 port 进 `src/client/engine/text-layout/`（逐文件复制 @chenglou/pretext 源码，文件头注明 MIT port）。当时 package.json 尚无该 npm 依赖，port 是获得排版引擎的唯一途径，orb.ts 聊天气泡以 `measureText/layoutLines` 使用它。引入行为本身合理。
- 转折点（次日）：be893c6（2026-04-23）LeaferJS 重构把 `@chenglou/pretext@^0.0.6` 加入 dependencies。同一作者前一天刚 port 完，不可能不知道 port 存在——是有意选择：新 canvas 引擎代码全部直接 import npm 包，旧 orb.ts 维持不动。双份实现由此并存，npm 那份持续演进，port 冻结落后。
- 6 月浮卡统一化反复（e7b3079 删 orb.ts → 1a9a3ec 回退 → 10f7077 新写 orb-card.ts 仍 import port → 5a354e7 恢复 orb.ts）期间 port 还被新代码继续使用，说明当时它仍被当作可用引擎。
- 真正死亡：678c6d2（v7.1.0，2026-07-15）orb 拆分，聊天渲染改走 marked/MD 管线，删掉最后一行生产引用。commit message 未提及 text-layout，属顺手死亡的附带伤害。
- tests 为何还在测：21dd4d6（2026-07-08）把 regression.test.ts 机械拆分，text-layout 用例独立为 tests/text-layout.test.ts——比生产死亡早一周。此后 43e376e、8679cb3 两轮「清死代码」因 tests 引用挡住了零引用检测而未扫到它。

**修法结论：删除整目录 + tests/text-layout.test.ts——port 是 npm @chenglou/pretext 的冻结旧副本，生产 4 处全部使用 npm 包且 API 覆盖 port 全部能力，重新接线等于退化到旧版引擎，无任何保留价值。**

### 二、sessions 双写者（cross-domain#1 / ai-chat#1；深潜 agent-103）

因果叙事：

- v7 时代（90d4b76，2026-07-14）客户端就是唯一写者：session-client.ts 与 session.card.ts 同 commit 诞生，经 /files/write 落盘 sessions/*.json，当时合理（服务端无会话持久化概念）。
- 转折点在 v8 Phase 3 同一晚四连 commit（2026-07-26 23:12–23:27）：a2745f1 建 SessionStore（message 明写「待接入」）→ 4d8195f run-manager 接入，服务端首次成为写者 → c1ae461/888118f 拆除 chat.ts/routes.ts 旧写 → 856a853 删客户端 post-run 双写。
- 但 856a853 的 message 自己写明：「保留 pre-run saveMessages（负责创建会话 + 生成标题 + 设 activeId）」——引入者明知双轨，把 pre-run 写归为「会话管理语义」豁免拆除；session.card.ts:91 的 saveSession（改名保存，34993ae 引入）则完全未被 v8 改造触及。
- 为何没人修：856a853 只承诺了 post-run 部分，pre-run 与卡片写被一句语义划分合法化；orb-chat-run.ts:321 的注释只记录了「不再双写」的叙事，读者据此以为残留是设计。appendUserMessage 的幂等检查还是为迁就 pre-run 写而加的补丁，进一步固化残留。
- 代价已显形：pre-run saveMessages（session-client.ts:456）与会话卡 saveSession 都全量重写含 messages 的文件，可覆盖服务端增量落盘——cross-domain.md 标 ⚠⚠ 最危险正是此因。

**修法结论：收编服务端 SessionStore 为唯一内容写者——拆掉 session-client.ts:456 pre-run 全量写（创建/标题/activeId 改走纯 meta 写或服务端端点）与 session.card.ts:91 saveSession 的 messages 字段（改名保存只写 meta），session-client.ts:134 create() 落盘同理降为 meta-only。**

（与普查口径一致：ai-chat#1 修法「新会话创建迁服务端，删除客户端 _doSaveMessages 全链路」、cross-domain#1 修法「pre-run save 改为调服务端创建会话端点」，三方同向，无矛盾。）

### 三、getFileColor 未接线（canvas-tree#2；深潜 agent-104）

因果叙事：

- 2026-04-25 07:32，3845e86（phase9-11 建模层）在 tree-model.ts 内写了本地 `getFileColor` + 内联扩展名色表，并在文件/文件夹标签两处真实调用——当时是接了线的。
- 同日 08:01，6619006「样式注册表 + 热更新」把它搬进 style-registry.ts 作为注册表基础设施，仍有两处调用。意图是做可视化配色系统，不是「先写机制后接线」的预留。
- 转折点：同日 19:56，74d1b42「统一配色」做设计转向——文件树文字统一为微紫白 `#e8e0f0`，两处 `getFileColor(item.name)` 调用被直接替换为统一色。扩展名着色是被主动设计决策弃用的，函数体、色表和 import 却原样留下。
- 05-12 94d9f49 主题系统重构把 extColors 搬进 theme.ts 并把 getFileColor 改读 `theme.extColors`——一次忠实的死机制迁移，但没有任何主题让文件标签按扩展名变色。
- 06-09 240dbcf（v6.6.1 死码清理）和 0061bb5（v6.8.1 代码质量审计）两轮清理都没删它——因为 tree-model.ts:7 那条 dangling import 让它看起来仍被引用。

**修法结论：删除（getFileColor + theme.extColors + tree-model.ts:7 的死 import）——「统一配色」设计决策自 2026-04-25 起横跨 v4→v8.3 共 15 个月从未被任何 commit 或主题试图恢复，接线等于复活一个被明确否决的旧设计。**

⚠ 标签分歧（保留并标注）：深潜主标签取 E（机制存在但被弃用），同时自注「次优候选 A 亦成立——若分类口径把『同日设计 pivot』归为时代演进而非弃用，可改标 A，证据链不变」。普查行（canvas-tree#2）取 E。

### 四、check 链双份（infra#1；深潜 agent-105）

因果叙事：

- 最初单一来源：package.json 有 `"check"` 链，`build` = 整条链 + `node build.mjs`，build.mjs 内只内嵌 2 个构建前必检项。53dcf21（v6.11.0）建立 check-checks 对账：用 `includes` 查 check-*.mjs 是否出现在 package.json check/build 字符串里——当时链短、两处同步，存在性校验足够。
- 转折点 678c6d2（2026-07-15，v7.1.0 release）：「构建管线加固」把 build 改为 `node build.mjs`，整条链手写拷贝进 build.mjs，并写下「对齐 npm run check，零错误通过才构建」注释——「对齐」无任何机制保证，纯靠人肉。
- 同日晚 0124c4b 新增 check-uncommitted：pkg 链放首位且阻断，build.mjs 里却放第二位并包 `try{}catch{}` + 「未提交提醒（不阻断）」。降级是有意的：build 本身会弄脏工作区（sass 回写 css、index.html 版本号回写，即 infra#10），阻断会误伤——但没人回头修 :36 的注释。
- 此后 10+ 个 commit 各加一个 check，每处都要双写；check-checks 的 includes 匹配对顺序漂移和语义漂移结构性失明。386437c（v8.2 批 0）归拢 scripts/check/ 时两处同步改路径，漂移原样保留至今。

**修法结论：单源化为「build.mjs 调 `npm run check` + 在 check 链内用 flag/环境变量控制 check-uncommitted 的阻断级别」——0124c4b 证明两份拷贝在引入当天就已语义分叉，check-checks 的 includes 对账（53dcf21→386437c 历经 3 次重写）从未守住语义，「双写 + 存在性对账」路线已被证伪。**

### 五、orb.ts 宿主化（ai-chat#4 + client-shell#8 同案两域立案；深潜 agent-106）

因果叙事：

- 起源（v4–v6）：f28999d（2026-04-22）起 orb 面板自带 `chatMessages` mock 与 `renderChatContent`，chat 只是面板演示内容，此时 orb.ts 是纯 client-shell 骨架。
- 接电（2026-07-10 e93c940）：面板接入真实 API，发送/流式/渲染全堆进 orb.ts，「文件即功能」。
- 结构形成点（2026-07-15 678c6d2，v7.1.0）：第一次拆分把纯聊天逻辑抽去 orb-chat.ts，orb.ts 保留 DOM/手势 + `handleSend` + `chatMessages` 状态所有权。「DOM 所有者兼做编排」是当时合理分工——漂移的结构在此定型，但定型时并非错误。
- v8 迁入叠加（2026-07-26 0ebea93）：新特性「冷恢复」沿用旧惯例直接写进 orb.ts（后来的 tryAutoResume），并复制了一份格式转换（衍生 ai-chat#2）。结论：主体是 v7 遗产，tryAutoResume 一段是 v8 新增迁入。
- 有人拆过，但有意停在门外（2026-07-27 19a5ee0，v8.1.0）：orb-chat.ts 被拆成 run/hints/门面三文件，diff 明确不碰 orb.ts；同日 95bad64 把冷恢复 IIFE 抽成命名函数，也仍留在 orb.ts 内。
- 为何没人修：`chatMessages` 被 doSend/resumeRun 以引用原地写、被 6 处读；handleSend/重连/冷恢复直接操作 orb.ts 私有 DOM，拆出需全面倒置状态与回调，高风险零功能收益。

**修法结论（深潜）：维持现状、登记为特例（建议 domain-src.mjs 把 orb.ts 改登 client-shell+ai-chat 双域）；若真拆，边界在「会话状态与 run 生命周期」——chatMessages/abortCtrl/loadSessionInto/tryAutoResume/handleSend 约 350 行独立为 orb-chat-host.ts、DOM 回调注入。**

⚠ 修法分歧（保留并标注）：普查 agent-88（ai-chat#4）主张「将 chatMessages/abortCtrl/按钮态下沉 ai-chat 域模块，orb.ts 改持引用」；普查 agent-91（client-shell#8）主张「承认现状改记为 ai-chat 客户端宿主，或按边界方案迁入 orb-chat/session-client（大改，需专项）」。深潜（agent-106）倾向维持现状登记，证据是 678c6d2 与 19a5ee0 两次拆分都主动选择不碰 orb.ts 边界。三方的「边界在哪」判断一致，分歧只在「拆还是登」。

### 六、anim scope 虚设（cross-domain#4；深潜 agent-107）

因果叙事：

1. 2026-05-06 a4318e0 建 AnimationRegistry，初版只有 play/reverse/kill/killAll 命名动画互斥台账，无 scope 概念。
2. 同日 bdca4c1「动画治理」把全仓 GSAP 收进 registry，一口气新增 to/fromTo/set/timeline/killTweensOf/scope 七个方法，message 明写均为「直接透传 GSAP」；scope 的唯一动因是替掉 tree-render 的 `gsap.globalTimeline.clear()`。
3. 头注释契约「模块级 scope——隔离各模块动画」与第一处绕过（tree-render 的 `anim.killTweensOf`）写在同一个 commit——机制出生即未接线，不是后来被遗弃。两小时后 6eb2708 把 card-stack 迁到 `anim.killTweensOf()`，message 将其作为正当用法陈述——直透是官方路径。
4. 真正被构建期强制的契约是 check-anim.mjs 的「禁止直接 import gsap」白名单，它只查 import 层，从不检查补间是否入 `_scopes` 台账。
5. 240dbcf（v6.6.1 死代码清理）删掉 play/reverse/kill/killAll 共 41 行——entries 台账无人使用；registry 从此退化为纯 gsap facade + 单租户 scope。
6. 为何没人修：因为没有故障。killTweensOf 按 target 精确清理，不产生误杀；scope 的唯一真实需求（tree-render 整树清理）一直被满足。漂移只存在于「注释声称 vs 实际接线」之间。

**修法结论（深潜）：废弃 scope 的泛化契约声称、承认现状——保留 scope 给 tree-render 单租户，将头注释第 3 条及 scope() docstring 改为「按需的模块级 timeline 隔离」，不必把 killTweensOf 收编进台账。**

⚠ 修法分歧（保留并标注）：普查 agent-100（cross-domain#4）给出相反方向的修法——「killTweensOf 改为必须带 scope 参数或登记进 `_scopes`，check-anim 增加对无 scope 调用的断言」（强化机制）。深潜 agent-107 的证据（killTweensOf 自出生 commit 起即被设计为透传、7 处直透均为修真实 bug 的官方用法）指向废弃而非强化。两案证据均已收录，待裁决。

### 七、格式转换双份（ai-chat#2；深潜 agent-108）

因果叙事：

- 2026-07-22 `3833cd2` 在 orb-chat.ts 的 `doSend` 内首次形成正典转换（content blocks → OpenAI tool_calls），修「历史消息丢工具上下文致模型失忆」。该转换是 doSend 函数体内的内联代码，未导出为可复用单元。
- 2026-07-26 `0ebea93` 加 v8 冷恢复：在 orb.ts 的 `initOrb` 里写了个 IIFE（后由 `95bad64` 机械抽为 `tryAutoResume`，内容零改动），需要同一份转换。注释写「复用 doSend 的格式转换逻辑」，但 orb.ts 拿不到内联代码——作者知道正典存在，是不好复用而非不知道，于是逐行拷贝了一份。
- 转折点一：`19a5ee0`（07-27）orb-chat 三文件拆分，正典随 doSend 迁入 orb-chat-run.ts，仍未顺手导出共享函数。
- 转折点二：`1e37909`（07-28，v8.1.0）压缩投影只接线 doSend；`02087d1`（07-29，空壳过滤）也只修 doSend。两份自此各自演化。
- 为何没人修：`git log -L 686,709:src/client/modules/orb.ts` 仅返回 `0ebea93` 一条——拷贝块自引入起零补丁。注释「复用 doSend」误导后续读者；冷恢复触发率低；`02087d1` 服务端加了边界 fail-closed 兜底，bug 不显现。

**修法结论：把 blocks → apiMessages 转换提为共享纯函数，落点 `src/shared/chat-protocol/`（`20be4c3` 已建此目录）；tryAutoResume 应带压缩投影 + 空壳过滤——它同样把 `chatMessages` 全量发向同一 `/ai/chat/start` 端点，而 TOOL_IO_COMPACTION 契约与 BAR-PROVIDER-02 边界约束的对象是端点载荷本身，不是入口路径。**

### 八、ai-tools 9 端点（server#3；深潜 agent-109）

因果叙事：

1. 当时意图：25a295e（2026-06-02，v6.1.0）一次性建起 ai-tools.ts(+294行）+capability-executor(+204)+ws-server 桥（+158)，设计文档 REGISTRY_NEXT_AGENT_DISCUSSION.md 写明受众是仓外 AI agent——「AI agent 通常运行在服务端（或通过 API 调用）」，HTTP 端点是它的操作面。
2. 同一 commit 已埋下绕过路径：WS 通道同天落地成为数据主平面，POST /ui/snapshot/push 出生即被标注「WebSocket 的后备通道」——但客户端从未实现 HTTP push，后备通道从未接线。
3. 转折点：2026-07-14 起仓内自建 AI 后端（src/server/ai/，page-state 直调 wsServer.getLatestSnapshot)，仓内 agent 与浏览器同进程，天然不需要 HTTP 自调用；HTTP 外侧面从此只剩理论受众。
4. 为何没人修：端点无调用方就不产生故障；v8 时代每次审计（e839232 删 debug stub、5862516 删死代码）都绕过它，因为契约（server/contract.md）仍把它写成正式职责，文档为死重提供了合法性掩护。
5. 最新佐证：v8.3.0 的 agent-runner（8ce26fd，真正的 agent 运行时）同样不调用这批端点，外部受众至今不存在。

**修法结论（深潜）：部分删除——/ui/snapshot/push、/ui/element/:id、/capabilities/executor、/ui/schema 纯死重可整删（两个月零调用、客户端从未接线）；/ui/snapshot、/capabilities、/ui/command、/capabilities/execute 是唯一的「仓外 agent 外侧面」，若保留必须文档化其外部契约地位并补 verifyLocalOrigin（现 drive-by 敞口，见 server#7），否则整批连 capability-executor 一并删除。**

⚠ 修法分歧（保留并标注）：普查 agent-96 对同一条目（server#3）的深潜结论是「先在端点加访问日志运行一个版本周期实证无调用，再整文件删除 ai-tools.ts 并把 capability-executor 收编为 wsServer 内部模块」——即「先实证再整删」；深潜 agent-109 主张「部分删除 + 外侧面二选一」。分歧点在是否给外侧面留保留选项、以及删除前是否需要访问日志实证期。
