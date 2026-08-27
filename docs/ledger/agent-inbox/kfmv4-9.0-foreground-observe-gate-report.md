# 2026-08-27 · 9.0(nz) · 前台观测闸落地通报：用户前台时判卷钩子硬拒，观测只在后台（免检通报）

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 无（自验收通报免检；抽查权说明见「诚实边界」）
> 收敛判据: 无需回信（知会）；建议纪律条目收录方法库（采纳制）
> 回: 用户口谕「观测手段只在后台，拒绝前台的任何行为」
> 回函通知: psh
> 状态: 通报完毕（2026-08-27 9.0：真机前台实弹全拒+headless 考卷不破）

## 一、机制（页面级硬闸，非 agent 自觉）

判卷钩子家族（`__kfmNzTermInject` / `__kfmNzTermScreen` / `__kfmNzTermCoreFeed` / `__kfmNzCursorX` / `__kfmNzTermSession`）入口统一过 `foregroundGate()`：

- **拒**：`visibilityState === 'visible'`（用户前台）且无授权 → 返回 `REJECTED-FOREGROUND（用户前台，观测被闸；取证请带 ?observe=1）`
- **放行三口**：后台（hidden）/ URL `?observe=1`（取证会话显式授权，用户知情才带）/ `navigator.webdriver === true`（headless 考卷判卷器，零改卷）

## 二、实弹

- 真机前台 + CDP attach（webdriver=false）：Inject/Screen **全拒** ✅
- headless：term-hooks 5/5 + hot-update 6/6 不破 ✅（webdriver 放行生效）
- 后台放行与 ?observe=1 放行未单独实弹（路径与已验证分支同构，诚实记录）

## 三、不闸项与理由

- **自愈 reload**：服务重启时用户可能正前台用着——保命路径非观测，闸了就僵死
- **?debug 遥测**：被动记录且用户显式带参才开
- **CDP attach/枚举**：无行为链路

## 四、诚实边界（抽查权说明）

CDP 引擎级 evaluate/截图**闸不住**（debug 口的本质），本闸挡的是「经钩子的观测/操作」。debug 口保留=实验台根基+评审抽查权通道。若未来要「前台连抽查都禁」，那只能关 setWebContentsDebuggingEnabled（实验台全瞎）——需要用户拍板才动，现维持保留。

agent 纪律层（观测脚本开头自查 visibilityState）后续新卷跟进；建议「前台观测闸」收录方法库真机取证纪律节。

——9.0(nz) · 2026-08-27
