import Fuse from 'fuse.js';
import documentationData from '../data/documentation.json' with { type: 'json' };

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

// Initialize Fuse.js with configuration
// We create the Fuse instance lazily to avoid doing heavy work at module load time
let fuseInstance: Fuse<DocChunk> | null = null;

function getFuseInstance(): Fuse<DocChunk> {
  if (!fuseInstance) {
    const data = documentationData as DocumentationData;

    const fuseOptions = {
      // Search in these fields with different weights
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'content', weight: 0.3 },
        { name: 'keywords', weight: 0.2 },
        { name: 'category', weight: 0.1 },
      ],
      // Fuzzy matching options
      threshold: 0.4, // Lower = more strict, higher = more fuzzy
      distance: 100, // Maximum search distance
      includeScore: true, // Include match scores
      includeMatches: false, // Don't include match details (saves memory)
      minMatchCharLength: 2, // Minimum characters to match
      shouldSort: true, // Sort by score
      // Tokenization for better partial matches
      tokenize: true,
      matchAllTokens: false,
      findAllMatches: true,
      // Location options
      location: 0,
      useExtendedSearch: true, // Enable extended search syntax
    };

    fuseInstance = new Fuse(data.chunks, fuseOptions);
  }

  return fuseInstance;
}

export async function searchOrderlyDocs(query: string, limit: number = 5): Promise<SearchResult> {
  const normalizedQuery = query.toLowerCase().trim();
  const data = documentationData as DocumentationData;

  if (!normalizedQuery) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a search query.',
        },
      ],
    };
  }

  const fuse = getFuseInstance();

  // Perform fuzzy search
  const searchResults = fuse.search(normalizedQuery, {
    limit: limit * 2, // Get more results initially to filter by quality
  });

  // Filter out very low-quality matches (score > 0.7 is pretty poor)
  const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.7);

  // Take top results up to the limit
  const topResults = qualityResults.slice(0, limit);

  if (topResults.length === 0) {
    // Try to suggest related content
    const categories = [...new Set(data.chunks.map((c) => c.category))];

    return {
      content: [
        {
          type: 'text',
          text:
            `No results found for "${query}".\n\nTry searching for:\n` +
            `- SDK hooks (e.g., "useOrderEntry", "usePositionStream")\n` +
            `- Protocol concepts (e.g., "vault", "leverage", "funding rate")\n` +
            `- Available categories: ${categories.join(', ')}\n\n` +
            `Or use specific tools like:\n` +
            `- "get_sdk_pattern" for hook examples\n` +
            `- "explain_workflow" for step-by-step guides`,
        },
      ],
    };
  }

  // Build response
  let text = `# Search Results for "${query}"\n\n`;
  text += `Found ${topResults.length} relevant section${topResults.length !== 1 ? 's' : ''}:\n\n`;

  for (let i = 0; i < topResults.length; i++) {
    const result = topResults[i];
    const chunk = result.item;
    const score = result.score ?? 1;
    const relevancePercent = Math.round((1 - score) * 100);

    text += `## ${i + 1}. ${chunk.title}\n\n`;
    text += `**Category:** ${chunk.category} | **Relevance:** ${relevancePercent}%\n\n`;
    text += `${chunk.content}\n\n`;

    if (chunk.keywords.length > 0) {
      text += `*Keywords: ${chunk.keywords.join(', ')}*\n\n`;
    }

    text += `---\n\n`;
  }

  // Add note about SDK patterns
  const hasSdkContent = topResults.some((r) => r.item.category === 'SDK');
  if (!hasSdkContent && (normalizedQuery.includes('hook') || normalizedQuery.includes('use'))) {
    text += `\n**Tip:** For specific SDK hook examples, try using the "get_sdk_pattern" tool with the hook name.\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

// Export a function to clear the Fuse cache (useful for testing or hot reloading)
export function clearSearchCache(): void {
  fuseInstance = null;
}
