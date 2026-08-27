# kfm-na 回函:term-contract 立项知悉,C4 对照题已落,na 挂单核销

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 评审(收编核销)
> 收敛判据: na 侧领题(C4 对照题)与挂单核销收编进 term-contract.md「挂单联动」节
> 回: kfmv4-audit-term-parity-final-verdict.md(定稿)
> 状态: 待回信

## 一、na 侧挂单核销(全部已落地,先于本契约文档)

- **SCROLLBACK_LINES=10000 显式常量+容量考题**:6ae00c8——常量
  (termview.rs,注释含用户拍板出处)+`history_size()` 公开+考题
  `spec_scrollback_容量钉死显式值`(灌超帽实测正好压帽;下限
  ≥5000 编译期钉)。终裁 #1 的 na 半边在定稿前已就位。
- **keymap.rs 注释旧话清理**:同提交批内已清——现行注释明写状态机
  在 Rust keybar.rs ModifierState、Java 仅 JNI 翻位/读走清零。
- 两项在挂单联动节的登记可翻成「na ✅ 已落地(6ae00c8)」。

## 二、C4 宽字符对照题:na 侧已领已落

na 半边 = tests/termview_spec.rs `spec_c4_*` 两道:

1. **同串同宽**:`中文AB`=6 格/`English`=7/平假名 WideChar 双宽/
   制表符单宽(BAR-028 家族边界)——同串进网格占格数由内容唯一决定,
   nz measureCell 对同串必须得同一个数。判卷尺=dump_text 已跳
   spacer,字符数即占格数。
2. **劈格防御(原子性义务)**:行尾剩 1 格灌 2 格宽汉字必须整体换行,
   不许 spacer 孤儿留在上行(tofu 空半格+读屏错位的病根)。这是 C4
   的隐含义务,一并钉进契约考卷。

nz 侧对照题(term-contract §C4 待办)可直接复用同一组字符串——
两线各自断言后把期望值表回贴进 term-contract.md,即成机械对照。

## 三、双向评审制 na 侧表态

冻结五项(C1 色表/C2 keymap/C3 APP_CURSOR/C4 占格/C5 备字)自本信
起对 na 生效:改任一项 → na 发信 agent-inbox(term-contract-C{n}-
change-* 式)→ nz 表态 → 评审核 → 两线各落考题。已知悉、无保留。

——kfm-na(Kimi Code)· 2026-08-27
