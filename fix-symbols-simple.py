#!/usr/bin/env python3
"""Replace corner symbols with minimalist pure-stroke versions."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    s = f.read()

# TL: bent arrow + fill triangle -> up arrow (pure stroke)
old_tl = ('<polyline points="11,7 3,7 3,5" stroke="currentColor" stroke-width="1.4"'
          ' stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
          '<polygon points="3,2 1,5 5,5" fill="currentColor"/>')
new_tl = ('<path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor"'
          ' stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
s = s.replace(old_tl, new_tl)

# TR: X mark (thinner stroke)
old_tr = ('<line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
          '<line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>')
new_tr = ('<line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
          '<line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>')
s = s.replace(old_tr, new_tr)

# BL: bent arrow + fill triangle -> down arrow (pure stroke)
old_bl = ('<polyline points="11,6 3,6 3,8" stroke="currentColor" stroke-width="1.4"'
          ' stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
          '<polygon points="3,11 1,8 5,8" fill="currentColor"/>')
new_bl = ('<path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor"'
          ' stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
s = s.replace(old_bl, new_bl)

# BR: 4 filled triangles -> plus/cross (pure stroke)
old_br = ('<polygon points="8,4 6,6 10,6" fill="currentColor"/>'
          '<polygon points="8,12 6,10 10,10" fill="currentColor"/>'
          '<polygon points="4,8 6,6 6,10" fill="currentColor"/>'
          '<polygon points="12,8 10,6 10,10" fill="currentColor"/>')
new_br = ('<path d="M6,2 L6,10 M2,6 L10,6" stroke="currentColor"'
          ' stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
s = s.replace(old_br, new_br)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(s)
print('OK')
