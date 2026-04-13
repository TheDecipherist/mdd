import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { DocItem } from './DocItem.js';
import type { MddWorkspace, MddDoc, AuditFile } from '../types/index.js';
import { renderGraphAscii } from '../reader/graph.js';

export type LeftPanelSection = 'docs' | 'audits' | 'graph';

export interface LeftPanelItem {
  type: 'doc' | 'audit' | 'graph';
  doc?: MddDoc;
  audit?: AuditFile;
}

interface Props {
  workspace: MddWorkspace;
  selectedIndex: number;
  focused: boolean;
}

export function buildLeftItems(workspace: MddWorkspace): LeftPanelItem[] {
  return [
    ...workspace.docs.map(doc => ({ type: 'doc' as const, doc })),
    ...workspace.audits.map(audit => ({ type: 'audit' as const, audit })),
    { type: 'graph' as const },
  ];
}

const AUDIT_TYPE_LABEL: Record<string, string> = {
  'audit-report': 'AUDIT',
  scan: 'SCAN',
  flow: 'FLOW',
  notes: 'NOTES',
  results: 'RESULTS',
  graph: 'GRAPH',
  other: 'REPORT',
};

export const LeftPanel = memo(function LeftPanel({ workspace, selectedIndex, focused }: Props) {
  const items = buildLeftItems(workspace);
  const activeDocs = workspace.docs.filter(d => !d.archived);
  const archivedDocs = workspace.docs.filter(d => d.archived);

  let docHeaderShown = false;
  let auditHeaderShown = false;
  let graphHeaderShown = false;

  return (
    <Box
      flexDirection="column"
      width={32}
      flexShrink={0}
      borderStyle="single"
      borderColor={focused ? 'cyan' : 'gray'}
    >
      {items.map((item, i) => {
        const isSelected = i === selectedIndex;

        if (item.type === 'doc' && item.doc) {
          const showHeader = !docHeaderShown;
          if (showHeader) docHeaderShown = true;
          return (
            <React.Fragment key={`doc-${item.doc.filename}`}>
              {showHeader && (
                <Box paddingX={1} paddingTop={1}>
                  <Text color="cyan" bold>FEATURE DOCS </Text>
                  <Text color="gray">{activeDocs.length}</Text>
                </Box>
              )}
              <DocItem doc={item.doc} isSelected={isSelected} />
              {item.doc.archived && archivedDocs.indexOf(item.doc) === 0 && (
                <Box paddingX={1} marginTop={1}>
                  <Text color="gray" dimColor>── archived ──</Text>
                </Box>
              )}
            </React.Fragment>
          );
        }

        if (item.type === 'audit' && item.audit) {
          const showHeader = !auditHeaderShown;
          if (showHeader) auditHeaderShown = true;
          const label = AUDIT_TYPE_LABEL[item.audit.type] ?? 'REPORT';
          return (
            <React.Fragment key={`audit-${item.audit.filename}`}>
              {showHeader && (
                <Box paddingX={1} paddingTop={1}>
                  <Text color="cyan" bold>AUDIT REPORTS </Text>
                  <Text color="gray">{workspace.audits.length}</Text>
                </Box>
              )}
              <Box paddingX={1}>
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {label.padEnd(8)}
                </Text>
                <Text color="gray"> {item.audit.date}</Text>
              </Box>
            </React.Fragment>
          );
        }

        if (item.type === 'graph') {
          if (!graphHeaderShown) graphHeaderShown = true;
          return (
            <Box key="graph" paddingX={1} paddingTop={1}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                DEP GRAPH ▸
              </Text>
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
});
