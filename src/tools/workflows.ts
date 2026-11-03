import Fuse from 'fuse.js';
import workflowsData from '../data/workflows.json' with { type: 'json' };
import { addDomainAliases, hasNearWord, makeWordSet, normalizeWord } from './lexical.js';

export interface WorkflowResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface WorkflowStep {
  title: string;
  description: string;
  code?: string;
  important?: string | string[];
}

interface CommonIssue {
  issue: string;
  solution: string;
}

interface Workflow {
  name: string;
  description: string;
  prerequisites?: string[];
  steps: WorkflowStep[];
  commonIssues?: string[] | CommonIssue[];
  relatedWorkflows?: string[];
}

// Words stripped from workflow queries so "wallet-connection" doesn't
// waste a token on a generic word.
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'for',
  'and',
  'or',
  'with',
  'of',
  'to',
  'in',
  'on',
  'how',
  'your',
  'via',
  'using',
]);

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
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
      threshold: 0.5,
      distance: 200,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
      ignoreLocation: true,
      findAllMatches: true,
    };

    fuseInstance = new Fuse(workflows, fuseOptions);
  }

  return fuseInstance;
}

interface MergedResult {
  workflow: Workflow;
  score: number;
  hits: number;
  strongHits: number;
  lexical: number;
  titleNear: number;
  nameFirstIndex: number;
}

interface WorkflowWords {
  name: Set<string>;
  nameSequence: string[];
  description: Set<string>;
  steps: Set<string>;
}

const workflowWordsCache = new Map<string, WorkflowWords>();

function addAliases(words: Set<string>, text: string): Set<string> {
  addDomainAliases(words, text);
  return words;
}

function wordsFor(workflow: Workflow): WorkflowWords {
  const cached = workflowWordsCache.get(workflow.name);
  if (cached) return cached;
  const stepsText = workflow.steps.map((step) => `${step.title} ${step.description}`).join(' ');
  const words: WorkflowWords = {
    name: addAliases(makeWordSet(workflow.name), workflow.name),
    nameSequence: workflow.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 2)
      .map(normalizeWord),
    description: addAliases(makeWordSet(workflow.description), workflow.description),
    steps: addAliases(makeWordSet(stepsText), stepsText),
  };
  workflowWordsCache.set(workflow.name, words);
  return words;
}

/**
 * Multi-token search: run Fuse for each token individually, then merge.
 * Exact word matches in the workflow name/description outrank fuzzy matches on
 * common words, so "deposit" doesn't match "Deposited Under Wrong Broker ID"
 * ahead of an actual deposit workflow.
 */
function multiTokenSearch(fuse: Fuse<Workflow>, tokens: string[], limit: number): MergedResult[] {
  const resultMap = new Map<string, { workflow: Workflow; scores: number[]; hits: number }>();

  for (const token of tokens) {
    const results = fuse.search(token, { limit: limit * 6 });
    for (const result of results) {
      const score = result.score ?? 1;
      const existing = resultMap.get(result.item.name);
      if (existing) {
        existing.scores.push(score);
        existing.hits++;
      } else {
        resultMap.set(result.item.name, {
          workflow: result.item,
          scores: [score],
          hits: 1,
        });
      }
    }
  }

  return [...resultMap.values()]
    .map((entry) => {
      const avgScore = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
      const words = wordsFor(entry.workflow);
      let strongHits = 0;
      let lexical = 0;
      let titleNear = 0;
      let nameFirstIndex = Number.POSITIVE_INFINITY;

      for (const token of tokens) {
        const normalized = normalizeWord(token);
        if (!normalized) continue;
        if (words.name.has(normalized)) {
          strongHits++;
          lexical += 4;
          const index = words.nameSequence.indexOf(normalized);
          if (index >= 0 && index < nameFirstIndex) nameFirstIndex = index;
        } else if (words.description.has(normalized)) {
          strongHits++;
          lexical += 2;
        } else if (words.steps.has(normalized)) {
          lexical += 1;
        } else if (hasNearWord(words.name, normalized)) {
          titleNear++;
        }
      }

      return {
        workflow: entry.workflow,
        score: avgScore,
        hits: entry.hits,
        strongHits,
        lexical,
        titleNear,
        nameFirstIndex,
      };
    })
    .sort((a, b) => {
      if (b.strongHits !== a.strongHits) return b.strongHits - a.strongHits;
      if (b.lexical !== a.lexical) return b.lexical - a.lexical;
      if (b.titleNear !== a.titleNear) return b.titleNear - a.titleNear;
      // For single-token lookups, prefer the name where the token appears
      // earliest ("Deposit Funds..." beats "...Vault Deposits").
      if (tokens.length === 1 && a.nameFirstIndex !== b.nameFirstIndex) {
        return a.nameFirstIndex - b.nameFirstIndex;
      }
      if (b.hits !== a.hits) return b.hits - a.hits;
      return a.score - b.score;
    })
    .slice(0, limit);
}

export async function explainWorkflow(workflow: string): Promise<WorkflowResult> {
  if (!workflow.trim()) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a workflow name to search for.',
        },
      ],
    };
  }

  const tokens = tokenizeQuery(workflow);

  if (tokens.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `Your query "${workflow}" contained only common words. Please try a more specific term like "wallet", "deposit", or "fees".`,
        },
      ],
    };
  }

  const fuse = getFuseInstance();
  const mergedResults = multiTokenSearch(fuse, tokens, 5);

  // Quality cutoff: exact lexical hits always qualify; fuzzy-only matches must
  // clear a score bar (0.5 single-token, 0.6 when multiple tokens agree).
  const qualityResults = mergedResults.filter(
    (r) =>
      r.strongHits > 0 ||
      r.lexical > 0 ||
      r.titleNear > 0 ||
      r.score < 0.5 ||
      (r.hits >= 2 && r.score < 0.6)
  );

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

  // Check for exact/substring match on the name (highest priority).
  // Compare the raw lowercased input (with kebab→space) so stopwords like
  // "the"/"with" in the workflow name don't break the match.
  const rawNormalized = workflow.toLowerCase().trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  const exactMatch = qualityResults.find((r) => r.workflow.name.toLowerCase() === rawNormalized);
  // Also check if all query tokens appear in the workflow name
  const tokenMatch = qualityResults.find((r) => {
    const nameLower = r.workflow.name.toLowerCase();
    return tokens.every((t) => nameLower.includes(t));
  });

  const match = exactMatch?.workflow || tokenMatch?.workflow || qualityResults[0].workflow;

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

    if (step.important) {
      const imp = Array.isArray(step.important) ? step.important : [step.important];
      if (imp.length > 0) {
        text += `> **Important:** ${imp.join(' ')}\n\n`;
      }
    }
  });

  if (match.commonIssues && match.commonIssues.length > 0) {
    const issues = match.commonIssues.map((i) => {
      if (typeof i === 'string') return `- ${i}`;
      return `- **${i.issue}** ${i.solution}`;
    });
    text += `## Common Issues\n\n${issues.join('\n')}\n\n`;
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
  workflowWordsCache.clear();
}
