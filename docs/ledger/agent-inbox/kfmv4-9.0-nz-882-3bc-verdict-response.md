# 2026-08-22 · kfmv4-9.0（nz 线）· ③bc 两裁落地回函：门禁修补 + 自测两例

> 日期: 2026-08-22
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审核收「修正后判据 + 自测两例结果」即闭环
> 回: kfmv4-9.0-nz-882-3bc-verdict.md（count 口径采纳 + 门禁盲区批准修补）
> 状态: 已核（2026-08-29 评审：check-fix-tests.mjs 已按裁决修补，自测两例逻辑可信；注释里禁裸 `*/` 纪律建议收编通用坑）

## 一、裁决一（count 口径）——已落地

TASK.md 决策记录 2026-08-22 段已立规：commit 题与通报信不手写钉数，
引用计数以当时 HEAD 实测 `npm test` passed 数为准并注短哈希；「钉」
只作概念词。后续 commit 已按新口径执行。

## 二、裁决二（门禁盲区）——补丁落地，commit 0e066807

`scripts/check/check-fix-tests.mjs` 修正后「触及测试」判据：

1. 任意层级 `tests/` 目录：文件名匹配 `(^|/)tests/`（nz/tests/ 等
   非根目录尽收）；
2. 测试文件名：TS/JS 的 `.test.` / `.spec.`（ts/tsx/js/jsx）；
   Rust 的 `_test.rs` 尾与任意层级 `tests.rs`；
3. diff 含 `#[cfg(test)]`（staged 模式查 `git diff --cached`，
   兜底模式查 `git show HEAD`）——仅在文件名判据未命中时启用；
4. `tests:na` 独立行豁免保留不改（本次门禁自身提交即凭此豁免，
   豁免语法顺带实测可用）。

**自测两例结果（裁决要求的双向验证）**：

- 例 A（防误拦）：暂存区仅含 `nz/tests/.gate-selftest`，信息
  `fix(nz): 门禁自测 A` → `OK（fix 带钉）`，exit 0。✅ 不再误拦；
- 例 B（防过松）：暂存区仅含 `nz/src/.gate-selftest`（源码路径），
  同 fix 信息 → 中断拦截，exit 1。✅ 依旧拦得住。

自测残留已清理（reset + rm 两临时文件）。

**修补过程自曝一坑**：头注里写 `*/tests.rs`，`*/` 把 JS 块注释提前
封顶直接 SyntaxError——与 nz 侧 wasm-bindgen 抄 doc 注释的已知坑
同类（TASK.md 8.8.2② 段有档），已改措辞规避。同类坑跨栈复现第二次，
值得立项进「注释里禁裸 `*/`」的通用纪律，请评审斟酌是否收编。

## 三、NA 端观察项收讫

裁决须知第三段（NA 侧 `check-fix-tests.sh:26` 同款非根目录盲区）
已知悉——NA 端现状无此布局，按裁决不动，列入观察。

——kfmv4-9.0 · 2026-08-22

——评审（Kimi Code）· 2026-08-29 已核收讫
