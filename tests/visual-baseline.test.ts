// ==========================================================================
// tests/visual-baseline.test.ts — v8 渲染结构基准
//
// 目的：固化 chat-dom.ts 增量 DOM 投影的结构输出。
// 验证消息容器/块排列/工具卡骨架/折叠态的结构正确性。
//
// 捕获方式：feed ChatMessage[] → chat-dom mount → 序列化 mock DOM 树。
// 颜色归一化：工具卡随机双色每次运行不同，fixture 中替换为占位符。
// ==========================================================================

import assert from 'assert';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { group, test } from './runner.js';
import { initChatDom, clearChatDom, mountUserMessage, mountAiMessage } from '../src/client/modules/chat-dom.js';
import type { ContentBlock } from '../src/shared/chat-protocol/messages.js';

// ========== 测试基础设施 ==========

const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'visual-baseline');
const UPDATE_FIXTURES = process.env.UPDATE_FIXTURES === '1';

function makePanel(): { panelEl: any; contentArea: any } {
  const contentArea = (globalThis.document as any).createElement('div');
  contentArea.className = 'orb-panel-content';
  contentArea.style.overflowY = 'auto';
  contentArea.style.height = '600px';
  contentArea.style.width = '390px';

  const panelEl = (globalThis.document as any).createElement('div');
  panelEl.className = 'orb-panel';
  panelEl.style.pointerEvents = 'auto';
  panelEl.appendChild(contentArea);

  return { panelEl, contentArea };
}

/** 序列化 mock DOM 树为 HTML 字符串 */
function serializeEl(el: any, depth = 0): string {
  if (!el || !el.tagName) return '';
  const tag = el.tagName.toLowerCase();
  const attrs: string[] = [];
  if (el.id) attrs.push(`id="${el.id}"`);
  // mock DOM: classList.add() 不更新 className getter，需读 classList._classes
  const classes = el.classList?._classes?.length ? el.classList._classes.join(' ') : (typeof el.className === 'string' ? el.className : '');
  if (classes) attrs.push(`class="${classes}"`);
  if (el.dataset) {
    for (const [k, v] of Object.entries(el.dataset)) {
      if (v !== undefined && v !== '') attrs.push(`data-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}="${v}"`);
    }
  }
  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
  const children: any[] = el.children || [];
  const rawHtml = el.innerHTML || '';
  if (children.length === 0 && !rawHtml && !el.textContent) return `<${tag}${attrStr}/>`;
  if (children.length === 0) {
    const inner = rawHtml || el.textContent || '';
    return `<${tag}${attrStr}>${inner}</${tag}>`;
  }
  // mock DOM: innerHTML 和 children 可以共存（innerHTML 不解析为子元素）
  const inner = rawHtml + children.map(c => serializeEl(c, depth + 1)).join('');
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

interface TestMsg {
  role: 'user' | 'ai';
  content: ContentBlock[];
}

function render(messages: TestMsg[]): string {
  const { panelEl, contentArea } = makePanel();
  initChatDom(panelEl);
  clearChatDom();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      const tb = m.content.find(b => b?.type === 'text');
      mountUserMessage(i, tb && 'text' in tb ? (tb as any).text : '');
    } else {
      mountAiMessage(i, m.content);
    }
  }
  // 序列化 contentArea 的子元素
  const children: any[] = contentArea.children || [];
  return children.map(c => serializeEl(c)).join('\n');
}

/** 归一化随机颜色，使 fixture 跨运行稳定 */
function normalize(html: string): string {
  return html
    .replace(/#[0-9a-fA-F]{6}/g, '#COLOR')
    .replace(/rgba\([^)]+\)/g, 'RGBA')
    .replace(/hsl\([^)]+\)/g, 'HSL')
    .replace(/(margin-right:5px"><\/span>)[^<]*/g, '$1HINT_TEXT');
}

function assertFixture(name: string, html: string): void {
  const normalized = normalize(html);
  const filePath = join(FIXTURE_DIR, `${name}.html`);

  if (UPDATE_FIXTURES || !existsSync(filePath)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(filePath, normalized, 'utf-8');
    return;
  }

  const expected = readFileSync(filePath, 'utf-8');
  if (normalized !== expected) {
    const expLines = expected.split('\n');
    const actLines = normalized.split('\n');
    let diffAt = -1;
    for (let i = 0; i < Math.max(expLines.length, actLines.length); i++) {
      if (expLines[i] !== actLines[i]) { diffAt = i; break; }
    }
    assert.fail(
      `视觉基准 "${name}" 发生变化（首个 diff 在第 ${diffAt} 行）。\n` +
      `若为有意改动，运行 UPDATE_FIXTURES=1 npm test 更新基准。\n` +
      `期望: ${expLines[diffAt]?.slice(0, 120)}\n` +
      `实际: ${actLines[diffAt]?.slice(0, 120)}`
    );
  }
}

// ========== 场景定义 ==========

group('视觉基准 — 用户消息');

test('单条用户消息', () => {
  const html = render([
    { role: 'user', content: [{ type: 'text', text: '你好，帮我写一个排序算法' }] },
  ]);
  assert(html.includes('orb-msg'), '应有消息容器');
  assert(html.includes('orb-msg-text'), '应有文本区域');
  assert(html.includes('你好，帮我写一个排序算法'), '应包含用户文本');
  assert(html.includes('orb-copy-btn'), '应有复制按钮');
  assertFixture('user-single', html);
});

test('多条用户消息', () => {
  const html = render([
    { role: 'user', content: [{ type: 'text', text: '第一条' }] },
    { role: 'user', content: [{ type: 'text', text: '第二条' }] },
  ]);
  const count = (html.match(/data-mi="/g) || []).length;
  assert(count === 2, `应有 2 个消息容器，得 ${count}`);
  assertFixture('user-multiple', html);
});

// ========== AI 思考框 ==========

group('视觉基准 — AI 思考框');

test('思考完成（有正文 → 默认折叠）', () => {
  const html = render([
    { role: 'ai', content: [{ type: 'text', text: '这是回答', reasoning: '思考过程' }] },
  ]);
  assert(html.includes('已思考'), '完成思考应显示"已思考"');
  assert(html.includes('collapsed'), '完成后应默认折叠');
  assertFixture('thinking-done-collapsed', html);
});

// ========== AI 正文气泡 ==========

group('视觉基准 — AI 正文');

test('纯文本正文', () => {
  const html = render([
    { role: 'ai', content: [{ type: 'text', text: '这是一个简单的回答' }] },
  ]);
  assert(html.includes('orb-msg-text'), '应有文本区域');
  assertFixture('ai-text-plain', html);
});

test('思考 + 正文组合', () => {
  const html = render([
    { role: 'ai', content: [{ type: 'text', text: '最终回答', reasoning: '推理过程' }] },
  ]);
  assert(html.includes('已思考'), '应有思考框');
  assertFixture('ai-thinking-plus-text', html);
});

// ========== 工具卡 ==========

group('视觉基准 — 工具卡');

test('工具执行中（无 result）', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_1', name: 'bash', input: { command: 'ls -la' } } as any,
    ] },
  ]);
  assert(html.includes('orb-tool-card'), '应有工具卡容器');
  assert(html.includes('bash'), '应显示工具名');
  assert(html.includes('忙碌中'), '执行中应显示"忙碌中"');
  assertFixture('tool-executing', html);
});

test('工具完成 — bash 成功', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_1', name: 'bash', input: { command: 'echo hello' },
        result: { content: [{ type: 'text', text: 'hello' }], isError: false } } as any,
    ] },
  ]);
  assert(html.includes('成功'), '完成应显示"成功"');
  assert(html.includes('collapsed'), '完成工具卡应默认折叠');
  assertFixture('tool-done-bash', html);
});

test('工具完成 — write（文件卡片）', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_2', name: 'write', input: { path: '/src/main.ts', content: 'console.log(1)' },
        result: { content: [{ type: 'text', text: 'console.log(1)' }], isError: false,
          details: { name: 'main.ts', path: '/src/main.ts', lines: 1, size: 15 } } } as any,
    ] },
  ]);
  assert(html.includes('orb-write-card'), '应有 write 文件卡片');
  assert(html.includes('main.ts'), '应显示文件名');
  assert(html.includes('1 行'), '应显示行数');
  assertFixture('tool-done-write', html);
});

test('工具完成 — edit（diff 卡片）', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_3', name: 'edit', input: { path: '/src/app.ts' },
        result: { content: [{ type: 'text', text: 'ok' }], isError: false,
          details: { name: 'app.ts', path: '/src/app.ts', oldText: 'const x = 1', newText: 'const x = 2', lineStart: 5, lineEnd: 5 } } } as any,
    ] },
  ]);
  assert(html.includes('orb-edit-card'), '应有 edit 卡片');
  assert(html.includes('app.ts'), '应显示文件名');
  assert(html.includes('L5'), '应显示行号');
  assertFixture('tool-done-edit', html);
});

test('工具完成 — grep（匹配列表）', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_4', name: 'grep', input: { pattern: 'TODO' },
        result: { content: [{ type: 'text', text: 'src/a.ts:10: // TODO fix\nsrc/b.ts:20: // TODO cleanup' }],
          isError: false, details: { count: 2 } } } as any,
    ] },
  ]);
  assert(html.includes('orb-grep-card'), '应有 grep 卡片');
  assert(html.includes('2 处匹配'), '应显示匹配数');
  assertFixture('tool-done-grep', html);
});

test('工具完成 — glob（文件列表）', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_5', name: 'glob', input: { pattern: '**/*.ts' },
        result: { content: [{ type: 'text', text: 'src/\nsrc/main.ts\nsrc/app.ts' }],
          isError: false, details: { count: 3 } } } as any,
    ] },
  ]);
  assert(html.includes('orb-glob-card'), '应有 glob 卡片');
  assert(html.includes('3 个文件'), '应显示文件数');
  assertFixture('tool-done-glob', html);
});

test('工具失败', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'call_6', name: 'bash', input: { command: 'exit 1' },
        result: { content: [{ type: 'text', text: 'command failed' }], isError: true } } as any,
    ] },
  ]);
  assert(html.includes('失败'), '失败应显示"失败"');
  assertFixture('tool-error', html);
});

// ========== 规则警告 ==========

group('视觉基准 — 规则警告');

test('规则警告框', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'rule_warning', content: '[规则警告: 危险操作] 此操作可能删除文件' } as any,
    ] },
  ]);
  assert(html.includes('危险操作'), '应显示警告短名');
  assert(html.includes('此操作可能删除文件'), '应包含警告内容');
  assertFixture('rule-warning', html);
});

// ========== 复合场景 ==========

group('视觉基准 — 复合场景');

test('完整 AI 回复：思考 + 正文 + 多工具', () => {
  const html = render([
    { role: 'user', content: [{ type: 'text', text: '帮我重构这个文件' }] },
    { role: 'ai', content: [
      { type: 'text', text: '好的，我来看看这个文件。', reasoning: '用户想重构，我先读取文件内容' },
      { type: 'tool', id: 'call_r1', name: 'read', input: { path: '/src/old.ts' },
        result: { content: [{ type: 'text', text: 'const x = 1;\nconst y = 2;' }], isError: false } } as any,
      { type: 'tool', id: 'call_w1', name: 'write', input: { path: '/src/old.ts', content: 'export const x = 1;' },
        result: { content: [{ type: 'text', text: 'export const x = 1;' }], isError: false,
          details: { name: 'old.ts', path: '/src/old.ts', lines: 1, size: 18 } } } as any,
    ] },
  ]);
  const msgCount = (html.match(/data-mi="/g) || []).length;
  assert(msgCount === 2, `应有 2 条消息（user + ai），得 ${msgCount}`);
  assert(html.includes('已思考'), '应有思考框');
  assert(html.includes('read'), '应有 read 工具卡');
  assert(html.includes('orb-write-card'), '应有 write 文件卡片');
  assertFixture('composite-full-turn', html);
});

test('多轮对话：user → ai → user → ai', () => {
  const html = render([
    { role: 'user', content: [{ type: 'text', text: '你好' }] },
    { role: 'ai', content: [{ type: 'text', text: '你好！有什么可以帮你的？' }] },
    { role: 'user', content: [{ type: 'text', text: '写个函数' }] },
    { role: 'ai', content: [
      { type: 'text', text: '好的' },
      { type: 'tool', id: 'call_f1', name: 'write', input: { path: '/fn.ts', content: 'export function fn() {}' },
        result: { content: [{ type: 'text', text: 'export function fn() {}' }], isError: false,
          details: { name: 'fn.ts', path: '/fn.ts', lines: 1, size: 24 } } } as any,
    ] },
  ]);
  const msgCount = (html.match(/data-mi="/g) || []).length;
  assert(msgCount === 4, `应有 4 条消息，得 ${msgCount}`);
  assertFixture('multi-turn', html);
});

test('空消息列表', () => {
  const html = render([]);
  assert(!html.includes('orb-msg'), '空列表不应有消息容器');
  assertFixture('empty', html);
});

// ========== 结构不变量 ==========

group('视觉基准 — 结构不变量');

test('消息容器带 data-mi 索引', () => {
  const html = render([
    { role: 'user', content: [{ type: 'text', text: 'a' }] },
    { role: 'ai', content: [{ type: 'text', text: 'b' }] },
  ]);
  assert(html.includes('data-mi="0"'), '第一条消息 data-mi=0');
  assert(html.includes('data-mi="1"'), '第二条消息 data-mi=1');
});

test('工具卡有唯一 id（tc{mi}_{ti}）', () => {
  const html = render([
    { role: 'ai', content: [
      { type: 'tool', id: 'c1', name: 'a', input: {} } as any,
      { type: 'tool', id: 'c2', name: 'b', input: {} } as any,
    ] },
  ]);
  assert(html.includes('id="tc0_0"'), '第一个工具卡 id=tc0_0');
  assert(html.includes('id="tc0_1"'), '第二个工具卡 id=tc0_1');
});

test('思考框有唯一 id（r{mi}）', () => {
  const html = render([
    { role: 'ai', content: [{ type: 'text', text: '', reasoning: 'thinking' }] },
  ]);
  assert(html.includes('id="r0"'), '思考框 id=r0');
});
