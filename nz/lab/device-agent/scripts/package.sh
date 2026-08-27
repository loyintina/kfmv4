#!/usr/bin/env bash
# package.sh — nz 设备代理 APK 手工打包（复用 kfm-na package-apk.sh 同款
# 零 Gradle 链，去掉 cargo/.so/assets/res：本壳纯 Java 皮，无原生库、无资源）
#   javac → d8 → aapt2 link → zip 装 dex → zipalign → apksigner
# （debug.keystore 与 kfm-na 同证书，互不影响——包名不同：dev.kfm.nz.agent）
set -euo pipefail
cd "$(dirname "$0")/.."

# 工具解析（双环境）：服务器 = SDK 全套本地路径；手机 Termux = 系统包 +
# 服务器拷来的 d8.jar/android.jar（~/kfm-na-toolchain）
if [ -d /data/data/com.termux ]; then
    TOOLBOX="$HOME/kfm-na-toolchain"
    AJAR="$TOOLBOX/android.jar"
    JAVAC=javac
    D8="$TOOLBOX/bin/d8"
    AAPT2=aapt2
    ZIPALIGN=zipalign
    APKSIGNER=apksigner
    KEYSTORE="$HOME/.android/debug.keystore"
else
    SDK=/root/kfm-na-toolchain/sdk
    BT="$SDK/build-tools/34.0.0"
    AJAR="$SDK/platforms/android-35/android.jar"
    JAVAC=/root/kfm-na-toolchain/jdk/bin/javac
    D8="$BT/d8"
    AAPT2="$BT/aapt2"
    ZIPALIGN="$BT/zipalign"
    APKSIGNER="$BT/apksigner"
    KEYSTORE=/root/.android/debug.keystore
    # d8/apksigner 是 shell 包装、内部 exec java——把 JDK 摆进 PATH
    export PATH="/root/kfm-na-toolchain/jdk/bin:$PATH"
fi
MIN_API=24
# targetSdk=28 定案同 kfm-na（SELinux exec 权、国产 ROM 兼容全套论证；
# 代价=安装时「为旧版 Android 打造」提示，Android 14+ 下限 23 不受影响）
TARGET_SDK=28
# versionCode=epoch 秒天然跨机单调（同秒连打/时钟回拨取「上次+1」保底），
# 独立计数器文件，不与 kfm-na 的 build/version-code.current 混
mkdir -p build
LAST=$(cat build/version-code.current 2>/dev/null || echo 0)
NOW=$(date +%s)
VERSION_CODE=$(( NOW > LAST ? NOW : LAST + 1 ))
echo "$VERSION_CODE" > build/version-code.current
VERSION_NAME=0.1.0
BUILD=build/apk
OUT=build/nz-agent.apk

echo "=== [1/5] javac（Java 皮） ==="
rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/dex" "$BUILD/stage"

$JAVAC -source 8 -target 8 -cp "$AJAR" -d "$BUILD/classes" \
    android/java/dev/kfm/nz/agent/*.java 2>&1 | grep -v 'bootstrap class path' || true
# javac 的告警（-source 8 过时）不挡路，编译失败才挡
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "❌ Java 皮编译不过"; exit 1; }

echo "=== [2/5] d8（class → dex） ==="
"$D8" --min-api "$MIN_API" --lib "$AJAR" --output "$BUILD/dex" \
    $(find "$BUILD/classes" -name '*.class')

echo "=== [3/5] aapt2 link + 装 dex ==="
# 无 res（无图标无布局），跳过 aapt2 compile/-R；manifest 内无 @ 资源引用
"$AAPT2" link -o "$BUILD/unsigned.apk" -I "$AJAR" \
    --manifest android/AndroidManifest.xml \
    --min-sdk-version "$MIN_API" --target-sdk-version "$TARGET_SDK" \
    --version-code "$VERSION_CODE" --version-name "$VERSION_NAME"
cp "$BUILD/dex/classes.dex" "$BUILD/stage/"
python3 - "$BUILD/stage" "$BUILD/unsigned.apk" <<'EOF'
import os, sys, zipfile
stage, apk = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, "a") as z:
    for root, _, files in os.walk(stage):
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, stage), zipfile.ZIP_DEFLATED)
EOF

echo "=== [4/5] zipalign ==="
"$ZIPALIGN" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

echo "=== [5/5] apksigner（debug.keystore） ==="
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass pass:android \
    --out "$OUT" "$BUILD/aligned.apk"

ls -lh "$OUT"
echo "=== [package] ✅ $OUT (versionCode=$VERSION_CODE) ==="
