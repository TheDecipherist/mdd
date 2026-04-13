import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { StatusBar } from './StatusBar.js';
import { LeftPanel, buildLeftItems } from './LeftPanel.js';
import { RightPanel } from './RightPanel.js';
import { loadWorkspace } from '../commands/dashboard.js';
import type { MddWorkspace } from '../types/index.js';

interface Props {
  mddDir: string;
}

export function App({ mddDir }: Props) {
  const { stdout } = useStdout();
  const terminalHeight = stdout.rows ?? 40;

  const [workspace, setWorkspace] = useState<MddWorkspace | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [leftFocused, setLeftFocused] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspace(mddDir).then(ws => {
      setWorkspace(ws);
      setLoading(false);
    });
  }, [mddDir]);

  const items = useMemo(
    () => (workspace ? buildLeftItems(workspace) : []),
    [workspace],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    loadWorkspace(mddDir).then(ws => {
      setWorkspace(ws);
      setLoading(false);
    });
  }, [mddDir]);

  useInput(useCallback((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      process.exit(0);
    }

    if (input === 'r') {
      refresh();
      return;
    }

    if (!workspace) return;

    if (leftFocused) {
      if (key.upArrow) {
        setSelectedIndex(i => Math.max(0, i - 1));
        setScrollOffset(0);
      } else if (key.downArrow) {
        setSelectedIndex(i => Math.min(items.length - 1, i + 1));
        setScrollOffset(0);
      } else if (key.rightArrow || key.return) {
        setLeftFocused(false);
        setScrollOffset(0);
      }
    } else {
      if (key.leftArrow) {
        setLeftFocused(true);
        setScrollOffset(0);
      } else if (key.upArrow) {
        setScrollOffset(o => Math.max(0, o - 1));
      } else if (key.downArrow) {
        setScrollOffset(o => o + 1);
      }
    }
  }, [workspace, leftFocused, items.length, refresh]));

  if (loading || !workspace) {
    return (
      <Box>
        <Box marginLeft={1}><Text>{loading ? 'Loading MDD workspace...' : 'Initializing...'}</Text></Box>
      </Box>
    );
  }

  const selectedItem = items[selectedIndex] ?? null;

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <StatusBar workspace={workspace} />
      <Box flexGrow={1}>
        <LeftPanel
          workspace={workspace}
          selectedIndex={selectedIndex}
          focused={leftFocused}
        />
        <RightPanel
          workspace={workspace}
          selectedItem={selectedItem}
          scrollOffset={scrollOffset}
          focused={!leftFocused}
          terminalHeight={terminalHeight}
        />
      </Box>
    </Box>
  );
}
