# tmux-tabs v2.2 细节修复通报

**致**: amp / 评审  
**发件**: nz 9.0 线  
**日期**: 2026-09-02  
**提交**: `30fee2f6`

## 用户仲裁（第五次）

用户在真机验收 v2.1 会话化时提出两个交互细节：

1. **＋建会话后应自动进入并聚焦**：新建会话点确认后，不应只把标签挂上再等用户二次点击，而应直接 attach 到新会话，标签排保持展开、聚焦指示落位。
2. **展开态点屏幕空白区域应自动收起标签栏**：用户展开标签排挑选窗口，挑中后点击终端区域开始操作时，标签栏应自己关闭，不要一直挡在顶部。

## 修改内容

### client: `src/client/plugins/tmux-tabs/index.tsx`

- `onNewConfirm`：非重名会话创建成功后，立即调用 `enterSession(name)`，完成 `new-session -A -s <name>` 注入 + `attachedRef` 落位 + 标签排保持 `EXPANDED`。
- 展开态增加全屏透明 `data-tmux-backdrop` 层（zIndex=30，低于把手 z=41 / 标签排 z=40），点击该层触发 `onExpand(false)` 收起回 `HANDLE`。

### spec: `docs/tmux-tabs-v2-state-machine.md`

- T5/T6 终点由 `HANDLE` 改为 `EXPANDED`（自动 attach 聚焦）。
- 新增 T14：`EXPANDED` → 点屏幕空白 → `HANDLE`。
- 考卷映射升级为 v6，新增 ⑧ 覆盖 T14。

### test: `tests/browser/tmux-tabs.test.mjs`

- v6：钉 ② 验证自动 attach（state=EXPANDED / attached=name / 屏幕含状态行）。
- 钉 ③ 改为 T3 点聚焦 detach。
- 新增钉 ④ 验证 T2 未附点标签 attach。
- 新增钉 ⑧ 验证 T14 backdrop 收起。
- 钉 ⑨ 为 kernel 注册表 + 词汇表互证。

## 验收结果

- **tmux-tabs v6**: 10/10 通过
- **bottom-anchor**: 10/10 通过
- **scrollback**: 5/5 通过
- **keybar-click**: 20/20 通过
- **term-hooks**: 6/6 通过
- **npm test**: 104/0 通过

## 待用户真机 C 档

请刷新 nz 页面后验证：

1. 点 ＋ → 输入新会话名 → 确认，终端应直接切换进新会话（标签排仍展开，聚焦指示落位新会话）。
2. 展开标签排后，点终端内容区域，标签排应手气收回到左上角把手。

两个细节均无额外已知风险；前一版遗留的「WS 半开死」链路健壮性问题仍未处理，用户已拍板先不挡本线。
