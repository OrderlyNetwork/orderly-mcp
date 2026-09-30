#!/usr/bin/env node

/**
 * fix_component_guides_imports.js
 *
 * Mechanically repairs fabricated import statements in
 * src/data/component-guides.json (see component-guides-audit.json).
 *
 * Conservative rule: a named import that is NOT exported by its stated
 * @orderly.network/* package is re-homed ONLY when exactly one real Orderly
 * package exports that name. Ambiguous (0 or 2+ candidates) and non-Orderly
 * specifiers are left untouched — those stay for human review and are covered
 * by the render-time caveat added in componentGuides.ts.
 *
 * Usage: node scripts/fix_component_guides_imports.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const GUIDES_FILE = path.join(projectRoot, 'src', 'data', 'component-guides.json');
const DRY_RUN = process.argv.includes('--dry-run');

function resolvePackageIndex() {
  const candidates = [];
  if (process.env.SDK_DOCS_LOCAL_ROOT) {
    candidates.push(
      path.join(process.env.SDK_DOCS_LOCAL_ROOT, 'packages', 'sdk-docs', 'bundled')
    );
  }
  candidates.push(path.join(projectRoot, '..', 'js-sdk', 'packages', 'sdk-docs', 'bundled'));
  for (const dir of candidates) {
    const p = path.join(dir, 'indexes', 'package-index.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error('package-index.json not found — set SDK_DOCS_LOCAL_ROOT');
}

// name -> packages exporting it (built once)
function buildExportLookup(pkgIndex) {
  const lookup = new Map();
  for (const [pkg, surface] of Object.entries(pkgIndex)) {
    for (const name of surface.exports || []) {
      if (!lookup.has(name)) lookup.set(name, []);
      lookup.get(name).push(pkg);
    }
  }
  return lookup;
}

const IMPORT_RE = /import\s+(?:type\s+)?([\w*{},\s$]+?)\s+from\s+['"]([^'"]+)['"];?/g;

/** Rewrite one code block; returns { code, moved, unresolved } */
function fixCode(code, pkgIndex, exportLookup) {
  const moved = [];
  const unresolved = [];
  const statements = [...code.matchAll(IMPORT_RE)];

  if (statements.length === 0) return { code, moved, unresolved };

  // names to add per target package, and names kept per original specifier
  const additions = new Map(); // pkg -> Set<name>
  const keptBySpecifier = new Map(); // specifier -> Set<name> | null(null=drop)

  for (const stmt of statements) {
    const [full, clause, spec] = stmt;
    if (!spec.startsWith('@orderly.network/')) continue;
    const realExports = pkgIndex[spec]?.exports || [];
    const braces = clause.match(/\{([^}]*)\}/);
    if (!braces) continue; // default/namespace import — leave alone

    const parts = braces[1].split(',');
    const kept = [];
    for (const part of parts) {
      const raw = part.trim();
      if (!raw) continue;
      const name = raw.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (realExports.includes(name)) {
        kept.push(raw);
        continue;
      }
      const candidates = exportLookup.get(name) || [];
      if (candidates.length === 1) {
        const target = candidates[0];
        if (!additions.has(target)) additions.set(target, new Set());
        additions.get(target).add(name);
        moved.push(`${name}: ${spec} -> ${target}`);
      } else {
        kept.push(raw); // ambiguous/unknown — keep as-is, still flagged by audit
        unresolved.push(`${name} from ${spec} (${candidates.length} candidates)`);
      }
    }

    if (kept.length === 0) {
      keptBySpecifier.set(spec, null); // drop entire statement
    } else {
      keptBySpecifier.set(spec, new Set(kept));
    }
  }

  if (additions.size === 0 && !([...keptBySpecifier.values()].includes(null))) {
    return { code, moved, unresolved };
  }

  let out = code.replace(IMPORT_RE, (full, clause, spec) => {
    if (!spec.startsWith('@orderly.network/')) return full;
    if (!keptBySpecifier.has(spec)) return full;
    const kept = keptBySpecifier.get(spec);
    if (kept === null) return ''; // drop statement
    const braces = clause.match(/\{([^}]*)\}/);
    const sorted = [...kept].sort().join(', ');
    return `import { ${sorted} } from '${spec}';`;
  });

  // collapse blank runs left by dropped statements
  out = out.replace(/\n{3,}/g, '\n\n');

  if (additions.size > 0) {
    const newImports = [...additions.entries()]
      .map(([pkg, names]) => `import { ${[...names].sort().join(', ')} } from '${pkg}';`)
      .join('\n');
    // insert after the last import statement
    let lastEnd = -1;
    for (const m of out.matchAll(IMPORT_RE)) lastEnd = m.index + m[0].length;
    if (lastEnd >= 0) {
      out = out.slice(0, lastEnd) + '\n' + newImports + out.slice(lastEnd);
    } else {
      out = newImports + '\n\n' + out;
    }
  }

  return { code: out, moved, unresolved };
}

function main() {
  const pkgIndex = resolvePackageIndex();
  const exportLookup = buildExportLookup(pkgIndex);
  const data = JSON.parse(fs.readFileSync(GUIDES_FILE, 'utf8'));

  let totalMoved = 0;
  let totalUnresolved = 0;

  for (const guide of data.components) {
    for (const variant of guide.variants || []) {
      if (variant.additionalImports) {
        // additionalImports are standalone lines; run the same fixer over them
        const joined = variant.additionalImports.join('\n');
        const res = fixCode(joined, pkgIndex, exportLookup);
        if (res.moved.length > 0 || res.unresolved.length > 0) {
          totalMoved += res.moved.length;
          totalUnresolved += res.unresolved.length;
          variant.additionalImports = res.code.split('\n').filter(Boolean);
        }
      }
      if (variant.code) {
        const res = fixCode(variant.code, pkgIndex, exportLookup);
        if (res.moved.length > 0 || res.unresolved.length > 0) {
          totalMoved += res.moved.length;
          totalUnresolved += res.unresolved.length;
          variant.code = res.code;
        }
      }
    }
  }

  process.stdout.write(
    `[fix] re-homed ${totalMoved} import(s); left ${totalUnresolved} ambiguous/unknown as-is\n`
  );
  if (!DRY_RUN) {
    fs.writeFileSync(GUIDES_FILE, `${JSON.stringify(data, null, 2)}\n`);
    process.stdout.write(`[fix] wrote ${GUIDES_FILE}\n`);
  } else {
    process.stdout.write('[fix] dry run — nothing written\n');
  }
}

main();
