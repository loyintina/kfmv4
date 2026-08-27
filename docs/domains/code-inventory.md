<!-- 机械生成：node scripts/check/gen-code-inventory.mjs —— 请勿手改 -->
<!-- 基准 commit d9edbae2 · 生成于 2026-08-27 -->

# 代码清单（机械层）

> 这是什么：全量代码文件的域归属、行数、导出符号，脚本生成可重跑。
> 语义层现状 → 各域 code-map.md；域契约（应然）→ 各域 contract.md。

## canvas-tree（25 文件 · 8070 行）

| 文件 | 行数 | 导出符号 |
|------|-----:|----------|
| src/client/modules/tree-render.ts | 1011 | executeOnPath, markAnimatingPath, triggerExpandAnimation, isAnimLocked, onSidebarOpen, onSidebarClose, initTreeRenderer |
| src/client/engine/v2/renderer.ts | 903 | RendererOptions, Renderer |
| src/client/modules/tree-swipe.ts | 730 | isDimmed, bounceCursorRow, handleRowSwipe, updateFocus, focusNext, focusPrev, dismissFocusedCard, dismissAllCards, deployAllCards, selectFilesForPrompt, promptSelectSingle, initTempCardGesture, clearTempCards |
| src/client/engine/v2/box.ts | 628 | BoxOptions, Box |
| src/client/engine/v2/types.ts | 448 | Spacing, BorderSides, ALL_SIDES, LEFT_ONLY, VisualBorderConfig, HighlightConfig, ShadowConfig, GradientType, GradientStop, GradientConfig, BackgroundPatternType, BackgroundPatternConfig, TextAlign, TextVerticalAlign, TextOverflow, TextStyle, IconPosition, IconConfig, BoxState, StateStyles, Transform, Overflow, BoxType, AnimProp, Animation, EasingName, ScrollDirection, ScrollConfig, FlexDirection, JustifyContent, AlignItems, FlexWrap, FlexItemAlign, FlexStyle, FlexItemStyle, BoxVisualStyle, Rect, GestureType, GestureEventData, GestureEventHandler, GestureThresholds, DEFAULT_GESTURE_THRESHOLDS, GestureConfig, BoxEventType, BoxEventData, BoxEventHandler, Box, ShapePoint, ShapeConfig, InputType, InputConfig, RenderTheme |
| src/client/modules/mode-system.ts | 447 | initModeSystem, getSelectedMode, getModeTheme, getTriColor, ensureBg, removeBg, enterPromptMode, exitPromptMode, updateBg, recolorCards, applyModeTheme, updateModeSelection |
| src/client/modules/file-action-bar.ts | 440 | showFileActionBar, dismissFileActionBar, isFileActionBarOpen, isRenaming |
| src/client/modules/tree-overlay.ts | 414 | OverlayMeta, removeAllOverlays, createCharLayer, collectSiblingsAfter, buildAndSetOverlayTree, createVisualClone, OverlayPack, setupExpandOverlays, setupCollapseOverlays, collectAncestorSiblings, collectAncestorContainers, FlatSubTarget, flattenExpandTree, ensureMetaFromExpandedState, activeOverlayCount |
| src/client/modules/canvas-cursor.ts | 393 | setLiquidColor, setCursorColor, ensureCursorBox, setModeAccent, moveCursorTo, getCursorRowIndex, moveCursorBySteps, isCursorMode, getCenterRowIndex, snapCursorToCenter, scrollToCenterCursor |
| src/client/modules/canvas-scroll.ts | 359 | bindWheelEvents, initScrollGesture |
| src/client/modules/char-rain.ts | 316 | CharRainCleanup, MAX_RAIN_CHARS, rainCost, setupCharRainTweens, cleanupCharRain |
| src/client/engine/v2/BorderDrawer.ts | 267 | drawBorders |
| src/client/engine/v2/flex.ts | 245 | applyFlexLayout |
| src/client/modules/theme.ts | 228 | ThemeConfig, nebula, currentTheme |
| src/client/modules/tree-loader.ts | 220 | loadFileTree, initLazyLoader |
| src/client/modules/tree-model.ts | 191 | TreeOptions, buildTree, buildSidebarTree |
| src/client/modules/style-registry.ts | 162 | DIMENSIONS, FONT, LINE_HEIGHT, MAX_LINES, TEXT_STYLES, styleRegistry, getShift, createBox |
| src/client/modules/sibling-switcher.ts | 158 | initSiblingSwitcher, isSwitcherOpen, closeSwitcher |
| src/client/engine/v2/StyleConfig.ts | 156 | BorderSide, BorderState, BorderConfig, GradientStop, BoxStyle, CornerAction, getCornerAction, getNeighbor, DEFAULT_BOX_STYLE, PRESETS, resolveStyle |
| src/client/modules/liquid-geometry.ts | 109 | LiquidPoint, LiquidGeomParams, pathToPhysical, liquidPathLen, computeLiquidSegments |
| src/client/modules/tree-animation.ts | 74 | animateInsertion, animateRemoval |
| src/client/modules/canvas-utils.ts | 61 | getRootScrollY, setRootScrollY, _rebuildRowIndex, findBoxById |
| src/client/modules/color-utils.ts | 46 | HUE_BLUE, HUE_PURPLE, rgba, hslToHex, cardAccent, pathBasename |
| src/client/engine/v2/animation.ts | 40 | ease |
| src/client/engine/v2/utils.ts | 24 | uniformSpacing, hvSpacing, ZERO_SPACING |

## floating-card（32 文件 · 8523 行）

| 文件 | 行数 | 导出符号 |
|------|-----:|----------|
| src/client/generated/scripts-catalog.ts | 1436 | ScriptCatalogEntry, SCRIPTS_CATALOG, SCRIPT_CATEGORIES |
| src/client/modules/terminal-card-04.ts | 832 | TerminalCardMeta, initTerminalCore, disposeTerminalCore, compactTerminalCore, createTerminal04Handler |
| src/client/modules/floating-card.ts | 811 | enterFullscreen, exitFullscreen, dismissFullscreen, updateFullscreenSavedPosition, createFloatingCard, dismissFloatingCard, initFloatingCards, hasFloatingCard, buildCardLayout |
| src/client/cards/plugins/role.card.ts | 793 | — |
| src/client/cards/plugins/session.card.ts | 612 | — |
| src/client/cards/plugins/api.card.ts | 596 | — |
| src/client/modules/card-stack.ts | 508 | getCardCount, getCard, getCardName, getCardId, hexToRgba, cardGradient, cardBg, getFocusIndex, getCurrentAccent, getCardHandler, getFocusedCardRect, animateStackPullFeedback, launchFocusedCard, openCardStack, closeCardStack, isCardStackOpen, focusNext, focusPrev, initCardStack |
| src/client/cards/plugins/tools.card.ts | 308 | — |
| src/client/modules/tmux-card.ts | 306 | TmuxCardMeta, createTmuxCardHandler |
| src/client/modules/renderers/handler-factory.ts | 297 | createFileHandler |
| src/client/cards/plugins/scripts.card.ts | 272 | — |
| src/client/cards/plugins/config.card.ts | 216 | — |
| src/client/modules/floating-fullscreen.ts | 214 | enterFullscreen, exitFullscreen, dismissFullscreen |
| src/client/cards/plugins/paradigm.card.ts | 213 | — |
| src/client/modules/floating-shared.ts | 173 | FloatingCardAction, nextFloatingCardState, _hexToRgba, _cornerLayout, Z_FLOATING_BASE, Z_FULLSCREEN, TITLE_BAR_H, COMPACT_W, COMPACT_H, FloatingCardConfig, FloatingCardItem, _floatingCards, _allocZ, _brOrbToItem, _scatterPosition, _dismissOne |
| src/client/modules/card-registry.ts | 155 | CardTypeDef, CardContentHandler, CardInstance, registerCardType, getCardType, getAllCardTypes, cardRegistry |
| src/client/modules/renderers/math-diagram.ts | 155 | MathData, preprocessMath, renderMath, renderMermaid |
| src/client/cards/plugins/debug.card.ts | 111 | — |
| src/client/modules/renderers/code-highlight.ts | 106 | highlightAll, highlightCode |
| src/client/cards/plugins/apk.card.ts | 72 | — |
| src/client/modules/renderers/md-css.ts | 57 | MD_CSS |
| src/client/modules/renderers/md-extensions.ts | 51 | MARKED_OPTS, preprocessMd |
| src/client/cards/card-ui.ts | 49 | innerCardStyle, inputStyle, btnStyle, flashSaved, mkRow |
| src/client/modules/renderers/binary-fallback.ts | 37 | renderBinaryInfo |
| src/client/modules/renderers/text-preview.ts | 26 | renderTextPreview |
| src/client/cards/registry.ts | 24 | — |
| src/client/cards/plugins/file.card.ts | 19 | — |
| src/client/cards/plugins/terminal.card.ts | 19 | — |
| src/client/cards/plugins/tmux.card.ts | 19 | — |
| src/client/modules/renderers/file-type.ts | 17 | FileCategory, getFileCategory |
| src/client/cards/types.ts | 16 | — |
| src/client/modules/renderers/katex-css.ts | 3 | KATEX_CSS |

## client-shell（29 文件 · 4702 行）

| 文件 | 行数 | 导出符号 |
|------|-----:|----------|
| src/client/modules/orb.ts | 538 | type OrbState, collapseOrbPanel, initOrb |
| src/client/modules/obs-emblem.ts | 494 | EmblemRect, EmblemRects, initObsEmblems |
| src/client/modules/hand.ts | 437 | HandRect, initHand |
| src/client/modules/ui-registry.ts | 352 | UIElementType, UIElementState, InteractiveElement, Rect, RectGetter, ContentBlock, Capability, PageDescription, RegistryChangeHandler, UIElementRegistry, Registry |
| src/client/modules/gesture-registry.ts | 346 | GestureHandler, GestureRegistry, gestures |
| src/client/modules/custom-select.ts | 246 | SelectItem, CustomSelectOptions, CustomSelect, createCustomSelect |
| src/client/modules/orb-panel.ts | 221 | PanelConfig, buildPanelContent |
| src/client/modules/gestures.ts | 221 | initGestures |
| src/client/modules/obs-hud.ts | 219 | initObsHud |
| src/client/modules/confirm-dialog.ts | 192 | ConfirmOptions, showConfirm |
| src/client/modules/renderer-lifecycle.ts | 172 | RenderContext, RendererLifecycle, L |
| src/client/modules/state.ts | 165 | API, FileNode, ViewportState, KFMStateType, KFMState, FileRowData, getFileRowData |
| src/client/main.ts | 142 | — |
| src/client/modules/drag-handler.ts | 134 | DragConfig, createDragHandler |
| src/client/modules/app.ts | 131 | initApp |
| src/client/ctx.ts | 109 | bootLog, rootCtx, helloFiber, isHelloCleaned, bootCtxSelfTest, ChurnResult, ctxChurn |
| src/client/modules/z-index-layers.ts | 108 | Z, ZLayer |
| src/client/modules/animation-registry.ts | 76 | AnimTimeline, AnimTween, anim |
| src/client/modules/ui.ts | 71 | openSidebar, closeSidebar, initUI |
| src/client/modules/version-watch.ts | 61 | initVersionWatch |
| src/client/modules/logger.ts | 58 | log, getLogs, clearLogs, copyLogs, onLog |
| src/client/modules/card-toast.ts | 53 | showCardToast |
| src/client/modules/click-queue.ts | 39 | ClickEvent, enqueue, dequeue, clear, isEmpty, peek |
| src/client/modules/dom-refs.ts | 38 | DOM |
| src/client/modules/interaction-constants.ts | 21 | MARGIN, LONG_PRESS_MS, DRAG_THRESHOLD, FLOATING_CARD_W, FLOATING_CARD_H |
| src/client/modules/app-lifecycle.ts | 21 | markAppReady, isAppReady |
| src/client/modules/debug-assert.ts | 17 | assert |
| src/client/modules/hand-geometry.ts | 11 | handHitTest |
| src/client/modules/orb-state.ts | 9 | OrbState |

## ai-chat（59 文件 · 13040 行）

| 文件 | 行数 | 导出符号 |
|------|-----:|----------|
| src/client/modules/chat-dom.ts | 1132 | initChatDom, clearChatDom, getFollowBottom, setFollowBottom, setHistoryLoader, suspendScroll, resumeScroll, withScrollAnchor, scrollToBottom, mountUserMessage, patchEvent, mountAiMessage, settleToolCardsDom, mountFallbackAiMessage |
| src/client/data/waiting-hints.ts | 1108 | WAITING_HINTS |
| src/server/ai/tools/omp/browser/tab-worker.ts | 921 | WorkerCore |
| src/client/modules/orb-chat-run.ts | 674 | ChatMessage, StreamEvent, getActiveRunId, getActiveCursor, setEventHook, readPersistedRun, clearPersistedRun, settlePendingToolBlocks, resumeRun, doSend |
| src/server/ai/tools/omp/browser/launch.ts | 603 | DEFAULT_VIEWPORT, BROWSER_PROTOCOL_TIMEOUT_MS, loadPuppeteer, loadPuppeteerInWorker, LaunchHeadlessOptions, launchHeadlessBrowser, applyViewport, UserAgentOverride, UserAgentSession, applyStealthPatches |
| src/server/ai/chat.ts | 587 | ChatMessage, StreamEvent, createClientIdxMapper, findApiProvider |
| src/client/modules/session-client.ts | 545 | SessionMessage, Session, extractMessageText, countTextMessages, parseSessionItem, sessionStore |
| src/client/modules/ws-channel.ts | 432 | wsChannel, initWsChannel |
| src/server/ai/eyes.ts | 432 | EYES_PATH, genEyes |
| src/shared/tool-compaction/index.ts | 371 | CompactorEntry, COMPACTOR_REGISTRY, COMPACTOR_NAMES, webTitleKey, CompactionCtx, MUT_BURST_GAP, EXEMPT_USER_ROUNDS, TODO_STALE_GAP, FAIL_REPEAT_MIN, errorFingerprint, failRepeatAnnotation, todoResultAnnotation, normalizeBashCommand, compactToolResult, compactToolInput |
| src/server/ai/tools/omp/debug.ts | 362 | ompDebugTool |
| src/server/ai/tools/omp/debug/debug-operations.ts | 356 | Breakpoint, StackFrame, Variable, SourceInfo, setBreakpoint, setFunctionBreakpoint, removeBreakpoint, doContinue, doPause, stepIn, stepOver, stepOut, waitForPause, getStack, getVariables, evaluate, loadedSources, injectProbe, capturePausedFrames, clearPausedFrames |
| src/server/ai/tools/omp/browser/tab-supervisor.ts | 342 | WorkerHandle, TabSession, PendingRun, AcquireTabOptions, RunInTabOptions, getTab, acquireTab, runInTab, releaseTab, releaseAllTabs, resolveTabWorkerEntry |
| src/server/ai/session-store.ts | 338 | markSessionScript, _computeStats, appendEvent, flush, flushSync, invalidateSession, appendUserMessage, SessionCompact, appendCompact, LastUsage, recordLastUsage, getLastUsage, getCompacts |
| src/client/modules/orb-chat-host.ts | 335 | ChatHostDeps, initChatHost |
| src/server/ai/tools/omp/debug/kfmv4-views.ts | 318 | Kfmv4ViewName, Kfmv4ViewResult, RENDERER_SNAPSHOT_SCRIPT, ANIMATION_TIMELINE_SCRIPT, GESTURE_TRACE_SCRIPT, STATE_HISTORY_SCRIPT, CARD_LIFECYCLE_SCRIPT, KFMV4_SCRIPT_MAP, formatRendererSnapshot, formatAnimationTimeline, formatGestureTrace, formatStateHistory, formatCardLifecycle |
| src/shared/chat-protocol/to-openai-messages.ts | 309 | OpenAiToolCall, OpenAiMessage, ToOpenAiOptions, ToOpenAiResult, toOpenAiMessages |
| src/server/ai/run-manager.ts | 242 | _setStallMsForTest, getActiveRun, getRun, StreamFn, startRun, attachRun, cancelRun |
| src/server/ai/tools/omp/debug/cdp-connection.ts | 242 | CdpSession, CdpLaunchOptions, CdpAttachOptions, CdpPausedEvent, sendCmd, onCdpEvent, launchCdp, attachCdp, closeCdp |
| src/client/modules/orb-chat-hints.ts | 225 | startWaitingIndicator, TODO_DISMISS_KEY, todosFingerprint, clearTodoPanel, dismissTodoPanel, updateTodoFromTool |
| src/server/ai/tools/index.ts | 173 | getAllTools, getToolDefinitions, executeTool, hasTool, getTool |
| src/server/ai/routes.ts | 162 | StartRunFn, setupAiRoutes |
| src/server/ai/page-state.ts | 156 | PAGE_STATE_PATH, PAGE_STATE_TEXTS, renderPageState, refreshPageState |
| src/server/ai/permissions.ts | 136 | RiskClass, TOOL_RISK, Decision, AuditEntry, riskClassOf, evaluate |
| src/server/ai/prompt-assembler.ts | 124 | getActiveRoleFile, assembleRoleSystemPrompt, assembleDynamicPrompt |
| src/shared/chat-protocol/reducer.ts | 122 | ReduceContext, applyEvent, reduceEvents |
| src/server/ai/tools/kfmv4/logs.ts | 119 | kfmLogsTool |
| src/server/ai/tools/omp/read.ts | 117 | ompReadTool |
| src/server/ai/tools/omp/browser/aria/aria-snapshot.ts | 116 | AriaSnapshotOptions, captureAriaSnapshot, resolveAriaRefHandle, parseAriaRefSelector, buildAriaSnapshotScript |
| src/server/ai/tools/omp/browser/tab-protocol.ts | 115 | Transferable, ObservationEntry, Observation, ScreenshotResult, SessionSnapshot, WorkerInitPayload, ToolReply, WorkerInbound, ReadyInfo, RunResultOk, RunErrorPayload, WorkerOutbound, Transport |
| src/server/ai/tools/types.ts | 112 | ContentBlock, ToolResult, ToolUpdate, ToolContext, KfmTool, ToolError, ToolAbortError, throwIfAborted, renderError |
| src/client/modules/viewport-visibility.ts | 111 | RegionRect, RegionInput, Cover, RegionVisibility, rankOf, computeVisibility, assembleRegions |
| src/server/ai/tools/omp/browser/readable.ts | 111 | ReadableFormat, ReadableResult, extractReadableFromHtml |
| src/server/ai/compact-core.ts | 110 | SUMMARY_PROVIDER, SUMMARY_MODEL, SUMMARY_PROMPT, CompactResult, computeCutIndex, runCompact |
| src/server/ai/rule-engine.ts | 109 | AiRule, loadRules, buildAlwaysApplyPrompt, checkToolCallRules, reloadRules |
| src/server/ai/tools/omp/web-search.ts | 109 | ompWebSearchTool |
| src/server/ai/tools/omp/browser.ts | 100 | browserTool |
| src/server/ai/tools/kfmv4/compact.ts | 96 | kfmCompactTool |
| src/server/ai/tools/kfmv4/hand.ts | 86 | kfmHandMoveTool |
| src/server/ai/tools/omp/browser/run-cancellation.ts | 86 | markHandled, waitForBrowserRun, bindBrowserRunFacade |
| src/server/ai/tools/omp/bash.ts | 80 | ompBashTool |
| src/server/ai/tools/omp/native.ts | 72 | executeShell, grep, glob |
| src/server/ai/tools/kfmv4/restart.ts | 62 | kfmRestartTool |
| src/server/ai/tools/kfmv4/browser-eval.ts | 60 | kfmBrowserEvalTool |
| src/server/ai/tools/omp/eval.ts | 60 | ompEvalTool |
| src/server/ai/tools/omp/edit.ts | 52 | ompEditTool |
| src/shared/chat-protocol/events.ts | 45 | StreamEvent |
| src/shared/chat-protocol/messages.ts | 43 | TextBlock, ToolBlock, RuleWarningBlock, ContentBlock, ChatMessage |
| src/server/ai/tools/omp/todo.ts | 43 | ompTodoTool |
| src/server/ai/tools/omp/glob.ts | 42 | ompGlobTool |
| src/server/ai/tools/omp/write.ts | 42 | ompWriteTool |
| src/server/ai/tools/omp/grep.ts | 37 | ompGrepTool |
| src/server/ai/tools/omp/browser/tab-worker-entry.ts | 31 | — |
| src/shared/message-normalize.ts | 30 | NormalizableBlock, promoteReasoningBlocks |
| src/client/modules/orb-chat.ts | 27 | — |
| src/shared/chat-protocol/block-idx.ts | 24 | createClientIdxMapper |
| src/server/ai/tools/omp/checkpoint.ts | 22 | ompCheckpointTool |
| src/server/ai/tools/omp/rewind.ts | 19 | ompRewindTool |
| src/shared/chat-protocol/index.ts | 5 | createClientIdxMapper, applyEvent, reduceEvents, type ReduceContext |

## server（11 文件 · 2760 行）

| 文件 | 行数 | 导出符号 |
|------|-----:|----------|
| src/server/routes/obs.ts | 995 | fetchBigmodelBalance, fetchBigmodelQuota, fetchDeepseekBalance, setupObsRoutes, setupObsPages, parseInbox, collectAuditPending, parseStack, collectSys, collectArchive, normalizeIso, collectPulse, collectPerms, buildRolesData, collectRoles |
| src/server/routes/files.ts | 488 | pickWindowTokenCount, pickCompactCutIndex, FileItem, sliceMessages, MSG_PAYLOAD_BUDGET, MSG_SINGLE_CAP, capMessagesPayload, setupFileRoutes |
| src/server/ws-server.ts | 324 | WsServer |
| src/server/index.ts | 188 | — |
| src/server/path-utils.ts | 172 | ROOT_DIR, PROJECT_ROOT, KFM_DATA_DIR, getActiveRoot, getSafeRoot, setActiveRoot, sanitizePath, SESSION_ID_RE, isValidSessionId, isLoopbackHost, isTrustedOrigin, verifyLocalOrigin |
| src/server/ai/permissions.ts | 136 | RiskClass, TOOL_RISK, Decision, AuditEntry, riskClassOf, evaluate |
| src/server/terminal-pty.ts | 109 | PtyDataCallback, PtyExitCallback, PtyManager |
| src/server/env-store.ts | 103 | ENV_PATH, parseEnv, loadEnvFile, isEnvRef, ResolvedKey, resolveKey, envNameForProvider, upsertEnvVar |
| src/server/routes/proxy.ts | 94 | setupProxyRoutes |
| src/server/routes/providers.ts | 78 | setupProvidersRoutes |
| src/server/routes/compact.ts | 73 | compactRouter, computeCutIndex |

## infra（186 文件 · 20759 行）

| 文件 | 行数 | 导出符号 |
|------|-----:|----------|
| tests/client-logic.test.ts | 965 | — |
| tests/regression.test.ts | 669 | — |
| experiments/coldstart/tools/normalize-arms.mjs | 587 | — |
| scripts/agent/semantic-audit.mjs | 517 | parseOnly, taskFiles, mechanicalOwners, buildPrompt, makeValidate, recheckRef, recheckQuote |
| tests/tool-compaction.test.ts | 505 | — |
| tests/server-routes.test.ts | 472 | — |
| scripts/agent/browser-relay.mjs | 425 | — |
| tests/preload.mjs | 423 | — |
| tests/cards.test.ts | 410 | — |
| tests/visual-baseline.test.ts | 367 | — |
| scripts/agent/agent-runner.mjs | 333 | renderTemplate, extractJson, runAgent, parseToolStream, runAgentTooled |
| tests/box.test.ts | 309 | — |
| tests/mocks/gsap.ts | 305 | gsap |
| tests/run-manager.test.ts | 301 | — |
| scripts/check/check-registry.mjs | 292 | — |
| scripts/check/check-agent-inbox.mjs | 276 | — |
| tests/gesture-registry.test.ts | 263 | — |
| scripts/agent/semantic-mutate.mjs | 261 | MUTATIONS |
| tests/invariants.test.ts | 245 | — |
| scripts/check/check-css-wiring.mjs | 228 | — |
| scripts/agent/obs-aggregate.mjs | 224 | — |
| scripts/agent/semantic-audit.tasks.mjs | 222 | TASKS |
| tests/path-utils.test.ts | 215 | — |
| tests/renderer.test.ts | 215 | — |
| tests/to-openai-messages.test.ts | 208 | — |
| tests/smoke/smoke.mjs | 199 | — |
| scripts/check/check-migration-baseline.mjs | 187 | — |
| scripts/agent/semantic-chain.mjs | 185 | — |
| scripts/check/gen-code-inventory.mjs | 184 | — |
| tests/chat-protocol.test.ts | 169 | — |
| tests/provider-env.test.ts | 168 | — |
| experiments/coldstart/tools/hallucinate-batch.mjs | 164 | — |
| tests/protocol-reducer.test.ts | 161 | — |
| experiments/coldstart/tools/routine-entry-validation.mjs | 158 | — |
| scripts/check/gen-scripts-catalog.mjs | 157 | ScriptCatalogEntry, SCRIPTS_CATALOG, SCRIPT_CATEGORIES |
| scripts/check/sync-counts.mjs | 157 | — |
| build.mjs | 150 | — |
| scripts/check/check-doc-orphans.mjs | 149 | — |
| scripts/agent/semantic-bench.mjs | 149 | — |
| tests/probes/gen-page-state-schema/src/server/ai/page-state.ts | 149 | PAGE_STATE_PATH, PAGE_STATE_TEXTS, renderPageState, refreshPageState |
| scripts/check/check-docs.mjs | 146 | — |
| scripts/check/check-bar-ledger.mjs | 143 | — |
| scripts/check/check-mechanism-registry.mjs | 142 | — |
| scripts/check/chain.mjs | 141 | STEPS |
| scripts/check/check-doc-scripts.mjs | 139 | — |
| scripts/check/check-doc-linerefs.mjs | 137 | — |
| tests/viewport-visibility.test.ts | 137 | — |
| experiments/coldstart/tools/judge-batch.mjs | 135 | — |
| scripts/agent/exp-iceberg.mjs | 134 | — |
| scripts/check/check-ledger-coverage.mjs | 133 | — |
| scripts/check/check-checks.mjs | 132 | — |
| scripts/check/check-tool-compaction.mjs | 130 | — |
| scripts/check/check-git-hygiene.mjs | 128 | classifyZones |
| scripts/check/gen-agent-inbox.mjs | 128 | — |
| scripts/agent/tag-advisor.mjs | 128 | REF_RE, isValidRef |
| scripts/check/check-mutation-anchors.mjs | 127 | — |
| scripts/check/gen-permission-map.mjs | 126 | — |
| scripts/check/gen-capability-map.mjs | 125 | — |
| tests/session-security.test.ts | 125 | — |
| scripts/check/gen-tool-docs.mjs | 121 | — |
| tests/liquid-geometry.test.ts | 120 | — |
| scripts/agent/exp-probe-decompose.mjs | 117 | — |
| tests/harness.ts | 116 | TestTag, TestOpts, test, regression, group, beforeEach, runAll |
| scripts/check/gen-page-state-schema.mjs | 113 | — |
| scripts/check/check-doc-coverage.mjs | 111 | — |
| scripts/check/check-doc-links.mjs | 110 | — |
| scripts/check/check-zindex.mjs | 110 | — |
| experiments/coldstart/tools/gen-hallucination-inputs.mjs | 110 | — |
| scripts/agent/exp-vision-internal.mjs | 109 | — |
| tests/semantic-chain.test.ts | 108 | — |
| tests/obs-roles.test.ts | 106 | — |
| scripts/check/check-cards.mjs | 105 | — |
| scripts/check/check-contract-freshness.mjs | 104 | — |
| scripts/check/check-test-patterns.mjs | 102 | — |
| scripts/check/gen-rules-map.mjs | 102 | — |
| tests/session-invalidate.test.ts | 100 | — |
| scripts/check/check-anim.mjs | 99 | — |
| scripts/check/check-stack-status.mjs | 99 | — |
| scripts/check/check-versions.mjs | 91 | — |
| scripts/check/check-hooks.mjs | 87 | — |
| scripts/check/check-workflow-integrity.mjs | 87 | — |
| scripts/check/check-kfmv4-data.mjs | 86 | — |
| scripts/check/check-probes.mjs | 86 | — |
| scripts/agent/exp-probe-matrix.mjs | 86 | — |
| scripts/check/check-fix-tests.mjs | 85 | — |
| tests/engine.test.ts | 85 | — |
| scripts/check/check-state-freshness.mjs | 84 | — |
| scripts/check/gen-experiments-list.mjs | 84 | — |
| scripts/check/check-experiment-index.mjs | 81 | — |
| scripts/agent/exp-thinking.mjs | 81 | — |
| scripts/check/check-probe-state.mjs | 80 | — |
| scripts/check/check-as-any.mjs | 79 | — |
| scripts/check/check-console.mjs | 79 | — |
| scripts/check/gen-contract-lists.mjs | 77 | — |
| tests/tag-advisor.test.ts | 77 | — |
| scripts/check/check-experiment-registry.mjs | 76 | — |
| scripts/check/docs-status.mjs | 76 | — |
| scripts/check/check-doc-symbols.mjs | 75 | — |
| tests/token-count.test.ts | 75 | — |
| experiments/coldstart/tools/theme-code.mjs | 75 | — |
| scripts/check/check-code-doc-refs.mjs | 69 | — |
| scripts/check/check-card-meta.mjs | 68 | — |
| scripts/check/check-ledger-commits.mjs | 68 | — |
| scripts/check/domain-src.mjs | 67 | DOMAIN_SRC |
| tests/floating-state.test.ts | 66 | — |
| scripts/agent/session-retention.mjs | 64 | — |
| scripts/agent/test-tag-advisor.mjs | 64 | — |
| scripts/check/check-code-map-coverage.mjs | 63 | — |
| scripts/check/check-active-stack.mjs | 62 | — |
| tests/browser-tool.test.ts | 61 | — |
| tests/stack-numbering.test.ts | 61 | — |
| scripts/check/check-doc-schema.mjs | 60 | — |
| scripts/check/check-commit-docs.mjs | 59 | — |
| tests/omp-glob.test.ts | 58 | — |
| scripts/check/check-inbox-heartbeat.mjs | 54 | — |
| tests/tool-schema.test.ts | 54 | — |
| scripts/check/check-secrets.mjs | 52 | — |
| tests/compact-l4.test.ts | 52 | — |
| tests/gen-pipeline.test.ts | 52 | — |
| scripts/check/check-agent-script-docs.mjs | 51 | — |
| scripts/check/check-consistency.mjs | 51 | — |
| scripts/check/check-uncommitted.mjs | 51 | — |
| tests/doc-scripts.test.ts | 51 | — |
| package.json | 51 | — |
| tests/permissions.test.ts | 50 | — |
| tests/reasoning-l2.test.ts | 50 | — |
| scripts/check/gen-route-table.mjs | 49 | — |
| tests/ctx-kernel.test.ts | 48 | — |
| tests/semantic-audit.test.ts | 48 | — |
| tests/session-flush.test.ts | 48 | — |
| scripts/kfm-restart.sh | 46 | — |
| scripts/check/check-doc-budget.mjs | 44 | — |
| scripts/clean-npm-temp.cjs | 44 | — |
| scripts/check/check-release-radar.mjs | 42 | — |
| tests/obs-track-time.test.ts | 42 | — |
| tests/reset-hooks.ts | 41 | — |
| tests/compact-auto.test.ts | 40 | — |
| tests/compact-cutindex.test.ts | 39 | — |
| tests/last-usage.test.ts | 38 | — |
| tests/obs-audit-pending.test.ts | 38 | — |
| tests/runner.ts | 33 | test, group, runAll, regression, beforeEach, TestFileNode, singleFolder, nestedFolders |
| tests/session-card-parser.test.ts | 33 | — |
| tests/session-parse.test.ts | 33 | — |
| tests/compact-live-query.test.ts | 30 | — |
| tests/hand-drag.test.ts | 30 | — |
| scripts/deploy.sh | 29 | — |
| .githooks/pre-push | 28 | — |
| tests/compact-list.test.ts | 23 | — |
| tests/env-test-isolation.mjs | 19 | — |
| tests/probes/gen-permission-map/src/server/ai/tools/index.ts | 19 | getToolDefinitions, getAllTools |
| tests/probes/tool-compaction/src/server/ai/tools/index.ts | 19 | getToolDefinitions, getAllTools |
| tests/gsap-hook.mjs | 17 | resolve |
| tests/probes/gen-permission-map/src/server/ai/tools/fake.ts | 16 | fakeTool |
| tests/probes/gen-tool-docs/src/server/ai/tools/fake.ts | 16 | fakeTool |
| tests/probes/tool-compaction/src/server/ai/tools/fake.ts | 16 | fakeTool |
| tests/mocks/xterm.ts | 15 | Terminal |
| tests/probes/gen-tool-docs/src/server/ai/tools/index.ts | 15 | getToolDefinitions |
| tests/probes/sync-counts/scripts/agent/semantic-mutate.mjs | 14 | MUTATIONS |
| tests/probes/gen-permission-map/src/server/ai/tools/types.ts | 12 | KfmTool |
| tests/probes/gen-tool-docs/src/server/ai/tools/types.ts | 12 | KfmTool |
| tests/probes/tool-compaction/src/server/ai/tools/types.ts | 12 | KfmTool |
| .githooks/commit-msg | 12 | — |
| scripts/check/docs-root-const.mjs | 8 | DOCS_ROOT |
| tests/register-hook.mjs | 8 | — |
| tests/probes/gen-page-state-schema/src/client/modules/ui-registry.ts | 7 | ContentBlock |
| tests/mocks/xterm-addon-fit.ts | 6 | FitAddon |
| tests/probes/gen-permission-map/src/server/ai/permissions.ts | 5 | TOOL_RISK |
| tests/probes/tool-compaction/src/shared/tool-compaction/index.ts | 5 | CompactorEntry, COMPACTOR_REGISTRY, COMPACTOR_NAMES |
| tests/probes/doc-linerefs/src/fake.ts | 4 | a, b |
| tests/probes/checks/build.mjs | 3 | — |
| tests/probes/doc-scripts/scripts/check/check-real.mjs | 3 | STEPS |
| tests/probes/bar-ledger/tests/probe.ts | 2 | — |
| tests/probes/check-mechanism-registry/scripts/check/check-ghost-thing.mjs | 2 | — |
| tests/probes/check-migration-baseline/scripts/check/chain.mjs | 2 | STEPS |
| tests/probes/check-migration-baseline/scripts/check-a.mjs | 2 | — |
| tests/probes/check-migration-baseline/src/client/cards/plugins/only.card.ts | 2 | — |
| tests/probes/check-migration-baseline/src/client/modules/orb-chat-run.ts | 2 | — |
| tests/probes/check-migration-baseline/src/server/tools/read.tool.ts | 2 | — |
| tests/probes/check-migration-baseline/tests/a.test.ts | 2 | — |
| tests/probes/checks/scripts/check/chain.mjs | 2 | STEPS |
| tests/probes/doc-symbols/src/probe.ts | 2 | realFoo |
| tests/probes/sync-counts/scripts/check/check-a.mjs | 2 | — |
| tests/probes/sync-counts/scripts/check/check-b.mjs | 2 | — |
| tests/probes/sync-counts/tests/probe.ts | 2 | — |
| tests/probes/checks/scripts/check/check-alpha.mjs | 1 | — |
| tests/probes/checks/scripts/check/check-beta.mjs | 1 | — |

## 跨域 import 边（机械生成）

> 语义层解读 → cross-domain.md；域内依赖 → 各域 code-map.md。

### ai-chat → canvas-tree（3 边）

- src/client/modules/chat-dom.ts → src/client/modules/color-utils.ts
- src/client/modules/chat-dom.ts → src/client/modules/theme.ts
- src/client/modules/orb-chat-run.ts → src/client/modules/tree-loader.ts

### ai-chat → client-shell（12 边）

- src/client/modules/chat-dom.ts → src/client/modules/dom-refs.ts
- src/client/modules/orb-chat-hints.ts → src/client/modules/dom-refs.ts
- src/client/modules/orb-chat-hints.ts → src/client/modules/z-index-layers.ts
- src/client/modules/orb-chat-host.ts → src/client/modules/orb-state.ts
- src/client/modules/orb-chat-host.ts → src/client/modules/ui-registry.ts
- src/client/modules/orb-chat-run.ts → src/client/modules/logger.ts
- src/client/modules/orb-chat-run.ts → src/client/modules/state.ts
- src/client/modules/session-client.ts → src/client/modules/logger.ts
- src/client/modules/ws-channel.ts → src/client/modules/dom-refs.ts
- src/client/modules/ws-channel.ts → src/client/modules/logger.ts
- src/client/modules/ws-channel.ts → src/client/modules/state.ts
- src/client/modules/ws-channel.ts → src/client/modules/ui-registry.ts

### ai-chat → floating-card（4 边）

- src/client/modules/chat-dom.ts → src/client/modules/renderers/code-highlight.ts
- src/client/modules/chat-dom.ts → src/client/modules/renderers/math-diagram.ts
- src/client/modules/chat-dom.ts → src/client/modules/renderers/md-css.ts
- src/client/modules/chat-dom.ts → src/client/modules/renderers/md-extensions.ts

### ai-chat → server（21 边）

- src/server/ai/chat.ts → src/server/env-store.ts
- src/server/ai/chat.ts → src/server/path-utils.ts
- src/server/ai/chat.ts → src/server/ws-server.ts
- src/server/ai/compact-core.ts → src/server/env-store.ts
- src/server/ai/eyes.ts → src/server/path-utils.ts
- src/server/ai/eyes.ts → src/server/routes/obs.ts
- src/server/ai/eyes.ts → src/server/ws-server.ts
- src/server/ai/page-state.ts → src/server/path-utils.ts
- src/server/ai/page-state.ts → src/server/ws-server.ts
- src/server/ai/prompt-assembler.ts → src/server/path-utils.ts
- src/server/ai/routes.ts → src/server/path-utils.ts
- src/server/ai/routes.ts → src/server/ws-server.ts
- src/server/ai/rule-engine.ts → src/server/path-utils.ts
- src/server/ai/run-manager.ts → src/server/ws-server.ts
- src/server/ai/session-store.ts → src/server/path-utils.ts
- src/server/ai/tools/index.ts → src/server/ai/permissions.ts
- src/server/ai/tools/kfmv4/compact.ts → src/server/path-utils.ts
- src/server/ai/tools/kfmv4/hand.ts → src/server/ws-server.ts
- src/server/ai/tools/kfmv4/logs.ts → src/server/ws-server.ts
- src/server/ai/tools/kfmv4/restart.ts → src/server/path-utils.ts
- src/server/ai/tools/types.ts → src/server/ws-server.ts

### canvas-tree → ai-chat（1 边）

- src/client/modules/tree-render.ts → src/client/modules/ws-channel.ts

### canvas-tree → client-shell（55 边）

- src/client/modules/canvas-cursor.ts → src/client/modules/animation-registry.ts
- src/client/modules/canvas-cursor.ts → src/client/modules/dom-refs.ts
- src/client/modules/canvas-cursor.ts → src/client/modules/logger.ts
- src/client/modules/canvas-cursor.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/canvas-cursor.ts → src/client/modules/state.ts
- src/client/modules/canvas-scroll.ts → src/client/modules/dom-refs.ts
- src/client/modules/canvas-scroll.ts → src/client/modules/gesture-registry.ts
- src/client/modules/canvas-scroll.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/canvas-scroll.ts → src/client/modules/state.ts
- src/client/modules/canvas-scroll.ts → src/client/modules/ui.ts
- src/client/modules/canvas-utils.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/char-rain.ts → src/client/modules/animation-registry.ts
- src/client/modules/char-rain.ts → src/client/modules/dom-refs.ts
- src/client/modules/file-action-bar.ts → src/client/modules/animation-registry.ts
- src/client/modules/file-action-bar.ts → src/client/modules/dom-refs.ts
- src/client/modules/file-action-bar.ts → src/client/modules/gesture-registry.ts
- src/client/modules/file-action-bar.ts → src/client/modules/logger.ts
- src/client/modules/file-action-bar.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/file-action-bar.ts → src/client/modules/state.ts
- src/client/modules/file-action-bar.ts → src/client/modules/ui.ts
- src/client/modules/file-action-bar.ts → src/client/modules/z-index-layers.ts
- src/client/modules/mode-system.ts → src/client/modules/animation-registry.ts
- src/client/modules/mode-system.ts → src/client/modules/gesture-registry.ts
- src/client/modules/mode-system.ts → src/client/modules/z-index-layers.ts
- src/client/modules/sibling-switcher.ts → src/client/modules/logger.ts
- src/client/modules/sibling-switcher.ts → src/client/modules/state.ts
- src/client/modules/style-registry.ts → src/client/modules/logger.ts
- src/client/modules/tree-animation.ts → src/client/modules/animation-registry.ts
- src/client/modules/tree-loader.ts → src/client/modules/dom-refs.ts
- src/client/modules/tree-loader.ts → src/client/modules/logger.ts
- src/client/modules/tree-loader.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/tree-loader.ts → src/client/modules/state.ts
- src/client/modules/tree-loader.ts → src/client/modules/ui-registry.ts
- src/client/modules/tree-model.ts → src/client/modules/state.ts
- src/client/modules/tree-overlay.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/tree-render.ts → src/client/modules/animation-registry.ts
- src/client/modules/tree-render.ts → src/client/modules/click-queue.ts
- src/client/modules/tree-render.ts → src/client/modules/debug-assert.ts
- src/client/modules/tree-render.ts → src/client/modules/dom-refs.ts
- src/client/modules/tree-render.ts → src/client/modules/logger.ts
- src/client/modules/tree-render.ts → src/client/modules/orb.ts
- src/client/modules/tree-render.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/tree-render.ts → src/client/modules/state.ts
- src/client/modules/tree-render.ts → src/client/modules/ui-registry.ts
- src/client/modules/tree-render.ts → src/client/modules/ui.ts
- src/client/modules/tree-render.ts → src/client/modules/z-index-layers.ts
- src/client/modules/tree-swipe.ts → src/client/modules/animation-registry.ts
- src/client/modules/tree-swipe.ts → src/client/modules/card-toast.ts
- src/client/modules/tree-swipe.ts → src/client/modules/dom-refs.ts
- src/client/modules/tree-swipe.ts → src/client/modules/gesture-registry.ts
- src/client/modules/tree-swipe.ts → src/client/modules/logger.ts
- src/client/modules/tree-swipe.ts → src/client/modules/renderer-lifecycle.ts
- src/client/modules/tree-swipe.ts → src/client/modules/state.ts
- src/client/modules/tree-swipe.ts → src/client/modules/ui.ts
- src/client/modules/tree-swipe.ts → src/client/modules/z-index-layers.ts

### canvas-tree → floating-card（6 边）

- src/client/modules/tree-render.ts → src/client/modules/card-registry.ts
- src/client/modules/tree-render.ts → src/client/modules/floating-card.ts
- src/client/modules/tree-swipe.ts → src/client/modules/card-registry.ts
- src/client/modules/tree-swipe.ts → src/client/modules/floating-card.ts
- src/client/modules/tree-swipe.ts → src/client/modules/renderers/file-type.ts
- src/client/modules/tree-swipe.ts → src/client/modules/renderers/handler-factory.ts

### client-shell → ai-chat（8 边）

- src/client/main.ts → src/client/modules/ws-channel.ts
- src/client/modules/app.ts → src/client/modules/ws-channel.ts
- src/client/modules/hand.ts → src/client/modules/ws-channel.ts
- src/client/modules/orb-panel.ts → src/client/modules/session-client.ts
- src/client/modules/orb.ts → src/client/modules/chat-dom.ts
- src/client/modules/orb.ts → src/client/modules/orb-chat-host.ts
- src/client/modules/orb.ts → src/client/modules/ws-channel.ts
- src/client/modules/ui.ts → src/client/modules/ws-channel.ts

### client-shell → canvas-tree（8 边）

- src/client/main.ts → src/client/modules/sibling-switcher.ts
- src/client/main.ts → src/client/modules/tree-loader.ts
- src/client/main.ts → src/client/modules/tree-render.ts
- src/client/modules/card-toast.ts → src/client/modules/theme.ts
- src/client/modules/orb.ts → src/client/modules/theme.ts
- src/client/modules/renderer-lifecycle.ts → src/client/engine/v2/box.ts
- src/client/modules/renderer-lifecycle.ts → src/client/engine/v2/renderer.ts
- src/client/modules/ui.ts → src/client/modules/tree-render.ts

### client-shell → floating-card（8 边）

- src/client/main.ts → src/client/cards/registry.ts
- src/client/main.ts → src/client/modules/card-registry.ts
- src/client/main.ts → src/client/modules/card-stack.ts
- src/client/main.ts → src/client/modules/floating-card.ts
- src/client/modules/app.ts → src/client/modules/card-stack.ts
- src/client/modules/gestures.ts → src/client/modules/card-registry.ts
- src/client/modules/gestures.ts → src/client/modules/card-stack.ts
- src/client/modules/obs-hud.ts → src/client/modules/card-stack.ts

### floating-card → ai-chat（4 边）

- src/client/cards/plugins/session.card.ts → src/client/modules/session-client.ts
- src/client/modules/card-stack.ts → src/client/modules/ws-channel.ts
- src/client/modules/terminal-card-04.ts → src/client/modules/ws-channel.ts
- src/client/modules/tmux-card.ts → src/client/modules/ws-channel.ts

### floating-card → canvas-tree（7 边）

- src/client/cards/plugins/role.card.ts → src/client/modules/tree-loader.ts
- src/client/cards/plugins/role.card.ts → src/client/modules/tree-swipe.ts
- src/client/modules/card-stack.ts → src/client/modules/color-utils.ts
- src/client/modules/card-stack.ts → src/client/modules/theme.ts
- src/client/modules/floating-card.ts → src/client/modules/theme.ts
- src/client/modules/floating-shared.ts → src/client/modules/theme.ts
- src/client/modules/terminal-card-04.ts → src/client/modules/theme.ts

### floating-card → client-shell（47 边）

- src/client/cards/plugins/api.card.ts → src/client/modules/confirm-dialog.ts
- src/client/cards/plugins/api.card.ts → src/client/modules/custom-select.ts
- src/client/cards/plugins/api.card.ts → src/client/modules/logger.ts
- src/client/cards/plugins/config.card.ts → src/client/modules/confirm-dialog.ts
- src/client/cards/plugins/config.card.ts → src/client/modules/custom-select.ts
- src/client/cards/plugins/config.card.ts → src/client/modules/logger.ts
- src/client/cards/plugins/debug.card.ts → src/client/modules/logger.ts
- src/client/cards/plugins/paradigm.card.ts → src/client/modules/confirm-dialog.ts
- src/client/cards/plugins/paradigm.card.ts → src/client/modules/logger.ts
- src/client/cards/plugins/role.card.ts → src/client/modules/confirm-dialog.ts
- src/client/cards/plugins/role.card.ts → src/client/modules/custom-select.ts
- src/client/cards/plugins/role.card.ts → src/client/modules/logger.ts
- src/client/cards/plugins/role.card.ts → src/client/modules/state.ts
- src/client/cards/plugins/role.card.ts → src/client/modules/z-index-layers.ts
- src/client/cards/plugins/scripts.card.ts → src/client/modules/custom-select.ts
- src/client/cards/plugins/scripts.card.ts → src/client/modules/z-index-layers.ts
- src/client/cards/plugins/session.card.ts → src/client/modules/confirm-dialog.ts
- src/client/cards/plugins/session.card.ts → src/client/modules/custom-select.ts
- src/client/cards/plugins/session.card.ts → src/client/modules/logger.ts
- src/client/cards/plugins/session.card.ts → src/client/modules/z-index-layers.ts
- src/client/cards/plugins/tools.card.ts → src/client/modules/custom-select.ts
- src/client/cards/plugins/tools.card.ts → src/client/modules/z-index-layers.ts
- src/client/modules/card-registry.ts → src/client/modules/logger.ts
- src/client/modules/card-stack.ts → src/client/modules/animation-registry.ts
- src/client/modules/card-stack.ts → src/client/modules/gesture-registry.ts
- src/client/modules/card-stack.ts → src/client/modules/logger.ts
- src/client/modules/card-stack.ts → src/client/modules/orb.ts
- src/client/modules/card-stack.ts → src/client/modules/ui-registry.ts
- src/client/modules/card-stack.ts → src/client/modules/z-index-layers.ts
- src/client/modules/floating-card.ts → src/client/modules/animation-registry.ts
- src/client/modules/floating-card.ts → src/client/modules/drag-handler.ts
- src/client/modules/floating-card.ts → src/client/modules/gesture-registry.ts
- src/client/modules/floating-card.ts → src/client/modules/interaction-constants.ts
- src/client/modules/floating-card.ts → src/client/modules/logger.ts
- src/client/modules/floating-card.ts → src/client/modules/ui-registry.ts
- src/client/modules/floating-fullscreen.ts → src/client/modules/animation-registry.ts
- src/client/modules/floating-fullscreen.ts → src/client/modules/interaction-constants.ts
- src/client/modules/floating-shared.ts → src/client/modules/animation-registry.ts
- src/client/modules/floating-shared.ts → src/client/modules/interaction-constants.ts
- src/client/modules/floating-shared.ts → src/client/modules/z-index-layers.ts
- src/client/modules/renderers/handler-factory.ts → src/client/modules/card-toast.ts
- src/client/modules/renderers/handler-factory.ts → src/client/modules/state.ts
- src/client/modules/terminal-card-04.ts → src/client/modules/gesture-registry.ts
- src/client/modules/terminal-card-04.ts → src/client/modules/logger.ts
- src/client/modules/terminal-card-04.ts → src/client/modules/ui.ts
- src/client/modules/terminal-card-04.ts → src/client/modules/z-index-layers.ts
- src/client/modules/tmux-card.ts → src/client/modules/gesture-registry.ts

### infra → ai-chat（35 边）

- tests/browser-tool.test.ts → src/server/ai/tools/omp/browser/tab-supervisor.ts
- tests/chat-protocol.test.ts → src/client/modules/orb-chat.ts
- tests/chat-protocol.test.ts → src/server/ai/chat.ts
- tests/client-logic.test.ts → src/client/modules/session-client.ts
- tests/client-logic.test.ts → src/shared/message-normalize.ts
- tests/compact-auto.test.ts → src/server/ai/compact-core.ts
- tests/compact-cutindex.test.ts → src/client/modules/session-client.ts
- tests/compact-l4.test.ts → src/shared/chat-protocol/to-openai-messages.ts
- tests/invariants.test.ts → src/server/ai/chat.ts
- tests/last-usage.test.ts → src/server/ai/session-store.ts
- tests/omp-glob.test.ts → src/server/ai/tools/omp/glob.ts
- tests/omp-glob.test.ts → src/server/ai/tools/types.ts
- tests/protocol-reducer.test.ts → src/shared/chat-protocol/events.ts
- tests/protocol-reducer.test.ts → src/shared/chat-protocol/messages.ts
- tests/protocol-reducer.test.ts → src/shared/chat-protocol/reducer.ts
- tests/provider-env.test.ts → src/server/ai/chat.ts
- tests/reasoning-l2.test.ts → src/shared/chat-protocol/to-openai-messages.ts
- tests/run-manager.test.ts → src/server/ai/chat.ts
- tests/run-manager.test.ts → src/server/ai/run-manager.ts
- tests/run-manager.test.ts → src/server/ai/tools/omp/bash.ts
- tests/server-routes.test.ts → src/server/ai/routes.ts
- tests/server-routes.test.ts → src/server/ai/tools/index.ts
- tests/session-flush.test.ts → src/server/ai/session-store.ts
- tests/session-invalidate.test.ts → src/server/ai/session-store.ts
- tests/session-parse.test.ts → src/client/modules/session-client.ts
- tests/session-security.test.ts → src/server/ai/routes.ts
- tests/to-openai-messages.test.ts → src/shared/chat-protocol/messages.ts
- tests/to-openai-messages.test.ts → src/shared/chat-protocol/to-openai-messages.ts
- tests/to-openai-messages.test.ts → src/shared/tool-compaction/index.ts
- tests/token-count.test.ts → src/server/ai/session-store.ts
- tests/tool-compaction.test.ts → src/shared/tool-compaction/index.ts
- tests/tool-schema.test.ts → src/server/ai/tools/index.ts
- tests/viewport-visibility.test.ts → src/client/modules/viewport-visibility.ts
- tests/visual-baseline.test.ts → src/client/modules/chat-dom.ts
- tests/visual-baseline.test.ts → src/shared/chat-protocol/messages.ts

### infra → canvas-tree（18 边）

- tests/box.test.ts → src/client/engine/v2/box.ts
- tests/client-logic.test.ts → src/client/modules/color-utils.ts
- tests/client-logic.test.ts → src/client/modules/mode-system.ts
- tests/client-logic.test.ts → src/client/modules/tree-model.ts
- tests/engine.test.ts → src/client/engine/v2/box.ts
- tests/engine.test.ts → src/client/engine/v2/flex.ts
- tests/engine.test.ts → src/client/modules/canvas-utils.ts
- tests/invariants.test.ts → src/client/engine/v2/box.ts
- tests/invariants.test.ts → src/client/engine/v2/flex.ts
- tests/invariants.test.ts → src/client/modules/liquid-geometry.ts
- tests/liquid-geometry.test.ts → src/client/modules/liquid-geometry.ts
- tests/regression.test.ts → src/client/modules/style-registry.ts
- tests/regression.test.ts → src/client/modules/tree-model.ts
- tests/regression.test.ts → src/client/modules/tree-render.ts
- tests/renderer.test.ts → src/client/engine/v2/StyleConfig.ts
- tests/renderer.test.ts → src/client/engine/v2/box.ts
- tests/renderer.test.ts → src/client/engine/v2/flex.ts
- tests/renderer.test.ts → src/client/engine/v2/renderer.ts

### infra → client-shell（16 边）

- tests/cards.test.ts → src/client/modules/gesture-registry.ts
- tests/client-logic.test.ts → src/client/modules/state.ts
- tests/ctx-kernel.test.ts → src/client/ctx.ts
- tests/gesture-registry.test.ts → src/client/modules/gesture-registry.ts
- tests/hand-drag.test.ts → src/client/modules/hand-geometry.ts
- tests/invariants.test.ts → src/client/modules/z-index-layers.ts
- tests/regression.test.ts → src/client/modules/animation-registry.ts
- tests/regression.test.ts → src/client/modules/click-queue.ts
- tests/regression.test.ts → src/client/modules/debug-assert.ts
- tests/regression.test.ts → src/client/modules/dom-refs.ts
- tests/regression.test.ts → src/client/modules/interaction-constants.ts
- tests/regression.test.ts → src/client/modules/logger.ts
- tests/regression.test.ts → src/client/modules/renderer-lifecycle.ts
- tests/regression.test.ts → src/client/modules/state.ts
- tests/reset-hooks.ts → src/client/modules/gesture-registry.ts
- tests/reset-hooks.ts → src/client/modules/state.ts

### infra → floating-card（7 边）

- tests/cards.test.ts → src/client/modules/card-registry.ts
- tests/cards.test.ts → src/client/modules/card-stack.ts
- tests/cards.test.ts → src/client/modules/floating-card.ts
- tests/cards.test.ts → src/client/modules/floating-shared.ts
- tests/cards.test.ts → src/client/modules/tmux-card.ts
- tests/floating-state.test.ts → src/client/modules/floating-shared.ts
- tests/reset-hooks.ts → src/client/modules/card-registry.ts

### infra → server（16 边）

- tests/compact-cutindex.test.ts → src/server/routes/files.ts
- tests/compact-list.test.ts → src/server/routes/files.ts
- tests/obs-audit-pending.test.ts → src/server/routes/obs.ts
- tests/obs-roles.test.ts → src/server/routes/obs.ts
- tests/obs-track-time.test.ts → src/server/routes/obs.ts
- tests/path-utils.test.ts → src/server/path-utils.ts
- tests/permissions.test.ts → src/server/ai/permissions.ts
- tests/provider-env.test.ts → src/server/env-store.ts
- tests/provider-env.test.ts → src/server/path-utils.ts
- tests/provider-env.test.ts → src/server/routes/providers.ts
- tests/server-routes.test.ts → src/server/path-utils.ts
- tests/server-routes.test.ts → src/server/routes/files.ts
- tests/session-flush.test.ts → src/server/path-utils.ts
- tests/session-invalidate.test.ts → src/server/path-utils.ts
- tests/session-security.test.ts → src/server/path-utils.ts
- tests/session-security.test.ts → src/server/ws-server.ts

### server → ai-chat（8 边）

- src/server/ai/permissions.ts → src/server/ai/tools/types.ts
- src/server/index.ts → src/server/ai/routes.ts
- src/server/routes/compact.ts → src/server/ai/compact-core.ts
- src/server/routes/compact.ts → src/server/ai/session-store.ts
- src/server/routes/compact.ts → src/shared/chat-protocol/to-openai-messages.ts
- src/server/routes/files.ts → src/server/ai/session-store.ts
- src/server/ws-server.ts → src/server/ai/eyes.ts
- src/server/ws-server.ts → src/server/ai/page-state.ts

---
合计 342 文件 · 57854 行 · 跨域边 284 条
