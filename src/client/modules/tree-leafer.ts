import { Leafer, Rect, Text, Group, Line, DragEvent } from 'leafer-ui'
import gsap from 'gsap'
import { measureText, measureNaturalWidthSync, TREE_FONT, TREE_LINE_HEIGHT } from './tree-text'

// ========== 常量 ==========
const NODE_HEIGHT = 40
const NODE_GAP = 2
const NODE_PADDING_LEFT = 16
const INDENT_PER_LEVEL = 20
const BORDER_LEFT_WIDTH = 3

const COLORS = {
  bg: 'rgba(18,18,26,.85)',
  nodeBg: 'rgba(10,10,15,.6)',
  nodeBgHover: 'rgba(10,10,15,.8)',
  nodeBgSelected: 'rgba(124,58,237,.15)',
  border: 'rgba(124,58,237,.3)',
  borderSelected: 'rgba(0,212,255,.7)',
  text: '#e0e0e0',
  textDim: '#888',
  cursor: 'rgba(0,212,255,.7)',
}

// ========== 类型 ==========
interface TreeNode {
  name: string
  path: string
  isDir: boolean
  level: number
  expanded?: boolean
  children?: TreeNode[]
}

interface RenderedNode {
  data: TreeNode
  group: Group
  bg: Rect
  border: Rect
  label: Text
  y: number
}

// ========== 渲染器 ==========
export class TreeLeaferRenderer {
  private leafer!: Leafer
  private container: HTMLElement
  private nodes: RenderedNode[] = []
  private selectedIndex = -1
  private cursorRect!: Rect
  private contentGroup!: Group
  private nodeWidth = 280
  private onNodeClick?: (path: string, isDir: boolean) => void

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!
    this.init()
  }

  private init() {
    const rect = this.container.getBoundingClientRect()
    this.nodeWidth = rect.width

    this.leafer = new Leafer({
      view: this.container,
      width: rect.width,
      height: rect.height,
      fill: 'transparent',
      type: 'draw',
    })

    // 内容组（支持滚动偏移）
    this.contentGroup = new Group()
    this.leafer.add(this.contentGroup)

    // 光标高亮层
    this.cursorRect = new Rect({
      width: this.nodeWidth,
      height: NODE_HEIGHT,
      fill: 'transparent',
      stroke: COLORS.cursor,
      strokeWidth: 1.5,
      cornerRadius: 0,
      opacity: 0,
    })
    this.contentGroup.add(this.cursorRect)
  }

  /** 渲染文件树数据 */
  renderTree(items: TreeNode[]) {
    // 清除旧节点
    this.nodes.forEach(n => n.group.remove())
    this.nodes = []

    // 计算布局
    let y = 0
    for (const item of items) {
      this.createNode(item, y)
      y += NODE_HEIGHT + NODE_GAP
    }
  }

  private createNode(data: TreeNode, y: number): RenderedNode {
    const group = new Group({ x: 0, y })
    const indent = data.level * INDENT_PER_LEVEL
    const contentWidth = this.nodeWidth - indent - NODE_PADDING_LEFT

    // 背景
    const bg = new Rect({
      x: indent,
      y: 0,
      width: contentWidth,
      height: NODE_HEIGHT,
      fill: COLORS.nodeBg,
      cornerRadius: 6,
    })

    // 左侧加粗边框
    const border = new Rect({
      x: indent,
      y: 0,
      width: contentWidth,
      height: NODE_HEIGHT,
      fill: 'transparent',
      stroke: COLORS.border,
      strokeWidth: { left: BORDER_LEFT_WIDTH, top: 1, right: 1, bottom: 1 },
      cornerRadius: 6,
    })

    // 图标 + 文字
    const icon = data.isDir ? '📂 ' : '📄 '
    const label = new Text({
      text: icon + data.name,
      x: indent + NODE_PADDING_LEFT + 4,
      y: (NODE_HEIGHT - 14) / 2,
      fill: COLORS.text,
      fontSize: 12,
      fontFamily: '-apple-system, sans-serif',
    })

    group.add(bg)
    group.add(border)
    group.add(label)
    this.contentGroup.add(group)

    const rendered: RenderedNode = { data, group, bg, border, label, y }
    this.nodes.push(rendered)

    // 交互事件
    group.on(DragEvent.CLICK, () => {
      this.selectNode(this.nodes.indexOf(rendered))
      this.onNodeClick?.(data.path, data.isDir)
    })

    // hover 效果
    group.on('pointer.enter', () => {
      gsap.to(bg, { fill: COLORS.nodeBgHover, duration: 0.15 })
    })
    group.on('pointer.leave', () => {
      const isSelected = this.nodes.indexOf(rendered) === this.selectedIndex
      gsap.to(bg, { fill: isSelected ? COLORS.nodeBgSelected : COLORS.nodeBg, duration: 0.15 })
    })

    return rendered
  }

  /** 选中节点 */
  selectNode(index: number) {
    // 取消旧选中
    if (this.selectedIndex >= 0 && this.selectedIndex < this.nodes.length) {
      const old = this.nodes[this.selectedIndex]
      gsap.to(old.bg, { fill: COLORS.nodeBg, duration: 0.2 })
      gsap.to(old.border, { stroke: COLORS.border, duration: 0.2 })
    }

    this.selectedIndex = index

    if (index >= 0 && index < this.nodes.length) {
      const node = this.nodes[index]
      const indent = node.data.level * INDENT_PER_LEVEL

      // 新选中
      gsap.to(node.bg, { fill: COLORS.nodeBgSelected, duration: 0.2 })
      gsap.to(node.border, { stroke: COLORS.borderSelected, duration: 0.2 })

      // 光标移动
      gsap.to(this.cursorRect, {
        y: node.y,
        opacity: 0.7,
        x: indent,
        width: this.nodeWidth - indent,
        duration: 0.3,
        ease: 'power2.out',
      })
    }
  }

  /** 设置点击回调 */
  setOnNodeClick(cb: (path: string, isDir: boolean) => void) {
    this.onNodeClick = cb
  }

  /** 更新尺寸 */
  resize(width: number, height: number) {
    this.nodeWidth = width
    this.leafer.width = width
    this.leafer.height = height
  }

  /** 销毁 */
  destroy() {
    this.leafer.destroy()
  }
}
