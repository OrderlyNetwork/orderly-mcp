import apiData from '../data/api.json' with { type: 'json' };

export interface ApiInfoResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  auth: boolean;
  rateLimit?: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  response?: string;
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

export async function getApiInfo(type: string, endpoint?: string): Promise<ApiInfoResult> {
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

    text += `\n## Example\n\n\`\`\`typescript\n${data.auth.example}\n\`\`\`\n`;

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
        text += `- **${ep.method} ${ep.path}**${ep.auth ? ' 🔒' : ''}\n`;
        text += `  ${ep.description}\n`;
        if (ep.rateLimit) {
          text += `  Rate limit: ${ep.rateLimit}\n`;
        }
        text += `\n`;
      });

      return {
        content: [{ type: 'text', text }],
      };
    }

    // Find specific endpoint
    const normalizedEndpoint = endpoint.toLowerCase().trim();
    const match = data.rest.endpoints.find(
      (ep) =>
        ep.path.toLowerCase().includes(normalizedEndpoint) ||
        normalizedEndpoint.includes(ep.path.toLowerCase().replace('/v1/', ''))
    );

    if (!match) {
      return {
        content: [
          {
            type: 'text',
            text: `Endpoint "${endpoint}" not found. Use without endpoint parameter to see all available endpoints.`,
          },
        ],
      };
    }

    let text = `# ${match.method} ${match.path}\n\n`;
    text += `${match.description}\n\n`;
    text += `**Authentication:** ${match.auth ? 'Required 🔒' : 'Not required'}\n`;
    if (match.rateLimit) {
      text += `**Rate Limit:** ${match.rateLimit}\n`;
    }
    text += `\n`;

    if (match.parameters && match.parameters.length > 0) {
      text += `## Parameters\n\n`;
      match.parameters.forEach((param) => {
        text += `- **${param.name}** (${param.type})${param.required ? ' *required*' : ''}\n`;
        text += `  ${param.description}\n\n`;
      });
    }

    if (match.response) {
      text += `## Response\n\n\`\`\`json\n${match.response}\n\`\`\`\n\n`;
    }

    if (match.example) {
      text += `## Example\n\n\`\`\`typescript\n${match.example}\n\`\`\`\n`;
    }

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

    // Find specific stream
    const normalizedStream = endpoint.toLowerCase().trim();
    const match = data.websocket.streams.find(
      (s) =>
        s.name.toLowerCase().includes(normalizedStream) ||
        s.topic.toLowerCase().includes(normalizedStream)
    );

    if (!match) {
      return {
        content: [
          {
            type: 'text',
            text: `Stream "${endpoint}" not found. Use without endpoint parameter to see all available streams.`,
          },
        ],
      };
    }

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
      text += `## Example\n\n\`\`\`typescript\n${match.example}\n\`\`\`\n`;
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
