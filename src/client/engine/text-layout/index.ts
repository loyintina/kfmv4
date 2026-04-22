/**
 * KFM v2 Text Layout Adapter
 *
 * Convenience wrapper around the Pretext-based text-layout engine.
 * This is the module that KFM's Renderer and other components import.
 *
 * Usage:
 *   import { measureText, layoutLines } from '../engine/text-layout/index.js'
 *
 *   // Simple height measurement
 *   const { height, lineCount } = measureText('Hello World', '13px sans-serif', 200, 20)
 *
 *   // Multi-line Canvas rendering
 *   const lines = layoutLines('很长的中文文本...', '13px sans-serif', 200, 20)
 *   lines.forEach((line, i) => ctx.fillText(line.text, x, y + i * 20))
 */
export { prepare, prepareWithSegments, layout, layoutWithLines, layoutNextLine, walkLineRanges, clearCache, setLocale } from './layout.js'
export { setMeasureContext } from './measurement.js'
export type { PreparedText, PreparedTextWithSegments, LayoutResult, LayoutLine, LayoutLineRange, LayoutCursor, PrepareOptions } from './layout.js'

/**
 * Convenience: measure text height without dealing with PreparedText handles.
 * Ideal for one-off measurements (e.g. auto-sizing a box).
 */
import { prepare, layout, prepareWithSegments, layoutWithLines } from './layout.js'

export function measureText(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): { height: number; lineCount: number } {
  const prepared = prepare(text, font)
  return layout(prepared, maxWidth, lineHeight)
}

/**
 * Convenience: get array of line strings for Canvas rendering.
 */
export function layoutLines(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): Array<{ text: string; width: number }> {
  const prepared = prepareWithSegments(text, font)
  const { lines } = layoutWithLines(prepared, maxWidth, lineHeight)
  return lines.map(l => ({ text: l.text, width: l.width }))
}

/**
 * Convenience: calculate the "shrinkwrap" width — the narrowest container
 * that fits the text without exceeding targetLineCount lines.
 */
export function shrinkwrapWidth(
  text: string,
  font: string,
  lineHeight: number,
  targetLineCount: number,
): number {
  const prepared = prepare(text, font)
  let lo = 0
  let hi = 10000
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    const result = layout(prepared, mid, lineHeight)
    if (result.lineCount <= targetLineCount) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}