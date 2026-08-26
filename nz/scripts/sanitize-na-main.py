#!/usr/bin/env python3
"""sanitize-na-main.py — na-main.ttf 的 vhea 表版本修复（2026-08-26）

背景：na-main.ttf（用户商业主字体，私有勿提交）的 vhea 表版本字段是
0x00010001——合法值只有 0x00010000/0x00011000。Chromium OTS 消毒器
整字体重拒（OTS parsing error: vhea: Unsupported table version），
NA 原生端（Rust 字体栈）不查这个所以一直能用。web 端 @font-face 因此
静默 fallback（cjk-probe mainLoaded=false 实锤）。

本脚本把 vhea 版本修成 0x00010000 并重算该表校验和 + head 的
checkSumAdjustment（0xB1B0AFBA 魔数校验），幂等原地修；已正常则
no-op。BUILD 时从 kfm-na 拷入字体后跑一次。

用法：python3 scripts/sanitize-na-main.py [path]（缺省 public/fonts/na-main.ttf）
"""
import struct
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'public/fonts/na-main.ttf'
VHEA_GOOD = 0x00010000
MAGIC = 0xB1B0AFBA


def u32(b, o):
    return struct.unpack('>I', b[o:o + 4])[0]


def table_sum(data, off, length):
    pad = (4 - length % 4) % 4
    chunk = data[off:off + length] + b'\0' * pad
    return sum(struct.unpack('>%dI' % (len(chunk) // 4), chunk)) & 0xFFFFFFFF


def main():
    with open(PATH, 'rb') as f:
        data = bytearray(f.read())
    num = struct.unpack('>H', data[4:6])[0]
    tables = {}
    for i in range(num):
        rec = 12 + i * 16
        tag = bytes(data[rec:rec + 4]).decode('latin1')
        tables[tag] = rec  # 目录记录偏移
    if 'vhea' not in tables:
        print('[sanitize] 无 vhea 表，no-op')
        return
    rec = tables['vhea']
    off = u32(data, rec + 8)
    ver = u32(data, off)
    if ver == VHEA_GOOD:
        print('[sanitize] vhea 版本已正常（0x00010000），no-op')
        return
    print(f'[sanitize] vhea 版本 0x{ver:08x} → 0x{VHEA_GOOD:08x}')
    data[off:off + 4] = struct.pack('>I', VHEA_GOOD)
    # 重算 vhea 表校验和写回目录
    length = u32(data, rec + 12)
    data[rec + 4:rec + 8] = struct.pack('>I', table_sum(data, off, length))
    # 重算 head.checkSumAdjustment：先清零再按整字求和取魔数差
    head = tables['head']
    adj_off = u32(data, head + 8) + 8
    data[adj_off:adj_off + 4] = b'\0\0\0\0'
    total = table_sum(data, 0, len(data))
    data[adj_off:adj_off + 4] = struct.pack('>I', (MAGIC - total) & 0xFFFFFFFF)
    with open(PATH, 'wb') as f:
        f.write(data)
    print('[sanitize] 已写回（含校验和）', PATH)


if __name__ == '__main__':
    main()
