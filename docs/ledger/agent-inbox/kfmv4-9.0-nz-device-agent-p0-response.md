# 2026-08-27 · 9.0 回函 · 实验台 P0 两钩子落地：__kfmNzTermInject + __kfmNzTermScreen @ b820ad2e（term-hooks 5/5）

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审亲跑 term-hooks 5/5+三卷+cjk-inktop+npm85 不回退、两钩子走现有管线/同源落地正确；实验台 P0「能动手」前提就绪
> 回: kfmv4-9.0-nz-device-agent-p0-review.md
> 回函通知: psh
> 状态: 已核（2026-08-27 评审：Inject 走现有管线同语义、Screen 同源不建副本、可并列扩展铁律落对；term-hooks 5/5+四卷+npm85 全绿；P0 前提就绪接 P1）· 见 kfmv4-9.0-nz-device-agent-p0-verify-review.md · 代际戳 gen-2026-08-27-P0钩子-已核

## 一、落地（按二节契约 + 三节铁律）

**`__kfmNzTermInject(str)`**（term/index.ts 钩子在 takeMods 定义后）：
```
takeMods(str) → inputToBottom() → bridge.input(sessionId, text.replace(/\n/g,'\r'))
```
与 kb input 事件/compositionend 落字**同一函数序列同一语义**：粘滞修饰同路读走灭灯、落字才回底、`\r`=回车。不新辟路径，无任何绕过。

**`__kfmNzTermScreen()`** = `shell.screenText()`（shell.ts 新方法）：取壳实际渲染的屏幕行 div 文本（塌尾 `display:none` 不计）——**与 `__kfmNzTermScroll` 同源**（一个读几何、一个读文本，同一渲染态），不建副本。语义=终端「屏幕格网」：行模式=塌尾后可见行、ALT=TUI 整屏；**不含 scrollback 历史区**（语义边界已在注释写死，防后补误读）。

## 二、可并列扩展（铁律落代码注释）

后补 `InjectKey({key,ctrl})` / `InjectRaw(bytes)` / `ScreenGrid()` / `ScreenAt(r,c)` 按同款模式并列加：`window.__kfmNzTerm*` 命名、读同一状态/管线、不动本版两钩子。v1 单卡口径（与 Scroll 钩同款注释——多卡改造小步按 cardId 分键）。

## 三、考卷 term-hooks.test.mjs（5 断言全绿）

①两钩子存在且与 Scroll 无冲突 ②`Inject('echo 中文测试\r')` → 命令回显+输出双命中（真走 PTY 回路）③Screen 含提示符 ③b Screen 行数==壳可见行（同源判据）④注入后 isAtBottom=true（回底纪律在位）。
判卷修正一处：可见行选择器按结构特征（white-space:pre+height:1.25em）过滤——`.nz-term` 直属 div 含 historyDiv/光标层，裸数会多 2（首轮 ③b 红的 artifact，非实现错）。

## 四、回归

term-hooks 5/5 + bottom-anchor 10/10 + scrollback 5/5 + keybar-click 19/19 + cjk-inktop 4/4 + npm85 全绿。P0 地基就绪，P1-P4（wry 壳/闸门/report/热更/启动器化）可接。
