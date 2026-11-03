import { describe, it, expect } from 'vitest';
import documentationData from '../data/documentation.json' with { type: 'json' };

interface DocChunk {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
}

const chunks = (documentationData as { chunks: DocChunk[] }).chunks;

function chunk(id: string): DocChunk {
  const found = chunks.find((c) => c.id === id);
  if (!found) throw new Error(`missing chunk: ${id}`);
  return found;
}

describe('Perp Anything docs corpus', () => {
  const ids = [
    'perp-anything-overview',
    'perp-anything-operations',
    'perp-anything-rwa',
    'perp-anything-pre-tge',
    'builder-oracle',
  ];

  it('publishes all Perp Anything and Builder Oracle chunks', () => {
    for (const id of ids) {
      const found = chunk(id);
      expect(found.category).toBe('Trading');
      expect(found.content.length).toBeGreaterThan(500);
      expect(found.keywords.length).toBeGreaterThan(0);
    }
  });

  it('documents the operating model and fee share', () => {
    const content = chunk('perp-anything-overview').content;
    expect(content).toContain('Community Listed');
    expect(content).toContain('50% of Orderly base taker fees');
    expect(content).toContain('Isolated');
  });

  it('documents insurance fund, launch gates, and statuses', () => {
    const content = chunk('perp-anything-operations').content;
    expect(content).toContain('25,000 USDC');
    expect(content).toContain('IF balance > IF Requirement');
    expect(content).toContain('POST_ONLY');
    expect(content).toContain('permissionless_listing_fee_share');
  });

  it('documents RWA sessions and Pre-TGE caps', () => {
    const rwa = chunk('perp-anything-rwa').content;
    expect(rwa).toContain('market_session');
    expect(rwa).toContain('US_STOCK');

    const preTge = chunk('perp-anything-pre-tge').content;
    expect(preTge).toContain('is_pretge');
    expect(preTge).toContain('5x');
  });

  it('documents Builder Oracle modes and weight rules', () => {
    const content = chunk('builder-oracle').content;
    expect(content).toContain('BYOK');
    expect(content).toContain('sum to 100');
    expect(content).toContain('indexpricefeed');
  });

  it('keeps the corpus metadata in sync', () => {
    const metadata = (documentationData as { metadata: { totalChunks: number } }).metadata;
    expect(metadata.totalChunks).toBe(chunks.length);
  });
});
