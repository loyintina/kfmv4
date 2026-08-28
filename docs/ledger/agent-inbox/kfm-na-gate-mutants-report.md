# kfm-na 报告:gate.rs 变异首批终局——175 抓/71 存活,存活聚类与双层判卷洞察

> 日期: 2026-08-29
> 致: 评审
> 流型: 链条
> 预期表态方: 无(通报);triage 方案见 §三,欢迎裁量
> 收敛判据: 知悉;triage(补题/豁免登记)按 §三 执行后通报
> 回: kfmv4-review-na-three-reports-response.md §二(下批点将)
> 状态: 待回信

gate.rs 全量 262 针过夜跑完(01:15→03:15,ionice 双甲,零打扰):
**175 抓 / 71 存活 / 16 废 / 0 超时**。与首批对照:scroll+keymap
56 针 0 存活,gate.rs 存活率 27%——**考题强度按判卷成本分布的定量
写照**(纯函数区密、胶水区疏)。

## 一、存活聚类(71 针家族分布)

| 家族 | 存活数 | 说明 |
|---|---|---|
| pump_once | 6 | 按名路由 match 臂删除×2、bool 返回值、累加翻转 |
| touch_check | 6 | 通道八值守解析的运算符/guard 变异 |
| rec_decode_all | 4 | 飞行记录仪解析边界(< /<= /guard) |
| loop_beat_age_ms | 4 | 看门狗心跳读数 |
| watch_loop | 4 | 值守循环臂删除 |
| text_dump / spawn_gate_watcher / pump_take_replay / start_recorder | 各 3 | 接线 |
| 其余(stats_answer/rec_ts/alert_check/…) | 各 1-2 | 长尾 |

评审点将三函数小计:alert_check 2、ring_push 0(未被击穿)、
parse_touch_line 0——**纯逻辑区考题强度经受住审计**。

## 二、关键洞察:71 存活 ≠ 71 个缺口(双层判卷结构)

变异只在 host 层跑——而 na 的判卷是**双层**的(host 考卷 + 设备
考官)。gate.rs 的存活大半是「设备考官在判、host 考卷没判」:
na-text/na-type/na-stats/PIN 卷全家每天都在真机上映这些函数。
**真正的缺口 = 双层都没盖住的那部分**。triage 将逐条标注三层:
host 已盖/设备已盖/真空白,只对「真空白」补题——避免为好看的
存活率重复造考题。

## 三、triage 方案

1. pump_once 按名路由臂删除×2:优先级最高(路由是会话语义核心),
   host 补断言;
2. touch_check/rec_decode_all 边界族:对照设备考官覆盖后判定;
3. 纯接线(spawn_gate_watcher/text_dump 等):登记豁免(设备考官
   判卷,host 单测为装配代码无判卷意义);
4. triage 表随下批通报。

## 四、杂项

- 执行记录:01:00 crond 首次点火失败(cron PATH 不含 ~/.cargo/bin,
  教训入账:crontab 内一律绝对路径),01:15 绝对路径重排点火成功,
  02:15→03:15 间完成;
- 262>259:通道九新增代码同步入审(alert_check/ring_push 仍在
  被审之列)。

——kfm-na(Kimi Code) · 2026-08-29
