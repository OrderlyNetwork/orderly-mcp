import sdkPatterns from '../data/sdk-patterns.json' with { type: 'json' };

export interface SdkPatternResult {
  content: Array<{ type: 'text'; text: string }>;
}

export async function getSdkPattern(
  pattern: string,
  includeExample: boolean = true
): Promise<SdkPatternResult> {
  const normalizedPattern = pattern.toLowerCase().replace(/[-_]/g, '');

  // Search through all patterns for a match
  const matches: Array<{
    name: string;
    category: string;
    description: string;
    installation?: string;
    usage: string;
    example?: string;
    notes?: string[];
    related?: string[];
  }> = [];

  for (const category of sdkPatterns.categories) {
    for (const p of category.patterns) {
      const normalizedName = p.name.toLowerCase().replace(/[-_]/g, '');
      if (
        normalizedName.includes(normalizedPattern) ||
        normalizedPattern.includes(normalizedName) ||
        p.description.toLowerCase().includes(normalizedPattern)
      ) {
        matches.push({ ...p, category: category.name });
      }
    }
  }

  if (matches.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No SDK pattern found for "${pattern}".\n\nAvailable patterns:\n${getAvailablePatterns()}`,
        },
      ],
    };
  }

  // If multiple matches, list them
  if (matches.length > 1 && !matches.some((m) => m.name.toLowerCase() === pattern.toLowerCase())) {
    return {
      content: [
        {
          type: 'text',
          text: `Multiple patterns found for "${pattern}":\n\n${matches
            .map((m) => `- **${m.name}** (${m.category}): ${m.description}`)
            .join('\n')}\n\nPlease specify a specific pattern name.`,
        },
      ],
    };
  }

  // Return the best match
  const bestMatch =
    matches.find((m) => m.name.toLowerCase() === pattern.toLowerCase()) || matches[0];

  let text = `# ${bestMatch.name}\n\n**Category:** ${bestMatch.category}\n\n${bestMatch.description}\n\n`;

  if (bestMatch.installation) {
    text += `## Installation\n\n${bestMatch.installation}\n\n`;
  }

  text += `## Usage\n\n${bestMatch.usage}\n\n`;

  if (includeExample && bestMatch.example) {
    text += `## Example\n\n${bestMatch.example}\n\n`;
  }

  if (bestMatch.notes && bestMatch.notes.length > 0) {
    text += `## Important Notes\n\n${bestMatch.notes.map((n) => `- ${n}`).join('\n')}\n\n`;
  }

  if (bestMatch.related && bestMatch.related.length > 0) {
    text += `## Related Patterns\n\n${bestMatch.related.map((r) => `- ${r}`).join('\n')}\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

function getAvailablePatterns(): string {
  const patterns: string[] = [];
  for (const category of sdkPatterns.categories) {
    for (const p of category.patterns) {
      patterns.push(`${p.name} (${category.name})`);
    }
  }
  return patterns.join('\n');
}
