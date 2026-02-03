import { describe, it, expect } from 'vitest';
import { searchOrderlyDocs } from '../tools/searchDocs.js';

describe('searchOrderlyDocs', () => {
  it('should find documentation by keyword', async () => {
    const result = await searchOrderlyDocs('orderbook', 3);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('orderbook');
    expect(result.content[0].text).toContain('Search Results');
  });

  it('should find SDK patterns', async () => {
    const result = await searchOrderlyDocs('useOrderEntry', 5);
    expect(result.content[0].text).toContain('SDK');
  });

  it('should return suggestions when no results found', async () => {
    const result = await searchOrderlyDocs('zzzzqqqqzzzz123456789', 5);
    expect(result.content[0].text).toContain('No results found');
    expect(result.content[0].text).toContain('Try searching for');
  });

  it('should limit results correctly', async () => {
    const result = await searchOrderlyDocs('orderbook', 2);
    const text = result.content[0].text;
    const sectionCount = (text.match(/## \d+\./g) || []).length;
    expect(sectionCount).toBeLessThanOrEqual(2);
  });
});
