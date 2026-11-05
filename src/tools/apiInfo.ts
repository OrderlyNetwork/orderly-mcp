import Fuse from 'fuse.js';
import apiData from '../data/api.json' with { type: 'json' };

export interface ApiInfoResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface ApiEndpoint {
  path: string;
  method: string;
  summary?: string;
  description: string;
  auth: boolean;
  baseUrl?: string | null;
  rateLimit?: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  requestBody?: {
    description?: string;
    contentType?: string;
    schema?: string;
    required?: boolean;
  } | null;
  responses?: Array<{
    code: number;
    description: string;
    schema: string;
  }>;
  example?: string;
}

interface WebSocketStream {
  name: string;
  topic: string;
  description: string;
  auth: boolean;
  parameters?: string[];
  messageFormat?: string;
  example?: string;
}

interface ApiData {
  rest: {
    baseUrl: {
      mainnet: string;
      testnet: string;
    };
    authentication: {
      type: string;
      description: string;
    };
    endpoints: ApiEndpoint[];
  };
  websocket: {
    baseUrl: {
      mainnet: string;
      testnet: string;
    };
    streams: WebSocketStream[];
  };
  auth: {
    description: string;
    steps: string[];
    example: string;
  };
}

// Initialize Fuse instances lazily
let restFuseInstance: Fuse<ApiEndpoint> | null = null;
let wsFuseInstance: Fuse<WebSocketStream> | null = null;

function getRestFuseInstance(): Fuse<ApiEndpoint> {
  if (!restFuseInstance) {
    const data = apiData as ApiData;
    const fuseOptions = {
      keys: [
        { name: 'path', weight: 0.4 },
        { name: 'summary', weight: 0.35 },
        { name: 'description', weight: 0.15 },
        { name: 'method', weight: 0.1 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    };
    restFuseInstance = new Fuse(data.rest.endpoints, fuseOptions);
  }
  return restFuseInstance;
}

function getWsFuseInstance(): Fuse<WebSocketStream> {
  if (!wsFuseInstance) {
    const data = apiData as ApiData;
    const fuseOptions = {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'topic', weight: 0.3 },
        { name: 'description', weight: 0.2 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    };
    wsFuseInstance = new Fuse(data.websocket.streams, fuseOptions);
  }
  return wsFuseInstance;
}

function renderRestEndpoint(match: ApiEndpoint): string {
  let text = `# ${match.method} ${match.path}\n\n`;
  if (match.baseUrl) {
    text += `**Base URL:** ${match.baseUrl}\n\n`;
  }
  if (match.summary) {
    text += `**Summary:** ${match.summary}\n\n`;
  }
  text += `${match.description}\n\n`;
  text += `**Authentication:** ${match.auth ? 'Required 🔒' : 'Not required'}`;
  if (match.rateLimit) {
    text += `\n**Rate Limit:** ${match.rateLimit}`;
  }
  text += `\n\n`;

  if (match.parameters && match.parameters.length > 0) {
    text += `## Parameters\n\n`;
    match.parameters.forEach((param) => {
      text += `- **${param.name}** (${param.type})${param.required ? ' *required*' : ''}\n`;
      text += `  ${param.description}\n\n`;
    });
  }

  if (match.requestBody && match.requestBody.schema) {
    text += `## Request Body${match.requestBody.required ? '' : ' (optional)'}\n\n`;
    if (match.requestBody.description) {
      text += `${match.requestBody.description}\n\n`;
    }
    text += `\`\`\`json\n${match.requestBody.schema}\`\`\`\n\n`;
  }

  if (match.responses && match.responses.length > 0) {
    text += `## Response\n\n`;
    match.responses.forEach((resp) => {
      text += `**${resp.code}** ${resp.description}\n\n`;
      text += `\`\`\`json\n${resp.schema}\`\`\`\n\n`;
    });
  }

  if (match.example) {
    text += `## Example\n\n\`\`\`typescript\n${match.example}\n\`\`\``;
  }

  return text;
}

/**
 * Resolve a REST endpoint query. Exact paths return every method registered on
 * that path (a path like /v1/order has GET/POST/PUT/DELETE handlers); free-text
 * queries match against path, summary, description, and method.
 */
function resolveRestEndpoints(
  endpoints: ApiEndpoint[],
  query: string
): { matches: ApiEndpoint[]; availableMethods?: string[] } | null {
  const methodMatch = query.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/i);
  const method = methodMatch?.[1]?.toUpperCase() ?? null;
  const pathQuery = (methodMatch?.[2] ?? query).trim().toLowerCase();

  const onPath = endpoints.filter((ep) => ep.path.toLowerCase() === pathQuery);
  if (onPath.length > 0) {
    const matches = method ? onPath.filter((ep) => ep.method === method) : onPath;
    if (matches.length === 0) {
      return { matches: [], availableMethods: onPath.map((ep) => ep.method) };
    }
    return { matches };
  }

  const fuse = getRestFuseInstance();
  const results = fuse
    .search(pathQuery, { limit: 5 })
    .filter((result) => (result.score ?? 1) < 0.6);

  if (results.length === 0) return null;

  const bestPath = results[0].item.path;
  const siblings = endpoints.filter((ep) => ep.path === bestPath);

  if (method) {
    const filtered = siblings.filter((ep) => ep.method === method);
    if (filtered.length === 0) {
      return { matches: [], availableMethods: siblings.map((ep) => ep.method) };
    }
    return { matches: filtered };
  }
  // Free-text queries return the single best endpoint; only exact path queries
  // expand to every method registered on that path.
  return { matches: [results[0].item] };
}

export async function getApiInfo(type: string, endpoint?: string): Promise<ApiInfoResult> {
  if (!type) {
    return {
      content: [
        {
          type: 'text',
          text: "Missing required parameter: type. Must be 'rest', 'websocket', or 'auth'.",
        },
      ],
    };
  }
  const normalizedType = type.toLowerCase().trim();
  const data = apiData as ApiData;

  if (!['rest', 'websocket', 'auth'].includes(normalizedType)) {
    return {
      content: [
        {
          type: 'text',
          text: `Invalid API type: ${type}. Must be 'rest', 'websocket', or 'auth'.`,
        },
      ],
    };
  }

  // Handle auth info
  if (normalizedType === 'auth') {
    let text = `# API Authentication\n\n${data.auth.description}\n\n`;

    text += `## Steps\n\n`;
    data.auth.steps.forEach((step, index) => {
      text += `${index + 1}. ${step}\n`;
    });

    text += `\n## Example\n\n\`\`\`typescript\n${data.auth.example}\n\`\`\``;

    return {
      content: [{ type: 'text', text }],
    };
  }

  // Handle REST API
  if (normalizedType === 'rest') {
    if (!endpoint) {
      // List all endpoints
      let text = `# REST API Endpoints\n\n`;
      text += `**Mainnet:** ${data.rest.baseUrl.mainnet}\n`;
      text += `**Testnet:** ${data.rest.baseUrl.testnet}\n\n`;
      text += `**Authentication:** ${data.rest.authentication.type}\n\n`;

      text += `## Available Endpoints\n\n`;
      data.rest.endpoints.forEach((ep) => {
        text += `- **${ep.method} ${ep.path}**${ep.auth ? ' 🔒' : ''}`;
        if (ep.summary) text += ` — ${ep.summary}`;
        if (ep.baseUrl) text += ` [base: ${ep.baseUrl}]`;
        text += '\n';
        if (ep.rateLimit) {
          text += `  Rate limit: ${ep.rateLimit}\n`;
        }
        text += `\n`;
      });

      return {
        content: [{ type: 'text', text }],
      };
    }

    const resolved = resolveRestEndpoints(data.rest.endpoints, endpoint.trim());

    if (!resolved) {
      return {
        content: [
          {
            type: 'text',
            text: `Endpoint "${endpoint}" not found. Use without endpoint parameter to see all available endpoints.`,
          },
        ],
      };
    }

    if (resolved.matches.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No ${endpoint.trim().split(/\s+/)[0].toUpperCase()} handler for that path. Available methods: ${resolved.availableMethods?.join(', ') ?? 'none'}.`,
          },
        ],
      };
    }

    const text = resolved.matches.map(renderRestEndpoint).join('\n\n---\n\n');
    return {
      content: [{ type: 'text', text }],
    };
  }

  // Handle WebSocket API
  if (normalizedType === 'websocket') {
    if (!endpoint) {
      // List all streams
      let text = `# WebSocket API Streams\n\n`;
      text += `**Mainnet:** ${data.websocket.baseUrl.mainnet}\n`;
      text += `**Testnet:** ${data.websocket.baseUrl.testnet}\n\n`;

      text += `## Available Streams\n\n`;
      data.websocket.streams.forEach((stream) => {
        text += `- **${stream.name}** (${stream.topic})${stream.auth ? ' 🔒' : ''}\n`;
        text += `  ${stream.description}\n\n`;
      });

      return {
        content: [{ type: 'text', text }],
      };
    }

    // Find specific stream using Fuse.js
    const normalizedStream = endpoint.toLowerCase().trim();
    const fuse = getWsFuseInstance();
    const searchResults = fuse.search(normalizedStream, { limit: 5 });
    const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.6);

    if (qualityResults.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Stream "${endpoint}" not found. Use without endpoint parameter to see all available streams.`,
          },
        ],
      };
    }

    // Use best match
    const match = qualityResults[0].item;

    let text = `# ${match.name}\n\n`;
    text += `**Topic:** ${match.topic}\n\n`;
    text += `${match.description}\n\n`;
    text += `**Authentication:** ${match.auth ? 'Required 🔒' : 'Not required'}\n\n`;

    if (match.parameters && match.parameters.length > 0) {
      text += `## Parameters\n\n${match.parameters.map((p) => `- ${p}`).join('\n')}\n\n`;
    }

    if (match.messageFormat) {
      text += `## Message Format\n\n\`\`\`json\n${match.messageFormat}\n\`\`\`\n\n`;
    }

    if (match.example) {
      text += `## Example\n\n\`\`\`typescript\n${match.example}\n\`\`\``;
    }

    return {
      content: [{ type: 'text', text }],
    };
  }

  // Fallback
  return {
    content: [
      {
        type: 'text',
        text: `Unknown error occurred.`,
      },
    ],
  };
}

// Export functions to clear cache (useful for testing)
export function clearApiInfoCache(): void {
  restFuseInstance = null;
  wsFuseInstance = null;
}
