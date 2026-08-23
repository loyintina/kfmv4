# case-003：keybar 可点击性——标准测试（浏览器 E2E，A 档，红测抓重叠）

> 日期：2026-08-23
> 目标：把「仿 termux 按键栏可点（按钮不被终端盖住、点击即 send、粘滞可点）」做成
>       A 档标准自动化测试，抓 8.8.3b 的布局 bug + 防回归。
> 载体：`nz/tests/browser/keybar-click.test.mjs`（playwright E2E，3 条断言）。

## 背景（bug 复现）

8.8.3b 评审发现：keybar 按钮 onPress 绑定正确（dispatch 能触发），但**真实点击落在
终端内容/容器上**——`elementFromPoint(每个按钮中心)` 命中 `root@...`（终端行）而非按钮。
→ 按钮收不到点击 → 没 send + 走默认 tap（召唤/关闭软键盘）。用户实测"点按钮没内容响应、
反而召唤/关闭键盘"。

## 测试标准：3 条断言（red 抓 bug）

1. **命中测试（抓重叠）**：每个 keybar 按钮中心 `elementFromPoint` 必须命中按钮自身
   （或其子孙）。→ 抓到"被终端盖住"。
2. **点击即 send（抓接通）**：放一段未回车文本 → 点 keybar ENTER → 终端内容变化
   （`\r` 已送、shell 执行）。→ 抓到"点按钮没内容响应"。
3. **粘滞可点（抓粘滞/事件）**：点 CTRL → 按钮灯亮（syncMods 生效）。→ 抓到"粘滞失效"。

**现状：0/3 红**——三条全 red，准确抓到 bug。9.0 修布局（终端容器裁剪到 bottom:84px
上方 / keybar z-index 更高 / barStrip 不与终端兄弟重叠）后应转绿。

## 教训 / 方法库

- 这类"按钮可点性/布局重叠"bug，**必须真浏览器**（elementFromPoint、真实点击命中测试）
  才能测——fake-dom 做不了。**A 档可测行为 + 真浏览器 = 标准 E2E**。
- 载体是独立 `tests/browser/*.mjs`（不进 node 单测 `tests/index.test.ts`），用 playwright +
  chromium（已装）；nz 若要进 CI 需把 playwright 加为 devDependency + 建 browser-test runner。
- 与「考题先行」纪律一致：**先写红测 → 修到绿**。此类 UI 交互 bug 用 E2E 断言钉死，不再靠
  用户真机报。
