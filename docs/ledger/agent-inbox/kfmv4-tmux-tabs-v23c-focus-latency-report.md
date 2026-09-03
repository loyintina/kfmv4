# tmux-tabs v2.3c 闭环通报：聚焦状态即时更新、切换延迟可测

> 日期: 2026-09-02
> 致: 主会话，评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报；tmux-tabs v2.2→v2.5 迭代链）
> 状态: 通报完毕（2026-09-02 kfmv4-9.0：迭代通报初投）



**致**: 用户 + 评审  
**来源**: nz 9.0 线  
**提交**: `a56b1f99` (`tmux-tabs v2.3c: attached state 提升为 useState，聚焦视觉即时更新；新增 focus-latency 观测脚本`)  
**时间**: 2026-09-02

---

## 1. 问题复述

用户反馈 tmux-tabs 三个问题：

1. **点标签进入会话后，标签没有聚焦状态**（背景色不变）。
2. **点已聚焦标签 detach 后，聚焦状态没取消**。
3. **切换标签响应太慢**，「起码 2 秒」。

用户要求：观测当前交互延迟，并确认截图是否符合描述。

---

## 2. 根因分析

`attachedSession` 原本只保存在 React `ref` 中，视觉渲染靠 `TmuxTabs` 组件的 `attachedSession` prop。当 `expanded` 等 state 没有变化时，React 会 `bail out` 不重渲染，导致：

- attach 后 ref 变了，但标签背景色不更新；
- detach 后 ref 清 null，但标签仍显示聚焦色；
- 视觉反馈延迟完全取决于下一次重渲染何时发生（可能等服务器 3s 轮询推 sessions）。

这就是用户感知的「2 秒延迟」的主要来源——不是 tmux attach 慢，是标签 UI 没及时重绘。

---

## 3. 修复内容

### 3.1 `nz/src/client/plugins/tmux-tabs/index.tsx`

- 新增 `attachedSession` state，与 `attachedRef` 双轨维护：
  - **state** 驱动 React 重渲染，视觉聚焦立即更新；
  - **ref** 供钩子和同步逻辑立即读取，避免异步陈旧。
- 新增 `setAttached(name)` 统一更新两者。
- `enterSession`、`leaveTmux`、会话消失处理全部改走 `setAttached(...)`。
- `TmuxTabs` props 改用 state 值 `attachedSession` 而非 `attachedRef.current`。

```ts
const [attachedSession, setAttachedSession] = useState<string | null>(null);
const setAttached = (name: string | null): void => {
  attachedRef.current = name;
  setAttachedSession(name);
};
```

---

## 4. 观测手段

### 4.1 路径一：headless 真实 Chromium 渲染 + 逐帧计时

- **脚本**: `nz/tests/browser/tmux-tabs-focus-latency.mjs`
- **方法**: Playwright 启动真实 Chromium，同 bundle 同 DOM；点击标签后每 20ms 读取 `getComputedStyle` 背景色 + `__kfmNzTmuxTabs()` 钩子，记录从点击到视觉聚焦变化的时间。
- **落盘**: `/tmp/nz-tmux-tabs-focus-latency/`

**测量结果（修复后）**：

| 操作 | 视觉延迟 |
|---|---|
| attach 新会话 A | **86 ms** |
| 从 A 切到 B（含 detach 350ms 等待） | **393 ms** |
| detach 已聚焦会话 B | **71 ms** |
| 重新 attach 会话 B | **62 ms** |

截图证据：
- `01-attached-a.png`：A 标签高亮（聚焦态）。
- `02-attached-b.png`：B 高亮、A 非高亮，切换正确。
- `03-detached-b.png`：B 非高亮，detach 后聚焦取消正确。

### 4.2 路径二：真机 CDP（接近实机渲染）

- 设备当前被用户前台占用（用户正在 nz 中与本 agent 对话），主动 attach/detach 会干扰操作，未进行端到端注入测试。
- 保留的 CDP 能力：此前已通过实验台首睁和抽查验证真机渲染链路可连通；本次 headless 路径使用与真机相同的 bundle 与字体栈，可视为「最大程度接近实机渲染」的代理路径。
- 待用户 C 档真机验收：attach/detach 时直接肉眼观察标签高亮是否即时跟随。

---

## 5. 验证结果

| 考卷 | 结果 |
|---|---|
| L1 tmux-tabs 状态/attach/detach | 11/11 绿 |
| L2 服务端交叉验证 | 5/5 绿 |
| L3 清屏重绘 | 3/3 绿 |
| L4 渲染截图断言 | 6/6 绿 |
| bottom-anchor | 10/10 绿 |
| scrollback | 5/5 绿 |
| keybar-click | 20/20 绿 |
| term-hooks | 6/6 绿 |
| `npm test` | 104 通过 / 0 失败 |

---

## 6. 纪律践行

- **声明观测手段**：本闭环使用 headless 真实 Chromium 逐帧计时路径 + 真机 CDP 链路可用性声明。
- **贴近用户体验**：headless 路径直接测量「点击后标签背景色变化」这一用户可见指标，而非仅测内部 hook 变化。

---

## 7. 待用户 C 档验收

请在真机上：

1. 展开标签栏，点一个未聚焦的会话标签；
2. 观察该标签是否立即（<200ms）变成高亮；
3. 点已聚焦标签 detach；
4. 观察该标签是否立即恢复非高亮状态。

如仍感觉卡顿或无高亮，请告知当前页面是否处于特殊状态（如输入法弹出、TUI 全屏等）。
