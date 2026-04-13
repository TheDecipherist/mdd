import React from 'react';
import { Box, Text } from 'ink';
import type { MddWorkspace } from '../types/index.js';

interface Props {
  workspace: MddWorkspace;
}

export function StatusBar({ workspace }: Props) {
  const { docs, audits, scan, issuesTotal, gitAvailable } = workspace;
  const activeDocs = docs.filter(d => !d.archived);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexShrink={0}>
      <Stat label="DOCS" value={activeDocs.length} color="white" />
      <Sep />
      <Stat label="IN SYNC" value={scan.inSync} color="green" />
      <Sep />
      <Stat label="DRIFTED" value={scan.drifted} color={scan.drifted > 0 ? 'yellow' : 'gray'} />
      <Sep />
      <Stat label="BROKEN" value={scan.broken} color={scan.broken > 0 ? 'red' : 'gray'} />
      <Sep />
      <Stat label="UNTRACKED" value={scan.untracked} color={scan.untracked > 0 ? 'yellow' : 'gray'} />
      <Sep />
      <Stat label="ISSUES" value={issuesTotal} color={issuesTotal > 0 ? 'yellow' : 'gray'} />
      <Sep />
      <Stat label="AUDITS" value={audits.length} color="cyan" />
      {!gitAvailable && (
        <>
          <Sep />
          <Text color="red"> NO GIT</Text>
        </>
      )}
      <Box flexGrow={1} />
      <Text color="gray"> ↑↓ navigate  ← back  r refresh  q quit</Text>
    </Box>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Text color="gray">{label} </Text>
      <Text color={color as any} bold={value > 0}>{value}</Text>
    </Box>
  );
}

function Sep() {
  return <Text color="gray">  │  </Text>;
}
