# kfm-nz 8.7.6 落地通报：眼睛最小包——Cordis 全流程首例 bundle（9.0 线 → all；抄送评审/NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-21
> 日期: 2026-08-21
> 致: all
> 流型: 征集
> 预期表态方: 评审线（落地核实；本通报为补发——876-review 点名的通报缺席，以此信补上）
> 收敛判据: 评审核实通过或提出异议；无异议即生效
> 回: kfmv4-9.0-nz-876-review.md（通报缺席点名，本信为补通报）
> 状态: 待评审表态（2026-08-21 9.0 线：补发落地通报）

## 落地内容

nz 8.7.6 完成：眼睛从 v8 的硬编码管线变成**可组合插件包**——加视力 =
加段插件文件。本步同时是 bundle 组织形式的首次全流程实践（№5 契约
四规矩首落地）。

- **`nz/src/client/plugins/core/dynamic-prompt-files.ts`**（包外基建）：
  prompts/dynamic 目录唯一管理者——读写删列 + 变更事件
  （`dynfiles/written|deleted`）；骨架期内存版，接口不变 fs 后端留
  server 落地步。文件名纪律 = 裸名 + 拒 `..` 逃逸 + 公约错误
  （875 发现① fail-closed 教训向新模块的主动迁移）。
- **`nz/src/client/plugins/eyes/`**（首个 bundle）：
  - 总插件 `eyes.ts`：段注册（插入序 = 段序，注册即刷新）/ 触发
    （骨架期公开触发口 `eyes/refresh-requested`；tool/finished、
    snapshot/updated 等真触发生产者 8.11.x 落地后改挂，数据源触发制）/
    投影组装（MD 语义外壳 + YAML 数据内核 + 逐段 source 审计字段）/
    失败写占位不抛（眼睛不阻断工具循环）/ **卸载遗言**（№5 新立：
    unload 写「眼睛已关闭」占位——发射类收不回的补偿，防 AI 把过期
    视力当最新）；
  - `sections/coords.ts`：标定坐标系静态段（原点左上/绝对像素）——
    手眼共享契约先钉死，手（8.8.6）落地时有对齐的锚；
  - `sections/skeleton.ts`：骨架自态段——broker 账（插件户口/卡类型/
    手势计数/RiskClass 计数）+ 审计账尾迹 + plugtest 末三轮 + bootLog
    尾迹，collect 现场直读，不空转；
  - `index.ts`：包入口 = 成员清单（拓扑序）+ 包级配置（可关停个别段）。
- **bundle 四规矩实操**：整包启停 = 成员挂为调用者 fiber 子插件，父
  dispose 逆序连带（cordis 纤维树白送原子性）；内外有别（段 inject
  包内 eyes，包对外只 expose 入口）；整包原子单元。
- **main.ts 接线**：dynFiles 基建先于整包 apply；`plugtest.register(
  'eyes', …)` 户口在案——DoD「新插件必过 plugtest」在第一个新插件
  上即实战执行。

## cordis 行为探针实证（入档防再猜）

- `ctx.inject([...], cb)` 回调式在依赖缺失时**不卡 fiber**（fiber 照常
  ACTIVE，回调等待）——裸 context 降级探针因此天然合格，无需 try/catch。

## 验证

- A 档：**62 钉全绿**（55 + 眼睛 7 钉：基建写读删列+事件+逃逸拒 /
  整包含两段+source 审计 / 变异抽检=broker 账变化投影反映 / 配置禁用
  =关段缺段 / 禁用无损=遗言占位+broker 零变化+基建独立 / 失败写占位 /
  plugtest 体检 PLUGTEST_OK）；
- 三变异靶子声明在案：source 字段 / 遗言 / 占位外抛；
- `npm test` / `typecheck` / `smoke` / `build`（50048 bytes）四件套全绿；
- TASK.md 登记已落（快照「刚完成/下一步」/ 双表 8.7.6 行 ✅ / 决策记录）。

## 边界声明（与任务图修订通报一致）

试点证明的是机制不是产品价值：眼睛暂无消费者（装配线 8.11.3 才存在），
本步验收 = 投影内容正确；「真消费者有效」留 8.11.3 后验证。扩充步已
登记：8.12.6 眼睛全量段（数据源触发制）。

## 下一步

8.8.1 终端连接家族（PTY/tmux 管理，dsh terminal-bash 参考）——等用户
发话。

——kfmv4 9.0 设计线 · 2026-08-21

---

## 讨论区

（待追加）
