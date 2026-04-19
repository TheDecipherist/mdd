import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { MddOps, OpsStatus } from '../types/index.js';

export function readOps(mddDir: string): MddOps[] {
  const opsDir = join(mddDir, 'ops');
  if (!existsSync(opsDir)) return [];

  const files = readdirSync(opsDir)
    .filter((f: string) => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  const ops: MddOps[] = [];
  for (const filename of files) {
    const doc = parseOpsFile(join(opsDir, filename), filename);
    if (doc) ops.push(doc);
  }
  return ops;
}

function parseOpsFile(filepath: string, filename: string): MddOps | null {
  try {
    const raw = readFileSync(filepath, 'utf-8');
    const { data, content } = matter(raw);

    const envs = data.environments;
    const environments: string[] = Array.isArray(envs)
      ? envs.map(String)
      : typeof envs === 'string' ? [envs] : [];

    const issues = data.known_issues;
    const knownIssues: string[] = Array.isArray(issues)
      ? issues.filter(Boolean).map(String)
      : [];

    return {
      filename,
      id: String(data.id ?? filename.replace('.md', '')),
      title: String(data.title ?? filename),
      status: (data.status as OpsStatus) ?? 'draft',
      platform: String(data.platform ?? 'manual'),
      environments,
      lastSynced: data.last_synced ? String(data.last_synced) : null,
      knownIssues,
      body: content.trim(),
    };
  } catch {
    return null;
  }
}
