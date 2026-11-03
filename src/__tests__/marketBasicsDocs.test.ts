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

describe('perpetual market basics corpus', () => {
  it('publishes funding, price, and liquidation explainers', () => {
    for (const id of [
      'basics-funding-rate',
      'basics-mark-index-last-price',
      'basics-liquidations',
    ]) {
      const found = chunk(id);
      expect(found.category).toBe('Trading');
      expect(found.content.length).toBeGreaterThan(500);
      expect(found.keywords.length).toBeGreaterThan(0);
    }
  });

  it('covers the funding rate components and settlement', () => {
    const content = chunk('basics-funding-rate').content;
    expect(content).toContain('Premium');
    expect(content).toContain('Interest Rate');
    expect(content).toContain('Accrued Funding = Position Size x Mark Price x Funding Rate');
    expect(content).toContain('longs pay shorts');
    expect(content).toContain('est_funding_rate');
  });

  it('covers mark/index/last price and their safeguards', () => {
    const content = chunk('basics-mark-index-last-price').content;
    expect(content).toContain('Index Price');
    expect(content).toContain('Mark Price');
    expect(content).toContain('Last Price');
    expect(content).toContain('5%');
    expect(content).toContain('5.25%');
  });

  it('covers liquidation triggers, tiers, and fees', () => {
    const content = chunk('basics-liquidations').content;
    expect(content).toContain('Account Margin Ratio');
    expect(content).toContain('Maintenance Margin Ratio');
    expect(content).toContain('Insurance Fund');
    expect(content).toContain('1.20%');
    expect(content).toContain('10,000 USDC');
  });

  it('keeps the corpus metadata in sync', () => {
    const metadata = (documentationData as { metadata: { totalChunks: number } }).metadata;
    expect(metadata.totalChunks).toBe(chunks.length);
  });
});
