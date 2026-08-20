# kfm-nz 8.7.7 落地通报：kfm-plugtest 最小版——插件验房师（9.0 线 → all；抄送评审/NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-20
> 日期: 2026-08-20
> 致: all
> 流型: 征集
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: —（通报；nz 8.7.7 TASK §2.4 最小版落地，DoD 全过）
> 状态: ✅ 已回（2026-08-20 评审：核实属实 + 观察两条知会——见 kfmv4-9.0-nz-877-review.md）

## 落地内容

nz 8.7.7（TASK §2.4 最小版）完成：热插拔从「按设计应该不留痕」变成
「实测不留痕」。**DoD「新插件必过 plugtest test-one」自此可执行**
（此前以考题/冒烟替代的空窗关闭）。

- **`nz/src/client/plugtest.ts`**（`PlugtestRunner`）：对插件跑三轮体检——
  ①降级探针：裸 context 装载（缺失降级语义定稿：公约错误 `[xxx]` /
  cordis `without inject` = 有意降级合格；裸 TypeError 等意外炸 =
  `PLUGTEST_DEGRADE_CRASH`；探针卸载同受超时保护）；
  ②装→卸→量残留：快照 diff 四个 broker 账目（容器→`LEAK_DOM` /
  卡类+RiskClass→`LEAK_SERVICE` / 手势→`LEAK_EVENT`）+ 事件探针
  （dispose 后发射 `plugtest/probe`，仍有听者收货 = 事件残留）；
  ③重载：再装再卸，炸 = `PLUGTEST_RECOVER_FAIL`；
  八错误码全实现、结构化结果机判。
- **残留检查 = broker 账目 diff**：插件一切登记走 broker 的架构纪律，
  使残留检查无需翻 cordis 内部——broker 越全验房越严，检查随架构成长。
- **串行纪律**：内部队列，同刻只测一个（并发交错快照无法归因）；
  发射类只验证停止不验证撤销。
- **三条计数探针口子**：host.containerCount / gestures.handlerCount /
  permissions.declaredCount（各 broker 出账，plugtest 只读）。
- **main.ts 接线**：provide plugtest + `__kfmNz` 暴露。

## cordis 行为探针实证（入档防再猜）

- `fiber.dispose()` **吞掉 cleanup 异常**——UNLOAD_FAIL 判定面 =
  dispose 自身 reject 或超时（2000ms，可配），cleanup 静默失败的后果
  由快照 diff 兜底（残留照样现形）；
- dispose **会等异步 cleanup**（挂起 cleanup → 超时路径可用）；
- 访问缺失服务抛 `cannot get property … without inject`——框架级依赖
  缺失报错，纳入「有意降级」合格类。

## 验证

- A 档：**53 钉全绿**（43 + 验房师 10 钉：八错误码逐码 fixture 钉死 +
  串行纪律并发不交错）；养坏插件 fixture 七个（乖/DOM 漏/登记漏/事件漏/
  挂起/意外炸/重载炸）；
- 双变异靶子实测抓获：①摘快照 diff → LEAK_DOM/LEAK_SERVICE 钉红；
  ②摘探针发射 → LEAK_EVENT 钉红；还原后 53 钉复绿；
- `npm test` / `typecheck` / `smoke` / `build`（45219 bytes）四件套全绿；
- TASK.md 四处登记已落（快照/总表/详表/决策记录）。

## 下一步

8.7.6 试点三件套（眼睛最小段 + 手单实例）——等用户发话。

——kfmv4 9.0 设计线 · 2026-08-20

---

## 讨论区

（待追加）
