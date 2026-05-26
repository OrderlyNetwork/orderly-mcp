import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchOrderlyDocs } from './tools/searchDocs.js';
import { getSdkPattern } from './tools/sdkPatterns.js';
import { getContractAddresses } from './tools/contracts.js';
import { explainWorkflow } from './tools/workflows.js';
import { getApiInfo } from './tools/apiInfo.js';
import { getIndexerApiInfo } from './tools/indexerApi.js';
import { getComponentGuide } from './tools/componentGuides.js';
import { getOrderlyOneApiInfo } from './tools/orderlyOneApi.js';
import { getPythonSdkPattern } from './tools/pythonSdk.js';
import { getResource } from './resources/index.js';

// Common result type for all tools
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'orderly-network-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_orderly_docs',
          description:
            'Search Orderly Network documentation for specific topics, concepts, or questions',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description:
                  "Search query about Orderly Network (e.g., 'how does the vault work', 'trading fees', 'order types')",
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                default: 5,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_sdk_pattern',
          description: 'Get code examples and patterns for Orderly SDK v2 hooks and utilities',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description:
                  "Pattern or hook name (e.g., 'useOrderEntry', 'usePositionStream', 'wallet-connection')",
              },
              includeExample: {
                type: 'boolean',
                description: 'Include full code example (default: true)',
                default: true,
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'get_contract_addresses',
          description: 'Get smart contract addresses for Orderly on specific chains',
          inputSchema: {
            type: 'object',
            properties: {
              chain: {
                type: 'string',
                description:
                  "Chain name (e.g., 'arbitrum', 'optimism', 'base', 'ethereum', 'solana')",
              },
              contractType: {
                type: 'string',
                description:
                  "Contract type (e.g., 'vault', 'usdc', 'usdt') or 'all' for all contracts",
                default: 'all',
              },
              network: {
                type: 'string',
                description: "Network type ('mainnet' or 'testnet')",
                default: 'mainnet',
              },
            },
            required: ['chain'],
          },
        },
        {
          name: 'explain_workflow',
          description: 'Get step-by-step explanation of common Orderly development workflows',
          inputSchema: {
            type: 'object',
            properties: {
              workflow: {
                type: 'string',
                description:
                  "Workflow name (e.g., 'wallet-connection', 'place-first-order', 'deposit-withdraw', 'subaccount-management')",
              },
            },
            required: ['workflow'],
          },
        },
        {
          name: 'get_api_info',
          description: 'Get information about Orderly REST API endpoints or WebSocket streams',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: "API type ('rest', 'websocket', or 'auth')",
              },
              endpoint: {
                type: 'string',
                description:
                  "Specific endpoint or stream name (e.g., '/v1/order', 'orderbook', 'position')",
              },
            },
            required: ['type'],
          },
        },
        {
          name: 'get_indexer_api_info',
          description:
            'Get information about Orderly Indexer API for trading metrics, account events, volume statistics, and rankings',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description:
                  "Specific endpoint path or name (e.g., '/events_v2', 'daily_volume', 'ranking/positions')",
              },
              category: {
                type: 'string',
                description:
                  "Filter by category (e.g., 'trading_metrics', 'events', 'ranking') - use instead of endpoint to see all endpoints in a category",
              },
            },
          },
        },
        {
          name: 'get_component_guide',
          description: 'Get guidance on building React UI components using Orderly SDK',
          inputSchema: {
            type: 'object',
            properties: {
              component: {
                type: 'string',
                description:
                  "Component type (e.g., 'order-entry', 'orderbook', 'positions', 'wallet-connector')",
              },
              complexity: {
                type: 'string',
                description: "Guide complexity ('minimal', 'standard', 'advanced')",
                default: 'standard',
              },
            },
            required: ['component'],
          },
        },
        {
          name: 'get_orderly_one_api_info',
          description:
            'Get information about Orderly One API for DEX creation, graduation, and management',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description:
                  "Specific endpoint path or name (e.g., '/dex', 'verify-tx', '/theme/modify')",
              },
              category: {
                type: 'string',
                description:
                  "Filter by category (e.g., 'auth', 'dex', 'graduation', 'theme', 'stats', 'leaderboard', 'admin')",
              },
            },
          },
        },
        {
          name: 'get_python_sdk_pattern',
          description:
            'Get code examples and patterns for the Orderly Python SDK (agent-trading-sdk / Arthur SDK) for building trading bots and AI agents',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description:
                  "Pattern or method name (e.g., 'buy', 'positions', 'rsi_strategy', 'ai_agent_strategy', 'Arthur')",
              },
              includeExample: {
                type: 'boolean',
                description: 'Include full code example (default: true)',
                default: true,
              },
            },
            required: ['pattern'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<ToolResult> => {
    const { name, arguments: args } = request.params;

    if (!args) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: No arguments provided',
          },
        ],
        isError: true,
      };
    }

    try {
      let result: ToolResult;

      switch (name) {
        case 'search_orderly_docs':
          result = (await searchOrderlyDocs(
            args.query as string,
            (args.limit as number) || 5
          )) as ToolResult;
          break;

        case 'get_sdk_pattern':
          result = (await getSdkPattern(
            args.pattern as string,
            (args.includeExample as boolean) ?? true
          )) as ToolResult;
          break;

        case 'get_contract_addresses':
          result = (await getContractAddresses(
            args.chain as string,
            (args.contractType as string) || 'all',
            (args.network as string) || 'mainnet'
          )) as ToolResult;
          break;

        case 'explain_workflow':
          result = (await explainWorkflow(args.workflow as string)) as ToolResult;
          break;

        case 'get_api_info':
          result = (await getApiInfo(
            args.type as string,
            args.endpoint as string | undefined
          )) as ToolResult;
          break;

        case 'get_indexer_api_info':
          result = (await getIndexerApiInfo(
            args.endpoint as string | undefined,
            args.category as string | undefined
          )) as ToolResult;
          break;

        case 'get_component_guide':
          result = (await getComponentGuide(
            args.component as string,
            (args.complexity as string) || 'standard'
          )) as ToolResult;
          break;

        case 'get_orderly_one_api_info':
          result = (await getOrderlyOneApiInfo(
            args.endpoint as string | undefined,
            args.category as string | undefined
          )) as ToolResult;
          break;

        case 'get_python_sdk_pattern':
          result = (await getPythonSdkPattern(
            args.pattern as string,
            (args.includeExample as boolean) ?? true
          )) as ToolResult;
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'orderly://overview',
          name: 'Orderly Network Overview',
          description: 'High-level protocol architecture and key concepts',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://sdk/hooks',
          name: 'SDK Hooks Reference',
          description: 'Complete reference of all v2 SDK hooks',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://sdk/components',
          name: 'Component Building Guides',
          description: 'Guides for building UI components with Orderly SDK',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://contracts',
          name: 'Contract Addresses',
          description: 'Smart contract addresses across all supported chains',
          mimeType: 'application/json',
        },
        {
          uri: 'orderly://workflows',
          name: 'Common Workflows',
          description: 'Step-by-step workflows for common development tasks',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://api/rest',
          name: 'REST API Reference',
          description: 'Complete REST API documentation',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://api/websocket',
          name: 'WebSocket API Reference',
          description: 'Real-time WebSocket streams documentation',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://api/indexer',
          name: 'Indexer API Reference',
          description:
            'Indexer API for trading metrics, account events, volume statistics, and rankings',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://sdk/python',
          name: 'Python SDK Reference',
          description:
            'Python SDK (agent-trading-sdk) for building trading bots and AI agents on Orderly',
          mimeType: 'text/markdown',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return await getResource(uri);
  });

  return server;
}
