import Fuse from 'fuse.js';
import publicInfoApiData from '../data/public-info-api.json' with { type: 'json' };

export interface PublicInfoApiResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface RequestParam {
  name: string;
  type: string;
  required: boolean;
  default: string;
  notes: string;
}

interface ResponseSection {
  heading: string;
  markdown: string;
}

interface ResponseExample {
  label: string;
  code: string;
}

interface QueryType {
  type: string;
  title: string;
  category: string;
  slug: string;
  description: string;
  intro: string;
  weight: number | null;
  requestExample: string;
  requestParams: RequestParam[];
  responseSections: ResponseSection[];
  responseExamples: ResponseExample[];
  notes: string[];
  paginated: boolean;
  path: string;
}

interface Category {
  name: string;
  title: string;
  description: string;
  queryTypes: string[];
}

interface WeightEntry {
  weight: number;
  types: string[];
}

interface FreshnessEntry {
  type: string;
  field: string;
  freshness: string;
}

interface ErrorCode {
  code: string;
  http: number;
  meaning: string;
}

interface PublicInfoApiData {
  version: string;
  title: string;
  description: string;
  endpoint: { method: string; url: string; contentType: string };
  auth: string;
  categories: Category[];
  queryTypes: QueryType[];
  overview: {
    responseEnvelope: string | null;
    errorCodes: ErrorCode[];
    addressResolution: Array<{ input: string; scope: string }>;
    pagination: { description: string; cursorShapes: Array<{ endpoints: string; shape: string }> };
    rateLimits: {
      weightPerMinute: number;
      weightByType: WeightEntry[];
      responseHeaders: string;
      overQuotaExample: string | null;
    };
    freshness: FreshnessEntry[];
  };
}

const data = publicInfoApiData as unknown as PublicInfoApiData;

let fuseInstance: Fuse<QueryType> | null = null;

function getFuseInstance(): Fuse<QueryType> {
  if (!fuseInstance) {
    fuseInstance = new Fuse(data.queryTypes, {
      keys: [
        { name: 'type', weight: 0.4 },
        { name: 'title', weight: 0.25 },
        { name: 'description', weight: 0.2 },
        { name: 'intro', weight: 0.1 },
        { name: 'notes', weight: 0.05 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    });
  }
  return fuseInstance;
}

function findQueryType(queryType: string): QueryType | null {
  const needle = queryType.toLowerCase().trim();
  // 1. Exact match on the type name (most common case).
  const exact = data.queryTypes.find((q) => q.type.toLowerCase() === needle);
  if (exact) return exact;
  // 2. Contained match on the type or slug.
  const partial = data.queryTypes.find(
    (q) => q.type.toLowerCase().includes(needle) || q.slug.toLowerCase().includes(needle)
  );
  if (partial) return partial;
  // 3. All-tokens-present match against type / title / description.
  const tokens = needle.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const tokenMatch = data.queryTypes.find((q) => {
      const haystack = `${q.type} ${q.title} ${q.description}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
    if (tokenMatch) return tokenMatch;
  }
  // 4. Fuzzy search across all fields as a last resort.
  const results = getFuseInstance().search(needle, { limit: 1 });
  if (results.length > 0 && (results[0].score ?? 1) < 0.6) {
    return results[0].item;
  }
  return null;
}

function findCategory(name: string): Category | null {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[_-]+/g, ' ');
  const needle = normalize(name);
  return (
    data.categories.find(
      (c) => normalize(c.name) === needle || normalize(c.title).includes(needle)
    ) || null
  );
}

function renderWeight(weight: number | null): string {
  if (weight === null) return '—';
  if (weight === 0) return '`0` (free)';
  return `\`${weight}\``;
}

function buildCurl(requestExample: string): string {
  const body = requestExample.trim() || '{ "type": "<queryType>" }';
  return `curl -s -XPOST -H "Content-Type: application/json" \\
  ${data.endpoint.url} \\
  -d '${body.replace(/\n/g, '\n  ')}'`;
}

function renderQueryTypeDetail(qt: QueryType): string {
  let text = `# ${qt.title}\n\n`;
  text += `\`type: "${qt.type}"\`  ·  category: **${qt.category}**  ·  weight: ${renderWeight(qt.weight)}${qt.paginated ? '  ·  paginated' : ''}\n\n`;

  if (qt.description) {
    text += `${qt.description}\n\n`;
  }
  if (qt.intro && qt.intro !== qt.description) {
    text += `${qt.intro}\n\n`;
  }

  // Request parameters
  text += `## Request\n\n`;
  if (qt.requestParams.length > 0) {
    text += `| Field | Type | Required | Default | Notes |\n`;
    text += `| --- | --- | --- | --- | --- |\n`;
    for (const p of qt.requestParams) {
      text += `| \`${p.name}\` | ${p.type} | ${p.required ? 'Yes' : 'No'} | ${p.default || '—'} | ${p.notes.replace(/\|/g, '\\|')} |\n`;
    }
    text += '\n';
  } else {
    text += `*No parameters beyond \`{"type":"${qt.type}"}\`.*\n\n`;
  }

  if (qt.requestExample) {
    text += `**Example request:**\n\n\`\`\`bash\n${buildCurl(qt.requestExample)}\n\`\`\`\n\n`;
    text += `<details><summary>Request body</summary>\n\n\`\`\`json\n${qt.requestExample}\n\`\`\`\n\n</details>\n\n`;
  }

  // Response fields
  if (qt.responseSections.length > 0) {
    text += `## Response fields\n\n`;
    for (const section of qt.responseSections) {
      if (qt.responseSections.length > 1) {
        text += `### ${section.heading}\n\n`;
      }
      text += `${section.markdown}\n\n`;
    }
  }

  // Response examples
  if (qt.responseExamples.length > 0) {
    text += `## Response example\n\n`;
    for (const ex of qt.responseExamples) {
      if (ex.label) {
        text += `**${ex.label}:**\n\n`;
      }
      text += `\`\`\`json\n${ex.code}\n\`\`\`\n\n`;
    }
  }

  // Notes
  if (qt.notes.length > 0) {
    text += `## Notes\n\n`;
    for (const note of qt.notes) {
      text += `- ${note}\n`;
    }
    text += '\n';
  }

  // Freshness (if available)
  const freshness = data.overview.freshness.filter((f) => f.type === qt.type);
  if (freshness.length > 0) {
    text += `## Data freshness\n\n`;
    text += `| Field | Worst-case freshness |\n| --- | --- |\n`;
    for (const f of freshness) {
      text += `| ${f.field} | ${f.freshness} |\n`;
    }
    text += '\n';
  }

  text += `*Docs: ${qt.path}*\n`;
  return text;
}

function renderCategory(cat: Category): string {
  let text = `# ${cat.title}\n\n`;
  text += `${cat.description}\n\n`;
  text += `## Query types (${cat.queryTypes.length})\n\n`;
  text += `| Type | Weight | Description |\n`;
  text += `| --- | --- | --- |\n`;
  for (const typeName of cat.queryTypes) {
    const qt = data.queryTypes.find((q) => q.type === typeName);
    if (!qt) continue;
    text += `| \`${qt.type}\` | ${renderWeight(qt.weight)} | ${qt.description.split('.')[0]}. |\n`;
  }
  text += `\nGet full details for any type, e.g. \`get_public_info_api_info queryType="${cat.queryTypes[0]}"\`.\n`;
  return text;
}

function renderOverview(): string {
  const { endpoint, overview } = data;
  let text = `# ${data.title}\n\n`;
  text += `${data.description}\n\n`;

  text += `## Endpoint\n\n`;
  text += `\`\`\`\n${endpoint.method} ${endpoint.url}\nContent-Type: ${endpoint.contentType}\n\n{ "type": "<query type>", ...params }\n\`\`\`\n\n`;
  text += `- **Auth:** none (zero-auth, callable from any IP)\n`;
  text += `- **Rate-limit pool:** independent — does **not** share quota with the REST/WebSocket APIs\n`;
  text += `- **Weight budget:** ${overview.rateLimits.weightPerMinute}/min per IP (rolling 1-minute window)\n\n`;

  text += `### Quick start\n\n`;
  text += `\`\`\`bash\n# Market snapshot (weight 1)\ncurl -s -XPOST -H "Content-Type: application/json" \\\n  ${endpoint.url} -d '{"type":"marketSummary"}'\n\n# Account state by address (weight 5)\ncurl -s -XPOST -H "Content-Type: application/json" \\\n  ${endpoint.url} -d '{"type":"accountState","address":"0x1234..."}'\n\n# Free quota check (weight 0)\ncurl -s -XPOST -H "Content-Type: application/json" \\\n  ${endpoint.url} -d '{"type":"rateLimitStatus"}'\n\`\`\`\n\n`;

  text += `## Weight per query type\n\n`;
  text += `| Weight | Query types |\n| --- | --- |\n`;
  for (const entry of [...overview.rateLimits.weightByType].sort((a, b) => a.weight - b.weight)) {
    text += `| ${renderWeight(entry.weight)} | ${entry.types.map((t) => `\`${t}\``).join(', ')} |\n`;
  }
  text += '\n';

  if (overview.errorCodes.length > 0) {
    text += `## Error codes\n\n`;
    text += `| Code | HTTP | Meaning |\n| --- | --- | --- |\n`;
    for (const e of overview.errorCodes) {
      text += `| \`${e.code}\` | ${e.http} | ${e.meaning.replace(/\|/g, '\\|')} |\n`;
    }
    text += '\n';
  }

  text += `## Pagination\n\n`;
  text += `Paginated endpoints return \`data.next_cursor\` (opaque Base64; \`null\` on the last page). Pass it back as \`cursor\`. Treat cursors as opaque.\n\n`;
  if (overview.pagination.cursorShapes.length > 0) {
    text += `| Endpoint(s) | Cursor shape |\n| --- | --- |\n`;
    for (const c of overview.pagination.cursorShapes) {
      text += `| ${c.endpoints} | ${c.shape.replace(/\|/g, '\\|')} |\n`;
    }
    text += '\n';
  }

  text += `## Categories\n\n`;
  for (const cat of data.categories) {
    text += `### ${cat.title} (\`${cat.name}\`) — ${cat.queryTypes.length} types\n\n`;
    text += `${cat.description}\n\n`;
    text += `Browse with \`get_public_info_api_info category="${cat.name}"\`.\n\n`;
  }

  text += `## How to use this tool\n\n`;
  text += `1. **Overview** (no params) — this page.\n`;
  text += `2. **Browse a category** — \`get_public_info_api_info category="market"\` (market / account / platform / system).\n`;
  text += `3. **Query type detail** — \`get_public_info_api_info queryType="accountState"\` (exact type name; fuzzy search supported).\n\n`;
  text += `Account-data types require an \`address\`; market/platform/system types do not.\n`;

  return text;
}

export async function getPublicInfoApiInfo(
  queryType?: string,
  category?: string
): Promise<PublicInfoApiResult> {
  // Query type detail takes precedence.
  if (queryType) {
    const qt = findQueryType(queryType);
    if (qt) {
      return { content: [{ type: 'text', text: renderQueryTypeDetail(qt) }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Query type "${queryType}" not found. Available types: ${data.queryTypes
            .map((q) => q.type)
            .join(', ')}`,
        },
      ],
    };
  }

  // Category browse.
  if (category) {
    const cat = findCategory(category);
    if (cat) {
      return { content: [{ type: 'text', text: renderCategory(cat) }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Category "${category}" not found. Available categories: ${data.categories
            .map((c) => c.name)
            .join(', ')}`,
        },
      ],
    };
  }

  // Overview.
  return { content: [{ type: 'text', text: renderOverview() }] };
}

export function clearPublicInfoApiCache(): void {
  fuseInstance = null;
}
