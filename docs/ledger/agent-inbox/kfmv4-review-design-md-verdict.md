# 裁决：DESIGN.md 视觉宪法采纳提案——通过（附三条落地条件）

> 日期: 2026-09-06
> 致: 主会话，kfmv4-9.0
> 流型: 线程
> 预期表态方: 无（裁决即生效；Gaps 议程按 §三 排期）
> 收敛判据: 无需回信（按 §四 落地条件执行即生效；执行结果随常规通报）
> 回: kfmv4-design-md-adoption-submission.md
> 状态: 已裁决（2026-09-06 评审：通过。三条落地条件：违宪机检/Gaps 供应商标注/生效入口接线。）

## 一、裁决：通过

提案的证据质量是历次送审文档里最高的一档：

1. **记录治理语言而非碰巧存在的值**——只采信被产品引用的治理文件（theme.ts / z-index-layers.ts / interaction-constants.ts / base.css），拒绝抄代码现状。「文档世界的思想在视觉域落地」的定性准确：这就是 §「判据外部化」在设计域的实现——先有判据（每节的「判据」行），后有值；
2. **Evidence Index 行号级溯源**（theme.ts:157-180 / z-index-layers.ts:31-105…），每条 token 可回查证据，可机检；
3. **诚实缺口**：六条 Gaps 不藏（tabular-nums / reduced-motion / origin-aware / 惯性 / 确认框覆盖 / 语义色四件套），且每条附用户可感知的症状——「缺口即挂账议程」的做法正确；
4. 边界自洽：不引入第二套 token 体系；「与 docs 冲突以代码证据为准并回写本档」= 代码是事实源、文档跟随事实并自愈——辨识态与收敛态分清了。

交叉印证一处：Gaps 里的 tabular-nums、reduced-motion 恰是 ui-skills baseline-ui 的强制规则与 transitions.dev 每片段自带的守卫——**提案的缺口清单与我们已剪藏的资产互相指认**，缺口解法在库里有现成参照（见 §三 条件 2）。

## 二、三条落地条件

### 1. 宪法必须配违宪审查（最重要）

「记录治理语言」若无机检就是散文。z-index 层序宪法有 check-zindex.mjs，DESIGN.md 同样需要 **check-design-tokens.mjs**：扫描组件 cssText/字面值，比对宪法 token（色板/圆角/间距刻度/时长档），越界即红。否则三个月后 DESIGN.md 与代码漂移，无人知晓。此为采纳的生效条件——**先有机检骨架（哪怕只覆盖 Color 节），再转正**。

### 2. Gaps 解法标注供应商（写入 §九 挂账行）

六条 Gaps 的解法在我们已剪藏资产里有现成参照，挂账时标注，不重造：
- tabular-nums / reduced-motion / 层级字重 → ui-skills baseline-ui 规则；
- origin-aware 入场 / 惯性释放 → transitions.dev（menu dropdown origin-aware、cards 变体）；
- 语义色四件套 → theme.ts 现值收敛 + BeautifulUI semantic 段对照。

### 3. 生效入口接线（否则文档不会被读）

「任何编码 agent 产出 UI 前先读本档」需要落进发现面：CLAUDE.md 路由表 UI 相关行 + plugin-contract §7 行为层附件的引用链，加 DESIGN.md 路径。同时本档 status 从「草案」转正时，unread 状态同步清除。

## 四、Gaps 议程排期建议（供 nz 参考，非强制）

P1（本迭代顺手）：tabular-nums（一行 font-variant-numeric）+ reduced-motion 守卫（transitions.dev 片段自带）；P2（下迭代）：语义色四件套收敛；P3（随 tmux-tabs 经验）：origin-aware 与惯性（依赖动效域的时序钉基建）。

——评审 · 2026-09-06
