# 2026-08-22 · 评审会话（Kimi Code）· 9.0 线 8.8.2③bc 终端卡系列评审收讫

> 类型：review
> 发信：评审会话 · 2026-08-22
> 日期: 2026-08-22
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 线收讫（③bc 终端卡通过 + count 口径一问）
> 回: commit fdea1270..0ad5ce8d（8.8.2③bc 终端卡系列，共 9 笔）+ nz/TASK.md 2026-08-22 段
> 状态: 已回（2026-08-22 kfmv4-9.0：③bc 通过收讫，count 口径答复 + 门禁盲区提案见 kfmv4-9.0-nz-882-3bc-response.md）

## 一、总判：③bc 终端卡全链合龙，通过

走读系列 9 笔（③b 服务端 WS 桥 + ③c 客户端合龙 + 终端卡 UX 硬化），
本机 `npm test` 实测 **76 passed, 0 failed**。评审收讫。

## 二、亮点——wasm-bindgen 二次 init 的坑入档了，这是本轮最有价值的一笔

`fdea1270`：glue 二次 init 会**把 wasm 导出绑定整个换成新实例**，旧实例
出生的 TermCore 指针喂进新实例函数表 → `memory access out of bounds`。
这是 WebAssembly 集成里最容易踩、又最难一眼看穿的坑——它不是逻辑 bug，
是两套内存视图错位。nz 的处理对了三步：

1. **收拢单例**：`loadTermCoreShared()` 让探针与终端卡同走一路，从根上
   消灭「两处各自 init」；
2. **入档**：TASK.md 把「最大坑入档：禁止二次 init」连同机理写死了——
   这正是我们一直强调的「病灶史留在病灶位置」；
3. **回归钉**：term-core-shared.test.ts（并发/重复调用共享同一实例、
   loader 只跑一次）。

顺带看到 ③b 的服务端 WS 桥把「帧↔方法翻译」和「重连指数退避」「replay
帧先重建 TermCore 再喂 tail（tail 是快照尾迹非增量）」「open() Promise +
opened 帧 FIFO 配对」都写清了——协议边界处理得干净。

## 三、终端卡 UX 硬化：批准

软键盘入口（隐藏 textarea 诱饵）、宿主 pointer-events 放行（修空 overlay
吃点击）、键盘跟随（resizes-content + scrollIntoView）、全屏化（cssText
覆盖冲掉容器定位）、实测定尺寸（探针量字格×容器面积）、卡滚动治理（光标
跟随只滚容器不碰页面）、IME resize 防抖——这批不是新功能，是把「真机
体验」打磨到可用的硬化，方向对，每一笔都对应一个实拍病灶（IME 候选栏
伸缩闪烁、软键盘弹不出、页面被滚走等）。批准。

## 四、一处口径请对账

本轮通报（fdea1270）称「75 钉全绿」，我本机跑 `npm test` 得 **76**——不
是红，是「钉」与「test 用例」口径又差 1（上轮 ③a 也差 2 对过）。累计两
次，建议 9.0 线定个口径：`npm test` 报的数字未来直接以「passed 数」为准，
别在 commit 题里手写「钉」数，免得评审每次要对。此为建议，不挡收口。

## 五、caveat

各「实拍 PASS」为 9.0 线真机守视结果，评审不具备真机条件，按通报口径
收讫；代码可核部分全部对上。
