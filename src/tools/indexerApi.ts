import Fuse from 'fuse.js';
import indexerApiData from '../data/indexer-api.json' with { type: 'json' };

export interface IndexerApiInfoResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface IndexerEndpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  parameters?: Array<{
    name: string;
    in: string;
    type: string;
    required: boolean;
    description: string;
    example?: unknown;
  }>;
  requestBody?: {
    description: string;
    contentType: string;
    schema: string;
    required: boolean;
  } | null;
  responses?: Array<{
    code: number;
    description: string;
    schema: string | null;
  }>;
  example?: string;
}

interface IndexerCategory {
  name: string;
  description: string;
  endpoints: IndexerEndpoint[];
}

interface IndexerApiData {
  version: string;
  description: string;
  baseUrl: {
    mainnet: string;
    testnet: string;
  };
  categories: IndexerCategory[];
  endpoints: IndexerEndpoint[];
  schemas: Array<{
    name: string;
    description: string;
    type: string;
    properties?: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
      example?: unknown;
      enum?: string[];
      format?: string | null;
    }>;
    items?: unknown;
    enum?: string[];
    required?: string[];
  }>;
  commonErrors: Array<{
    code: number;
    message: string;
    description: string;
  }>;
}

// Initialize Fuse instance lazily
let fuseInstance: Fuse<IndexerEndpoint> | null = null;

function getFuseInstance(): Fuse<IndexerEndpoint> {
  if (!fuseInstance) {
    const data = indexerApiData as IndexerApiData;
    const fuseOptions = {
      keys: [
        { name: 'path', weight: 0.4 },
        { name: 'summary', weight: 0.3 },
        { name: 'description', weight: 0.2 },
        { name: 'operationId', weight: 0.1 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      shouldSort: true,
    };
    fuseInstance = new Fuse(data.endpoints, fuseOptions);
  }
  return fuseInstance;
}

export async function getIndexerApiInfo(
  endpoint?: string,
  category?: string
): Promise<IndexerApiInfoResult> {
  const data = indexerApiData as IndexerApiData;

  // If category is specified, show endpoints in that category
  if (category) {
    const normalizedCategory = category.toLowerCase().trim();
    const matchingCategory = data.categories.find(
      (c) =>
        c.name.toLowerCase().includes(normalizedCategory) ||
        c.description.toLowerCase().includes(normalizedCategory)
    );

    if (matchingCategory) {
      let text = `# ${matchingCategory.name}\n\n`;
      text += `${matchingCategory.description}\n\n`;
      text += `## Endpoints\n\n`;

      matchingCategory.endpoints.forEach((ep) => {
        text += `### ${ep.method} ${ep.path}\n\n`;
        text += `**Summary:** ${ep.summary}\n\n`;
        if (ep.description) {
          text += `${ep.description}\n\n`;
        }

        if (ep.parameters && ep.parameters.length > 0) {
          text += `**Parameters:**\n\n`;
          ep.parameters.forEach((param) => {
            text += `- **${param.name}** (${param.in}, ${param.type})${param.required ? ' *required*' : ''}\n`;
            if (param.description) {
              text += `  ${param.description}\n`;
            }
            text += '\n';
          });
        }

        if (ep.example) {
          text += `**Example:**\n\n\`\`\`typescript\n${ep.example}\n\`\`\`\n\n`;
        }

        text += '---\n\n';
      });

      return {
        content: [{ type: 'text', text }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Category "${category}" not found. Available categories: ${data.categories.map((c) => c.name).join(', ')}`,
        },
      ],
    };
  }

  // If no endpoint specified, show overview with navigation guide
  if (!endpoint) {
    let text = `# Orderly Network Indexer API\n\n`;
    text += `## What is the Indexer API?\n\n`;
    text += `The Indexer API provides **read-only access** to historical and aggregated trading data on Orderly Network. `;
    text += `Unlike the main trading API (which requires authentication for trading), the Indexer API is designed for:\n\n`;
    text += `- **Analytics**: Query historical trading metrics, volume, and fees\n`;
    text += `- **Account History**: Retrieve user trading events, settlements, liquidations\n`;
    text += `- **Leaderboards**: Get rankings for positions, PnL, trading volume\n`;
    text += `- **Dashboards**: Build trading statistics and performance tracking\n\n`;

    text += `## Key Differences from Main API\n\n`;
    text += `| Feature | Main API | Indexer API |\n`;
    text += `|---------|----------|-------------|\n`;
    text += `| Authentication | Required (Ed25519) | Not required |\n`;
    text += `| Purpose | Trading operations | Data querying |\n`;
    text += `| Data Type | Real-time | Historical/Aggregated |\n`;
    text += `| Rate Limits | Strict | More permissive |\n`;
    text += `| Write Operations | Yes (orders, etc.) | No (read-only) |\n\n`;

    text += `## Base URLs\n\n`;
    text += `- **Mainnet:** ${data.baseUrl.mainnet}\n`;
    text += `- **Testnet:** ${data.baseUrl.testnet}\n\n`;

    text += `## How to Navigate This API\n\n`;
    text += `### 1. Browse by Category\n\n`;
    text += `Use the \\"category\\" parameter to see all endpoints in a specific area:\n\n`;
    text += `\`\`\`\n`;
    text += `get_indexer_api_info category="trading_metrics"\n`;
    text += `get_indexer_api_info category="events"\n`;
    text += `get_indexer_api_info category="ranking"\n`;
    text += `\`\`\`\n\n`;

    text += `### 2. Search by Endpoint\n\n`;
    text += `Use the \\"endpoint\\" parameter to find specific endpoints:\n\n`;
    text += `\`\`\`\n`;
    text += `get_indexer_api_info endpoint="/daily_volume"\n`;
    text += `get_indexer_api_info endpoint="events_v2"\n`;
    text += `get_indexer_api_info endpoint="ranking/positions"\n`;
    text += `\`\`\`\n\n`;

    text += `### 3. Common Use Cases\n\n`;
    text += `**For Trading Dashboards:**\n`;
    text += `- \\"/daily_volume\\" - Daily trading volume over time\n`;
    text += `- \\"/daily_trading_fee\\" - Fee statistics\n`;
    text += `- \\"/daily_orderly_perp\\" - Comprehensive perp trading metrics\n\n`;

    text += `**For User Account History:**\n`;
    text += `- \\"/events_v2\\" - All account events with pagination\n`;
    text += `  - Event types: PERPTRADE, SETTLEMENT, LIQUIDATION, TRANSACTION, ADL\n`;
    text += `  - Filter by account_id, time range, event type\n\n`;

    text += `**For Leaderboards/Rankings:**\n`;
    text += `- \\"/ranking/positions\\" - Top positions by holding value\n`;
    text += `- \\"/ranking/realized_pnl\\" - Top traders by realized PnL\n`;
    text += `- \\"/ranking/trading_volume\\" - Top traders by volume\n`;
    text += `- \\"/ranking/deposit\\" - Top depositors\n`;
    text += `- \\"/ranking/withdraw\\" - Top withdrawals\n\n`;

    text += `**For Volume Statistics:**\n`;
    text += `- \\"/get_account_volume_statistic\\" - Volume stats for a specific account\n`;
    text += `- \\"/get_broker_volume_statistic\\" - Volume stats for a broker\n\n`;

    text += `## Available Categories\n\n`;
    data.categories.forEach((cat) => {
      const categoryDescriptions: Record<string, string> = {
        'trading metrics':
          'Historical trading metrics including daily volume, fees, and perpetual trading statistics',
        'trading metrics::volume_statistic':
          'Volume statistics for individual accounts and brokers',
        'events::events_api':
          'Account trading events with pagination support (trades, settlements, liquidations, transactions)',
      };

      text += `### ${cat.name}\n\n`;
      text += `${categoryDescriptions[cat.name] || cat.description}\n\n`;
      text += `**${cat.endpoints.length} Endpoints:**\n\n`;
      cat.endpoints.forEach((ep) => {
        text += `- **${ep.method} ${ep.path}** - ${ep.summary}\n`;
      });
      text += '\n';
    });

    text += `## Common Errors\n\n`;
    data.commonErrors.forEach((err) => {
      text += `- **${err.code}** - ${err.message}: ${err.description}\n`;
    });

    text += `\n## Tips for Using the Indexer API\n\n`;
    text += `1. **No Authentication Required**: Unlike the trading API, you don't need API keys\n`;
    text += `2. **Pagination**: The /events_v2 endpoint supports pagination via cursors\n`;
    text += `3. **Time Ranges**: Most endpoints accept from_day/end_day or from_time/to_time parameters\n`;
    text += `4. **Query Parameters**: GET endpoints use a \\"param\\" query parameter with JSON-encoded values\n`;
    text += `5. **Rate Limits**: More permissive than trading API, but still apply\n`;

    return {
      content: [{ type: 'text', text }],
    };
  }

  // Find specific endpoint using Fuse.js
  const normalizedEndpoint = endpoint.toLowerCase().trim();
  const fuse = getFuseInstance();
  const searchResults = fuse.search(normalizedEndpoint, { limit: 5 });
  const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.6);

  if (qualityResults.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `Endpoint "${endpoint}" not found. Use without endpoint parameter to see all available endpoints.`,
        },
      ],
    };
  }

  // Use best match
  const match = qualityResults[0].item;

  let text = `# ${match.method} ${match.path}\n\n`;
  text += `**Summary:** ${match.summary}\n\n`;

  if (match.description) {
    text += `${match.description}\n\n`;
  }

  if (match.operationId) {
    text += `**Operation ID:** \`${match.operationId}\`\n\n`;
  }

  if (match.tags && match.tags.length > 0) {
    text += `**Tags:** ${match.tags.join(', ')}\n\n`;
  }

  if (match.parameters && match.parameters.length > 0) {
    text += `## Parameters\n\n`;
    match.parameters.forEach((param) => {
      text += `### ${param.name}\n\n`;
      text += `- **Location:** ${param.in}\n`;
      text += `- **Type:** ${param.type}\n`;
      text += `- **Required:** ${param.required ? 'Yes' : 'No'}\n`;
      if (param.description) {
        text += `- **Description:** ${param.description}\n`;
      }
      if (param.example !== null && param.example !== undefined) {
        text += `- **Example:** \`${JSON.stringify(param.example)}\`\n`;
      }
      text += '\n';
    });
  }

  if (match.requestBody) {
    text += `## Request Body\n\n`;
    if (match.requestBody.description) {
      text += `${match.requestBody.description}\n\n`;
    }
    text += `**Content Type:** ${match.requestBody.contentType}\n`;
    text += `**Required:** ${match.requestBody.required ? 'Yes' : 'No'}\n\n`;
    text += `**Schema:**\n\n\`\`\`json\n${match.requestBody.schema}\n\`\`\`\n\n`;
  }

  if (match.responses && match.responses.length > 0) {
    text += `## Responses\n\n`;
    match.responses.forEach((resp) => {
      text += `### ${resp.code}\n\n`;
      text += `${resp.description}\n\n`;
      if (resp.schema) {
        text += `**Schema:**\n\n\`\`\`json\n${resp.schema}\n\`\`\`\n\n`;
      }
    });
  }

  if (match.example) {
    text += `## Example\n\n\`\`\`typescript\n${match.example}\n\`\`\``;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

// Export function to clear cache (useful for testing)
export function clearIndexerApiInfoCache(): void {
  fuseInstance = null;
}
