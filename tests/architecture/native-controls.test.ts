import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The client never relies on the browser's native controls or popups, which look different on
// every device and ignore the theme (docs/plan/00-master.md §2.7). Text fields stay native for
// the on-screen keyboard, but drawn with the theme tokens.
const NATIVE = [
  /<select\b/,
  /<datalist\b/,
  /<input\b[^>]*\btype=["'](?:date|datetime-local|time|month|week|color|range|file)["']/,
  /\b(?:alert|confirm|prompt)\s*\(/,
];

const nativeControls = (source: string): string[] =>
  NATIVE.filter((pattern) => pattern.test(source)).map(String);

const clientFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return clientFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });

describe('no native controls in the client', () => {
  it('the check catches each kind of native control', () => {
    expect(nativeControls('<select value={x}>')).toHaveLength(1);
    expect(nativeControls('<input type="range" />')).toHaveLength(1);
    expect(nativeControls('window.confirm("sure?")')).toHaveLength(1);
    expect(nativeControls('<input type="text" inputMode="numeric" />')).toEqual([]);
  });

  it('src/ui, src/app and src/render use none', () => {
    const found = ['src/ui', 'src/app', 'src/render'].flatMap((dir) =>
      clientFiles(dir).flatMap((file) =>
        nativeControls(readFileSync(file, 'utf8')).map((pattern) => `${file}: ${pattern}`),
      ),
    );
    expect(found).toEqual([]);
  });
});
