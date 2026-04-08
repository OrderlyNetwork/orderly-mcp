import Fuse from 'fuse.js';
import pythonSdkPatterns from '../data/python-sdk-patterns.json' with { type: 'json' };

export interface PythonSdkResult {
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

function getAllPatterns(): Array<Pattern & { category: string }> {
  const patterns: Array<Pattern & { category: string }> = [];
  for (const category of (pythonSdkPatterns as { categories: Category[] }).categories) {
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

let fuseInstance: Fuse<Pattern & { category: string }> | null = null;

function getFuseInstance(): Fuse<Pattern & { category: string }> {
  if (!fuseInstance) {
    const patterns = getAllPatterns();
    fuseInstance = new Fuse(patterns, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'description', weight: 0.3 },
        { name: 'category', weight: 0.2 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }
  return fuseInstance;
}

export async function getPythonSdkPattern(
  pattern: string,
  includeExample: boolean = true
): Promise<PythonSdkResult> {
  const fuse = getFuseInstance();
  const results = fuse.search(pattern);

  if (results.length === 0) {
    // List all available patterns
    const allPatterns = getAllPatterns();
    const available = allPatterns.map((p) => `- ${p.name} (${p.category}): ${p.description}`);

    return {
      content: [
        {
          type: 'text',
          text: `No Python SDK pattern found for "${pattern}".\n\nAvailable patterns:\n${available.join('\n')}\n\nInstall: pip install agent-trading-sdk\nDocs: github.com/arthur-orderly/agent-trading-sdk`,
        },
      ],
    };
  }

  const match = results[0].item;
  let text = `# Python SDK: ${match.name}\n`;
  text += `Category: ${match.category}\n\n`;
  text += `${match.description}\n\n`;

  if (match.installation) {
    text += `## Installation\n\`\`\`bash\n${match.installation}\n\`\`\`\n\n`;
  }

  text += `## Usage\n${match.usage}\n\n`;

  if (includeExample && match.example) {
    text += `## Example\n\`\`\`python\n${match.example}\n\`\`\`\n\n`;
  }

  if (match.notes && match.notes.length > 0) {
    text += `## Notes\n${match.notes.map((n) => `- ${n}`).join('\n')}\n\n`;
  }

  if (match.related && match.related.length > 0) {
    text += `## Related\n${match.related.map((r) => `- ${r}`).join('\n')}\n`;
  }

  // Show other matches if relevant
  if (results.length > 1) {
    const others = results
      .slice(1, 4)
      .map((r) => `- ${r.item.name}: ${r.item.description}`)
      .join('\n');
    text += `\n## See Also\n${others}\n`;
  }

  return { content: [{ type: 'text', text }] };
}
