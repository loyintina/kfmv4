> 这是什么：canvas-tree 域**代码现状**测绘（实然）——代码此刻到底是什么，含与契约的漂移。
> 应然去哪找：设计契约 → contract.md；引擎细节 → detail-engine.md。
> 机械层对照：文件/行数/导出符号 → ../code-inventory.md（脚本生成，可重跑）。

# canvas-tree 代码地图（code-map）

## 测绘元数据

- 基准：commit 03da8c9 · 2026-07-29 · 域规模 31 文件 / 10105 行
- 方法：subagent 七问侦察 + 主 agent 对重大指控逐一 file:line 抽查核实

## 一句话职责

Canvas 2D 文件树的全部呈现与交互：树构建、展开/折叠动画（overlay + 字符雨）、
光标/滚动/惯性、临时卡片堆、模式系统、文件操作栏、根目录切换。

## 承重入口

| 入口 | 位置 | 调用方 |
|------|------|--------|
| `initTreeRenderer()` | tree-render.ts:312（域总编排） | main.ts:71（唯一） |
| `onSidebarOpen/Close` | tree-render.ts:200/283 | ui.ts（唯一） |
| `loadFileTree()` | tree-loader.ts:128 | 6 方（main/tree-swipe/action-bar/switcher/orb-chat-run） |
| `buildSidebarTree()` | tree-model.ts:183（纯构建） | tree-render.ts:936（生产唯一） |
| `selectFilesForPrompt()` | tree-swipe.ts:651 | role.card.ts:14（跨域） |
| `L` 单例（生命周期/动画锁） | renderer-lifecycle.ts:223 | 域内全部模块读写 |
| `currentTheme` | theme.ts:238 | 13 个模块只读（含大量域外） |

## 状态所有权

- 渲染器/根/光标/动画锁/rAF 句柄：全挂 `L` 单例（client-shell 域），本域各模块均写
- `_boxLocationMap`：tree-render.ts:71；`_activeOverlays`：tree-overlay.ts:24
- 动画时间线 `ts`（anim.scope）：tree-render.ts:41——注意 tree-animation.ts 用的是
  无 scope 的 anim（tree-animation.ts:43-46，**不同时间线**）
- 临时卡片堆 `_tempCardEls/_lifoQueue/_dimmedPaths`：tree-swipe.ts:34-41 独占写
- 模式 `_selectedMode`：mode-system.ts:20-29 独占写；滚动惯性变量：canvas-scroll.ts:20-32
- 文件数据 KFMState.files/expandedPaths：state.ts（client-shell），本域只读

## 核心流程

**点击展开**：click 入队（tree-render.ts:434）→ processClickQueue（:485）→ doExpand（:587）
→ L.beginOp + KFMState.setExpanded → notify → rebuildTree（:917，入口防御性清理）
→ _runExpandAnimation（:610）→ overlay 搭建 + 字符雨 → onComplete：endOp → 清理 →
_resetAnimTimeline → 下一个队列点击。

**启动**：main.ts init → establishRoot → loadFileTree（拉全展开路径 → ingestTree →
逐层播展开动画）→ initLazyLoader 挂 beforeExpand 钩子；侧栏打开时销毁旧 renderer 重建。

## 持久化/外部边界

- 文件系统写唯一执行者是服务端（HTTP /files/*），客户端无直接写
- **localStorage expandedPaths 写者 4 处（非唯一）**：state.ts:128、tree-render.ts:525
  （动画反转直写，绕过 setter 无 notify）、tree-loader.ts:179、sibling-switcher.ts:117
- localStorage kfmv4_currentRoot 写者 3 处：sibling-switcher.ts:61/116、main.ts:124

## 跨域边界

- 依赖域外：client-shell 底座（state/L/anim/gestures/click-queue/DOM/debug-assert）；
  ai-chat 的 ws-channel（tree-render.ts:25 注册 4 条 AI 指令）；floating-card 的
  floating-card/card-registry/renderers；npm @chenglou/pretext（4 文件直接 import）
- 被域外依赖：orb-chat-run.ts:20 → loadFileTree；role.card → selectFilesForPrompt；
  card-stack/chat-dom/orb 等 → theme/color-utils（只读）

## 强制不变量（附证据）

- overlay 进出为零的运行时断言：expand/collapse 前后四处 assert（tree-render.ts:626/712/755/860）
- rebuildTree 入口防御性清理：removeAllOverlays + L.endOp（tree-render.ts:919-922）
- 每轮动画结束 _resetAnimTimeline（tree-render.ts:56-61）
- 动画锁状态机：动画中点击只放行同路径反转或光标穿透（tree-render.ts:498/518）
- 懒加载幂等：beforeExpand 返回 true 短路默认 setExpanded（state.ts:118-121）
- setRootScrollY 强制 clamp [0, maxY]（canvas-utils.ts:23-28）

## 漂移清单（实然 ≠ 应然）

1. **【已结案】engine/text-layout 全目录生产死代码**：整目录 6 文件 2292 行 +
   tests/text-layout.test.ts 已删（2026-07-29 死代码批次，溯源见 ledger 案一——
   npm @chenglou/pretext 的冻结 port 副本，生产 4 处全部走 npm 包）。
2. **契约「theme.ts = 颜色唯一定义点」被普遍违反**：tree-render.ts:224、tree-swipe.ts:142/147、
   mode-system.ts:135-138/389-399、sibling-switcher.ts:44、tree-model.ts:126 等处大量
   硬编码颜色（另案）。getFileColor + theme.extColors 已随死代码批次删除
   （扩展名着色出生即未接线，2026-07-29）。
3. **契约 §4.6 pushContext/popContext 流程零调用方**（renderer-lifecycle.ts:112-125）；
   根目录选择器实际由 sibling-switcher 直接清 KFMState 实现，未走该管线。
4. **契约 #陷阱 5「方向锁 45°」不实**：canvas-scroll.ts:170-173 实为 12px 死区 +
   ±65° 扇形；tree-swipe.ts:693 另用 10px 阈值。
5. **契约 4.1「rebuildTree 时 L.isAnimating 应为 false」被懒加载有意违反**：
   tree-loader.ts:96-104 先 markAnimatingPath 再 notify 触发 rebuildTree，靠入口
   endOp 强清；契约所称「3000ms 超时强制释放」不存在（tree-loader.ts:25 的 3s 是
   等锁放弃，不是释放锁）。
6. **sibling-switcher 出口名漂移**：契约称 create/destroySiblingSwitcher，实际导出
   `initSiblingSwitcher`/`isSwitcherOpen`/`closeSwitcher`，且 init 模块加载自执行（:157）。
7. **【已结案】rename 后树不刷新**：已修（BAR-RENAME-01）——submit 查 `data.success`
   + 成功后 loadFileTree，成因 C 权宜（出生即缺，引入 eed2baf）。
8. **【已结案】tree-swipe delete 分支不检查响应**：已修（BAR-DELETE-01）——delete 分支
   解析响应查 success 并记日志，成因 C 权宜（引入 cafcb58）。遗留次要项：
   animateRemoval 未 await 与 API 并行，失败时动画已播完（观感瑕疵，另案）。
9. **【已结案】死代码清单**：locateFileBox、forceRebuildTree、getRowIndexLength、
   getModeAccentColor、getRowLayout、styleRegistry.set/patch、setupCharRainForSiblings
   已全部随死代码批次一/二删除（getFileColor 批次一；pushContext/popContext 属
   renderer-lifecycle，批次二 client-shell#12 同案）；tree-render 的 ~11 行空 `;`
   残留语句同批清除（注释乱码未动）。
10. **契约 #陷阱 1「buildTree 修改后必须恢复 KFMState」过时**：tree-model 只读不写。
11. **职责与文件名不符**：tree-swipe.ts 名义「右滑」实含临时卡片堆全生命周期 +
    copy/move/delete 执行 + prompt 模式（726 行）；canvas-cursor/scroll 自称「通用」
    但 import 文件树专属的 style-registry。
12. **重复实现**：展开/折叠 overlay 双份对称逻辑；字符雨 expand/collapse 双分支；
    canvas-scroll 三条越界「罚步进」近似实现（:77-86/:211-243/:293-330）。
13. **【存疑】prompt 模式点击不更新 selectedFile**（promptSelectSingle 不走
    setSelectedFile）——选中高亮在 prompt 模式可能不生效。
14. 次要：tree-render.ts:641-651 残留 10 行空 `;` 语句及多处注释乱码（编码曾受损）；
    initTreeRenderer 首帧 rebuildTree 未走 rAF，靠 `|| 295`/`|| 618` 兜底（:934/939）。

## 陷阱指针

已定型陷阱见 contract.md #陷阱（注意第 1、5 条已过时/不实，见漂移清单 5/10）。
测绘新捕获：rename 不刷新、delete 不查响应（漂移 7/8）——待复核后升入契约。
