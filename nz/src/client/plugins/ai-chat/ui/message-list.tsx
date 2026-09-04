/**
 * ui/message-list.tsx — 消息列表皮（BeautifulUI chat.tsx 词汇重写，§3.1
 * 裁剪表：借三段结构中的消息区 + 用户气泡右对齐软块 + fade-up 入场动画
 * （动画在 tokens.css [data-aichat-msg]）；Phase 剧本定时器/假数据/tabs/
 * action 钮/Section 组件全裁）。
 *
 * 数据驱动 = 消息核（shared reducer 直接产物）逐条投影：
 *   · key = 消息下标（append-only，身份稳定 → P6 只增不重建）；
 *   · R3 归位（displayBody，§1.2）：text 空且 reasoning 非空 → reasoning
 *     归位为正文显示（灰一档）；text 非空 → 正文 text，reasoning 收
 *     <details> 思考折叠区（A1 无动画）；
 *   · P8 容忍忽略：tool / rule_warning 块不渲染（数据在核里，不抛错）。
 */
import { createElement } from 'react';
import type { ChatMessage, TextBlock } from '../../../../shared/chat-protocol/messages.js';
import { displayBody } from '../../../../shared/chat-protocol/display.js';
import type { RunPhase } from '../chat-link.js';
import { StreamingText } from './streaming-text.js';

export interface MessageListProps {
  messages: ChatMessage[];
  /** reducer cursor：当前流式消息下标（-1 = 无活跃） */
  msgIdx: number;
  phase: RunPhase;
}

function AiMessage(props: { msg: ChatMessage; active: boolean }): React.ReactElement {
  const { msg, active } = props;
  return createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '32px' },
  },
  ...msg.content.map((block, bi) => {
    if (block.type !== 'text') return null; // P8：tool/rule_warning 容忍忽略不渲染
    const tb = block as TextBlock;
    const body = displayBody(tb);
    const nodes: React.ReactElement[] = [];
    // text 非空时 reasoning 收折叠区（A1 只做 <details>，无动画——§1.2）
    if (body.reasoning) {
      nodes.push(createElement('details', {
        key: `think-${bi}`, 'data-aichat-thinking': '1',
        style: { fontSize: '12px', color: 'var(--kfm-ink-3)' },
      },
      createElement('summary', { style: { cursor: 'pointer', userSelect: 'none' } }, '思考'),
      createElement('div', {
        style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--kfm-ink-2)', marginTop: '4px' },
      }, body.reasoning),
      ));
    }
    if (body.text || active) {
      nodes.push(createElement('div', {
        key: `body-${bi}`, 'data-aichat-bubble': '1',
        ...(active ? { 'data-aichat-streaming': '1' } : {}),
        style: { fontSize: '13px', lineHeight: 1.55 },
      }, createElement(StreamingText, { text: body.text, relocated: body.relocated, streaming: active })));
    }
    return createElement('div', { key: `blk-${bi}` }, ...nodes);
  }).filter((n): n is React.ReactElement => n !== null),
  );
}

export function MessageList(props: MessageListProps): React.ReactElement {
  const { messages, msgIdx, phase } = props;
  return createElement('div', {
    'data-aichat-list': '1',
    style: {
      flex: 1, minHeight: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: '10px',
      padding: '12px 14px 8px',
    },
  },
  messages.length === 0
    ? createElement('div', {
        style: { margin: 'auto', color: 'var(--kfm-ink-3)', fontSize: '13px', textAlign: 'center' },
      }, '发一条消息，接通 AI。')
    : messages.map((m, i) => createElement('div', {
        key: i, 'data-aichat-msg': m.role,
        style: { display: 'flex', flexDirection: 'column' },
      },
      m.role === 'user'
        // 用户气泡右对齐软块（借 chat.tsx 词汇：bg-field 圆角软块）
        ? createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', paddingLeft: '56px' } },
            createElement('div', {
              style: {
                background: 'var(--kfm-field)', borderRadius: 'var(--kfm-radius-xl)',
                padding: '6px 12px', fontSize: '13px', lineHeight: 1.4, color: 'var(--kfm-ink)',
                whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              },
            }, m.content.map((b) => (b.type === 'text' ? (b as TextBlock).text : '')).join('')),
          )
        : createElement(AiMessage, { msg: m, active: i === msgIdx && phase !== 'IDLE' }),
      )),
  );
}
