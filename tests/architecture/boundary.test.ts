import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// src/sim is pure, deterministic TypeScript (docs/plan/00-master.md §2.2–2.3). The tooling
// enforces it; these tests prove each barrier rejects the fixtures in tests/architecture/,
// so a wrong glob cannot silently switch a barrier off.

const run = (bin: string, args: string[]): { status: number | null; output: string } => {
  const result = spawnSync(`node_modules/.bin/${bin}`, args, { encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
};

// The fixtures live in tests/architecture/, so they only prove the rules. The last two tests prove
// the override really matches src/sim/ (and only src/sim/), using a temporary file there.
const lintTemporaryFile = (path: string, code: string): string => {
  writeFileSync(path, code);
  try {
    return run('oxlint', ['--deny-warnings', path]).output;
  } finally {
    rmSync(path, { force: true });
  }
};
const LEAK = "import { Scene } from 'phaser';\nexport const leaks = [Scene, Math.random()];\n";

describe('sim/ boundary', () => {
  it('sim typecheck rejects browser globals', () => {
    const { status, output } = run('tsc', ['-p', 'tests/architecture/tsconfig.json']);
    expect(status).not.toBe(0);
    expect(output).toContain("Cannot find name 'window'");
    expect(output).toContain("Cannot find name 'localStorage'");
  });

  it('linter rejects Phaser, Node, outer-layer and reference imports', () => {
    const { status, output } = run('oxlint', [
      '--deny-warnings',
      'tests/architecture/sim-imports.ts',
    ]);
    expect(status).not.toBe(0);
    expect(output).toContain("'phaser' import is restricted");
    expect(output).toContain("'node:fs' import is restricted");
    expect(output).toContain("'../../src/render/projection' import is restricted");
    expect(output).toContain("'../../reference/OpenTTD/src/economy' import is restricted");
    expect(output).not.toContain("'../../src/sim/core/constants' import is restricted");
  });

  it('linter rejects browser globals, the clock and Math.random', () => {
    const { status, output } = run('oxlint', [
      '--deny-warnings',
      'tests/architecture/sim-globals.ts',
    ]);
    expect(status).not.toBe(0);
    expect(output).toContain("Unexpected use of 'window'");
    expect(output).toContain("Unexpected use of 'Date'");
    expect(output).toContain("'Math.random' is restricted");
  });

  it('applies the sim rules to files under src/sim/', () => {
    const output = lintTemporaryFile(`src/sim/boundary-probe-${process.pid}.ts`, LEAK);
    expect(output).toContain("'phaser' import is restricted");
    expect(output).toContain("'Math.random' is restricted");
  });

  it('does not apply the sim rules outside src/sim/', () => {
    const output = lintTemporaryFile(`src/render/boundary-probe-${process.pid}.ts`, LEAK);
    expect(output).not.toContain('is restricted');
  });
});

describe('ui/ and render/ boundaries', () => {
  it('linter rejects app, render and Phaser imports from ui/', () => {
    const { status, output } = run('oxlint', [
      '--deny-warnings',
      'tests/architecture/ui-imports.ts',
    ]);
    expect(status).not.toBe(0);
    expect(output).toContain("'phaser' import is restricted");
    expect(output).toContain("'../../src/app/session' import is restricted");
    expect(output).toContain("'../../src/render/projection' import is restricted");
    expect(output).not.toContain("'../../src/ui/i18n/i18n' import is restricted");
  });

  it('linter rejects app and ui imports from render/', () => {
    const { status, output } = run('oxlint', [
      '--deny-warnings',
      'tests/architecture/render-imports.ts',
    ]);
    expect(status).not.toBe(0);
    expect(output).toContain("'../../src/app/session' import is restricted");
    expect(output).toContain("'../../src/ui/session' import is restricted");
    expect(output).not.toContain("'../../src/sim/game' import is restricted");
  });
});
