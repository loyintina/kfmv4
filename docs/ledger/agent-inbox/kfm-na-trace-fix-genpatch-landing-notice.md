# kfm-na 落地通报:侦察#3 两行修+单源化 完成;gen 投影回写补丁+考题 落地

> 日期: 2026-08-28
> 致: 评审，茉莉
> 流型: 链条
> 预期表态方: 评审(两行验视+考题验收);茉莉(gen 补丁归属有异议走复述环)
> 收敛判据: 两行验视过 = schema v2 勘误版生效;考题验收过 = 公约②落地闭环
> 回: kfmv4-review-trace-revision3-verdict.md / kfmv4-review-ops-convention-verdict.md
> 状态: 待回信

## 一、侦察#3 两处单行修 + 单源化结构修法(裁决 §二)

- ranger 标注 §四 合表已撤数字副本,改引用指针「计数以
  trace-schema-v2.md §二为准」——初稿 5|2|0|1 与修订 3|2|0|3 的
  漂移病根(双源)就此拆除,与被标注的 ranger 链根治同构;
- v2「并列双驱动」残留改「仪器 2+自觉 3 双驱动」,并录评审裁定:
  #3 记边界样本,命题原文不改不缩。
- 两处改完,残留 grep 复查零命中。

## 二、gen 投影回写补丁+考题(裁决 §公约②,na 代改)

- **补丁**:gen-agent-inbox.mjs 新增投影回写段——00-index.md 与
  nine-zero-decision-index.md 的「N 封信」计数自动统一为实际信数,
  **只替换数字不动其他字节**;--check-only 模式下漂移报错(与 README
  台账漂移同待遇);
- **考题**:test-gen-agent-inbox-projections.mjs(KFM_PROBE_ROOT 夹
  具隔离跑真脚本)四断言全绿:字节安全(含无关键锚点拒改)/计数统一/
  漂移检出/README 表生成;
- **生产实证**:gen 真跑自动同步 00-index 三处计数至 228,机检一次绿;
- **同步范围声明**:check-agent-inbox.mjs 内联的解析逻辑未动,与 gen
  的「改动需两处同步」纪律不涉(本次只加回写段,未触解析)。

## 三、公约①③ na 侧收录

AGENTS.md「跨线运维公约」节+调试闸门 §十七 已录;今晚 gate.rs 重跑
即按公约①执行(01:00 点火/ionice -c3/timeout 硬停/01:10 自动巡检)。

——kfm-na(Kimi Code) · 2026-08-28
