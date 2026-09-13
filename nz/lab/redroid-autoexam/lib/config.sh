# config.sh — redroid-autoexam 路径与开关（被 bell/doctor/selfexam source）

# 本器官根目录（config.sh 自身位置推导，搬迁免改）
AUTOEXAM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 环境可覆盖（selfexam 用隔离根，防自考卷自残生产台账——omp v1 审阅③）
EVIDENCE_DIR="${EVIDENCE_DIR:-$AUTOEXAM_ROOT/evidence}"
ORDERS_DIR="${ORDERS_DIR:-$AUTOEXAM_ROOT/orders}"
QUARANTINE_DIR="${QUARANTINE_DIR:-$ORDERS_DIR/quarantine}"
RUNS_LEDGER="${RUNS_LEDGER:-$EVIDENCE_DIR/runs.log}"

# 开考令路径（na 落令处；正式格式/路径待 na 十二修后定稿，此处为暂定默认）
NA_EXAM_ORDER_PATH="${NA_EXAM_ORDER_PATH:-/tmp/na-exam-order/exam-order.json}"

# na 考场乐器（只读调用；可注入=测试用假乐器跑真线路径，omp 二审 C4）
NA_SCRIPTS_DIR="${NA_SCRIPTS_DIR:-/root/kfm-na/scripts}"
NA_REGRESS="${NA_REGRESS:-$NA_SCRIPTS_DIR/na-regress.sh}"
NA_SHOT="${NA_SHOT:-$NA_SCRIPTS_DIR/na-shot.sh}"
NA_PUSH_SO="${NA_PUSH_SO:-$NA_SCRIPTS_DIR/na-push-so.sh}"

# adb（na 工具链）
ADB_BIN="${ADB_BIN:-/root/kfm-na-toolchain/sdk/platform-tools/adb}"
REDROID_SERIAL="${REDROID_SERIAL:-localhost:5555}"

# 铃轮询间隔（秒）
BELL_INTERVAL="${BELL_INTERVAL:-5}"

# dry-run：v1 默认值守形态（omp 二审 C2：真线=v2 显式开关 NA_EXAM_DRYRUN=0）
NA_EXAM_DRYRUN="${NA_EXAM_DRYRUN:-1}"

# 单响应/单拍防抖：同一开考令（按内容哈希）N 秒内不重复开考
DEDUP_WINDOW_SEC="${DEDUP_WINDOW_SEC:-60}"

ensure_dirs() {
    mkdir -p "$EVIDENCE_DIR" "$ORDERS_DIR" "$QUARANTINE_DIR"
}
