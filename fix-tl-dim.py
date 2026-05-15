#!/usr/bin/env python3
"""Dim TL symbol specifically: pass triPrev at 0.75 alpha instead of 1.0."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    s = f.read()

# 1. Add tlDim line after getTriple
old = "const [triPrev, triMain, triNext] = getTriple(_focusIndex, 1);\n\n  // 四角光球"
new = "const [triPrev, triMain, triNext] = getTriple(_focusIndex, 1);\n  const tlDim = triPrev.replace(/,\\s*1\)$/, ',0.75)');\n\n  // 四角光球"
s = s.replace(old, new)

# 2. In TL call, change triPrev to tlDim
s = s.replace(
    "createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, triPrev,",
    "createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlDim,"
)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(s)
print('OK')
