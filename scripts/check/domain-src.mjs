/**
 * KFM v4 — 域 → src 路径映射（单一真相源）
 *
 * 消费方：
 *   - check-contract-freshness.mjs（域契约新鲜度）
 *   - gen-code-inventory.mjs（机械层清单生成）
 * 新增模块/目录时必须同步此表（check-doc-coverage 会兜底漏网文件）。
 */

export const DOMAIN_SRC = {
  'canvas-tree': [
    'src/client/modules/tree-render.ts', 'src/client/modules/tree-overlay.ts',
    'src/client/modules/tree-animation.ts', 'src/client/modules/tree-swipe.ts',
    'src/client/modules/tree-model.ts', 'src/client/modules/tree-loader.ts',
    'src/client/modules/canvas-cursor.ts', 'src/client/modules/liquid-geometry.ts',
    'src/client/modules/canvas-scroll.ts', 'src/client/modules/canvas-utils.ts',
    'src/client/modules/style-registry.ts', 'src/client/modules/theme.ts',
    'src/client/modules/color-utils.ts', 'src/client/modules/sibling-switcher.ts',
    'src/client/modules/mode-system.ts', 'src/client/modules/file-action-bar.ts',
    'src/client/modules/char-rain.ts', 'src/client/engine/',
  ],
  'floating-card': [
    'src/client/modules/card-registry.ts', 'src/client/modules/card-stack.ts',
    'src/client/modules/floating-card.ts', 'src/client/modules/floating-shared.ts',
    'src/client/modules/floating-fullscreen.ts', 'src/client/modules/terminal-card-04.ts',
    'src/client/modules/tmux-card.ts', 'src/client/cards/', 'src/client/modules/renderers/',
    'src/client/generated/',
  ],
  'client-shell': [
    'src/client/main.ts', 'src/client/modules/app.ts', 'src/client/modules/ui.ts',
    'src/client/modules/dom-refs.ts', 'src/client/modules/state.ts',
    'src/client/modules/renderer-lifecycle.ts', 'src/client/modules/ui-registry.ts',
    'src/client/modules/gesture-registry.ts', 'src/client/modules/animation-registry.ts',
    'src/client/modules/interaction-constants.ts', 'src/client/modules/drag-handler.ts',
    'src/client/modules/click-queue.ts', 'src/client/modules/z-index-layers.ts',
    'src/client/modules/version-watch.ts',
    'src/client/modules/obs-hud.ts', 'src/client/modules/obs-emblem.ts',
    'src/client/modules/obs-roles.ts',
    'src/client/modules/orb.ts', 'src/client/modules/orb-panel.ts',
    'src/client/modules/orb-state.ts', 'src/client/modules/gestures.ts',
    'src/client/modules/app-lifecycle.ts', 'src/client/modules/debug-assert.ts', 'src/client/modules/custom-select.ts',
    'src/client/modules/confirm-dialog.ts', 'src/client/modules/card-toast.ts',
    'src/client/modules/logger.ts',
  ],
  'ai-chat': [
    'src/client/modules/orb-chat.ts', 'src/client/modules/orb-chat-run.ts',
    'src/client/modules/orb-chat-hints.ts', 'src/client/modules/chat-dom.ts',
    'src/client/modules/orb-chat-host.ts',
    'src/client/modules/session-client.ts', 'src/client/modules/ws-channel.ts',
    'src/shared/chat-protocol/', 'src/shared/tool-compaction/',
    'src/shared/message-normalize.ts',
    'src/server/ai/', 'src/server/prompts/', 'src/client/data/waiting-hints.ts',
  ],
  'server': [
    'src/server/index.ts', 'src/server/path-utils.ts', 'src/server/terminal-pty.ts',
    'src/server/ws-server.ts', 'src/server/routes/', 'src/server/env-store.ts',
    'src/server/ai/permissions.ts',
  ],
  'infra': [
    'build.mjs', 'scripts/check/', 'scripts/agent/', 'tests/', 'public/css/',
    'scripts/deploy.sh', 'scripts/kfm-restart.sh',
    'scripts/clean-npm-temp.cjs', '.githooks/commit-msg', '.githooks/pre-push',
    'package.json', 'experiments/coldstart/tools/',
  ],
};
