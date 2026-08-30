# 通报：开屏进开机链落地 + 顺带定罪服务器缓存头存量 bug（nz 自验收）

- 日期：2026-08-30
- 发起：dsh（kfmv4-9.0/nz 线）
- 类型：自验收通报（角色调整后 nz 自验+通报免检；抽查权评审保留）
- 用户拍板：「把开机动画加进去，保证开机动画结束时三条线正好扫完，根据时间重新定线速度」

## 一、需求与实现

开机自播开屏，三条扫线速度不写死——按「预测就绪时长」等比缩放编排骨架，
终端首帧就绪 = 动画正好扫完收口退场。

1. **splash-core v14f→v15**（`nz/public/splash-core.js`，唯一真源）：
   - `T_OUT/T_IN` 常量变实例变量；`show({introMs})` 等比缩放——全部编排点
     （inStart/purpleIn/pupilHi/blue2V…）从这两个值几何反解，缩放后三线
     会师/孤瞳点火的相对关系不变；k clamp 0.15–8 防离谱预测拉爆编排。
   - 新增 `complete()`：首帧收口。没扫完=时钟平移直接跳到扫完帧（光束灭/
     徽标完整/活跃动画起点），定帧 SETTLE 500ms 自动淡出；已扫完=短停留
     300ms。幂等。`render(t)` 冻结帧恒用基准速度（自验收确定性不受影响）。
2. **term 插件**：`mark()` 加派 `nz-term-mark` CustomEvent（判卷取数口
   `__kfmNzTermBootMarks` 不变）。
3. **splash 壳开机自播**（`?nosplash` 关、`?splash` 只看动画不挂收口）：
   - 预测：`localStorage 'nz-splash-intro-ms'` 存上次「开屏→首帧」实测做
     本次预测；无记录=首次安装=冷启动默认 11000ms（08-28 探针实测 11.7s）；
     clamp 400–20000。自校正：每轮实测回写，下次更准。
   - 覆盖：`showFb()` 立即盖静态帧（首 paint 即黑场徽标，无白屏窗口），
     本体就绪换动画从 t=0 起播。
   - 收口：`first-frame` 到达=实测回写 + `complete()`；看门狗
     max(3×预测, 30s) 防终端 OPEN FAIL 永远盖屏；首帧比本体加载快的极端
     时序等 ready 再 complete（同 promise 先注册先跑，保证在 boot show 后）。

## 二、顺带定罪两个存量 bug（真机首验 3/6 红钓出来的）

首验现象：开屏出现、first-frame 到达、localStorage 写账——但覆层永不退场。
真机取数实锤 `NzSplashCore.VERSION === 'v14f'`（资源加载 5ms=缓存命中）：

1. **服务器缓存头 bug**：`nz/src/server/index.ts` 静态缓存头里
   `NO_CACHE_BASE`/`immutable` 变量**只算不用**——`writeHead` 只看
   `.html/.json` 发 no-cache，splash-core.js 实际吃到
   `max-age=31536000, immutable` 一年强缓存。「覆盖即生效」自落地起就没
   真生效过（落地当天真机验证走的是新 fetch 没撞上）。
2. **中毒缓存越狱**：已按 immutable 缓存 v14f 的 WebView/Via 对裸 URL
   永不再验证。修复双管：①缓存头改对（no-cache 真用上）②壳侧请求改
   `./splash-core.js?v=15`（新查询串=新缓存键，一次性越狱；此后服务器
   no-cache 已正确，覆盖文件刷新即新版）。

教训记方法库候选：「发了什么头」要用 curl -I 实测，不能只看代码意图——
死变量（算了不用）这类 bug 肉眼评审极难钓出，真机行为一探就现形。

## 三、验收（全绿）

- **真机 CDP 两轮 6/6**（新卷 `nz/scripts/splash-boot-verify.mjs`，
  playwright connectOverCDP 8026 → 手机 NZ-Agent WebView）：
  A 开屏先盖屏 / A2 首帧就绪 / B 首帧→`.out`=433ms（snap+SETTLE 路径）/
  C 预测写账（400 clamp 命中）/ D 覆层摘除 / E 第二轮 scaled 路径同样
  收口（400ms）。数据落 `/tmp/nz-splash-boot-verify.json`。
- **截图证据**：`docs/active/nine-zero/assets/splash-boot-mid.png`（扫描
  中景）、`splash-boot-terminal.png`（开屏退后 oh-my-zsh 提示符在底行、
  键栏在底，终端可用）。
- **plugtest**：splash 包 PLUGTEST_OK 零泄漏（降级有意/装卸/残留/重载
  四轮，真机页面内验房师）。
- **五卷**：bottom-anchor 10/10、scrollback 5/5、keybar 19/19、
  term-hooks 6/6、cjk-inktop 4/4（缓存修复+重启后重跑）。
- **npm 90** + typecheck + build + `nz-restart.sh` 闭环全绿。

## 四、行为变化备查

- 每次开机/热更自刷都会播开屏：暖启动预测收敛到 ~0.4–1s，首帧到达即
  收口，观感=扫线一闪而过；冷启动（首次安装）默认预测 11s，三线慢速
  扫全程盖住字体下载大头。
- 考卷兼容性：五卷全绿实证——headless 考卷等待逻辑（waitForSelector+
  秒级 buffer）覆盖开屏退场的 ~1s 窗口。
- `?nosplash` 可关、`?splash` 可手动重播（基准速度）、`__kfmNzSplash`
  CDP 口不变。

## 五、边界声明

- 预测是「上次实测」，不预测首次之外的缓存突变（如用户手动清缓存后
  第一次=按上次暖启动预测偏快，complete() 时间平移吸收，观感=扫完
  后徽标定帧等一会）——可接受，不立项。
- 字体子集化/分段加载（治 9.5s 冷启动大头）是另一个立项级话题，本次
  不顺手做。
