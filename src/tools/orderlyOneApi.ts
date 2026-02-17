import Fuse from 'fuse.js';
import orderlyOneData from '../data/orderly-one-api.json' with { type: 'json' };

export interface OrderlyOneApiInfoResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface OrderlyOneEndpoint {
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
    code: number | string;
    description: string;
    schema: string | null;
  }>;
  example?: string;
}

interface OrderlyOneCategory {
  name: string;
  description: string;
  endpoints: OrderlyOneEndpoint[];
}

interface OrderlyOneAuthFlow {
  type: string;
  description: string;
  flow: Array<{
    step: number;
    title: string;
    description: string;
    endpoint?: string;
    example?: string;
    header?: string;
  }>;
  example: string;
}

interface OrderlyOneApiData {
  version: string;
  title: string;
  description: string;
  baseUrl: {
    production: string;
    development: string;
  };
  authentication: OrderlyOneAuthFlow;
  categories: OrderlyOneCategory[];
  endpoints: OrderlyOneEndpoint[];
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
      enum?: string[] | null;
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
let fuseInstance: Fuse<OrderlyOneEndpoint> | null = null;

function getFuseInstance(): Fuse<OrderlyOneEndpoint> {
  if (!fuseInstance) {
    const data = orderlyOneData as OrderlyOneApiData;
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

export async function getOrderlyOneApiInfo(
  endpoint?: string,
  category?: string
): Promise<OrderlyOneApiInfoResult> {
  const data = orderlyOneData as OrderlyOneApiData;

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
    let text = `# Orderly One API\n\n`;
    text += `## Overview\n\n`;
    text += `${data.description}\n\n`;

    text += `## What is Orderly One?\n\n`;
    text += `Orderly One is a platform that lets you create and manage your own perpetual decentralized exchange (DEX) using Orderly Network infrastructure. `;
    text += `It provides an intuitive UI for DEX configuration, automated deployment to GitHub Pages, and a graduation system to earn fee revenue.\n\n`;

    text += `## Base URLs\n\n`;
    text += `- **Production:** ${data.baseUrl.production}\n`;
    text += `- **Development:** ${data.baseUrl.development}\n\n`;

    text += `## Authentication\n\n`;
    text += `${data.authentication.description}\n\n`;
    text += `### Authentication Flow\n\n`;
    data.authentication.flow.forEach((step) => {
      text += `**${step.step}. ${step.title}**\n\n`;
      text += `${step.description}\n\n`;
      if (step.endpoint) {
        text += `Endpoint: \`${step.endpoint}\`\n\n`;
      }
      if (step.example) {
        text += `Example: \`${step.example}\`\n\n`;
      }
      if (step.header) {
        text += `Header: \`${step.header}\`\n\n`;
      }
    });

    text += `### Complete Authentication Example\n\n`;
    text += `\`\`\`typescript\n${data.authentication.example}\n\`\`\`\n\n`;

    text += `## How to Navigate This API\n\n`;
    text += `### 1. Browse by Category\n\n`;
    text += `Use the "category" parameter to see all endpoints in a specific area:\n\n`;
    text += `\`\`\`\n`;
    text += `get_orderly_one_api_info category="dex"\n`;
    text += `get_orderly_one_api_info category="auth"\n`;
    text += `get_orderly_one_api_info category="graduation"\n`;
    text += `get_orderly_one_api_info category="theme"\n`;
    text += `\`\`\`\n\n`;

    text += `### 2. Search by Endpoint\n\n`;
    text += `Use the "endpoint" parameter to find specific endpoints:\n\n`;
    text += `\`\`\`\n`;
    text += `get_orderly_one_api_info endpoint="/dex"\n`;
    text += `get_orderly_one_api_info endpoint="verify-tx"\n`;
    text += `get_orderly_one_api_info endpoint="theme"\n`;
    text += `\`\`\`\n\n`;

    text += `### 3. Common Use Cases\n\n`;
    text += `**For DEX Creation:**\n`;
    text += `- "/dex" - Create and manage your DEX\n`;
    text += `- "/dex/:id" - Get/update specific DEX\n`;
    text += `- "/dex/:id/upgrade" - Upgrade DEX from template\n\n`;

    text += `**For Graduation:**\n`;
    text += `- "/graduation/verify-tx" - Verify graduation payment transaction\n`;
    text += `- "/graduation/fee-options" - Get graduation payment options (USDC or ORDER token)\n`;
    text += `- "/graduation/finalize-admin-wallet" - Complete graduation setup\n\n`;

    text += `**For Theme Customization:**\n`;
    text += `- "/theme/modify" - AI-powered theme generation\n`;
    text += `- "/theme/fine-tune" - Fine-tune specific CSS elements\n\n`;

    text += `**For Platform Stats:**\n`;
    text += `- "/leaderboard" - View DEX rankings\n`;
    text += `- "/stats" - Platform-wide statistics\n\n`;

    text += `## Available Categories\n\n`;
    data.categories.forEach((cat) => {
      text += `### ${cat.name}\n\n`;
      text += `${cat.description}\n\n`;
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

    text += `\n## Tips for Using the Orderly One API\n\n`;
    text += `1. **Authentication First**: Always authenticate before making authenticated requests\n`;
    text += `2. **Rate Limits**: Some endpoints (like theme generation) have rate limits\n`;
    text += `3. **JWT Tokens**: Tokens expire, be prepared to re-authenticate\n`;
    text += `4. **File Uploads**: DEX creation uses multipart/form-data for logo uploads\n`;
    text += `5. **Graduation**: The graduation process requires on-chain transaction verification\n`;

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
          text: `Endpoint "${endpoint}" not found. Use without endpoint parameter to see all available endpoints and categories.`,
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
    text += `**Category:** ${match.tags[0]}\n\n`;
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
export function clearOrderlyOneApiInfoCache(): void {
  fuseInstance = null;
}
