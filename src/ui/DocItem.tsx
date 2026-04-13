import React, { memo } from 'react';
import { Box, Text } from 'ink';
import type { MddDoc } from '../types/index.js';

interface Props {
  doc: MddDoc;
  isSelected: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  complete: 'COMPLETE',
  in_progress: 'WIP',
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
    case 'drifted': return '⚠️ ';
    case 'broken': return '❌';
    case 'untracked': return '❓';
  }
}

export const DocItem = memo(function DocItem({ doc, isSelected }: Props) {
  const icon = driftIcon(doc);
  const badgeColor = (STATUS_COLOR[doc.status] ?? 'gray') as any;
  const dim = doc.archived || doc.status === 'deprecated';
  const badge = STATUS_BADGE[doc.status] ?? doc.status.toUpperCase();

  return (
    <Box paddingX={1}>
      <Text
        color={isSelected ? 'cyan' : dim ? 'gray' : 'white'}
        bold={isSelected}
        dimColor={dim && !isSelected}
      >
        {icon} {doc.id}{isSelected ? ` ${badge}` : ''}
      </Text>
    </Box>
  );
});
