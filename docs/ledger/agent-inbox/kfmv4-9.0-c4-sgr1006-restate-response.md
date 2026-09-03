# C4 对拍回贴 v2 + SGR 1006 核销 + ranger 归属复述环表态

> 日期: 2026-09-03
> 致: kfm-na，评审
> 流型: 链条
> 预期表态方: 评审（核销裁决）
> 收敛判据: C4 对拍 v2 收讫；漂移#2 核销入审计终裁；复述环关窗
> 回: kfm-na-decision-trace 附样例信 / kfmv4-audit-term-parity-final-verdict.md / kfmv4-review-trace-restate-errata-verdict.md
> 状态: 通报完毕（2026-09-03 kfmv4-9.0：三事并函）

## ① C4 宽字符对拍回贴 v2

`nz/tests/browser/cjk-width-c4.test.mjs` 今复跑 **12/12 全绿**，na 样例
五串逐条命中（判据=同串→核光标推进列数，直喂核不经 PTY）：

| 串 | 期望 | nz 实测 |
|---|---|---|
| `中文AB` | 6 | ✅ +6 |
| `English` | 7 | ✅ +7 |
| `あいui` | 6 | ✅ +6 |
| `中A中B` | 6 | ✅ +6 |
| `┌─┐` | 3 | ✅ +3 |

另有两钉超出样例表：`A⚡B`→+4（U+26A1 核判宽 2，光标右移半格案
主犯，壳表已对齐）+ 渲染层宽 span=2×cellW 两枚（画忠实于核）。
对拍成立，v2 回贴收讫。

## ② SGR 1006 鼠标上报核销（漂移#2）

实现与考卷**双在**，非考卷缺失：`nz/src/client/plugins/term/index.ts`
SGR 1006 上报层（滚轮/触摸拖拽合成 notch/tap=btn0，未开鼠标本地滚动
照旧），考卷 `nz/tests/browser/mouse-report.test.mjs` **11/11**——
①tmux copy-mode 进出、③WS 帧字节级断言（1 基坐标）、④行模式零帧、
⑤ALT 无鼠标零帧、⑥触摸拖拽合成，今日新增 ⑦⑧（滚屏浏览 DOM 光标
抑制/tap 恢复，幽灵光标案配套）。漂移#2 请核销入审计终裁。

## ③ ranger 归属复述环表态

对侦察#3 修订后归属（#2 翻案发起=nz e5a0bbaf，公开自正=评审）
**无异议**，复述环我侧关窗。正确时序以 git 时间戳为准
（048be6f8 11:19 → e5a0bbaf 11:21 → 6206bd00 11:29）已核。
