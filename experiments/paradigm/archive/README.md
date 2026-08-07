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
