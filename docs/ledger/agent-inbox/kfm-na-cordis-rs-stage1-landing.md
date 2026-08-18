# cordis-na 阶段 1 落地通报(kfm-na 线 → 评审会话;抄送 9.0 设计线)

> 2026-08-17 · 类型 report
> 对应:评审裁决(`kfm-na-cordis-rs-audit-review.md`)+ 审计路线图阶段 1
> (`experiments/dsh-na/na/cordis-rs-gap-audit.md` §三)。
> 状态:**用户实拍已确认正常**(2026-08-17,APK 16777494)。
> 日期: 2026-08-17
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审核对落地内容与考题随迁（状态翻已核）
> 回: [`kfm-na-cordis-rs-audit-review.md`](kfm-na-cordis-rs-audit-review.md) 批准后的阶段 1 落地通报（workspace 化 + base/ 搬家 + G1 切除 + 用户实拍确认）
> 状态: ✅ 已核（2026-08-18 评审逐项核实：crates/cordis-na 五文件+考题随迁属实；G1 切除属实（ctx.rs 无 term 字段）；`pub use cordis_na as base` re-export 属实；chain.sh --all/--workspace 化+注释属实；126/2 基线口径与用户实拍 APK 16777494 可信，阶段 1 闭环）

## 一、落地内容

1. **workspace 化**:kfm-na 根包 + `crates/cordis-na` 双成员;根
   `Cargo.toml` 加 `[workspace]` 与 path 依赖。
2. **搬家**:`src/base/` 五文件 `git mv` 进 `crates/cordis-na/src/`
   (mod.rs→lib.rs,历史保留);考题 `base_spec.rs` 随迁(位于
   `/root/kfm-na/crates/cordis-na/tests/base_spec.rs`),
   导入 `kfm_na::base` → `cordis_na`。
3. **G1 切除**:`Ctx.term: Term` 占位删除(结构/字段/构造/re-export
   四处)。内核现在只有事件总线一个类型化字段,其余服务全走
   registry——「内核不知道终端」从纪律变成编译事实。
4. **消费侧零 churn**:kfm-na `lib.rs` 以 `pub use cordis_na as base`
   re-export,三个插件(term-alacritty / conn-provider-ws / input-ime)
   一行未改——term-alacritty 即 cordis-na 的**第一个外部消费者**。
5. **揪出一个真洞(chain.sh)**:带根包的 workspace 下裸
   `cargo test/fmt/clippy` 只覆盖根包,cordis-na 的 18 道考题会静默
   脱链。chain 1/2/5 步全部 workspace 化(`--all`/`--workspace`),
   原因写入脚本注释。

## 二、验收(裁决 4 口径逐项)

| 验收项 | 结果 |
|---|---|
| 全量可实跑基线全绿 | ✅ 搬家前 126 通过/2 ignored;搬家后 `cargo test --workspace` 126 通过/2 ignored,逐 suite 数字一致(快照对比) |
| 终端插件第一个外部消费者无缝 | ✅ term_emu 5 题 + termview 33 题全绿,插件源码零改动 |
| 实拍终端画面正常 | ✅ 用户实拍确认(APK 16777494,2.6MB):渲染/输入/中文/触摸滚动/键盘避让/快捷键行行为与搬家前一致 |
| chain 全绿 | ✅ 六步(fmt/clippy/android check/javac/test/build)全过 |

## 三、口径说明

「363」弃用、「126 通过/2 ignored」为实测基线(2026-08-16 复核),
已回审计文档文首口径钉。规格书 v1.3 已含本阶段全部裁决吸收
(§4.3 全同步设计选择声明 + §6 阶段 4 蛰伏期约定)。

## 四、下一步

阶段 2(语义补差):G2 活性闸(panic + Ctx 活性标记,考题三断言)
+ G3/G4 考题桩 + G5 归层。设计页先行,走完送审流程再动代码。

——kfm-na 线 · 2026-08-17
