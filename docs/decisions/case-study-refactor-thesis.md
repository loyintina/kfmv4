> 这是什么：案例详注——原始愿景蓝图（REFACTOR_THESIS_FULL，784 行）与现实的对照，及被证伪/被证实的设想。
> 别的去哪找：现行远景 → ../active/vision.md；演化史 → ../ledger/history.md。
> 原文已注销（2026-07-29），考古：git show v8.1.1:docs/archive/design/REFACTOR_THESIS_FULL.md。

# 案例详注：REFACTOR_THESIS_FULL（原始蓝图对照现实）

原始愿景蓝图（2026-05，VISION_AND_ROADMAP 的前身，被其 supersede）。
784 行中只有一部分设想活到了 v8——对照如下。

## 被证实的设想（活到了现在）

| 蓝图设想 | 现状 |
|---------|------|
| 一切皆盒子/卡片，用户与 AI 对称操作 | vision.md 第一章核心，已实现（插件系统 + kfm 工具族） |
| GSAP 独占动画引擎 | 不变，animation-registry 隔离（client-shell 硬规则） |
| Pretext 零 reflow 文本测量 | 不变 |
| 移动优先（无主页面、侧栏/光球收起） | 不变，vision.md §一.5 |
| 侧边堆叠卡片手势协议（左滑唤出/上下滑选/左滑扔入） | card-stack.ts 按此实现，协议逐字落地 |
| 标记系统「手机端必须显式标记」理念 | vision.md §一.6（理念保留，未实装） |

## 被证伪/被替换的设想

| 蓝图设想 | 现实 |
|---------|------|
| LeaferJS Canvas 框架 | 从未引入——自研 kfmv3 v2 引擎（Box→Renderer）一路用到 v8 |
| Yoga Layout（WASM） | 从未引入——自研 flex.ts 244 行备用 |
| DOM Island（DOM 浮在 Canvas 上） | 未采用——实际是「DOM 卡片 + Canvas 文件树」两域分离（adr：决策 2.2） |
| 盒子协议 BoxDefinition/Action/BoxContext 接口 | 未按此实现——AI 能力实际走 kfm 工具族 + Registry snapshot（眼睛系统） |
| 中央画布（连线/工作流编排/持久化） | 未做——工作台网格停留在「放卡片的空间」 |
| CodeMirror 编辑器盒子 | 未做——文件卡预览/编辑走自研 renderers |

## 教训

1. **第三方框架洁癖被证实**。蓝图中两个最大的技术赌注（LeaferJS/Yoga）都没引入，
   自研引擎反而成了最长寿的决策——v2 引擎从 2026-05 活到 v8 仍是渲染核心。
   「五技术各司其职」最终变成「三自研 + GSAP + Pretext」。
2. **愿景文档的演化是健康信号，不是失败**。784 行蓝图被 893 行 VISION 取代、
   VISION 再被 v8.2 迁移拆分成 vision.md——三层演化中核心理念（一切皆卡片/
   对称操作/移动优先）一字未变，变的是技术路径。理念稳定 + 路径演化 = 愿景
   文档的正确生命周期。
3. **未实现的设想要留考古钩**。标记系统的完整设计（两种标记模式/操作流示例/
   移动端优势论证）只存在于原文——vision.md §四.1 标记系统若实施，先
   `git show v8.1.1:docs/archive/design/REFACTOR_THESIS_FULL.md` 挖「共享上下文
   设计 — 标记系统」节，不要重新发明。
