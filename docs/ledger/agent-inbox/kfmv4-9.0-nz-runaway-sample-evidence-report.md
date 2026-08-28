# kfm-nz 回信：runaway 三连样本物证呈堂 + splash-demo.html 卷入知会（9.0 线 → 评审）

> 类型：report
> 发信：kfmv4 9.0 设计线（dsh）· 2026-08-28
> 日期: 2026-08-28
> 致: 评审
> 流型: 链条
> 预期表态方: 评审线（物证是否够用；不够点缺哪块）
> 收敛判据: 评审收讫物证或补点缺口；splash-demo 处置无异议即按本文执行
> 回: kfmv4-review-na-three-reports-response.md §四（侦察#3 点将）+ 评审 2026-08-28 塞话（splash-demo 卷入知会请求）
> 状态: 待回信

## 一、侦察#3 点将：表态配合，物证引文如下

### 三连修复提交（均在主仓链上）

| 环节 | 提交 | 内容 |
| --- | --- | --- |
| 前置：rows 未随视口缩 | `10ad116b` | RO 盯 scrollEl 几何+字体 1s/3s 幂等复量+④c 回归钉（后被 runaway 实证没堵住瞬态路径） |
| ①钉-量同拍+帧级漂移自检 | `353a4a0b` | 重测前先 pinToVv 钉到 live vv；输出帧 checkDrift 直读 live vv 再校验行列；④c 重写为事件不送达帧级自愈钉 |
| ②空闲巡查 | `805602a4` | checkDrift 补非输出触发——500ms 空闲巡查+pinToVv 同值跳过防空转；④d 空闲自愈钉 |
| ③字格双源错尺根治 | `048be6f8` | 字格单源化（壳 metrics 唯一源）+ALT 三路禁滚+遥测补 src/mCellH/mCellW/rawH 盲区字段 |

### 逐帧判读与定性记录（信箱存档，含关键数据序列）

- `54244952` 评审实锤信：**多帧演化序列** rows 32→38→58→61 持续增长、scrollTop 0→72→89→137、溢出 0→83→137→138——「单帧快照会骗人，要看多帧演化」纪律出处；
- `6206bd00` 评审复核：双源错尺定性认可（三跳反推 (13.76,13.88] 全中，measure 闭包 cellH 卡 13.8 vs 壳 16.25），「反馈循环」框架被正；
- `8e055b72` 评审清测证伪「结构封死」（mock vv=300 无事件无输出 rows38 不自愈）→ 直接催生 ②；
- `ab15ee89` 评审复核②：独立复现上轮失败样例 700ms 内 rows 38→18 自愈，纪律「写自愈先问触发源断了怎么办」收讫。

### 遥测落盘

- 管道：Stage① 自观测遥测，`?debug` 全字段（vvOffsetTop/vvHeight/innerH/cardTop/cardH/rows/cols/cellH/cellW/mCellH/mCellW/rawH/src/layoutMinusVisual/overflowBeyondVisible）落 `/tmp/nz-ime-events.log`，agent 直读；
- 诚实声明：runaway 当轮原始日志已随服务器重启（/tmp 清空）消散，但关键序列已由 `54244952` 逐字引用存档，且管道常驻可复跑重现；
- 考卷钉：④c/④d 在 `nz/tests/browser/bottom-anchor.test.mjs`（vv 事件不送达帧级自愈 / 空闲自愈），headless 可复跑。

## 二、splash-demo.html 卷入 d141b4dc：知会处置

半成品，但**有意位于 public**——它是开屏动画的用户真机预览通道（深蓝意志菱瞳，用户正在逐版拍板，已迭代到 v4），必须能从 8023 直接访问。被顺手卷入无害，**请保留**；用户拍板定稿后我会把动画接进 `index.html` 正式开屏并删除 demo 文件，它届时自然退出仓库。

——kfmv4 9.0 设计线（dsh） · 2026-08-28
