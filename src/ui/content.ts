import type { MddDoc, AuditFile, MddWorkspace, DependencyGraph } from '../types/index.js';
import { renderGraphAscii } from '../reader/graph.js';

// ── Blessed tag escaping ────────────────────────────────────────────────────

function escapeContent(text: string): string {
  return text.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

// ── Markdown → blessed tags ─────────────────────────────────────────────────

export function renderMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const result: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      result.push(`{gray-fg}${escapeContent(line)}{/gray-fg}`);
      continue;
    }

    if (inFence) {
      result.push(`{gray-fg}${escapeContent(line)}{/gray-fg}`);
      continue;
    }

    if (line.startsWith('# ')) {
      const text = escapeContent(line.slice(2));
      result.push(`{bold}{white-fg}${text}{/white-fg}{/bold}`);
    } else if (line.startsWith('## ')) {
      const text = escapeContent(line.slice(3));
      result.push(`{bold}{cyan-fg}${text}{/cyan-fg}{/bold}`);
    } else if (line.startsWith('### ')) {
      const text = escapeContent(line.slice(4));
      result.push(`{bold}{yellow-fg}${text}{/yellow-fg}{/bold}`);
    } else if (/^[-*] /.test(line)) {
      const text = escapeContent(line.slice(2));
      // Apply inline backtick handling to bullets
      result.push(`{white-fg}• ${renderInline(text)}{/white-fg}`);
    } else if (/^\d+\. /.test(line)) {
      const text = escapeContent(line.replace(/^\d+\. /, ''));
      result.push(`{white-fg}${renderInline(text)}{/white-fg}`);
    } else if (line.startsWith('|')) {
      result.push(`{gray-fg}${escapeContent(line)}{/gray-fg}`);
    } else if (line.trim() === '') {
      result.push('');
    } else {
      result.push(`{white-fg}${renderInline(escapeContent(line))}{/white-fg}`);
    }
  }

  return result.join('\n');
}

function renderInline(text: string): string {
  // Replace inline backtick content with cyan (text already escaped)
  // We need to handle the escaped braces carefully here
  return text.replace(/`([^`]+)`/g, (_match, code) => {
    return `{cyan-fg}${code}{/cyan-fg}`;
  });
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
  return ` {white-fg}${escapeContent(typeLabel)}{/white-fg} {gray-fg}${escapeContent(audit.date)}{/gray-fg}`;
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

  const driftedColor = scan.drifted > 0 ? 'yellow-fg' : 'gray-fg';
  const brokenColor = scan.broken > 0 ? 'red-fg' : 'gray-fg';
  const untrackedColor = scan.untracked > 0 ? 'yellow-fg' : 'gray-fg';
  const issuesColor = issuesTotal > 0 ? 'yellow-fg' : 'gray-fg';

  return [
    `{white-fg}DOCS {bold}${total}{/bold}{/white-fg}`,
    `{gray-fg}IN SYNC {bold}${scan.inSync}{/bold}{/gray-fg}`,
    `{${driftedColor}}DRIFTED {bold}${scan.drifted}{/bold}{/${driftedColor}}`,
    `{${brokenColor}}BROKEN {bold}${scan.broken}{/bold}{/${brokenColor}}`,
    `{${untrackedColor}}UNTRACKED {bold}${scan.untracked}{/bold}{/${untrackedColor}}`,
    `{${issuesColor}}ISSUES {bold}${issuesTotal}{/bold}{/${issuesColor}}`,
    `{gray-fg}AUDITS {bold}${audits.length}{/bold}{/gray-fg}`,
  ].join('  {gray-fg}│{/gray-fg}  ');
}
