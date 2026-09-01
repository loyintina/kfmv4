# tmux-tabs v2 · 交互状态机清单（行为层规格）

> 这是什么：宪法 §6 Step 2 client 侧 tmux 标签条的行为层规格（试点件：
> 主会话"前端三层规格"提案的 nz 侧验证样本）。
> 语义来源：用户三轮仲裁后的确认稿（2026-09-01，本对话）。
> 纪律：**清单用户签收 → 每条转换一颗考卷钉 → 实现 → 变异抽检**。
> 状态：**待用户签收**。
> 考卷蓝本：tests/browser/tmux-tabs.test.mjs（现 6 钉，按本清单扩至 11 钉）。

## 一、状态枚举（组件层）

| 状态 | 视觉 | 进入条件 |
|---|---|---|
| `HANDLE`（tmux·收起） | 左上 32px 圆形把手（SVG 四格窗格图标；0 窗时 55% 透明度=HANDLE_EMPTY 视觉变体） | 挂载即常在（2026-09-01 用户二次仲裁：＋入口不随最后窗口消失） |
| `EXPANDED`（tmux·展开） | 顶部 36px 标签排：≥1 个标签恒有一个聚焦（tmux 保证）+ `＋` | 会话活着，标签排展开 |
| `OVERLAY_NEW` | 全屏毛玻璃页：名字输入 + 确认/取消 | EXPANDED 点 `＋` |
| `OVERLAY_CLOSE` | 全屏毛玻璃页："关闭 '<窗口名>'？" + 确认/取消 | EXPANDED 点某标签的 `×` |

**全局语境**（非组件状态，但约束转换）：
- **终端态** = 未挂任何 tmux 的初始命令行（用户裁决定义）——此时组件
  呈 `HANDLE`（0 窗变体）：把手常在=＋入口常在，点＋经页面 shell
  `tmux new-session -d` 创建首个窗口（0901 二次仲裁）；
- tmux 挂着期间页面恒显示聚焦窗口内容；标签排只是它的浮层；
- **恒有一个聚焦窗**（tmux 语义天然保证，组件不自行发明聚焦）。

## 二、转换表（手势 → 转换）

| # | 起点 | 手势 | 终点 | 底层动作（tmux 语义） |
|---|---|---|---|---|
| T1 | `HANDLE` | 点把手 | `EXPANDED` | 无（纯 UI） |
| T2 | `EXPANDED` | 点**非聚焦**标签 | `EXPANDED`（聚焦指示移动） | `select-window -t <id>`，整页切到该窗 |
| T3 | `EXPANDED` | 点**聚焦**标签 | `HANDLE` | **无 select**——视为回到终端视图，不切任何窗 |
| T4 | `EXPANDED` | 点 `＋` | `OVERLAY_NEW` | 无（输入框自动聚焦） |
| T5 | `OVERLAY_NEW` | 输入名字+确认 | `HANDLE`（新窗聚焦在前） | `new-window -n <name>` + `set -w automatic-rename off`（名字钉死） |
| T6 | `OVERLAY_NEW` | 空名字+确认 | `HANDLE`（新窗聚焦在前） | `new-window`（无 -n，名字跟随运行程序） |
| T7 | `OVERLAY_NEW` | 取消 / 点罩层空白 | `EXPANDED`（原状） | 无（零副作用） |
| T8 | `EXPANDED` | 点某标签 `×` | `OVERLAY_CLOSE` | 无 |
| T9 | `OVERLAY_CLOSE` | 确认 | `EXPANDED`（少一标签）／`HIDDEN`（最后一张） | `kill-window -t <id>`；聚焦窗被关→tmux 自动切邻窗；最后一张→会话结束 |
| T10 | `OVERLAY_CLOSE` | 取消 / 点罩层空白 | `EXPANDED`（原状） | 无（零副作用） |
| T11 | `EXPANDED` | 拖动标签到新位（按住 ≥300ms 起拖） | `EXPANDED`（顺序变） | `move-window -s <id> -t :<目标序>`；乐观排序，服务器推送校准 |
| T12 | 任意 | 通道断 / 会话消失 / WS 假死 | `HIDDEN` | 3s 重试腿持续；重试成功→`HANDLE` |
| T13 | `HIDDEN` | 重试成功（会话出现） | `HANDLE` | 无 |

**环境事件转换（一等公民——评审修正一，2026-09-01）**：UI 状态机是混成
系统（离散状态+连续时钟+环境分流），环境事件与用户手势同列：

| # | 起点 | 环境事件 | 终点/动作 |
|---|---|---|---|
| E1 | 任意 | `visibilitychange`→hidden（熄屏/切走） | 无 UI 转换，但**重试腿冻结**（定时器停走）；恢复 visible 立即补一轮重连——不许等 3s |
| E2 | `OVERLAY_NEW` | IME 弹出（vv 收缩） | 输入锚 visual viewport，毛玻璃卡避让键盘（名输框永不被键盘盖） |
| E3 | 任意 | 字体晚到 | 标签宽度自适应重排（NaMain 就绪门后无跳变为准） |
| E4 | `HANDLE`/`EXPANDED` | 服务器推送（tmux-state） | 以推送为准更新窗口列表/active（P5 校准源） |

**砍掉的功能（用户裁决 2026-09-01）**：长按改名——automatic-rename 顶名
问题无优雅解，不做。

## 二·b、附窗维度（2026-09-01 用户二次仲裁：tmux 窗口与终端真实接线）

**终端本体 = 用户裸 shell（终端态）**；标签条点选的语义以"附窗状态"
（attached：终端当前是否 attach 在会话上）为条件：

| # | 附窗态 | 手势 | 行为 |
|---|---|---|---|
| T2a | 未附 | 点任意标签 | 注入 `tmux new-session -A -s <会话>` attach + select 该窗 → 整页切窗，`attached=true` |
| T2 | 已附 | 点**非聚焦**标签 | `select-window` 切窗（整页跟随），停留 EXPANDED |
| T3 | 已附 | 点**聚焦**标签 | 注入 Ctrl-B d detach → 回终端态（裸 shell），`attached=false`，收起 HANDLE |
| T3b | 未附 | 点**聚焦**标签 | 同 T2a：attach 并显示该窗（进出对称） |

- **attached 为可观测字段**：`__kfmNzTmuxTabs().attached`（意图账本；
  用户手动 ctrl-b d 造成的失配为已知边界，无害自愈）；
- detach 动作 = 注入 `Ctrl-B d` 原始键序（TUI 程序运行中也安全）；
  attach 动作 = 注入 `tmux new-session -A -s <会话>`（有则附、无则建）；
- 考卷映射新增三钉：P-A（附窗切窗，屏幕标记互证 ≤800ms）、P-B（detach
  回终端态：状态行消失）、P-C（未附重进：状态行复现）。

**结晶制纪律（评审修正二，收编）**：本清单 12+4 条转换是用户点名需求+
已出过 bug 的转换（T12 系通道假死/重载案结晶），非全组合枚举；后续新增
回归钉走**打脸结晶制**——出过行为 bug 才立钉；同组件第二次行为 bug，
强制全状态空间立项规格化。防文档烂尾，防官僚化。

## 三、可观测性（实现约束——状态机必须是"可观测物件"）

- **单源 reducer**：五状态必须是代码中的显式状态枚举，所有转换走唯一
  transition 入口（from/to/trigger 记账）——禁止把状态散落在多个
  useState 里（v1 教训：状态散落=不可观测。v1 已回装观测环：渲染快照投影+与 DOM 互证，首跑即抓到 P4 违例——观测先于基建，用户纠偏 0901）；
- **同步查询钩子**：`__kfmNzTmuxTabs()` 必须报完整机位：
  `{state, windows, activeId, expanded, overlay, lastSelected}`；
- **转换环形缓冲**：最近 ≥50 条 `{from, to, trigger, t}` 随钩子可拉
  （回答"它刚才经历了什么"）；
- **按需落盘**：专症时挂 fgwatch 式 beacon 转 /tmp 日志（管道常驻、
  专症挂载——复盘裁决①同款判断），不常驻状态流；
- **词汇表强制统一**（评审修正三）：观测环/钩子/考卷里的状态名必须
  **直接引用本清单状态枚举词**（HIDDEN/HANDLE/EXPANDED/OVERLAY_NEW/
  OVERLAY_CLOSE）——轨迹里出现清单外状态名=规格外状态≈bug 候选，即告警。

## 三·b、时序层（评审修正四：行为层旁边立时序断言）

| 断言 | 预算 |
|---|---|
| select 发出 → active 位推送回证 | ≤ 800ms |
| tmux-exit → `HIDDEN` 落地 | ≤ 1s |
| 重试腿重连（visible 补测/周期重试） | ≤ 3.5s |
| 标签排展开/收起动画 | 180ms ±50%（reduced-motion 直切） |

时序预算超限=时序层红，与状态转换红同等对待。

## 四、禁止条款（"隐藏体验"显式化）

- **P1** 禁止：点击聚焦标签触发任何 `select-window`（T3 是纯收起）；
- **P2** 禁止：未经 `OVERLAY_CLOSE` 确认直接 `kill-window`；
- **P3** 禁止：`HIDDEN` 态残留任何把手/标签/毛玻璃 DOM；
- **P4** 禁止：点非聚焦标签后标签排自动收起（T2 终点恒 `EXPANDED`）；
- **P5** 禁止：乐观排序超过 2s 未被服务器推送校准（拖动结果以 tmux 为准，
  组件不得固执己见）；
- **P6** 禁止：毛玻璃页可被下层终端滚动/点击穿透（backdrop 拦截全部指针）。

## 五、视觉规格（体验层参考对齐）

- 风格引用：Minimalism & Swiss × Dark Mode (OLED)（UIUX-Pro-Max styles.csv）
- 色板：面板 `#0A0E14`｜发丝线 `#232833`｜活动字 `#F5F7FA`｜非活动字
  `#8A93A3`｜微字 `#566072`｜聚焦指示=标签底部 2px `#F5F7FA` 白线
- 形状：圆角 0px；阴影/渐变：无；图标：`＋`/`×` 用 SVG 线脚（禁字符 emoji）
- 动效：展开/收起 180ms ease-out；拖动跟手；`prefers-reduced-motion` 直切
- 字体：继承终端字体栈（NaMain 同源）
- 毛玻璃页：`backdrop-filter: blur` + 半透明黑罩、中央窄卡 1px 线框、
  输入锚 visual viewport（键盘避让）

## 六、考卷映射（每条转换一颗钉）

| 钉 | 验证转换 | 手段 |
|---|---|---|
| 现① | T12/T13 通道重试 | 注入建会话前后观察 hidden→handle |
| 现②③ | T1 + 首标签渲染 | 注入建会话→把手→展开 |
| 现④ | T2 的推送面 | 注入 new-window→beta 标签出现 |
| 现⑤ | T2 的 select 面 | 点标签→推送回 active 翻转 |
| 现⑥ | 契约注册 | kernel list |
| **新⑦** | T4/T5 | 点＋→毛玻璃页→输名→确认→新标签聚焦+收起 |
| **新⑧** | T6 | 空名确认→新标签（名字非钉死语义） |
| **新⑨** | T7/T10 | 取消→原状零副作用 |
| **新⑩** | T8/T9 | 点×→确认页→确认→标签消失（推送回证） |
| **新⑪** | T3 | 点聚焦标签→收起回把手（无 select 帧发出） |
| **新⑫** | T11 | 合成 pointer 拖动→推送顺序翻转回证 |

（T11 的 headless 拖动用 Playwright mouse 事件合成；真手感归 C 档真手指。）
