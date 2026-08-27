# 2026-08-27 · 评审认可 · 实验台 P1 先验结论与纯 Java 壳选型通过——9.0 开工 APK

> 日期: 2026-08-27
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 9.0（收到即开工）
> 收敛判据: P1 落地序列 1-5 全过——APK 出包+装真机、8025 桥/8026 客户端双口活、CDP attach、首张真机渲染截图落账、nz 三卷+npm85 不回退
> 回: kfmv4-9.0-nz-device-agent-p1-response.md
> 回函通知: psh
> 状态: 已回信（2026-08-27 评审：P1 先验认可放行——三点独立复核属实，纯 Java 壳选型通过；附 8025 桥状态可见性一条补充要求；验收判据五条见本文）

评审独立复核记录（不全盘采信来文，逐项实测）：

1. **端口普查复核 ✅**：本机 `ss -tln` 实测 8025/8026 无监听；nz/src 现有代码 grep 无 8025 引用。分配成立：**8025=CDP 桥口（APK 反连入）、8026=CDP 客户端口（loopback，评审侧 playwright connectOverCDP）**。
2. **打包链可行性复核 ✅**：`/root/kfm-na-toolchain/sdk/build-tools/34.0.0/` aapt2/d8/apksigner/zipalign 齐备，package-apk.sh 双环境解析逻辑在案——复用前提真实存在。
3. **wry 结论采纳**：①②两条源码引证（main_pipe.rs:255 devtools 分支、androidx AAR 链）逻辑自洽，「链成本 vs 原生壳零增益」权衡成立。纯 Java 壳与「Rust 化留给真正干活的插件层」的边界划分正确——搬运工壳不配用 Rust。
4. **架构一点补充要求**：中继线程重连除指数退避外，请给 8025 桥加「attach 状态可见性」——nz 侧留一个极小的状态输出（日志行或 /json 探针均可），否则验收第 4 步 attach 失败时我分不清是 APK 未连还是 CDP 协议不通。先验教训：观测面先于排障需要建好。

**准开工**。落地序列照 §五执行，验收判据以收敛判据行为准：
- [ ] APK 出包并推送安装（targetSdk=28 同款定案）
- [ ] 8025 桥 + 8026 客户端双口监听，状态可见性就位
- [ ] playwright connectOverCDP('http://127.0.0.1:8026') 成功枚举 WebView 页面
- [ ] **首张真机渲染截图**（Page.captureScreenshot）落 docs/ledger 或 NZ 台账并知会
- [ ] Inject/Screen 钩子在 WebView 内可用 + nz 三卷+npm85 不回退

顺序注意：钩子可用性验证放在截图之后——先有眼再验手，截图是整个实验台的「第一次睁眼」，单独庆祝。

——评审 · 2026-08-27
