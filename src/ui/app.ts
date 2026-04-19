import blessed from 'blessed';
import type { MddWorkspace, MddDoc, MddOps, AuditFile, Initiative, Wave } from '../types/index.js';
import {
  buildDocListItem,
  buildOpsListItem,
  buildSectionHeader,
  buildAuditListItem,
  buildStartupContent,
  buildDocContent,
  buildOpsContent,
  buildAuditContent,
  buildGraphContent,
  buildStatusBar,
  buildInitiativeContent,
  buildWaveContent,
} from './content.js';

// ── List item descriptor ──────────────────────────────────────────────────────

type ListItemKind =
  | { kind: 'header' }
  | { kind: 'doc'; doc: MddDoc }
  | { kind: 'ops'; ops: MddOps }
  | { kind: 'audit'; audit: AuditFile }
  | { kind: 'graph' }
  | { kind: 'initiative'; initiative: Initiative; expanded: boolean }
  | { kind: 'wave'; wave: Wave };

interface ListEntry {
  label: string;
  item: ListItemKind;
}

// ── Build left panel entries ──────────────────────────────────────────────────

// Track which initiatives are expanded — keyed by initiative id
const expandedInitiatives = new Set<string>();

function buildEntries(ws: MddWorkspace): ListEntry[] {
  const entries: ListEntry[] = [];

  // Initiatives section (shown first if any exist)
  const initiatives = ws.initiatives ?? [];
  if (initiatives.length > 0) {
    entries.push({
      label: buildSectionHeader('INITIATIVES', initiatives.length),
      item: { kind: 'header' },
    });
    for (const initiative of initiatives) {
      const expanded = expandedInitiatives.has(initiative.id);
      const icon = expanded ? '▾' : '▸';
      const statusColor = initiative.status === 'active' ? 'green-fg'
        : initiative.status === 'complete' ? 'gray-fg'
        : initiative.status === 'cancelled' ? 'red-fg'
        : 'yellow-fg';
      entries.push({
        label: ` {white-fg}${icon} ${initiative.title}{/white-fg}  {${statusColor}}${initiative.status}{/${statusColor}}`,
        item: { kind: 'initiative', initiative, expanded },
      });
      if (expanded) {
        for (const wave of initiative.waves) {
          const wColor = wave.status === 'active' ? 'green-fg'
            : wave.status === 'complete' ? 'gray-fg'
            : 'yellow-fg';
          const wIcon = wave.status === 'complete' ? '✓' : wave.status === 'active' ? '●' : '○';
          const done = wave.features.filter(f => f.waveStatus === 'complete').length;
          const total = wave.features.length;
          const progress = total > 0 ? ` ${done}/${total}` : '';
          entries.push({
            label: `   {${wColor}}${wIcon} ${wave.title}${progress}{/${wColor}}`,
            item: { kind: 'wave', wave },
          });
        }
      }
    }
  }

  const activeDocs = ws.docs.filter(d => !d.archived);
  const archivedDocs = ws.docs.filter(d => d.archived);
  const allDisplayedDocs = [...activeDocs, ...archivedDocs];

  const featureDocs = allDisplayedDocs.filter(d => d.type !== 'task');
  const taskDocs = allDisplayedDocs.filter(d => d.type === 'task');

  // Feature docs section
  entries.push({
    label: buildSectionHeader('FEATURE DOCS', featureDocs.length),
    item: { kind: 'header' },
  });

  for (const doc of featureDocs) {
    entries.push({
      label: buildDocListItem(doc),
      item: { kind: 'doc', doc },
    });
  }

  // Tasks section (frozen — no drift tracking)
  if (taskDocs.length > 0) {
    entries.push({
      label: buildSectionHeader('TASKS', taskDocs.length),
      item: { kind: 'header' },
    });
    for (const doc of taskDocs) {
      entries.push({
        label: buildDocListItem(doc),
        item: { kind: 'doc', doc },
      });
    }
  }

  // Ops runbooks section
  const opsDocs = ws.ops ?? [];
  if (opsDocs.length > 0) {
    entries.push({
      label: buildSectionHeader('OPS RUNBOOKS', opsDocs.length),
      item: { kind: 'header' },
    });
    for (const ops of opsDocs) {
      entries.push({
        label: buildOpsListItem(ops),
        item: { kind: 'ops', ops },
      });
    }
  }

  // Audit reports section
  if (ws.audits.length > 0) {
    entries.push({
      label: buildSectionHeader('AUDIT REPORTS', ws.audits.length),
      item: { kind: 'header' },
    });
    for (const audit of ws.audits) {
      entries.push({
        label: buildAuditListItem(audit),
        item: { kind: 'audit', audit },
      });
    }
  }

  // Dep graph section
  entries.push({
    label: ` {white-fg}DEP GRAPH ▸{/white-fg}`,
    item: { kind: 'graph' },
  });

  return entries;
}

// ── Content for a list entry ──────────────────────────────────────────────────

function contentForEntry(entry: ListEntry, ws: MddWorkspace): string {
  const item = entry.item;
  if (item.kind === 'header') {
    return buildStartupContent(ws);
  }
  if (item.kind === 'doc') {
    return buildDocContent(item.doc);
  }
  if (item.kind === 'ops') {
    return buildOpsContent(item.ops);
  }
  if (item.kind === 'audit') {
    return buildAuditContent(item.audit);
  }
  if (item.kind === 'graph') {
    return buildGraphContent(ws.graph);
  }
  if (item.kind === 'initiative') {
    return buildInitiativeContent(item.initiative);
  }
  if (item.kind === 'wave') {
    return buildWaveContent(item.wave);
  }
  return buildStartupContent(ws);
}

// ── Main app ──────────────────────────────────────────────────────────────────

export function runApp(
  ws: MddWorkspace,
  refresh: (cb: (newWs: MddWorkspace) => void) => void,
): void {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: 'MDD Dashboard',
  });

  // ── Status bar ──────────────────────────────────────────────────────────────
  const statusBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'gray' },
    },
    content: buildStatusBar(ws),
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
  });

  // ── Left panel ──────────────────────────────────────────────────────────────
  const leftBox = blessed.list({
    top: 3,
    left: 0,
    width: 34,
    bottom: 0,
    tags: true,
    keys: false,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' },
      selected: { bg: 'blue', fg: 'white' },
    },
  });

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightBox = blessed.box({
    top: 3,
    left: 34,
    right: 0,
    bottom: 0,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'gray' },
    },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    content: buildStartupContent(ws),
    scrollbar: {
      ch: ' ',
      style: { bg: 'gray' },
    },
  });

  screen.append(statusBar);
  screen.append(leftBox);
  screen.append(rightBox);

  // ── State ───────────────────────────────────────────────────────────────────
  let entries = buildEntries(ws);
  let selectedIndex = 0; // index into entries (skipping headers)
  let focusRight = false;

  // Populate list items
  function populateList(): void {
    leftBox.clearItems();
    for (const entry of entries) {
      leftBox.addItem(entry.label);
    }
  }

  // Find first selectable index
  function firstSelectableIndex(): number {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].item.kind !== 'header') return i;
    }
    return 0;
  }

  // Move selectedIndex by delta, skipping headers
  function moveSelection(delta: number): void {
    let next = selectedIndex + delta;
    while (next >= 0 && next < entries.length && entries[next].item.kind === 'header') {
      next += delta;
    }
    if (next >= 0 && next < entries.length) {
      selectedIndex = next;
    }
  }

  function updateSelection(): void {
    leftBox.select(selectedIndex);
    const entry = entries[selectedIndex];
    if (entry) {
      rightBox.setContent(contentForEntry(entry, ws));
      rightBox.scrollTo(0);
    }
    screen.realloc();
    screen.render();
  }

  function setFocusLeft(): void {
    focusRight = false;
    leftBox.style.border.fg = 'cyan';
    rightBox.style.border.fg = 'gray';
    screen.realloc();
    screen.render();
  }

  function setFocusRight(): void {
    focusRight = true;
    leftBox.style.border.fg = 'gray';
    rightBox.style.border.fg = 'cyan';
    screen.realloc();
    screen.render();
  }

  // ── Keyboard handling ────────────────────────────────────────────────────────
  screen.key(['up', 'k'], () => {
    if (focusRight) {
      rightBox.scroll(-3);
      screen.realloc();
      screen.render();
    } else {
      moveSelection(-1);
      updateSelection();
    }
  });

  screen.key(['down', 'j'], () => {
    if (focusRight) {
      rightBox.scroll(3);
      screen.realloc();
      screen.render();
    } else {
      moveSelection(1);
      updateSelection();
    }
  });

  screen.key(['pageup'], () => {
    if (focusRight) {
      rightBox.scroll(-(rightBox.height as number - 2));
      screen.realloc();
      screen.render();
    }
  });

  screen.key(['pagedown'], () => {
    if (focusRight) {
      rightBox.scroll(rightBox.height as number - 2);
      screen.realloc();
      screen.render();
    }
  });

  screen.key(['home'], () => {
    if (focusRight) {
      rightBox.scrollTo(0);
      screen.realloc();
      screen.render();
    }
  });

  screen.key(['end'], () => {
    if (focusRight) {
      rightBox.scrollTo(rightBox.getScrollHeight());
      screen.realloc();
      screen.render();
    }
  });

  screen.key(['right', 'l', 'enter'], () => {
    // If selected item is an initiative, toggle expand/collapse instead of focusing right
    const entry = entries[selectedIndex];
    if (entry?.item.kind === 'initiative') {
      const id = entry.item.initiative.id;
      if (expandedInitiatives.has(id)) {
        expandedInitiatives.delete(id);
      } else {
        expandedInitiatives.add(id);
      }
      entries = buildEntries(ws);
      populateList();
      updateSelection();
      return;
    }
    setFocusRight();
  });

  // i — jump to first initiative in the list
  screen.key(['i'], () => {
    const idx = entries.findIndex(e => e.item.kind === 'initiative');
    if (idx >= 0) {
      selectedIndex = idx;
      updateSelection();
      setFocusLeft();
    }
  });

  screen.key(['left', 'h', 'escape'], () => {
    setFocusLeft();
  });

  screen.key(['r'], () => {
    statusBar.setContent(`{yellow-fg}Refreshing...{/yellow-fg}`);
    screen.render();
    refresh((newWs) => {
      ws = newWs;
      entries = buildEntries(ws);
      populateList();
      statusBar.setContent(buildStatusBar(ws));
      // Re-apply selection
      if (selectedIndex >= entries.length) {
        selectedIndex = firstSelectableIndex();
      }
      updateSelection();
    });
  });

  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  // Mouse click on left panel items
  leftBox.on('select', (_item: unknown, index: number) => {
    if (entries[index]?.item.kind === 'header') return;
    selectedIndex = index;
    updateSelection();
    setFocusLeft();
  });

  // ── Initial render ───────────────────────────────────────────────────────────
  populateList();
  selectedIndex = firstSelectableIndex();
  updateSelection();
  setFocusLeft();
  screen.render();
}
