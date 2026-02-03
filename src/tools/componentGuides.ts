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

export async function getComponentGuide(
  component: string,
  complexity: string = 'standard'
): Promise<ComponentGuideResult> {
  const normalizedComponent = component.toLowerCase().replace(/[-_]/g, '');
  const normalizedComplexity = complexity.toLowerCase().trim();

  const guides = (componentGuides as { components: ComponentGuide[] }).components;

  // Find matching component
  const match = guides.find((g) => {
    const normalizedName = g.name.toLowerCase().replace(/[-_]/g, '');
    return (
      normalizedName === normalizedComponent ||
      normalizedName.includes(normalizedComponent) ||
      normalizedComponent.includes(normalizedName)
    );
  });

  if (!match) {
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
