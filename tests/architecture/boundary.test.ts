import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// src/sim is pure, deterministic TypeScript (docs/plan/00-master.md §2.2–2.3). The tooling
// enforces it; these tests prove each barrier rejects the fixtures in tests/architecture/,
// so a wrong glob cannot silently switch a barrier off.

const run = (bin: string, args: string[]): { status: number | null; output: string } => {
  const result = spawnSync(`node_modules/.bin/${bin}`, args, { encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
};

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
    expect(output).toContain("'../../src/render/BootScene' import is restricted");
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
});
