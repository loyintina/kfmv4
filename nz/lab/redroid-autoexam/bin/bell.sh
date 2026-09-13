#!/bin/bash
# bell.sh — 自动开考铃 v1.2（消费 na 开考令 → 跑考场 → 证据归档）
#
# v1 形态纪律（omp 二审放行条件 C2）：默认 DRY-RUN 值守，真线（真热更+真
# 判卷）是 v2 的显式开关 NA_EXAM_DRYRUN=0。本版绝不接 na 真令。
#
# 用法:
#   bash bin/bell.sh single          # 单拍：轮询一次开考令路径
#   bash bin/bell.sh watch           # 常驻：每 BELL_INTERVAL 秒一拍（flock 单例）
#   bash bin/bell.sh consume <file>  # 消费指定开考令（仅限 ORDERS_DIR 内或令路径）
#
# 语义（na 回信冻结 + omp 两轮审阅放行条件）:
#   - 原子消费 mv；坏 JSON 隔离；同令去重=延迟区留档（绝不销毁令）
#   - 先归档后删令：报告+台账落盘才清 staging；残留孤儿=收养重考（完成哨兵防重放）
#   - 副作用只许：读 na 产物 + 写本目录归档；绝不回写 na 仓
#   - 空科目/科目非法 = ABORT 拒绝盲开（全量卷含 8021 killsocket 重考官）
#   - redroid 截图=C 档代阅卷；帧率/手感终裁归真机人眼
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../lib/config.sh
source "$HERE/lib/config.sh"
ensure_dirs

log() { echo "[bell] $*"; }

# 间隔回退：正整数且 ≥1（omp P2：0 会紧自旋）
[[ "$BELL_INTERVAL" =~ ^[1-9][0-9]*$ ]] || BELL_INTERVAL=5

# 令摘要字段清洗：剥 C0 控制符（含 ESC/TAB/CR/LF，omp P2）防 report 注入
clean() { local s="$*"; s=$(printf '%s' "$s" | tr -d '\000-\010\013\014\016-\037'); printf '%s' "$s"; }

# JSON 闸：合法 JSON 对象；subjects 白名单 token 空格拼接（C1：解析期消毒，
# 通配/控制符/空 token 一律滤除——滤后为空则 subjects 空=ABORT）
validate_order() {
    python3 - "$1" <<'PY'
import json, re, sys
try:
    with open(sys.argv[1], encoding='utf-8') as f:
        d = json.load(f)
    if not isinstance(d, dict):
        raise ValueError('not an object')
    tok = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]*$')
    for k in ('commit', 'build', 'vc'):
        v = d.get(k)
        if v is not None:
            print(f'{k}={v}')
    v = d.get('subjects')
    if v is not None:
        if not isinstance(v, list) or not v or any(
            not (isinstance(x, str) and tok.match(x.strip())) for x in v
        ):
            print('subjects_invalid=1')
        else:
            print('subjects=' + ' '.join(x.strip() for x in v))
except Exception as e:
    print(f'INVALID: {e}', file=sys.stderr)
    sys.exit(1)
PY
}

scope_ok() {
    local f="$1" rp orders_rp order_rp
    rp="$(realpath -m "$f" 2>/dev/null)" || return 1
    orders_rp="$(realpath -m "$ORDERS_DIR")"
    order_rp="$(realpath -m "$NA_EXAM_ORDER_PATH" 2>/dev/null)"
    [[ "$rp" == "$orders_rp"/* || "$rp" == "$order_rp" ]]
}

atomicity_check() {
    local d1 d2
    d1="$(stat -c %d "$(dirname "$NA_EXAM_ORDER_PATH")" 2>/dev/null)" || return 0
    d2="$(stat -c %d "$ORDERS_DIR")" || return 0
    [[ "$d1" != "$d2" ]] && log "⚠ 令路径与归档不同设备：mv 非原子，消费语义降级"
}

# 孤儿收养：staging 残留=可能「修了没判」。完成哨兵（COMPLETE）防重放——
# 同哈希已有收卷目录 → 转 deduped/ 留档（omp 二审 P1）
adopt_orphans() {
    local f h c d match
    for f in "$ORDERS_DIR"/order.*.json; do
        [[ -f "$f" ]] || continue
        h="$(sha256sum "$f" | cut -c1-8)"
        match=""
        for c in "$EVIDENCE_DIR"/*/COMPLETE; do
            [[ -f "$c" ]] || continue
            d="$(dirname "$c")"
            if grep -q "令摘要: ${h}\$" "$d/report.md" 2>/dev/null; then
                match="$d"; break
            fi
        done
        if [[ -n "$match" ]]; then
            log "孤儿 $f 同哈希已收卷（$match）：转 deduped/"
            mkdir -p "$ORDERS_DIR/deduped"
            mv "$f" "$ORDERS_DIR/deduped/adopted-$(date +%Y%m%d-%H%M%S)-${h}.json"
            continue
        fi
        log "收养孤儿 staging：$(basename "$f")"
        consume_file "$f"
    done
}

run_pipeline() {
    local order_file="$1" kv="$2"
    local ts hash dir
    ts="$(date +%Y%m%d-%H%M%S)"
    hash="$(sha256sum "$order_file" | cut -c1-8)"

    local subjects="" commit="" build="" vc="" kvline
    while IFS= read -r kvline; do
        case "$kvline" in
            commit=*)  commit="${kvline#commit=}" ;;
            build=*)   build="${kvline#build=}" ;;
            vc=*)      vc="${kvline#vc=}" ;;
            subjects=*) subjects="${kvline#subjects=}" ;;
        esac
    done <<< "$kv"

    # 去重窗口：自收卷起算；命中=延迟区留档（绝不销毁）
    local hfile="$EVIDENCE_DIR/.last-hash"
    local now last_hash="" last_ts=0
    now="$(date +%s)"
    if [[ -f "$hfile" ]]; then
        read -r last_hash last_ts < "$hfile"
        if [[ "$last_hash" == "$hash" && $((now - ${last_ts:-0})) -lt $DEDUP_WINDOW_SEC ]]; then
            log "去重命中（同令 ${DEDUP_WINDOW_SEC}s 内已收卷）：转延迟区"
            mkdir -p "$ORDERS_DIR/deduped"
            mv "$order_file" "$ORDERS_DIR/deduped/$(date +%Y%m%d-%H%M%S)-${hash}.json"
            echo "DUPLICATE $(date -Is) hash=$hash" >> "$RUNS_LEDGER" || log "⚠ 台账追加失败"
            return 0
        fi
    fi

    # 先归档：令副本先落证据目录
    local dir="$EVIDENCE_DIR/${ts}-$(date +%s)-${hash}"
    mkdir -p "$dir"
    cp "$order_file" "$dir/order.json" || { log "⚠ 令副本落盘失败，令保留待重试"; return 1; }
    log "开考：证据目录 $dir"

    local status="PASS" regress_rc=0 regress_note="" subjects_arr=()
    read -r -a subjects_arr <<< "$subjects"
    if [[ ${#subjects_arr[@]} -lt 1 ]]; then
        status="ABORT"; regress_note="无有效科目清单，拒绝盲开全量卷（na 开考令应带 subjects）"
    fi

    # ① 环境
    if [[ $NA_EXAM_DRYRUN == 1 ]]; then
        bash "$HERE/bin/doctor.sh" --dry-run-tolerant 9>&- >> "$dir/doctor.log" 2>&1 || status="ABORT"
    else
        bash "$HERE/bin/doctor.sh" 9>&- >> "$dir/doctor.log" 2>&1 || status="ABORT"
    fi

    # ② 跑考场（omp 终审阻断①：DRY-RUN 必须真闸乐器——真跑+假声明=L0 反例。
    #    dry-run 下 regress.log 只记未开考；行为卷（argv/FAIL）在隔离根+
    #    假乐器的真线段覆盖，见 selfexam E 组）
    if [[ $status != "ABORT" ]]; then
        if [[ $NA_EXAM_DRYRUN == 1 ]]; then
            echo "[dryrun] 未真开考（真线=v2 显式开关 NA_EXAM_DRYRUN=0）" > "$dir/regress.log"
            regress_note="DRY-RUN 未判卷，无判卷数字"
        else
            # shellcheck disable=SC2086
            bash "$NA_REGRESS" ${subjects_arr[@]+"${subjects_arr[@]}"} 9>&- > "$dir/regress.log" 2>&1
            regress_rc=$?
            [[ $regress_rc -ne 0 ]] && status="FAIL"
        fi
    fi

    # ③ 截图存证（dry-run 不碰；失败显式记档不静默）
    if [[ $NA_EXAM_DRYRUN != 1 && -f "$NA_SHOT" ]]; then
        if ! bash "$NA_SHOT" "$dir/shot.png" 9>&- >> "$dir/shot.log" 2>&1; then
            regress_note="${regress_note:+$regress_note；}截图失败（见 shot.log）"
        fi
    fi

    # ④ 报告（先报告后清 staging）
    local drymark="" note="" dryline=""
    if [[ $NA_EXAM_DRYRUN == 1 ]]; then
        drymark="（DRY-RUN 演练，未真开考）"
        dryline="- 模式: DRY-RUN（真线=v2 显式开关 NA_EXAM_DRYRUN=0）"
    fi
    [[ -n "$regress_note" ]] && note="；注: $(clean "$regress_note")"
    if ! cat > "$dir/report.md" <<MD
# 开考报告 ${ts}-${hash}

- 状态: **$status**$drymark
$dryline
- 开考令: commit=$(clean "${commit:-?}") build=$(clean "${build:-?}") vc=$(clean "${vc:-?}") subjects=[$(clean "$subjects")]
- na-regress 退出码: $regress_rc（0=全过/全跳，非 0=有挂）$note
- 证据: regress.log / doctor.log / order.json$( [[ -f $dir/shot.png ]] && echo ' / shot.png' )
- 判卷口径: redroid 截图=C 档**代阅卷**；帧率/拖影/手感终裁归真机人眼
- 令摘要: ${hash}
MD
    then
        log "⚠ 报告写盘失败，staging 保留待重试"
        return 1
    fi
    touch "$dir/COMPLETE"   # 完成哨兵（孤儿收养防重放）

    # ⑤ 台账
    echo "RUN $(date -Is) hash=$hash status=$status rc=$regress_rc dir=$(basename "$dir")" >> "$RUNS_LEDGER" \
        || log "⚠ 台账追加失败（run 已收卷于 $dir）"

    # ⑥ 收卷（报告+哨兵+台账落盘才清 staging）
    rm -f "$order_file"
    echo "$hash $(date +%s)" > "$hfile"
    log "收卷：status=$status rc=$regress_rc → $dir"
}

consume_file() {
    local f="$1"
    if ! scope_ok "$f"; then
        log "⚠ 拒绝越界消费（不在 orders/ 或令路径内）：$f"
        return 2
    fi
    local kv_probe=""
    kv_probe="$(validate_order "$f" 2>"$ORDERS_DIR/.last-err")" || true
    local qname="quarantine-$(date +%Y%m%d-%H%M%S)-$(basename "$f")"
    if [[ -z "$kv_probe" ]]; then
        mv "$f" "$QUARANTINE_DIR/$qname"
        cp "$ORDERS_DIR/.last-err" "$QUARANTINE_DIR/$qname.err" 2>/dev/null || true
        log "坏令隔离：$qname"
        echo "QUARANTINE $(date -Is) $qname" >> "$RUNS_LEDGER" || log "⚠ 台账追加失败"
        return 1
    fi
    if [[ "$kv_probe" == *subjects_invalid=* ]]; then
        local qname="quarantine-$(date +%Y%m%d-%H%M%S)-$(basename "$f")"
        mv "$f" "$QUARANTINE_DIR/$qname"
        echo 'subjects 清单非法（非 list 或含白名单外 token）' > "$QUARANTINE_DIR/$qname.err"
        log "坏令隔离：$qname（subjects 非法）"
        echo "QUARANTINE $(date -Is) $qname" >> "$RUNS_LEDGER" || log "⚠ 台账追加失败"
        return 1
    fi
    run_pipeline "$f" "$kv_probe"
}

poll_once() {
    [[ -f "$NA_EXAM_ORDER_PATH" ]] || return 0
    local staging="$ORDERS_DIR/order.$(date +%s%N).json"
    mv "$NA_EXAM_ORDER_PATH" "$staging"
    consume_file "$staging"
}

# 单例锁：fd9 无 CLOEXEC 会被子进程继承（omp 二审 P0）——所有外部调用 9>&-；
# 自身持锁至退出，进程死亡即释放
LOCKFILE="$EVIDENCE_DIR/.bell.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
    log "已有铃实例在跑（flock 持有），退出"
    exit 3
fi

atomicity_check
adopt_orphans

case "${1:-}" in
    single)  poll_once ;;
    watch)   if [[ $NA_EXAM_DRYRUN == 1 ]]; then
                 log "★ DRY-RUN 值守形态（真线=v2 显式开关 NA_EXAM_DRYRUN=0）"
             else
                 log "★ 真线值守（NA_EXAM_DRYRUN=0）：将真实热更与判卷"
             fi
             log "常驻开考：每 ${BELL_INTERVAL}s 一拍，令路径 $NA_EXAM_ORDER_PATH"
             while true; do poll_once; sleep "$BELL_INTERVAL" 9>&-; done ;;
    consume) [[ -n "${2:-}" ]] || { echo "用法: bell.sh consume <file>" >&2; exit 2; }
             consume_file "$2" ;;
    *)       echo "用法: bell.sh single|watch|consume <file>" >&2; exit 2 ;;
esac
