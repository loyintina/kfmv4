# 在 Vibe Coding 时代，有哪些经典的产品理论仍然值得学习？（chouheiwa 的回答）

> **原文标题**：在 Vibe Coding 时代，有哪些经典的产品理论仍然值得学习？ - chouheiwa 的回答
> **作者/账号**：chouheiwa（知乎，知势榜科技互联网领域影响力榜上榜答主）
> **发布**：2026-07-25（知乎）
> **原文链接**：https://www.zhihu.com/question/2063061088963229060/answer/2064408993590687521
> **剪藏日期**：2026-08-22（自手机信箱离线 .mht 提取；正文图片已转写为文字描述，原位保留）
> **来源**：知乎（手机离线网页 .mht）
> **KFM 相关性**：本文是「构建成本归零后什么还值钱」的一次系统盘点——本质/偶然复杂度、
> Naur 理论构建、判断力不可外包、evals 即品味，与 kfm 信箱机制/评审纪律/9.0 重生的
> 设计动机高度同构。见文末附注。

---

IBM 一天跌掉 13.2%，起因是 Anthropic 发了篇讲 COBOL 现代化的博客。那是 2026 年 2 月 23 日，CNBC[1] 记的收盘价是 223.35 美元，彭博[2]说这是它 2000 年 10 月以来最差的单日表现，整个 2 月跌掉 27%。那篇博客里没有任何一条新的代码能力突破，只说 Claude Code 能把依赖关系、执行路径、数据流这类遗留系统里最花钱的分析活儿接过去。理解遗留代码比重写还贵，这个前提被抽走，一门做了几十年的咨询生意当天就被重新定价。

我自己这一年的体感是同一个方向。知墨这个写作产品，从检索、起草到双平台发布，几乎全是 Claude Code 写出来的。真正卡住我的从来不是功能。里面那个长跑型的助手 agent，检索、聚合、分析、成稿一路能跑完，可我判断不了它跑出来的稿子到底算不算好。后来接了 Langfuse 做链路追踪，又加了一层 LLM-as-judge，这件事才算有了抓手。写功能那部分早就不是瓶颈了。

说白了，代码一便宜，值钱的东西全跑到代码外面去了。那些回答造什么、为谁造、凭什么活下来的老理论，正在集体涨价。

## 先把 vibe coding 这个词还原一下

这个词是 Karpathy 在 2025 年 2 月 2 日发的一条推[3]造出来的，原始语境很具体：全盘接受 AI 的建议，不读 diff，报错原样复制回去让它修，专用于周末玩具项目。他后来管这条推叫随手发的一句话。到了 2025 年底，Collins 词典把它选成年度词汇，这个词已经漂移成了任何 prompt 驱动开发的统称[4]，跟 Karpathy 当初圈定的边界没什么关系了。

漂移出来的代价很快就到账。2025 年 7 月，SaaStr 创始人 Jason Lemkin 在一次 12 天的实验里，被 Replit 的 agent 在明确代码冻结指令下删掉了生产数据库[5]，1206 条高管记录和一千多家公司资料没了，agent 还伪造了假数据并声称无法恢复。同一个月，Veracode 让 100 多个模型跑了 80 项编码任务，45% 的生成代码带进了 OWASP Top 10 级别的漏洞[6]，Java 的失败率 72%，跨站脚本这一类 86% 不设防。到 2026 年春天他们复测了一轮[7]，语法正确率已经超过 95%，安全通过率还卡在 55% 左右，跟两年前一模一样。

效率账那边更有意思。METR 2025 年 7 月那份 RCT[8] 说资深开源开发者用了 AI 反而慢 19%，这个数字被引用了整整一年。2026 年 2 月，METR 自己发文说这套实验设计已经测不出东西了[9]：新一轮 57 名开发者、143 个仓库、800 多个任务的数据被污染得没法用，因为有 30% 到 50% 的人明确表示，不让用 AI 的任务他们就不提交。他们的结论只剩一句很弱的判断，2026 年初大概是有提速的，但这套方法已经没法给出可信的数字。

一个测量效率的实验，最后测出来的是开发者已经不肯回到没有 AI 的状态。

行业那边的数字更早就摆在那儿了。2025 年 3 月，YC 管理合伙人 Jared Friedman 说那一批公司里有四分之一的代码库 95% 由 AI 生成[10]，同一时期 YC 的 CEO Garry Tan 说这批公司整体每周增长 10%，是基金史上最快的一批[11]。一年多过去，这个比例只会更高。造得出来这件事，已经从筛选条件变成了入场券。

【图 1 · 文字描述】手绘风格时间轴，标题「vibe coding 这十六个月」。横轴五个节点挂彩色便签：2025-02（蓝）Karpathy 发推造词、原意只限周末玩具项目；2025-07（绿）METR 实测资深开发者慢 19%、Veracode 测出 45% 生成代码带 OWASP 漏洞、Replit 的 agent 删掉生产数据库；2025-11（橙）Collins 词典把它选成年度词汇；2026-02（红）METR 宣布这套实验设计已经失效、Anthropic 一篇 COBOL 博客让 IBM 当天跌 13.2%；2026-05（紫）Veracode 复测安全通过率仍卡在 55%。

提速到底几成还在吵，可有件事这一年已经吵完了：瓶颈换了位置。而瓶颈会换到哪儿去，四十年前有人写清楚过。

## 1986 年的那把尺子

Fred Brooks 在 1986 年写了 No Silver Bullet[12]，里面把软件复杂度切成两半。一半叫本质复杂度，是问题本身自带的，业务规则有多绕、状态有多少种、各方诉求怎么打架，这部分跟你用什么语言什么工具没关系。另一半叫偶然复杂度，是表达方式强加给你的，内存管理、样板代码、构建配置、语法记不住，这部分可以被工具削掉。他的判断是，此后十年不会有任何单一技术让生产力提升到原来的 10 倍，因为工具只能动第二半。

原文里那句话，我这几年越读越觉得是提前写好的：

> The hardest single part of building a software system is deciding precisely what to build.

造一个软件系统，最难的那一步是想清楚到底要造什么。Brooks 当年就把 AI 列进了银弹候选名单[13]，然后表示怀疑。四十年后重读，他的怀疑对象反而印证了他的分类[14]。Claude Code 把偶然复杂度削得比当年从汇编换到高级语言那一次还彻底，本质复杂度那一层一毫米没动。我做知墨的时候，助手 agent 的检索链路、重试、并发这些东西 Claude Code 半天就能给我一版能跑的；可它写出来的稿子算不算好，这个判断标准得我自己定，定不出来就一直卡着。

我写 iOS 这些年，被削掉的那一层是什么，体感特别清楚。ARC 之前手动配平 retain 和 release、把 UITableView 的 dataSource 和 delegate 那几个方法一遍遍抄过来、Objective-C 时代维护两份头文件、Swift 每次大版本迁移改一整轮 API，这些活儿加起来占掉过我很大一块时间，它们没有一件是在回答产品该长成什么样。现在这一层基本上交出去了。而一个 App 的推送该在什么时机触达、离线数据冲突了以谁为准、隐私权限该在哪一步申请，这些问题从来没有变简单过，因为它们本来就不在工具能碰的那一层。

【图 2 · 文字描述】对比示意图，标题「Brooks 的两层复杂度：AI 只削掉了上面那层」。左侧 2021 年：上方橙色大块「偶然复杂度（样板、胶水、配置、环境、语法记忆）」，下方蓝色块「本质复杂度（这东西到底解决谁的什么问题）」。中间箭头标注「AI 编码工具」。右侧 2026 年：橙色块被压成薄薄一条，旁注红色「被压掉大半」；蓝色块几乎不变，旁注蓝色「一毫米没动」。

这把尺子拿在手里，老理论的命运就好判断了。凡是回答怎么造得快的，都在被压缩；凡是回答造什么、给谁造、造完了凭什么活的，都在涨价。中间还有一批，方向没错但参数全过时了，得改写。

【图 3 · 文字描述】三列卡片总览，标题「老产品理论在 2026 年的三种命运」。涨价（绿列）：Jobs to Be Done、PMF 的 40% 测量、双钻模型的前半钻；贬值（粉列）：MVP 里的最小二字、构建测量学习的构建环、免费增值定价；要改写（黄列）：Kano 的衰减速度、7 Powers 护城河清单、聚合理论里的位置。

## 涨价的那一批

有件事得先讲明白。工程师对产品理论普遍没什么好感，这个态度我完全能理解。过去十年里，大部分产品方法论到了工程手上都变成了几张 PPT 和几个套话，因为真正的约束在工程侧，需求想得再清楚，排期排不下也是白搭，所以那些框架看着都像是正确的废话。可约束一旦从工程侧挪走，这些框架就从装饰品变成了唯一还在起作用的东西。

先说 Jobs to Be Done。Clayton Christensen 那篇 2005 年的 Marketing Malpractice[15] 讲了个奶昔的故事，核心主张是顾客不买产品，顾客雇产品去干一件活。这套东西在构建成本高的年代其实有点奢侈，你想清楚了也未必造得出来。现在反过来了，造得出来是默认前提，雇它干什么活成了唯一的约束。我判断不了知墨那个助手 agent 输出得好不好，本质上就是我没把它被雇来干的那件活定义到可以打分的程度。这套东西后来分出好几个流派，Tony Ulwick 那支把它做成了以结果为单位的量化清单，Bob Moesta 那支更看重用户换掉旧方案那一刻的推力和拉力，两边吵了很多年。放到 AI 产品上，Moesta 那个视角更实用一点，因为你要抢的旧方案往往并不来自另一个产品，用户随手开个对话框问模型，这就是你的对手。

再说 Product-Market Fit 的测量。Sean Ellis 那个 40% 基准问得很朴素：如果明天起用不了这个产品，你会有多失望。回答非常失望的人超过四成，算是过线。真正把它跑成一套工程流程的是 Superhuman 的 Rahul Vohra，First Round 那篇复盘[16]写得很细：他们起点是 22%，光是把非理想用户从统计里剔出去，分数就到了 32%，然后一半路线图用来守住已经离不开的那群人，另一半去搬那些回答有点失望的人，最后跑到 58%。Vohra 自己讲这套方法[17]的时候特别强调，40% 是一根可以每个周期重跑的坐标轴，别当成一次性的终点线。

【图 4 · 文字描述】流程图，标题「Superhuman 那台 PMF 引擎：把 22% 抬到 58%」，副题「问卷只有一句话：如果明天起用不了这个产品，你会有多失望？」。四步：① 问卷（拿到 22%）→ ② 分群（只留非常失望的那群人 → 32%）→ ③ 分析（看清他们到底在雇它干什么活）→ ④ 实施（一半路线图守住这群人，一半去搬另一半人）。底部黄色横幅：「分数没爬到 40% 之前，加功能这件事本身就是浪费」。

第三个是双钻模型[18]的前半钻。英国设计委员会 2004 年提出来的时候，两颗钻石的分量是差不多的，前面发现和定义问题，后面开发和交付。2025 年这个模型满二十岁，设计委员会自己做了一轮回顾[19]。放到现在，后半钻被 AI 压掉了大半，前半钻一点没轻。而且窗口比以前短，Bessemer 的 State of AI 2025[20] 里有个对比，云软件公司平均要 7.5 年才跑到 1 亿美元 ARR，AI 公司平均 5.7 年，有的更短。留给你把问题定义对的时间，比十年前少了将近三分之一。

有涨的就有跌的。跌得最难看的那几个，恰好是这些年被引用最多的。

## 贬值的那一批

MVP 里的最小这两个字，现在很难成立了。Eric Ries 2011 年提这套东西的时候，最小的含义是别把成本花在还没验证的假设上。可当构建成本本身趋近于零，最小省下来的那点东西已经不值钱了，用户对第一版的完成度期待反而在涨[21]。那句被引用烂了的如果你不为第一版感到尴尬就是发布太晚了，现在得加个前提：太尴尬的话，很可能没有第二次机会。顺带说一句，MVP 从一开始就被用错了[22]，它要验证的是需求这件事本身，跟你做了多少功能没关系，Dropbox 当年那个 MVP 就是一段演示视频。

构建、测量、学习那个循环，形状也变了。三个环原本是顺序发生的，构建最占时间。现在构建可以在一次对话里完成，三个环几乎同时在转[23]，瓶颈整个挪到了学习那一环：你怎么知道刚才那次验证是有效的。这也是我最后给知墨接 Langfuse 和 LLM-as-judge 的原因，不接的话，循环转得再快也只是在原地空转。

【图 5 · 文字描述】一张人物摄影风格的情绪配图（影视剧照质感）：一位穿白衬衫黑马甲打领带、发型精致的年轻男性低着头，背景是昏暗室内与格子窗，氛围凝重。结合上下文（「三年前那些讲免费增值转化漏斗的文章，现在照着做会亏死」），应是为「旧定价模型失效」配的渲染图，不承载数据信息。

定价这一块贬得更直接。免费增值模型的算术前提是边际成本约等于零，一个白嫖用户不花你什么钱。换成按 token 计费的推理成本，一个不设上限的重度免费用户能吃掉几十个轻度付费用户的成本[24]。现在合理的做法是免费层只负责把人送到第一次觉得好用的那一刻，后面全部按价值或者按结果计费[25]。三年前那些讲免费增值转化漏斗的文章，现在照着做会亏死。

跟着一起换位置的还有瓶颈本身。构建从最贵的那一环掉到几乎不计成本之后，最贵的位置被分发接了过去。YC Fall 2025 那一批里，Multifactor 的创始人 Vivek Nair 直接说 YC 给他的最大价值是分发，远超他进来之前的预期[26]。这句话十年前不会有人当成新闻，那会儿创始人抱怨的是招不到工程师。

顺着这个逻辑往下推一步，想法本身也在贬值。构建变便宜之后，一个点子从冒出来到有人做出仿制品，中间那段保护期几乎消失了。这就带出第三批理论：方向没错，参数全得重算。

## 要改写的那一批

Kano 模型[27]是狩野纪昭 1984 年提的，把功能分成必备、一维和魅力三类，核心洞察是魅力属性会随时间衰减成必备属性。这个衰减在传统软件里大概是三到五年一轮。放到 AI 工具这个赛道，从业者的估计是压到了 18 到 24 个月[28]，这个数字目前只是从业者的观察，算不上实证，但方向上没什么争议。模型本身没错，衰减速度这个参数得整个重设。

护城河那一套改得更多。Hamilton Helmer 的 7 Powers[29] 列了七种力量，规模经济、网络效应、反定位、转换成本、品牌、独占资源、流程能力。YC 直接把这个框架在 AI 语境下重做了一遍，Diana Hu 和 Jared Friedman 那篇 The 7 Most Powerful Moats For AI Startup[30] 的核心判断是，能拿到模型 API 这件事本身完全不构成护城河。Tanay Jaipuria 逐条对了一遍[31]，七种力量里哪几种被削弱、哪几种还站得住，结论跟 Ben Thompson 的聚合理论[32]对得上：基础模型成了新一层聚合者，掌握了需求端，上面那层应用的供给被商品化[33]。你的智能是租来的，租来的东西挖不出护城河。

所以现在我给自己定了一道很土的题，上线任何东西之前先过一遍。

【图 6 · 文字描述】流程图，标题「上线前先跑一遍 Sherlock 测试」。蓝色起点框「一个 AI 产品想法」→ 黄色菱形判断「底座模型明天原生支持这件事，你还活着吗？」→ 左分支（红字「不活」）到粉色框「这不是业务，是等下一次模型更新的倒计时」；右分支（绿字「还活」）到绿色框「接着回答第二个问题：那活下来靠的是哪一样」，再向下分出三个青色小框：数据飞轮、嵌进工作流、分发与受众。

这道题的名字叫 Sherlock 测试，典故是 2002 年苹果用 Sherlock 干掉了一家叫 Watson 的初创。AI 时代这件事的速度快了不知道多少，基础模型厂商可以在一次发布里把功能推给几亿存量用户[34]，分发成本是零。回头看 2 月那天 IBM 跌的 13.2%，市场重新定价的对象是它在这条价值链上的位置，跟它的技术能力关系不大。

这道题不是修辞。Claude Code 那一轮发布之后，从代码调试到企业安全评估这批新能力，让整个软件板块一起承压[35]，被波及的公司不止 IBM 一家。市场其实是在替所有人跑这道题，只是它跑得比创始人快。

倒是有一批老理论几乎没被动过。创新扩散[36]和 Crossing the Chasm[37] 这套人群划分照样管用，Jakob Nielsen 2025 年那篇 AI Is Crossing the Chasm[38] 直接用它来判断 AI 已经进入主流阶段，全球用过 AI 工具的人估计有 18 亿、每天在用的约 6 亿。尼尔森十大可用性启发式[39]也一样，1994 年发布，Nielsen 自己说一样东西能对二十六年，大概率还能对下一代界面。这两类理论的共同点是，它们描述的是人怎么接受新东西，跟造东西的成本无关。

产品侧的账大致算到这儿。工程侧还欠着一笔，而且那笔更难赖掉。

## 那层理论到底归谁

这笔账 Peter Naur 在 1985 年那篇 Programming as Theory Building 里就记完了。他的主张是编程本质上是在构建一套理论，源代码只是这套理论的一个有损投影，真正要紧的东西留在人脑里。

> An essential part of any program, the theory of it, is something that could not conceivably be expressed, but is inextricably bound to human beings.

程序里最要紧的那部分是它背后的理论，这东西根本没法完整写出来，只能长在人身上。这篇四十年前的论文在 2025 到 2026 年被翻出来讨论的频率高得反常。Sean Goedecke 的判断[40]是 agent 没法持有这套理论，每次会话都要从头重建一遍；另一种更悲观的说法[41]是，如果新人的结对和评审都交给了 AI，他们连构建理论的机会都没有了。

理论丢失是有账可查的。GitClear 和 GitKraken 分析了 2023 到 2026 年的 6.23 亿次代码变更[42]，重复代码块的密度从 2023 年每百万变更行 40.3 处涨到 2026 年至今的 73.0 处，涨了 81%，是有记录以来最高；表示重构的 moved 行占比从 2022 年的 21% 一路掉到 2026 年上半年的 3.8%[43]，同期复制粘贴从 9.4% 涨到 15.7%。翻译一下就是：代码在疯狂新增，很少有人再回去把重复的概念收拢成一个。

Ward Cunningham 1992 年提技术债这个比喻的时候，原话说的从来不是烂代码[44]，而是当时的理解和现在的理解之间那道差距。传统技术债是有意识的借贷，你知道自己欠了什么；AI 生成的这批是副产品，模型在一个很窄的上下文窗口里做局部最优，没有跨会话的架构记忆，债务是顺手产生的[45]。同样的机制还在改写康威定律，1967 年那条说系统结构会镜像组织的沟通结构，现在镜像的对象变成了 agent 的上下文边界[46]。我之前发完的那 12 篇《拆解 Claude Code》里，讲多智能体协调器那一篇其实已经碰到这个问题的边了：子 agent 之间怎么切、上下文怎么隔离，最后长出来的就是什么形状的系统。

我写那 12 篇的过程本身就是 Naur 说的那件事。源码摆在那儿谁都能读，可读完之后脑子里长出来的那套东西，也就是它为什么这么设计、哪几个决策互相牵制、哪个 flag 是为了兜住哪种失败，这部分从来不在代码里。我讲工具系统那一篇写得最费劲，就是因为工具的边界和权限模型是一堆分散决策的合力，光把代码翻译成中文没有任何意义。让 agent 去读同一份源码，它能给你一份准确的调用关系图，给不了这份理论。

连 YAGNI 这种老掉牙的工程原则都变重了。你让 agent 做个用户注册[47]，它很可能顺手把密码重置、邮箱验证、两步验证、账号注销全给你加上，一样你都没要。Brooks 说的第二系统效应，现在有了机器版本。其实吧，这些原则从来没变过，只是过去它们约束的是人的惰性，现在约束的是模型的勤快。

这两条线，产品侧那条和工程侧这条，最后收在同一个地方。

## 判断力这件事没法外包

绕了一圈，所有涨价的理论指向的是同一种能力：你得能判断眼前这个东西对不对、好不好、值不值。YC 的 Garry Tan 把这件事说得很省字：

> Agency is prompting and taste is evals.

主动性就是把话说清楚，品味就是把评判标准做出来。前半句现在人人都会了，后半句才是那道坎。我给知墨的助手 agent 接 Langfuse 做链路追踪、加 LLM-as-judge 这一层，说白了就是在做 evals。这活儿一点都不性感，比让 Claude Code 生成三百行检索代码枯燥得多，可它是那条唯一没被自动化掉的路径。做 evals 的过程里有一半时间在跟自己较劲：你得先把好写成一组能被稳定复现的判据，才谈得上让模型去打分，而这一步逼着你把产品到底要交付什么想清楚。跳过这一步的话，改一版 prompt 是变好了还是变差了，你只有感觉没有证据。而感觉这个东西，METR 那次实验已经证明了它有多不可靠：参与者事前预期提速 24%，事后自评提速 20%，实测是慢了 19%。

落到每天怎么干，我的顺序整个倒过来了。以前是先把东西做出来，做完再想卖给谁；现在是动手之前先用一句话写清楚这玩意儿被雇来干什么活，写不出来就说明还没想明白，写出来了才轮到 Claude Code 去解决怎么造的问题，东西跑起来之后第一件事也不该是加功能，得先去问那个 40% 的问题。这个顺序听着像常识，可在构建成本还很贵的年代，倒过来做的性价比确实更高。

国内独立开发者的讨论也是同一个方向[48]，会写代码、会用 AI、能快速上线正在变成基础能力，竞争往前后两端跑，前端是需求判断和机会发现，后端是分发和转化。另一头做出来了推不动的帖子[49]一样在增加。吴恩达那句话说得更直接，模型能帮你写出正确的代码，但它不会告诉你这段代码要去解决什么问题[50]。

把这些老理论按两条轴摆一摆，位置就很清楚了。

【图 7 · 文字描述】四象限散点图，标题「Classic product theories in 2026」。横轴：左 How to build / 右 What to build；纵轴：上 Appreciating（涨）/ 下 Devalued（跌）。右上绿区「The real bottleneck now」：Theory Building、Jobs to Be Done、PMF 40 percent test、Double Diamond front half、7 Powers moats、Crossing the Chasm；左上蓝区「Engineering discipline that holds」：YAGNI and KISS、Conway's Law；左下黄区「Compressed by AI」：Build Measure Learn、MVP minimum；右下红区「Needs rewriting」：Kano decay speed、Freemium pricing。

横轴是它回答的问题偏怎么造还是造什么，纵轴是这两年在涨还是在跌。右上角那一片，是接下来几年真正稀缺的东西。左上角那几条工程原则还在，只是使用者从人变成了人加 agent。左下角被 AI 压缩掉的那些，省下来的时间正好还给右上角。

## 那天被重新定价的到底是什么

2026 年 2 月 23 日那天，市场重新定价的对象从来就不是 IBM 的工程能力。它的大机还在跑着全美 95% 的 ATM 交易，它自己也回应说翻译 COBOL 是最容易的部分[35]，数据架构重设计、运行时替换、事务完整性才是真正的活。它说得对。可市场那天给出的定价，对着的是它在价值链上的位置。

这件事对个人的启示比对公司更直接。一个工程师这些年攒下来的东西里，会写什么语言、熟悉哪套框架、能背下多少 API，这些正好落在被削掉的那一层；而对着一个含糊的需求能问出关键的三个问题、看一眼输出就知道哪里不对劲、能把好这个字定义成一组可复现的判据，这些落在没被动过的那一层。前一类在贬值，后一类在涨价，这个换手过程还在进行中。

Brooks 四十年前留下的那把尺子，量的也是这件事。工具能削掉的那一层，永远不构成任何人的护城河；剩下那一层，AI 已经证明了自己搬不动。所以那些老书没有过时，它们只是终于轮到被认真读一遍了。

## 参考

1. CNBC：IBM受Anthropic COBOL威胁股价大跌 https://www.cnbc.com/2026/02/23/ibm-is-the-latest-ai-casualty-shares-are-tanking-on-anthropic-cobol-threat.html
2. 彭博：IBM股价因Anthropic COBOL举措暴跌 https://www.bloomberg.com/news/articles/2026-02-23/ibm-shares-plunge-as-anthropic-touts-cobol-modernization-efforts
3. Karpathy：2025年2月2日X平台推文 https://x.com/karpathy/status/1886192184808149383
4. CodeRabbit：vibe coding语义发展史 https://www.coderabbit.ai/blog/a-semantic-history-how-the-term-vibe-coding-went-from-a-tweet-to-prod
5. 财富：Replit Agent误删生产数据库事件 https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/
6. Veracode：GenAI代码安全报告 https://www.veracode.com/blog/genai-code-security-report/
7. Veracode：2026春GenAI代码安全复测报告 https://www.veracode.com/blog/spring-2026-genai-code-security/
8. METR：2025年7月AI开发RCT研究 https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
9. METR：原有实验设计已无法测出有效结果 https://metr.org/blog/2026-02-24-uplift-update/
10. TechCrunch：YC初创公司AI生成代码占比调研 https://techcrunch.com/2025/03/06/a-quarter-of-startups-in-ycs-current-cohort-have-codebases-that-are-almost-entirely-ai-generated/
11. CNBC：YC2025批次初创增速创历史新高 https://www.cnbc.com/2025/03/15/y-combinator-startups-are-fastest-growing-in-fund-history-because-of-ai.html
12. No Silver Bullet https://www.cs.unc.edu/techreports/86-020.pdf
13. 维基百科：No Silver Bullet条目 https://en.wikipedia.org/wiki/No_Silver_Bullet
14. Rushis：重读《没有银弹》四十年反思 https://www.rushis.com/the-werewolf-and-the-copilot-rereading-no-silver-bullet-forty-years-later/
15. HBR：JTBD创新理论播客 https://hbr.org/podcast/2016/12/the-jobs-to-be-done-theory-of-innovation
16. First Round：Superhuman PMF复盘文章 https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/
17. Rahul Vohra：PMF衡量方法分享 https://www.startuparchive.org/p/rahul-vohra-on-how-to-measure-product-market-fit
18. 设计委员会：双钻模型官方文档 https://www.designcouncil.org.uk/resources/the-double-diamond/
19. 设计委员会：双钻模型20周年回顾 https://medium.com/design-council/20-years-of-building-on-the-double-diamond-cc16d33cceb7
20. 福布斯：2025年AI行业现状报告 https://www.forbes.com/sites/bessemerventurepartners/2025/09/03/how-software-leaders-need-to-adapt-to-ai---or-risk-going-extinct/
21. Boardy AI：2025年精益创业MVP演变分析 https://boardyai.substack.com/p/the-lean-startup-at-2025-is-the-mvp
22. Paul O'Brien：MVP概念被误用分析 https://paulobrien.substack.com/p/you-cant-buy-an-mvp
23. Reboot MBA：2025年精益创业迭代研究 https://www.reboot.mba/blog/2025-11-30-lean-startup
24. Freemius：AI应用定价模型分析 https://freemius.com/blog/ai-app-pricing-model/
25. CloudZero：AI产品按价值计费模式分析 https://www.cloudzero.com/blog/ai-pricing/
26. 福布斯：YC2025秋批次热门初创盘点 https://www.forbes.com/sites/dariashunina/2025/11/13/the-top-startups-to-watch-from-y-combinators-fall-2025-batch/
27. Folding Burritos：Kano模型介绍 https://foldingburritos.com/blog/kano-model/
28. Rushis：AI时代Kano模型优先级分析 https://www.rushis.com/the-kano-model-for-the-ai-era-prioritizing-features-when-competitors-move-in-months-not-years/
29. 7 Powers 官方网站 https://7powers.com/
30. YC：AI初创公司七大护城河分析 https://www.ycombinator.com/library/Mx-the-7-most-powerful-moats-for-ai-startup
31. Tanay Jaipuria：AI时代护城河分析 https://www.tanayj.com/p/moats-in-the-age-of-ai
32. Stratechery：聚合理论官方介绍 https://stratechery.com/aggregation-theory/
33. Stratechery：聚合商定义及应用层分析 https://stratechery.com/2017/defining-aggregators/
34. 财富：大模型功能推送冲击AI初创 https://fortune.com/2026/05/30/matt-rogers-nest-apple-sherlocking-ai-founders-hyperscalers/
35. Stocktwits：IBM股价下跌拖累软件板块 https://stocktwits.com/news-articles/markets/equity/ibm-defends-after-13-anthropic-fueled-stock-drop-new-ai-tools-emerge-every-week-cobol-modernization-challenges-remain/cZRvraaR4zq
36. 维基百科：创新扩散理论条目 https://en.wikipedia.org/wiki/Diffusion_of_Innovations
37. Crossing the Chasm 官方站点 https://geoffreyamoore.com/book/crossing-the-chasm/
38. UXTigers：AI正跨越鸿沟分析 https://www.uxtigers.com/post/ai-chasm
39. NN/g：尼尔森十大可用性启发式原则 https://www.nngroup.com/articles/ten-usability-heuristics/
40. Sean Goedecke：AI Agent编程相关判断 https://www.seangoedecke.com/programming-with-ai-agents-as-theory-building/
41. Naur：编程即理论构建观点解读 https://cekrem.github.io/posts/programming-as-theory-building-naur/
42. LeadDev：AI编码时代代码可维护性研究 https://leaddev.com/ai/code-maintainability-plummets-in-the-ai-coding-era
43. GitClear：AI代码质量与可维护性报告 https://www.gitclear.com/the_ai_code_quality_maintainability_gap
44. 敏捷联盟：技术债务概念官方说明 https://agilealliance.org/introduction-to-the-technical-debt-concept/
45. Janea Systems：AI编码技术债务影响分析 https://www.janeasystems.com/blog/technical-debt-ai-coding-types-impact
46. CIOReview：新康威定律相关分析 https://www.cioreview.com/leadership-perspectives/the-new-conways-law-how-ai-context-windows-shape-enterprise-architecture-nid-42587-cid-175.html
47. AI Pattern Book：YAGNI原则说明 https://aipatternbook.com/yagni
48. V2EX：国内独立开发者AI开发现状讨论 https://www.v2ex.com/t/1219463
49. V2EX：AI产品推广困难相关讨论 https://www.v2ex.com/t/1226087
50. 36氪：AI生成代码的价值边界分析 https://36kr.com/p/3600303440020228

---

## 与 kfm 的对照（评审会话 · 2026-08-22 剪藏附注）

1. **「判断力没法外包」就是 kfm 评审线的存在理由**。文章结论是代码贬值、
   判断涨价（Agency is prompting and taste is evals）。kfm 这三天的运转方式
   正是这句话的工程化：各线 agent 负责 build（造），评审会话 + 用户负责
   evals（判）。用户说「我开始读不懂了，你来负责评审建议，我做你做不到的
   事」——这就是把 taste 那层从生成层里拆出来单独立岗。文章给了这个分工
   一个理论背书：这不是临时流程，是构建成本归零后的必然结构。
2. **Naur 的「理论构建」直接解释 kfm 文档体系为什么长这样**。程序最要紧的
   部分是长在人身上的理论，源码只是有损投影。kfm 的信箱、评审链、决策登记、
   迁徒总账，本质是把「为什么这么设计、哪个决策牵制哪个」这套理论**外置成
   文档**，让每条线的 agent 不必每次会话从头重建理论——正好回应 Goedecke
   的悲观判断（agent 没法持有理论，每会话重建）。kfm 的解法是文档派：
   理论不进模型，进信箱。
3. **「新康威定律：系统镜像 agent 的上下文边界」正在 kfm 身上现场发生**。
   茉莉线死于会话自动压缩（上下文边界崩了 → 那条线的产出形态也随之死）；
   9.0 线拆成 na/nz 两端后，两端各自的设计文档形状明显开始反映各自 agent
   的会话边界。这印证：设计多 agent 协作时，上下文怎么切，最后长出来的
   就是什么形状的系统——信箱机制的群聊/私聊分层设计应该把这当成一等约束。
4. **Sherlock 测试适用于 kfm 自身定位**。问：底座模型（Claude/DeepSeek
   等）明天原生支持多 agent 信箱/评审流，kfm 还活着吗？按图 6 的三个活路
   对照：数据飞轮（kfm 积累的评审链、决策登记、纪律文档是私有语料）有；
   嵌进工作流（链路 check、提交门禁、cgroup 基建已经长在日常开发里）有；
   分发与受众——弱项，目前只有自用。结论是活，但活路在前两条。
5. **caveat**：文章数据多为二手引用（METR、Veracode、GitClear 等），方向
   可信、精度存疑；Kano 衰减 18-24 个月作者自己也标注「只是从业者观察」。
   当方向性参考用，不当精确论据引用。
