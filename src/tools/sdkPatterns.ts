import Fuse from 'fuse.js';
import sdkPatterns from '../data/sdk-patterns.json' with { type: 'json' };

export interface SdkPatternResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface Pattern {
  name: string;
  description: string;
  installation?: string;
  usage: string;
  example?: string;
  notes?: (string | null)[];
  related?: (string | null)[];
}

interface Category {
  name: string;
  patterns: Pattern[];
}

// Flatten patterns for Fuse.js search
function getAllPatterns(): Array<Pattern & { category: string }> {
  const patterns: Array<Pattern & { category: string }> = [];
  for (const category of (sdkPatterns as { categories: Category[] }).categories) {
    for (const p of category.patterns) {
      patterns.push({
        ...p,
        category: category.name,
        notes:
          p.notes?.map((n) => (n === null ? '' : n)).filter((n): n is string => n !== '') ?? [],
        related:
          p.related?.map((r) => (r === null ? '' : r)).filter((r): r is string => r !== '') ?? [],
      });
    }
  }
  return patterns;
}

// Initialize Fuse instance lazily
let fuseInstance: Fuse<Pattern & { category: string }> | null = null;

function getFuseInstance(): Fuse<Pattern & { category: string }> {
  if (!fuseInstance) {
    const patterns = getAllPatterns();

    const fuseOptions = {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'description', weight: 0.3 },
        { name: 'usage', weight: 0.15 },
        { name: 'category', weight: 0.05 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    };

    fuseInstance = new Fuse(patterns, fuseOptions);
  }

  return fuseInstance;
}

export async function getSdkPattern(
  pattern: string,
  includeExample: boolean = true
): Promise<SdkPatternResult> {
  const normalizedPattern = pattern.toLowerCase().trim();

  if (!normalizedPattern) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a pattern name to search for.',
        },
      ],
    };
  }

  const fuse = getFuseInstance();
  const searchResults = fuse.search(normalizedPattern, { limit: 10 });

  // Filter out poor matches
  const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.6);

  if (qualityResults.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No SDK pattern found for "${pattern}".\n\nAvailable patterns:\n${getAvailablePatterns()}`,
        },
      ],
    };
  }

  // Check for exact match first
  const exactMatch = qualityResults.find(
    (r) => r.item.name.toLowerCase() === normalizedPattern.replace(/[-_]/g, '')
  );

  // If we have an exact match or only one result, return it
  if (exactMatch || qualityResults.length === 1) {
    const bestMatch = exactMatch?.item || qualityResults[0].item;
    return formatPatternResult(bestMatch, includeExample);
  }

  // If multiple good matches, list them with relevance scores
  return {
    content: [
      {
        type: 'text',
        text: `Multiple patterns found for "${pattern}":\n\n${qualityResults
          .slice(0, 5)
          .map(
            (r) =>
              `- **${r.item.name}** (${r.item.category}) - ${Math.round(
                (1 - (r.score ?? 0)) * 100
              )}% match: ${r.item.description.slice(0, 100)}...`
          )
          .join('\n')}\n\nPlease specify a specific pattern name.`,
      },
    ],
  };
}

function formatPatternResult(
  pattern: Pattern & { category: string },
  includeExample: boolean
): SdkPatternResult {
  let text = `# ${pattern.name}\n\n**Category:** ${pattern.category}\n\n${pattern.description}\n\n`;

  if (pattern.installation) {
    text += `## Installation\n\n${pattern.installation}\n\n`;
  }

  text += `## Usage\n\n${pattern.usage}\n\n`;

  if (includeExample && pattern.example) {
    text += `## Example\n\n${pattern.example}\n\n`;
  }

  if (pattern.notes && pattern.notes.length > 0) {
    text += `## Important Notes\n\n${pattern.notes.map((n) => `- ${n}`).join('\n')}\n\n`;
  }

  if (pattern.related && pattern.related.length > 0) {
    text += `## Related Patterns\n\n${pattern.related.map((r) => `- ${r}`).join('\n')}\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

function getAvailablePatterns(): string {
  const patterns: string[] = [];
  for (const category of (sdkPatterns as { categories: Category[] }).categories) {
    for (const p of category.patterns) {
      patterns.push(`${p.name} (${category.name})`);
    }
  }
  return patterns.join('\n');
}

// Export function to clear cache (useful for testing)
export function clearSdkPatternCache(): void {
  fuseInstance = null;
}
