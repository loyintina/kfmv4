> 这是什么：客户端跨模块骨架——注册中心、手势调度、动画状态机、初始化编排。
> 别的去哪找：文件树渲染 → ../canvas-tree/；浮卡 → ../floating-card/；AI 对话 → ../ai-chat/；样式构建 → ../infra/。

# client-shell 域契约

## 注册中心（五中心）

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| GestureRegistry | `gesture-registry.ts` | document 级触摸事件统一调度 |
| RendererLifecycle (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| DOM | `dom-refs.ts` | 全局 DOM 元素引用 |
| Registry | `ui-registry.ts` | UI 元素注册表（黄页模式） |
| KFMState | `state.ts` | 全局状态层（发布-订阅） |

## 手势优先级（不可违反）

实然注册表（2026-07-29 按代码重测绘，旧表的 picker-lock(110)/card-stack-global(80)
在代码中不存在）：

```
xterm-sel-handle(105) > floating-topmid-orb(101) > orb(100) = floating-orb(100)
> check-btns(95) > mode-btn(90) = pinch-zoom(90) > temp-card-swipe(80) = card-stack(80)
> action-bar-zone(70) = tmux-tab(70) > xterm-scroll(61) > sidebar-scroll(60)
> gestures-page-swipe(50)
```

- 新增交互模式必须注册进 GestureRegistry，**禁止直接 addEventListener**。
- ⚠ 平手靠注册序（如 mode-btn/pinch-zoom 同 90）——新增 handler 避免与现有同值，
  除非顺序无关。

## 动画状态机

| 模块 | 状态机 |
|------|--------|
| tree-render | `idle ⇄ animating`（L.beginOp/endOp） |
| card-stack | `closed ⇄ opening ⇄ open ⇄ closing` |
| floating-card | `compact → expanding → active ⇄ editing` |
| orb | `collapsed ⇄ expanded ⇄ editing`（orb-state.ts 实然 3 态；
过渡态由 GSAP 承担不入状态机） |

## 依赖方向（单向，零回边）

```
renderer-lifecycle → canvas-utils → canvas-cursor → canvas-scroll → tree-render
```

- `canvas-*` 不导入 `tree-*`；`(as any)` 零逃逸（check-as-any 扫描）。

## 初始化调用链

```
main.ts → gestures.init() → initApp() → initUI() → initGestures() → initOrb()
        → initTreeRenderer() → loadFileTree() → initLazyLoader() → initCardStack()
        → initWsChannel() → initVersionWatch() → initObsHud()（观测台 HUD）
```

## 观测台 HUD（8.5 史官制度，2026-08-06 立项；2026-08-08 七面定稿）

- 模块：`src/client/modules/obs-hud.ts`（域映射：client-shell）
- 形态：L1 中央内容层（`Z.CENTER_CONTENT`，100）——纯展示
  （`pointer-events: none`，不挡手势/卡片）；按钮层（`SUMMON_BTN` 200）在卡外两侧，
  **禁止卡片横贯全宽**——双 backdrop-filter 垂直叠加在移动端合成异常会致按钮视觉消失
- 十个信息面：余额卡 / 信箱+星轨双框行 / 待办卡 / SYS 监控面板 / 脉搏卡 / 执勤卡
  / 权限审计横条（待办下全宽）/ 角色卡关系面板（左列，2026-08-09 定稿：环形
  弦图·外角色内文件·双环对转）——逐轮定稿细节 → ./detail-obs-hud.md
  （巡逻健康+token 图同日实拍反馈删除，腾空给关系面板）
- 动态徽标：`src/client/modules/obs-emblem.ts`（深蓝意志 logo，同域同装配链，
  几何随 placeRail 注入；A 聚散定稿为**两节点中点闭合二次 B 样条巡游 +
  矩阵时刻**（成形位=两侧翼节点连边中点方向天然连续、两段 Hermite 计时
  谷底 0.1/0.5 倍速率、周期中点五套秩序模式随机闪现、引擎原地 resize
  防周期重启；2026-08-09 用户实拍裁决：留 A，B 潮汐/C 轨道取消，
  三画布收敛单画布）；**移动端降耗链**：DPR≤1.5 + 30fps 节流 +
  连线距离²比较 + **渲染批量化**（连线/粒子帧内 alpha 统一、颜色仅两桶，
  合并 path 后 2 次 stroke + 2 次 fill，~230 次绘制调用 → ~8；位置写入
  复用 posBuf 免逐帧分配；守视钩子 300ms 节流）+ **遮挡淡出淡入**
  （elementFromPoint 五点探测，遮挡时运动态播 opacity .9s 淡出后停绘、
  去遮挡先恢复绘制再淡入，**分向缓动**：淡出 ease-in 截长尾、淡入
  ease-out 铺满可见段（同 ease 观感淡入过短，2026-08-09 实测裁决）；
  半遮迟滞 ≥3/5↔≤1/5；粒子位置=当前时间纯函数故停绘零状态）；
  守视验证钩子 `__emblemDbg`（escape-ok 已标）；
  逐轮实拍细节 → ./detail-obs-hud.md 徽标节）
- **观测台高度纪律（2026-08-09 定稿）：全部面板高度钉死，当前满配即最大高度**
  ——星轨 TOP5+聚合轨恒 6 行（机器会话服务端过滤），cron/脉搏 TOP4/SYS 端口不足补隐形占位行
- **渲染纪律：数据未变不重渲染**（JSON key 比对）——innerHTML 重建重置滚动位、
  5s 一次等于自动翻屏页位乱跳（2026-08-06 守视实拍抓获）；变时保存/恢复 scrollTop

## GSAP 动画治理（2026-07-29 按 ADR-004 裁决二修订）

▎ 所有 GSAP 调用必须通过 animation-registry.ts
▎ 禁止直接 import gsap（构建时 scripts/check/check-anim.mjs 扫描白名单）
▎ anim.to/set/killTweensOf/timeline 直透是**官方用法**——需要停动画直接 killTweensOf
▎ scope() 是**按需**机制（现仅 tree-render 单租户）：需要一把 clear() 清掉本模块
  整组动画时才用；char-rain 实然也挂共享 ts scope，ts.clear() 会一并清除（重渲染时重建）
▎ card-stack / orb 的 GSAP 调用走 anim 工具方法

## #陷阱

1. **CSS 布局方程**：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex。
2. **Registry 配对规则**：新增交互元素必须 register + 加入 MANIFEST；state 运行时会变的
   （几乎全部）必须用 `registerElement()`（register + registerStateGetter 一次配对），
   否则 snapshot() 返回过时静态 state。
3. **notifyStateChange 覆盖**：只通知「变了」不传值，snapshot 靠 registerStateGetter 读实时态。
   漏调 → AI 看到的 snapshot 滞后。check-registry 验字段完整性 + 孤立 getter + 跨文件命令重复，
   notify 覆盖靠人工保证。
4. **`display:''` 是继承链杀手**：恢复显示必须显式写 `'flex'`/`'block'`——`display:''`
   会 revert 到 CSS 默认值。案例：2026-07-05 光球 SVG 偏移 ~6px，排查数小时。
5. **`endOp` 必须在早期 return 之前执行**（v6.11.0 已根解，再犯即回归）；
   动画锁 3s 兜底的不变量本体 → ../canvas-tree/contract.md 动画安全节。
6. **PointerEvent 统一**：所有触摸/鼠标输入必须走 gesture-registry 的 PointerEvent
   调度；禁止直接绑原生 `touchstart/touchmove/touchend`——两套事件系统在同一 DOM 上
   互相干扰，`pointermove` 被浏览器提前终止。案例：B.A.R. #001。
7. **touch-action 分层策略**：全局 `none`（body/.main/全屏覆盖层/自定义 Canvas 控件）；
   卡片内容区与浮卡外层 `pan-y`（原生垂直滚动 + 横滑透传全局手势）。
   内容区设 `none` → 无法滚动；全局 `auto` → 浏览器接管 → pointercancel 截断。
   **`touch-action` 是继承属性**（文档曾写反，B.A.R. #008 的诱因）。
8. **KFMState 批量修改必须合并一次 notify**：`setExpanded()` 每次调用都 notify 且受
   `L.isAnimating` 守卫；连续调用第二次可能被丢弃 → 幽灵 toggle + 动画断裂。
   批量修改用 `L.beginOp`/`L.endOp` 包裹，或确保空闲时执行。案例：2026-05-29 三连 setExpanded。
9. **拖拽残留状态禁止 if 守卫绕过**：拖拽残留（v7 的 _dragItem，已随重写消亡）的根解是拖拽生命周期由事件系统
   保证，不是在拖拽入口（v7 的 _startFloatingDrag）开头加 if 守卫清场（INVARIANTS §五迁入）。
10. **侧栏触摸区事件冒泡**：冒泡到 document 会误触发 GestureRegistry——
    侧栏交互注意事件边界的阻止/隔离（旧 CLAUDE.md 注意事项迁入）。

## Z-Index 层级（自 AI_CHAT_RUNTIME §九迁入，2026-07-28）

**产品决策（2026-07-19，commit `a5bf0c4`）**：焦点弹窗（L8, 10000+）**高于** AI 核心
（L7, 9000-9200）。理由：确认框/模态框一出现即代表用户正专注一次操作（如确认删除），
必须能盖住输入栏/发送按钮/光球，避免误触打断。

| 层 | z 值 | 内容 |
|----|------|------|
| L8 焦点交互 | 10000-10900 | action-bar / toast / 模态框 / 确认框 / 下拉 |
| L7 AI 核心 | 9000-9200 | 面板 / 输入栏 / 发送按钮 / 光球 |
| L6 终端交互 | 6400-6430 | 终端手柄 / 茎 / 放大镜 / 复制（卡片作用域） |

- **`CUSTOM_SELECT`(10900) 必须高于 `MODAL_DIALOG`(10800)**：下拉框常在模态框内部
  弹出（config/session/tools 卡的下拉都在弹窗里），低于模态框会被遮住。
- 全表见 `z-index-layers.ts` / `z-index.css`（`scripts/check/check-zindex.mjs` 强制 JS↔CSS 一致）。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `GESTURE_ARCHITECTURE_SPEC.md`：requireFailure 手势依赖方案（未采用——实际更简方案已落地）。

## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`src/client/modules/obs-hud.ts` `src/client/modules/orb.ts` `src/client/modules/obs-emblem.ts` `src/client/modules/gesture-registry.ts` `src/client/modules/ui-registry.ts` `src/client/modules/obs-roles.ts` `src/client/modules/custom-select.ts` `src/client/modules/orb-panel.ts` `src/client/modules/gestures.ts` `src/client/modules/confirm-dialog.ts` `src/client/modules/renderer-lifecycle.ts` `src/client/modules/state.ts` `src/client/modules/drag-handler.ts` `src/client/modules/app.ts` `src/client/main.ts` `src/client/modules/z-index-layers.ts` `src/client/modules/animation-registry.ts` `src/client/modules/ui.ts` `src/client/modules/version-watch.ts` `src/client/modules/logger.ts` `src/client/modules/card-toast.ts` `src/client/modules/click-queue.ts` `src/client/modules/dom-refs.ts` `src/client/modules/interaction-constants.ts` `src/client/modules/debug-assert.ts` `src/client/modules/orb-state.ts`
<!-- /gen:contract-list -->
