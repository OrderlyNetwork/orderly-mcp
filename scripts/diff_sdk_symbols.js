#!/usr/bin/env node

/**
 * diff_sdk_symbols.js
 *
 * Compares src/data/sdk-symbols.json against the last committed version and
 * emits a markdown summary of semantic changes for refresh PRs:
 * added symbols, removed symbols, newly deprecated, un-deprecated, and
 * provenance drift (sourceVersion / gitSha).
 *
 * Free of dependencies: reads the old copy via `git show HEAD:<path>`.
 * Exit codes: 0 always (absence of change is a valid outcome); prints
 * "NO_CHANGES" as the sole output line when the working tree matches HEAD,
 * so CI can skip PR creation.
 *
 * Usage: node scripts/diff_sdk_symbols.js
 */

import { execSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const REL_PATH = 'src/data/sdk-symbols.json';
const FILE = path.join(projectRoot, REL_PATH);

function loadOld() {
  try {
    const raw = execSync(`git show HEAD:${REL_PATH}`, {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(raw);
  } catch {
    return null; // no committed version yet
  }
}

const next_ = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const prev = loadOld();

if (!prev) {
  process.stdout.write('Initial generation of sdk-symbols.json.\n');
  process.exit(0);
}

if (JSON.stringify(prev) === JSON.stringify(next_)) {
  process.stdout.write('NO_CHANGES\n');
  process.exit(0);
}

const byId = (data) => new Map(data.symbols.map((s) => [s.id, s]));
const prevById = byId(prev);
const nextById = byId(next_);

const added = [];
const removed = [];
const newlyDeprecated = [];
const unDeprecated = [];

for (const [id, sym] of nextById) {
  const before = prevById.get(id);
  if (!before) {
    added.push(`${sym.name} (${sym.kind}, ${sym.package || '?'})`);
    continue;
  }
  if (!before.record.deprecated && sym.record.deprecated) {
    newlyDeprecated.push(`${sym.name} (${sym.package || '?'})`);
  } else if (before.record.deprecated && !sym.record.deprecated) {
    unDeprecated.push(`${sym.name} (${sym.package || '?'})`);
  }
}
for (const [id, sym] of prevById) {
  if (!nextById.has(id)) removed.push(`${sym.name} (${sym.kind}, ${sym.package || '?'})`);
}

const cap = (arr, n) =>
  arr.length <= n ? arr : [...arr.slice(0, n), `…and ${arr.length - n} more`];

const metaChanged =
  prev.metadata.sourceVersion !== next_.metadata.sourceVersion ||
  prev.metadata.gitSha !== next_.metadata.gitSha;

const lines = [];
lines.push('## sdk-symbols.json diff');
lines.push('');
lines.push('| | before | after |');
lines.push('| --- | --- | --- |');
lines.push(
  `| source | \`${prev.metadata.sourceVersion}\` @ \`${String(prev.metadata.gitSha).slice(0, 10)}\` | \`${next_.metadata.sourceVersion}\` @ \`${String(next_.metadata.gitSha).slice(0, 10)}\` |`
);
lines.push(`| total symbols | ${prev.metadata.totalSymbols} | ${next_.metadata.totalSymbols} |`);
if (prev.metadata.generatedAt !== next_.metadata.generatedAt) {
  lines.push('');
  lines.push(`Generated: \`${prev.metadata.generatedAt}\` → \`${next_.metadata.generatedAt}\``);
}
lines.push('');

const section = (title, items) => {
  if (items.length === 0) return;
  lines.push(`### ${title} (${items.length})`);
  lines.push('');
  for (const line of cap(items, 30)) lines.push(`- ${line}`);
  lines.push('');
};

section('Added', added);
section('Removed', removed);
section('Newly deprecated ⚠️', newlyDeprecated);
section('No longer deprecated', unDeprecated);

if (
  added.length === 0 &&
  removed.length === 0 &&
  newlyDeprecated.length === 0 &&
  unDeprecated.length === 0 &&
  !metaChanged
) {
  process.stdout.write('NO_CHANGES\n');
  process.exit(0);
}

process.stdout.write(lines.join('\n'));
