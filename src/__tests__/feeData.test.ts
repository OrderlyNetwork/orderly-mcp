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

const allChunkText = chunks.map((c) => `${c.title}\n${c.content}`).join('\n\n');

describe('fee tier data integrity (stale-value regression guard)', () => {
  // These patterns are KNOWN-BAD values that shipped in v1.2.0 and were
  // corrected in the August 2026 hotfix. If any of them reappear in the
  // documentation index, this test fails — preventing the exact regression
  // reported by the builder.
  const stalePatterns: { name: string; pattern: RegExp }[] = [
    {
      name: 'Platinum tier at $1B volume (should be $750M)',
      pattern: /\$1B\s*(?:30-day|30 day|monthly)/i,
    },
    {
      name: 'Diamond tier at $10B volume (should be $2B)',
      pattern: /\$10B\s*(?:30-day|30 day|monthly)/i,
    },
    {
      name: 'Gold staking at 250,000 ORDER (should be 300,000)',
      pattern: /250,?000\s+(?:\$?ORDER)\s+staked/i,
    },
    {
      name: 'Platinum staking at 2M ORDER (should be 3M)',
      pattern: /2M\s+(?:\$?ORDER)\s+staked/i,
    },
    {
      name: 'Diamond maker rebate at -0.5 bps (should be -0.20)',
      pattern: /-0\.5\s*bps|−0\.5\s*bps/i,
    },
    {
      name: 'Maker rebate range starting at -0.5 bps (should be -0.05 to -0.20)',
      pattern: /-0\.5\s*bps\s*to\s*0/i,
    },
    {
      name: 'RWA fees at 3-5 bps (should be aligned with crypto at 1-3 bps)',
      pattern: /3[–-]5\s*bps/i,
    },
    {
      name: '$1,000 graduation fee (should be $10)',
      pattern: /\$1,?000\s*(?:USDC)?\s*(?:graduation|graduat)/i,
    },
  ];

  it.each(stalePatterns)('should NOT contain stale value: $name', ({ pattern }) => {
    expect(pattern.test(allChunkText)).toBe(false);
  });

  // Positive checks — the correct current values MUST be present in
  // fee-related chunks so that search_orderly_docs returns them.
  it('should contain correct Platinum volume threshold ($750M)', () => {
    const feeChunks = chunks.filter((c) => isFeeChunk(c));
    const hasCorrect = feeChunks.some((c) => /\$750M/i.test(c.content));
    expect(hasCorrect).toBe(true);
  });

  it('should contain correct Diamond volume threshold ($2B)', () => {
    const feeChunks = chunks.filter((c) => isFeeChunk(c));
    const hasCorrect = feeChunks.some((c) => /\$2B/i.test(c.content));
    expect(hasCorrect).toBe(true);
  });

  it('should contain correct Gold staking threshold (300K ORDER)', () => {
    const feeChunks = chunks.filter((c) => isFeeChunk(c));
    const hasCorrect = feeChunks.some((c) => /300,?000\s+(?:\$?ORDER)\s+staked/i.test(c.content));
    expect(hasCorrect).toBe(true);
  });

  it('should contain correct Platinum staking threshold (3M ORDER)', () => {
    const feeChunks = chunks.filter((c) => isFeeChunk(c));
    const hasCorrect = feeChunks.some((c) => /3M\s+(?:\$?ORDER)\s+staked/i.test(c.content));
    expect(hasCorrect).toBe(true);
  });

  it('should contain correct Diamond maker rebate (-0.20 bps)', () => {
    const feeChunks = chunks.filter((c) => isFeeChunk(c));
    const hasCorrect = feeChunks.some((c) => /-0\.20\s*bps|−0\.20\s*bps/i.test(c.content));
    expect(hasCorrect).toBe(true);
  });

  it('should contain correct Silver tier with 100K ORDER staking', () => {
    const feeChunks = chunks.filter((c) => isFeeChunk(c));
    const hasCorrect = feeChunks.some(
      (c) => /silver/i.test(c.content) && /100K?\s+ORDER/i.test(c.content)
    );
    expect(hasCorrect).toBe(true);
  });

  it('should have Public tier base taker fee at 3 bps (not 2.5)', () => {
    const feeChunks = chunks
      .filter((c) => isFeeChunk(c))
      .filter((c) => /\| Public/.test(c.content));
    for (const c of feeChunks) {
      const publicRow = c.content.split('\n').find((l) => /\| Public/.test(l));
      if (publicRow && /bps/.test(publicRow)) {
        // Public row should show 3 bps, not 2.5 bps
        expect(publicRow).not.toMatch(/2\.5\s*bps/);
      }
    }
  });
});

function isFeeChunk(chunk: DocChunk): boolean {
  const text = `${chunk.title}\n${chunk.content}`.toLowerCase();
  return (
    text.includes('staking') ||
    text.includes('fee tier') ||
    text.includes('builder staking') ||
    text.includes('base taker') ||
    text.includes('base maker') ||
    text.includes('fee structure') ||
    text.includes('rebate') ||
    (text.includes('platinum') && text.includes('diamond'))
  );
}
