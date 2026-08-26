# 2026-08-26 · 评审 · nz 终端字体换 NA 同款（na-main 商用 + na-cjk FusionPixel）——一致性 + 可能顺带解中文基线

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 把 nz 终端字体栈切为 NA 同款（NaMain 主 + NaCJK CJK/符号 fallback），@font-face 加载，cellW/cellH 用新字体正确量测（含切换后重测），A 档三卷（bottom-anchor/scrollback/keybar）+npm85 不回退；真机 ranger 中文行不再「上移几 px」或确认换字体后行为一致
> 回: kfmv4-9.0-ranger-cjk-baseline-review.md（中文基线机制判断；headless 复现不出光栅化差）
> 回函通知: psh
> 状态: 待回信（2026-08-26 评审：把 nz 字体换 NA 同款——na-main 商用主字体+na-cjk FusionPixel 中文/符号 fallback；headless 量测 ASCII/中文共享基线无相对偏移，判断「上移」非字体基线能解释,更可能是当前系统 CJK fallback 或光栅化差；换 NA 字体=一致性好+可能顺带解决;请 9.0 落地）

## 一、背景

nz 终端目前字体 = JetBrainsMonoNL NFM + 系统 CJK fallback（后者正是中文「上移几 px」的嫌疑——系统 CJK 基线/光栅化 ≠ NF）。用户拍板：**nz 换 NA 同款字体**（`local/main.ttf` 商用主字体 + `FusionPixelMono12-gb2312.ttf` 中文/符号 fallback），让 web 端与 NA 一致，也可能顺带解决中文基线。

## 二、字体文件（已就位，私有勿提交）

- 已从 `kfm-na/assets/fonts/` 拷入 `nz/public/fonts/`：
  - `na-main.ttf` = 用户商用主字体（`local/main.ttf`，ASCII/Latin）；
  - `na-cjk.ttf` = FusionPixelMono12-gb2312（**GB2312 子集 6618/6763 汉字**，像素风，SIL OFL；补终端符号/盲文/方块）。
- **私有影响**：na-main 是你私有授权商业字体（kfm-na gitignore 钉死），已加 `nz/.gitignore` `public/fonts/na-*.ttf`——**9.0 别 git add 这两文件**，只本地/部署时从 kfm-na 拷入，别进库。

## 三、请 9.0 落地

1. **index.html 加 @font-face**：`NaMain`(url /fonts/na-main.ttf)、`NaCJK`(url /fonts/na-cjk.ttf)。
2. **TERM_FONT_STACK 改**：`'NaMain', 'NaCJK', ui-monospace, Menlo, Consolas, monospace`——NaMain 主（Latin/ASCII），NaCJK 次（**CJK + 终端符号**，因为商业美术字体天然缺终端符号，NA 正是这么分工的，见 kfm-na `build.rs`/`assets/fonts/README.md`）。
3. **cell 度量适配（务必）**：换字体后 `shell.metrics` 的 cellW/cellH 会变（NaMain 是像素/美术字体，跟 JetBrainsMono 不同；FusionPixel 是 12px 像素字体）。**字格单源（048be6f8，measure 吃 shell.metrics）应能自适应，但要验证**：FontFace 加载是异步的，量格前要 `await fonts.load`（沿用字体就绪门），别量到 fallback 字宽。
4. **考卷受影响**：bottom-anchor ④e/④f 的 rows 期望值是按 cellH=16.25（JetBrainsMono）算的（如 32/19）——换字体若 cellH 变，这些 rows 期望会错位。**9.0 需重测新 cellH 并更新 ④e/④f 期望**（或断言改语义锚非硬编码像素/rows）。
5. **font-size 考虑**：现在 13px；FusionPixel 是 12px 像素字体、NaMain 不知最优尺寸。若 13px 下像素字体发虚/不对齐，9.0 可评估（如 12px 或适配），但别为它改坏整体布局。

## 四、验收

- 三卷（bottom-anchor 含④e/④f、scrollback、keybar)+npm85 不回退（④e/④f 期望随新 cellH 校准）。
- 真机 ranger：中文行**不再上移**、与 ASCII 同基线、中文 2 cell 宽、清晰、终端符号（框线/箭头）正常（NaCJK 兜底）。
- headless：换字体后 textContent/几何正常、`?debug` cellH/cellW 反映新字体（非 fallback）。

## 五、备注

- headless 光栅化 ≠ 手机，所以「换字体后 headless 是否对齐」不能当终审；**真机 ranger 中文行不复现「上移」才是判据**。
- 若换 NA 字体后真机仍上移，则是渲染光栅化差异（headless 复现不了），得走真机截图对比或接受（看用户观感）。

## 六、追加证据（2026-08-26 用户真机截图 + cjk-probe 假阴性）

用户真机 ranger 截图（/tmp/Screenshot_20260826_171822/171840/171902.jpg，评审已取回）**实锤错位真实存在**：
- **中英混排行**（`2 ts工具`、`0 hermes-蔚然`、`3 知乎-VibeCoding理论-images`）：**中文字形比英文字形更高、更满**（天花板更高，视觉上高于英文）。裁剪原分辨率逐字可见。
- **cjk-probe 的 shift=0 是假阴性**：它用「裸单个中文字符 span」测，未复刻「中英混排 + 行高亮 + 整行 span」真实上下文。真机截图才是真证据——错位明显，非 1px 级。
- 因此**别再等 cjk-probe 数字定修法**——它测不到。直接按本信三节：**实现 na-main + na-cjk(FusionPixel) 字体切换**（用户已拍板，像素等宽 CJK 字形贴格，预期能对齐），真机 ranger 中文行对齐即收口。
- 若 FusionPixel 换后仍错位，再看光栅化/其他（真机截图对比）。

——评审 · 2026-08-26
