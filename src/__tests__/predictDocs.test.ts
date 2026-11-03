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
const predictChunks = chunks.filter((chunk) => chunk.id.startsWith('predict-'));

const EXPECTED_IDS = [
  'predict-overview',
  'predict-rounds',
  'predict-market-data',
  'predict-order-management',
  'predict-positions-settlement',
  'predict-fees',
  'predict-region-restriction',
  'predict-sdk-integration',
  'predict-endpoints',
  'predict-errors',
];

function contentOf(id: string): string {
  const chunk = predictChunks.find((c) => c.id === id);
  if (!chunk) throw new Error(`missing predict chunk: ${id}`);
  return chunk.content;
}

describe('Orderly Predict docs corpus', () => {
  it('exposes every Predict topic as a searchable chunk', () => {
    expect(predictChunks.map((c) => c.id)).toEqual(EXPECTED_IDS);
    for (const chunk of predictChunks) {
      expect(chunk.category, chunk.id).toBe('Orderly Predict');
      expect(chunk.content.length, chunk.id).toBeGreaterThan(200);
      expect(chunk.keywords.length, chunk.id).toBeGreaterThan(0);
    }
  });

  it('keeps the corpus metadata in sync', () => {
    const metadata = (
      documentationData as {
        metadata: { totalChunks: number; categories: Array<{ name: string; count: number }> };
      }
    ).metadata;
    expect(metadata.totalChunks).toBe(chunks.length);
    expect(metadata.categories).toContainEqual({ name: 'Orderly Predict', count: 10 });
  });

  it('documents the core round and order rules', () => {
    const overview = contentOf('predict-overview');
    expect(overview).toContain('5-minute BTC Up/Down');
    expect(overview).toContain('never reused');

    const orderManagement = contentOf('predict-order-management');
    expect(orderManagement).toContain('order_price = 1 - d');
    expect(orderManagement).toContain('BINARY_MARGIN_MODE_NOT_SUPPORTED');
    expect(orderManagement).toContain('ROUND_CLOSED');
    expect(orderManagement).toContain('reduce_only');

    expect(contentOf('predict-rounds')).toContain('result_committed_at');
    expect(contentOf('predict-market-data')).toContain('down_asks');
    expect(contentOf('predict-positions-settlement')).toContain('settled_at');
    expect(contentOf('predict-region-restriction')).toContain('product_restricted_areas');
    expect(contentOf('predict-sdk-integration')).toContain('PredictionPage');
    expect(contentOf('predict-endpoints')).toContain('/v1/public/binary/info');
    expect(contentOf('predict-errors')).toContain('BINARY_ORDER_TYPE_NOT_SUPPORTED');
  });

  it('publishes the live fee schedule', () => {
    const fees = contentOf('predict-fees');
    for (const rate of ['600 bps', '400 bps', '375 bps', '350 bps', '325 bps', '300 bps']) {
      expect(fees).toContain(rate);
    }
    expect(fees).toContain('| Diamond |');
    expect(fees).toContain('fee per share = p x fee rate x (1 - p)');
    expect(fees).toContain('$1.50');
  });

  it('does not resurrect the retired Predict fee schedule', () => {
    const fees = contentOf('predict-fees');
    // The previous docs pinned a 300 bps cap and 200/190/175/150/100 base rates.
    expect(fees).not.toMatch(/cap[^.]{0,40}300\s*bps/i);
    expect(fees).not.toMatch(/Predict taker base rate[^.]{0,20}\b200\s*bps/i);
    expect(fees).not.toMatch(/\b190\s*bps/);
    expect(fees).not.toMatch(/\b175\s*bps/);
    expect(fees).not.toMatch(/\b150\s*bps/);
    expect(fees).not.toMatch(/\b100\s*bps/);
  });
});
