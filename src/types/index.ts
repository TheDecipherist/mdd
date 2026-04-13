export type DriftStatus = 'in-sync' | 'drifted' | 'broken' | 'untracked';
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
}
