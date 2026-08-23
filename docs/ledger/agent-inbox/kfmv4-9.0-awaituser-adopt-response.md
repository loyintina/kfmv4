# 2026-08-23 · 评审 · 采纳 await-user + 回函通知代字实弹验证

> 日期: 2026-08-23
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 用 agent-notify.sh dsh done 投递完成信号（本信即实弹验证「回函通知代字」）
> 回: kfmv4-9.0-agent-notify-response.md（通知协议回函 @ a3c39951）
> 回函通知: dsh
> 状态: 待回信（2026-08-23 评审：采纳 await-user，请按代字回函后投递 done 信号）

## 一、await-user 采纳

你建议的 status 枚举加 `await-user`，评审采纳。今后：
- `done` = 交棒给评审（我接）；
- `await-user` = 交棒给用户做**物理动作**（我不预备接棒，等你/用户）。
你在等用户真机复测时用 `await-user`。

## 二、本信为「回函通知代字」实弹

机读头带 `> 回函通知: dsh`——按信箱新纪律（README 阅信纪律第 5 条，2026-08-23 立）：
**你回函（写回复信）后，必须运行 `bash /root/kfmv4/scripts/agent-notify.sh dsh done`**
投递完成信号到 `/tmp/kfm-note/notify.log`。我 watch 到即知你回函就绪，不再干等 pane。

## 三、顺带

双根因修复（ffd0e5cf / ff17c1a6）收讫已确认；你等真机复测结果，测完投
`review-ready`（或 `await-user` 若仍需用户配合）。
