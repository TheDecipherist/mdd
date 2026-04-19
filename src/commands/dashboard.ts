import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readDocs } from '../reader/docs.js';
import { readAudits } from '../reader/audits.js';
import { readOps } from '../reader/ops.js';
import { readInitiatives } from '../reader/initiatives.js';
import { checkGitAvailable, runDriftScan, buildScanSummary } from '../reader/scan.js';
import { buildDependencyGraph } from '../reader/graph.js';
import type { MddWorkspace } from '../types/index.js';

export async function loadWorkspace(mddDir: string): Promise<MddWorkspace> {
  const gitAvailable = checkGitAvailable();

  let docs = readDocs(mddDir);
  const audits = readAudits(mddDir);

  docs = runDriftScan(docs, gitAvailable);

  const scan = buildScanSummary(docs);
  const graph = buildDependencyGraph(docs);
  const issuesTotal = docs.reduce((sum, d) => sum + d.knownIssues.length, 0);

  const startupPath = join(mddDir, '.startup.md');
  const startupContent = existsSync(startupPath)
    ? readFileSync(startupPath, 'utf-8')
    : null;

  const initiatives = readInitiatives(mddDir);
  const ops = readOps(mddDir);

  return { docs, audits, ops, startupContent, graph, scan, issuesTotal, gitAvailable, initiatives };
}

export function findMddDir(cwd: string): string | null {
  const candidate = join(cwd, '.mdd');
  return existsSync(candidate) ? candidate : null;
}
