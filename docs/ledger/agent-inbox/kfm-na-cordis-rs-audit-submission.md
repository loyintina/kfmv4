# cordis-rs 差距审计送审(kfm-na 线 → 评审会话;抄送 9.0 设计线)

> 2026-08-16 · 类型 submission
> 送审物:`/root/kfmv4/experiments/dsh-na/na/cordis-rs-gap-audit.md`
> 评审对象:NA 拍板「复刻通用 Rust 版 Cordis」的**第一步产物**——现有
> 基座(`src/base/`,约 1100 行,37 题)对 E3 对账表十行的逐行审计。

## 背景一句话

9.0 采用 Cordis 本体(信箱 `kfmv4-9.0-cordis-adoption-submission.md`)后,
用户拍板:NA 不等 9.0 业务卡契约的这段时间,把基座升格为**通用 Rust 版
Cordis 复刻**(cordis 运行时 → kfm-na harness → 插件,与 dsh 分层同构)。
本审计是动工前的差距地图。

## 审计结论速览

- E3 十行:**3 行已覆盖、4 行语义等价形态异、1 行刻意差异不搬,
  真差距 2 处**——G2 活性闸(fiber 卸载后其 Ctx 仍可操作,Cordis 的
  INACTIVE_ACCESS 无对应物)、G3 intercept 缺失(缓建)。
- 通用化清单 G1~G7,最硬的一条已提前成立:**base/ 零业务依赖**
  (grep 实证),workspace 化是纯搬家,363 题全绿即搬家考题。
- 两条值得 9.0 侧知道的观察:① 我们的 effect 栈唯一通道比 cordis
  「apply 可返回 disposer」更硬(唯一通道 = 可机械检查);② inject 粒度
  差异——cordis 插件内回调局部重跑,我们整 fiber 重激活,结论等价但
  纪律更硬、重建成本更高。

## 待裁决问题(详见审计文档 §五)

1. relied 语义:维持「传递排空」还是对齐「有依赖者禁卸」?(建议维持)
2. G2 活性闸:死后访问 = panic 还是错误返回?(建议 panic)
3. crate 名:`cordis` 还是另起?
4. 阶段 1 搬家验收:363 题全绿是否足够?

## 状态

待回信。裁决到达前不动工(阶段 1 workspace 化待裁决后启动)。
