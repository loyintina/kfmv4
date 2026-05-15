#!/usr/bin/env python3
"""Add TR orb close behavior to floating card."""

import sys

CS = '/root/kfmv4/src/client/modules/card-stack.ts'

with open(CS, 'r') as f:
    s = f.read()

# ============================================================
# 1. Replace pointer-events:none with conditional
# ============================================================
old_pe = """    'pointer-events:none',
  ].join(';');
  // 从 rgba(r,g,b,alpha) 中提取 RGB 分量"""

new_pe = """    onClick ? 'pointer-events:auto' : 'pointer-events:none',
    onClick ? 'cursor:pointer' : '',
  ].filter(Boolean).join(';');
  // 从 rgba(r,g,b,alpha) 中提取 RGB 分量
  if (onClick) box.addEventListener('click', onClick);"""

if old_pe not in s:
    print("ERROR: pointer-events pattern not found!")
    print(repr(s[s.find("pointer-events:none"):s.find("pointer-events:none")+200]))
    sys.exit(1)
s = s.replace(old_pe, new_pe)
print("1. pointer-events conditional OK")

# ============================================================
# 2. Add dismissFloatingCardAnimated function before dismissFloatingCard
# ============================================================
old_dismiss = """/** 销毁浮卡 */
export function dismissFloatingCard(): void {
  if (_floatingCardEl) {
    anim.killTweensOf(_floatingCardEl);
    _floatingCardEl.remove();
    _floatingCardEl = null;
  }
}"""

new_dismiss = """/** 销毁浮卡（立即） */
export function dismissFloatingCard(): void {
  if (_floatingCardEl) {
    anim.killTweensOf(_floatingCardEl);
    _floatingCardEl.remove();
    _floatingCardEl = null;
  }
}

/** 销毁浮卡（微膨胀→收缩消失动画） */
function dismissFloatingCardAnimated(): void {
  const el = _floatingCardEl;
  if (!el) return;
  anim.killTweensOf(el);
  const tl = anim.timeline({
    onComplete: () => {
      if (_floatingCardEl === el) {
        _floatingCardEl = null;
        el.remove();
      }
    },
  });
  tl.to(el, { scale: 1.08, duration: 0.1, ease: 'power2.out' });
  tl.to(el, { scale: 0, duration: 0.2, ease: 'power3.in' });
}"""

if old_dismiss not in s:
    print("ERROR: dismissFloatingCard not found!")
    sys.exit(1)
s = s.replace(old_dismiss, new_dismiss)
print("2. dismissFloatingCardAnimated OK")

# ============================================================
# 3. Pass onClick to TR orb (line with FLOATING_CARD_W - rightOff)
# ============================================================
# The TR call is the one with triMain and the X symbol (two <line> elements)
# It's the 2nd createDecoratedCorner call
# Pattern: el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff ... triMain, `<svg ...><line .../><line .../></svg>`));
# We need to add a callback arg after the SVG

old_tr = """el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, triMain,
    `<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(${c+sh},${c-sh}) scale(${s})\"><line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\"/><line x1=\"10\" y1=\"2\" x2=\"4\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\"/></g></svg>`));"""

new_tr = """el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, triMain,
    `<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(${c+sh},${c-sh}) scale(${s})\"><line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\"/><line x1=\"10\" y1=\"2\" x2=\"4\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\"/></g></svg>`,
    dismissFloatingCardAnimated));"""

if old_tr not in s:
    print("ERROR: TR call not found!")
    # debug: show context
    idx = s.find("FLOATING_CARD_W - rightOff")
    if idx >= 0:
        print("Found at", idx)
        print(s[idx:idx+400])
    sys.exit(1)
s = s.replace(old_tr, new_tr)
print("3. TR onClick OK")

# ============================================================
# 4. In closeCardStack, use animated dismiss
# ============================================================
old_close = """  // 关闭时销毁浮卡
  dismissFloatingCard();"""

new_close = """  // 关闭时销毁浮卡（带动画）
  dismissFloatingCardAnimated();"""

s = s.replace(old_close, new_close)
print("4. closeCardStack uses animated OK")

with open(CS, 'w') as f:
    f.write(s)
print('All done')
