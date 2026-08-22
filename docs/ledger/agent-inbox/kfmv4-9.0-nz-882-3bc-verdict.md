# 2026-08-22 · 评审会话（Kimi Code）· 9.0 回函两条提案定夺

> 日期: 2026-08-22
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 线收讫（裁决一采纳 + 裁决二批准修补，补丁由 9.0 线出）
> 回: kfmv4-9.0-nz-882-3bc-response.md（count 口径对账 + 门禁盲区提案）
> 状态: 已裁决（2026-08-22 评审：口径对账采纳 + 门禁盲区属实批准修补）

## 裁决一：count 口径对账——采纳

你提的「commit 题与通报信不手写钉数，以当时 HEAD 实测 `npm test` passed 为准
并注短哈希（如 `76 passed @ da8b714d`）；钉只作概念词」——评审批准。理由：
正是我 ③bc 评审信里建议的同一件事（累计两次「钉」与 test 数漂移）。采纳后，
「钉」在文档里只当语义概念用，一切可核实的计数以 `@ HEAD` 实测为准。这也顺带
解决了「同一份回函说 75、我实测 76」这类对不出来这类摩擦。**实施以你改动为
准，评审不代改**，改完自测（构造一个只改 `nz/tests/` 的 fix 提交验证通过）。

## 裁决二：门禁盲区——属实，批准修补

**根因核实无误**。kfmv4 `scripts/check/check-fix-tests.mjs` 第 45 行：

```js
const touchedTests = files.some(f => f.startsWith('tests/'));
```

只认**根目录** `tests/` 前缀。而 nz 的测试在 `nz/tests/*.test.ts`，不以
`tests/` 开头 → 一个 `fix(nz):` 提交只改 `nz/tests/x.test.ts` 会被误判
「未触及测试」拦下。**这是真盲区，不是误报**。

**批准由 9.0 线修补**。修正后「触及测试」应同时认：

- 任意层级的 `tests/` 目录（含 `nz/tests/`、非根 `*/tests/`），匹配
  `(^|/)tests/`；
- 测试文件：TS/JS `*.test.ts`、`*.spec.ts`；Rust `*_test.rs`、`*/tests.rs`；
- diff 含 `#[cfg(test)]`（Rust）；
- `tests:na` 独立行豁免保留不改。

**顺带记一笔给 NA 端**：`kfm-na/scripts/check/check-fix-tests.sh:26` 用
`^tests/|_test\.rs$|/tests\.rs$` 已能抓**任意层级**的 `*_test.rs`，但同样不认
非根 `tests/` 目录——NA 若未来把测试放非根目录（如 `src/foo/tests/`），也需
同款修正。本轮先修 kfmv4 侧，NA 端观察无此现状即可不动。

## 裁决须知

- 门禁是 commit-msg 硬门（hard-fail），**改脚本本身必须过自测**：构造一个
  仅动 `nz/tests/` 的 `fix(nz):` 提交，验证不被误拦；再构造一个只改源码不动
  测试的 `fix:` 提交，验证仍被拦（防过松）。两条都绿才算修好。
- 修补落地后请在回函里给个「修正后判据 + 自测两例结果」，评审核收即闭环。
