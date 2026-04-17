import { execSync } from 'child_process';
import type { MddDoc, DriftStatus, ScanSummary } from '../types/index.js';

export function checkGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function runDriftScan(docs: MddDoc[], gitAvailable: boolean): MddDoc[] {
  if (!gitAvailable) {
    return docs.map(doc => ({ ...doc, driftStatus: 'untracked' as DriftStatus }));
  }

  return docs.map(doc => {
    if (doc.archived || doc.status === 'deprecated' || doc.type === 'task') {
      return { ...doc, driftStatus: 'in-sync' as DriftStatus };
    }
    return { ...doc, ...checkDocDrift(doc) };
  });
}

function checkDocDrift(doc: MddDoc): { driftStatus: DriftStatus; driftCommits: string[] } {
  if (!doc.lastSynced) {
    return { driftStatus: 'untracked', driftCommits: [] };
  }

  const realSources = doc.sourceFiles.filter(f =>
    !f.startsWith('NOTE:') && f.trim().length > 0
  );

  if (realSources.length === 0) {
    return { driftStatus: 'in-sync', driftCommits: [] };
  }

  // Check if any source file is missing
  for (const file of realSources) {
    try {
      execSync(`test -f "${file}"`, { stdio: 'ignore' });
    } catch {
      return { driftStatus: 'broken', driftCommits: [`File not found: ${file}`] };
    }
  }

  // Check git log for commits after last_synced
  const allCommits: string[] = [];
  for (const file of realSources.slice(0, 3)) { // check first 3 files for speed
    try {
      const result = execSync(
        `git log --oneline --after="${doc.lastSynced}" -- "${file}" 2>/dev/null`,
        { encoding: 'utf-8' }
      ).trim();
      if (result) {
        allCommits.push(...result.split('\n').slice(0, 3));
      }
    } catch {
      // git log failed for this file — skip
    }
  }

  if (allCommits.length > 0) {
    return { driftStatus: 'drifted', driftCommits: [...new Set(allCommits)] };
  }

  return { driftStatus: 'in-sync', driftCommits: [] };
}

export function buildScanSummary(docs: MddDoc[]): ScanSummary {
  const active = docs.filter(d => !d.archived && d.type !== 'task');
  return {
    inSync: active.filter(d => d.driftStatus === 'in-sync').length,
    drifted: active.filter(d => d.driftStatus === 'drifted').length,
    broken: active.filter(d => d.driftStatus === 'broken').length,
    untracked: active.filter(d => d.driftStatus === 'untracked').length,
  };
}
