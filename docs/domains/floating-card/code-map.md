> 这是什么：floating-card 域**代码现状**测绘（实然）——代码此刻到底是什么，含与契约的漂移。
> 应然去哪找：设计契约 → contract.md。
> 机械层对照：文件/行数/导出符号 → ../code-inventory.md（脚本生成，可重跑）。

# floating-card 代码地图（code-map）

## 测绘元数据

- 基准：commit 03da8c9 · 2026-07-29 · 域规模 27 文件 / ~6700 行
- 方法：subagent 七问侦察 + 主 agent 抽查核实

## 一句话职责

浮动卡片系统：类型注册表 + 卡堆抽屉 + 浮卡生命周期（创建/拖拽/编辑/全屏）+
九张插件卡 + 终端/tmux 卡 + markdown 渲染器群。

## 承重入口

| 入口 | 位置 | 调用方 |
|------|------|--------|
| `registerCardType()` / `cardRegistry` | card-registry.ts:70-73 | 9 张插件卡注册；floating-*/gestures/main 消费 |
| cards/registry.ts（薄门面，自注册） | registry.ts:12-20 | main.ts:38（唯一） |
| `openCardStack/closeCardStack` | card-stack.ts:283 | app.ts、gestures.ts、terminal-card-04 |
| `createFloatingCard()` | floating-card.ts:141 | card-stack、tree-swipe、tree-render |
| `buildCardLayout()` | floating-card.ts:778 | terminal/tmux/5 张插件卡复用 |
| `createTerminal04Handler()` | terminal-card-04.ts:611 | plugins/terminal.card.ts:9（静态 import） |
| renderers/handler-factory.createFileHandler | handler-factory.ts | file.card、tree-swipe |

注意：renderers/ 是 floating-card 与 ai-chat **双域共享**（chat-dom/orb-chat 也 import），
domain-src 归在本域——同 ai-chat code-map 漂移 4 的边界问题。

## 状态所有权

- 浮卡列表 `_floatingCards` + z 分配器：floating-shared.ts:104-107（三方写）
- 每卡运行时状态：FloatingCardItem 对象，floating-card 与 floating-fullscreen 直接赋值
  （不走状态机函数，见漂移 11）
- 卡堆态 `_state/_focusIndex/_cardEls`：card-stack.ts:115-119 独占写
- 卡片实例表：card-registry.ts:70-73；终端核心态挂 CardInstance.meta + 模块级 Map
- tmux 卡会话态在 handler 闭包——**卡堆 getCardHandler 每次新建 handler（card-stack.ts:75），
  闭包态不跨次保留**

## 核心流程

**召唤浮卡**：page-swipe → openCardStack（GSAP 飞入）→ launchFocusedCard（card-stack.ts:80）
→ createHandler → createFloatingCard（建壳 + createInstance + activate + 全屏或散落飞入）。

**终端 WS 会话**：initTerminalCore（动态 import xterm）→ terminal-open（tag 匹配认领
sessionId，:530）→ onData→terminal-input / terminal-output→term.write → compact 只拔
DOM 保 WS（:594）→ dismiss 全清 + terminal-close。tmux 卡叠加 list-sessions/switch-client。

## 持久化/外部边界

- **localStorage kfm-fontsize-<typeId>**：写者唯一（gestures.ts:55-57 pinch 结束）；
  读者散落 7 处各卡 activate（key 拼接不一致，见漂移 23）
- **.kfmv4/providers.json 双写者**：api.card.ts:49-61 与 config.card.ts:69-77；
  **.kfmv4/active.json 三写者**（api/config/role 卡 + ai-chat 的 session-client）
- .kfmv4/sessions/：session.card 与服务端 session-store 双写
- 文件卡编辑：500ms 防抖 + blur + ctrl+enter 触发 _doSave（handler-factory.ts:156-165）

## 强制不变量（附证据）

- 全屏唯一槽位：enterFullscreen 先退其他全屏卡（floating-fullscreen.ts:23-27）
- zLocked 卡不参与层叠交换（floating-card.ts:96/110/122）
- 尺寸下限 54×54 四处钳制（floating-card.ts:27-28）
- 终端 open 回复必须 tag 匹配才认领 sessionId（terminal-card-04.ts:530）
- 拖拽只认 `.floating-br-orb` 且 state ∈ compact/active/editing（floating-card.ts:562-574）
- WS 重连先删旧 sessionId 再重开（terminal-card-04.ts:514）

## 漂移清单（实然 ≠ 应然）

**契约声称但代码不是：**

1. **契约出口清单错位**：launchFocusedCard 实际在 card-stack.ts:80 不在 floating-card。
2. **契约尺寸数字全错**：契约写 compact(120×36)/active(155×68)；代码
   COMPACT=155×68（floating-shared.ts:66-67）、active=240×288（interaction-constants.ts:18-20）。
3. **硬规则 4 双色对应反了**：代码 color1→左光球 TL/BL/topMid、color2→右 TR/BR
   （floating-card.ts:188-223），与契约相反；卡堆图标数字用 color1（card-stack.ts:173）。
4. **「terminal-card-04/tmux-card 导入数为 0 是特性」已过期**：现被插件卡静态 import。
5. **#陷阱 2 自家仍在犯**：enterFullscreen 对全后代写 inline touchAction
   （floating-fullscreen.ts:85-90）而 exitFullscreen 只恢复容器（:139）——后代值永久
   粘住；floating-card.ts:298-306 异步加载后又补一遍。
6. **硬规则 2（禁止直接 addEventListener）多处违反**：floating-card.ts:211/219/227、
   card-stack.ts:178、terminal-card-04.ts:329/682/724、floating-fullscreen.ts:61/67。

**代码有但契约没提：**

7. 终端选择模式整套（长按选区 + 双拖柄 + 放大镜 canvas 采样，terminal-card-04.ts:204-361）。
8. 键盘避让双机制（floating-card.ts:688-757 + floating-fullscreen.ts:105-114，
   needsKeyboard 硬编码 card03/card04）。
9. 卡堆注册 AI 指令 4 条（card-stack.ts:443-446）+ Registry 内容生成器（:430-440）。

**死代码：**

10. cards/types.ts 门面全仓库无人 import（插件直接 import modules/card-registry）。
11. `nextFloatingCardState` + `FloatingCardAction`（floating-shared.ts:5-28）零调用——
    实际状态转换全部内联直接赋值。
12. hasFloatingCard、dismissFloatingCard（外部零调用）、floating-card.ts:17 对全屏
    三函数的 re-export、`renderTextPreview`、getFocusIndex/getCardHandler/
    animateStackPullFeedback、`scatterBounds` 死配置字段、file.card 死 import getCardType。

**重复实现（已漂移的双份）：**

13. hex→rgba **四份**：floating-shared._hexToRgba、card-stack.hexToRgba、
    handler-factory._toRgba、chat-dom._hexToRgba。
14. 卡头骨架**三份**：buildCardLayout vs handler-factory 内联（:191-256）vs
    debug.card 内联（:33-76）——#陷阱 7「共享同一套 DOM 结构」只有一半卡遵守。
15. API_BASE + readFile/writeFile 帮手**五卡各抄一份**，都不用 state.ts 的 API。
16. 字号偏好读取逻辑**七份复制**（每卡 activate 各写一遍）。

**疑似 bug / 脆弱点（存疑）：**

17. **WS 重连双开 PTY**：terminal-card-04 的 onReconnect（:511-521）与 tmux-card 的
    _onWsReconnect（:246-256）都会发 terminal-open → 一次重连 spawn 两个 PTY，前者孤儿。
18. **发射时 zIndex 记录与 DOM 不一致**：item.zIndex 用 _allocZ（:164），el 覆写为
    Z_FLOATING_BASE + length + 1（:273-274）——首次 touch 前两者发散。
19. **api/tools 卡字号 fallback 错配**：读 kfm-fontsize-api/tools 但 FONT_SIZE_CONFIGS
    无这两个 typeId（gestures.ts:32-37）→ 按 file 的 8/20/13 钳；config/session/role
    卡压根不读字号偏好。
20. handler-factory 失焦静默 _doSave，失败 catch 吞掉（:164）——用户无感知静默丢写。
21. main.ts:57 把 cardRegistry 挂 window.__cardRegistry——调试后门，契约未提。
22. 命名错位：card03 的 handler 工厂叫 `createTerminal04Handler`；契约文件清单混用
    03/04 编号。

**契约已自认的活缺口**：focus-card/close-card/send-to-card 三命令仍未实施
（cardRegistry.focusCard 存在但无 wsChannel 绑定）。

## 陷阱指针

已定型陷阱见 contract.md #陷阱（注意 #2 未被自家遵守、#7 只有一半遵守，见漂移 5/14）。
测绘新捕获：漂移 17 的 WS 重连双开 PTY 若属实是会话泄漏级 bug，优先复核。
