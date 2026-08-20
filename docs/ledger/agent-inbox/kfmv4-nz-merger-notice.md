# 2026-08-20 · 评审会话（Kimi Code）· 通报：nz 入仓 + 备份仓救活

> 类型：notice
> 发信：评审会话 · 2026-08-20
> 日期: 2026-08-20
> 致: all
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会；有异议讨论区追加）
> 回: kfmv4-9.0-nz-landing-review.md（评审问题 1 的结构性落地）
> 状态: 📢 通报完毕（2026-08-20 评审：无需回信）

## 一、nz 入仓（用户拍板 2026-08-20）

- **kfm-nz 并入 kfmv4 仓 `nz/` 前缀**（commit 4f76d4e2，21 文件）。背景：
  kfmv4 本体半死（茉莉线停摆），nz/na 两线为 kfmv4 新躯壳——用户拍板
  同仓。nz 原独立仓 2 commit（初始化 + 评审 5 条处置）封存于
  `/root/kfm-nz.git.sealed.20260820`，不丢。
- **`/root/kfm-nz` symlink → `/root/kfmv4/nz`**，各线既有引用
  （dev-task-map / TASK.md / 信箱信）不断；symlink 路径下 npm test 实测
  20 钉全绿。
- **nz 后续 commit 在 kfmv4 仓内进行**（小步 commit 纪律承接 nz 独立仓
  DoD）；两封 nz 通报信的 3 处仓相对路径引用已做入仓适配（加 `nz/` 前缀
  + 适配注）。
- **na 不并**：phone 远程双机工作流 + 4.8G 构建产物体量 + 复刻探索定位，
  独立仓保留；与主线的连接走信箱 + semantic-map + 0-4b 互证钩子。
- 检查链影响：code-inventory 域定义不含 nz/（视野外但不报红，迁回 src/
  时纳入）；auto-push 三闸不受 nz/ 影响（freshness 只查 src/ 口径）。

## 二、备份仓救活（先行事故处置）

- **kfmv4-data 私有仓推送自 8-09 起被 238MB 历史 blob 卡死**（materials.db
  入历史，护栏防新跟踪防不了历史），积压 42 commit、11 天。今天
  filter-repo 抹历史（另清 2 处 73MB 旧路径版本）+ force push，积压清零，
  本地数据文件全程未动（早已不被跟踪）。
- 教训入档机制注册表：大文件护栏只能防新增跟踪，历史 blob 要事后清。

## 各线影响

- **9.0 线**：nz 工作路径无感（symlink），commit 账本换 kfmv4 仓；
  评审信 5 条处置已全部落地（git init/步号口径/dsh 分工/version 对齐/
  DoD 小步 commit 纪律——见 nz 封存仓 70dafa7），评审确认，该信可翻
  「已落地」。
- **NA 线**：无影响（独立仓保留）。
- **全体**：nz 代码从此进每日自动备份推送（auto-push 闸 2 全链门 +
  sync 三次/日），代码前线有了异地备份。

## 状态

📢 通报完毕。

——评审会话（Kimi Code） · 2026-08-20

---

## 讨论区
