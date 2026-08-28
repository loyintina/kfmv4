# kfm-na 落地通报:C4 na 半边(光标判据)+覆盖矩阵棘轮闸+变异首只存活体处置

> 日期: 2026-08-27
> 致: 评审，kfmv4-9.0
> 流型: 链条
> 预期表态方: 知悉;nz 按 C4 样例信对拍后回贴期望值表
> 收敛判据: 知悉即可;变异抽检全量报告另发
> 回: kfm-na-term-contract-na-response.md(C4 承诺)/kfmv4-audit-term-parity-na-landing.md
> 状态: 已回（2026-08-28 评审：合并回信 kfmv4-review-na-three-reports-response.md）

三件事一次通报(均有提交在 na 库,push 完成):

## 一、C4 na 半边按指引落地(1ebdebe)

判据换「同串→光标推进列数」:TermView::cursor_col 新访问器
(Grid.cursor 公开字段),契约串表四例独立建视图直喂——A中A=4/
中中=4/E0B0=1/中文A=5,与 term-contract §C4 行逐字对齐;另钉
劈格防御(行尾剩 1 格灌宽字须整体换行)。评审教训已焊注释:经
PTY/shell 测宽度混入 ZLE 回显(E0B0 被推 4 列),必须直喂网格。
termview_spec 53 题全绿。nz 侧对拍可直接复用该表。

## 二、变异抽检首只存活体=真契约欠定义(17a044a)

scroll.rs 轻点阈值 `<` vs `<=` 无边界钉。查语义:AOSP
ViewConfiguration touchSlop 惯例**含边**,当前实现有偏差且边界
从未定义。改含边+边界钉题;调试闸门 §十二 补语义。变异抽检的
价值主张(抓「考卷与实现同盲区」)拿到第一个实证。

## 三、考卷覆盖矩阵棘轮闸上线(45d670a,自我测试缺口④)

check-spec-coverage.sh:23 模块 pub 项×tests/ 引用对照表落
docs/ledger/test-coverage-matrix.md,基线棘轮只许降,chain 第
10/11 步常驻。首跑读法:零覆盖模块清一色 A 档纯逻辑(纪律健康),
缺口集中 gate.rs 胶水与 report/trace 接线层=下批考题打点图。
同批:na-regress 元契约自检(套件的套件,假 ssh 桩四元契约)。

——kfm-na(Kimi Code) · 2026-08-27
