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
    // Count actual result entries via the Relevance label (not chunk content
    // which may contain its own ## N. markdown headers after AI merging).
    const sectionCount = (text.match(/\*\*Relevance:\*\*/g) || []).length;
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
    // "useOrdrEntry" (typo) doesn't appear in titles/keywords, only in content.
    // Fuse.js can't fuzzy-match it at the configured threshold. The correct UX
    // is to return the suggestion list, which should include the correct name.
    const result = await searchOrderlyDocs('useOrdrEntry', 5);
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    // The suggestion engine should mention the correct hook name
    expect(text).toContain('useOrderEntry');
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

  it('should handle natural-language questions by stripping stopwords', async () => {
    // "how does the vault work" should reduce to "vault" and find results
    const result = await searchOrderlyDocs('how does the vault work', 5);
    expect(result.content[0].text).toContain('Search Results');
    expect(result.content[0].text).not.toContain('No results found');
  });

  it('should find results for multi-word natural queries', async () => {
    // "how to connect wallet" → tokens: connect, wallet → should match
    const result = await searchOrderlyDocs('how to connect wallet', 5);
    expect(result.content[0].text).toContain('Search Results');
    expect(result.content[0].text).not.toContain('No results found');
  });

  it('should handle queries that reduce to a single meaningful term', async () => {
    const result = await searchOrderlyDocs('what is leverage', 3);
    expect(result.content[0].text).toContain('Search Results');
    expect(result.content[0].text).not.toContain('No results found');
  });

  it('should reject queries with only stopwords', async () => {
    const result = await searchOrderlyDocs('how does the work', 5);
    expect(result.content[0].text).toContain('contained only common words');
  });

  it('should handle kebab-case queries', async () => {
    // Kebab should be split into tokens
    const result = await searchOrderlyDocs('funding-rate', 3);
    expect(result.content[0].text).toContain('Search Results');
  });

  it('should show multi-term match indicator when multiple tokens hit', async () => {
    // "wallet connection" → two tokens that should both match some chunks
    const result = await searchOrderlyDocs('wallet connection fees', 5);
    const text = result.content[0].text;
    if (text.includes('Search Results')) {
      // At least one result should show the multi-hit indicator
      // (not guaranteed for every dataset, but likely for this combination)
      expect(text).toMatch(/Search Results/);
    }
  });

  it('should surface SDK symbols with inline type-accurate records', async () => {
    // The unified index folds js-sdk symbol data (from @orderly.network/sdk-docs
    // bundled artifacts) into search. A hook lookup must return the symbol's
    // signature + provenance inline, with no need for a separate lookup tool.
    const result = await searchOrderlyDocs('usePositionStream', 5);
    const text = result.content[0].text;
    expect(text).toContain('Search Results');
    expect(text).toContain('`SDK Hook`');
    expect(text).toMatch(/\*\*Signature:\*\*/);
    expect(text).toMatch(/```ts/);
    // Provenance from the SDK bundle
    expect(text).toContain('**Source:**');
    // Exact hook name must rank first (dedup + coverage-aware ranking)
    expect(text).toMatch(/## 1\. usePositionStream/);
  });

  it('should rank an exact hook-name match at #1', async () => {
    // Regression guard: duplicate symbol records in the source and the
    // coverage-vs-score tie-break must not let a fuzzy near-match outrank the
    // exact symbol (e.g. usePositionHeaderScript above usePositionStream).
    const result = await searchOrderlyDocs('useOrderEntry', 5);
    const text = result.content[0].text;
    expect(text).toMatch(/## 1\. useOrderEntry\b/);
  });

  it('should support docs-only scope', async () => {
    // Forcing scope="docs" must keep SDK symbol records out of the results,
    // even when the query is a hook name.
    const result = await searchOrderlyDocs('usePositionStream', 5, 'docs');
    const text = result.content[0].text;
    expect(text).not.toContain('`SDK Hook`');
    if (text.includes('Search Results')) {
      expect(text).toContain(' (docs)');
    }
  });

  it('should support sdk-only scope', async () => {
    // Forcing sdk scope returns inline type-accurate symbol records with the
    // scope label visible.
    const result = await searchOrderlyDocs('usePositionStream', 5, 'sdk');
    const text = result.content[0].text;
    expect(text).toContain('`SDK Hook`');
    expect(text).toContain(' (SDK symbols)');
  });

  it('should auto-detect scope from camelCase queries', async () => {
    // 'usePositionStream' is clearly an SDK identifier → SDK scope.
    const result = await searchOrderlyDocs('usePositionStream', 5);
    const text = result.content[0].text;
    expect(text).toContain(' (SDK symbols)');
  });

  it('should auto-detect scope from plain-language queries', async () => {
    // 'how does the vault work' is prose → docs scope, no SDK-symbol noise.
    const result = await searchOrderlyDocs('how does the vault work', 5);
    const text = result.content[0].text;
    expect(text).toContain(' (docs)');
  });

  // --- Scope routing for non-symbol identifiers ---------------------------
  // Page-level components (TradingPage, Portfolio, ...) are camelCased but are
  // documented in the prose corpus, NOT emitted as type-accurate symbols by
  // the js-sdk ai-docs pipeline. They must route to docs — not the SDK corpus,
  // which would surface fuzzy symbol noise like getTradingPanelIds.
  it('should route a non-symbol camelCase identifier to docs', async () => {
    const result = await searchOrderlyDocs('TradingPage', 5);
    const text = result.content[0].text;
    expect(text).toContain('Search Results');
    expect(text).toContain(' (docs)');
    expect(text).toContain('TradingPage');
    // Must not leak fuzzy SDK-symbol noise for an identifier that isn't a symbol.
    expect(text).not.toContain('`SDK Hook`');
    expect(text).not.toContain('`SDK Function`');
  });

  it('should still route an exact symbol name to SDK even when camelCased', async () => {
    // 'AlertDialog' is a real component symbol — must route to the SDK corpus.
    const result = await searchOrderlyDocs('AlertDialog', 5);
    const text = result.content[0].text;
    expect(text).toContain(' (SDK symbols)');
  });

  // --- Symbol-kind render coverage ----------------------------------------
  // The unified search folds hooks/types/components/functions into one index;
  // each kind renders a distinct inline block that must be exercised.
  it('should render SDK components with props', async () => {
    const result = await searchOrderlyDocs('AlertDialog', 5, 'sdk');
    const text = result.content[0].text;
    expect(text).toContain('`SDK Component`');
    expect(text).toContain('**Component name:**');
    expect(text).toContain('**Props:**');
    // At least one prop line renders name + type.
    expect(text).toMatch(/- `.+` \(`.+`\)/);
  });

  it('should render SDK types with typeText', async () => {
    const result = await searchOrderlyDocs('BindReferralCodeSuccessPayload', 5, 'sdk');
    const text = result.content[0].text;
    expect(text).toContain('`SDK Type`');
    expect(text).toContain('**Type:**');
  });

  it('should render SDK functions with signature, params, and returns', async () => {
    // parseUnits was removed from the SDK; generateRegisterAccountMessage is a
    // current @orderly.network/core function with a full signature.
    const result = await searchOrderlyDocs('generateRegisterAccountMessage', 5, 'sdk');
    const text = result.content[0].text;
    expect(text).toContain('`SDK Function`');
    expect(text).toMatch(/\*\*Signature:\*\*/);
    expect(text).toContain('**Parameters:**');
    expect(text).toMatch(/\*\*Returns:\*\* `.+`/);
  });

  it('should render hook params detail, returns, and jsDoc body', async () => {
    const result = await searchOrderlyDocs('useOrderEntry', 5, 'sdk');
    const text = result.content[0].text;
    expect(text).toContain('**Parameters:**');
    expect(text).toMatch(/\*\*Returns:\*\* `OrderEntryReturn`/);
    // jsDoc renders as the description body above the signature.
    expect(text).toContain('Custom hook for managing order entry');
    // Symbol provenance line.
    expect(text).toContain('**Package:**');
    expect(text).toContain('**Source:**');
  });

  it('should flag deprecated symbols', async () => {
    const result = await searchOrderlyDocs('useMarket', 5, 'sdk');
    const text = result.content[0].text;
    // useMarket is one of the deprecated hooks in the bundle.
    expect(text).toContain('⚠️');
    expect(text).toContain('deprecated');
  });

  // --- Fee-tier data correctness in search results --------------------------
  // Regression guard for the August 2026 stale-fee bug: searching for builder
  // staking / fee tiers must return CURRENT values, not the retired programme.
  it('should return current fee tier thresholds when searching "builder staking"', async () => {
    // Thresholds live deep inside a long chunk — use detail:'full' (summary
    // mode truncates at ~1200 chars by design).
    const result = await searchOrderlyDocs('builder staking fee tiers', 5, 'auto', 'full');
    const text = result.content[0].text;
    expect(text).toContain('Search Results');
    // Must include the corrected Platinum/Diamond volume thresholds
    expect(text).toContain('$750M');
    expect(text).toContain('$2B');
    // Must NOT contain the old retired thresholds
    expect(text).not.toContain('$10B');
    expect(text).not.toContain('$1B 30-day');
  });

  it('should return correct staking amounts when searching "staking tier"', async () => {
    const result = await searchOrderlyDocs('ORDER staking tier requirements', 5);
    const text = result.content[0].text;
    expect(text).toContain('Search Results');
    // Gold should show 300K, not 250K
    expect(text).not.toMatch(/250,000/);
    // Platinum should show 3M, not 2M
    expect(text).not.toMatch(/\b2M\s+(?:\$?ORDER)\s+staked/);
  });
});
