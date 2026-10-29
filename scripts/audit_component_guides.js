#!/usr/bin/env node

/**
 * audit_component_guides.js
 *
 * Validates src/data/component-guides.json against real SDK surfaces so
 * hand/AI-authored guide content cannot drift into fabrication. Three checks
 * per guide:
 *
 *   1. requiredPackages — every @orderly.network/* package must exist in the
 *      package surface index.
 *   2. code imports — every named import from an @orderly.network/* package
 *      must appear in that package's real export list.
 *   3. keyHooks — every hook should exist in the symbol index (warning only:
 *      keepSymbol drops undocumented hooks).
 *
 * Surface data source (offline, no network):
 *   SDK_DOCS_LOCAL_ROOT=<js-sdk checkout>  → <root>/packages/sdk-docs/bundled/indexes/package-index.json
 * Falls back to a sibling `../js-sdk` checkout when the env var is unset.
 * Without any local checkout, checks 1–2 are skipped with a notice.
 *
 * Usage:
 *   node scripts/audit_component_guides.js [--json]
 *
 * Exit codes: 0 = no errors (warnings allowed), 1 = at least one error.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const GUIDES_FILE = path.join(projectRoot, 'src', 'data', 'component-guides.json');
const SYMBOLS_FILE = path.join(projectRoot, 'src', 'data', 'sdk-symbols.json');

const LEGACY_PACKAGES = [
  '@orderly.network/react',
  '@orderly.network/react-hooks',
  '@orderly.network/sdk',
];

const INVALID_SYMBOLS = [/\bBTC[-/]PERP\b/, /\bETH[-/]PERP\b/, /\bBTC\/USD\b/, /\bETH\/USD\b/];

// Page-level exports are real but omitted from the local sdk-docs package index.
const EXTRA_EXPORTS = {
  '@orderly.network/trading': ['TradingPage', 'OrderBookWidget', 'OrderBookAndTradesWidget'],
};

function resolvePackageIndex() {
  const candidates = [];
  if (process.env.SDK_DOCS_LOCAL_ROOT) {
    candidates.push(path.join(process.env.SDK_DOCS_LOCAL_ROOT, 'packages', 'sdk-docs', 'bundled'));
  }
  candidates.push(path.join(projectRoot, '..', 'js-sdk', 'packages', 'sdk-docs', 'bundled'));
  for (const dir of candidates) {
    const p = path.join(dir, 'indexes', 'package-index.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return null;
}

/** Extract `import { A, B } from 'pkg'` / `import X from 'pkg'` specifiers. */
function extractImports(code) {
  const out = [];
  const re = /import\s+(?:type\s+)?([\w*{},\s$]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const clause = m[1].trim();
    const spec = m[2];
    const named = [];
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim();
        if (name) named.push(name);
      }
    }
    out.push({ specifier: spec, names: named });
  }
  return out;
}

function main() {
  const guides = JSON.parse(fs.readFileSync(GUIDES_FILE, 'utf8')).components;
  const symbols = JSON.parse(fs.readFileSync(SYMBOLS_FILE, 'utf8')).symbols;
  const pkgIndex = resolvePackageIndex();

  if (!pkgIndex) {
    process.stderr.write(
      '[audit] no package-index.json found — set SDK_DOCS_LOCAL_ROOT to a js-sdk checkout.\n' +
        '[audit] running limited checks (keyHooks only).\n'
    );
  }

  const hookNames = new Set(symbols.filter((s) => s.kind === 'hook').map((s) => s.name));

  const errors = [];
  const warnings = [];

  for (const guide of guides) {
    const ref = `${guide.name}`;

    // 1. requiredPackages exist and are not legacy aliases
    for (const pkg of guide.requiredPackages || []) {
      if (LEGACY_PACKAGES.includes(pkg)) {
        errors.push({ guide: ref, kind: 'legacy-package', detail: pkg });
      } else if (pkgIndex && pkg.startsWith('@orderly.network/') && !pkgIndex[pkg]) {
        errors.push({ guide: ref, kind: 'unknown-package', detail: pkg });
      }
    }

    for (const variant of guide.variants || []) {
      // 2. additionalImports must not reference legacy packages
      for (const line of variant.additionalImports || []) {
        for (const pkg of LEGACY_PACKAGES) {
          if (line.includes(pkg)) {
            errors.push({
              guide: ref,
              kind: 'legacy-package',
              detail: `${pkg} in additionalImports`,
              complexity: variant.complexity,
            });
          }
        }
      }

      // 3. code must use real Orderly symbol formats
      for (const pattern of INVALID_SYMBOLS) {
        if (pattern.test(variant.code || '')) {
          errors.push({
            guide: ref,
            kind: 'invalid-symbol',
            detail: `matches ${pattern}`,
            complexity: variant.complexity,
          });
        }
      }

      if (!pkgIndex) continue;

      // 4. named imports from Orderly packages must be real exports
      for (const imp of extractImports(variant.code || '')) {
        if (LEGACY_PACKAGES.includes(imp.specifier)) {
          errors.push({
            guide: ref,
            kind: 'legacy-package',
            detail: imp.specifier,
            complexity: variant.complexity,
          });
          continue;
        }
        if (!imp.specifier.startsWith('@orderly.network/')) continue;
        if (!pkgIndex[imp.specifier]) {
          errors.push({
            guide: ref,
            kind: 'unknown-package-import',
            detail: imp.specifier,
          });
          continue;
        }
        const exports = [
          ...(pkgIndex[imp.specifier].exports || []),
          ...(EXTRA_EXPORTS[imp.specifier] || []),
        ];
        for (const name of imp.names) {
          if (!exports.includes(name)) {
            errors.push({
              guide: ref,
              kind: 'unresolved-import',
              detail: `${name} is not exported by ${imp.specifier}`,
              complexity: variant.complexity,
            });
          }
        }
      }
    }

    // 5. keyHooks present in symbol index (soft)
    for (const hook of guide.keyHooks || []) {
      if (!hookNames.has(hook)) {
        warnings.push({ guide: ref, kind: 'hook-not-in-index', detail: hook });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    packageIndexUsed: Boolean(pkgIndex),
    guidesAudited: guides.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  };

  const outFile = path.join(projectRoot, 'component-guides-audit.json');
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

  process.stdout.write(
    `[audit] guides: ${guides.length} | errors: ${errors.length} | warnings: ${warnings.length}\n` +
      `[audit] report -> ${outFile}\n`
  );
  const show = errors.slice(0, 20);
  for (const e of show) {
    process.stdout.write(
      `  ERROR ${e.guide}${e.complexity ? ` (${e.complexity})` : ''}: ${e.kind} — ${e.detail}\n`
    );
  }
  if (errors.length > show.length) {
    process.stdout.write(`  ...and ${errors.length - show.length} more (see report)\n`);
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
