# tmux-tabs v2.1 · 交互状态机清单（行为层规格）

> 这是什么：宪法 §6 Step 2 client 侧 tmux 标签条的行为层规格（试点件：
> 主会话"前端三层规格"提案的 nz 侧验证样本）。
> 语义来源：用户三轮仲裁后的确认稿（2026-09-01）+ **第四次仲裁（2026-09-02
> 用户拍板：标签从「窗」改回「会话」）**+ **第五次仲裁（同日：＋建会话后
> 自动 attach 并聚焦；展开态点屏幕空白区域自动收起标签栏）**+ **第六次仲裁
> （同日：点聚焦标签回终端态时标签排保持展开；操作屏幕即收起标签栏；
> detach 后清屏重绘 prompt 以消除 tmux 残留画面的视觉暗示）**。
> 纪律：**清单用户签收 → 每条转换一颗考卷钉 → 实现 → 变异抽检**。
> 状态：**已签收（0902 第六次仲裁用户当面拍板）**。
> 考卷蓝本：tests/browser/tmux-tabs.test.mjs（v7，会话版）。

## 〇、0902 会话化仲裁（对 0901 稿的增量）

| 变更点 | 0901（窗版） | 0902（会话版，现行） |
|---|---|---|
| 标签对象 | 单会话（缺省 dsh）内的窗 | **服务器全部 tmux 会话** |
| 数据源 | `tmux -C attach` 控制通道（每连接每会话一通道） | 会话表轮询：server `tmux ls` 3s 推送（变化才推） |
| ＋ | new-window | **new-session -d**（tmux 拒绝重名；客户端先查重） |
| × | kill-window | **kill-session**（确认页拦截不变） |
| 点标签 | select-window / attach+select | **attach 该会话**（`new-session -A`）；已附其他会话=先 detach 再附 |
| 聚焦指示 | tmux active 窗 | **本终端附着的会话**（attachedSession；未附=无聚焦） |
| T11 拖动换序 | swap-window | **退役**（会话无顺序语义） |
| 改名竞态 | automatic-rename 抢名（已知坑） | **消失**（会话名不自动改名） |
| ?tmuxSession 参数 | 选目标会话 | **移除**（标签=全局会话表） |
| 杀掉附着会话 | tmux 切邻窗 | 终端 tmux 客户端随会话死→回终端态，组件塌回 HANDLE |
| TmuxControl（窗级控制通道） | 标签条专用 | **标签条不再使用**（模块保留，归 term-contract 窗级管理后续） |

## 一、状态枚举（组件层）

| 状态 | 视觉 | 进入条件 |
|---|---|---|
| `HANDLE`（tmux·收起） | 左上 32px 圆形把手（SVG 四格图标；无会话时 55% 透明度=空表变体） | 挂载即常在（0901 仲裁：＋入口不消失） |
| `EXPANDED`（tmux·展开） | 顶部标签排：全部会话标签 + `＋` | 标签排展开 |
| `OVERLAY_NEW` | 全屏毛玻璃页：名字输入 + 确认/取消 | EXPANDED 点 `＋` |
| `OVERLAY_CLOSE` | 全屏毛玻璃页："关闭 '<会话名>'？" + 确认/取消 | EXPANDED 点某标签的 `×` |

**全局语境**：
- **终端态** = 未附任何会话的裸 shell——组件呈 `HANDLE`（把手常在=＋入口常在）；
- 附着期间页面显示该会话内容；标签排只是浮层；
- 聚焦指示 = 本终端附着的会话（未附时无聚焦，**组件不发明聚焦**）。

## 二、转换表（手势 → 转换，0902 会话版）

| # | 起点 | 手势 | 终点 | 底层动作（tmux 语义） |
|---|---|---|---|---|
| T1 | `HANDLE` | 点把手 | `EXPANDED` | 无（纯 UI） |
| T2 | `EXPANDED` | 点**非聚焦**标签（未附） | `EXPANDED`（附着指示落位） | 注入 `tmux new-session -A -s <名>` attach |
| T2s | `EXPANDED` | 点**非聚焦**标签（已附其他） | `EXPANDED` | 注入 Ctrl-B d → 350ms 后 attach 新会话（嵌套禁止：tmux 客户端内不能再 attach） |
| T3 | `EXPANDED` | 点**聚焦**标签 | `EXPANDED` | 注入 Ctrl-B d detach → 回终端态；**标签排保持展开**（选择态），并清屏+`^L` 重绘 prompt，抹掉 tmux 残留画面 |
| T4 | `EXPANDED` | 点 `＋` | `OVERLAY_NEW` | 无（输入框自动聚焦） |
| T5 | `OVERLAY_NEW` | 输入名字+确认 | `EXPANDED`（已聚焦新会话） | `new-session -d -s <名>` + 立即 `enterSession(name)` attach（重名=tmux 拒绝；客户端先查重静默去重） |
| T6 | `OVERLAY_NEW` | 空名字+确认 | `EXPANDED`（已聚焦新会话） | `new-session -d` + 立即 attach 该新会话（tmux 自动编号命名） |
| T7 | `OVERLAY_NEW` | 取消 / 点罩层空白 | `EXPANDED`（原状） | 无（零副作用） |
| T8 | `EXPANDED` | 点某标签 `×` | `OVERLAY_CLOSE` | 无 |
| T9 | `OVERLAY_CLOSE` | 确认 | `EXPANDED`（少一标签） | `kill-session -t <名>`；杀的是附着会话→终端回终端态+塌回 HANDLE |
| T10 | `OVERLAY_CLOSE` | 取消 / 点罩层空白 | `EXPANDED`（原状） | 无（零副作用） |
| T14 | `EXPANDED` | 点屏幕空白区域（标签排外） | `HANDLE` | 无（纯 UI，backdrop 收起） |
| T15 | `EXPANDED` | 操作屏幕（点终端/keybar、滚动、键盘输入等，事件源不在标签栏组件内） | `HANDLE` | 无（纯 UI，document 全局监听收起） |
| T12 | 任意 | 通道断 / WS 假死 | 数据停更（状态保持） | 3s 重试腿持续；重试成功→恢复推送 |
| T13 | 数据断 | 重试成功 | 恢复推送 | 无 |

**环境事件转换**（同 0901 稿：E1 visible 补连 / E2 毛玻璃键盘避让 / E3 字体晚到 /
E4 服务器推送校准——推送源从 tmux-state 改为 tmux-sessions）。

**砍掉的功能**：长按改名（0901 裁决）；**拖动换序 T11（0902 随会话化退役）**。

## 三、可观测性（实现约束）

- **单源 reducer**：四状态显式枚举，唯一 transition 入口（from/to/trigger 记账）；
- **同步查询钩子**：`__kfmNzTmuxTabs()` 报：
  `{state, sessions, attachedSession, expanded, overlay, history}`；
- **转换环形缓冲**：≥40 拍 `{t, state, expanded, n}`（n=会话数）；
- **词汇表强制统一**：HIDDEN/HANDLE/EXPANDED/OVERLAY_NEW/OVERLAY_CLOSE，
  清单外状态名=规格外状态≈bug 候选。

## 四、禁止条款

- **P1** 禁止：点击聚焦标签触发任何 attach/select（T3 是纯收起）；
- **P2** 禁止：未经 `OVERLAY_CLOSE` 确认直接 `kill-session`；
- **P3** 禁止：`HIDDEN` 态残留任何把手/标签/毛玻璃 DOM；
- **P4** 禁止：点非聚焦标签后标签排自动收起（T2 终点恒 `EXPANDED`）；
- **P5**（0902 改）禁止：客户端对会话表固执己见——列表以服务器轮询推送为唯一真源；
- **P6** 禁止：毛玻璃页可被下层终端滚动/点击穿透（backdrop 拦截全部指针）；
- **P7**（0902 新）禁止：已附状态下直接注入第二次 attach（tmux 嵌套禁止）——
  必须先 detach 再 attach（T2s 时序）。

## 五、视觉规格

同 0901 稿（Minimalism & Swiss × Dark OLED；面板 #0A0E14/发丝线 #232833/
活动字 #F5F7FA/非活动 #8A93A3；聚焦指示=标签底部 2px 白线；圆角 0；
＋/× SVG 线脚；展开收起 180ms；毛玻璃页键盘避让）。
标签副文本：会话窗数徽记（`<名>·<窗数>`，纯文本微字）。

## 六、考卷映射（v7，每条转换一颗钉）

| 钉 | 验证转换 | 手段 |
|---|---|---|
| ① | T1 + 会话表渲染 | 展开→标签含 dsh/amp（真实夹具会话） |
| ② | T4/T5 | ＋→输名→确认→自动 attach（state=EXPANDED+attached=name+屏幕含状态行） |
| ③ | T3 点聚焦 | 点聚焦标签→detach 回终端态，**标签排仍展开（state=EXPANDED）**，屏幕 tmux 状态行消失 |
| ④ | T2 未附点标签 | 点探针会话标签→状态行出现+attached=true |
| ⑤ | T2s 已附切换 | 附 A 点 B→先 detach 后 attach（状态行换名） |
| ⑥ | T8/T9 | ×→确认页拦截→确认→双证消失 |
| ⑦ | T9 杀附着会话 | 附着时 inject kill-session→塌回 HANDLE |
| ⑧ | T14 点屏幕空白 | 展开后点 `[data-tmux-backdrop]`→收起回 HANDLE |
| ⑨ | T15 操作屏幕 | 展开后在终端/keybar 滚动或键盘输入→收起回 HANDLE |
| ⑩ | kernel 注册+词汇表 | kernel list + ring 状态名全在枚举内+末拍互证 |
