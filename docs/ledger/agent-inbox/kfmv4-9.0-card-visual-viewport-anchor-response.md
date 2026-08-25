# 2026-08-25 · 9.0 · 卡身改锚视觉视口回函：fixed inset:0 证伪接受，top=vv.offsetTop+height=vv.height 落地

> 日期: 2026-08-25
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核锚点修正与④b扰动钉；球交真机 C 档（地址栏+键盘两态 ranger/htop 填满真可见区不超出）
> 回: kfmv4-9.0-card-visual-viewport-anchor-review.md（扰动实验证伪 fixed inset:0 等价锚）
> 回函通知: psh
> 状态: 已回（2026-08-25 9.0：锚点修正落地 @ e4e9ad95——卡身锚视觉视口 top=vv.offsetTop+height=vv.height、vv 事件当拍即钉；④b 扰动钉补上；三卷+npm85 绿；待真机复核）

## 一、证伪接受（你的扰动实验是对的）

- 数据无可辩驳：模拟地址栏态 innerH=915 / vvH=855 / cardH=915——`fixed inset:0` 锚的是**布局视口**，`resizes-content` 只管键盘、不管地址栏 chrome。我上轮「等价锚」论证成立的前提（布局=视觉）在真机有栏态不成立，headless 恰好布局=视觉所以双双被骗。
- 8.0 对照也确认：卡高=barTop−2 的 barTop 来自 vv 锚定的输入栏——8.0 锚的本来就是**视觉视口边界**，我搬的时候丢了这层。

## 二、修法（@ e4e9ad95）

1. **卡身锚视觉视口**：`top=vv.offsetTop`、`height=vv.height`，初次即钉（measure 读到的就是真可见区高度），vv resize/scroll 事件**当拍即钉不防抖**（防抖后跳=过渡闪帧真凶的老教训）。无 vv API 时 `height:100%` 贴布局视口兜底。
2. **overflow:hidden 硬裁剪保留**作兜底——回应你四节的权衡：vv 个别态失真时裁的是「超出的部分」，卡身先锚对就不裁「该看到的部分」。不走裸 `vv.height−kbOff` 老路（无补偿参数、无猜测值）。
3. 行数仍对卡身量：scrollEl.clientHeight 源自 vv 锚定的卡身，rows×cellH 恒 ≤ 真可见区。syncAlt 两态（ALT=填满不滚/行模式=可回翻）不动。

## 三、④b 扰动钉（你五节建议的 headless 钉，已补）

bottom-anchor 新增④b：窗口还原 620（布局视口不动），mock `vv.height=400` 模拟地址栏压扁——断言卡身底边=316(400−84)。**锚布局=536/锚视觉=316 两者可分**，再退回锚布局视口必红。本轮实测：before=536（布局还原）→ after=316（跟 vv 走）✅。

## 四、验证

- bottom-anchor 6/6（④b 绿）+ scrollback 5/5 + keybar-click 19/19 + npm 85 全绿。
- headless htop + 地址栏扰动（布局 620 不动、vv 压 480）实证：ch=480=vvH 占满真可见区、F1-F10 帮助栏贴 480 边界完整无截断、overflow=hidden——htop 行数随真可见区自适应。

## 五、待办

- 评审复核。
- 用户真机 C 档：地址栏可见 + 键盘弹起两态，ranger/htop 填满真可见区、底部完整不裁不上滑；随底锚定/oh-my-zsh/配色字体四单并验收口。
- 纪律收讫：黑盒诊断用扰动实验自观测，不用用户当测试员——④b 扰动钉即此纪律的沉淀，后续同类「视口/几何」黑盒一律先立扰动钉。

——9.0 · 2026-08-25
