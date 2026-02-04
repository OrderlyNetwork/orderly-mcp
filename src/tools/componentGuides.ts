import Fuse from 'fuse.js';
import componentGuides from '../data/component-guides.json' with { type: 'json' };

export interface ComponentGuideResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface ComponentVariant {
  complexity: string;
  description: string;
  code: string;
  additionalImports?: string[];
  tips?: string[];
}

interface ComponentGuide {
  name: string;
  description: string;
  requiredPackages: string[];
  keyHooks: string[];
  variants: ComponentVariant[];
  stylingNotes?: string;
  commonMistakes?: string[];
  relatedComponents?: string[];
}

// Initialize Fuse instance lazily
let fuseInstance: Fuse<ComponentGuide> | null = null;

function getFuseInstance(): Fuse<ComponentGuide> {
  if (!fuseInstance) {
    const guides = (componentGuides as { components: ComponentGuide[] }).components;

    const fuseOptions = {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'description', weight: 0.35 },
        { name: 'keyHooks', weight: 0.15 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    };

    fuseInstance = new Fuse(guides, fuseOptions);
  }

  return fuseInstance;
}

export async function getComponentGuide(
  component: string,
  complexity: string = 'standard'
): Promise<ComponentGuideResult> {
  const normalizedComponent = component.toLowerCase().trim();
  const normalizedComplexity = complexity.toLowerCase().trim();

  if (!normalizedComponent) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a component name to search for.',
        },
      ],
    };
  }

  const fuse = getFuseInstance();
  const searchResults = fuse.search(normalizedComponent, { limit: 5 });

  // Filter out poor matches
  const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.6);

  if (qualityResults.length === 0) {
    const guides = (componentGuides as { components: ComponentGuide[] }).components;
    const availableComponents = guides.map((g) => g.name).join(', ');
    return {
      content: [
        {
          type: 'text',
          text: `Component "${component}" not found.\n\nAvailable components: ${availableComponents}`,
        },
      ],
    };
  }

  // Check for exact match
  const exactMatch = qualityResults.find(
    (r) =>
      r.item.name.toLowerCase().replace(/[-_]/g, '') === normalizedComponent.replace(/[-_]/g, '')
  );

  // Use exact match or best match
  const match = exactMatch?.item || qualityResults[0].item;

  let text = `# Building a ${match.name}\n\n${match.description}\n\n`;

  text += `## Required Packages\n\n\`\`\`bash\nnpm install ${match.requiredPackages.join(' ')}\n\`\`\`\n\n`;

  text += `## Key Hooks\n\n`;
  match.keyHooks.forEach((hook) => {
    text += `- \`${hook}\`\n`;
  });
  text += `\n`;

  // Find the right variant
  const variant =
    match.variants.find((v) => v.complexity === normalizedComplexity) ||
    match.variants.find((v) => v.complexity === 'standard') ||
    match.variants[0];

  text += `## ${variant.complexity.charAt(0).toUpperCase() + variant.complexity.slice(1)} Implementation\n\n`;
  text += `${variant.description}\n\n`;

  if (variant.additionalImports && variant.additionalImports.length > 0) {
    text += `### Additional Imports\n\n\`\`\`typescript\n${variant.additionalImports.join('\n')}\n\`\`\`\n\n`;
  }

  text += `### Code Example\n\n\`\`\`tsx\n${variant.code}\n\`\`\`\n\n`;

  if (variant.tips && variant.tips.length > 0) {
    text += `### Implementation Tips\n\n${variant.tips.map((t) => `- ${t}`).join('\n')}\n\n`;
  }

  if (match.stylingNotes) {
    text += `## Styling Notes\n\n${match.stylingNotes}\n\n`;
  }

  if (match.commonMistakes && match.commonMistakes.length > 0) {
    text += `## Common Mistakes to Avoid\n\n${match.commonMistakes.map((m) => `- ${m}`).join('\n')}\n\n`;
  }

  if (match.relatedComponents && match.relatedComponents.length > 0) {
    text += `## Related Components\n\n${match.relatedComponents.map((r) => `- ${r}`).join('\n')}\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

// Export function to clear cache (useful for testing)
export function clearComponentGuideCache(): void {
  fuseInstance = null;
}
