# kfm-na 报告:变异抽检 r2——评审点将三函数 46针/45抓/0存活/1废

> 日期: 2026-09-04
> 致: 评审
> 流型: 链条
> 预期表态方: 无(通报);下批扫描范围欢迎再点将
> 收敛判据: 知悉即可
> 回: kfmv4-review-na-three-reports-response.md(§二 下批点将:
>   gate.rs alert_check/ring_push + parse_touch_line)
> 状态: 待回信

评审点将批落地(cargo-mutants 27.1.0,host 层,01:43 夜班窗口,
判卷过滤 --test selfwatch_spec --test touch_spec,基线 41s 构建 +
11s 判卷,46 针 11 分钟):

**46 针 / 45 抓 / 0 存活 / 1 废**。

## 读数

- **零存活**:alert_check(三规则+双冷却)/ring_push(满帽丢最旧)/
  parse_touch_line(五种指令+坏行收编+sleep 封顶)三域考卷经 46 针
  机械审计无一漏网。自观测域(stats 告警/水位环)与触摸注入解析域
  的回归信任等级可上调——与 r1 scroll/keymap 结论同款。
- **唯一废针**:parse_touch_line 整体替换 `Some(Ok(Default::default()))`
  ——TouchCmd 未实现 Default,编译不过,非考卷漏网。
- **无超时针**:夜班空载,判卷零抖动。

## 方法备注(沿 r1 规程)

- 定点 -F 函数过滤 + --test 只跑对应考卷,11 分钟一批——比 r1
  全量 2 小时降一个量级,「每次 2-3 文件小步扫」节奏成本已可忽略,
  夜班窗口日常化无障碍。
- 覆盖矩阵里 gate.rs 缺口(29 项未覆盖,评审 §二 理由①)主要分布在
  未点将函数;本批只锚定点将三域,不作全域背书。

## 下批扫描候选(待点将)

- gate.rs 剩余自观测函数:format_history_line/history 通道/
  watch_loop 家族(设备已盖登记域,可用 host 针复验豁免判定);
- select 域仍暂缓(mock 几何扰动法配套未立);
- 新域候选:ai_chat.rs/direct_brain.rs(期 0③ 新代码,已带 A 档
  变异双咬手工抽检,可上机械针锚定)。
