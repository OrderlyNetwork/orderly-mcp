import { describe, it, expect, beforeEach } from 'vitest';
import documentationData from '../data/documentation.json' with { type: 'json' };
import { searchOrderlyDocs, clearSearchCache } from '../tools/searchDocs.js';

interface DocChunk {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
}

interface BatchCacheEntry {
  chunks?: DocChunk[];
}

const chunks = (documentationData as { chunks: DocChunk[] }).chunks;

function cachedChunks(): DocChunk[] {
  const cache = (documentationData as { _batchCache?: Record<string, unknown> })._batchCache ?? {};
  return Object.values(cache).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const batchChunks = (entry as BatchCacheEntry).chunks;
    return Array.isArray(batchChunks) ? batchChunks : [];
  });
}

describe('testnet faucet corpus', () => {
  beforeEach(() => {
    clearSearchCache();
  });

  it('publishes a curated faucet chunk with the live operator endpoints', () => {
    const faucet = chunks.find((chunk) => chunk.id === 'faucet-testnet');
    if (!faucet) throw new Error('missing faucet-testnet chunk');

    expect(faucet.content).toContain(
      'POST https://testnet-operator-evm.orderly.org/v1/faucet/usdc'
    );
    expect(faucet.content).toContain(
      'POST https://testnet-operator-sol.orderly.org/v1/faucet/usdc'
    );
    expect(faucet.content).toContain('user_address');
    expect(faucet.content).toContain('broker_id');
    expect(faucet.content).toContain('chain_id');
    expect(faucet.content).toContain('1,000 USDC');
    expect(faucet.content).toContain('100 USDC');
    expect(faucet.content).toContain('not to your wallet');
  });

  it('does not keep the retired GET path in published or cached chunks', () => {
    for (const chunk of [...chunks, ...cachedChunks()]) {
      expect(chunk.content, chunk.id).not.toContain('GET /v1/public/faucet');
    }
  });

  it('surfaces the correct endpoint in a default search summary', async () => {
    const result = await searchOrderlyDocs('testnet faucet', 3, 'docs');
    const text = result.content[0].text;

    expect(text).toContain('Testnet USDC Faucet');
    expect(text).toContain('POST https://testnet-operator-evm.orderly.org/v1/faucet/usdc');
    expect(text).not.toContain('GET /v1/public/faucet');
  });

  it('keeps metadata totalChunks in sync', () => {
    const metadata = (documentationData as { metadata: { totalChunks: number } }).metadata;
    expect(metadata.totalChunks).toBe(chunks.length);
  });
});
