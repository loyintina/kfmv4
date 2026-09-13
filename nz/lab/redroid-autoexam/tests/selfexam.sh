#!/bin/bash
# selfexam.sh — 铃自考卷 v2.2（L1）：隔离根+假乐器；分 dry-run 行为卷与
# 隔离真线卷（NA_EXAM_DRYRUN=0 + 假乐器=真线路径可安全覆盖，omp 终审放行条件①②）。
# 真真线（真 na 乐器+真 redroid）判据归 v2 真令全链。
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISOROOT="$(mktemp -d /tmp/na-autoexam-self.XXXXXX)"
export NA_EXAM_ORDER_PATH="$ISOROOT/exam-order.json"
export EVIDENCE_DIR="$ISOROOT/evidence" ORDERS_DIR="$ISOROOT/orders"
export QUARANTINE_DIR="$ORDERS_DIR/quarantine" RUNS_LEDGER="$EVIDENCE_DIR/runs.log"
export DEDUP_WINDOW_SEC=2
# 假乐器（C4 注入式；calls.log 记账=「乐器是否被碰」的行为证据）
export NA_REGRESS="$ISOROOT/fake-regress.sh"
export NA_SHOT="$ISOROOT/fake-shot.sh"
cat > "$NA_REGRESS" <<'S'
#!/bin/bash
echo "argv=$#"
for a in "$@"; do echo "arg:$a"; done
echo "$#" >> "$(dirname "$0")/calls.log"
exit "${FAKE_RC:-0}"
S
cat > "$NA_SHOT" <<'S'
#!/bin/bash
echo "fake-shot" > "${1:?}"
S
chmod +x "$NA_REGRESS" "$NA_SHOT"
calls() { cat "$ISOROOT/calls.log" 2>/dev/null | grep -c '^[0-9]'; }
# 生产台账指纹（⑨）
PROD_LEDGER="$HERE/evidence/runs.log"
prod_md5_before=""; [[ -f "$PROD_LEDGER" ]] && prod_md5_before=$(md5sum "$PROD_LEDGER" | cut -d' ' -f1)
NA_SCRIPTS_DIR="${NA_SCRIPTS_DIR:-/root/kfm-na/scripts}"
marker="$ISOROOT/.marker"; touch "$marker"
NA_SCRIPTS_NEW0="$(find "$NA_SCRIPTS_DIR" -type f -newer "$marker" 2>/dev/null | wc -l)"
# shellcheck source=../lib/config.sh
source "$HERE/lib/config.sh"
ensure_dirs

fails=0
t() { local name="$1"; shift
    if "$@" >/dev/null 2>&1; then echo "  ✓ $name"; else echo "  ✗ $name"; fails=$((fails+1)); fi; }
valid_order() {
    cat > "$NA_EXAM_ORDER_PATH" <<J
{"commit":"abc1234","build":"20260914","vc":"vc418","subjects":["PIN-DEMO","BAR-001"]${1:+,$1}}
J
}
last_run_dir() { ls -1dt "$EVIDENCE_DIR"/2*-*/ 2>/dev/null | head -1; }
runs_now() { cat "$RUNS_LEDGER" 2>/dev/null | grep -c '^RUN'; }

echo "[selfexam] 铃自考卷 v2.2（隔离根 $ISOROOT）"

# ===== dry-run 行为卷 =====
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
c_calls=$(calls)
t "A0 空轮询 no-op"               bash -c "[[ -z \$(ls -1 '$EVIDENCE_DIR' | grep -v '^\\.' ) ]]"
t "A0b dry-run 乐器零触碰"        bash -c "[[ $c_calls -eq 0 ]]"
valid_order ""
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
d="$(last_run_dir)"
t "A1 令消费+证据目录"            bash -c "[[ -n '$d' && -f '$d/report.md' && -f '$d/order.json' ]]"
t "A2 状态 PASS"                  bash -c "grep -q 'PASS' '$d/report.md'"
c_calls=$(calls)
t "A3 dry-run 不碰乐器"           bash -c "[[ $c_calls -eq 0 ]]"
t "A4 regress.log 如实声明未开考" bash -c "grep -q '未真开考' '$d/regress.log'"
t "A5 subjects 回显进报告"        bash -c "grep -q 'PIN-DEMO' '$d/report.md'"
t "A6 staging 清洁"               bash -c "! ls '$ORDERS_DIR'/order.*.json >/dev/null 2>&1"
t "A7 台账 RUN=1"                 bash -c "[[ \$(cat '$RUNS_LEDGER' 2>/dev/null | grep -c '^RUN') -eq 1 ]]"

# ===== 防线卷 =====
runs_before=$(runs_now)
printf '{"commit": truncated' > "$NA_EXAM_ORDER_PATH"
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
t "B1 坏令入隔离+错误注"          bash -c "ls '$QUARANTINE_DIR'/*.json >/dev/null 2>&1 && ls '$QUARANTINE_DIR'/*.err >/dev/null 2>&1"
t "B2 坏令零开考"                 bash -c "[[ \$(cat '$RUNS_LEDGER' 2>/dev/null | grep -c '^RUN') -eq $runs_before ]]"
valid_order "\"note\":\"diff-B\""
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
t "B3 窗口内不同内容令必开考"     bash -c "[[ \$(cat '$RUNS_LEDGER' 2>/dev/null | grep -c '^RUN') -eq $((runs_before+1)) ]]"
d4="$(last_run_dir)"
cp "$d4/order.json" "$NA_EXAM_ORDER_PATH"
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
t "B4 同令=DUPLICATE 入台账"      bash -c "grep -q '^DUPLICATE ' '$RUNS_LEDGER'"
t "B5 延迟区留档不销毁"           bash -c "ls '$ORDERS_DIR/deduped'/*.json >/dev/null 2>&1"

# ===== 状态机卷（subjects 语义：隔离而非 ABORT 报告；FAIL 路归 E4 真线段）=====
sleep 3
for v in '{"subjects":" "}' '{"subjects":[]}' '{"subjects":[""]}' '{"subjects":["*"]}' '{"subjects":["PIN\n-DEMO"]}'; do
    before_q=$(ls -1 "$QUARANTINE_DIR"/*.json 2>/dev/null | wc -l)
    printf '%s' "$v" > "$NA_EXAM_ORDER_PATH"
    bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
    after_q=$(ls -1 "$QUARANTINE_DIR"/*.json 2>/dev/null | wc -l)
    t "C3 空科目族隔离: $v"       bash -c "[[ $after_q -eq $((before_q+1)) ]] && grep -lq '清单非法' '$QUARANTINE_DIR'/*.err 2>/dev/null"
done
before_q=$(ls -1 "$QUARANTINE_DIR"/*.json 2>/dev/null | wc -l)
printf '{"subjects":"BAR-001"}' > "$NA_EXAM_ORDER_PATH"
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
after_q=$(ls -1 "$QUARANTINE_DIR"/*.json 2>/dev/null | wc -l)
t "C4 subjects 非名单型=隔离"     bash -c "[[ $after_q -eq $((before_q+1)) ]] && grep -lq '清单非法' '$QUARANTINE_DIR'/*.err 2>/dev/null"

# ===== 隔离真线卷（NA_EXAM_DRYRUN=0 + 假乐器）=====
sleep 3
c_calls_prev=$(calls)
valid_order ""
NA_EXAM_DRYRUN=0 bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
d="$(last_run_dir)"
c_calls=$(calls)
echo "[dbg] prev=$c_calls_prev now=$c_calls"
t "E1 真线段：乐器被调 argv=2"    bash -c "grep -q 'argv=2' '$d/regress.log' && grep -q 'arg:PIN-DEMO' '$d/regress.log' && grep -q 'arg:BAR-001' '$d/regress.log' && [[ $c_calls -gt $c_calls_prev ]]"
t "E2 真线段：报告无「未开考」假声明" bash -c "! grep -q '未真开考' '$d/report.md'"
t "E3 真线段：截图由乐器落盘"     bash -c "[[ -f '$d/shot.png' ]]"
sleep 3
valid_order "\"note\":\"real-fail\""
NA_EXAM_DRYRUN=0 FAKE_RC=1 bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
d="$(last_run_dir)"
t "E4 真线段：rc→FAIL 映射"       bash -c "grep -q 'FAIL' '$d/report.md'"

# ===== 收养重放红钉（omp 终审新-1：排序坑+红色输入从未被验）=====
sleep 3
valid_order "\"note\":\"orphan\""
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
runs_o=$(cat "$RUNS_LEDGER" 2>/dev/null | grep -c '^RUN')
d="$(last_run_dir)"
cp "$d/order.json" "$ORDERS_DIR/order.adopted.json"   # 字节级同令=真重放场景
# 敌意排序夹具：另一哈希的 COMPLETE 排在匹配目录之后（旧 pipefail 实现会被它骗）
mkdir -p "$EVIDENCE_DIR/20990101-000000-1-ffffffff"
printf -- '- 令摘要: deadbeef\n' > "$EVIDENCE_DIR/20990101-000000-1-ffffffff/report.md"
touch "$EVIDENCE_DIR/20990101-000000-1-ffffffff/COMPLETE"
bash "$HERE/bin/bell.sh" single >/dev/null 2>&1
t "E5 孤儿同哈希已收卷→deduped 不重放" bash -c "ls '$ORDERS_DIR/deduped'/adopted-*.json >/dev/null 2>&1 && [[ \$(cat '$RUNS_LEDGER' 2>/dev/null | grep -c '^RUN') -eq $runs_o ]]"

# ===== 红线 =====
NA_SCRIPTS_NEW1="$(find "$NA_SCRIPTS_DIR" -type f -newer "$marker" 2>/dev/null | wc -l)"
t "D1 na scripts 零写入"          bash -c "[[ $NA_SCRIPTS_NEW1 -eq $NA_SCRIPTS_NEW0 ]]"
prod_md5_after=""; [[ -f "$PROD_LEDGER" ]] && prod_md5_after=$(md5sum "$PROD_LEDGER" | cut -d' ' -f1)
t "D2 生产台账零触碰"             bash -c "[[ '$prod_md5_before' == '$prod_md5_after' ]]"
t "D3 staging 零残留"             bash -c "! ls '$ORDERS_DIR'/order.*.json >/dev/null 2>&1"
# D4 flock 死后立即可重得
NA_EXAM_ORDER_PATH="$NA_EXAM_ORDER_PATH" bash "$HERE/bin/bell.sh" watch >/dev/null 2>&1 &
wpid=$!
sleep 1
kill -9 "$wpid" 2>/dev/null; wait "$wpid" 2>/dev/null
valid_order ""
out="$(bash "$HERE/bin/bell.sh" single 2>&1)"; rc=$?
t "D4 铃死后立即可重得锁"         bash -c "[[ $rc -ne 3 ]]"

rm -rf "$ISOROOT"
total=$((fails + 23))
echo "[selfexam] v2.2 完成：挂 $fails（dry-run 行为卷+隔离真线卷；真真线判据归 v2）"
exit "$fails"
