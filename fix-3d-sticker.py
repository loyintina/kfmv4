#!/usr/bin/env python3
"""3D sphere sticker effect: shift+scale symbols outward + lighting mask."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    s = f.read()

# 0. Add lighting mask to symbol wrapper in createDecoratedCorner
# The source has: symC + '">' + svgInner -- add mask before the closing ">
old_w = """symC + '">' + svgInner"""
new_w = """symC + ';-webkit-mask:linear-gradient(135deg,#000 30%,transparent 100%);mask:linear-gradient(135deg,#000 30%,transparent 100%)">' + svgInner"""
s = s.replace(old_w, new_w)

# 1. TL arrow: shift toward top-left
s = s.replace(
    '<path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    '<g transform="translate(-0.52,-0.52) scale(0.92)"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>'
)

# 2. TR X: shift toward top-right
s = s.replace(
    '<line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    '<g transform="translate(1.48,-0.52) scale(0.92)"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></g>'
)

# 3. BL arrow: shift toward bottom-left
s = s.replace(
    '<path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    '<g transform="translate(-0.52,1.48) scale(0.92)"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>'
)

# 4. BR plus: shift toward bottom-right
s = s.replace(
    '<path d="M6,2 L6,10 M2,6 L10,6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    '<g transform="translate(1.48,1.48) scale(0.92)"><path d="M6,2 L6,10 M2,6 L10,6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>'
)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(s)
print('OK')
