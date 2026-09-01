#!/usr/bin/env bash
# deploy.sh — 送 kfm-v4.apk 到手机并调起系统安装器（复用 kfm-na
# deploy-phone.sh 同款链路：服务器 → ssh localhost:8022 → 手机 Termux
# → scp 共享存储 → am start 安装器，用户点「安装」完成最后一下——
# Termux 普通 uid 无 INSTALL_PACKAGES，root 前省不掉）
#
# 用法：
#   bash scripts/deploy.sh           # 送当前 build/kfm-v4.apk
#   bash scripts/deploy.sh --build   # 先跑 package.sh 再送
set -euo pipefail
cd "$(dirname "$0")/.."

SSH_PORT=8022
SSH_HOST=localhost
PHONE_SHARED=/storage/emulated/0
PHONE_TMP=/data/data/com.termux/files/home/downloads

if [ "${1:-}" = "--build" ]; then
    bash scripts/package.sh
fi

APK=build/kfm-v4.apk
[ -f "$APK" ] || { echo "❌ $APK 不存在，先打包（或用 --build）"; exit 1; }

VERSION_CODE=$(cat build/version-code.current 2>/dev/null)
[ -n "$VERSION_CODE" ] || { echo "❌ build/version-code.current 不存在，先打包"; exit 1; }
NAME="kfm-v4-$VERSION_CODE.apk"

if [ -d /data/data/com.termux ]; then
    # 手机上本地跑：包就在本机，直接拷共享存储调安装器
    echo "=== [deploy] 手机本地模式：$NAME ==="
    cp "$APK" "$PHONE_SHARED/$NAME"
    am start -a android.intent.action.VIEW \
        -d "file://$PHONE_SHARED/$NAME" \
        -t application/vnd.android.package-archive
    echo "=== [deploy] ✅ 安装器已调起：点「安装」（$NAME）==="
    exit 0
fi

SSH="ssh -p $SSH_PORT -o BatchMode=yes -o ConnectTimeout=8 $SSH_HOST"

echo "=== [deploy 1/3] 送包到手机（$NAME） ==="
scp -P $SSH_PORT -o BatchMode=yes "$APK" "$SSH_HOST:$PHONE_TMP/$NAME"

echo "=== [deploy 2/3] 拷进共享存储（安装器要读） ==="
$SSH "cp $PHONE_TMP/$NAME $PHONE_SHARED/$NAME"

echo "=== [deploy 3/3] 调起系统安装器 ==="
$SSH "am start -a android.intent.action.VIEW \
    -d file://$PHONE_SHARED/$NAME \
    -t application/vnd.android.package-archive"

echo "=== [deploy] ✅ 安装器已调起：手机上点「安装」（$NAME） ==="
echo "    前置：kalo 隧道需带 -L 8021（主线页）+ -L 8029（CDP 桥）+ -L 8031（控制口）三路转发"
