> 这是什么：引擎层（Box→Canvas 2D 渲染 + 文本排版）14 文件清单与依赖图。
> 别的去哪找：文件树业务逻辑 → contract.md；完整历史架构 → git show 旧 docs/archive/design/ENGINE_ARCHITECTURE.md。

# 引擎层细节

## engine/v2 — Canvas 渲染引擎（8 文件）

`renderer.ts`（渲染器主类）· `box.ts`（Box 数据结构：树节点+事件/布局/绘制）·
`types.ts`（40+ 类型定义）· `BorderDrawer.ts`（8 段圆角边框）· `flex.ts`（Flex 布局）·
`StyleConfig.ts`（边框/辉光/背景样式）· `animation.ts`（纯缓动）· `utils.ts`（间距工具）

## engine/text-layout — 文本排版引擎（6 文件）

`line-break.ts`（行断引擎，CSS white-space 语义）· `layout.ts`（公开 API：
prepare → layout → walkLines）· `analysis.ts`（Intl.Segmenter/CJK/标点）·
`measurement.ts`（文本测量，含 emoji 修正）· `bidi.ts`（双向文字元数据）· `index.ts`（桶导出）

## 依赖图（单向）

```
types / StyleConfig（纯数据）→ utils / animation（纯工具）→ box（核心结构）
  → flex / BorderDrawer（布局/绘制）→ renderer（集成中枢）
```

- **唯一反向耦合**：`engine/v2/renderer.ts` → `modules/theme.ts`（currentTheme）。
- 其余 13 个引擎文件零项目导入，完全自包含——可独立测试/替换。
