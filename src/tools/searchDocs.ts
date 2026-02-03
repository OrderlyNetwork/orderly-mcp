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

  // Score each chunk based on relevance
  const scoredChunks = data.chunks.map((chunk) => {
    let score = 0;

    // Check title match
    if (chunk.title.toLowerCase().includes(normalizedQuery)) {
      score += 10;
    }

    // Check content match
    if (chunk.content.toLowerCase().includes(normalizedQuery)) {
      score += 5;
    }

    // Check keywords match
    for (const keyword of chunk.keywords) {
      if (
        keyword.toLowerCase().includes(normalizedQuery) ||
        normalizedQuery.includes(keyword.toLowerCase())
      ) {
        score += 3;
      }
    }

    // Check individual words in query
    const queryWords = normalizedQuery.split(/\s+/);
    for (const word of queryWords) {
      if (word.length > 2) {
        if (chunk.content.toLowerCase().includes(word)) {
          score += 1;
        }
      }
    }

    return { chunk, score };
  });

  // Sort by score and get top results
  const topResults = scoredChunks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

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
            `- \\"get_sdk_pattern\\" for hook examples\n` +
            `- \\"explain_workflow\\" for step-by-step guides`,
        },
      ],
    };
  }

  // Build response
  let text = `# Search Results for "${query}"\n\n`;
  text += `Found ${topResults.length} relevant section${topResults.length !== 1 ? 's' : ''}:\n\n`;

  for (let i = 0; i < topResults.length; i++) {
    const { chunk, score } = topResults[i];
    text += `## ${i + 1}. ${chunk.title}\n\n`;
    text += `**Category:** ${chunk.category} | **Relevance:** ${score}\n\n`;
    text += `${chunk.content}\n\n`;

    if (chunk.keywords.length > 0) {
      text += `*Keywords: ${chunk.keywords.join(', ')}*\n\n`;
    }

    text += `---\n\n`;
  }

  // Add note about SDK patterns
  const hasSdkContent = topResults.some((r) => r.chunk.category === 'SDK');
  if (!hasSdkContent && (normalizedQuery.includes('hook') || normalizedQuery.includes('use'))) {
    text += `\n**Tip:** For specific SDK hook examples, try using the "get_sdk_pattern" tool with the hook name.\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}
