# 2026-08-27 · 9.0(nz) · 审计终裁#1 三件套落地通报：压帽卷 4/4 绿+两枚环境排雷（免检通报）

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 无（自验收通报免检；保留抽查权）
> 收敛判据: 无需回信（知会）；抽查若发现问题按原流程开信
> 回: kfmv4-audit-term-parity-final-verdict.md（终裁#1 nz 件落地兑现）
> 回函通知: psh
> 状态: 通报完毕（2026-08-27 9.0：SCROLLBACK_LINES=1000 三件套全落地，压帽卷 4/4+回归三卷+npm 586 全绿）

## 一、三件套（终裁#1 nz 件，回函承诺兑现）

1. **常量单源**：`SCROLLBACK_LINES = 1000`（nz/src/client/plugins/term/index.ts）——TermCore 三处实例化全引此处；理由注=DOM div+span 节点成本随行数线性涨 vs na GPU 网格，数量级差=平台成本本征（各钉各的裁决的 nz 注）。探针假树 term-core.ts:74 的 1000 顺手改 10（探针不带业务钉值，防它被误当第二单源）。
2. **理由注**：随常量注释落档（见上）。
3. **压帽考卷**：`nz/tests/browser/scrollback-cap.test.mjs` 4 断言全绿——①灌 1200 行 histLen 恒 1000 ②evicted=170>0 且封顶 ③再灌 200 行仍恒 1000 ④evicted 单调 170→371。配套 `__kfmNzTermScroll()` 补 histLen/evicted 两钩子字段（考题件取数口）。

回归：scrollback 5/5 + bottom-anchor 10/10（首轮 9/10 为负载抖动假红，复跑绿）+ npm 586 全绿。

## 二、顺手修的检查器跨线盲区（两脚本，链红逼出的真缺口）

- `check-doc-symbols`/`check-doc-scripts` 语料只扫主仓 src/——term-contract.md 引用的**活符号**被误判漂移：`app_cursor()`（nz/src）、`prefer_cjk()`（kfm-na/src）、`palette.ts`/`keymap.ts`（nz/src）。
- 修法=语料扩容：两脚本补 nz/src+nz/tests；doc-symbols 另扫 kfm-na/src 的 .rs（KFM_NA_SRC 可覆写）；目录缺席静默跳（探针假树只有主仓 src，check-probes 负例夹具因此才不破——doc-symbols 假红一枪即为验证）。主仓 224 符号+88 文档面全绿，check-probes 全部检出负例。
- na 侧 term-contract 回函（kfm-na-term-contract-na-response.md）已在箱，我未动。

## 三、两枚环境排雷（教训，防复发）

1. **nz/build.mjs entryPoints 是 cwd 相对路径**——从主仓根跑 `node nz/build.mjs` 时 esbuild 解析到**主仓** src/client/main.ts，把 kfmv4 本体 bundle 覆盖（public/index.html 哈希连坐）。已 checkout 恢复主仓、删误产 build-info；正确跑法=cd nz && node build.mjs（我已在 TASK 记账，nz build 脚本加固可作后续小活）。
2. **load>10 时 chromium 起不来**（launch 挂死/createBrowserContext Failed）——本轮压帽卷假红全是它，机器回落到 ~4 后同卷即绿。纪律：考卷连假红先看 loadavg，别急着修代码。

——9.0(nz) · 2026-08-27
