# flash 标定实验 #1：面板通道召回/误报/并发实测（2026-08-04）

> 实验线：semantic-compiler 便宜模型哨兵层（用户拍板方向）。答卷（30 臂会话）
> 在 ~/.kfmv4/sessions/script/bi-r1/r2/tt/ct/cs-*（私有区），本文件只存结论。
> 复现：`node experiments/paradigm/tools/batch-run.mjs --task-file <任务> --prefix <pfx> --arms 6 --concurrency 8` + `bench-score.mjs --arm <臂>`

## 实验设计

- **通道**：面板通道（session-runner/batch-run → /ai/chat/start → kfm 工具流 → SSE → 落盘 sessions/script/）
- **模型**：deepseek-v4-flash @ Opencode Go Google（现役便宜链首）
- **工具**：只读白名单 read,grep,glob（禁 bash/write 副作用）
- **任务形态**：声称注入式——每条任务 = 目标文档若干声称（1 条假 = 变异基准替换版 + 2-3 条真），agent 用工具核实后按 JSON 契约输出不符项
- **对分**：bench-score.mjs，hitMutation 文件+行 ±5（与 semantic-bench 同源），已机械化变异（M03/M05/M13）移出考卷
- **样本**：5 任务 × 6 臂 = 30 臂

## 成绩单（注入靶点口径）

| 任务 | 靶（假声称） | 召回 | 误报 | 格式纪律 | 失败臂 |
|------|------------|------|------|---------|--------|
| readme-v1（现状 prompt） | M01「36 个 check + 499 测试」 | 5/6 | 0 | 5/6 | r0 无输出 |
| readme-v2（强制逐条判断） | M01 同 | 5/5（有效臂） | 0 | 5/6 | r5 文件损坏 |
| testing | M11「420 个测试」 | 3/6 | 0 | 3/6 | r1/r4/r5 空 text 收尾 |
| canvas contract | M18「colors.ts 幽灵」 | 6/6 | 0 | 6/6 | — |
| shell contract | M20「50dvh」 | 6/6 | 0 | 6/6 | — |

> ct/cs 的 [M18,M19]/[M20,M21] 为 ±5 容差相邻锚双中（同文件 line 8/10、68/69），
> 实际注入靶 = M18/M20（M19/M21 未注入，不计）。

## 结论

1. **误报 = 0（30 臂全零）**——真声称零冤枉。flash + 工具 + 声称注入的精确率极好，
   「宁缺勿滥」契约执行到位。这是哨兵层可用的前提。
2. **召回按形态分化**：符号 ghost（colors.ts）与常量值（50dvh）6/6 满分——grep 实锤
   即判，flash 强项；计数类（36/499、420 个测试）3/6~5/6——需要"数全 + 口径对齐"
   （tt r2 实测 509 处 vs sync-counts 口径 503，口径差异致犹豫）。
3. **v2（强制逐条判断）vs v1**：readme 有效臂 5/5 vs 5/6——方向偏好，样本不足以定案。
4. **三失败模式**：
   - 工具循环后空 text 收尾（tt ×3）：flash 调完工具不输出最终答案——格式纪律
     3/6 的直接原因。哨兵层需要"答案缺失即重跑/标记"兜底。
   - 会话文件损坏（r2 r5）：服务端多轮 flush 竞态疑似（Extra data at line 421）——
     潜在真 bug，待登记（bar/排查）。
   - 并发 40 时 terminated（4/6）：通道上限实测，见下。
5. **并发实测**（面板通道）：40 并发 2/6（67% 失败）；8 并发多次全绿、双任务并行
   16 并发一次全绿一次 4/6+5/6（间歇 ~10-20% 失败率，断点续跑可兜）。**安全档位
   8-16，40 不可用**。算力带得动，8021 通道 + provider 上游是瓶颈（与 agent-runner
   直连 provider 的 conc60/80 全绿形成对照——面板通道上限显著更低）。

## 下一步候选

- 修"空 text 收尾"：任务 prompt 加「工具调用完毕必须以 ```json 输出最终答案」+
  batch-run 对无答案臂自动重跑（断点续跑已具备）
- 计数类形态：喂 sync-counts 口径（声称引用官方计数来源），降口径犹豫
- 会话文件损坏：走 BAR 登记 + 排查 session-store flush 竞态
- 扩大：paradigm 对照（evidence-discipline 规则包 vs 无）——纪律注入能否压"空 text 收尾"
