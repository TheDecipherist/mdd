import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { AuditFile } from '../types/index.js';

const TYPE_PATTERNS: Array<{ pattern: RegExp; type: AuditFile['type'] }> = [
  { pattern: /^report-/, type: 'audit-report' },
  { pattern: /^scan-/, type: 'scan' },
  { pattern: /^flow-/, type: 'flow' },
  { pattern: /^notes-/, type: 'notes' },
  { pattern: /^results-/, type: 'results' },
  { pattern: /^graph-/, type: 'graph' },
];

export function readAudits(mddDir: string): AuditFile[] {
  const auditsDir = join(mddDir, 'audits');
  if (!existsSync(auditsDir)) return [];

  return readdirSync(auditsDir)
    .filter((f: string) => f.endsWith('.md') && !f.startsWith('.'))
    .sort()
    .reverse() // newest first
    .map((filename: string) => {
      const body = readFileSync(join(auditsDir, filename), 'utf-8');
      const date = extractDate(filename);
      const type = classifyType(filename);
      return { filename, date, type, body };
    });
}

function extractDate(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function classifyType(filename: string): AuditFile['type'] {
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(filename)) return type;
  }
  return 'other';
}
