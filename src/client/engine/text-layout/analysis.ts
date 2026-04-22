/**
 * Text analysis module for KFM v2 text-layout engine.
 * Ported from @chenglou/pretext (MIT license).
 *
 * Responsibilities:
 * - Whitespace normalization (CSS white-space: normal / pre-wrap)
 * - Text segmentation via Intl.Segmenter (CJK, Thai, Arabic, etc.)
 * - Punctuation merging ("better." measured as one unit)
 * - CJK禁则 handling
 */
// ============================================================
// Types
// ============================================================

export type WhiteSpaceMode = 'normal' | 'pre-wrap'

export type SegmentBreakKind =
  | 'text'
  | 'space'
  | 'preserved-space'
  | 'tab'
  | 'glue'
  | 'zero-width-break'
  | 'soft-hyphen'
  | 'hard-break'

type SegmentationPiece = {
  text: string
  isWordLike: boolean
  kind: SegmentBreakKind
  start: number
}

export type MergedSegmentation = {
  len: number
  texts: string[]
  isWordLike: boolean[]
  kinds: SegmentBreakKind[]
  starts: number[]
}

export type AnalysisChunk = {
  startSegmentIndex: number
  endSegmentIndex: number
  consumedEndSegmentIndex: number
}

export type TextAnalysis = { normalized: string, chunks: AnalysisChunk[] } & MergedSegmentation

// ============================================================
// Whitespace normalization
// ============================================================

const collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g
const needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/

type WhiteSpaceProfile = {
  mode: WhiteSpaceMode
  preserveOrdinarySpaces: boolean
  preserveHardBreaks: boolean
}

function getWhiteSpaceProfile(whiteSpace?: WhiteSpaceMode): WhiteSpaceProfile {
  const mode = whiteSpace ?? 'normal'
  return {
    mode,
    preserveOrdinarySpaces: mode === 'pre-wrap',
    preserveHardBreaks: mode === 'pre-wrap',
  }
}

function normalizeWhitespace(text: string, profile: WhiteSpaceProfile): string {
  if (!needsWhitespaceNormalizationRe.test(text)) return text
  if (profile.preserveHardBreaks) {
    // pre-wrap: collapse spaces/tabs but preserve newlines
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/^ /gm, '')
      .replace(/ $/gm, '')
  }
  // normal: collapse all whitespace to single space
  return text.replace(collapsibleWhitespaceRunRe, ' ').replace(/^ | $/g, '')
}

// ============================================================
// CJK helpers
// ============================================================

const cjkRanges = [
  [0x1100, 0x11FF], // Hangul Jamo
  [0x2E80, 0x2FDF], // CJK Radicals Supplement
  [0x2FF0, 0x2FFF], // Ideographic Description Characters
  [0x3000, 0x303F], // CJK Symbols and Punctuation
  [0x3040, 0x309F], // Hiragana
  [0x30A0, 0x30FF], // Katakana
  [0x3100, 0x312F], // Bopomofo
  [0x3130, 0x318F], // Hangul Compatibility Jamo
  [0x31C0, 0x31EF], // CJK Strokes
  [0x3200, 0x32FF], // Enclosed CJK Letters and Months
  [0x3300, 0x33FF], // CJK Compatibility
  [0x3400, 0x4DBF], // CJK Unified Ideographs Extension A
  [0x4E00, 0x9FFF], // CJK Unified Ideographs
  [0xA960, 0xA97F], // Hangul Jamo Extended-A
  [0xAC00, 0xD7AF], // Hangul Syllables
  [0xD7B0, 0xD7FF], // Hangul Jamo Extended-B
  [0xF900, 0xFAFF], // CJK Compatibility Ideographs
  [0xFE10, 0xFE1F], // Vertical Forms
  [0xFE30, 0xFE4F], // CJK Compatibility Forms
  [0xFF00, 0xFFEF], // Halfwidth and Fullwidth Forms
  [0x1F200, 0x1F2FF], // Enclosed Ideographic Supplement
  [0x20000, 0x2A6DF], // CJK Unified Ideographs Extension B
  [0x2A700, 0x2B73F], // CJK Unified Ideographs Extension C
  [0x2B740, 0x2B81F], // CJK Unified Ideographs Extension D
  [0x2B820, 0x2CEAF], // CJK Unified Ideographs Extension E
]

export function isCJK(char: string): boolean {
  const code = char.codePointAt(0)!
  for (const [lo, hi] of cjkRanges) {
    if (code >= lo && code <= hi) return true
  }
  return false
}

// 禁则 characters that should not start a line
export const kinsokuStart = new Set(')]}｝］〉》」』】"\'"′″‵〉》」』】〕）》」』】｝』」))')

// 禁则 characters that should not end a line
export const kinsokuEnd = new Set('([｛［〈《「『【"\'"′″‵〈《「『【〔（《『【｛『「((')

// Punctuation that sticks to the left of following content
export const leftStickyPunctuation = new Set('"\'"\'"′″‵»')

export function endsWithClosingQuote(text: string): boolean {
  const last = text[text.length - 1]
  return last === '"' || last === '"' || last === '‹' || last === '›'
}

// ============================================================
// Segmenter
// ============================================================

let sharedWordSegmenter: Intl.Segmenter | null = null
let analysisLocale: string | undefined

export function setAnalysisLocale(locale?: string): void {
  analysisLocale = locale
  clearAnalysisCaches()
}

function getSharedWordSegmenter(): Intl.Segmenter {
  if (sharedWordSegmenter === null) {
    sharedWordSegmenter = new Intl.Segmenter(analysisLocale, { granularity: 'word' })
  }
  return sharedWordSegmenter
}

function isSegmentBreak(text: string): boolean {
  return /^[\n\r]$/.test(text)
}

function isWhitespace(text: string): boolean {
  return /^\s+$/.test(text)
}

// ============================================================
// Analysis pipeline
// ============================================================

function segmentText(text: string): SegmentationPiece[] {
  const segmenter = getSharedWordSegmenter()
  const pieces: SegmentationPiece[] = []
  let offset = 0

  for (const seg of segmenter.segment(text)) {
    const piece = seg.segment
    const start = seg.index

    // Fill any gap (segmenter may skip whitespace)
    while (offset < start) {
      const gap = text[offset]!
      if (gap === '\n') {
        pieces.push({ text: gap, isWordLike: false, kind: 'hard-break', start: offset })
      } else if (gap === '\t') {
        pieces.push({ text: gap, isWordLike: false, kind: 'tab', start: offset })
      } else if (gap === '\u00AD') {
        pieces.push({ text: gap, isWordLike: false, kind: 'soft-hyphen', start: offset })
      } else if (gap === '\u200B' || gap === '\u2060' || gap === '\uFEFF') {
        pieces.push({ text: gap, isWordLike: false, kind: 'zero-width-break', start: offset })
      } else {
        pieces.push({ text: gap, isWordLike: false, kind: 'space', start: offset })
      }
      offset++
    }

    if (isSegmentBreak(piece)) {
      pieces.push({ text: piece, isWordLike: false, kind: 'hard-break', start })
    } else if (piece === '\t') {
      pieces.push({ text: piece, isWordLike: false, kind: 'tab', start })
    } else if (piece === '\u00AD') {
      pieces.push({ text: piece, isWordLike: false, kind: 'soft-hyphen', start })
    } else if (piece === '\u200B' || piece === '\u2060' || piece === '\uFEFF') {
      pieces.push({ text: piece, isWordLike: false, kind: 'zero-width-break', start })
    } else if (isWhitespace(piece)) {
      pieces.push({
        text: piece,
        isWordLike: false,
        kind: 'preserved-space' as SegmentBreakKind,
        start,
      })
    } else {
      pieces.push({ text: piece, isWordLike: seg.isWordLike ?? false, kind: 'text', start })
    }
    offset = start + piece.length
  }

  // Trailing gap
  while (offset < text.length) {
    const gap = text[offset]!
    if (gap === '\n') {
      pieces.push({ text: gap, isWordLike: false, kind: 'hard-break', start: offset })
    } else if (gap === '\u00AD') {
      pieces.push({ text: gap, isWordLike: false, kind: 'soft-hyphen', start: offset })
    } else {
      pieces.push({ text: gap, isWordLike: false, kind: 'space', start: offset })
    }
    offset++
  }

  return pieces
}

/**
 * Merge punctuation into preceding word ("better." as one unit),
 * handle CJK grapheme splitting, and build chunks for line breaking.
 */
function buildMergedSegments(
  pieces: SegmentationPiece[],
  profile: WhiteSpaceProfile,
): MergedSegmentation {
  if (pieces.length === 0) {
    return { len: 0, texts: [], isWordLike: [], kinds: [], starts: [] }
  }

  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  for (const piece of pieces) {
    if (piece.kind === 'text') {
      texts.push(piece.text)
      isWordLike.push(piece.isWordLike)
      kinds.push('text')
      starts.push(piece.start)
    } else if (piece.kind === 'space') {
      texts.push(piece.text)
      isWordLike.push(false)
      kinds.push(profile.preserveOrdinarySpaces ? 'preserved-space' : 'space')
      starts.push(piece.start)
    } else if (piece.kind === 'preserved-space') {
      texts.push(piece.text)
      isWordLike.push(false)
      kinds.push('preserved-space')
      starts.push(piece.start)
    } else {
      // hard-break, tab, soft-hyphen, zero-width-break
      texts.push(piece.text)
      isWordLike.push(false)
      kinds.push(piece.kind)
      starts.push(piece.start)
    }
  }

  return { len: texts.length, texts, isWordLike, kinds, starts }
}

/**
 * Build analysis chunks from merged segments.
 * Each chunk represents a "paragraph" between hard breaks.
 */
function buildChunks(merged: MergedSegmentation): AnalysisChunk[] {
  const chunks: AnalysisChunk[] = []
  let chunkStart = 0

  for (let i = 0; i < merged.len; i++) {
    if (merged.kinds[i] === 'hard-break') {
      chunks.push({
        startSegmentIndex: chunkStart,
        endSegmentIndex: i + 1,
        consumedEndSegmentIndex: i + 1,
      })
      chunkStart = i + 1
    }
  }

  if (chunkStart < merged.len || chunks.length === 0) {
    chunks.push({
      startSegmentIndex: chunkStart,
      endSegmentIndex: merged.len,
      consumedEndSegmentIndex: merged.len,
    })
  }

  return chunks
}

// ============================================================
// Public API
// ============================================================

let analysisCache = new Map<string, TextAnalysis>()

export function clearAnalysisCaches(): void {
  analysisCache = new Map()
}

export function analyzeText(
  text: string,
  _engineProfile?: any, // reserved for future use
  whiteSpace?: WhiteSpaceMode,
): TextAnalysis {
  const profile = getWhiteSpaceProfile(whiteSpace)
  const normalized = normalizeWhitespace(text, profile)

  const cacheKey = `${normalized}\x00${profile.mode}`
  const cached = analysisCache.get(cacheKey)
  if (cached !== undefined) return cached

  const pieces = segmentText(normalized)
  const merged = buildMergedSegments(pieces, profile)
  const chunks = buildChunks(merged)

  const analysis: TextAnalysis = {
    normalized,
    chunks,
    len: merged.len,
    texts: merged.texts,
    isWordLike: merged.isWordLike,
    kinds: merged.kinds,
    starts: merged.starts,
  }

  analysisCache.set(cacheKey, analysis)
  return analysis
}
