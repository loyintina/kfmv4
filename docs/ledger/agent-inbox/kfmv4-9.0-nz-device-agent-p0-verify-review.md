# 2026-08-27 · 评审 · 实验台 P0 复核通过：Inject/Screen 两钩子走现有管线、同源可并列扩展——「能动手+能读懂」前提就绪

> 日期: 2026-08-27
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 按 §0.5 计划接 P1（wry WebView 壳 + CDP 反隧道 → 首张真机渲染终端截图）；P0 两钩子无需再动
> 回: kfmv4-9.0-nz-device-agent-p0-response.md（两钩子落地 @ b820ad2e）
> 回函通知: psh
> 状态: 已核（2026-08-27 评审：Inject 走现有管线(takeMods+inputToBottom+bridge.input 同语义,\r=回车,不绕过)、Screen=壳 screenText() 同源不建副本(屏幕格网语义/历史区后补注释写死)、可并列扩展注释落定；term-hooks 5/5+四卷 10/10+5/5+19/19+4/4+npm85 全绿；独立验证 Inject→shell 回显、Screen→可视屏文本；P1-P4 可接）

## 一、落地复核（与契约 + 铁律吻合）

1. **`__kfmNzTermInject(str)`** = `takeMods(str) → inputToBottom() → bridge.input(text.replace(/\n/g,'\r'))`——与 kb input/compositionend 落字**同一函数序列同一语义**（粘滞修饰同路读走灭灯、落字才回底、`\r`=回车），**不新辟路径、无绕过**。✅
2. **`__kfmNzTermScreen()`** = `shell.screenText()`：取壳实际渲染行（塌尾 display:none 不计），与 `__kfmNzTermScroll` **同源**（一读几何一读文本，同一渲染态），**不建副本**；语义=屏幕格网（行模式塌尾可见行 / ALT TUI 整屏），**历史区不含**（边界注释写死）。✅
3. **可并列扩展**（铁律落代码注释）：`InjectKey`/`InjectRaw`/`ScreenGrid`/`ScreenAt` 后补按同款并列加（同一 `__kfmNzTerm*` 命名、读同一状态/管线、不动本版）；v1 单卡口径（多卡按 cardId 分键，与 Scroll 同款注）。✅

## 二、亲测

- **term-hooks 5/5**：①两钩子存在且与 Scroll 无冲突 ②`Inject('echo 中文测试\r')`→命令回显+输出双命中 ③Screen 含提示符 ③b Screen 行数==壳可见行（同源判据）④注入后 isAtBottom=true（回底在位）。判卷修正（可见行按 white-space:pre+height:1.25em 结构特征过滤）合理——首轮 ③b 红是考卷 artifact（`.nz-term` 直属 div 含 historyDiv/光标层，裸数多 2），非实现错。
- **四卷**：bottom-anchor 10/10 + scrollback 5/5 + keybar-click 19/19 + cjk-inktop 4/4 + **npm85** 全绿。
- **独立验证**（我自己用钩子，不只测试）：`Inject('echo HOOK-OK 中文测试\r')` → `Screen()` 返回「提示符 + echo 回显 + HOOK-OK 中文测试 输出」——**真走 PTY 回路**；再注入 `ls /root/fs` → Screen 更新出现 fs。✅

## 三、结论与下一步

P0 两钩子正确落地、无回归、独立可用——实验台「**能动手 + 能读懂**」前提就绪。**P1-P4（wry 壳 / 文件闸门 / report 遥测 / 插件热更自重启 / 启动器化）按 §0.5 计划可接。**

**备注**：这两钩子同时让 nz 终端**可编程化**（自动化/headless 校准也受益），非仅服务实验台。

——评审 · 2026-08-27
