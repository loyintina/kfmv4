/**
 * Public API for KFM v2 text-layout engine.
 * Ported from @chenglou/pretext (MIT license).
 *
 * Core pattern:
 *   prepare(text, font) → PreparedText   (one-time: segment + measure)
 *   layout(prepared, maxWidth, lineHeight) → { height, lineCount }
 *
 *   prepareWithSegments(text, font) → PreparedTextWithSegments
 *   layoutWithLines(prepared, maxWidth, lineHeight) → { lines[], height, lineCount }
 */
import { computeSegmentLevels } from './bidi.js'
import {
  analyzeText,
  clearAnalysisCaches,
  endsWithClosingQuote as _endsWithClosingQuote,
  isCJK,
  kinsokuEnd,
  kinsokuStart,
  leftStickyPunctuation,
  setAnalysisLocale,
  type AnalysisChunk,
  type SegmentBreakKind,
  type TextAnalysis,
  type WhiteSpaceMode,
} from './analysis.js'
import {
  clearMeasurementCaches,
  getCorrectedSegmentWidth,
  getEngineProfile,
  getFontMeasurementState,
  getSegmentGraphemePrefixWidths,
  getSegmentGraphemeWidths,
  getSegmentMetrics,
  textMayContainEmoji,
} from './measurement.js'
import {
  countPreparedLines,
  layoutNextLineRange as stepPreparedLineRange,
  walkPreparedLines,
  type InternalLayoutLine,
} from './line-break.js'

let sharedGraphemeSegmenter: Intl.Segmenter | null = null
let sharedLineTextCaches = new WeakMap<any, Map<number, string[]>>()

function getSharedGraphemeSegmenter(): Intl.Segmenter {
  if (sharedGraphemeSegmenter === null) {
    sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  }
  return sharedGraphemeSegmenter
}

// --- Public types ---

declare const preparedTextBrand: unique symbol

type PreparedCore = {
  widths: number[]
  lineEndFitAdvances: number[]
  lineEndPaintAdvances: number[]
  kinds: SegmentBreakKind[]
  simpleLineWalkFastPath: boolean
  segLevels: Int8Array | null
  breakableWidths: (number[] | null)[]
  breakablePrefixWidths: (number[] | null)[]
  discretionaryHyphenWidth: number
  tabStopAdvance: number
  chunks: PreparedLineChunk[]
}

export type PreparedText = {
  readonly [preparedTextBrand]: true
}

type InternalPreparedText = PreparedText & PreparedCore

export type PreparedTextWithSegments = InternalPreparedText & {
  segments: string[]
}

export type LayoutCursor = {
  segmentIndex: number
  graphemeIndex: number
}

export type LayoutResult = {
  lineCount: number
  height: number
}

export type LayoutLine = {
  text: string
  width: number
  start: LayoutCursor
  end: LayoutCursor
}

export type LayoutLineRange = {
  width: number
  start: LayoutCursor
  end: LayoutCursor
}

export type LayoutLinesResult = LayoutResult & {
  lines: LayoutLine[]
}

export type PrepareOptions = {
  whiteSpace?: WhiteSpaceMode
}

export type PreparedLineChunk = {
  startSegmentIndex: number
  endSegmentIndex: number
  consumedEndSegmentIndex: number
}

// --- Internal helpers ---

function createEmptyPrepared(includeSegments: boolean): InternalPreparedText | PreparedTextWithSegments {
  const base = {
    widths: [],
    lineEndFitAdvances: [],
    lineEndPaintAdvances: [],
    kinds: [],
    simpleLineWalkFastPath: true,
    segLevels: null,
    breakableWidths: [],
    breakablePrefixWidths: [],
    discretionaryHyphenWidth: 0,
    tabStopAdvance: 0,
    chunks: [],
  }
  if (includeSegments) {
    return { ...base, segments: [] } as unknown as PreparedTextWithSegments
  }
  return base as unknown as InternalPreparedText
}

function measureAnalysis(
  analysis: TextAnalysis,
  font: string,
  includeSegments: boolean,
): InternalPreparedText | PreparedTextWithSegments {
  const engineProfile = getEngineProfile()
  const { cache, emojiCorrection } = getFontMeasurementState(
    font,
    textMayContainEmoji(analysis.normalized),
  )
  const discretionaryHyphenWidth = getCorrectedSegmentWidth('-', getSegmentMetrics('-', cache), emojiCorrection)
  const spaceWidth = getCorrectedSegmentWidth(' ', getSegmentMetrics(' ', cache), emojiCorrection)
  const tabStopAdvance = spaceWidth * 8

  if (analysis.len === 0) return createEmptyPrepared(includeSegments)

  const widths: number[] = []
  const lineEndFitAdvances: number[] = []
  const lineEndPaintAdvances: number[] = []
  const kinds: SegmentBreakKind[] = []
  let simpleLineWalkFastPath = analysis.chunks.length <= 1
  const breakableWidths: (number[] | null)[] = []
  const breakablePrefixWidths: (number[] | null)[] = []
  const segments = includeSegments ? [] as string[] : null

  const preparedStartByAnalysisIndex = Array.from<number>({ length: analysis.len })
  const preparedEndByAnalysisIndex = Array.from<number>({ length: analysis.len })

  function pushMeasuredSegment(
    text: string, width: number, lineEndFitAdvance: number, lineEndPaintAdvance: number,
    kind: SegmentBreakKind, _start: number,
    breakable: number[] | null, breakablePrefix: number[] | null,
  ): void {
    if (kind !== 'text' && kind !== 'space' && kind !== 'zero-width-break') {
      simpleLineWalkFastPath = false
    }
    widths.push(width)
    lineEndFitAdvances.push(lineEndFitAdvance)
    lineEndPaintAdvances.push(lineEndPaintAdvance)
    kinds.push(kind)
    breakableWidths.push(breakable)
    breakablePrefixWidths.push(breakablePrefix)
    if (segments !== null) segments.push(text)
  }

  const graphemeSegmenter = getSharedGraphemeSegmenter()

  for (let mi = 0; mi < analysis.len; mi++) {
    preparedStartByAnalysisIndex[mi] = widths.length
    const segText = analysis.texts[mi]!
    const segKind = analysis.kinds[mi]!
    const _segStart = analysis.starts[mi]!

    if (segKind === 'soft-hyphen') {
      pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, _segStart, null, null)
      preparedEndByAnalysisIndex[mi] = widths.length
      continue
    }
    if (segKind === 'hard-break') {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, _segStart, null, null)
      preparedEndByAnalysisIndex[mi] = widths.length
      continue
    }
    if (segKind === 'tab') {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, _segStart, null, null)
      preparedEndByAnalysisIndex[mi] = widths.length
      continue
    }

    const segMetrics = getSegmentMetrics(segText, cache)

    if (segKind === 'text' && segMetrics.containsCJK) {
      let unitText = ''
      let unitStart = 0
      for (const gs of graphemeSegmenter.segment(segText)) {
        const grapheme = gs.segment
        if (unitText.length === 0) { unitText = grapheme; unitStart = gs.index; continue }
        if (kinsokuEnd.has(unitText) || kinsokuStart.has(grapheme) || leftStickyPunctuation.has(grapheme) ||
            (engineProfile.carryCJKAfterClosingQuote && isCJK(grapheme) && _endsWithClosingQuote(unitText))) {
          unitText += grapheme
          continue
        }
        const unitMetrics = getSegmentMetrics(unitText, cache)
        const w = getCorrectedSegmentWidth(unitText, unitMetrics, emojiCorrection)
        pushMeasuredSegment(unitText, w, w, w, 'text', _segStart + unitStart, null, null)
        unitText = grapheme
        unitStart = gs.index
      }
      if (unitText.length > 0) {
        const unitMetrics = getSegmentMetrics(unitText, cache)
        const w = getCorrectedSegmentWidth(unitText, unitMetrics, emojiCorrection)
        pushMeasuredSegment(unitText, w, w, w, 'text', _segStart + unitStart, null, null)
      }
      preparedEndByAnalysisIndex[mi] = widths.length
      continue
    }

    const w = getCorrectedSegmentWidth(segText, segMetrics, emojiCorrection)
    const lineEndFitAdvance = (segKind === 'space' || segKind === 'preserved-space' || segKind === 'zero-width-break') ? 0 : w
    const lineEndPaintAdvance = (segKind === 'space' || segKind === 'zero-width-break') ? 0 : w

    if (analysis.isWordLike[mi] && segText.length > 1) {
      const graphemeWidths = getSegmentGraphemeWidths(segText, segMetrics, cache, emojiCorrection)
      const graphemePrefixWidths = engineProfile.preferPrefixWidthsForBreakableRuns
        ? getSegmentGraphemePrefixWidths(segText, segMetrics, cache, emojiCorrection)
        : null
      pushMeasuredSegment(segText, w, lineEndFitAdvance, lineEndPaintAdvance, segKind, _segStart, graphemeWidths, graphemePrefixWidths)
    } else {
      pushMeasuredSegment(segText, w, lineEndFitAdvance, lineEndPaintAdvance, segKind, _segStart, null, null)
    }
    preparedEndByAnalysisIndex[mi] = widths.length
  }

  const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex)
  const segStarts = includeSegments ? analysis.starts : null
  const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts)

  if (segments !== null) {
    return {
      widths, lineEndFitAdvances, lineEndPaintAdvances, kinds,
      simpleLineWalkFastPath, segLevels, breakableWidths, breakablePrefixWidths,
      discretionaryHyphenWidth, tabStopAdvance, chunks, segments,
    } as unknown as PreparedTextWithSegments
  }
  return {
    widths, lineEndFitAdvances, lineEndPaintAdvances, kinds,
    simpleLineWalkFastPath, segLevels, breakableWidths, breakablePrefixWidths,
    discretionaryHyphenWidth, tabStopAdvance, chunks,
  } as unknown as InternalPreparedText
}

function mapAnalysisChunksToPreparedChunks(
  chunks: AnalysisChunk[],
  preparedStartByAnalysisIndex: number[],
  preparedEndByAnalysisIndex: number[],
): PreparedLineChunk[] {
  const preparedChunks: PreparedLineChunk[] = []
  const lastIdx = preparedEndByAnalysisIndex.length - 1
  const fallback = preparedEndByAnalysisIndex[lastIdx] ?? 0
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const starts = preparedStartByAnalysisIndex
    preparedChunks.push({
      startSegmentIndex: chunk.startSegmentIndex < starts.length ? starts[chunk.startSegmentIndex]! : fallback,
      endSegmentIndex: chunk.endSegmentIndex < starts.length ? starts[chunk.endSegmentIndex]! : fallback,
      consumedEndSegmentIndex: chunk.consumedEndSegmentIndex < starts.length ? starts[chunk.consumedEndSegmentIndex]! : fallback,
    })
  }
  return preparedChunks
}

function getInternalPrepared(prepared: PreparedText): InternalPreparedText {
  return prepared as InternalPreparedText
}

// --- Public API ---

/**
 * Prepare text for layout. One-time text analysis + measurement pass.
 * Returns an opaque handle to pass to layout().
 */
export function prepare(text: string, font: string, options?: PrepareOptions): PreparedText {
  const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace)
  return measureAnalysis(analysis, font, false) as PreparedText
}

/**
 * Rich variant that exposes segment data for manual line layouts.
 */
export function prepareWithSegments(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments {
  const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace)
  return measureAnalysis(analysis, font, true) as PreparedTextWithSegments
}

/**
 * Calculate text height at a given max width and lineHeight.
 * Pure arithmetic on cached widths — ~0.0002ms per text block.
 */
export function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult {
  const lineCount = countPreparedLines(getInternalPrepared(prepared), maxWidth)
  return { lineCount, height: lineCount * lineHeight }
}

function getLineTextCache(prepared: PreparedTextWithSegments): Map<number, string[]> {
  let cache = sharedLineTextCaches.get(prepared)
  if (cache !== undefined) return cache
  cache = new Map()
  sharedLineTextCaches.set(prepared, cache)
  return cache
}

function getSegmentGraphemes(segmentIndex: number, segments: string[], cache: Map<number, string[]>): string[] {
  let graphemes = cache.get(segmentIndex)
  if (graphemes !== undefined) return graphemes
  graphemes = []
  const gs = getSharedGraphemeSegmenter()
  for (const g of gs.segment(segments[segmentIndex]!)) graphemes.push(g.segment)
  cache.set(segmentIndex, graphemes)
  return graphemes
}

function lineHasDiscretionaryHyphen(kinds: SegmentBreakKind[], startSI: number, startGI: number, endSI: number): boolean {
  return endSI > 0 && kinds[endSI - 1] === 'soft-hyphen' && !(startSI === endSI && startGI > 0)
}

function buildLineTextFromRange(
  segments: string[], kinds: SegmentBreakKind[], cache: Map<number, string[]>,
  startSI: number, startGI: number, endSI: number, endGI: number,
): string {
  let text = ''
  const endsWithHyphen = lineHasDiscretionaryHyphen(kinds, startSI, startGI, endSI)
  for (let i = startSI; i < endSI; i++) {
    if (kinds[i] === 'soft-hyphen' || kinds[i] === 'hard-break') continue
    if (i === startSI && startGI > 0) {
      text += getSegmentGraphemes(i, segments, cache).slice(startGI).join('')
    } else {
      text += segments[i]!
    }
  }
  if (endGI > 0) {
    if (endsWithHyphen) text += '-'
    text += getSegmentGraphemes(endSI, segments, cache).slice(
      startSI === endSI ? startGI : 0, endGI,
    ).join('')
  } else if (endsWithHyphen) {
    text += '-'
  }
  return text
}

function materializeLayoutLine(
  prepared: PreparedTextWithSegments, cache: Map<number, string[]>,
  line: InternalLayoutLine,
): LayoutLine {
  return {
    text: buildLineTextFromRange(prepared.segments, prepared.kinds, cache,
      line.startSegmentIndex, line.startGraphemeIndex, line.endSegmentIndex, line.endGraphemeIndex),
    width: line.width,
    start: { segmentIndex: line.startSegmentIndex, graphemeIndex: line.startGraphemeIndex },
    end: { segmentIndex: line.endSegmentIndex, graphemeIndex: line.endGraphemeIndex },
  }
}

/**
 * High-level API: get all lines at a fixed width.
 * Returns per-line text/width pairs for custom rendering.
 */
export function layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): LayoutLinesResult {
  const lines: LayoutLine[] = []
  if (prepared.widths.length === 0) return { lineCount: 0, height: 0, lines }
  const graphemeCache = getLineTextCache(prepared)
  const lineCount = walkPreparedLines(getInternalPrepared(prepared), maxWidth, line => {
    lines.push(materializeLayoutLine(prepared, graphemeCache, line))
  })
  return { lineCount, height: lineCount * lineHeight, lines }
}

/**
 * Batch low-level line geometry pass without building text strings.
 */
export function walkLineRanges(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  onLine: (line: LayoutLineRange) => void,
): number {
  if (prepared.widths.length === 0) return 0
  return walkPreparedLines(getInternalPrepared(prepared), maxWidth, line => {
    onLine({
      width: line.width,
      start: { segmentIndex: line.startSegmentIndex, graphemeIndex: line.startGraphemeIndex },
      end: { segmentIndex: line.endSegmentIndex, graphemeIndex: line.endGraphemeIndex },
    })
  })
}

/**
 * Iterator-like API: lay out one line at a time with varying width.
 * Useful for text flowing around obstacles.
 */
export function layoutNextLine(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number,
): LayoutLine | null {
  const line = stepPreparedLineRange(prepared, start, maxWidth)
  if (line === null) return null
  return materializeLayoutLine(prepared, getLineTextCache(prepared), line)
}

/** Clear all internal caches */
export function clearCache(): void {
  clearAnalysisCaches()
  sharedGraphemeSegmenter = null
  sharedLineTextCaches = new WeakMap()
  clearMeasurementCaches()
}

/** Set locale for future prepare() calls */
export function setLocale(locale?: string): void {
  setAnalysisLocale(locale)
  clearCache()
}