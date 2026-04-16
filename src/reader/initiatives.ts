import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type {
  Initiative,
  InitiativeStatus,
  Wave,
  WaveStatus,
  WaveFeature,
} from '../types/index.js';

// ── Public API ────────────────────────────────────────────────────────────────

export function readInitiatives(mddDir: string): Initiative[] {
  const initiativesDir = join(mddDir, 'initiatives');
  if (!existsSync(initiativesDir)) return [];

  const wavesDir = join(mddDir, 'waves');
  const waves = existsSync(wavesDir) ? readAllWaves(wavesDir) : [];

  const files = readdirSync(initiativesDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  const initiatives: Initiative[] = [];

  for (const filename of files) {
    const initiative = parseInitiativeFile(join(initiativesDir, filename), filename);
    if (!initiative) continue;
    initiative.waves = waves
      .filter(w => w.initiative === initiative.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    initiatives.push(initiative);
  }

  return initiatives.sort((a, b) => a.created.localeCompare(b.created));
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseInitiativeFile(filepath: string, filename: string): Initiative | null {
  try {
    const raw = readFileSync(filepath, 'utf-8');
    const { data, content } = matter(raw);

    // Require at least id or title — skips files with no valid frontmatter
    if (!data.id && !data.title) return null;

    return {
      filename,
      id: String(data.id ?? filename.replace('.md', '')),
      title: String(data.title ?? filename),
      status: (data.status as InitiativeStatus) ?? 'planned',
      version: Number(data.version ?? 1),
      hash: String(data.hash ?? ''),
      created: toDateString(data.created),
      overview: extractSection(content, 'Overview'),
      openProductQuestions: extractCheckboxLines(content),
      waves: [], // populated by readInitiatives after parsing all waves
    };
  } catch {
    return null;
  }
}

function readAllWaves(wavesDir: string): Wave[] {
  const files = readdirSync(wavesDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  const waves: Wave[] = [];
  for (const filename of files) {
    const wave = parseWaveFile(join(wavesDir, filename), filename);
    if (wave) waves.push(wave);
  }
  return waves;
}

function parseWaveFile(filepath: string, filename: string): Wave | null {
  try {
    const raw = readFileSync(filepath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      filename,
      id: String(data.id ?? filename.replace('.md', '')),
      title: String(data.title ?? filename),
      initiative: String(data.initiative ?? ''),
      initiativeVersion: Number(data.initiative_version ?? 1),
      status: (data.status as WaveStatus) ?? 'planned',
      dependsOn: data.depends_on && data.depends_on !== 'none'
        ? String(data.depends_on)
        : null,
      demoState: String(data.demo_state ?? ''),
      created: toDateString(data.created),
      hash: String(data.hash ?? ''),
      features: extractFeatures(content),
      openResearch: extractOpenResearch(content),
    };
  } catch {
    return null;
  }
}

// ── Content extractors ────────────────────────────────────────────────────────

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractCheckboxLines(content: string): string[] {
  const lines = content.split('\n');
  return lines.filter(l => /^\s*-\s+\[[ x]\]/.test(l));
}

function extractOpenResearch(content: string): string[] {
  const section = extractSection(content, 'Open Research');
  if (!section) return [];
  return section
    .split('\n')
    .map(l => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
}

function toDateString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function extractFeatures(content: string): WaveFeature[] {
  const tableRegex = /\|\s*#\s*\|.*\|\s*\n\|[-| ]+\|\s*\n((?:\|.*\|\s*\n?)+)/;
  const match = content.match(tableRegex);
  if (!match) return [];

  const rows = match[1]
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.startsWith('|') && r.endsWith('|'));

  return rows.map(row => {
    const cells = row
      .split('|')
      .map(c => c.trim())
      .filter(Boolean);

    const number = parseInt(cells[0] ?? '0', 10);
    const slug = cells[1] ?? '';
    const docPathRaw = cells[2] ?? '—';
    const statusRaw = cells[3] ?? 'planned';
    const dependsOnRaw = cells[4] ?? '—';

    return {
      number,
      slug,
      docPath: docPathRaw === '—' ? null : docPathRaw,
      waveStatus: (statusRaw as WaveStatus) ?? 'planned',
      dependsOn: dependsOnRaw === '—'
        ? []
        : dependsOnRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
  }).filter(f => f.slug.length > 0);
}
