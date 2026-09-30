import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sdkSymbolsData from '../data/sdk-symbols.json' with { type: 'json' };

interface SymbolParam {
  name: string;
  type: string;
  optional?: boolean;
}

interface SymbolRecord {
  name: string;
  package?: string;
  sourcePath?: string;
  deprecated?: boolean;
  params?: SymbolParam[];
}

interface SymbolEntry {
  id: string;
  name: string;
  kind: string;
  sourcePath: string;
  record: SymbolRecord;
}

interface SdkSymbolsData {
  metadata: {
    sourcePackage: string;
    sourceVersion: string;
    source?: string;
    gitSha: string;
    generatedAt: string;
    totalSymbols: number;
  };
  symbols: SymbolEntry[];
}

const data = sdkSymbolsData as SdkSymbolsData;
const DATA_FILE = fileURLToPath(new URL('../data/sdk-symbols.json', import.meta.url));

// Guard against silent data rot: the generated symbol index must stay fresh,
// match the live public SDK surface on sentinel symbols, and contain no
// ambiguous duplicate ids. These tests fail when the ingestion pipeline needs
// to be re-run.

describe('sdk-symbols data integrity', () => {
  it('has complete provenance metadata', () => {
    expect(data.metadata.sourcePackage).toBe('@orderly.network/sdk-docs');
    expect(data.metadata.sourceVersion).toBeTruthy();
    expect(data.metadata.gitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(data.metadata.totalSymbols).toBe(data.symbols.length);
    expect(data.symbols.length).toBeGreaterThan(500);
  });

  it('was generated within the last 90 days', () => {
    const generatedAt = new Date(data.metadata.generatedAt).getTime();
    expect(Number.isNaN(generatedAt)).toBe(false);
    const ageDays = (Date.now() - generatedAt) / 86_400_000;
    // If this fails, re-run: SDK_DOCS_LOCAL_ROOT=<js-sdk> node scripts/generate_sdk_symbols.js
    // or `yarn update:free` for the npm-tarball path.
    expect(ageDays).toBeLessThan(90);
  });

  it('matches the live export for sentinel hook useOrderEntry', () => {
    // Live API (packages/hooks/src/index.ts): `export * from "./next/useOrderEntry"`.
    // The variant in deprecated/useOrderEntry.ts is exported only as
    // useOrderEntry_deprecated and must NOT win the id collision.
    const entry = data.symbols.find((s) => s.id === 'hook.useOrderEntry');
    expect(entry).toBeDefined();
    expect(entry!.sourcePath).toContain('src/next/useOrderEntry/');
    expect(entry!.record.deprecated).toBeFalsy();
    expect(entry!.record.params?.[0]?.name).toBe('symbol');
    expect(entry!.record.params?.[0]?.type).toBe('string');
  });

  it('flags genuinely deprecated hooks', () => {
    const entry = data.symbols.find((s) => s.id === 'hook.useOrderEntry_deprecated');
    if (entry) {
      expect(entry.record.deprecated).toBe(true);
      expect(entry.sourcePath).toContain('src/deprecated/');
    }
  });

  it('has no duplicate ids with conflicting source paths', () => {
    const byId = new Map<string, SymbolEntry>();
    const conflicts: string[] = [];
    for (const sym of data.symbols) {
      const prev = byId.get(sym.id);
      if (!prev) {
        byId.set(sym.id, sym);
      } else if (prev.sourcePath !== sym.sourcePath) {
        conflicts.push(`${sym.id}: ${prev.sourcePath} vs ${sym.sourcePath}`);
      }
    }
    expect(conflicts).toEqual([]);
  });
});

// Keep the raw read honest: if the JSON import above ever stops matching the
// file on disk (build caching, stale transform), this catches it.
describe('sdk-symbols file on disk', () => {
  it('is parseable and non-trivial in size', () => {
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as SdkSymbolsData;
    expect(raw.symbols.length).toBe(data.symbols.length);
  });
});
