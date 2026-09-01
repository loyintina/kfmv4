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
| `HIDDEN` | 什么都不渲染 | 无 tmux 会话 / 通道断 / 会话结束 |
| `HANDLE`（tmux·收起） | 顶部中央 14px 小把手「▾ tmux」 | 会话活着，标签排被收起 |
| `EXPANDED`（tmux·展开） | 顶部 36px 标签排：≥1 个标签恒有一个聚焦（tmux 保证）+ `＋` | 会话活着，标签排展开 |
| `OVERLAY_NEW` | 全屏毛玻璃页：名字输入 + 确认/取消 | EXPANDED 点 `＋` |
| `OVERLAY_CLOSE` | 全屏毛玻璃页："关闭 '<窗口名>'？" + 确认/取消 | EXPANDED 点某标签的 `×` |

**全局语境**（非组件状态，但约束转换）：
- **终端态** = 未挂任何 tmux 的初始命令行（用户裁决定义）——此时组件恒
  `HIDDEN`，终端就是裸 shell，无任何标签 UI；
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

**砍掉的功能（用户裁决 2026-09-01）**：长按改名——automatic-rename 顶名
问题无优雅解，不做。

## 三、可观测性（实现约束——状态机必须是"可观测物件"）

- **单源 reducer**：五状态必须是代码中的显式状态枚举，所有转换走唯一
  transition 入口（from/to/trigger 记账）——禁止把状态散落在多个
  useState 里（v1 教训：状态散落=不可观测）；
- **同步查询钩子**：`__kfmNzTmuxTabs()` 必须报完整机位：
  `{state, windows, activeId, expanded, overlay, lastSelected}`；
- **转换环形缓冲**：最近 ≥50 条 `{from, to, trigger, t}` 随钩子可拉
  （回答"它刚才经历了什么"）；
- **按需落盘**：专症时挂 fgwatch 式 beacon 转 /tmp 日志（管道常驻、
  专症挂载——复盘裁决①同款判断），不常驻状态流。

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
