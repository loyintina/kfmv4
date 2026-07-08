import { test, group } from './runner.js';
import assert from 'assert';
import { isCJK, endsWithClosingQuote, kinsokuStart, kinsokuEnd, leftStickyPunctuation } from '../src/client/engine/text-layout/analysis.js';
import { computeSegmentLevels } from '../src/client/engine/text-layout/bidi.js';
import { parseFontSize, textMayContainEmoji } from '../src/client/engine/text-layout/measurement.js';

group('text-layout analysis');

test('isCJK detects CJK characters', () => {
  assert(isCJK('中') === true);
  assert(isCJK('日') === true);
  assert(isCJK('本') === true);
  assert(isCJK('語') === true);
  assert(isCJK('a') === false);
  assert(isCJK(' ') === false);
  assert(isCJK('1') === false);
});

test('isCJK detects Korean hangul', () => {
  assert(isCJK('한') === true);
  assert(isCJK('글') === true);
});

test('endsWithClosingQuote detects known closing characters', () => {
  // ASCII double quote is a closing quote in the function
  assert(endsWithClosingQuote('hello\u0022') === true);
  assert(endsWithClosingQuote('hello') === false);
  assert(endsWithClosingQuote('') === false);
});

test('kinsokuStart contains common closing brackets', () => {
  assert(kinsokuStart.has(')'));
  assert(kinsokuStart.has(']'));
  assert(kinsokuStart.has('}'));
  assert(kinsokuStart.has('」'));
});

test('kinsokuEnd contains common full-width opening brackets', () => {
  assert(kinsokuEnd.has('\uFF08'));  // （
  assert(kinsokuEnd.has('\u300C'));  // 「
  assert(kinsokuEnd.has('\u300E'));  // 『
});

test('leftStickyPunctuation contains French quotes', () => {
  assert(leftStickyPunctuation.has('»'));
});

group('text-layout bidi');

test('computeSegmentLevels returns null for all-LTR text', () => {
  const result = computeSegmentLevels('hello world', [0, 6]);
  assert(result === null);
});

test('computeSegmentLevels detects RTL character', () => {
  // Hebrew aleph (U+05D0) is RTL
  const result = computeSegmentLevels('\u05D0bc', [0]);
  assert(result !== null);
});

test('computeSegmentLevels returns Int8Array with correct length', () => {
  const result = computeSegmentLevels('\u05D0\u05D1\u05D2', [0, 1, 2]);
  assert(result !== null);
  assert(result!.length === 3);
});

group('text-layout measurement');

test('parseFontSize extracts px from font string', () => {
  assert(parseFontSize('12px sans-serif') === 12);
  assert(parseFontSize('16px monospace') === 16);
  assert(parseFontSize('24px Arial') === 24);
});

test('parseFontSize defaults to 16 for invalid input', () => {
  assert(parseFontSize('') === 16);
  assert(parseFontSize('bold') === 16);
});

test('textMayContainEmoji detects emoji characters', () => {
  assert(textMayContainEmoji('hello 😀 world') === true);
});

test('textMayContainEmoji returns false for plain text', () => {
  assert(textMayContainEmoji('hello world') === false);
  assert(textMayContainEmoji('') === false);
});
