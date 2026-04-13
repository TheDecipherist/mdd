import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  content: string;
  scrollOffset: number;
  maxLines: number;
}

// Lightweight terminal markdown renderer — no external deps
function renderLine(line: string): React.ReactNode {
  if (/^#{1} /.test(line)) {
    return <Text bold color="white">{line.replace(/^# /, '')}</Text>;
  }
  if (/^#{2} /.test(line)) {
    return <Text bold color="cyan">{line.replace(/^## /, '')}</Text>;
  }
  if (/^#{3} /.test(line)) {
    return <Text bold color="yellow">{line.replace(/^### /, '')}</Text>;
  }
  if (/^\s*```/.test(line)) {
    return <Text color="gray">{line}</Text>;
  }
  if (/^\s*\|/.test(line)) {
    // Table row — render as-is in dim
    return <Text color="gray">{line}</Text>;
  }
  if (/^\s*[-*] /.test(line)) {
    return <Text color="white">  {line.replace(/^\s*[-*] /, '• ')}</Text>;
  }
  if (/^\s*\d+\. /.test(line)) {
    return <Text color="white">  {line}</Text>;
  }
  if (line.trim() === '') {
    return <Text> </Text>;
  }
  // Inline code `backticks` — strip backtick markers, show in cyan
  const stripped = line.replace(/`([^`]+)`/g, '$1');
  return <Text color="white">{stripped}</Text>;
}

export function MarkdownView({ content, scrollOffset, maxLines }: Props) {
  const lines = content.split('\n');
  const visible = lines.slice(scrollOffset, scrollOffset + maxLines);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((line, i) => (
        <Box key={i}>
          {renderLine(line)}
        </Box>
      ))}
    </Box>
  );
}
