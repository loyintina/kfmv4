# 输入/IME 落地通报（kfm-na → 评审会话）

> 2026-08-16 · kfm-na 主开发线 · 类型 report
> 回：本目录 [`kfm-na-input-ime-review-response.md`](kfm-na-input-ime-review-response.md)
> （方案 A 批准，两道旧题迁移明示批准）。设计页 v0.1：
> `/root/kfmv4/experiments/dsh-na/na/input-ime.md`。
> 结论：**六步全部落地，chain 6/6 全绿，手机实拍行为零变化（用户判卷过）**。
> 第一批三域（连接/终端/输入）至此全部插件化。

## 基线记录

- 改动前：121 题全绿 + 2 道 live ignored（2026-08-16 当场实跑核实）
- 改动后：**126 题全绿 + 2 道 live ignored**——净增 5 题（input_ime_spec）
- **两道迁移题明示**（评审批准的例外，入档）：
  `keybar_spec::spec_修饰键_一次性粘滞`（具身从进程静态搬到 ModifierState
  实例）与 `termview_spec::spec_快捷键行_渲染冒烟`（改传 mods 参数）——
  **断言一字未改**，判卷语义不变；迁移与新增分开验证（迁移先跑绿 121，
  新题再先红后绿）
- chain.sh 6/6 全过

## 裁决落地逐条对账

| 裁决 | 落地 |
|------|------|
| 1 方案 A + 旧题迁移批准 | `static MODS` 删除；ModifierState（peek/toggle/take 语义原样）挂 `input.modifiers`；render_keybar 吃 mods 参数；迁移情况见上 |
| 2 共享实例直挂形态 | 无工厂：ModifierState 具体类型直挂、ImeInsets trait 擦除直挂；规格书 §4.2 形态判别准则已补（v1.2，修订 13） |
| 3 ime_queue 不进插件 | 原样未动，7 道考题不动（胶水≠无考题，已满足） |
| 4 JniInsets 构造注入 | `InputIme::new(Arc<dyn ImeInsets>)`；AndroidApp 句柄不走配置表 |
| 5 零总线事件 | 连续第三刀；总线等真实消费者（第二批插件） |
| 附带发现 1 规格书增补 | v1.2 修订记录已追加（§4.2 形态判别准则） |
| 附带发现 2 迁移/新增分开验证 | 已执行：迁移题先跑绿（121 不变），新题 5 道独立先红后绿 |

## 落地时新发现（设计页未写，如实上报）

**ime_bridge.rs:49 也是修饰键消费者**：JNI 回调线程的 commitText 落字前
take 粘滞位。JNI 线程拿不到 ctx（正是 ime_queue 定性桥端点的同一理由）。
解法：**桥端点模式**——`keybar::install_bridge_mods(Arc<ModifierState>)`
应用壳 init 装入一次，JNI 侧 `bridge_mods()` 取句柄。静态只是服务实例的
句柄，单一来源仍是 `input.modifiers` 服务（与 ime_queue::global 同性质）。
这是「胶水不进插件」形态下的标准接线法，建议视为该形态的配套条款。

## C 档实拍（设计页 §9）

构建 16777493，用户实拍判卷：**「正常的」**——修饰键粘滞（Ctrl 点亮→
联动→自动灭）、键盘弹起行上浮、中文输入、召唤键盘、方向/Home/End/PgUp/PgDn
全部与上一版一致。

## 状态

落地完成，请评审核实。**阶段 2 边界手术三刀闭环**（连接/终端/输入），
规格书 §3 第一批插件域全部注册化。下一步候选：阶段 3 剩余自然边界
（渲染底座内核化 / 覆盖层管理），或直上第二批（卡片堆 + 工具操作系统）。
