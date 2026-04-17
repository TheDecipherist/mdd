import { describe, it, expect } from 'vitest';
import type { Initiative, Wave, MddWorkspace } from '../types/index.js';
import { buildInitiativeContent, buildWaveContent, buildStatusBar, renderMarkdown } from './content.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const WAVE_FIXTURE: Wave = {
  filename: 'auth-system-wave-1.md',
  id: 'auth-system-wave-1',
  title: 'Wave 1: Auth Foundation',
  initiative: 'auth-system',
  initiativeVersion: 1,
  status: 'active',
  dependsOn: null,
  demoState: 'User signs up and logs in.',
  created: '2026-04-16',
  hash: 'def456',
  features: [
    { number: 1, slug: 'auth-signup', docPath: null, waveStatus: 'planned', dependsOn: [] },
    { number: 2, slug: 'auth-login', docPath: 'docs/02-auth-login.md', waveStatus: 'active', dependsOn: ['auth-signup'] },
  ],
  openResearch: ['Which JWT library to use?'],
};

const INITIATIVE_FIXTURE: Initiative = {
  filename: 'auth-system.md',
  id: 'auth-system',
  title: 'Auth System',
  status: 'active',
  version: 1,
  hash: 'abc123',
  created: '2026-04-16',
  overview: 'Handles user authentication and session management.',
  openProductQuestions: ['- [x] Auth model? → JWT', '- [ ] Session storage?'],
  waves: [WAVE_FIXTURE],
};

const WORKSPACE_FIXTURE: MddWorkspace = {
  docs: [],
  audits: [],
  startupContent: null,
  graph: { nodes: [], brokenEdges: [], riskyEdges: [], orphans: [] },
  scan: { inSync: 0, drifted: 0, broken: 0, untracked: 0 },
  issuesTotal: 0,
  gitAvailable: true,
  initiatives: [INITIATIVE_FIXTURE],
};

const EMPTY_WORKSPACE: MddWorkspace = {
  ...WORKSPACE_FIXTURE,
  initiatives: [],
};

// ── renderMarkdown — wide emoji normalisation ─────────────────────────────────

describe('renderMarkdown — wide emoji normalisation', () => {
  it('should replace ✅ ⚠️ ❌ ❓ with single-column equivalents', () => {
    const input = '| ✅ | good |\n| ⚠️ | warn |\n| ❌ | bad |\n| ❓ | unknown |';
    const result = renderMarkdown(input);
    // Wide emoji must not appear in the output
    expect(result).not.toContain('✅');
    expect(result).not.toContain('⚠️');
    expect(result).not.toContain('❌');
    expect(result).not.toContain('❓');
    // Single-column replacements must be present
    expect(result).toContain('✓');
    expect(result).toContain('!');
    expect(result).toContain('✗');
    expect(result).toContain('?');
  });

  it('should normalise wide emoji in plain prose too', () => {
    const result = renderMarkdown('Status: ✅ done');
    expect(result).not.toContain('✅');
    expect(result).toContain('✓');
  });

  it('should strip the variation selector from 🗄️ so table widths stay correct', () => {
    // 🗄️ = U+1F5C4 + U+FE0F — the VS16 variation selector must not remain
    const input = '| Icon | Meaning |\n|------|--------|\n| 🗄️ dim | Deprecated |';
    const result = renderMarkdown(input);
    // The variation selector (U+FE0F) must not appear in output
    expect(result).not.toContain('\uFE0F');
    expect(result).toContain('~ dim');
  });
});

// ── buildInitiativeContent ─────────────────────────────────────────────────────

describe('buildInitiativeContent', () => {
  it('should display the initiative title and status', () => {
    // Act
    const result = buildInitiativeContent(INITIATIVE_FIXTURE);

    // Assert
    expect(result).toContain('Auth System');
    expect(result).toContain('active');
  });

  it('should display wave count and progress', () => {
    // Act
    const result = buildInitiativeContent(INITIATIVE_FIXTURE);

    // Assert — "1 wave" visible, wave title shown
    expect(result).toContain('Wave 1');
    expect(result).toContain('Auth Foundation');
  });

  it('should highlight unchecked product questions in red', () => {
    // Act
    const result = buildInitiativeContent(INITIATIVE_FIXTURE);

    // Assert — unchecked question highlighted, checked one not
    expect(result).toContain('Session storage');
    expect(result).toContain('red-fg');
  });

  it('should show overview text', () => {
    // Act
    const result = buildInitiativeContent(INITIATIVE_FIXTURE);

    // Assert
    expect(result).toContain('Handles user authentication');
  });
});

// ── buildWaveContent ───────────────────────────────────────────────────────────

describe('buildWaveContent', () => {
  it('should display the wave title and demo state', () => {
    // Act
    const result = buildWaveContent(WAVE_FIXTURE);

    // Assert
    expect(result).toContain('Wave 1: Auth Foundation');
    expect(result).toContain('User signs up and logs in.');
  });

  it('should display each feature with its status', () => {
    // Act
    const result = buildWaveContent(WAVE_FIXTURE);

    // Assert
    expect(result).toContain('auth-signup');
    expect(result).toContain('auth-login');
    expect(result).toContain('planned');
    expect(result).toContain('active');
  });

  it('should show feature progress fraction', () => {
    // Arrange — 0 of 2 features complete
    const result = buildWaveContent(WAVE_FIXTURE);

    // Assert
    expect(result).toMatch(/0.*\/.*2|0 of 2/);
  });

  it('should show open research items', () => {
    // Act
    const result = buildWaveContent(WAVE_FIXTURE);

    // Assert
    expect(result).toContain('Which JWT library');
  });

  it('should suggest next action for active wave', () => {
    // Act
    const result = buildWaveContent(WAVE_FIXTURE);

    // Assert — next action hint visible
    expect(result).toContain('plan-execute');
    expect(result).toContain('auth-system-wave-1');
  });
});

// ── buildStatusBar — initiatives segment ──────────────────────────────────────

describe('buildStatusBar — initiatives', () => {
  it('should include initiative count when initiatives exist', () => {
    // Act
    const result = buildStatusBar(WORKSPACE_FIXTURE);

    // Assert
    expect(result).toContain('INITIATIVES');
    expect(result).toContain('1');
  });

  it('should show active wave count in status bar', () => {
    // Act
    const result = buildStatusBar(WORKSPACE_FIXTURE);

    // Assert — 1 active wave visible
    expect(result).toContain('WAVES');
  });

  it('should show "No active initiatives" when none exist', () => {
    // Act
    const result = buildStatusBar(EMPTY_WORKSPACE);

    // Assert
    expect(result).toContain('No active initiatives');
  });

  it('should not show initiative segment when initiatives array is absent', () => {
    // Arrange — workspace without initiatives field (backward compat)
    const legacyWs = { ...WORKSPACE_FIXTURE, initiatives: undefined } as unknown as MddWorkspace;

    // Act
    const result = buildStatusBar(legacyWs);

    // Assert — no crash, no initiative segment
    expect(result).not.toContain('INITIATIVES');
  });
});
