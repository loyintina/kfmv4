#!/usr/bin/env python3
"""Replace decorated corner boxes with orb-style glow + symbol."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    src = f.read()

old_fn = """function createDecoratedCorner(
  x: number, y: number, w: number, h: number,
  color: string, svgInner: string,
): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:absolute',
    'left:' + x + 'px',
    'top:' + y + 'px',
    'width:' + w + 'px',
    'height:' + h + 'px',
    'border:1px solid ' + color,
    'border-radius:6px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'pointer-events:none',
  ].join(';');
  box.innerHTML = svgInner;
  return box;
}"""

new_fn = """function createDecoratedCorner(
  x: number, y: number, w: number, h: number,
  color: string, svgInner: string,
): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:absolute',
    'left:' + x + 'px',
    'top:' + y + 'px',
    'width:' + w + 'px',
    'height:' + h + 'px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'pointer-events:none',
  ].join(';');
  // 光球背景: radial-gradient + 柔光阴影
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 35%,' + color + 'cc,transparent 70%);box-shadow:0 0 8px 3px ' + color + '55"></div>' +
    svgInner;
  return box;
}"""

if old_fn not in src:
    print("ERROR: old_fn not found!")
    print(src[src.find('function createDecoratedCorner'):src.find('function createDecoratedCorner')+600])
    exit(1)

src = src.replace(old_fn, new_fn)

# Also: make SVG symbol colors semi-transparent white for cleaner orb look
# TL: triPrev -> rgba(255,255,255,0.75)
src = src.replace(
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"11,7 3,7 3,5\" stroke=\"' + triPrev + '\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><polygon points=\"3,2 1,5 5,5\" fill=\"' + triPrev + '\"/></svg>'",
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"11,7 3,7 3,5\" stroke=\"rgba(255,255,255,0.75)\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><polygon points=\"3,2 1,5 5,5\" fill=\"rgba(255,255,255,0.75)\"/></svg>'"
)
# TR: triMain -> rgba(255,255,255,0.75)
src = src.replace(
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"8\" stroke=\"' + triMain + '\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><line x1=\"10\" y1=\"2\" x2=\"4\" y2=\"8\" stroke=\"' + triMain + '\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>'",
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"8\" stroke=\"rgba(255,255,255,0.75)\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><line x1=\"10\" y1=\"2\" x2=\"4\" y2=\"8\" stroke=\"rgba(255,255,255,0.75)\" stroke-width=\"1.4\" stroke-linecap=\"round\"/></svg>'"
)
# BL: triMain -> rgba(255,255,255,0.75)
src = src.replace(
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"11,6 3,6 3,8\" stroke=\"' + triMain + '\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><polygon points=\"3,11 1,8 5,8\" fill=\"' + triMain + '\"/></svg>'",
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"11,6 3,6 3,8\" stroke=\"rgba(255,255,255,0.75)\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/><polygon points=\"3,11 1,8 5,8\" fill=\"rgba(255,255,255,0.75)\"/></svg>'"
)
# BR: triNext -> rgba(255,255,255,0.75)
src = src.replace(
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"8,4 6,6 10,6\" fill=\"' + triNext + '\"/><polygon points=\"8,12 6,10 10,10\" fill=\"' + triNext + '\"/><polygon points=\"4,8 6,6 6,10\" fill=\"' + triNext + '\"/><polygon points=\"12,8 10,6 10,10\" fill=\"' + triNext + '\"/></svg>'",
    "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"8,4 6,6 10,6\" fill=\"rgba(255,255,255,0.75)\"/><polygon points=\"8,12 6,10 10,10\" fill=\"rgba(255,255,255,0.75)\"/><polygon points=\"4,8 6,6 6,10\" fill=\"rgba(255,255,255,0.75)\"/><polygon points=\"12,8 10,6 10,10\" fill=\"rgba(255,255,255,0.75)\"/></svg>'"
)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(src)
print('OK')
