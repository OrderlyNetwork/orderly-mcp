import Fuse from 'fuse.js';
import documentationData from '../data/documentation.json' with { type: 'json' };
import sdkSymbolsData from '../data/sdk-symbols.json' with { type: 'json' };
import { provenanceFooter } from './provenance.js';

export interface SearchResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface DocChunk {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
}

interface DocumentationData {
  chunks: DocChunk[];
  metadata: {
    version: string;
    lastUpdated: string;
    totalChunks: number;
  };
}

interface SymbolParam {
  name: string;
  type: string;
  optional?: boolean;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
}

interface SymbolRecord {
  name: string;
  package?: string;
  sourcePath?: string;
  jsDoc?: string;
  deprecated?: boolean;
  params?: SymbolParam[];
  returns?: string;
  displayName?: string;
  props?: SymbolParam[];
  typeText?: string;
}

interface SymbolEntry {
  id: string;
  name: string;
  kind: 'hook' | 'type' | 'component' | 'function';
  category: string;
  package: string;
  sourcePath: string;
  keywords: string[];
  searchText: string;
  record: SymbolRecord;
}

interface SdkSymbolsData {
  metadata: {
    sourcePackage: string;
    sourceVersion: string;
    gitSha: string;
    generatedAt: string;
    totalSymbols: number;
  };
  symbols: SymbolEntry[];
}

// A unified item in the Fuse index. Both documentation chunks and SDK symbols
// are normalized to this shape so a single fuzzy search covers both corpora;
// `payload` preserves the original for kind-specific rendering.
interface IndexItem {
  id: string;
  type: 'doc' | 'symbol';
  title: string;
  content: string;
  category: string;
  keywords: string[];
  payload: DocChunk | SymbolEntry;
}

// Words that carry no domain meaning in search queries.
// Stripping these lets natural-language questions like "how does the vault work"
// reduce to "vault" — which Fuse matches well.
const STOPWORDS = new Set([
  'how',
  'does',
  'do',
  'did',
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'what',
  'why',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'whose',
  'can',
  'could',
  'should',
  'would',
  'will',
  'shall',
  'may',
  'might',
  'must',
  'i',
  'my',
  'me',
  'we',
  'our',
  'us',
  'you',
  'your',
  'they',
  'their',
  'them',
  'he',
  'she',
  'it',
  'its',
  'his',
  'her',
  'this',
  'that',
  'these',
  'those',
  'for',
  'with',
  'of',
  'on',
  'in',
  'at',
  'by',
  'from',
  'into',
  'about',
  'to',
  'and',
  'or',
  'not',
  'no',
  'if',
  'then',
  'else',
  'so',
  'than',
  'too',
  'very',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'get',
  'got',
  'work',
  'working',
  'works',
  'worked',
  'use',
  'using',
  'used',
  'there',
  'here',
  'out',
  'up',
  'down',
  'over',
  'under',
  'again',
]);

/**
 * Split a raw user query into meaningful search tokens.
 * Lowercases, converts kebab/snake_case to spaces, strips punctuation,
 * removes stopwords, and drops tokens shorter than 2 chars.
 *
 * Examples:
 *   "how does the vault work" → ["vault"]
 *   "how-to-connect-wallet"   → ["connect", "wallet"]
 *   "useOrderEntry"           → ["useorderentry"]
 */
function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// Lowercased SDK symbol names, used for exact-match intent detection.
let symbolNameSet: Set<string> | null = null;

function getSymbolNameSet(): Set<string> {
  if (!symbolNameSet) {
    symbolNameSet = new Set(
      (sdkSymbolsData as SdkSymbolsData).symbols.map((s) => s.name.toLowerCase())
    );
  }
  return symbolNameSet;
}

export type SearchScope = 'auto' | 'docs' | 'sdk';
export type SearchDetail = 'summary' | 'full';

// Char budget for a doc chunk rendered in 'summary' mode (the default). Doc
// chunks routinely run 5-15KB; five of them made single responses hit ~72KB
// (~18k tokens). 1200 chars/section keeps a full 5-hit response under ~8KB.
const SUMMARY_CHAR_BUDGET = 1200;

/**
 * Cut content at the summary budget, preferring a paragraph boundary so the
 * excerpt ends cleanly. The omitted-char note tells the caller how to get the
 * rest (detail:"full").
 */
function summarizeChunk(content: string): string {
  if (content.length <= SUMMARY_CHAR_BUDGET) return content;
  const slice = content.slice(0, SUMMARY_CHAR_BUDGET);
  const breakIdx = slice.lastIndexOf('\n\n');
  const kept = breakIdx > SUMMARY_CHAR_BUDGET * 0.5 ? slice.slice(0, breakIdx) : slice;
  return (
    `${kept}\n\n*[truncated — ${content.length - kept.length} chars omitted;` +
    ` re-search with detail:"full"]*`
  );
}

/**
 * Heuristic intent detection for 'auto' scope. Routes to the SDK corpus only
 * when a query token exactly matches a known symbol name (e.g.
 * "usePositionStream", "OrderEntry", "parseUnits"); plain language ("how much
 * are fees") routes to the prose documentation corpus.
 *
 * A blanket camelCase heuristic is intentionally NOT used: page-level
 * components like "TradingPage" are camelCased identifiers but are documented
 * in the prose corpus, NOT emitted as type-accurate symbols by the js-sdk
 * ai-docs pipeline. Routing them to the SDK corpus would surface fuzzy symbol
 * noise (e.g. `getTradingPanelIds`) instead of the real documentation.
 */
function detectScope(query: string): 'docs' | 'sdk' {
  const trimmed = query.trim();
  const tokens = tokenizeQuery(trimmed);
  if (tokens.some((t) => getSymbolNameSet().has(t))) return 'sdk';
  return 'docs';
}

// Initialize the Fuse instance lazily to avoid doing heavy work at module load time.
let fuseInstance: Fuse<IndexItem> | null = null;

function getFuseInstance(): Fuse<IndexItem> {
  if (!fuseInstance) {
    const docs = documentationData as DocumentationData;
    const symbols = sdkSymbolsData as SdkSymbolsData;

    const items: IndexItem[] = [
      ...docs.chunks.map((chunk) => ({
        id: chunk.id,
        type: 'doc' as const,
        title: chunk.title,
        content: chunk.content,
        category: chunk.category,
        keywords: chunk.keywords,
        payload: chunk,
      })),
      ...symbols.symbols.map((sym) => ({
        id: sym.id,
        type: 'symbol' as const,
        title: sym.name,
        content: sym.searchText,
        category: sym.category,
        keywords: sym.keywords,
        payload: sym,
      })),
    ];

    const fuseOptions = {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'content', weight: 0.3 },
        { name: 'keywords', weight: 0.2 },
        { name: 'category', weight: 0.1 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      includeMatches: false,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      ignoreLocation: true,
    };

    fuseInstance = new Fuse(items, fuseOptions);
  }

  return fuseInstance;
}

interface MergedResult {
  item: IndexItem;
  score: number;
  hits: number;
}

/**
 * Multi-token search: run Fuse for each token individually, then merge.
 * Items matching multiple tokens get a score boost (lower = better).
 *
 * Each token contributes at most one hit per item (the best score for that
 * token), so `hits` reflects how many distinct query tokens matched — coverage —
 * and is never inflated by duplicate index entries.
 *
 * `allowedTypes` narrows results to one corpus (e.g. docs-only or SDK-only);
 * disallowed items are filtered before the per-token window so the limit budget
 * is not consumed by the excluded corpus.
 */
function multiTokenSearch(
  fuse: Fuse<IndexItem>,
  tokens: string[],
  limit: number,
  allowedTypes?: Set<IndexItem['type']>
): MergedResult[] {
  const resultMap = new Map<string, { item: IndexItem; scores: number[] }>();

  for (const token of tokens) {
    // When restricting to one corpus, widen the per-token window so the
    // dominant corpus (968 symbols vs 109 doc chunks) can't crowd the target
    // corpus's matches out before the type filter runs.
    const results = fuse.search(token, { limit: allowedTypes ? 2000 : limit * 4 });
    // Best (lowest) score per id within this token's results.
    const bestThisToken = new Map<string, { item: IndexItem; score: number }>();
    for (const result of results) {
      if (allowedTypes && !allowedTypes.has(result.item.type)) continue;
      const score = result.score ?? 1;
      const id = result.item.id;
      const prev = bestThisToken.get(id);
      if (!prev || score < prev.score) bestThisToken.set(id, { item: result.item, score });
    }
    for (const [, { item, score }] of bestThisToken) {
      const existing = resultMap.get(item.id);
      if (existing) existing.scores.push(score);
      else resultMap.set(item.id, { item, scores: [score] });
    }
  }

  return [...resultMap.values()]
    .map((entry) => {
      const avgScore = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
      const hits = entry.scores.length;
      // Divide by hit count so items matching more query tokens rank higher
      const boostedScore = avgScore / hits;
      return { item: entry.item, score: boostedScore, hits };
    })
    .filter((r) => r.score < 0.7)
    .sort((a, b) => {
      // Prioritize coverage (more token hits = more relevant), then score
      if (b.hits !== a.hits) return b.hits - a.hits;
      return a.score - b.score;
    })
    .slice(0, limit);
}

/** Format a single param/prop line with optional/required marker. */
function formatParam(p: SymbolParam, kind: 'param' | 'prop'): string {
  const marker = kind === 'param' ? (p.optional ? '?' : '') : p.required ? '' : '?';
  const head = `- \`${p.name}${marker}\` (\`${p.type}\`)`;
  return p.description ? `${head} — ${p.description}` : head;
}

/**
 * Render an SDK symbol hit as an inline, type-accurate block. This delivers the
 * symbol's full signature, params/returns/props and source provenance directly
 * in the search response, so callers need no follow-up lookup tool.
 */
function renderSymbol(sym: SymbolEntry, rank: number, relevancePercent: number): string {
  const rec = sym.record;
  let text = `## ${rank}. ${sym.name}  \`${sym.category}\`\n\n`;
  text += `**Relevance:** ${relevancePercent}%`;

  const prov = [sym.package, sym.sourcePath].filter(Boolean).join(' · **Source:** ');
  if (prov) text += ` | **Package:** ${prov}`;
  if (rec.deprecated) text += ` | ⚠️ **deprecated**`;
  text += `\n\n`;

  if (rec.jsDoc) {
    text += `${rec.jsDoc}\n\n`;
  }

  if (sym.kind === 'hook' || sym.kind === 'function') {
    const params = (rec.params || [])
      .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
      .join(', ');
    const ret = rec.returns || 'void';
    text += '**Signature:**\n```ts\n';
    text += `${sym.name}(${params}): ${ret}\n`;
    text += '```\n\n';
    if (rec.params && rec.params.length > 0) {
      text += `**Parameters:**\n${rec.params.map((p) => formatParam(p, 'param')).join('\n')}\n\n`;
    }
    if (rec.returns) {
      text += `**Returns:** \`${rec.returns}\`\n\n`;
    }
  } else if (sym.kind === 'component') {
    text += `**Component name:** \`${rec.displayName || sym.name}\`\n\n`;
    if (rec.props && rec.props.length > 0) {
      text += `**Props:**\n${rec.props.map((p) => formatParam(p, 'prop')).join('\n')}\n\n`;
    }
  } else if (sym.kind === 'type') {
    if (rec.typeText) {
      text += `**Type:** \`${rec.typeText}\`\n\n`;
    }
  }

  text += `---\n\n`;
  return text;
}

function renderDoc(
  chunk: DocChunk,
  rank: number,
  result: MergedResult,
  detail: SearchDetail = 'summary'
): string {
  const relevancePercent = Math.round((1 - result.score) * 100);
  let text = `## ${rank}. ${chunk.title}\n\n`;
  text += `**Category:** ${chunk.category} | **Relevance:** ${relevancePercent}%`;
  if (result.hits > 1) {
    text += ` | **Matched ${result.hits} terms**`;
  }
  text += `\n\n`;

  text += detail === 'full' ? `${chunk.content}\n\n` : `${summarizeChunk(chunk.content)}\n\n`;

  text += `---\n\n`;
  return text;
}

export async function searchOrderlyDocs(
  query: string,
  limit: number = 5,
  scope: SearchScope = 'auto',
  detail: SearchDetail = 'summary'
): Promise<SearchResult> {
  const docs = documentationData as DocumentationData;

  if (!query.trim()) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a search query.',
        },
      ],
    };
  }

  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `Your query "${query}" contained only common words. Please try a more specific term like "vault", "fees", or "wallet".`,
        },
      ],
    };
  }

  // 'auto' detects intent: a query that matches a known symbol name routes to
  // the SDK corpus; everything else routes to the prose documentation corpus.
  const effectiveScope = scope === 'auto' ? detectScope(query) : scope;
  const allowedTypes: Set<IndexItem['type']> = new Set([
    effectiveScope === 'sdk' ? 'symbol' : 'doc',
  ]);

  const fuse = getFuseInstance();
  const mergedResults = multiTokenSearch(fuse, tokens, limit, allowedTypes);

  if (mergedResults.length === 0) {
    const categories = [...new Set(docs.chunks.map((c) => c.category))];

    return {
      content: [
        {
          type: 'text',
          text:
            `No results found for "${query}".\n\nTry searching for:\n` +
            `- SDK hooks (e.g., "useOrderEntry", "usePositionStream")\n` +
            `- Protocol concepts (e.g., "vault", "leverage", "funding rate")\n` +
            `- Available categories: ${categories.join(', ')}\n\n` +
            `Or use "explain_workflow" for step-by-step guides.` +
            `${provenanceFooter(effectiveScope === 'sdk' ? 'sdk' : 'docs')}`,
        },
      ],
    };
  }

  // Build response
  const scopeLabel = effectiveScope === 'sdk' ? ' (SDK symbols)' : ' (docs)';
  let text = `# Search Results for "${query}"${scopeLabel}\n\n`;
  text += `Found ${mergedResults.length} relevant section${mergedResults.length !== 1 ? 's' : ''}:\n\n`;

  for (let i = 0; i < mergedResults.length; i++) {
    const result = mergedResults[i];
    const relevancePercent = Math.round((1 - result.score) * 100);
    if (result.item.type === 'symbol') {
      text += renderSymbol(result.item.payload as SymbolEntry, i + 1, relevancePercent);
    } else {
      text += renderDoc(result.item.payload as DocChunk, i + 1, result, detail);
    }
  }

  return {
    content: [
      { type: 'text', text: text + provenanceFooter(effectiveScope === 'sdk' ? 'sdk' : 'docs') },
    ],
  };
}

// Export a function to clear the Fuse cache (useful for testing or hot reloading)
export function clearSearchCache(): void {
  fuseInstance = null;
}
