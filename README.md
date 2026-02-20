# Orderly Network MCP Server

A Model Context Protocol (MCP) server providing documentation and SDK patterns for Orderly Network - an omnichain perpetual futures trading infrastructure.

## Quick Start

Install the MCP server with one command for your AI client:

```bash
npx @orderly.network/mcp-server init --client <client>
```

**Supported clients:** `claude`, `cursor`, `vscode`, `codex`, `opencode`

### Examples

```bash
# OpenCode
npx @orderly.network/mcp-server init --client opencode

# Claude Code
npx @orderly.network/mcp-server init --client claude

# Cursor
npx @orderly.network/mcp-server init --client cursor

# VS Code (with Copilot)
npx @orderly.network/mcp-server init --client vscode

# Interactive mode (prompts for client selection)
npx @orderly.network/mcp-server init
```

This command will:

1. Create the appropriate configuration file for your AI client
2. Install `@orderly.network/mcp-server` as a dev dependency
3. Guide you through the next steps

**After installation:** Restart your AI client and try asking: _"How do I connect to Orderly Network?"_

---

## What This Server Provides

This MCP server enables AI assistants to answer questions about Orderly Network and guide developers in building React components using the Orderly SDK v2.

### Features

- **Documentation Search**: Query Orderly docs for architecture, APIs, and concepts
- **SDK Patterns**: Get code examples for all v2 hooks (useOrderEntry, usePositionStream, etc.)
- **Contract Addresses**: Lookup smart contract addresses for all supported chains
- **Workflow Guides**: Step-by-step explanations of common development tasks
- **Component Guides**: Patterns for building trading UI components
- **API Reference**: REST and WebSocket endpoint documentation
- **Indexer API**: Trading metrics, account events, volume statistics, and rankings

## Installation

### Quick Install (Recommended)

Use the CLI to automatically configure your AI client:

```bash
npx @orderly.network/mcp-server init --client <client>
```

**Available clients:**

| Client      | Command             | Config Location        |
| ----------- | ------------------- | ---------------------- |
| Claude Code | `--client claude`   | `.mcp.json`            |
| Cursor      | `--client cursor`   | `.cursor/mcp.json`     |
| VS Code     | `--client vscode`   | `.vscode/mcp.json`     |
| Codex       | `--client codex`    | `~/.codex/config.toml` |
| OpenCode    | `--client opencode` | `.opencode/mcp.json`   |

### Manual Setup

If you prefer to configure manually or the automatic setup doesn't work for your client:

#### Prerequisites

- Node.js 18 or higher
- Yarn (or npm)

#### Setup from Source

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

### Running the Server

The MCP server supports two modes:

#### 1. Stdio Mode (Default - for local MCP clients)

Use this for local AI assistants:

```bash
yarn start
```

#### Manual Configuration

If not using the automatic installer, add this configuration to your AI client:

**Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "orderly": {
      "command": "npx",
      "args": ["@orderly.network/mcp-server@latest"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "orderly": {
      "command": "npx",
      "args": ["@orderly.network/mcp-server@latest"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "orderly": {
      "command": "npx",
      "args": ["@orderly.network/mcp-server@latest"]
    }
  }
}
```

**OpenCode** (`.opencode/mcp.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "orderly": {
      "type": "local",
      "command": ["npx", "@orderly.network/mcp-server@latest"],
      "enabled": true
    }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.orderly]
command = "npx"
args = ["@orderly.network/mcp-server@latest"]
```

#### 2. HTTP Mode (for hosted deployments)

Run as an HTTP server for remote access:

```bash
yarn start:http
```

The server will start on port 3000 (or `PORT` env var):

- MCP endpoint: `http://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`

**Docker Deployment:**

```bash
# Build the image
docker build -t orderly-mcp .

# Run the container
docker run -p 3000:3000 orderly-mcp
```

The Docker image runs in stateless HTTP mode by default.

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

Get code examples and patterns for Orderly SDK v2 hooks and complete DEX components.

**Parameters**:

- `pattern` (string, required): Hook or pattern name (e.g., 'useOrderEntry', 'wallet-connection', 'LightweightChart')
- `includeExample` (boolean, optional): Include full code example (default: true)

**Available patterns**:

- **Account**: `useAccount`, `useWalletConnector`
- **Orders**: `useOrderEntry`, `useOrderStream`
- **Positions**: `usePositionStream`, `useCollateral`
- **Market Data**: `useOrderbookStream`, `useMarkPrice`, `useTickerStream`
- **Chains**: `useChains`
- **Assets**: `useDeposit`
- **Charts**: `LightweightChart`, `TradingViewWidgetSetup`, `Real-timeKlineDataviaWebSocket`
- **Trading Components**: `CreateOrder`, `Orderbook`, `SymbolHeader`, `SymbolSelection`
- **Position Components**: `Positions`, `UpdatePosition`, `ClosePosition`
- **Wallet Components**: `ConnectWalletButton`, `WalletConnection`, `EvmDropdownMenu`
- **WebSocket Services**: `websocket.service` (real-time kline data)

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

### 6. `get_indexer_api_info`

Get information about Orderly Indexer API for trading metrics, account events, volume statistics, and rankings.

**Parameters**:

- `endpoint` (string, optional): Specific endpoint path or name (e.g., '/events_v2', 'daily_volume', 'ranking/positions')
- `category` (string, optional): Filter by category (e.g., 'trading_metrics', 'events', 'ranking')

**Available categories**:

- **Trading Metrics**: Daily volume, fees, perp trading data (`/daily_volume`, `/daily_trading_fee`, `/daily_orderly_perp`)
- **Events**: Account events with pagination (`/events_v2`) - trades, settlements, liquidations, transactions
- **Volume Statistics**: Account and broker volume stats (`/get_account_volume_statistic`, `/get_broker_volume_statistic`)
- **Rankings**: Positions, PnL, trading volume, deposits/withdrawals (`/ranking/positions`, `/ranking/realized_pnl`, `/ranking/trading_volume`, `/ranking/deposit`, `/ranking/withdraw`)

**Example**:

```
# Get all indexer API endpoints
get_indexer_api_info

# Get specific endpoint details
get_indexer_api_info endpoint="/events_v2"

# Get all endpoints in a category
get_indexer_api_info category="trading_metrics"
```

### 7. `get_component_guide`

Get guidance on building React UI components using Orderly SDK.

**Parameters**:

- `component` (string, required): Component type
- `complexity` (string, optional): 'minimal', 'standard', or 'advanced' (default: 'standard')

**Available components**:

- `order-entry`: Order placement form
- `orderbook`: Market depth display
- `positions`: Position management table
- `wallet-connector`: Wallet connection UI

### 8. `get_orderly_one_api_info`

Get information about Orderly One API for DEX creation, graduation, and management.

**Parameters**:

- `endpoint` (string, optional): Specific endpoint path or name (e.g., '/dex', 'verify-tx', '/theme/modify')
- `category` (string, optional): Filter by category (e.g., 'auth', 'dex', 'graduation', 'theme', 'stats', 'leaderboard', 'admin')

**Available categories**:

- **auth**: Wallet signature-based authentication (nonce, verify, validate)
- **dex**: DEX management - create, update, delete, deploy, and manage exchanges
- **graduation**: Graduation system - upgrade from demo to full broker with fee splits
- **theme**: AI-powered theme generation and CSS customization
- **stats**: Platform-wide statistics and analytics
- **leaderboard**: DEX rankings, performance metrics, and leaderboards
- **admin**: Administrative operations for platform management

**Example**:

```
# Get overview and authentication flow
get_orderly_one_api_info

# Get all endpoints in a category
get_orderly_one_api_info category="dex"
get_orderly_one_api_info category="graduation"

# Get specific endpoint details
get_orderly_one_api_info endpoint="verify-tx"
get_orderly_one_api_info endpoint="/theme/modify"
```

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
- `orderly://api/indexer?search=events` - Search Indexer API endpoints

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
3. **DEX Examples**: Complete working components from the [example-dex](https://github.com/orderlynetwork/example-dex) repository
4. **Contract Addresses**: All deployed contracts across supported chains
5. **API Specifications**: REST and WebSocket endpoints
6. **Indexer API**: Trading metrics, account events, volume statistics, and rankings
7. **Orderly One API**: DEX creation, graduation, and management API documentation
8. **Workflow Guides**: Common development task explanations

## Project Structure

```
orderly-mcp/
├── src/
│   ├── index.ts                 # Main server entry (stdio mode)
│   ├── http-server.ts           # HTTP server entry (stateless mode)
│   ├── server.ts                # Shared MCP server logic
│   ├── tools/
│   │   ├── searchDocs.ts        # Documentation search
│   │   ├── sdkPatterns.ts       # SDK pattern lookup
│   │   ├── contracts.ts         # Contract address lookup
│   │   ├── workflows.ts         # Workflow explanations
│   │   ├── apiInfo.ts           # API documentation
│   │   ├── indexerApi.ts        # Indexer API documentation
│   │   ├── componentGuides.ts   # Component building guides
│   │   └── orderlyOneApi.ts     # Orderly One API documentation
│   ├── resources/
│   │   └── index.ts             # Resource handlers
│   └── data/
│       ├── documentation.json   # Searchable documentation chunks
│       ├── sdk-patterns.json    # SDK patterns and examples
│       ├── contracts.json       # Contract addresses
│       ├── workflows.json       # Workflow explanations
│       ├── api.json             # API specifications
│       ├── indexer-api.json     # Indexer API documentation
│       ├── orderly-one-api.json # Orderly One API documentation
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
├── .dockerignore                # Docker ignore rules
├── Dockerfile                   # Docker build configuration
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

# 6. Get DEX examples from example-dex repo
# Option A: Basic (FREE - no AI calls)
git clone --depth 1 https://github.com/orderlynetwork/example-dex.git /tmp/example-dex
node scripts/analyze_example_dex.js
node scripts/enrich_sdk_patterns_with_examples.js

# Option B: AI-Enhanced (~$1-3, better documentation)
# git clone --depth 1 https://github.com/orderlynetwork/example-dex.git /tmp/example-dex
# node scripts/analyze_example_dex.js
# USE_AI=true node scripts/enrich_sdk_patterns_with_examples.js

# 7. Generate documentation and workflows
node scripts/generate_mcp_data.js

# 8. Generate API docs from OpenAPI spec
node scripts/generate_api_from_openapi.js

# 9. Generate Indexer API docs from OpenAPI spec
node scripts/generate_indexer_api.js

# 10. Generate contract addresses
node scripts/generate_contracts.js

# 11. Build and test
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

| File                      | Source                         | Generation Script                                                                                 |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **documentation.json**    | Official docs + Telegram chats | `generate_mcp_data.js`                                                                            |
| **sdk-patterns.json**     | SDK source code (GitHub)       | `analyze_sdk.js`                                                                                  |
| **sdk-patterns.json**     | Example DEX repo (GitHub)      | `analyze_example_dex.js` + `enrich_sdk_patterns_with_examples.js` (add `USE_AI=true` for AI mode) |
| **component-guides.json** | SDK source code (GitHub)       | `analyze_sdk.js`                                                                                  |
| **workflows.json**        | Official docs + Telegram chats | `generate_mcp_data.js`                                                                            |
| **api.json**              | OpenAPI spec                   | `generate_api_from_openapi.js`                                                                    |
| **indexer-api.json**      | Indexer API OpenAPI spec       | `generate_indexer_api.js`                                                                         |
| **orderly-one-api.json**  | Orderly One OpenAPI spec       | `generate_orderly_one_api.js`                                                                     |
| **contracts.json**        | Official docs (llms-full.txt)  | `generate_contracts.js`                                                                           |

## Contributing

To add new content, you need to update the source data and regenerate:

1. **New Documentation**: Update `llms-full.txt` or Telegram exports, then run generation scripts
2. **New SDK Pattern**: The SDK is auto-parsed from GitHub - patterns appear automatically when SDK updates
3. **New DEX Examples**: Clone the [example-dex](https://github.com/orderlynetwork/example-dex) repo and run the analysis scripts
4. **New Chain**: Update source documentation, then regenerate
5. **New Workflow**: Add to source docs or Telegram chats, then regenerate

## License

MIT

## Support

- Orderly Documentation: https://orderly.network/docs
- SDK Repository: https://github.com/OrderlyNetwork/js-sdk
- Orderly Discord: https://discord.gg/OrderlyNetwork
