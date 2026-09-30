#!/usr/bin/env node

/**
 * generate_sdk_symbols.js
 *
 * Free (no AI, no API keys). Pulls the published @orderly.network/sdk-docs npm
 * tarball, extracts the bundled/generated symbol shards that js-sdk's
 * `apps/ai-docs` pipeline produced (hooks / types / components / functions),
 * and flattens them into a Fuse-friendly `src/data/sdk-symbols.json`.
 *
 * The output is indexed alongside documentation.json by the unified
 * search_orderly_docs tool, so type-accurate SDK symbols surface through the
 * single fuzzy search without adding a separate MCP tool per symbol kind.
 *
 * Usage:
 *   node scripts/generate_sdk_symbols.js
 *   SDK_DOCS_VERSION=1.1.6 node scripts/generate_sdk_symbols.js
 *
 * Source: https://www.npmjs.com/package/@orderly.network/sdk-docs (bundled/ dir)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { fileURLToPath } from 'url';
import { execa } from 'execa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'sdk-symbols.json');
const PKG = '@orderly.network/sdk-docs';

/**
 * Fetch a URL and resolve its body as JSON, following redirects.
 */
function fetchJson(url, redirects = 0) {
  if (redirects > 5) throw new Error(`Too many redirects for ${url}`);
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: 'application/json' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return resolve(fetchJson(next, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

/** Resolve which version of the package to pull. */
async function resolveVersion() {
  if (process.env.SDK_DOCS_VERSION) return process.env.SDK_DOCS_VERSION;
  const meta = await fetchJson(`https://registry.npmjs.org/${PKG}/latest`);
  if (!meta.version) throw new Error(`No version in registry metadata for ${PKG}`);
  return meta.version;
}

/** Download only the package tarball (no dependency install) and extract it. */
async function downloadAndExtract(version) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-symbols-'));
  try {
    await execa('npm', ['pack', `${PKG}@${version}`, '--pack-destination', tmpDir], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const tgz = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error('npm pack did not produce a tarball');
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    await execa('tar', ['-xzf', path.join(tmpDir, tgz), '-C', extractDir]);
    return path.join(extractDir, 'package');
  } finally {
    // tmpDir cleaned up by OS; leave for debugging on failure path.
  }
}

const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

const KIND_TO_CATEGORY = {
  hook: 'SDK Hook',
  type: 'SDK Type',
  component: 'SDK Component',
  function: 'SDK Function',
};

/** Split a symbol name into searchable keyword tokens (camelCase aware). */
function splitKeywords(name) {
  return [
    ...(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  ];
}

/** Short, searchable package name, e.g. "@orderly.network/hooks" -> "hooks". */
function packageShort(pkg) {
  if (!pkg) return [];
  const seg = pkg.split('/').pop();
  return seg ? [seg] : [];
}

/** Build the text blob Fuse will search over. Dense with type + doc signal. */
function buildSearchText(rec, kind) {
  const parts = [rec.name];
  if (nonEmpty(rec.jsDoc)) parts.push(rec.jsDoc);

  if (kind === 'hook' || kind === 'function') {
    const params = (rec.params || [])
      .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
      .join(', ');
    const ret = rec.returns?.type || 'void';
    parts.push(`${rec.name}(${params}): ${ret}`);
    for (const p of rec.params || []) {
      if (nonEmpty(p.description)) parts.push(p.description);
    }
  } else if (kind === 'component') {
    const props = (rec.props || [])
      .map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
      .join('; ');
    if (props) parts.push(`Props: ${props}`);
    for (const p of rec.props || []) {
      if (nonEmpty(p.description)) parts.push(`${p.name} — ${p.description}`);
    }
  } else if (kind === 'type') {
    if (nonEmpty(rec.typeText)) parts.push(rec.typeText);
  }
  return parts.filter(nonEmpty).join('\n');
}

/**
 * Decide whether a symbol is worth indexing.
 *
 * - Hooks are always kept: they are the primary plugin API and their param /
 *   return types carry signal even without a docblock.
 * - Other kinds are kept only when documented (jsDoc, or a described prop) so
 *   the index reflects the curated public surface rather than 4k raw symbols.
 */
function keepSymbol(rec, kind) {
  if (kind === 'hook') return true;
  if (nonEmpty(rec.jsDoc)) return true;
  if (kind === 'component' && (rec.props || []).some((p) => nonEmpty(p.description))) return true;
  return false;
}

/** Trim a record to the fields the tool needs for inline display. */
function trimRecord(rec, kind) {
  const base = {
    name: rec.name,
    package: rec.package,
    sourcePath: rec.sourcePath,
    jsDoc: nonEmpty(rec.jsDoc) ? rec.jsDoc : undefined,
  };
  if (rec.deprecated) base.deprecated = true;
  if (kind === 'hook' || kind === 'function') {
    return {
      ...base,
      params: (rec.params || []).map((p) => ({
        name: p.name,
        type: p.type,
        optional: p.optional,
        description: nonEmpty(p.description) ? p.description : undefined,
      })),
      returns: rec.returns?.type ?? undefined,
    };
  }
  if (kind === 'component') {
    return {
      ...base,
      displayName: rec.displayName || rec.name,
      props: (rec.props || []).map((p) => ({
        name: p.name,
        type: p.type,
        required: p.required,
        defaultValue: p.defaultValue ?? undefined,
        description: nonEmpty(p.description) ? p.description : undefined,
      })),
    };
  }
  // type
  return { ...base, typeText: nonEmpty(rec.typeText) ? rec.typeText : undefined };
}

/** Richness score for dedup: prefer records with a docblock, then more detail. */
function richness(rec, kind) {
  let score = nonEmpty(rec.jsDoc) ? 1000 : 0;
  score += buildSearchText(rec, kind).length;
  return score;
}

function flattenShard(shard, kind) {
  const out = [];
  const all = Object.values(shard);
  // The same symbol id can appear several times (exported from multiple entry
  // points). Keep only the richest record per id so the index has no dupes.
  const byId = new Map();
  for (const rec of all) {
    if (!rec || typeof rec !== 'object' || !rec.id || !rec.name) continue;
    if (!keepSymbol(rec, kind)) continue;
    const prev = byId.get(rec.id);
    if (!prev || richness(rec, kind) > richness(prev, kind)) byId.set(rec.id, rec);
  }
  for (const rec of byId.values()) {
    out.push({
      id: rec.id,
      name: rec.name,
      kind,
      category: KIND_TO_CATEGORY[kind] || 'SDK Symbol',
      package: rec.package,
      sourcePath: rec.sourcePath,
      keywords: [rec.name, ...splitKeywords(rec.name), ...packageShort(rec.package)].filter(
        Boolean
      ),
      searchText: buildSearchText(rec, kind),
      record: trimRecord(rec, kind),
    });
  }
  return out;
}

async function main() {
  // SDK_DOCS_LOCAL_ROOT points at a js-sdk checkout and takes precedence over
  // the npm tarball: the published package lags the repo (a deprecation can
  // land on main days before the next release), so local ingestion is the only
  // same-day-fresh path. Requires the bundle from
  // `pnpm --filter @orderly.network/sdk-docs build` (runs sync:bundle).
  const localRoot = process.env.SDK_DOCS_LOCAL_ROOT;
  let pkgRoot;
  let version;
  let source;
  if (localRoot) {
    pkgRoot = path.join(localRoot, 'packages', 'sdk-docs');
    if (!fs.existsSync(path.join(pkgRoot, 'bundled', 'manifest.json'))) {
      throw new Error(
        `No bundled/ manifest under ${pkgRoot} — run \`pnpm --filter @orderly.network/sdk-docs build\` in ${localRoot} first`
      );
    }
    const pkgJsonPath = path.join(pkgRoot, 'package.json');
    version = fs.existsSync(pkgJsonPath)
      ? `${JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version}-local`
      : 'local';
    source = 'local-checkout';
    process.stderr.write(`[sdk-symbols] local checkout: ${pkgRoot}\n`);
  } else {
    version = await resolveVersion();
    source = 'npm-tarball';
    process.stderr.write(`[sdk-symbols] ${PKG}@${version}: downloading tarball...\n`);
    pkgRoot = await downloadAndExtract(version);
  }
  const bundled = path.join(pkgRoot, 'bundled');
  const manifestPath = path.join(bundled, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found at ${manifestPath} — bundled layout changed`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const jsonDir = path.join(bundled, 'json');
  const readShard = (file) => {
    const p = path.join(jsonDir, file);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  };

  const counts = { raw: {}, kept: {} };
  const symbols = [];

  for (const [kind, file] of [
    ['hook', 'hooks.json'],
    ['type', 'types.json'],
    ['component', 'components.json'],
    ['function', 'functions.json'],
  ]) {
    const shard = readShard(file);
    if (!shard) {
      process.stderr.write(`[sdk-symbols] WARNING: ${file} missing, skipping ${kind}\n`);
      continue;
    }
    const raw = Object.keys(shard).length;
    const flat = flattenShard(shard, kind);
    counts.raw[kind] = raw;
    counts.kept[kind] = flat.length;
    symbols.push(...flat);
  }

  const output = {
    metadata: {
      sourcePackage: PKG,
      sourceVersion: version,
      source,
      schemaVersion: manifest.schemaVersion,
      gitSha: manifest.gitSha,
      generatedAt: manifest.generatedAt,
      counts,
      totalSymbols: symbols.length,
    },
    symbols,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);

  const fmt = (o) =>
    Object.entries(o)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
  process.stderr.write(
    `[sdk-symbols] wrote ${OUTPUT_FILE}\n` +
      `  raw:    ${fmt(counts.raw)}\n` +
      `  kept:   ${fmt(counts.kept)}\n` +
      `  total:  ${symbols.length} symbols\n` +
      `  gitSha: ${manifest.gitSha?.slice(0, 10)}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[sdk-symbols] FAILED: ${err.stack || err}\n`);
  process.exit(1);
});
