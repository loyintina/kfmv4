#!/usr/bin/env python3
"""1. Increase corner orb size 20→26, center offset -13
   2. Move corner orbs to top layer (above cardBg + content)."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    src = f.read()

old_block = """  // 四个角框
  const cornerSize = 20;
  const cornerOff = -10;
  const rightOff = cornerOff + 5;
  const bottomOff = cornerOff + 3;
  // 左上 菱形
  el.appendChild(createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, triPrev,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><polyline points="11,7 3,7 3,5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polygon points="3,2 1,5 5,5" fill="currentColor"/></svg>'));
  // 右上 圆圈
  el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, triMain,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'));
  // 左下 方块
  el.appendChild(createDecoratedCorner(cornerOff, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triMain,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><polyline points="11,6 3,6 3,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polygon points="3,11 1,8 5,8" fill="currentColor"/></svg>'));
  // 右下 三角
  el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triNext,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><polygon points="8,4 6,6 10,6" fill="currentColor"/><polygon points="8,12 6,10 10,10" fill="currentColor"/><polygon points="4,8 6,6 6,10" fill="currentColor"/><polygon points="12,8 10,6 10,10" fill="currentColor"/></svg>'));

  // 毛玻璃背景层（在角框之上、内容之下）
  const cardBg = document.createElement('div');
  cardBg.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:12px',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, linear-gradient(to bottom right, ' + triPrev + ' 0%, ' + triMain + ' 33%, ' + triNext + ' 50%) border-box',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'pointer-events:none',
  ].join(';');
  el.appendChild(cardBg);

  // 数字+文字内容（居中）
  const content = document.createElement('div');
  content.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;pointer-events:none';
  if (iconClone) {
    iconClone.style.width = '36px';
    iconClone.style.height = '36px';
    iconClone.style.fontSize = '16px';
    content.appendChild(iconClone);
  }
  if (infoClone) content.appendChild(infoClone);
  el.appendChild(content);"""

new_block = """  // 四角光球 — 置于顶层（类似主光球在面板之上的逻辑）
  const cornerSize = 26;
  const cornerOff = -13;
  const rightOff = cornerOff + 5;
  const bottomOff = cornerOff + 3;

  // 毛玻璃背景层（在内容之下）
  const cardBg = document.createElement('div');
  cardBg.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:12px',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, linear-gradient(to bottom right, ' + triPrev + ' 0%, ' + triMain + ' 33%, ' + triNext + ' 50%) border-box',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'pointer-events:none',
  ].join(';');
  el.appendChild(cardBg);

  // 数字+文字内容（居中）
  const content = document.createElement('div');
  content.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;pointer-events:none';
  if (iconClone) {
    iconClone.style.width = '36px';
    iconClone.style.height = '36px';
    iconClone.style.fontSize = '16px';
    content.appendChild(iconClone);
  }
  if (infoClone) content.appendChild(infoClone);
  el.appendChild(content);

  // 四角光球置于顶层（浮卡内容之上，与主光球在面板之上的逻辑一致）
  el.appendChild(createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, triPrev,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><polyline points="11,7 3,7 3,5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polygon points="3,2 1,5 5,5" fill="currentColor"/></svg>'));
  el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, triMain,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'));
  el.appendChild(createDecoratedCorner(cornerOff, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triMain,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><polyline points="11,6 3,6 3,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polygon points="3,11 1,8 5,8" fill="currentColor"/></svg>'));
  el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triNext,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><polygon points="8,4 6,6 10,6" fill="currentColor"/><polygon points="8,12 6,10 10,10" fill="currentColor"/><polygon points="4,8 6,6 6,10" fill="currentColor"/><polygon points="12,8 10,6 10,10" fill="currentColor"/></svg>'));"""

if old_block not in src:
    print("ERROR: old_block not found!")
    exit(1)

src = src.replace(old_block, new_block)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(src)
print('OK')
