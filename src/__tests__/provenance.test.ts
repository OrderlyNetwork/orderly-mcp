import { describe, it, expect } from 'vitest';
import { searchOrderlyDocs } from '../tools/searchDocs.js';
import { getComponentGuide } from '../tools/componentGuides.js';

// Every generative response carries a one-line provenance
// footer so calling agents can reason about data freshness.
describe('provenance footers', () => {
  it('SDK-scope search results carry the provenance line', async () => {
    const result = await searchOrderlyDocs('useOrderEntry', 5);
    const text = result.content[0].text;
    expect(text).toMatch(/provenance: symbols=@orderly\.network\/sdk-docs@\S+/);
    expect(text).toMatch(/git [0-9a-f]{10}/);
    expect(text).toMatch(/generated \d{4}-\d{2}-\d{2}/);
  });

  it('docs-scope search results also report the docs corpus date', async () => {
    const result = await searchOrderlyDocs('leverage', 5);
    const text = result.content[0].text;
    expect(text).toMatch(/provenance: symbols=/);
    expect(text).toMatch(/docs corpus updated \d{4}-\d{2}-\d{2}/);
  });

  it('empty search results still carry provenance', async () => {
    // Gibberish token verified (probe) to fuzzy-match nothing in the corpus.
    const result = await searchOrderlyDocs('qqqqxxzz', 5, 'sdk');
    const text = result.content[0].text;
    expect(text).toContain('No results found');
    expect(text).toMatch(/provenance: symbols=/);
  });

  it('summary mode truncates long doc chunks and offers detail:"full"', async () => {
    const result = await searchOrderlyDocs('place a limit order', 5);
    const text = result.content[0].text;
    if (text.includes('[truncated')) {
      expect(text).toMatch(/\*\[truncated — \d+ chars omitted; re-search with detail:"full"\]\*/);
      // Whole response stays well under the old multi-KB-per-section sizes.
      expect(text.length).toBeLessThan(16000);
    }
  });

  it('full mode returns untruncated section text', async () => {
    const summary = await searchOrderlyDocs('place a limit order', 1, 'docs', 'summary');
    const full = await searchOrderlyDocs('place a limit order', 1, 'docs', 'full');
    const sumText = summary.content[0].text;
    const fullText = full.content[0].text;
    if (sumText.includes('[truncated')) {
      expect(fullText.length).toBeGreaterThan(sumText.length);
      expect(fullText).not.toContain('[truncated');
    } else {
      // Chunk fit within budget — both modes must agree byte-for-byte.
      expect(sumText).toBe(fullText);
    }
  });

  it('component guides carry the provenance line', async () => {
    const result = await getComponentGuide('AlertDialog');
    expect(result.content[0].text).toMatch(/provenance: symbols=@orderly\.network\/sdk-docs@\S+/);
  });
});
