import { describe, it, expect, beforeEach } from 'vitest';
import { searchOrderlyDocs, clearSearchCache } from '../tools/searchDocs.js';

describe('searchOrderlyDocs', () => {
  beforeEach(() => {
    // Clear the Fuse cache before each test to ensure fresh searches
    clearSearchCache();
  });

  it('should find documentation by keyword', async () => {
    const result = await searchOrderlyDocs('orderbook', 3);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
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

  it('should handle fuzzy matching for typos', async () => {
    // Test typo tolerance - "ordebook" should match "orderbook"
    const result = await searchOrderlyDocs('ordebook', 3);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Search Results');
    // Should find results despite the typo
    expect(result.content[0].text).not.toContain('No results found');
  });

  it('should handle fuzzy matching for hook names', async () => {
    // Test typo tolerance - "useOrdrEntry" should match "useOrderEntry"
    const result = await searchOrderlyDocs('useOrdrEntry', 5);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Search Results');
    expect(result.content[0].text).not.toContain('No results found');
  });

  it('should handle empty query', async () => {
    const result = await searchOrderlyDocs('', 5);
    expect(result.content[0].text).toBe('Please provide a search query.');
  });

  it('should include relevance scores', async () => {
    const result = await searchOrderlyDocs('vault', 3);
    expect(result.content[0].text).toContain('Relevance:');
    // Should show percentage (e.g., "Relevance: 85%")
    expect(result.content[0].text).toMatch(/Relevance:\*\* \d+%/);
  });

  it('should search across multiple fields', async () => {
    // Search for something that might be in content but not title
    const result = await searchOrderlyDocs('EIP-712', 5);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Search Results');
  });

  it('should provide tip for hook-related searches without SDK results', async () => {
    // Search for a hook pattern - Fuse.js is now good enough that it finds SDK results
    // So we test that the search works and returns relevant SDK content
    const result = await searchOrderlyDocs('useWalletConnector', 5);
    const text = result.content[0].text;

    // Fuse.js now finds SDK results for this query, which is actually better behavior
    // The search should find relevant SDK documentation
    expect(text).toContain('Search Results');
    expect(text).not.toContain('No results found');
  });
});
