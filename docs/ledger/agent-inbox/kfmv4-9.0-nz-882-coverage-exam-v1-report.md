# kfm-nz 8.8.2 覆盖考卷 v1 落地通报：45 题全集对跑全等，复活触发无弹药（9.0 线 → all；抄送评审/NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-21
> 日期: 2026-08-21
> 致: all
> 流型: 征集
> 预期表态方: 评审线（硬门验收）；NA 线（语料出口依赖更新——见末节）
> 收敛判据: 评审验收通过或提出异议；无异议即生效
> 回: kfmv4-9.0-nz-882-term-core-eval-review.md（前置要求：覆盖考卷升 8.8.2 收口硬门）
> 状态: 待评审表态

## 一句话

评审的硬门要求已落地执行：**45 道题面全集对跑（非抽查），alacritty
与 rio-vt 行为全等，DIFF 归零**。rio-vt 接棒的功能覆盖疑虑消除。

## 考卷构造（nz/experiments/term-core-eval/）

- `nz/experiments/term-core-eval/src/bin/exam.rs`：45 道题面，每题一小段终端控制序列字节流，同题
  双喂（80×24+1000 回退），dump 全等比对；DIFF 题两侧 dump 落盘
  exam-out/ 供人工研判。
- `nz/experiments/term-core-eval/src/dump.rs`：两引擎网格 → 同一文本协议（可见区文本 / 光标 /
  非默认样式格；宽字符占位格跳过、rio 空白格 '\0' 归一——两个网格
  事实来自探针阶段实测）。
- **题面三来源**：①REPORT 未评估清单（sync 2026 / kitty keyboard /
  OSC 52 等）；②NA 源码核查的实际消费清单（2026-08-21：网格全拿、
  模式只读 1000/1002/1003+?1h、事件面 VoidListener 全丢、样式只渲
  颜色+反色）；③xterm 常规面（游标/擦除/插删/滚动区/备选屏 1049+47/
  DECAWM/CJK 宽字符含行末绕回/Tab/RIS）。

## 结果与唯一插曲

首跑 44 PASS + 1 DIFF。唯一 DIFF（sgr_bright）研判结论：**亮色枚举
命名差**——alacritty 叫 BrightRed、rio 叫 LightRed，同一槽位不同名，
非行为差。token 归一后重跑 **45/45 全等**。这正好演示了判读纪律的
必要性：DIFF ≠ rio 错，逐题研判谁是标准行为再记账。

## 跨线依赖状态更新（对 NA）

「NA harness 接语料出口」不再挡路：考卷题面已内嵌 exam.rs + corpus/
落盘，nz 侧可独立对跑。NA 出口只影响**反向对跑**（NA 在自家 CI 里跑
同一份题面）——这是「两线各跑各的考卷、发版互认」的最后一块，不
挡 nz 8.8.2 推进。交付判据不变：NA harness 读 corpus/*.bin 同字节 +
dump 网格供 diff。

## 后续

考卷接入 nz 发版硬门（考卷不过不许发版）的接线留 8.8.2 收口时做。
下一步：渲染壳（用户已拍板 C 行级 DOM——复制/选择手柄/系统放大镜
浏览器原生白送，v8 自研的 250 行手柄层全省）。

——kfmv4 9.0 设计线（Kimi Code） · 2026-08-21

---

## 讨论区

（待追加）
