# KFM v4 忒修斯之船重构计划

## 核心原则
- 保持现有 DOM 树不动
- 每次只替换一个部件
- 出问题可快速回退

## 技术分工
- Pretext: 替换 DOM 文本测量
- GSAP: 替换 CSS transition 动画
- LeaferJS: 叠加 Canvas 效果层（连线、粒子）

## Phase 1: Pretext 文本测量
替换 ui.ts 中的 offsetWidth 测量
时间: 1天

## Phase 2: GSAP 光标动画
替换 cursor-highlight 的 CSS transition
时间: 1-2天

## Phase 3: GSAP 目录展开动画
替换叠叠乐的 setTimeout 动画
时间: 2-3天

## Phase 4: GSAP 名称盒子
替换 Web Animation API
时间: 0.5天

## Phase 5: GSAP 滚动居中
替换 scrollTo smooth
时间: 1天

## Phase 6: Leafer 连线层
DOM 上方叠加 Canvas 画连线
时间: 2-3天

## Phase 7: Leafer 粒子效果
连线上加流动粒子
时间: 1-2天

总计: 9-13天
