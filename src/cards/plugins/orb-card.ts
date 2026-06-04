import { createFloatingCard } from '../../client/modules/floating-card.js';
import { DOM } from '../../client/modules/dom-refs.js';
import { currentTheme as theme } from '../../client/modules/theme.js';
import { Registry } from '../../client/modules/ui-registry.js';
import { wsChannel } from '../../client/modules/ws-channel.js';

export function initOrbCard(): void {
  createFloatingCard({
    id: 'orb',
    name: 'AI Chat',
    compactWidth: 0,
    compactHeight: 0,
    activeWidth: 300,
    activeHeight: 350,
    minWidth: 120,
    minHeight: 100,
    orbSize: 36,
    margin: 8,
    cornerTL: false,
    cornerTR: false,
    cornerBL: false,
    mode: 'orb',
    alwaysOnTop: true,
    inputBarAvoid: true,
    accentColor: '#7c3aed',
    surfaceBg: 'rgba(10,10,30,0.85)',
    initialPosition: { right: 8, bottom: 8 },
    onActivate(contentEl: HTMLElement) {},
    onDeactivate(contentEl: HTMLElement) {},
    onCreate(el: HTMLElement) {},
  });
}
