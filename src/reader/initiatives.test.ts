import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readInitiatives } from './initiatives.js';

// ── Test fixtures ──────────────────────────────────────────────────────────────

const INITIATIVE_FIXTURE = `---
id: auth-system
title: Auth System
status: active
version: 1
hash: abc123
created: 2026-04-16
---

# Auth System

## Overview
Handles user authentication and session management.

## Open Product Questions
- [x] Auth model? → JWT
- [ ] Session storage? (JWT vs. cookies)

## Waves
| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/auth-system-wave-1.md | User signs up and logs in | active |
`;

const WAVE_FIXTURE = `---
id: auth-system-wave-1
title: "Wave 1: Auth Foundation"
initiative: auth-system
initiative_version: 1
status: active
depends_on: none
demo_state: "User signs up and logs in."
created: 2026-04-16
hash: def456
---

# Wave 1: Auth Foundation

## Demo-State
User signs up and logs in.

## Features
| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | auth-signup | — | planned | — |
| 2 | auth-login | — | planned | auth-signup |

## Open Research
- Which JWT library to use?
`;

const CANCELLED_INITIATIVE_FIXTURE = `---
id: old-system
title: Old System
status: cancelled
version: 2
hash: xyz789
created: 2026-01-01
---

# Old System

## Overview
Cancelled initiative.

## Open Product Questions

## Waves
`;

// ── Setup / teardown ───────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `mdd-test-${Date.now()}`);
  mkdirSync(join(tmpDir, 'initiatives'), { recursive: true });
  mkdirSync(join(tmpDir, 'waves'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── readInitiatives ────────────────────────────────────────────────────────────

describe('readInitiatives', () => {
  describe('when no initiatives directory exists', () => {
    it('should return an empty array', () => {
      // Arrange
      const emptyDir = join(tmpdir(), `mdd-empty-${Date.now()}`);
      mkdirSync(emptyDir);

      // Act
      const result = readInitiatives(emptyDir);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
      rmSync(emptyDir, { recursive: true });
    });
  });

  describe('when an initiative file exists', () => {
    it('should parse frontmatter fields correctly', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('auth-system');
      expect(result[0].title).toBe('Auth System');
      expect(result[0].status).toBe('active');
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should parse version and hash from frontmatter', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result[0].version).toBe(1);
      expect(result[0].hash).toBe('abc123');
      expect(result[0].created).toBe('2026-04-16');
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should extract open product questions preserving checkbox state', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result[0].openProductQuestions).toHaveLength(2);
      expect(result[0].openProductQuestions[0]).toContain('[x]');
      expect(result[0].openProductQuestions[1]).toContain('[ ]');
      expect.fail('Not implemented — MDD skeleton');
    });
  });

  describe('when a wave file exists for an initiative', () => {
    it('should attach the wave to its parent initiative', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);
      writeFileSync(join(tmpDir, 'waves', 'auth-system-wave-1.md'), WAVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result[0].waves).toHaveLength(1);
      expect(result[0].waves[0].id).toBe('auth-system-wave-1');
      expect(result[0].waves[0].initiative).toBe('auth-system');
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should parse wave features from the feature table', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);
      writeFileSync(join(tmpDir, 'waves', 'auth-system-wave-1.md'), WAVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);
      const wave = result[0].waves[0];

      // Assert
      expect(wave.features).toHaveLength(2);
      expect(wave.features[0].slug).toBe('auth-signup');
      expect(wave.features[1].slug).toBe('auth-login');
      expect(wave.features[1].dependsOn).toContain('auth-signup');
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should parse wave demo state', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);
      writeFileSync(join(tmpDir, 'waves', 'auth-system-wave-1.md'), WAVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result[0].waves[0].demoState).toBe('User signs up and logs in.');
      expect.fail('Not implemented — MDD skeleton');
    });
  });

  describe('when a wave belongs to an unknown initiative', () => {
    it('should not attach orphan waves to any initiative', () => {
      // Arrange — wave with no matching initiative file
      writeFileSync(join(tmpDir, 'waves', 'unknown-wave-1.md'), WAVE_FIXTURE.replace('initiative: auth-system', 'initiative: unknown'));

      // Act
      const result = readInitiatives(tmpDir);

      // Assert — no initiatives returned, orphan wave is silently skipped
      expect(result).toHaveLength(0);
      expect.fail('Not implemented — MDD skeleton');
    });
  });

  describe('when multiple initiatives exist', () => {
    it('should return all initiatives sorted by created date', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);
      writeFileSync(join(tmpDir, 'initiatives', 'old-system.md'), CANCELLED_INITIATIVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map(i => i.id)).toContain('auth-system');
      expect(result.map(i => i.id)).toContain('old-system');
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should include cancelled initiatives in results', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'old-system.md'), CANCELLED_INITIATIVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('cancelled');
      expect.fail('Not implemented — MDD skeleton');
    });
  });

  describe('error handling', () => {
    it('should skip malformed initiative files without throwing', () => {
      // Arrange
      writeFileSync(join(tmpDir, 'initiatives', 'broken.md'), 'not valid frontmatter at all ---');
      writeFileSync(join(tmpDir, 'initiatives', 'auth-system.md'), INITIATIVE_FIXTURE);

      // Act
      const result = readInitiatives(tmpDir);

      // Assert — broken file skipped, valid file returned
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('auth-system');
      expect.fail('Not implemented — MDD skeleton');
    });
  });
});
