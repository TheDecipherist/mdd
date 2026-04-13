import React from 'react';
import { Box, Text } from 'ink';
import type { MddDoc } from '../types/index.js';

interface Props {
  doc: MddDoc;
  isSelected: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  complete: 'COMPLETE',
  in_progress: 'IN PROGRESS',
  draft: 'DRAFT',
  deprecated: 'DEPRECATED',
};

const STATUS_COLOR: Record<string, string> = {
  complete: 'green',
  in_progress: 'yellow',
  draft: 'gray',
  deprecated: 'gray',
};

export function driftIcon(doc: MddDoc): string {
  if (doc.archived || doc.status === 'deprecated') return '🗄';
  switch (doc.driftStatus) {
    case 'in-sync': return '✅';
    case 'drifted': return '⚠️';
    case 'broken': return '❌';
    case 'untracked': return '❓';
  }
}

export function DocItem({ doc, isSelected }: Props) {
  const icon = driftIcon(doc);
  const badge = STATUS_BADGE[doc.status] ?? doc.status.toUpperCase();
  const badgeColor = STATUS_COLOR[doc.status] ?? 'gray';
  const dim = doc.archived || doc.status === 'deprecated';

  return (
    <Box paddingX={1}>
      <Text
        color={isSelected ? 'cyan' : dim ? 'gray' : 'white'}
        bold={isSelected}
        dimColor={dim}
      >
        {icon} {doc.id}
      </Text>
      {isSelected && (
        <Box marginLeft={1}>
          <Text color={badgeColor as any}> {badge}</Text>
        </Box>
      )}
    </Box>
  );
}
