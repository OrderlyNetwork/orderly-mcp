import Fuse from 'fuse.js';
import workflowsData from '../data/workflows.json' with { type: 'json' };

export interface WorkflowResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface WorkflowStep {
  title: string;
  description: string;
  code?: string;
  important?: string[];
}

interface Workflow {
  name: string;
  description: string;
  prerequisites?: string[];
  steps: WorkflowStep[];
  commonIssues?: string[];
  relatedWorkflows?: string[];
}

// Initialize Fuse instance lazily
let fuseInstance: Fuse<Workflow> | null = null;

function getFuseInstance(): Fuse<Workflow> {
  if (!fuseInstance) {
    const workflows = (workflowsData as { workflows: Workflow[] }).workflows;

    const fuseOptions = {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'description', weight: 0.35 },
        { name: 'steps.title', weight: 0.15 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    };

    fuseInstance = new Fuse(workflows, fuseOptions);
  }

  return fuseInstance;
}

export async function explainWorkflow(workflow: string): Promise<WorkflowResult> {
  const normalizedWorkflow = workflow.toLowerCase().trim();

  if (!normalizedWorkflow) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a workflow name to search for.',
        },
      ],
    };
  }

  const fuse = getFuseInstance();
  const searchResults = fuse.search(normalizedWorkflow, { limit: 5 });

  // Filter out poor matches
  const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.6);

  if (qualityResults.length === 0) {
    const workflows = (workflowsData as { workflows: Workflow[] }).workflows;
    const availableWorkflows = workflows.map((w) => w.name).join(', ');
    return {
      content: [
        {
          type: 'text',
          text: `Workflow "${workflow}" not found.\n\nAvailable workflows: ${availableWorkflows}`,
        },
      ],
    };
  }

  // Check for exact match
  const exactMatch = qualityResults.find(
    (r) =>
      r.item.name.toLowerCase().replace(/[-_]/g, '') === normalizedWorkflow.replace(/[-_]/g, '')
  );

  // Return exact match or best match
  const match = exactMatch?.item || qualityResults[0].item;

  let text = `# ${match.name}\n\n${match.description}\n\n`;

  if (match.prerequisites && match.prerequisites.length > 0) {
    text += `## Prerequisites\n\n${match.prerequisites.map((p) => `- ${p}`).join('\n')}\n\n`;
  }

  text += `## Steps\n\n`;

  match.steps.forEach((step, index) => {
    text += `${index + 1}. **${step.title}**\n\n`;
    text += `${step.description}\n\n`;

    if (step.code) {
      text += `\`\`\`typescript\n${step.code}\n\`\`\`\n\n`;
    }

    if (step.important && step.important.length > 0) {
      text += `> **Important:** ${step.important.join(' ')}\n\n`;
    }
  });

  if (match.commonIssues && match.commonIssues.length > 0) {
    text += `## Common Issues\n\n${match.commonIssues.map((i) => `- ${i}`).join('\n')}\n\n`;
  }

  if (match.relatedWorkflows && match.relatedWorkflows.length > 0) {
    text += `## Related Workflows\n\n${match.relatedWorkflows.map((r) => `- ${r}`).join('\n')}\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

// Export function to clear cache (useful for testing)
export function clearWorkflowCache(): void {
  fuseInstance = null;
}
