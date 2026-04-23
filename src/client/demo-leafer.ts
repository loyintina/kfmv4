import { Leafer, Rect, Text, Group, Line } from 'leafer-ui'
import gsap from 'gsap'
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext'

// ========== 常量 ==========
const NODE_H = 44
const NODE_GAP = 2
const INDENT = 20
const PAD_L = 16
const FONT = '12px -apple-system, sans-serif'

const C = {
  nodeBg: 'rgba(10,10,15,.6)',
  nodeHover: 'rgba(10,10,15,.8)',
  nodeSelected: 'rgba(124,58,237,.15)',
  border: 'rgba(124,58,237,.3)',
  borderSel: 'rgba(0,212,255,.7)',
  cursor: 'rgba(0,212,255,.7)',
  text: '#e0e0e0',
  dir: '#7c3aed',
  file: '#888',
}

// ========== 模拟数据 ==========
const tree = [
  { name: 'src', isDir: true, level: 0, path: '/src' },
  { name: 'app.ts', isDir: false, level: 1, path: '/src/app.ts' },
  { name: 'ui.ts', isDir: false, level: 1, path: '/src/ui.ts' },
  { name: 'tree.ts', isDir: false, level: 1, path: '/src/tree.ts' },
  { name: 'modules', isDir: true, level: 1, path: '/src/modules' },
  { name: 'tree-leafer.ts', isDir: false, level: 2, path: '/src/modules/tree-leafer.ts' },
  { name: 'tree-text.ts', isDir: false, level: 2, path: '/src/modules/tree-text.ts' },
  { name: 'ui.ts', isDir: false, level: 2, path: '/src/modules/ui.ts' },
  { name: 'orb.ts', isDir: false, level: 2, path: '/src/modules/orb.ts' },
  { name: 'gestures.ts', isDir: false, level: 2, path: '/src/modules/gestures.ts' },
  { name: 'public', isDir: true, level: 0, path: '/public' },
  { name: 'index.html', isDir: false, level: 1, path: '/public/index.html' },
  { name: 'bundle.js', isDir: false, level: 1, path: '/public/bundle.js' },
  { name: 'css', isDir: true, level: 1, path: '/public/css' },
  { name: 'base.css', isDir: false, level: 2, path: '/public/css/base.css' },
  { name: 'sidebar.css', isDir: false, level: 2, path: '/public/css/sidebar.css' },
  { name: 'package.json', isDir: false, level: 0, path: '/package.json' },
  { name: 'tsconfig.json', isDir: false, level: 0, path: '/tsconfig.json' },
  { name: 'build.mjs', isDir: false, level: 0, path: '/build.mjs' },
  { name: 'README.md', isDir: false, level: 0, path: '/README.md' },
]

// ========== 初始化 ==========
const container = document.getElementById('tree-canvas')!
const rect = container.getBoundingClientRect()

const t0 = performance.now()

const leafer = new Leafer({
  view: container,
  width: rect.width,
  height: rect.height,
  fill: 'transparent',
  type: 'draw',
})

const content = new Group()
leafer.add(content)

// ========== Pretext 文本测量 ==========
function measureNodeWidth(name: string): number {
  const prepared = prepareWithSegments(name, FONT)
  return measureNaturalWidth(prepared)
}

// ========== 光标 ==========
let selectedIdx = -1
const cursorRect = new Rect({
  width: rect.width,
  height: NODE_H,
  fill: 'transparent',
  stroke: C.cursor,
  strokeWidth: 1.5,
  opacity: 0,
})
content.add(cursorRect)

// ========== 渲染 ==========
let y = 4
const nodes: any[] = []

for (let i = 0; i < tree.length; i++) {
  const item = tree[i]
  const indent = item.level * INDENT
  const w = rect.width - indent - 8
  const grp = new Group({ x: 4, y })

  const bg = new Rect({
    x: indent, y: 0, width: w, height: NODE_H,
    fill: C.nodeBg, cornerRadius: 6,
  })

  const leftLine = new Line({
    points: [indent + 1.5, 6, indent + 1.5, NODE_H - 6],
    stroke: C.border,
    strokeWidth: 3,
  })

  const icon = item.isDir ? '📂' : '📄'
  const iconEl = new Text({
    text: icon, x: indent + PAD_L, y: 14, fontSize: 14,
  })

  const label = new Text({
    text: item.name,
    x: indent + PAD_L + 22,
    y: (NODE_H - 14) / 2,
    fill: C.text,
    fontSize: 12,
    fontFamily: '-apple-system, sans-serif',
  })

  // 层级连线
  if (item.level > 0) {
    const lineX = indent - INDENT / 2 + 6
    const connLine = new Line({
      points: [lineX, y + 6, lineX, y + NODE_H / 2, indent + 4, y + NODE_H / 2],
      stroke: 'rgba(124,58,237,.2)',
      strokeWidth: 1,
    })
    content.add(connLine)
  }

  grp.add(bg)
  grp.add(leftLine)
  grp.add(iconEl)
  grp.add(label)
  content.add(grp)

  const nodeY = y
  const nodeIndent = indent
  const nodeW = w
  nodes.push({ grp, bg, leftLine, label, y: nodeY, data: item })

  // 点击
  grp.on('pointer.tap', () => {
    if (selectedIdx >= 0 && selectedIdx < nodes.length) {
      const old = nodes[selectedIdx]
      gsap.to(old.bg, { fill: C.nodeBg, duration: 0.2 })
      gsap.to(old.leftLine, { stroke: C.border, duration: 0.2 })
    }
    selectedIdx = i
    gsap.to(bg, { fill: C.nodeSelected, duration: 0.2 })
    gsap.to(leftLine, { stroke: C.borderSel, duration: 0.2 })

    gsap.to(cursorRect, {
      x: nodeIndent + 4, y: nodeY, width: nodeW,
      opacity: 0.7, duration: 0.3, ease: 'power2.out',
    })

    updateInfo(item)
  })

  // hover
  grp.on('pointer.enter', () => {
    if (selectedIdx !== i) gsap.to(bg, { fill: C.nodeHover, duration: 0.15 })
  })
  grp.on('pointer.leave', () => {
    if (selectedIdx !== i) gsap.to(bg, { fill: C.nodeBg, duration: 0.15 })
  })

  y += NODE_H + NODE_GAP
}

const t1 = performance.now()

// ========== 入场动画 ==========
const tl = gsap.timeline()
for (let i = 0; i < nodes.length; i++) {
  const n = nodes[i]
  n.grp.x = -40
  n.grp.opacity = 0
  tl.to(n.grp, { x: 4, opacity: 1, duration: 0.2, ease: 'power2.out' }, i * 0.03)
}

// ========== 信息面板 ==========
function updateInfo(item: any) {
  const perfEl = document.getElementById('perf')!
  const tw = measureNodeWidth(item.name)
  perfEl.innerHTML = `
    <p>选中: <span>${item.path}</span></p>
    <p>类型: <span>${item.isDir ? '目录' : '文件'}</span></p>
    <p>层级: <span>${item.level}</span></p>
    <p>Pretext 自然宽度: <span>${tw.toFixed(1)}px</span></p>
    <p>渲染耗时: <span>${(t1 - t0).toFixed(1)}ms</span></p>
  `
}

const perfEl = document.getElementById('perf')!
perfEl.innerHTML = `
  <p>节点数: <span>${tree.length}</span></p>
  <p>渲染耗时: <span>${(t1 - t0).toFixed(1)}ms</span></p>
  <p>点击节点查看详情</p>
`
