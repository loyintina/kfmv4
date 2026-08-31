# IME pan 修正二刀 + 浏览器测试迁手机——回归全绿通报（2026-08-31）

评审（psh）：

## 一、资源纪律信表态

六条纪律全采纳，本轮已照章执行：单测套 timeout 300、编译与浏览器
测试错峰（本轮编译零新增，测试全在手机）、跑前看 /proc/pressure/io
（avg10=0 才动服务器轻量卷）、杀链纪律无触发。浏览器重 IO 卷从此
默认手机跑，服务器只留 mouse-report（tmux 依赖）与轻量卷。

## 二、IME pan 修正二刀（真手指终验①定罪，bf93d78e）

上轮 a770faff 的 innerH 闸被真手指终验①实锤误判：**APK adjustResize
下真键盘连布局视口同缩**（vv 812→541 时 innerH 同缩），闸复位→永不
入态→rows 44→28 旧行为复活。旁证：终验①全程 focus=kfm-term-kb
（click→武装路径通），唯独闸挡路。

- 修正一：innerH 从入态闸退役，判别全押武装序曲（click/focus 2s 窗）
  +闩锁 30s；考卷补 ①c APK 语义钉（武装后 innerH 同缩窗→入态钉行列）。
- 修正二：打字只续闩不武装。武装若挂 input，桌面打字后 2s 内拖窗被
  误判键盘——bottom-anchor ④ 曾被打回 7/10。武装只认召唤意图
  click/focus，打字经 touchImeLatch 只续 30s 闩（合成中事件也算活跃）。

## 三、测试迁手机基建（spike 三坑全落账）

1. Termux node 报 platform=android 被 Playwright 拒→proot 内官方
   glibc node（/opt/node-v22.14.0-linux-arm64）。
2. dpkg 中断残留→force-remove-reinstreq + install-deps 全绿。
3. chromium GPU 进程 FATAL 自杀（ubuntu24.04 fallback 构建在不支持
   OS 上，gpu_data_manager_impl_private.cc:417，连 --disable-gpu 都
   拦不住 GPU 进程反复崩）→**--use-gl=disabled 一参救活**
   （headless_shell/full chrome 双验）。

落地：`nz/tests/browser/launch.mjs` 统一启动入口（服务器无副作用；
KFM_NZ_NO_SANDBOX=1 补 proot 容器参数），11 考卷接入；测试文件经
tar→Termux home→proot 落位 /root/kfm-test/tests。

## 四、回归全绿（修正后首跑）

| 卷 | 结果 | 跑在哪 |
|---|---|---|
| ime-pan | 9/9（含新 ①c 钉） | 手机 |
| bottom-anchor | 10/10（修正后首跑，关键回归） | 手机 |
| scrollback | 5/5 | 手机 |
| keybar-click | 19/19 | 手机 |
| term-hooks | 6/6 | 手机 |
| cjk-inktop | 4/4 | 手机 |
| mouse-report | 9/9 | 服务器（tmux 依赖） |
| npm test | 90/90 | 服务器（轻量） |
| cargo test | 9/9 | 服务器（轻量） |

## 五、球与记账

- 球在用户：真手指终验②（修正后全链）——点亮手机→nz 前台→点终端
  召唤键盘→打字→收键盘→快速弹收；旁观器 watch-ime-finger.mjs 后台
  落 /tmp/ime-finger-watch.log。判据：rows 恒基线、ime 跟随弹收、
  ALT st 平移。
- 记账未查：合成 tap 失灵谜（mark 落账而页面零事件，vis=visible，
  疑 CDP relay Input 域挂起史；不挡真手指判据）。
- TASK.md 已入账（a4f50921），代码提交 bf93d78e。
