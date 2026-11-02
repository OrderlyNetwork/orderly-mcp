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

// Every tool is a read-only lookup over data bundled at build time.
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function toolAnnotations(title: string) {
  return { title, ...READ_ONLY_TOOL_ANNOTATIONS };
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
          annotations: toolAnnotations('Search Orderly Documentation'),
          description:
            "Search bundled Orderly docs and SDK symbols by topic or question. Returns up to `limit` ranked Markdown results with relevance scores: `scope: 'sdk'` returns hooks/components/types/functions with signatures, props, and source paths; `'docs'` returns prose; `'auto'` (default) picks the corpus from the query. Use `'sdk'` for exact symbol signatures and `detail: 'full'` only when the summary is insufficient, since it returns much longer text. Read-only local search — no network calls, credentials, rate limits, or side effects. Use for open-ended discovery when the component, workflow, or endpoint is unknown; for a known component use get_component_guide, for a task walkthrough use explain_workflow, for an endpoint use get_api_info, get_indexer_api_info, get_public_info_api_info, or get_strategy_vault_api_info, and for addresses use get_contract_addresses.",
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
          annotations: toolAnnotations('Get Orderly Contract Addresses'),
          description:
            "Get the deployed smart contract addresses for Orderly on a specific chain and network. `chain` is required; `contractType` filters to one contract (e.g. vault, usdc, usdt) or 'all'; `network` selects mainnet (default) or testnet. 'all' lists every contract with an address on the selected network; a specific type also returns its description and the address on the other network when available. Unknown chains or contract types return the valid options. Read-only lookup from bundled data — no network calls, credentials, or side effects. Use for deployment and wiring addresses only; for API details use get_api_info or the matching named API tool, for SDK symbols use search_orderly_docs, and for integration steps use explain_workflow.",
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
          annotations: toolAnnotations('Explain Orderly Workflow'),
          description:
            "Get a curated, step-by-step guide for a common Orderly development task such as wallet connection, deposits, SDK setup, or placing orders. Returns exactly one best-matching workflow as Markdown with prerequisites, numbered steps, TypeScript examples, common issues, and related workflows; pass the task in natural language or a partial name, and a miss lists available workflows. Read-only lookup from bundled data — no network calls, credentials, rate limits, or side effects. Use for end-to-end tasks, not one-off lookups: get_component_guide for a known UI component, search_orderly_docs (scope 'sdk') for symbols, get_api_info for core endpoints, and the matching named tool for Indexer, Public Info, Orderly One, or Strategy Vault data.",
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
          annotations: toolAnnotations('Get Orderly API Info'),
          description:
            "Get reference documentation for the core Orderly trading API: REST endpoints, WebSocket streams, or authentication. For `rest` or `websocket`, omitting `endpoint` lists every endpoint or stream with base URLs and auth requirements; supplying `endpoint` fuzzy-matches one item and returns its method/path or topic, auth, rate limits, parameters, message formats, and a TypeScript example. `type: 'auth'` returns the signing flow and ignores `endpoint`. Read-only bundled docs — it does not call the API and requires no credentials, rate limits, or side effects. Use `type` alone to discover valid names, then `endpoint` for detail; for historical analytics use get_indexer_api_info, for zero-auth public data use get_public_info_api_info, for DEX management use get_orderly_one_api_info, and for vault data use get_strategy_vault_api_info.",
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
          annotations: toolAnnotations('Get Indexer API Info'),
          description:
            'Get reference documentation for the Orderly Indexer API, a read-only source of historical and aggregated trading data: volume and fee metrics, account events, trades, and rankings. Omit both parameters for an overview with base URLs, categories, common errors, and usage tips; pass `category` to discover all endpoints in an area, or `endpoint` to fuzzy-match one endpoint and return its parameters, request/response schemas, and TypeScript example (category takes precedence if both are supplied). Bundled docs lookup only — no API call, credentials, or rate limits. Use for analytics, dashboards, account history, and leaderboards; for live trading operations use get_api_info, and for zero-auth market data use get_public_info_api_info.',
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
          annotations: toolAnnotations('Get Orderly Component Guide'),
          description:
            "Get a curated build guide for a React UI component from the Orderly SDK, such as order-entry, orderbook, positions, or wallet-connector. Returns Markdown with required packages, key hooks, a complete TSX example, tips, styling notes, common mistakes, and related components; `complexity` selects the example depth — 'minimal' for a scaffold, 'advanced' for production wiring — and falls back to 'standard'. Guides include full code and can be long; a miss lists available guides and points to search_orderly_docs. Read-only static guidance — no network calls, credentials, rate limits, or side effects. Use for a known UI component; for SDK hook/type signatures use search_orderly_docs (scope 'sdk'), for end-to-end steps use explain_workflow, and for backend endpoints use get_api_info or the matching domain API tool.",
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
          annotations: toolAnnotations('Get Orderly One API Info'),
          description:
            "Get reference documentation for the Orderly One API used to create, graduate, and manage a DEX, covering auth, DEX, graduation, theme, stats, leaderboard, and admin endpoints. Omit both parameters for an overview; pass `category` to list endpoints in an area, or `endpoint` for one endpoint's method, parameters, and examples (category takes precedence if both are supplied). Responses flag agent-blocked or conditional operations such as DEX creation, deployment, and deletion. Read-only bundled docs — it never calls the API or needs credentials. Use for Orderly One/DEX-builder tasks; for core trading use get_api_info, and for vault or analytics data use the respective *api_info tools.",
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
          annotations: toolAnnotations('Get Strategy Vault API Info'),
          description:
            "Get reference documentation for the Orderly Strategy Vault REST API covering vault performance, strategy providers, fund management, liquidity providers, and user stats. Omit both parameters for an overview with base URL and categories; pass `category` to list endpoints in an area, or `endpoint` for one endpoint's detail (category wins if both are supplied). Read-only bundled docs — it does not call the API and needs no auth or rate limits. Use for vault/yield integrations; for core trading use get_api_info, for historical analytics use get_indexer_api_info, and for zero-auth market data use get_public_info_api_info.",
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
          annotations: toolAnnotations('Get Public Info API Info'),
          description:
            'Get reference documentation for the Orderly Public Info API — a zero-auth single endpoint (POST /v1/public/query) for market, account, and platform data selected by a `type` field. Covers 24 query types (marketSummary, accountState, orderbook, candles, topAddresses, whaleContext, etc.); `queryType` accepts exact, partial, or fuzzy names and returns params, response fields, example, weight, and freshness; `category` lists a group (queryType wins if both are supplied); omit both for the overview and rate-limit rules. Read-only bundled docs — it does not call the endpoint. Use instead of get_api_info for zero-auth public data; use get_api_info for authenticated trading, get_indexer_api_info for historical analytics, and get_strategy_vault_api_info for vault data.',
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
