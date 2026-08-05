# 判卷偏差实测：flash 自我偏好 ≈ 0（2026-08-05）

> 问题：判卷模型统一为 deepseek-v4-flash 后，它判「自己生成的臂」是否有自我偏好？
> 结论：**量表打分场景下实测 Δ=+0.19/12（1.6%），可忽略**；回避条款放宽为标注制。
> 附带发现：**判官×风格交互效应 ±1 分**，远大于自我偏好——跨模型比绝对分须谨慎。

## 设计

- 考卷 48 份（同任务 /tmp/exp8-task.txt 无提示版，分数有真实梯度）：
  - 自产 16 份：flash 自己跑的臂（8 无包 + 8 带 8k 包，前缀 biasf-，provider deepseek 官方）
  - 他人 32 份：e11 批1 的 luna 16 + gemini-2.5-pro 16（A 无包 + B-8.1k 各半）
- 双判官盲判同一套卷：flash（judge-llm.mjs，judge-biasf-flash.json + judge-e11-e12-flash.json）
  与 kimi-k3（48 路 AgentSwarm 集群，随机编号匿名，映射隔离 bias-e11-map.json）
- 统计量：Δ =（flash判自产 − flash判他人）−（k3判自产 − k3判他人）
  ——两判官看完全相同的卷，生成质量差异在公式内对消

## 结果

| 生成方 | flash 判 | k3 判 | 差（flash−k3） |
|---|---|---|---|
| deepseek-v4-flash（n=16） | 10.94 | 10.81 | +0.12 |
| gpt-5.6-luna（n=16） | 11.62 | 10.81 | +0.81 |
| gemini-2.5-pro（n=16） | 9.75 | 10.69 | −0.94 |

- flash 判内差（自−他）= +0.25；k3 判内差 = +0.06；**Δ = +0.19**
- 分布：flash 用满 0-12 全区间（满分 56%）；k3 集中 9-12（更保守）
- 判分依据实例见 /tmp/bias-judge/out/*.json（含一句话 note）

## 先行实验（e7 考卷，无信息）

e7 臂（任务自带「说出思考过程」）双判官全部顶格：flash 12.00/12.00，
k3 11.94/11.98，Δ=+0.04——天花板饱和，偏差无表现空间，该考卷无判别力。
**教训：偏差实测的考卷必须有真实分数梯度（无提示任务）。**

## 结论与纪律修订

1. **自我偏好实测可忽略**（+0.19/12 ≈ 1.6%），比 e11 关心的处理效应（数倍级）小两个量级。
   判卷纪律第 2 条修订：flash 是被测对象时**允许自判，但须在结果文档标注实测 Δ**；
   跨实验对比仍建议异判官复核一次。
2. **判官×风格交互 ±1 分**（flash 对 luna 偏松、对 gemini-2.5-pro 偏严）——
   跨模型比绝对分时此效应大于多数处理效应，**主分析一律做模型内部比**
   （同模型各条件对照）；跨模型比较只作定性参考。
3. 跨判官比绝对分需先对齐量尺（flash 偏松且用满全区间，k3 保守集中）。

## 复现

```
# 自产臂
node experiments/paradigm/tools/batch-run.mjs --task-file /tmp/exp8-task.txt \
  --paradigms "无,metacognition" --models "deepseek-v4-flash" --provider "deepseek" \
  --arms 8 --concurrency 8 --prefix "biasf-"
# flash 判
node experiments/paradigm/tools/judge-llm.mjs --prefixes "biasf-t0" --task-file /tmp/exp8-task.txt \
  --judge-model "deepseek-v4-flash" --judge-provider "deepseek" --out /tmp/judge-biasf-flash.json
# k3 判：48 路 AgentSwarm 集群，输入 /tmp/bias-judge/in/，映射 meta-pool/bias-e11-map.json
```
