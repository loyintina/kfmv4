---
title: "KFM v4 Design Language"
version: "0.1-draft"
generated: "2026-09-05"
generator: "create-design-md repo 模式（证据管道：role→value→source→scope→recurrence→confidence）"
export: "dtcg-compatible tokens"
status: "草案（评审 2026-09-06 已裁决通过，附三条落地条件：机检骨架/Gaps 供应商标注/入口接线；check-design-tokens.mjs 落地前保持草案）"
---

# KFM v4 DESIGN.md — 视觉宪法（草案）

> 这是什么：kfmv4 客户端视觉语言的单一事实源。记录**治理语言**（规范 token 与其证据），
> 不记录代码里碰巧存在的值。任何编码 agent 在本仓库产出 UI 前，先读本档。
> 证据来源仅限被产品引用的治理文件：`theme.ts`（Nebula 主题）、`z-index-layers.ts`（层序宪法）、
> `interaction-constants.ts`（交互常量）、`base.css`（输入栏）、各模块 cssText（经复现确认）。
> 边界：本档不引入第二套 token 体系；与 `docs/` 冲突时以代码证据为准并回写本档。

## 1. 定位

深空影院向的暗色单主题系统。情绪关键词：星云、辉光、毛玻璃、渐变描边。
双强调色体系：**青 (#00d4ff) = 交互/信息**，**紫 (#7c3aed) = 品牌/AI**——两者成对出现
（渐变描边 135deg 青→紫），是全站品牌一致性的锚。

## 2. Color

```yaml
color:
  bg:
    base: "#0a0a0f"            # theme.ts bg；网格底纹叠加紫色 12% 线
  surface:
    panel: "rgba(20,16,32,0.92)"    # theme surface.bg — 面板/卡片/浮卡
    light: "rgba(10,10,15,0.85)"    # surface.bgLight — 用户气泡/顶栏
    lighter: "rgba(10,15,30,0.88)"  # surface.bgLighter — AI 气泡/工具卡
  ink:
    primary: "#e0e0e0"              # 全站正文
    secondary: "rgba(224,224,224,0.55)"
    tertiary: "rgba(224,224,224,0.35)"   # 注脚下限；做正文即违规
  accent:
    cyan: "#00d4ff"                 # 交互/信息侧
    purple: "#7c3aed"               # 品牌/AI 侧
    indigo: "#6366f1"               # 过渡中间色
  semantic:
    success: "rgba(0,212,115,0.8)"
    error: "rgba(255,100,100,0.8)"
  card-accents: 7 色星谱（theme.ts cardAccents，#B46478/#C88C5A/…）——卡片身份色，按卡分配
```

判据：强调色稀缺（一屏一处重点）；35% 以下透明度只做注脚；深色禁纯黑纯白；
语义色不倒置。缺口：success/warning/info 语义四件套未成体系，error 值存在但散落。

## 3. Typography

```yaml
typography:
  sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei"
  mono: ui-monospace, Menlo, monospace
  size:
    base: 14px                # 正文
    card: var(--card-font-size, 11-13px)   # 卡内文字；pinch 手势全局缩放（8-20px），localStorage 持久
    panel-title: 11px/600     # 面板标题
    bubble: 13px              # 消息正文
  line-height:
    body: 1.5-1.8             # 中文取高值
    title: 1.2-1.3            # 紧＝有力
```

判据：字号从字阶取（12/14/16/20/24/32）；层级表达字重 > 颜色 > 字号；一屏 ≤4 层。
缺口：**tabular-nums 未启用**——token/消息计数等变值数字宽度抖动（已立改进项）。

## 4. Spacing & Layout

```yaml
spacing:
  base: 4px                   # 一切间距的公约原子
  scale: [4, 8, 12, 16, 24, 32, 48, 64]
  screen-margin: 8px          # interaction-constants MARGIN
  panel-padding: 12-14px      # 面板内容区实测值
```

判据：组内间距 < 组间间距（亲密性梯度）；正文行宽 30-45 中文字；敢留白——
框线是打折的间距。缺口：无 token 化间距变量（散落字面值已收敛在刻度上，但未命名）。

## 5. Radius & Border

```yaml
radius:
  panel: 12px                 # 面板/浮卡
  bubble: 8px                 # 消息气泡/工具卡
  button: 6-7px
  small: 4px
border:
  signature: "1px transparent + 渐变描边（padding-box/border-box 双背景）+ border-left 3px 强调"
```

签名描边是全站识别特征：卡壳用 padding 挤出 1px 渐变边（左缘加重 3px），
面板、气泡、工具卡、下拉全部同构。

## 6. Elevation（层序宪法）

```yaml
elevation:
  registry: z-index-layers.ts（唯一真相源，CSS 侧 :root 镜像，check-zindex.mjs 校验）
  layers: L0 网格 10 → L1 内容 100/200 → L2 全屏 1000 → L3 浮卡 2000+ → L4 卡堆 3000+
          → L5 文件树 3900-4800 → L6 终端 6400-6430 → L7 AI 核心 9000-9250
          → L8 焦点交互 10000-11000
  invariants: 每层留 1000；层内 BASE+序号递增不越界；item.zIndex === el.style.zIndex
```

## 7. Motion

```yaml
motion:
  duration:
    press: 90-100ms           # 按压反馈
    enter: 200-260ms          # 入场（响应档）
    panel: 300-400ms          # 面板/浮卡展开（移动档；全局档 400-500 为上限，甜点区 300-400）
    exit: 180-200ms           # 退场快于进场
  easing:
    press-respond: ease-out / back.out(k)     # 响应用户默认；k=过冲量（1.1 高频 / 1.3 低频）
    system-move: ease-in-out / power2.in-out  # 系统自主移动
    exit: power2.in / back.in(1.3)
    loop: ease-in-out infinite                # 摸鱼提示 1.2s 脉冲＝教科书 Pulse
  spring: "back.out 为假弹簧（无速度继承）；真中断需求（甩动滑走）待接真物理——挂账"
  loop-rule: 携带信息 + 周期 1-2s + 有停止条件，三者全占才配循环
  reduced-motion: "未接入 prefers-reduced-motion——挂账"
```

性能纪律：只动 transform/opacity（合成层）；永不动画布局属性；拖拽期挂起
backdrop-filter（PANEL_BLUR 8px / 卡 16px / 输入栏 12px 的每帧 GPU 重合成是卡顿主因）。

## 8. Principles（七条）

Purposeful（定位/反馈/关系，全不占别动）· Perceived performance · Frequency of use
（看得越多越短越含蓄）· Spatial consistency · Reduced motion（待接入）·
Hardware acceleration · 打磨最后做（tabular-nums/ticker 等属于最后 10%）。

## 9. Gaps & 挂账（评审议程）

1. tabular-nums 未启用（数字宽度抖动，用户真机抓过）
2. prefers-reduced-motion 未接入
3. 下拉面板瞬现，无 origin-aware 入场（custom-select openPanel）
4. 拖拽无惯性释放（"甩一下滑走"）
5. 危险操作确认框覆盖率未验证；h-dvh 替换 h-screen 未执行
6. 语义色四件套未成体系

## 10. Evidence Index

| 值 | 来源 |
|---|---|
| 色板/描边/辉光 | theme.ts:157-180, 200-224（Nebula） |
| 面板壳 | orb.ts:130-145（createPanel cssText） |
| 浮卡壳/模糊 | floating-card.ts:34, 259-268 |
| 输入栏 | base.css:84-98（blur12/border-image 对照组） |
| 层序 | z-index-layers.ts:31-105 + z-index.css 镜像 + scripts/check/check-zindex.mjs |
| 交互常量 | interaction-constants.ts（MARGIN 8 / LONG_PRESS 600 / DRAG 15 / 240×288） |
| 状态机 | floating-shared.ts:11-28（8 态）+ tests/floating-state.test.ts |
| 投影管线 | chat-dom.ts（SSE→增量 DOM，永不重建） |
