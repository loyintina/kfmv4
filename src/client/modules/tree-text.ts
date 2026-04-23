import { prepare, layout, prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext'

const TREE_FONT = '12px -apple-system, sans-serif'
const TREE_LINE_HEIGHT = 24

export interface TextMeasure {
  width: number
  height: number
  lineCount: number
}

/** Pretext 文本测量封装 — 无 DOM reflow */
export function measureText(text: string, maxWidth: number, font = TREE_FONT, lineHeight = TREE_LINE_HEIGHT): TextMeasure {
  const prepared = prepare(text, font)
  const result = layout(prepared, maxWidth, lineHeight)
  return {
    width: maxWidth,
    height: result.height,
    lineCount: result.lineCount
  }
}

/** 测量文本自然宽度（不换行） */
export function measureNaturalWidthSync(text: string, font = TREE_FONT): number {
  const prepared = prepareWithSegments(text, font)
  return measureNaturalWidth(prepared)
}

export { TREE_FONT, TREE_LINE_HEIGHT }
