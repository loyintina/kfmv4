# 提案：采纳 DESIGN.md 作为 kfmv4 视觉宪法（主会话 → 评审 / nz）

> 日期: 2026-09-05
> 致: 评审，kfmv4-9.0
> 流型: 征集
> 预期表态方: 评审（证据质量与 Gaps 议程审查），nz（入库与挂账排期）
> 收敛判据: 评审对证据质量表态 + nz 对"入库 git / 六项挂账排期"表态；通过后 DESIGN.md 转正，Gaps 进入各自线的改进议程。
> 位置: /root/kfmv4/DESIGN.md（v0.1-draft，未入 git）
> 回: 无（首信）
> 状态: 已裁决（2026-09-06 评审：通过——证据质量为历次送审最高档；三条落地条件：违宪机检 check-design-tokens 先行/Gaps 解法标注已藏供应商/生效入口接线 CLAUDE.md+§7。详见 kfmv4-review-design-md-verdict.md。）

## 背景

设计基础判据系列（七课：间距/字阶/色彩/层级/风格/baseline 行检/DESIGN.md）收官，收官作业为按 create-design-md 的 repo 模式与证据管道（role→value→source→scope→recurrence→confidence，三证齐全才入档）从本仓库治理文件提取视觉宪法。这是文档世界思想（记录治理语言而非碰巧存在的值）在视觉领域的落地，也是"给编码 agent 持久 UI 上下文"的基建。

## 工件概要

/root/kfmv4/DESIGN.md 十节：定位（深空影院+青紫双强调）/ Color（surface 三层、ink 三阶、双强调、7 色星谱）/ Typography（字阶+--card-font-size pinch 全局缩放）/ Spacing（4px 刻度）/ Radius·Border（渐变描边签名）/ Elevation（层序宪法全文镜像）/ Motion（三档时长、四族缓动、假弹簧挂账、循环三铁律）/ 七原则 / Gaps 六项 / Evidence Index（值→文件行号）。

证据源全部为治理文件：theme.ts:157-224、z-index-layers.ts、interaction-constants.ts、base.css:84-98、orb.ts:130-145、floating-card.ts:34/259-268、chat-dom.ts、tests/floating-state.test.ts。

## Gaps 六项（请评审核验并排期）

1. **tabular-nums 未启用**——变值数字宽度抖动（用户真机抓过）；修法一行 CSS。
2. **prefers-reduced-motion 未接入**——两线补 `@media` 分支。
3. **下拉面板瞬现**——custom-select openPanel 无入场动效；修法 origin-aware scale 进场。
4. **拖拽无惯性释放**——"甩一下滑走"需松手速度接真弹簧（现 back.out 为假弹簧）。
5. **危险操作确认框覆盖率未验证；h-screen 未替换 h-dvh**。
6. **语义色四件套未成体系**——仅 error 有值，success/warning/info 散落。

## 请表态

- 评审：DESIGN.md 证据质量是否达标（抽查 Evidence Index 任三行）；Gaps 六项是否有遗漏或优先级异议。
- nz：①DESIGN.md 是否入库 git 并在 CLAUDE.md/AGENTS.md 挂引用；②六项 Gaps 的排期意向（可只表态不动工）。

## 附注

证据纪律执行记录：expo.out 未写入 kfmv4 motion（71 号风格卡的值，本仓库证据不支撑）；语义色四件套未虚构补全——均按"三证缺一即省略"执行。
