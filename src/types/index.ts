export type DriftStatus = 'in-sync' | 'drifted' | 'broken' | 'untracked';
export type WaveStatus = 'planned' | 'active' | 'complete';
export type InitiativeStatus = 'planned' | 'active' | 'complete' | 'cancelled';

export interface WaveFeature {
  number: number;
  slug: string;
  docPath: string | null;    // null if doc not yet created
  waveStatus: WaveStatus;
  dependsOn: string[];       // feature slugs
}

export interface Wave {
  filename: string;
  id: string;
  title: string;
  initiative: string;
  initiativeVersion: number;
  status: WaveStatus;
  dependsOn: string | null;  // wave id or null
  demoState: string;
  created: string;
  hash: string;
  features: WaveFeature[];
  openResearch: string[];
}

export interface Initiative {
  filename: string;
  id: string;
  title: string;
  status: InitiativeStatus;
  version: number;
  hash: string;
  created: string;
  overview: string;
  openProductQuestions: string[];  // raw checkbox lines
  waves: Wave[];
}
export type DocStatus = 'draft' | 'in_progress' | 'complete' | 'deprecated';

export interface MddDoc {
  filename: string;       // e.g. "01-project-scaffolding.md"
  id: string;             // e.g. "01-project-scaffolding"
  title: string;
  status: DocStatus;
  phase: string;
  lastSynced: string | null;   // YYYY-MM-DD or null
  sourceFiles: string[];
  dependsOn: string[];
  knownIssues: string[];
  routes: string[];
  models: string[];
  testFiles: string[];
  body: string;           // raw markdown body (below frontmatter)
  archived: boolean;
  type: 'feature' | 'task';  // optional in frontmatter — absence means 'feature'
  driftStatus: DriftStatus;
  driftCommits: string[]; // recent commit messages since last_synced
}

export interface AuditFile {
  filename: string;
  date: string;           // extracted from filename e.g. "2026-04-13"
  type: 'audit-report' | 'scan' | 'flow' | 'notes' | 'results' | 'graph' | 'other';
  body: string;
}

export interface DependencyNode {
  id: string;
  title: string;
  status: DocStatus;
  dependsOn: string[];    // IDs this node depends on
  dependents: string[];   // IDs that depend on this node
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  brokenEdges: Array<{ from: string; to: string }>;   // depends on deprecated
  riskyEdges: Array<{ from: string; to: string }>;    // complete depends on draft/in_progress
  orphans: string[];      // no edges either direction
}

export interface ScanSummary {
  inSync: number;
  drifted: number;
  broken: number;
  untracked: number;
}

export interface MddWorkspace {
  docs: MddDoc[];
  audits: AuditFile[];
  startupContent: string | null;
  graph: DependencyGraph;
  scan: ScanSummary;
  issuesTotal: number;
  gitAvailable: boolean;
  initiatives: Initiative[];
}
