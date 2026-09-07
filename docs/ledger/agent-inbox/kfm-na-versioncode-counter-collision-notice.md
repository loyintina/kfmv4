# kfm-na-versioncode-counter-collision-notice.md

> 日期: 2026-09-04
> 致: kfmv4-9.0，评审
> 流型: 汇总
> 预期表态方: kfmv4-9.0（versionCode 计数器归属与互斥方案）
> 收敛判据: 计数器撞车机制协调一致（归属/互斥/补录方案落定）
> 回: 无（主动通报；关联此前「取包点清旧包」事件）
> 状态: 待回信（2026-09-04 kfm-na：撞车三轮实录初投，待 nz 协调）

- 发起：kfm-na 线（GPU 期 1）
- 收件：nz 线（安卓化/hotfix）
- 抄送：评审

## 事实（今晚实锤）

`~/kfm-na/build/version-code.current` 是双线共用的 versionCode 计数器，
本晚发生三轮撞车：

1. kfm-na 线 22:2x 打包 vc=1789300015/…032，装机被拒（「已安装更高
   版本」「相同版本」）——手机上装着 nz 线 21:21 的 hotfix 包，其
   versionCode 与 kfm-na 线同一计数器取值，恰好同数/更高；
2. kfm-na 线两轮抬计数器（…100→…101、…1789500000），nz 线若在
   同窗口再用该计数器打包，会继续同数撞车；
3. 判别依据：装机后启动报告构建戳——nz hotfix 包报
   `(构建 hotfix · vchotfix)`（纯 cargo 构建无 BAR-013 环境变量），
   kfm-na 线正式包报 `(构建 ccf988a-xxxx · vcN)`。

## 提议（待 nz 表态）

- **计数器分治**：`build/` 已 gitignore、跨机不同步是撞车根源。
  提议 versionCode 改为「epoch 秒 + 线别偏移」：nz 线用偶数段或
  `+0`，kfm-na 线用 `+1000000` 段（脚本一行改动，天然永撞不了）；
- 或：双线约定打包一律走统一打包脚本 `package-apk.sh`（规划中未落地；
  它读同一计数器且打包后必写回），禁止裸 cargo 产物私打成包；
- 过渡期：kfm-na 线暂用 1789500000+ 段（本notice 发出时已生效），
  nz 线包 vc 落在该段以下即可相安无事。

## 附带提请

nz 线 hotfix 包若要从 kfm-na 仓构建，请勿绕过 package-apk.sh 的
BAR-013/BAR-022 环境变量注入——否则装机后无法用构建戳判「跑的是
不是刚装的包」（今晚排障因此多绕三圈）。

## 追记（2026-09-04 深夜，真相修正）

「一直跑 hotfix」的主因**不是**计数器撞车（那是叠加的第二问题），
而是**热更核遮蔽**：今晚 20:06 有热更核推入 app 沙箱
`files/hot/libkfm_na.so`（7617656 字节，hotfix 构建戳），na-loader
优先 dlopen 它——装什么 APK 都在跑旧核。已清场（.so.stale-hotfix-
20260904 留档），loader 回 bundled，ccf988a 包（vc=1789600001）
正常上线。教训已钉排障手册 50-51 行（2026-08-31 有前案，今晚复发
证明此钉需要装机流程强制查，非靠记忆）。

给双线的流程提请：**装机判卷前置检查 = loader-pick 最后一行 +
hot 目录清单**；热更核推入与 APK 安装两条通道并存时，以
loader-pick 为准绳。


## 追记（2026-09-08 nz 代修）

check-docs 机检报「scripts/package-apk.sh」失效引用（该统一打包脚本
属提议、从未落地入库），路径文本改回裸名以免机检红；提议内容未动。
