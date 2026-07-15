/**
 * md-css.ts — Markdown 渲染 CSS（全局唯一来源）
 *
 * orb.ts（AI 对话面板）和 handler-factory.ts（文件卡 MD 渲染）共享同一套 CSS。
 * 改一处全局同步，禁止在消费方硬编码 MD 样式。
 *
 * 使用方式：
 *   import { MD_CSS } from './renderers/md-css.js';
 *   注入时用 <div class="md-body"> 包裹 markdown 内容。
 */

import { KATEX_CSS } from './katex-css.js';

export const MD_CSS = [
  '.md-body{font-size:var(--card-font-size,13px);line-height:1.7;color:#e0e0e0;padding:6px 0;overflow-wrap:break-word;overflow-x:auto}',
  '.md-body h1,.md-body h2,.md-body h3{margin:14px 0 4px;font-weight:600}',
  '.md-body h1{font-size:1.15em}.md-body h2{font-size:1em}.md-body h3{font-size:0.92em}',
  '.md-body h4,.md-body h5,.md-body h6{font-size:0.85em;margin:8px 0 2px;font-weight:600}',
  '.md-body p{margin:4px 0}',
  '.md-body ul,.md-body ol{padding-left:20px;margin:4px 0;list-style-position:outside}',
  '.md-body ul{list-style-type:disc}.md-body ul ul{list-style-type:circle}.md-body ul ul ul{list-style-type:square}',
  '.md-body ol{list-style-type:decimal}.md-body ol ol{list-style-type:lower-alpha}',
  '.md-body li{margin:2px 0}',
  '.md-body li::marker{color:var(--card-accent)}',
  '.md-body input[type=checkbox]{-webkit-appearance:none;appearance:none;width:14px;height:14px;border:2px solid var(--card-accent);border-radius:3px;vertical-align:middle;margin-right:6px;cursor:pointer;transition:all 0.15s;position:relative;top:2px;pointer-events:auto}',
  '.md-body input[type=checkbox]:checked{background:var(--card-accent);background-image:url("data:image/svg+xml,%3Csvg viewBox=%270 0 12 12%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M2 6l3 3 5-5%27 stroke=%27white%27 stroke-width=%272%27 fill=%27none%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E");background-size:10px;background-position:center;background-repeat:no-repeat}',
  '.md-body blockquote{border-left:2px solid rgba(0,212,255,0.3);padding:4px 10px;margin:8px 0;opacity:0.88;background:rgba(0,212,255,0.04);border-radius:0 4px 4px 0}',
  '.md-body hr{border:none;border-top:1px solid var(--card-accent);margin:14px 0}',
  '.md-body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:0.85em;overflow-x:auto;display:block}',
  '.md-body thead,.md-body tbody{display:table;width:100%}',
  '.md-body th,.md-body td{border:1px solid rgba(255,255,255,0.15);padding:4px 8px;text-align:left}',
  '.md-body th{background:rgba(0,212,255,0.1);font-weight:600;border-bottom-width:2px}',
  '.md-body tr:nth-child(even){background:rgba(255,255,255,0.03)}',
  '.md-body code{background:rgba(0,0,0,0.25);padding:1px 5px;border-radius:4px;font-size:0.77em;font-family:monospace}',
  '.md-body pre{padding:24px 10px 8px;background:rgba(0,0,0,0.28);border-radius:6px;overflow-x:auto;margin:8px 0;font-size:0.77em;line-height:1.5;border:1px solid rgba(255,255,255,0.06)}',
  '.md-body pre code{background:none;padding:0;border-radius:0;font-size:1em}',
  '.md-body a{color:rgba(0,212,255,0.85);text-decoration:none}',
  '.md-body img{max-width:100%;border-radius:6px}',
  '.md-body mark{background:rgba(255,235,59,0.25);color:#fff;padding:0 2px;border-radius:2px}',
  '.md-body .wikilink{color:rgba(0,212,255,0.75);font-weight:500;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}',
  '.callout{border-radius:6px;padding:6px 12px;margin:8px 0;font-size:0.92em;line-height:1.6}',
  '.callout-header{font-size:0.92em;font-weight:600;margin-bottom:2px}',
  '.callout-body{font-size:0.85em;opacity:0.9}',
  '.callout-info{background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2)}.callout-info .callout-header{color:rgba(0,212,255,0.85)}',
  '.callout-warning{background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.2)}.callout-warning .callout-header{color:rgba(255,193,7,0.85)}',
  '.callout-danger{background:rgba(244,67,54,0.08);border:1px solid rgba(244,67,54,0.2)}.callout-danger .callout-header{color:rgba(244,67,54,0.85)}',
  '.callout-todo{background:rgba(156,39,176,0.08);border:1px solid rgba(156,39,176,0.2)}.callout-todo .callout-header{color:rgba(156,39,176,0.85)}',
  '.callout-note{background:rgba(76,175,80,0.08);border:1px solid rgba(76,175,80,0.2)}.callout-note .callout-header{color:rgba(76,175,80,0.85)}',
  '.callout-tip{background:rgba(0,188,212,0.08);border:1px solid rgba(0,188,212,0.2)}.callout-tip .callout-header{color:rgba(0,188,212,0.85)}',
  '.callout-question{background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.2)}.callout-question .callout-header{color:rgba(255,152,0,0.85)}',
  '.callout-success{background:rgba(76,175,80,0.08);border:1px solid rgba(76,175,80,0.2)}.callout-success .callout-header{color:rgba(76,175,80,0.85)}',
  KATEX_CSS,
  '.mermaid-container{display:flex;justify-content:center;margin:12px 0;overflow-x:auto}.mermaid-container svg{max-width:100%}',
  '.mermaid-container svg .label{color:#e0e0e0!important}.mermaid-container svg .edgeLabel{background:rgba(10,10,15,0.85)!important}',
  '.hljs-keyword{color:#c792ea}.hljs-string{color:#ecc48d}.hljs-comment{color:#546e7a;font-style:italic}.hljs-number{color:#f78c6c}.hljs-title{color:#82aaff}.hljs-type{color:#ffcb6b}.hljs-attr{color:#c792ea}.hljs-built_in{color:#ffcb6b}.hljs-literal{color:#f78c6c}.hljs-function .hljs-title{color:#82aaff}.hljs-params{color:#a6accd}.hljs-meta{color:#89ddff}.hljs-tag{color:#f07178}.hljs-name{color:#f07178}.hljs-attribute{color:#c792ea}.hljs-selector-class{color:#ffcb6b}.hljs-selector-tag{color:#f07178}.hljs-addition{color:#c3e88d}.hljs-deletion{color:#f07178}',
].join('');
