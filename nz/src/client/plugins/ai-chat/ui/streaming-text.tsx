/**
 * ui/streaming-text.tsx — 流式气泡正文皮（BeautifulUI streaming-text.tsx
 * 词汇重写，§3.1 裁剪表：只搬「流式中光标（竖条闪烁）」；假 TOKENS 循环/
 * SourceChip/follow-ups/ACTION_ICONS 全裁；逐词 blur 入场不搬——§八②裁决，
 * 真流是 token 不是词，A1 正文直接渲染 + 光标）。
 *
 * 数据驱动：text 由消息核（reducer 产物）原地增长，本组件无状态——同一
 * React 节点持续重渲染，DOM 身份稳定（P6）。
 */
import { createElement } from 'react';

export interface StreamingTextProps {
  text: string;
  /** R3 归位标记：true = 显示的是思考链（灰一档 --kfm-ink-2 以示思考性质） */
  relocated: boolean;
  /** 流式中 = 挂竖条光标（WAITING/STREAMING；done/error 后光标退场） */
  streaming: boolean;
}

export function StreamingText(props: StreamingTextProps): React.ReactElement {
  return createElement('span', {
    'data-aichat-text': '1',
    style: {
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      color: props.relocated ? 'var(--kfm-ink-2)' : 'var(--kfm-ink)',
    },
  },
  props.text,
  props.streaming ? createElement('span', { 'data-aichat-cursor': '1' }) : null,
  );
}
