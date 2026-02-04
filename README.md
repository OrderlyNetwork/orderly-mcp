# Orderly Network MCP Server

A Model Context Protocol (MCP) server providing documentation and SDK patterns for Orderly Network - an omnichain perpetual futures trading infrastructure.

## What This Server Provides

This MCP server enables AI assistants to answer questions about Orderly Network and guide developers in building React components using the Orderly SDK v2.

### Features

- **Documentation Search**: Query Orderly docs for architecture, APIs, and concepts
- **SDK Patterns**: Get code examples for all v2 hooks (useOrderEntry, usePositionStream, etc.)
- **Contract Addresses**: Lookup smart contract addresses for all supported chains
- **Workflow Guides**: Step-by-step explanations of common development tasks
- **Component Guides**: Patterns for building trading UI components
- **API Reference**: REST and WebSocket endpoint documentation

## Installation

### Prerequisites

- Node.js 18 or higher
- Yarn (or npm)

### Setup

1. **Clone or create the project**:

```bash
cd orderly-mcp
```

2. **Install dependencies**:

```bash
yarn install
```

3. **Build the project**:

```bash
yarn build
```

4. **Configure your MCP client** (e.g., Claude Desktop):

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "orderly-network": {
      "command": "node",
      "args": ["/path/to/orderly-mcp/dist/index.js"]
    }
  }
}
```

### Development

For development with auto-rebuild:

```bash
yarn dev
```

### Code Quality

This project uses ESLint and Prettier for code quality:

```bash
# Run linting
yarn lint

# Fix linting issues
yarn lint:fix

# Format code
yarn format

# Check formatting
yarn format:check

# Type check
yarn typecheck
```

## Available Tools

### 1. `search_orderly_docs`

Search Orderly documentation for specific topics, concepts, or questions.

**Parameters**:

- `query` (string, required): Search query about Orderly
- `limit` (number, optional): Maximum results (default: 5)

**Example queries**:

- "how does the vault work"
- "trading fees"
- "order types"
- "leverage calculation"

### 2. `get_sdk_pattern`

Get code examples and patterns for Orderly SDK v2 hooks.

**Parameters**:

- `pattern` (string, required): Hook or pattern name (e.g., 'useOrderEntry', 'wallet-connection')
- `includeExample` (boolean, optional): Include full code example (default: true)

**Available patterns**:

- Account: `useAccount`, `useWalletConnector`
- Orders: `useOrderEntry`, `useOrderStream`
- Positions: `usePositionStream`, `useCollateral`
- Market Data: `useOrderbookStream`, `useMarkPrice`, `useTickerStream`
- Chains: `useChains`
- Assets: `useDeposit`

### 3. `get_contract_addresses`

Get smart contract addresses for Orderly on specific chains.

**Parameters**:

- `chain` (string, required): Chain name (e.g., 'arbitrum', 'optimism', 'base')
- `contractType` (string, optional): Contract type or 'all' (default: 'all')
- `network` (string, optional): 'mainnet' or 'testnet' (default: 'mainnet')

**Supported chains**:

- EVM: ethereum, arbitrum, optimism, base, mantle, solana
- Orderly L2: orderlyL2

### 4. `explain_workflow`

Get step-by-step explanation of common development workflows.

**Parameters**:

- `workflow` (string, required): Workflow name

**Available workflows**:

- `wallet-connection`: Connect wallet and create Orderly key
- `place-first-order`: Complete flow for placing first trade
- `deposit-funds`: Deposit USDC/tokens to Orderly
- `set-tp-sl`: Set Take Profit and Stop Loss
- `subaccount-management`: Create and manage subaccounts

### 5. `get_api_info`

Get information about Orderly REST API or WebSocket streams.

**Parameters**:

- `type` (string, required): 'rest', 'websocket', or 'auth'
- `endpoint` (string, optional): Specific endpoint or stream name

### 6. `get_component_guide`

Get guidance on building React UI components using Orderly SDK.

**Parameters**:

- `component` (string, required): Component type
- `complexity` (string, optional): 'minimal', 'standard', or 'advanced' (default: 'standard')

**Available components**:

- `order-entry`: Order placement form
- `orderbook`: Market depth display
- `positions`: Position management table
- `wallet-connector`: Wallet connection UI

## Available Resources

Access comprehensive documentation via resource URIs. All resources support fuzzy search with pagination:

**Query Parameters:**

- `search` (required) - Fuzzy search query
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page, max 10 (default: 10)

**Resources:**

- `orderly://overview` - High-level protocol architecture (no search required)
- `orderly://sdk/hooks?search=orderEntry` - Search SDK hooks by name, description, or category
- `orderly://sdk/components?search=Checkbox` - Search components by name or description
- `orderly://contracts?search=arbitrum` - Search contracts by chain or name
- `orderly://workflows?search=wallet` - Search workflows by name or steps
- `orderly://api/rest?search=position` - Search REST API endpoints
- `orderly://api/websocket?search=orderbook` - Search WebSocket streams

**Example:**

```
orderly://sdk/hooks?search=useOrderEntry&page=1&limit=5
```

## Example Usage

### Searching Documentation

```
User: "How does Orderly's vault system work?"

AI uses search_orderly_docs with query "vault system"
→ Returns explanation of cross-chain vault architecture
```

### Getting SDK Pattern

```
User: "Show me how to use useOrderEntry"

AI uses get_sdk_pattern with pattern "useOrderEntry"
→ Returns hook documentation with usage example
```

### Looking Up Contracts

```
User: "What's the USDC address on Arbitrum?"

AI uses get_contract_addresses with chain "arbitrum", contractType "USDC"
→ Returns contract address
```

### Explaining Workflows

```
User: "How do I place my first order?"

AI uses explain_workflow with workflow "place-first-order"
→ Returns step-by-step guide
```

### Component Building Guide

```
User: "How do I build an order entry component?"

AI uses get_component_guide with component "order-entry"
→ Returns complete implementation guide
```

## Data Sources

This MCP server includes embedded data from:

1. **Orderly Documentation**: Architecture, concepts, and guides
2. **SDK Patterns**: v2 hook examples and patterns from @orderly.network/hooks
3. **Contract Addresses**: All deployed contracts across supported chains
4. **API Specifications**: REST and WebSocket endpoints
5. **Workflow Guides**: Common development task explanations

## Project Structure

```
orderly-mcp/
├── src/
│   ├── index.ts                 # Main server entry
│   ├── tools/
│   │   ├── searchDocs.ts        # Documentation search
│   │   ├── sdkPatterns.ts       # SDK pattern lookup
│   │   ├── contracts.ts         # Contract address lookup
│   │   ├── workflows.ts         # Workflow explanations
│   │   ├── apiInfo.ts           # API documentation
│   │   └── componentGuides.ts   # Component building guides
│   ├── resources/
│   │   └── index.ts             # Resource handlers
│   └── data/
│       ├── documentation.json   # Searchable documentation chunks
│       ├── sdk-patterns.json    # SDK patterns and examples
│       ├── contracts.json       # Contract addresses
│       ├── workflows.json       # Workflow explanations
│       ├── api.json             # API specifications
│       ├── component-guides.json # Component guides
│       └── resources/
│           └── overview.md      # Protocol overview
├── .vscode/                     # VS Code settings
│   ├── settings.json
│   └── extensions.json
├── package.json
├── tsconfig.json
├── eslint.config.mjs            # ESLint configuration
├── .prettierrc                  # Prettier configuration
├── .gitignore
└── README.md
```

## Updating Data

All data files in `src/data/` are auto-generated via scripts in the `scripts/` folder. **Do not edit JSON files manually** - they will be overwritten when regeneration scripts run.

### Prerequisites

1. NEAR AI API key in `.env` file: `NEAR_AI_API_KEY=your_key`
2. Get API key at: https://cloud.near.ai/api-keys

### Complete Regeneration (Recommended)

Generate everything from scratch:

```bash
# 1. Download latest official docs
curl -o llms-full.txt https://orderly.network/docs/llms-full.txt

# 2. Split Telegram export (if you have one)
node scripts/split_telegram_chats.js

# 3. Analyze Telegram chats → tg_analysis.json
node scripts/analyze_chat_openai.js

# 4. Analyze docs → docs_analysis.json
node scripts/analyze_llms_full.js

# 5. Get SDK patterns from source (FREE - no AI calls)
node scripts/analyze_sdk.js

# 6. Generate documentation and workflows
node scripts/generate_mcp_data.js

# 7. Generate API docs from OpenAPI spec
node scripts/generate_api_from_openapi.js

# 8. Generate contract addresses
node scripts/generate_contracts.js

# 9. Build and test
yarn build && yarn test:run
```

### Update Only Documentation

If you just want to refresh from official docs without Telegram data:

```bash
# 1. Download latest docs
curl -o llms-full.txt https://orderly.network/docs/llms-full.txt

# 2. Analyze docs only
node scripts/analyze_llms_full.js

# 3. Generate (will use existing tg_analysis.json if present)
node scripts/generate_mcp_data.js

# 4. Build
yarn build
```

### Data Files

| File                      | Source                         | Generation Script              |
| ------------------------- | ------------------------------ | ------------------------------ |
| **documentation.json**    | Official docs + Telegram chats | `generate_mcp_data.js`         |
| **sdk-patterns.json**     | SDK source code (GitHub)       | `analyze_sdk.js`               |
| **component-guides.json** | SDK source code (GitHub)       | `analyze_sdk.js`               |
| **workflows.json**        | Official docs + Telegram chats | `generate_mcp_data.js`         |
| **api.json**              | OpenAPI spec                   | `generate_api_from_openapi.js` |
| **contracts.json**        | Official docs (llms-full.txt)  | `generate_contracts.js`        |

## Contributing

To add new content, you need to update the source data and regenerate:

1. **New Documentation**: Update `llms-full.txt` or Telegram exports, then run generation scripts
2. **New SDK Pattern**: The SDK is auto-parsed from GitHub - patterns appear automatically when SDK updates
3. **New Chain**: Update source documentation, then regenerate
4. **New Workflow**: Add to source docs or Telegram chats, then regenerate

## License

MIT

## Support

- Orderly Documentation: https://orderly.network/docs
- SDK Repository: https://github.com/OrderlyNetwork/js-sdk
- Orderly Discord: https://discord.gg/OrderlyNetwork
