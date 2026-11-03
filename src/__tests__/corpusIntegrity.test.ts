import { describe, it, expect } from 'vitest';
import documentationData from '../data/documentation.json' with { type: 'json' };
import workflowsData from '../data/workflows.json' with { type: 'json' };

interface DocChunk {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
}

interface Workflow {
  name: string;
  description: string;
  steps: Array<{ title: string; description: string }>;
}

const chunks = (documentationData as { chunks: DocChunk[] }).chunks;
const workflows = (workflowsData as { workflows: Workflow[] }).workflows;

describe('documentation corpus integrity', () => {
  it('has unique ids and a matching totalChunks', () => {
    const ids = chunks.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect((documentationData as { metadata: { totalChunks: number } }).metadata.totalChunks).toBe(
      chunks.length
    );
  });

  it('gives every chunk a title, category, keywords, and substantive content', () => {
    for (const chunk of chunks) {
      expect(chunk.title.trim().length, chunk.id).toBeGreaterThan(0);
      expect(chunk.category.trim().length, chunk.id).toBeGreaterThan(0);
      expect(chunk.keywords.length, chunk.id).toBeGreaterThan(0);
      expect(chunk.content.length, chunk.id).toBeGreaterThan(500);
    }
  });

  it('keeps chunk titles unique', () => {
    const titles = chunks.map((chunk) => chunk.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('workflow corpus integrity', () => {
  it('has unique names and a matching totalWorkflows', () => {
    const names = workflows.map((workflow) => workflow.name);
    expect(new Set(names).size).toBe(names.length);
    expect(
      (workflowsData as { metadata: { totalWorkflows: number } }).metadata.totalWorkflows
    ).toBe(workflows.length);
  });

  it('gives every workflow a description and at least two steps', () => {
    for (const workflow of workflows) {
      expect(workflow.description.trim().length, workflow.name).toBeGreaterThan(0);
      expect(workflow.steps.length, workflow.name).toBeGreaterThanOrEqual(2);
      for (const step of workflow.steps) {
        expect(step.title.trim().length, workflow.name).toBeGreaterThan(0);
        expect(step.description.trim().length, workflow.name).toBeGreaterThan(0);
      }
    }
  });

  it('keeps curated core workflows present', () => {
    const names = new Set(workflows.map((workflow) => workflow.name));
    expect(names.has('Deposit Funds into an Orderly Account')).toBe(true);
    expect(names.has('Withdraw Funds from Orderly')).toBe(true);
    expect(names.has('Place and Manage a Limit Order')).toBe(true);
  });

  it('resolves related-workflow references in the curated workflows', () => {
    const names = new Set(workflows.map((workflow) => workflow.name));
    for (const workflowName of [
      'Deposit Funds into an Orderly Account',
      'Withdraw Funds from Orderly',
      'Place and Manage a Limit Order',
    ]) {
      const workflow = workflows.find((item) => item.name === workflowName);
      expect(workflow, workflowName).toBeDefined();
      for (const related of (workflow as Workflow & { relatedWorkflows?: string[] })
        .relatedWorkflows ?? []) {
        expect(names.has(related), `${workflowName} -> ${related}`).toBe(true);
      }
    }
  });
});
