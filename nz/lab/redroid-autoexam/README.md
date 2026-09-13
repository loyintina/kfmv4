# redroid-autoexam — 自动开考铃 + 混沌注入器（nz 探坑场 × na 考场）

> 立标与边界冻结：[CHARTER.md](CHARTER.md)（na 回信条件全部收编）
> 现状：**v1.2 DRY-RUN 值守形态**——真线（真热更+真判卷）是 v2 显式开关。

## 这是什么

na 每修收尾落一行 JSON「开考令」，本器官的铃消费它：热更 redroid → 跑
na-regress → 证据归档（截图/日志/报告）→ 信箱通报。另有混沌注入器
（v2）：宿主侧 netem 只打 redroid 自己的 veth，量化「撤混沌后 N 秒内
新报表回场」的韧性 SLO。

na 的 scripts/ 是本器官的**只读乐器库**（编排不重写）；na 仓零写入。

## 用法

```bash
bash bin/doctor.sh                  # 环境体检（7 项）
bash bin/bell.sh single             # 单拍一次
bash bin/bell.sh watch              # 常驻值守（DRY-RUN 形态，flock 单例）
bash bin/bell.sh consume <file>     # 手动消费某个令文件
bash tests/selfexam.sh              # 自考卷（29 钉，隔离根+假乐器）
```

开考令（暂定格式，na 十二修后定稿）：

```json
{"commit":"abc1234","build":"20260914","vc":"vc417","subjects":["BAR-040","PIN-boot"]}
```

- `subjects` 走白名单 token（`[A-Za-z0-9][A-Za-z0-9_.-]*`），空/非法=ABORT
  拒绝盲开（全量卷含 8021 killsocket 重考官，不许无单盲跑）
- 同内容令 60s 内重复=DUPLICATE 转延迟区留档；崩溃残留 staging 由收养逻辑
  重考，完成哨兵（COMPLETE）防重放

## 判卷栈

事实层=redroid 本体（adb/screencap/logcat/报表接力）；异构审阅层=omp
（deepseek-v4-flash，独立复审，两轮已入档案）；方向层=psh 评审晨报。

## 版本

- v1.2：omp 二审 C1–C5 全修（subjects 通道消毒+数组传参/DRY-RUN 默认形态/
  flock 子进程继承洞/乐器可注入/空科目族钉），自考卷 v2 十钉
- v1.1：omp 一审 P0 修复（先归档后删令/去重不销毁/作用域闸/FAIL 路/写面）
- v1.0：铃骨架+归档管线+自考卷（被 omp 打穿 6 变异，教育的起点）
