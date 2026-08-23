# 2026-08-23 · 9.0 线通报 · 8.8.2 终端渲染卡收口（轻量三件落地，考卷硬门归 8.8.5）

> 日期: 2026-08-23
> 致: 评审
> 流型: 征集
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: kfmv4-9.0-tmux-priority-notice.md（硬门后移拍板）/ kfmv4-9.0-ime-retro-review.md（裁决①收口口径）
> 状态: 📢 通报完毕（2026-08-23 9.0：8.8.2 收口完成，TASK.md 总表/详表已翻 ✅）

## 三件落地明细

**① 功能对照表核对** → `nz/docs/term-checklist.md`（新档）
五族全绿：连接家族（8.8.1 六动作）/ 渲染壳（行级 DOM、runs、宽字符裁格、
inverse、光标定位、DECTCEM 藏显传导）/ 输入路径（桌面 keydown、IME input
分支、composition 纪律 v2、诱饵钉光标格）/ 尺寸滚动（实测定行列、防抖、
吞末行根治、nearest 兜底）/ 诊断基建。每行带验证依据，分**自动化/守视/真机**
三级；真机专属症状一律真机数字收口（IME 三症均真机确认）。已知留白三条
（按键栏=8.8.3b、组合键全集、scrollback 渲染）明码标注非缺口。

**② M3 终端基线** → `nz/tests/m3-baseline/`（新档）
两态截图 + sha256 清单 + 复拍口径（守视、校准真机视口、无 ?debug、开页等
3.5s）：`term-fresh.png`（首开提示符+块光标，**验证角标已移除**）、
`term-sgr-cjk.png`（SGR 绿字/蓝粗 + 中英文混排裁格对齐）。全球 M3 tooling
待立项，本目录是终端局部基线，后续版本同口径重拍、hash 不同即人审 diff。

**③ 探针按裁决①收口**
- 移除：诊断角标（badge overlay + 定时器）、IME 专症字段（beacon 的
  col/row/cv/cb）、`__kfmNzTermDebug` / `__kfmNzTermCursor` 两 window 探针、
  shell.cursorBlocks()（含 fgCanonical 归一化辅助）；
- 常驻（骨架）：?debug 门控 sendBeacon 管道 + 服务端 /debug/ime-log 端点 +
  通用健康字段 f/rp/sc/rz（字段注册点注释已标明「新症状加字段在这加」）。

## 验证

typecheck 0 / npm test 76 passed / build OK（bundle 62873B，比收口前
64349B 瘦——探针拆掉的实重）/ smoke PASS；守视实拍两态基线即上图。
真机侧无需新动作（三症上轮已真机收口；本轮只是拆诊断件，守视实拍确认
画面无回归、角标消失）。

## 硬门重申

考卷全集差分（NA 在役序列 vs rio-vt，非抽查）**不取消**，按拍板挂 8.8.5
闭环前置；并行轨随时可开跑。下一步 8.8.3（刷新默认全屏终端）开工。
