# Vibe Coding 有哪些高效的做法/习惯？——知乎用户回答（剪藏全文）

> 原文标题：Vibe Coding 有哪些高效的做法/习惯？
> 作者：知乎用户（"纸上得来终觉浅，绝知此事要躬行。"）
> 发布时间：2026-08-12 14:42 · 美国
> 原文链接：https://www.zhihu.com/question/1995650056540410755/answer/2070882934048003335
> 剪藏日期：2026-08-21
> 剪藏说明：MHT 页面离线抓取提取全文；知乎接口对长回答正文有截断，全文以 MHT 为准。

## 正文

Test-driven development（测试驱动的开发）是现在个人觉得 the single most important 方法论。

一提到测试，大家可能就会想到各种 test case。就像 LeetCode 里面的 regular case 和 corner case，还有测 scalability 和 runtime 的 stress test 等等。**这是传统算法意义上的测试，可能仅仅是测试的 10%。**

文章分两部分：
1. 第一部分介绍 SRE 意义上的测试
2. 第二部分介绍输出本身是非确定性的 Machine Learning sense 的测试

### 第一部分

真的做过比较大一点的项目的朋友，都一定会重视 SRE（Site Reliability Engineering）相关的概念。除了代码本身在局部 module 里对正确的 input 能否输出正确结果，中大型服务往往还涉及各种**异步、并发、竞争、数据库、服务掉线、物理 bug、网络超时、版本不匹配、内存泄漏、worker 冻结、外部 dependency service（proxy、browser farm、llm）error**，以及各种 error propagation。

在传统意义上写这些测试开销会很大，因为往往需要通过 simulation（模拟）来还原现实场景配置——这已经不只是单个 program 自身的问题了，而是存在非常多外部变量。一个 program 是 deterministic（完全确定性）的；但当有一堆用户、并发数随时段不稳定、外部依赖服务不稳定、硬件规模大有硬件 bug 的可能性，整个问题就变成了一个**不可控的系统**，有非常多的 uncertainty 和 extrinsic variables。这时已不再是测算法、测模块，而是需要系统测试，也就是 SRE 的心智模式。

所以，个人亲测非常好用的方式：**除了写 correctness（输出正确性）的 test case，一定要写 simulation test case**，在一定程度上拟合出一批外部变量的 configuration 搭配，然后在不同搭配下压力测试整个系统的 robustness。基于这些 simulation test cases 让模型去做各种 SRE 措施（reporting、error discovery、watchdog、冗余备份等），会比让模型在没测试、纯凭经验、没有实际场景融入的情况下直接硬写防御措施，要来得稳健得多。

### 第二部分

有机器学习经验的读者会天然质疑：很多时候只有 computable、能被 finite state machine 直接解释的 symbolic program，才能去 run test case。但神经网络这种 distributed representation，天然输出就是 fuzzy、gradual、连续、probabilistic 的，不能非黑即白地说结果是错的，只能说它各种 metrics（accuracy、F1、precision、perplexity 等）在这个数据集上是高还是低。

现在各种 RAG、问答、分类、routing、信息抽取，已成为很多服务/系统的天然一部分——这大概是跟十年前最不一样的地方。于是，instead of 让这些模型去做很多数据点、再一个个去人工 review，个人经验是：**不如事先准备一个小规模的 benchmark（一般大概 30 个数据点可能就够了）**。

现在的时代红利是：你甚至不用自己去标这些数据点、自己去制定 annotation protocol，让网页版或干脆让 Claude Code 自己给标了就行。遇到特别困难的可以自己手标一组，再让模型去 in-context learning。实测：标音频、标视频、标 3D 模型、标点云、标文本、标图片都好用，现在模型很强。

很多时候，如果真在做业务，需求是特别特别长尾分布的，基本没办法把现成的东西拿来开箱即用，都得去定制化。里面用到的 Prompt Engineering 往往需要现场即调即用；而那些小的 Classifier 或小的 Model，则需要现用、现训练、现优化。所以这时并没有以前积累下来的现成数据集，但又要比较科学地测定 Performance 究竟怎么样，才能严谨、不凭空想象（unwishful）地进行 A/B test。所以往往个人的经验是**会去做一个小规模的 benchmark**。

这里面有个特别好用的 trick：虽然可能没有特别好的现成标签，但 **Hugging Face 上很多数据集可以拿过来作为 raw input，然后进行一番魔改（或重标注）**。然后就可以在这个小规模 benchmark 上做各种 feature engineering、调优、prompt engineering 的迭代，以及各种 harness 的迭代，而且可以有一个非常 definite、明确的数字来看到并量化这些变化。

再插一个另外的小技巧：**可以刻意造一些特别 tricky、特别 sneaky 的 corner case**（括号：即使对于 Neural Network 也有这样一说，参见以前 Neural Network Robustness 的研究）。一般准备 10 个这样的 sneaky corner case，能让模型把这些 hard case 都做对了，这个 performance 也就差不多可以依赖了。这里有个坑：一定要跟大模型说好，**禁止用特别 hard-coded、rule-based 的方式去为刷这 10 个 sneaky cases 的分数而刷**，它应该把这些 test cases 当作 unknown 来对待（treat these test cases as unknown），这样才算比较好。

最后补一句推论：如果真的想让模型去做 auto research、自己连续工作好几天完全脱手的 long horizon execution，个人经验是：**一次性准备 10 个以上的 benchmarks for each important modules**（仅 define 输入输出，怎么实现用什么 base model 都不管，让大模型自己迭代），这样能广域测试各种各样的中间指标，让整个系统的可靠性大大提升。当然，事先准备好这些 case 会比较麻烦，而且设计这种东西本身的时长和成本已经非常 high cost 了——不过大概做到这样才不算 wishful coding 吧。

## 要点提炼

1. **TDD 是第一位方法论**，但传统算法意义的测试只占 10%。
2. **SRE 意义测试**（第一部分）：中大型系统的坑是异步/并发/外部依赖/掉线等外部变量——用 **simulation test case** 拟合外部变量配置，压力测试 robustness，再让模型据此写 SRE 防御（reporting/watchdog/冗余）。
3. **ML 意义测试**（第二部分）：神经网络输出非确定性，用 **metrics**（accuracy/F1/precision）测。
4. **小规模 benchmark（~30 数据点）胜过人工 review**；标注可交给 Claude Code 自标，HF 数据集拿来做 raw input 重标注。
5. **10 个 sneaky corner case** 做对就基本可依赖；但禁止 hard-coded 刷分（treat as unknown）。
6. **long horizon execution**：每重要模块准备 10+ benchmarks（只 define 输入输出），广域测中间指标。
