import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownView } from './MarkdownView.js';
import { renderGraphAscii } from '../reader/graph.js';
import type { MddWorkspace } from '../types/index.js';
import type { LeftPanelItem } from './LeftPanel.js';
import { driftIcon } from './DocItem.js';

const STATUS_COLOR: Record<string, string> = {
  complete: 'green',
  in_progress: 'yellow',
  draft: 'gray',
  deprecated: 'gray',
};

interface Props {
  workspace: MddWorkspace;
  selectedItem: LeftPanelItem | null;
  scrollOffset: number;
  focused: boolean;
  terminalHeight: number;
}

export function RightPanel({ workspace, selectedItem, scrollOffset, focused, terminalHeight }: Props) {
  const contentHeight = terminalHeight - 6; // account for status bar + borders

  // Nothing selected — show .startup.md
  if (!selectedItem) {
    const content = workspace.startupContent ?? '(No .mdd/.startup.md found — run /mdd status to generate)';
    return (
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={2}
        paddingY={1}
      >
        <Text color="gray" dimColor>startup context</Text>
        <Box marginTop={1} flexGrow={1}>
          <MarkdownView content={content} scrollOffset={scrollOffset} maxLines={contentHeight} />
        </Box>
      </Box>
    );
  }

  // Dependency graph selected
  if (selectedItem.type === 'graph') {
    const ascii = renderGraphAscii(workspace.graph);
    return (
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={2}
        paddingY={1}
      >
        <Text bold color="cyan">Dependency Graph</Text>
        {workspace.graph.brokenEdges.length > 0 && (
          <Text color="red">❌ {workspace.graph.brokenEdges.length} broken edge(s)</Text>
        )}
        {workspace.graph.riskyEdges.length > 0 && (
          <Text color="yellow">⚠️  {workspace.graph.riskyEdges.length} risky edge(s)</Text>
        )}
        <Box marginTop={1}>
          <MarkdownView content={ascii} scrollOffset={scrollOffset} maxLines={contentHeight - 3} />
        </Box>
      </Box>
    );
  }

  // Audit file selected
  if (selectedItem.type === 'audit' && selectedItem.audit) {
    const audit = selectedItem.audit;
    return (
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={2}
        paddingY={1}
      >
        <Text bold color="white">{audit.filename}</Text>
        <Text color="gray">{audit.date}</Text>
        <Box marginTop={1} flexGrow={1}>
          <MarkdownView content={audit.body} scrollOffset={scrollOffset} maxLines={contentHeight - 3} />
        </Box>
      </Box>
    );
  }

  // Feature doc selected
  if (selectedItem.type === 'doc' && selectedItem.doc) {
    const doc = selectedItem.doc;
    const statusColor = (STATUS_COLOR[doc.status] ?? 'gray') as any;
    const icon = driftIcon(doc);

    return (
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={2}
        paddingY={1}
      >
        {/* Title */}
        <Text bold color="white">{doc.id.replace(/-/g, ' — ').replace(/(\d+) — /, '$1 — ')}</Text>

        {/* Frontmatter chips row */}
        <Box marginTop={1} flexWrap="wrap" gap={1}>
          <Text color={statusColor} bold>{icon} {doc.status.toUpperCase()}</Text>
          {doc.phase && <Text color="gray">  phase: {doc.phase}</Text>}
          {doc.lastSynced && <Text color="gray">  synced: {doc.lastSynced}</Text>}
        </Box>

        {/* Source files */}
        {doc.sourceFiles.length > 0 && !doc.sourceFiles[0].startsWith('NOTE:') && (
          <Box marginTop={1} flexWrap="wrap">
            <Text color="gray">SOURCE  </Text>
            {doc.sourceFiles.map(f => (
              <Text key={f} color="cyan">  {f}</Text>
            ))}
          </Box>
        )}

        {/* Depends on */}
        {doc.dependsOn.length > 0 && (
          <Box marginTop={1} flexWrap="wrap">
            <Text color="gray">DEPENDS ON  </Text>
            {doc.dependsOn.map(d => (
              <Text key={d} color="yellow">  {d}</Text>
            ))}
          </Box>
        )}

        {/* Known issues */}
        {doc.knownIssues.length > 0 && (
          <Box marginTop={1}>
            <Text color="red">KNOWN ISSUES  {doc.knownIssues.length}</Text>
          </Box>
        )}

        {/* Drift info */}
        {doc.driftStatus === 'drifted' && doc.driftCommits.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text color="yellow">⚠️  Drifted — commits since last sync:</Text>
            {doc.driftCommits.slice(0, 3).map((c, i) => (
              <Text key={i} color="gray">  {c}</Text>
            ))}
          </Box>
        )}

        <Box marginTop={1} borderStyle="single" borderColor="gray" />

        {/* Markdown body */}
        <Box flexGrow={1}>
          <MarkdownView content={doc.body} scrollOffset={scrollOffset} maxLines={contentHeight - 8} />
        </Box>
      </Box>
    );
  }

  return null;
}
