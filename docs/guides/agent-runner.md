> 这是什么：agent 脚本执行器（agent 原件形态 A）的设计与用法。
> 别的去哪找：语义层母体 → ../active/semantic-compiler-seed.md；检查管线 → ../domains/infra/contract.md；立项 → ../active/STACK.md #3。

# 指南：agent-runner（agent 脚本执行器）

**一句话**：把「固定提示词 + 机械组装输入 + 可验证输出」的独立任务做成可 `node` 调用的脚本——
agent 原件，不是 agent 应用。三明治：**机械组装输入 → agent 判断 → 机械验证输出 → 调用方（agent）消费**。

## 两种形态的分工

- **形态 A（本体系，scripts/agent/）**：独立脚本，洁净室上下文，可进 cron/管线，输出 exit code 语义。
  输入一律机械预装，原件不带工具（可控性来源）。
- **形态 B（存量）**：提示词文件由 agent 执行（workflows/ 卡 + subagent）——交互式、需要工具的任务。

## 输出协议（调用方 = agent，不存在「人工兜底」，兜底是会话间接力 agent）

- **exit 0**：输出精确（schema 校验通过），机械流程直接走
- **exit 1**：重试耗尽的模糊输出——原始结果抛 stdout，调用方读了自己判断（与读 subagent 模糊汇报无异）
- **exit 2**：全 provider 失败——errors 抛 stdout
- 未来自主触发（cron 无 agent 在场）才需要邮箱位（STACK 拾取），当前调用方永远在场，不设

## provider 兜底链

`providers.config.json` 有序列表：Kimi/kimi-for-coding-highspeed → deepseek/deepseek-v4-flash →
阶跃星辰/step-3.7-flash。key 从 `~/.kfmv4/providers.json` 按 id 读；调用失败自动落下一个；
可选 `params` 覆盖请求参数（如 kimi-for-coding 系只允许 temperature=1）。
未来前端设置卡负责该链的可视化编排 + key 健康状态（STACK #3 配套）。

## 输出可控性

不靠参数压制，靠**校验+重试**：`validate(text)` 返回 data 或 null，null 则带错误反馈重问
（同 provider，默认 2 次）。多余文字会被 schema 校验当场打回——编译器报错的同一反射回路。

## 触发三层（一号负载实例）

1. **机械雷达**：`check-release-radar`（check 链第 28 个，warning）——commits≥30 或 feat≥10 提醒，
   阈值经 14 历史版本对论证；职责是「不忘」
2. **agent 判定**：`node scripts/agent/tag-advisor.mjs`——语义判级别 + 起草 release note
3. **人拍板**：tag 是 git mutation，永远人工

## 测试协议（agent 脚本投产前必过）

1. **回放测试**：历史版本对 = 黄金集，`node scripts/agent/test-tag-advisor.mjs [近N对]`，
   一致率 ≥70% 进影子模式（分歧样本是 prompt 调优输入，不必然是错——历史发版本就不规范）
2. **否定测试**：周期中段切片须「忍住」（测不发版的判断力）
3. **影子模式**：建议归建议，决定归人，分歧记 `ledger/tag-advisor-shadow.md`
4. **投产仍只产建议**：mutation 类动作永远人拍板

> tag-advisor 回放实录（2026-07-29，三轮）：47% → 57% → 61%（原始）；
> 调整后 83%（豁免类：major 提交清单无信号 5 例 + v6 小窗历史标级松 3 例）。
> 剩余 6 例「细化归 patch」顽固分歧中部分实为历史错标——继续调 prompt = 拟合噪音，转影子模式由真实世界裁决。

## 新负载如何加

1. 在 scripts/agent/ 下写新脚本（参照 tag-advisor.mjs）：`runAgent({ system, prompt, validate })`，输入机械组装
2. 需要新触发位 → 对应 check/钩子挂提醒（雷达模式）
3. 走测试协议四段再投产
