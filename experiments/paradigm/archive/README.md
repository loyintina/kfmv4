# archive/ · 归档说明（2026-08-07 paradigm 重组）

本目录存放研究线收官后的归档产物，不参与日常运行，check-experiment-registry 豁免。

## meta-pool-intermediates-20260807.tar.gz

打包了 meta-pool 下四个中间产物目录（共 1222 个文件）：

- `e16-blocks/`（1098 个切块）：e16 制包原料，可由 `tools/e16-cut.mjs`
  从 `meta-pool/e16-candidates.json` 重新生成；
- `e16-scores/`（44 个打分）：e16 候选纯度评分，合并版在
  `meta-pool/e16-scores-merged.json`；
- `density/`（17 个）：meta-density 词频粗筛中间产物；
- `episodes/`（63 个）：素材库 episode 中间产物。

解包：`tar xzf meta-pool-intermediates-20260807.tar.gz -C <目标目录>`

## legacy-answer-e7c-t0p4m2r1-haiku-64k.md

e7 实验单臂答案样本（考古留存，自 arm-artifacts/ 迁入）。

## tmp-experiment-leftovers-20260807.tar.gz

/tmp 下 53 个实验临时文件（71MB→18.6MB 压缩）：e13/e14/e16 一次性分析脚本、
e19 语料生产日志（r2/c4/c4b 全 15 个）、早期判卷脚本与结果快照（judge-*）、
exp 任务文件（exp1/1b/5/8-task.txt——**exp8-task.txt 是 e11 任务文件，
design/history-e1-e16.md 引用了它**）、px-g25-retry.sh、px-scenario.txt、
judge-sessions/ 目录。对应实验均已收口，数据在 arms.db 与 results/ 文档。

解包：`tar xzf tmp-experiment-leftovers-20260807.tar.gz -C <目标目录>`
