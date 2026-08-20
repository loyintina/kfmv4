# L3:bootstrap 与 apt 生态(设计/流水线页)

> 2026-08-20 立项。依据:exec 探针两轮实拍(targetSdk 35 拒绝 errno 13 /
> targetSdk 28 放行 ✅ exit=42)——Termux 同款姿态成立,L3 路线复活。
> 本页同时是**复现手册**:任何一个 agent 接手,照本页能重建整条链。

## 1. 目标

让 kfm-na(dev.kfm.na)拥有自己的本地命令行生态:bash/coreutils/apt
等基础工具开机可用,后续可按需编新包(tmux/openssh/git…),最终
`apt install <pkg>` 可用。

## 2. 路线裁决(已定案,勿翻)

- **走正道:fork termux-packages 源码重编**。理由:官方 deb 把
  `/data/data/com.termux/files/usr` 编译期焊死(autotools --prefix /
  cmake CMAKE_INSTALL_PREFIX / rpath / shebang 重写,证据见
  scripts/build/configure/termux_step_configure_autotools.sh:106 等),
  fork 包名后官方源不可用(build-package.sh:628-631 会主动禁用 -i/-I)。
- **否决捷径①(改包名为 com.termux)**:手机已装真 Termux,安卓同包名
  互斥,且 Termux 是我们的第二开发环境(8022 部署通道),不能卸。
- **否决捷径②(官方 zip 二进制补丁)**:`com.termux`/`dev.kfm.na` 同为
  10 字符、路径等长可安全替换,但**之后每次 apt 装包都要重打补丁**,
  长期不可持续。仅作应急备案记录于此。
- **GPL 红线复核**:termux-app 是 GPL-3.0 一行不抄;termux-packages
  的构建配方与脚本同样是 GPL-3.0——我们 fork 它构建产物自用合规,
  但不把它的脚本代码搬进 kfm-na 仓;fork 仓独立存放(toolchain 目录)。

## 3. fork 配置(复现步骤)

仓库位置:`/root/kfm-na-toolchain/termux-packages`(上游 master 浅克隆
+ 一个本地 fork commit)。

上游基线:`4da4d49`(2026-08-20 浅克隆时刻的 master HEAD)。

fork commit:`be9d770`,改动两处:

1. `scripts/properties.sh`:`TERMUX_APP__PACKAGE_NAME="com.termux"` →
   `"dev.kfm.na"`。级联自动跟随:TERMUX_APP__DATA_DIR →
   /data/data/dev.kfm.na,TERMUX__ROOTFS → …/files,TERMUX__PREFIX →
   …/files/usr(properties.sh:467/488/786/947)。校验器不拦非 com.termux
   包名,只卡路径长度(DATA_DIR≤69 / ROOTFS≤86 / PREFIX≤90 字符,
   我们 28 字符远低于限值)。
2. `scripts/build-bootstraps.sh`:修上游 master bug——
   `add_termux_bootstrap_second_stage_files "$package_arch"` 的
   `$package_arch` 未定义(second-stage 脚本 TERMUX_PACKAGE_ARCH 会
   为空),改传 `$TERMUX_ARCH`。

后续 fork commit(2026-08-20 构建中追加):

3. `packages/libandroid-selinux/build.sh`:SRCURL 换清华 AOSP 镜像
   (`mirrors.tuna.tsinghua.edu.cn/git/AOSP/...`)——服务器连不上
   android.googlesource.com(134s 超时实锤)。**规则:此后凡构建卡
   googlesource 的包,同法换镜像,逐包提交**。coreutils/findutils/
   libandroid-complex-math 里的 googlesource 只在注释,不用动。
4. 仓库目录已 `chown -R 1001:1001`(容器内 builder uid;root 持有会
   `mkdir output: Permission denied`)。root 侧 git 操作需
   `git config --global --add safe.directory <路径>`(已配)。
5. `scripts/build/termux_download.sh`:github.com 下载 URL 自动改写走
   `https://ghfast.top/` 镜像(`KFM_GH_PROXY` 环境变量可关/可换)——
   服务器直连 github 发布资产 CDN 实测 ~10KB/s(openssl 一包挂 20+
   分钟),镜像 ~250KB/s。安全性由既有 sha256 校验兜底(内容不符
   当场报错),镜像只改传输路径不改内容。git clone 类源不经此函数,
   走第 3 条的逐包 SRCURL 换镜像。

## 4. 构建(复现步骤)

宿主机:Ubuntu 24.04,4 核/7G 内存/磁盘需 ≥40G 空闲。docker.io
(29.1.3,apt 装)——构建全程在容器内,不污染宿主。

```bash
cd /root/kfm-na-toolchain/termux-packages
docker pull ghcr.io/termux/package-builder:latest   # 数 GB,一次性
./scripts/run-docker.sh ./scripts/build-bootstraps.sh --architectures aarch64 &> build.log
```

- 只编 aarch64(手机架构);全架构去掉 `--architectures` 即可,时长翻倍。
- 预期数小时。产物:`bootstrap-aarch64.zip`(repo 根目录),zip 根下
  直接是 $PREFIX 内容(bin/ etc/ lib/ … + SYMLINKS.txt)。
- 默认包清单(约 27 个顶层包+依赖闭包,build-bootstraps.sh:422-465):
  apt bash bzip2 command-not-found coreutils dash diffutils findutils
  gawk grep gzip less procps psmisc sed tar termux-core termux-exec
  termux-keyring termux-tools util-linux + ed debianutils dos2unix
  inetutils lsof nano net-tools patch unzip。
- 改包名后重编必须先 `./scripts/run-docker.sh ./clean.sh` 或 `-f`,
  否则旧前缀产物被当已构建跳过。

## 5. APK 集成方案(已落地,4280703)

我们是我们自己的 app,不 fork termux-app,所以**不用**
libtermux-bootstrap.so 内嵌机制(那是 Play 商店按 ABI 裁剪的需要)。
方案:bootstrap zip 放 APK assets,首启时自解压。已实现件:

- `src/bootstrap.rs`(核心层,host 考题 5 道):`ensure_prefix()` =
  staging 解包 → SYMLINKS.txt 补链 → chmod 规则 → 原子 rename →
  幂等跳过;`second_stage_command()` = postinst 遍历的命令组装
- 壳侧 `first_boot_install()`:JNI getFilesDir 取私有目录、ndk
  AssetManager 读 `assets/bootstrap-aarch64.zip`、装完同步跑
  second-stage;zip 缺席优雅回落(系统 sh 照跑)
- `local_pty.rs::shell_plan()`:prefix/bin/bash 在则本地会话换 bash,
  env 带 PATH/LD_LIBRARY_PATH/PREFIX(考题 2 道)
- `scripts/package-apk.sh`:zip 找到即入 assets(STORED 不重压缩),
  搜索路径 = $KFM_BOOTSTRAP_ZIP → toolchain 仓根 → ~/kfm-na-toolchain

解压纪律(对照 TermuxInstaller 语义,我们 Rust 侧重写):

1. $PREFIX 已存在且非空 → 跳过(幂等)。
2. 解到 staging:`files/usr-staging`,完成后原子 rename 为 `files/usr`。
3. zip 不含符号链接——`SYMLINKS.txt` 逐行 `target←linkpath`(U+2190
   分隔),全部文件落盘后再统一 Os.symlink 补建。
4. chmod 0700:`bin/`、`libexec`、`lib/apt/apt-helper`、`lib/apt/methods`。
5. 跑 second-stage:`$PREFIX/etc/termux/termux-bootstrap/second-stage/`
   下的入口脚本——本质是遍历 `var/lib/dpkg/info/*.postinst` 逐个
   `configure`(bootstrap 是手工解包的,dpkg 的 postinst 没跑过)。
   失败 = 整个安装失败,wipe prefix 重来。
6. profile.d 里还埋了一个 fallback 脚本(01-…-fallback.sh),首 shell
   时兜底执行 second-stage 后自删。

## 6. apt 源问题(后续阶段)

- bootstrap 里 apt 的 sources.list 指向官方 packages-cf.termux.dev,
  其 deb 全是 com.termux 前缀,**我们的 fork 不能直接用它装包**。
- 正道:想要哪个包,用同一条 docker 链编出来
  (`./scripts/run-docker.sh ./build-package.sh -a aarch64 <pkg>`),
  再用 `termux-apt-repo` 在服务器自建小源,sources.list 改指自建源
  (首启时覆盖 conffile 或改 packages/apt/build.sh:76-81 重编 apt)。
- 自建源需换签名密钥:termux-keyring 烘的是官方公钥,自建源配自己的
  密钥对(packages/termux-keyring/)。

## 7. 未来更新流程(同步上游)

1. `cd /root/kfm-na-toolchain/termux-packages && git fetch --depth 1 origin master`
2. 把我们的 fork commit rebase/merge 到新 HEAD(改动只有 2 处,冲突面
   极小;若 properties.sh 变量结构变了,对照本页 §3 重新落包名)。
3. `./scripts/run-docker.sh ./clean.sh` 后重跑 §4 构建。
4. 新 zip 进 APK assets,版本号+1,首启幂等逻辑(§5.1)不会动老用户
   已装的 $PREFIX——**升级策略另行设计**(目前是「只在空 prefix 安装」)。

## 8. 风险与挂账

- master 的 build-bootstraps.sh 官方自认「lot of issues」,更完善的
  版本在 PR #24647(infra-improvs 分支)。本轮先用 master+我们的
  单行修复;若构建中踩到别的坑,考虑切 infra-improvs。
- termux-exec(LD_PRELOAD 拦截 execve 修 shebang)在我们的
  targetSdk 28 姿态下行为待实拍。
- bootstrap 解压后约 70-80MB;APK 体积 +25MB 级。用户表态过
  「不在意体积,在意速度」,可接受。
