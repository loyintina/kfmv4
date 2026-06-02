---
status: superseded
archived_at: 2026-06-02
---
# 堆叠卡片面板 — 交接文档

## 项目概览

**文件**: `/root/kfmv4/src/client/modules/card-stack.ts`
**技术栈**: 纯 DOM + inline CSS（和光球面板、AI 输入框同栈）
**渲染引擎**: Canvas v2 只用于文件树，不影响本模块

---

## 当前状态

### 已完成的
- [x] 全屏左滑手势唤出 (gestures.ts 第 100+ 行)
- [x] 右滑关闭
- [x] 垂直滑动切换聚焦卡片
- [x] 卡片只露 55%（peek 效果）
- [x] 无遮罩 overlay
- [x] 面板定位：改用 `right` 属性动画（放弃 `transform`）

### 边界技术验证（调试版本已确认）
- [x] 红色面板 + 绿色卡片 + 粉色边框 → 全部正确渲染
- [x] `padding-box / border-box` 三色渐变边框技术可用（和光球面板同款）
- [x] 卡片上的 `backdrop-filter: blur(12px)` 在 `right` 定位下正常工作

---

## 视觉目标

用户要的"暮光毛玻璃"效果：

| 视觉层 | 样式 | 参考对象 |
|--------|------|---------|
| **卡片背景** | 深色半透明底 + backdrop-filter 模糊 + 暮光氛围感 | 类似光球面板的深色毛玻璃，但带暮光色温（暖粉紫色调） |
| **卡片边框** | 三色渐变：前一个暮光色→自身色→后一个暮光色 | 和光球面板一样的 `padding-box/border-box` 技法 |
| **整体效果** | 深色毛玻璃卡片 + 浮在表面的亮色渐变边框 | 光球面板的配色逻辑，换成暮光谱系 |

> 核心矛盾：用户要**两张图叠起来的效果**——底层是深色毛玻璃（暗），上层边框是暮光渐变（亮）。不能是"同一个颜色以不同透明度呈现"。

---

## 已尝试的方案和失败原因

### 方案 A：RGB 均移 (±60/-50) — 边框可见，渐变不明显
```css
background: rgba(212,137,155,0.12) padding-box,
            linear-gradient(135deg, #FFC5D7, #D4899B, #A25769) border-box;
```
- **问题**：三个色值在同一色相上只是亮度变化，在 1-3px 薄边框上看不出过渡

### 方案 B：HSL 跨色相（相邻卡片色）— HSL函数有空，但边框消失
- 改用 HSL 计算更亮/更暗变体
- 首尾卡片用计算变体，中间卡片用相邻卡的实际色值
- **问题**：边框消失。后查出 padding 层用了裸 `rgba()` 而非 `linear-gradient()` 包裹，导致色值泄漏覆盖了 border-box

### 方案 C：加 `linear-gradient()` 包裹 padding 层 — 边框依然消失
- 修复了裸色值问题，padding 层改为 `linear-gradient(rgba(...), rgba(...)) padding-box`
- **问题**：padding 层透明度 12%，但 backdrop-filter 放在了卡片上，而父级 `.stack-panel` 用了 `transform: translateX()` 做滑动动画 → **父元素 transform 会破坏子元素的 backdrop-filter**（已知CSS限制）

### 方案 D：backdrop-filter 移到面板上 — 毛玻璃还是没出来
- 移除了卡片上的 backdrop-filter，放到面板上
- **问题**：面板本身无背景色（透明），backdrop-filter 计算了模糊但没有显色表面，所以视觉效果不可见

### 方案 E：改用 `right` 替代 `transform` — 当前版本
- 面板完全放弃 `transform`，用 `right:-300px` 做关闭态，`right:-135px` 做打开态
- 卡片加回 `backdrop-filter: blur(12px)`
- 背景透明度 12%
- **状态**：当前方案，部署中，用户反馈"不对"


## 关键 CSS 技术：`padding-box / border-box` 渐变边框

光球面板（可工作的参考）：
```css
background: linear-gradient(rgba(20,16,32,0.92),rgba(20,16,32,0.92)) padding-box,
            linear-gradient(135deg,rgba(0,212,255,.8),rgba(99,102,241,.7),rgba(124,58,237,.7)) border-box;
border: 1px solid transparent;
border-left-width: 3px;
border-radius: 12px;
```

卡片当前生成（格式相同）：
```css
background: linear-gradient(rgba(212,137,155,0.12),rgba(212,137,155,0.12)) padding-box,
            linear-gradient(135deg,rgba(212,137,155,0.85),rgba(212,160,128,0.85),rgba(201,176,122,0.85)) border-box;
```

**技术关键点**：
1. padding 层必须用 `linear-gradient(color, color)` 包裹，不能直接用裸 `color`
2. 三色必须跨**不同色相**才能在薄边框上可见（光球：青→靛→紫 对不同色相）
3. `backdrop-filter` 和 `transform` 不能同时存在于父子关系链上
4. 卡片背景透明度需在 12-20% 之间达到毛玻璃效果

---

## 待解决的问题

### 1. 背景与边框的视觉分离
目前卡片背景用的就是暮光色（如 `rgba(212,137,155,0.12)`），边框也是暮光色，两者"同色系不同透明度"，视觉上糊在一起。

用户要的是**光球面板那种感觉**：
- 背景 = 深色近透明毛玻璃（`rgba(20,16,32,0.92)` + blur）
- 边框 = 鲜艳的暮光三色渐变
- 两者有明确区分（深底 + 亮边）

**建议方向**：卡片的 padding 层改用接近光球面板的深色底 `rgba(20,16,32,0.6~0.9)` + `backdrop-filter: blur(12px)`，不直接用暮光色做背景。暮光色只出现在边框渐变中。这样边框在深色背景上会非常醒目。

### 2. 面板滑动动画的性能
`right` 属性动画不如 `transform` 流畅（触发 layout）。如果后续优化可考虑：
- 用 CSS `translate3d(0,0,0)` 在子元素上做硬件加速
- 或用 `clip-path: inset()` 替代 `right` 动画
- 最理想：找到让 `transform` 和 `backdrop-filter` 在父子元素上共存的方式（但当前无解）

### 3. TODO：点击卡片打开对应盒子
```typescript
// card-stack.ts 第 187 行
console.log('[card-stack] select:', card.id, card.name);
// TODO: 打开对应盒子
```

### 4. 琉璃 / 星云配色
设计文档在 `/root/kfmv4/STACK_CARDS_DESIGN.md`，包含另外两套配色方案。当前只实现了暮光。

---

## 调试技巧

- 用红色临时背景 `background:rgba(255,0,0,0.4)` 加到面板上可确认面板是否渲染
- 用绿色临时背景 `rgba(0,255,0,0.5)` 可确认卡片是否渲染
- 检查 `backdrop-filter` 是否生效：看元素背景是否有模糊效果
- 检查 border-box 渐变：观察卡片边缘是否有彩色边框
- 调试版本已在 2026-05-05 验证过：红面板 + 绿卡片 + 粉边框全部正确渲染

---

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/client/modules/card-stack.ts` | 卡片面板主逻辑 |
| `src/client/modules/gestures.ts` | 左右滑手势（全屏唤出/关闭） |
| `src/client/modules/orb.ts` | 光球面板（边框样式参考源） |
| `public/css/base.css` | 全局样式（注意 `touch-action:none`） |
| `public/css/z-index.css` | z-index 层级系统（卡片面板 610） |
| `STACK_CARDS_DESIGN.md` | 三套配色设计文档 |
