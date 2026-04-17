import type { MddDoc, AuditFile, MddWorkspace, DependencyGraph, Initiative, Wave } from '../types/index.js';
import { renderGraphAscii } from '../reader/graph.js';

// ── Blessed tag escaping ────────────────────────────────────────────────────

// Wraps arbitrary text so blessed never interprets {} as tags
function escapeContent(text: string): string {
  if (!text) return '';
  return `{escape}${text}{/escape}`;
}

// ── Markdown table renderer ─────────────────────────────────────────────────

function parseTableRow(line: string): string[] {
  const parts = line.split('|');
  const start = parts[0].trim() === '' ? 1 : 0;
  const end = parts[parts.length - 1].trim() === '' ? parts.length - 1 : parts.length;
  return parts.slice(start, end).map(c => c.trim());
}

// Visual width of a cell: strip markdown span markers (**bold**, `code`)
// so padding calculations match what actually renders on screen
function cellVisualWidth(cell: string): number {
  return cell
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .length;
}

function renderTable(tableLines: string[]): string {
  if (tableLines.length === 0) return '';

  const allRows = tableLines.map(parseTableRow);
  const sepIdx = allRows.findIndex(row =>
    row.length > 0 && row.every(cell => /^[-: ]+$/.test(cell) && cell.includes('-'))
  );
  const contentRows = allRows
    .filter((_, i) => i !== sepIdx)
    .filter(row => row.some(cell => cell.length > 0));  // drop blank spacer rows
  if (contentRows.length === 0) {
    return tableLines.map(l => `{gray-fg}${escapeContent(l)}{/gray-fg}`).join('\n');
  }

  const colCount = Math.max(...contentRows.map(r => r.length));
  const norm = contentRows.map(row => {
    const r = [...row];
    while (r.length < colCount) r.push('');
    return r;
  });

  // Use visual width so backtick/bold markers don't inflate column widths
  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.max(1, ...norm.map(row => cellVisualWidth(row[i] || '')))
  );

  const hLine = (l: string, sep: string, r: string): string =>
    `{gray-fg}${l + colWidths.map(w => '─'.repeat(w + 2)).join(sep) + r}{/gray-fg}`;

  const buildRow = (cells: string[], isHeader: boolean): string => {
    const parts = cells.map((cell, i) => {
      const vis = cellVisualWidth(cell);
      const pad = colWidths[i] - vis;
      const content = renderInline(cell) + (pad > 0 ? escapeContent(' '.repeat(pad)) : '');
      return isHeader
        ? `{bold}{white-fg} ${content} {/white-fg}{/bold}`
        : `{white-fg} ${content} {/white-fg}`;
    });
    return `{gray-fg}│{/gray-fg}` + parts.join(`{gray-fg}│{/gray-fg}`) + `{gray-fg}│{/gray-fg}`;
  };

  const hasHeader = sepIdx !== -1;
  const out: string[] = [];
  out.push(hLine('┌', '┬', '┐'));

  norm.forEach((row, idx) => {
    out.push(buildRow(row, hasHeader && idx === 0));
    if (hasHeader && idx === 0 && norm.length > 1) {
      out.push(hLine('├', '┼', '┤'));
    }
  });

  out.push(hLine('└', '┴', '┘'));
  return out.join('\n');
}

// ── Markdown → blessed tags ─────────────────────────────────────────────────

export function renderMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const result: string[] = [];
  let inFence = false;
  let tableBuffer: string[] = [];

  function flushTable(): void {
    if (tableBuffer.length > 0) {
      result.push(renderTable(tableBuffer));
      tableBuffer = [];
    }
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      flushTable();
      inFence = !inFence;
      result.push(`{gray-fg}${escapeContent(line)}{/gray-fg}`);
      continue;
    }

    if (inFence) {
      result.push(`{gray-fg}${escapeContent(line)}{/gray-fg}`);
      continue;
    }

    if (line.startsWith('|')) {
      tableBuffer.push(line);
      continue;
    }

    flushTable();

    if (line.startsWith('# ')) {
      result.push(`{bold}{white-fg}${renderInline(line.slice(2))}{/white-fg}{/bold}`);
    } else if (line.startsWith('## ')) {
      result.push(`{bold}{cyan-fg}${renderInline(line.slice(3))}{/cyan-fg}{/bold}`);
    } else if (line.startsWith('### ')) {
      result.push(`{bold}{yellow-fg}${renderInline(line.slice(4))}{/yellow-fg}{/bold}`);
    } else if (line.startsWith('#### ')) {
      result.push(`{bold}{green-fg}${renderInline(line.slice(5))}{/green-fg}{/bold}`);
    } else if (/^[-*] /.test(line)) {
      result.push(`{white-fg}• ${renderInline(line.slice(2))}{/white-fg}`);
    } else if (/^\d+\. /.test(line)) {
      result.push(`{white-fg}${renderInline(line.replace(/^\d+\. /, ''))}{/white-fg}`);
    } else if (line.trim() === '') {
      result.push('');
    } else {
      result.push(`{white-fg}${renderInline(line)}{/white-fg}`);
    }
  }

  flushTable();
  return result.join('\n');
}

// Parses raw (unescaped) text for **bold** and `code`, escaping plain segments
function renderInline(raw: string): string {
  const out: string[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push(escapeContent(raw.slice(last, m.index)));
    if (m[1] !== undefined) out.push(`{bold}${escapeContent(m[1])}{/bold}`);
    else                    out.push(`{cyan-fg}${escapeContent(m[2])}{/cyan-fg}`);
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push(escapeContent(raw.slice(last)));
  return out.join('');
}

// ── Left panel list items ────────────────────────────────────────────────────

export function driftIcon(doc: MddDoc): string {
  switch (doc.driftStatus) {
    case 'in-sync': return '✅';
    case 'drifted': return '⚠️';
    case 'broken': return '❌';
    case 'untracked': return '❓';
    default: return '❓';
  }
}

export function driftColor(doc: MddDoc): string {
  switch (doc.driftStatus) {
    case 'in-sync': return 'green-fg';
    case 'drifted': return 'yellow-fg';
    case 'broken': return 'red-fg';
    case 'untracked': return 'gray-fg';
    default: return 'gray-fg';
  }
}

export function buildDocListItem(doc: MddDoc): string {
  const icon = driftIcon(doc);
  const color = driftColor(doc);
  const label = doc.archived ? `{gray-fg}🗄 ${escapeContent(doc.id)}{/gray-fg}` : `{${color}}${icon} ${escapeContent(doc.id)}{/${color}}`;
  return ` ${label}`;
}

export function buildSectionHeader(label: string, count: number): string {
  return `{cyan-fg}{bold}${label}{/bold}{/cyan-fg} {gray-fg}${count}{/gray-fg}`;
}

export function buildAuditListItem(audit: AuditFile): string {
  const typeLabel = audit.type.padEnd(8).slice(0, 8);
  return ` {white-fg}${typeLabel}{/white-fg} {gray-fg}${audit.date}{/gray-fg}`;
}

// ── Right panel content builders ─────────────────────────────────────────────

export function buildStartupContent(ws: MddWorkspace): string {
  if (ws.startupContent) {
    return renderMarkdown(ws.startupContent);
  }
  return [
    `{bold}{cyan-fg}MDD Workspace{/cyan-fg}{/bold}`,
    '',
    `{gray-fg}Docs: ${ws.docs.length}  Audits: ${ws.audits.length}{/gray-fg}`,
    '',
    `{white-fg}Use ↑/↓ to navigate, →/Enter to focus right panel{/white-fg}`,
    `{white-fg}Press r to refresh, q to quit{/white-fg}`,
  ].join('\n');
}

export function buildDocContent(doc: MddDoc): string {
  const lines: string[] = [];

  // Title
  lines.push(`{bold}{white-fg}${escapeContent(doc.title)}{/white-fg}{/bold}`);
  lines.push('');

  // Status chips row
  const statusColor = doc.status === 'complete' ? 'green-fg'
    : doc.status === 'in_progress' ? 'cyan-fg'
    : doc.status === 'draft' ? 'yellow-fg'
    : 'gray-fg';
  const driftCol = driftColor(doc);

  lines.push(
    `{${statusColor}}[${doc.status.replace('_', ' ')}]{/${statusColor}}  ` +
    `{${driftCol}}[${doc.driftStatus}]{/${driftCol}}  ` +
    `{gray-fg}phase: ${escapeContent(doc.phase || 'none')}{/gray-fg}`
  );
  lines.push('');

  // Source files
  if (doc.sourceFiles.length > 0) {
    lines.push(`{yellow-fg}Source files:{/yellow-fg}`);
    for (const f of doc.sourceFiles) {
      lines.push(`  {cyan-fg}${escapeContent(f)}{/cyan-fg}`);
    }
    lines.push('');
  }

  // Depends on
  if (doc.dependsOn.length > 0) {
    lines.push(`{yellow-fg}Depends on:{/yellow-fg}`);
    for (const d of doc.dependsOn) {
      lines.push(`  {white-fg}${escapeContent(d)}{/white-fg}`);
    }
    lines.push('');
  }

  // Known issues
  if (doc.knownIssues.length > 0) {
    lines.push(`{red-fg}Known issues: ${doc.knownIssues.length}{/red-fg}`);
    for (const issue of doc.knownIssues) {
      lines.push(`  {yellow-fg}• ${escapeContent(issue)}{/yellow-fg}`);
    }
    lines.push('');
  }

  // Drift commits
  if (doc.driftStatus === 'drifted' || doc.driftStatus === 'broken') {
    if (doc.driftCommits.length > 0) {
      lines.push(`{yellow-fg}Drift commits:{/yellow-fg}`);
      for (const c of doc.driftCommits) {
        lines.push(`  {gray-fg}• ${escapeContent(c)}{/gray-fg}`);
      }
      lines.push('');
    }
  }

  // Last synced
  if (doc.lastSynced) {
    lines.push(`{gray-fg}Last synced: ${escapeContent(doc.lastSynced)}{/gray-fg}`);
    lines.push('');
  }

  // Separator
  lines.push(`{gray-fg}${'─'.repeat(40)}{/gray-fg}`);
  lines.push('');

  // Markdown body
  if (doc.body.trim()) {
    lines.push(renderMarkdown(doc.body));
  }

  return lines.join('\n');
}

export function buildAuditContent(audit: AuditFile): string {
  const lines: string[] = [];

  lines.push(`{bold}{white-fg}${escapeContent(audit.filename)}{/white-fg}{/bold}`);
  lines.push(`{gray-fg}Date: ${escapeContent(audit.date)}  Type: ${escapeContent(audit.type)}{/gray-fg}`);
  lines.push('');
  lines.push(`{gray-fg}${'─'.repeat(40)}{/gray-fg}`);
  lines.push('');

  if (audit.body.trim()) {
    lines.push(renderMarkdown(audit.body));
  }

  return lines.join('\n');
}

export function buildGraphContent(graph: DependencyGraph): string {
  const lines: string[] = [];

  lines.push(`{bold}{white-fg}Dependency Graph{/white-fg}{/bold}`);
  lines.push('');

  const brokenCount = graph.brokenEdges.length;
  const riskyCount = graph.riskyEdges.length;

  if (brokenCount > 0) {
    lines.push(`{red-fg}Broken edges: ${brokenCount}{/red-fg}`);
  }
  if (riskyCount > 0) {
    lines.push(`{yellow-fg}Risky edges: ${riskyCount}{/yellow-fg}`);
  }
  if (brokenCount === 0 && riskyCount === 0) {
    lines.push(`{green-fg}No broken or risky edges{/green-fg}`);
  }
  lines.push('');
  lines.push(`{gray-fg}${'─'.repeat(40)}{/gray-fg}`);
  lines.push('');

  const ascii = renderGraphAscii(graph);
  lines.push(`{white-fg}${escapeContent(ascii)}{/white-fg}`);

  return lines.join('\n');
}

// ── Status bar ────────────────────────────────────────────────────────────────

export function buildStatusBar(ws: MddWorkspace): string {
  const { scan, docs, audits, issuesTotal } = ws;
  const total = docs.length;
  const initiatives = ws.initiatives ?? [];

  const driftedColor = scan.drifted > 0 ? 'yellow-fg' : 'gray-fg';
  const brokenColor = scan.broken > 0 ? 'red-fg' : 'gray-fg';
  const untrackedColor = scan.untracked > 0 ? 'yellow-fg' : 'gray-fg';
  const issuesColor = issuesTotal > 0 ? 'yellow-fg' : 'gray-fg';

  const segments = [
    `{white-fg}DOCS {bold}${total}{/bold}{/white-fg}`,
    `{gray-fg}IN SYNC {bold}${scan.inSync}{/bold}{/gray-fg}`,
    `{${driftedColor}}DRIFTED {bold}${scan.drifted}{/bold}{/${driftedColor}}`,
    `{${brokenColor}}BROKEN {bold}${scan.broken}{/bold}{/${brokenColor}}`,
    `{${untrackedColor}}UNTRACKED {bold}${scan.untracked}{/bold}{/${untrackedColor}}`,
    `{${issuesColor}}ISSUES {bold}${issuesTotal}{/bold}{/${issuesColor}}`,
    `{gray-fg}AUDITS {bold}${audits.length}{/bold}{/gray-fg}`,
  ];

  if (initiatives.length > 0) {
    const activeCount = initiatives.filter(i => i.status === 'active').length;
    const activeWaves = initiatives
      .flatMap(i => i.waves)
      .filter(w => w.status === 'active').length;
    segments.push(`{cyan-fg}INITIATIVES {bold}${activeCount}{/bold}{/cyan-fg}`);
    if (activeWaves > 0) {
      segments.push(`{cyan-fg}WAVES {bold}${activeWaves}{/bold} active{/cyan-fg}`);
    }
  } else {
    segments.push(`{gray-fg}No active initiatives{/gray-fg}`);
  }

  return segments.join('  {gray-fg}│{/gray-fg}  ');
}

// ── Initiative content ────────────────────────────────────────────────────────

export function buildInitiativeContent(initiative: Initiative): string {
  const lines: string[] = [];
  const statusColor = initiative.status === 'active' ? 'green-fg'
    : initiative.status === 'complete' ? 'gray-fg'
    : initiative.status === 'cancelled' ? 'red-fg'
    : 'yellow-fg';

  lines.push(`{bold}{white-fg}${escapeContent(initiative.title)}{/white-fg}{/bold}  {${statusColor}}${initiative.status}{/${statusColor}}  {gray-fg}v${initiative.version}{/gray-fg}`);
  lines.push('');

  if (initiative.overview) {
    lines.push(`{gray-fg}${escapeContent(initiative.overview)}{/gray-fg}`);
    lines.push('');
  }

  // Open product questions
  const unchecked = initiative.openProductQuestions.filter(q => /\[ \]/.test(q));
  const checked = initiative.openProductQuestions.filter(q => /\[x\]/i.test(q));
  if (initiative.openProductQuestions.length > 0) {
    lines.push(`{white-fg}Open Product Questions{/white-fg}`);
    for (const q of checked) {
      lines.push(`  {gray-fg}${escapeContent(q)}{/gray-fg}`);
    }
    for (const q of unchecked) {
      lines.push(`  {red-fg}${escapeContent(q)}{/red-fg}`);
    }
    if (unchecked.length > 0) {
      lines.push(`  {red-fg}⚠ ${unchecked.length} unanswered — required before plan-wave{/red-fg}`);
    }
    lines.push('');
  }

  // Waves
  const waveCount = initiative.waves.length;
  const doneCount = initiative.waves.filter(w => w.status === 'complete').length;
  lines.push(`{white-fg}Waves  {bold}${doneCount}/${waveCount}{/bold} complete{/white-fg}`);
  for (const wave of initiative.waves) {
    const wColor = wave.status === 'complete' ? 'gray-fg'
      : wave.status === 'active' ? 'green-fg'
      : 'yellow-fg';
    const icon = wave.status === 'complete' ? '✓' : wave.status === 'active' ? '●' : '○';
    const featDone = wave.features.filter(f => f.waveStatus === 'complete').length;
    const featTotal = wave.features.length;
    const progress = featTotal > 0 ? ` ${featDone}/${featTotal}` : '';
    lines.push(`  {${wColor}}${icon} ${escapeContent(wave.title)}${progress}{/${wColor}}`);
  }

  return lines.join('\n');
}

// ── Wave content ──────────────────────────────────────────────────────────────

export function buildWaveContent(wave: Wave): string {
  const lines: string[] = [];
  const statusColor = wave.status === 'active' ? 'green-fg'
    : wave.status === 'complete' ? 'gray-fg'
    : 'yellow-fg';

  lines.push(`{bold}{white-fg}${escapeContent(wave.title)}{/white-fg}{/bold}  {${statusColor}}${wave.status}{/${statusColor}}`);
  lines.push('');

  lines.push(`{white-fg}Demo-State{/white-fg}`);
  lines.push(`{gray-fg}${escapeContent(wave.demoState)}{/gray-fg}`);
  lines.push('');

  // Feature progress
  const done = wave.features.filter(f => f.waveStatus === 'complete').length;
  const total = wave.features.length;
  lines.push(`{white-fg}Features  {bold}${done}/${total}{/bold} complete{/white-fg}`);
  for (const f of wave.features) {
    const fColor = f.waveStatus === 'complete' ? 'gray-fg'
      : f.waveStatus === 'active' ? 'green-fg'
      : 'yellow-fg';
    const icon = f.waveStatus === 'complete' ? '✓' : f.waveStatus === 'active' ? '●' : '○';
    const deps = f.dependsOn.length > 0 ? `  {gray-fg}← ${f.dependsOn.join(', ')}{/gray-fg}` : '';
    lines.push(`  {${fColor}}${icon} ${escapeContent(f.slug)}  ${f.waveStatus}{/${fColor}}${deps}`);
  }
  lines.push('');

  // Open research
  if (wave.openResearch.length > 0) {
    lines.push(`{white-fg}Open Research{/white-fg}`);
    for (const item of wave.openResearch) {
      lines.push(`  {yellow-fg}? ${escapeContent(item)}{/yellow-fg}`);
    }
    lines.push('');
  }

  // Next action hint
  if (wave.status === 'active' || wave.status === 'planned') {
    lines.push(`{gray-fg}Next → {white-fg}/mdd plan-execute ${escapeContent(wave.id)}{/white-fg}{/gray-fg}`);
  }

  return lines.join('\n');
}
