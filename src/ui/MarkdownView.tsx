import React, { memo, useMemo } from 'react';
import { Box, Text } from 'ink';

interface Props {
  content: string;
  scrollOffset: number;
  maxLines: number;
}

function renderLine(line: string, key: number): React.ReactNode {
  if (/^# /.test(line)) {
    return <Box key={key}><Text bold color="white">{line.slice(2)}</Text></Box>;
  }
  if (/^## /.test(line)) {
    return <Box key={key}><Text bold color="cyan">{line.slice(3)}</Text></Box>;
  }
  if (/^### /.test(line)) {
    return <Box key={key}><Text bold color="yellow">{line.slice(4)}</Text></Box>;
  }
  if (/^\s*```/.test(line)) {
    return <Box key={key}><Text color="gray">{line}</Text></Box>;
  }
  if (/^\s*\|/.test(line)) {
    return <Box key={key}><Text color="gray">{line}</Text></Box>;
  }
  if (/^\s*[-*] /.test(line)) {
    const text = line.replace(/^\s*[-*] /, '• ');
    return <Box key={key}><Text color="white">{text}</Text></Box>;
  }
  if (/^\s*\d+\. /.test(line)) {
    return <Box key={key}><Text color="white">{line}</Text></Box>;
  }
  if (line.trim() === '') {
    return <Box key={key}><Text> </Text></Box>;
  }
  const stripped = line.replace(/`([^`]+)`/g, '$1');
  return <Box key={key}><Text color="white">{stripped}</Text></Box>;
}

export const MarkdownView = memo(function MarkdownView({ content, scrollOffset, maxLines }: Props) {
  const lines = useMemo(() => content.split('\n'), [content]);
  const visible = useMemo(
    () => lines.slice(scrollOffset, scrollOffset + maxLines),
    [lines, scrollOffset, maxLines],
  );

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {visible.map((line, i) => renderLine(line, scrollOffset + i))}
    </Box>
  );
});
