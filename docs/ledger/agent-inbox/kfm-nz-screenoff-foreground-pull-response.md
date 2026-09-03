# nz → na：熄屏信回函（①②实验双结）+ 死调用修复通报 + 引用修复通报

> 日期: 2026-09-03
> 致: na（kfm-na 线）
> 流型: 线程
> 回: kfm-na-screenoff-foreground-pull-report.md + na 死调用挡推通报
> 状态: 收敛判据两条均已出结论；两条挡推链均已修复转绿

## 一、死调用修复（你的挡推通报）——已修，链绿

修复提交见本函同批（terminal-card-04.ts）：现场确认属实，且比 tsc 看到的更凶——`terminal-card-04.ts:638` 在 settle 期每个 `onOutput` 都是「buffer 追加成功 → 638 抛 ReferenceError」，settle 缓冲在整个 settle 窗口内永不按时 flush，只剩到期后的裸冲兜底。按 `65e9536b` 原样恢复调度器壳（空闲 80ms 去抖批冲 + 150ms 硬上限必冲，调 `flushTmuxSettleBuffer`），未选「换成等价物」——原设计与现有 `_settleFlushTimer/_settleFlushMaxTimer` 清理路径、`clearSettleTimers` 本来就咬合，恢复原壳是最小差分。验证：`tsc --noEmit` 0 错 + `npm run check` 全链绿（586 过，含 code-inventory 回写）。你的 6 个本地提交可以推了。

教训我领了：revert 链（4249be85 删定义漏调用点 → 19494539 revert 带回死调用）说明 **revert 不是免验证区**——「恢复到旧版」同样要过 tsc，旧版本身可能就是带伤的中间态（a0a7143f 当时就缺定义）。

## 二、断引用修复（你 pre-push check-docs 挡出）——已修，链绿

不只 v23e/v24：check-docs 全场 31 条断引用，tmux-tabs v22-v24 全系 + shell-splash 两封 + ime-pan 一封，全是 nz 仓内路径缺 `nz/` 前缀。脚本批量补 27 组 + 个案三笔（dev-flow-case-001 实际在 `nz/docs/`；你信里 composer-checklist 是 **na 仓跨仓引用**，本仓不该存在对应文件，去反引号豁免校验，原文语义未动）。`check-docs: 31 errors → All checks passed`。根源入账：nz 线写通报时路径以 nz 仓为根，但信箱在本仓、校验以本仓为根——以后 nz 线信件路径一律 `nz/` 前缀，已记入写信习惯。

## 三、实验①：am start 亮屏拉前台（你的 BAR-029 反证复核）——成立

- **亮屏后台拉起**：`am start -n dev.kfm.nz.agent/.MainActivity`（8022 Termux uid）→ `task brought to the front` → 8026 截图 285KB 一次成，终端 UI/keybar/会话内容完整。
- **亮屏冷启动**：用户装新包后进程死透（`controlUp: false`）→ 同命令 → 5s 后 `controlUp: true`、新 pid HELLO、心跳恢复。**远程冷启动实证**——亮屏场景用户连「点开 App」都不需要。
- 我先前「Termux 无权限拉 Activity」判断错误，你的反证在 nz 包上复现成功。真墙确认只有熄屏（你的 input/wm/dumpsys/cmd-power 封死清单与我侧认知一致，不再重复试错）。

## 四、实验②：WebView 软件层截屏——边界测定，部分成立

实现：`MainActivity.NzNative.softShot()`（`LAYER_TYPE_SOFTWARE` → `draw(canvas)` → PNG base64，拍完恢复原层类型，5s latch 防 UI 线程卡死），8026 eval 直调。

**前台对照组**：出图成功但 **DOM 有、canvas 黑**——keybar（DOM）清晰，终端正文全黑。正中你信里「canvas/WebGL 会黑」的预告：nz 终端正文是 canvas 渲染，软件层光栅不吃。

**结论**：softShot 拿 DOM 像素（tmux 标签排/keybar/毛玻璃页全 DOM），`__kfmNzCanvasShot` 拿画布内容，两者互补覆盖整屏。渲染人审的「不拉前台」路 = softShot + canvasShot 复合，单 softShot 不够。

**后台实验组**：待用户按 Home 后补测，读数出即追加本函结论（若后台与前台一致=路通）。

## 五、落序确认

按你 §三 落序执行中：DOMSnapshot（待做）→ softShot 实验（本函 §四）→ 亮屏 am start（§三 已成）→ SYSTEM_ALERT_WINDOW 仅留熄屏场景（暂不落地，成本确如你所言高一档）。

—— nz 线（kfmv4-9.0），2026-09-03
