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

export async function explainWorkflow(workflow: string): Promise<WorkflowResult> {
  const normalizedWorkflow = workflow.toLowerCase().replace(/[-_]/g, '');

  const workflows = (workflowsData as { workflows: Workflow[] }).workflows;

  // Find matching workflow
  const match = workflows.find((w) => {
    const normalizedName = w.name.toLowerCase().replace(/[-_]/g, '');
    return (
      normalizedName === normalizedWorkflow ||
      normalizedName.includes(normalizedWorkflow) ||
      normalizedWorkflow.includes(normalizedName)
    );
  });

  if (!match) {
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
