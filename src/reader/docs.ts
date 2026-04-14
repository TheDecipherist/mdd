import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { MddDoc, DocStatus } from '../types/index.js';

export function readDocs(mddDir: string): MddDoc[] {
  const docsDir = join(mddDir, 'docs');
  if (!existsSync(docsDir)) return [];

  const docs: MddDoc[] = [];

  // Regular docs
  const files = readdirSync(docsDir)
    .filter((f: string) => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  for (const filename of files) {
    const doc = parseDocFile(join(docsDir, filename), filename, false);
    if (doc) docs.push(doc);
  }

  // Archived docs
  const archiveDir = join(docsDir, 'archive');
  if (existsSync(archiveDir)) {
    const archived = readdirSync(archiveDir)
      .filter(f => f.endsWith('.md'))
      .sort();
    for (const filename of archived) {
      const doc = parseDocFile(join(archiveDir, filename), filename, true);
      if (doc) docs.push(doc);
    }
  }

  return docs;
}

function parseDocFile(filepath: string, filename: string, archived: boolean): MddDoc | null {
  try {
    const raw = readFileSync(filepath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      filename,
      id: String(data.id ?? filename.replace('.md', '')),
      title: String(data.title ?? filename),
      status: (data.status as DocStatus) ?? 'draft',
      phase: String(data.phase ?? ''),
      lastSynced: data.last_synced ? String(data.last_synced) : null,
      sourceFiles: toStringArray(data.source_files),
      dependsOn: toStringArray(data.depends_on),
      knownIssues: toStringArray(data.known_issues),
      routes: toStringArray(data.routes),
      models: toStringArray(data.models),
      testFiles: toStringArray(data.test_files),
      body: content.trim(),
      archived,
      driftStatus: 'untracked', // filled in by scan.ts
      driftCommits: [],
    };
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => {
      if (item == null) return '';
      if (typeof item !== 'object') return String(item);
      // YAML parsed an object instead of a string — extract the first key as the ID
      const keys = Object.keys(item as object);
      return keys.length > 0 ? keys[0] : JSON.stringify(item);
    }).filter(Boolean);
  }
  if (typeof value === 'string') return [value].filter(Boolean);
  return [];
}
