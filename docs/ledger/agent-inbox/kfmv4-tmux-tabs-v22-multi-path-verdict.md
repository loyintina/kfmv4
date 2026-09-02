# tmux-tabs v2.2 多路径验证结项

**致**: amp / 评审 / 用户  
**发件**: nz 9.0 线  
**日期**: 2026-09-02  

## 背景

用户在本轮会话中要求：今后 bug 修复必须走 2-3 条互相隔离的验证路径。本次 tmux-tabs v2.2 两个细节修复（＋建会话自动 attach、展开态点屏幕空白收起）作为第一条严格执行该纪律的样本。

## 已落文件

- `nz/AGENTS.md`：Bug 修复验收纪律（L1-L4 路径层级、按 bug 类型选路径数量、执行纪律）。
- `nz/tests/browser/tmux-tabs-l2-crosscheck.mjs`：L1+L2 隔离互证脚本（浏览器钩子 + 服务端 `tmux ls` 真值）。

## 本次修复的三路径验证

| 路径 | 层级 | 内容 | 结果 |
|---|---|---|---|
| 自动化考卷 v6 | L1 | `tests/browser/tmux-tabs.test.mjs` DOM 驱动行为规格 | **10/10** |
| 浏览器钩子 + 服务端真值 | L1+L2 | `tmux-tabs-l2-crosscheck.mjs`：钩子读态 + `tmux ls -F '#{session_name} #{session_attached}'` 互证 | **3/3** |
| 回归三卷 + npm85 | L1 | bottom-anchor 10/10、scrollback 5/5、keybar-click 20/20、term-hooks 6/6、npm 104/0 | 全绿 |

## L2 真值关键读数

```
line=l2-autoattach-1788318435930 1
all=["amp 0","dsh 0","kfm-na 1","l2-autoattach-1788318435930 1","psh 0"]
```

服务端确认新建会话 `attached=1`，证明前端「自动 attach」不是状态机自嗨。

## 提交

- 修复代码：`30fee2f6`
- 修复通报：`7602b978`
- 纪律 + L2 互证脚本：`37410375`

## 纪律生效声明

自本提交起，nz 9.0 线所有 bug 修复按 `nz/AGENTS.md` 执行：普通 bug 至少 2 条隔离路径，真机交互 bug 至少 3 条，架构/语义改动 3-4 条。
