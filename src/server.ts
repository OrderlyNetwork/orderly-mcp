import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchOrderlyDocs } from './tools/searchDocs.js';
import { getContractAddresses } from './tools/contracts.js';
import { explainWorkflow } from './tools/workflows.js';
import { getApiInfo } from './tools/apiInfo.js';
import { getIndexerApiInfo } from './tools/indexerApi.js';
import { getComponentGuide } from './tools/componentGuides.js';
import { getOrderlyOneApiInfo } from './tools/orderlyOneApi.js';
import { getSvApiInfo } from './tools/svApi.js';
import { getPublicInfoApiInfo } from './tools/publicInfoApi.js';
import { getResource } from './resources/index.js';
import { APP_VERSION } from './version.js';

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
      version: APP_VERSION,
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
              scope: {
                type: 'string',
                enum: ['auto', 'docs', 'sdk'],
                description:
                  "Which corpus to search: 'sdk' for type-accurate SDK symbols (hooks/components/types/functions), 'docs' for protocol documentation, or 'auto' (default) which detects intent from the query (camelCase/use* names → SDK, plain language → docs)",
                default: 'auto',
              },
              detail: {
                type: 'string',
                enum: ['summary', 'full'],
                description:
                  "'summary' (default) truncates long documentation sections to keep responses compact; 'full' returns complete section text",
                default: 'summary',
              },
            },
            required: ['query'],
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
                  "Workflow topic, name fragment, or natural-language description (e.g., 'wallet connection', 'deposit', 'setting up react sdk', 'placing orders'). Matches are fuzzy — partial words and multi-word queries work.",
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
            'Get information about Orderly Indexer API for trading metrics, account events, trades, and volume statistics (rankings endpoints available via endpoint search)',
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
                  "Filter by category (e.g., 'trading_metrics', 'events::events_api', 'trades::trades_api', 'trading_metrics::volume_statistic') - use instead of endpoint to see all endpoints in a category",
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
          name: 'get_strategy_vault_api_info',
          description:
            'Get information about Orderly Strategy Vault API for yield optimization, strategy providers, and liquidity providers',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description:
                  "Specific endpoint path or name (e.g., '/v1/public/strategy_vault/vault/info', 'sp/info')",
              },
              category: {
                type: 'string',
                description:
                  "Filter by category (e.g., 'strategy_vault_info', 'strategy_provider', 'fund_management', 'liquidity_provider', 'user') - use instead of endpoint to see all endpoints in a category",
              },
            },
          },
        },
        {
          name: 'get_public_info_api_info',
          description:
            'Get information about the Orderly Public Info API — a zero-auth single endpoint (POST /v1/public/query) for market, account, and platform data via a `type` field. Covers 24 query types (marketSummary, accountState, orderbook, candles, topAddresses, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              queryType: {
                type: 'string',
                description:
                  'Query type name (e.g., "marketSummary", "accountState", "orderbook", "candles", "topAddresses", "whaleContext"). Returns full details: params, response fields, example, weight, freshness.',
              },
              category: {
                type: 'string',
                description:
                  'Browse a category instead: "market", "account", "platform", or "system". Use instead of queryType to list all types in a category.',
              },
            },
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
            (args.limit as number) || 5,
            (args.scope as 'auto' | 'docs' | 'sdk') || 'auto',
            (args.detail as 'summary' | 'full') || 'summary'
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

        case 'get_strategy_vault_api_info':
          result = (await getSvApiInfo(
            args.endpoint as string | undefined,
            args.category as string | undefined
          )) as ToolResult;
          break;

        case 'get_public_info_api_info':
          result = (await getPublicInfoApiInfo(
            args.queryType as string | undefined,
            args.category as string | undefined
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
            'Indexer API for trading metrics, account events, trades, and volume statistics (rankings endpoints available via endpoint search)',
          mimeType: 'text/markdown',
        },
        {
          uri: 'orderly://api/public-info',
          name: 'Public Info API Reference',
          description:
            'Zero-auth single-endpoint query API (POST /v1/public/query) for market, account, and platform data via a `type` field',
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
