import React, { memo } from 'react';
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
  panelHeight: number;
}

// Border (top+bottom) = 2, paddingY={1} (top+bottom) = 2 → 4 rows overhead
const PANEL_CHROME = 4;

export const RightPanel = memo(function RightPanel({ workspace, selectedItem, scrollOffset, focused, panelHeight }: Props) {
  const maxContent = panelHeight - PANEL_CHROME;
  const borderColor = focused ? 'cyan' : 'gray';

  const panelBox = {
    flexDirection: 'column' as const,
    flexGrow: 1,
    height: panelHeight,
    overflow: 'hidden' as const,
    borderStyle: 'single' as const,
    borderColor,
    paddingX: 2,
    paddingY: 1,
  };

  // Nothing selected — show .startup.md
  if (!selectedItem) {
    const content = workspace.startupContent ?? '(No .mdd/.startup.md found — run /mdd status to generate)';
    return (
      <Box {...panelBox}>
        <Text color="gray" dimColor>startup context</Text>
        <MarkdownView content={content} scrollOffset={scrollOffset} maxLines={maxContent - 1} />
      </Box>
    );
  }

  // Dependency graph
  if (selectedItem.type === 'graph') {
    const ascii = renderGraphAscii(workspace.graph);
    const headerRows = 1
      + (workspace.graph.brokenEdges.length > 0 ? 1 : 0)
      + (workspace.graph.riskyEdges.length > 0 ? 1 : 0);
    return (
      <Box {...panelBox}>
        <Text bold color="cyan">Dependency Graph</Text>
        {workspace.graph.brokenEdges.length > 0 && (
          <Text color="red">❌ {workspace.graph.brokenEdges.length} broken edge(s)</Text>
        )}
        {workspace.graph.riskyEdges.length > 0 && (
          <Text color="yellow">⚠️  {workspace.graph.riskyEdges.length} risky edge(s)</Text>
        )}
        <MarkdownView content={ascii} scrollOffset={scrollOffset} maxLines={maxContent - headerRows} />
      </Box>
    );
  }

  // Audit file
  if (selectedItem.type === 'audit' && selectedItem.audit) {
    const audit = selectedItem.audit;
    return (
      <Box {...panelBox}>
        <Text bold color="white">{audit.filename}</Text>
        <Text color="gray">{audit.date}</Text>
        <MarkdownView content={audit.body} scrollOffset={scrollOffset} maxLines={maxContent - 2} />
      </Box>
    );
  }

  // Feature doc
  if (selectedItem.type === 'doc' && selectedItem.doc) {
    const doc = selectedItem.doc;
    const statusColor = (STATUS_COLOR[doc.status] ?? 'gray') as any;
    const icon = driftIcon(doc);

    // Count header rows to calculate remaining space for body
    let headerRows = 2; // title + status row
    if (doc.sourceFiles.length > 0) headerRows++;
    if (doc.dependsOn.length > 0) headerRows++;
    if (doc.knownIssues.length > 0) headerRows++;
    if (doc.driftStatus === 'drifted' && doc.driftCommits.length > 0) {
      headerRows += 1 + Math.min(doc.driftCommits.length, 3);
    }

    return (
      <Box {...panelBox}>
        <Text bold color="white">{doc.title || doc.id}</Text>

        <Box>
          <Text color={statusColor} bold>{icon} {doc.status.toUpperCase()}</Text>
          {doc.phase ? <Text color="gray">  phase: {doc.phase}</Text> : null}
          {doc.lastSynced ? <Text color="gray">  synced: {doc.lastSynced}</Text> : null}
        </Box>

        {doc.sourceFiles.length > 0 && (
          <Box>
            <Text color="gray">SOURCE  </Text>
            <Text color="cyan">{doc.sourceFiles.slice(0, 3).join('  ')}</Text>
          </Box>
        )}

        {doc.dependsOn.length > 0 && (
          <Box>
            <Text color="gray">DEPENDS ON  </Text>
            <Text color="yellow">{doc.dependsOn.join('  ')}</Text>
          </Box>
        )}

        {doc.knownIssues.length > 0 && (
          <Box>
            <Text color="red">⚠  {doc.knownIssues.length} known issue{doc.knownIssues.length !== 1 ? 's' : ''}</Text>
          </Box>
        )}

        {doc.driftStatus === 'drifted' && doc.driftCommits.length > 0 && (
          <Box flexDirection="column">
            <Text color="yellow">⚠️  Drifted — commits since last sync:</Text>
            {doc.driftCommits.slice(0, 3).map((c, i) => (
              <Text key={i} color="gray">  {c}</Text>
            ))}
          </Box>
        )}

        <MarkdownView content={doc.body} scrollOffset={scrollOffset} maxLines={maxContent - headerRows} />
      </Box>
    );
  }

  return null;
});
