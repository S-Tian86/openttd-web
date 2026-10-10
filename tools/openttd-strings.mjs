#!/usr/bin/env node
// Measures how many of our UI strings (src/ui/i18n/en.json) can reuse
// OpenTTD's translations. OpenTTD lang files are GPL-2.0-or-later.
// Usage: node tools/openttd-strings.mjs <path-to-OpenTTD-src-lang> [path-to-en.json]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

function fail(message) {
  console.error(`error: ${message}`);
  console.error(
    'usage: node tools/openttd-strings.mjs <path-to-OpenTTD-src-lang> [path-to-en.json]',
  );
  process.exit(1);
}

const normalize = (text) =>
  text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Returns { name, strings: Map<id, rawText> }; skips comments and .case/.gender variants.
function parseLangFile(path) {
  const strings = new Map();
  let name = basename(path, '.txt');
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('##name ')) name = line.slice(7).trim();
    if (line.trim() === '' || line.startsWith('#')) continue;
    const match = /^(STR_[A-Za-z0-9_]+)\s*:(.*)$/.exec(line);
    if (match === null) continue;
    strings.set(match[1], match[2]);
  }
  return { name, strings };
}

const [langDir, enPath = 'src/ui/i18n/en.json'] = process.argv.slice(2);
if (langDir === undefined) fail('missing path to OpenTTD src/lang directory');
if (!existsSync(langDir) || !statSync(langDir).isDirectory()) fail(`not a directory: ${langDir}`);
if (!existsSync(join(langDir, 'english.txt'))) fail(`english.txt not found in ${langDir}`);
if (!existsSync(enPath)) fail(`en.json not found: ${enPath}`);

let ours;
try {
  ours = JSON.parse(readFileSync(enPath, 'utf8'));
} catch (error) {
  fail(`cannot parse ${enPath}: ${error.message}`);
}

const english = parseLangFile(join(langDir, 'english.txt')).strings;
const byText = new Map();
for (const [id, raw] of english) {
  if (id.includes('.')) continue;
  const text = normalize(raw);
  if (text === '') continue;
  if (!byText.has(text)) byText.set(text, []);
  byText.get(text).push(id);
}

const matches = new Map();
for (const [key, value] of Object.entries(ours)) {
  matches.set(key, byText.get(normalize(String(value))) ?? []);
}
const keys = [...matches.keys()];
const matchedKeys = keys.filter((key) => matches.get(key).length > 0);

console.log(`Our keys: ${keys.length}; matched in OpenTTD english.txt: ${matchedKeys.length}\n`);
console.log('Matches (key -> OpenTTD ids):');
for (const key of keys) {
  const ids = matches.get(key);
  console.log(
    `  ${key} (${JSON.stringify(ours[key])}) -> ${ids.length > 0 ? ids.join(', ') : '(no match)'}`,
  );
}

const rows = [];
for (const file of readdirSync(langDir)
  .filter((f) => f.endsWith('.txt') && f !== 'CMakeLists.txt')
  .toSorted()) {
  const { name, strings } = parseLangFile(join(langDir, file));
  let count = 0;
  for (const key of matchedKeys) {
    if (matches.get(key).some((id) => (strings.get(id) ?? '').trim() !== '')) count += 1;
  }
  rows.push({ file: basename(file, '.txt'), name, count });
}
const sortedRows = rows.toSorted((a, b) => b.count - a.count || a.file.localeCompare(b.file));

console.log(`\nCoverage per language (${rows.length} files, of ${keys.length} keys):`);
for (const row of sortedRows) {
  console.log(
    `  ${row.file.padEnd(22)} ${row.name.padEnd(28)} ${String(row.count).padStart(3)}/${keys.length}`,
  );
}
