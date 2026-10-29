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
- **Indexer API**: Trading metrics, account events, trades, and volume statistics

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

### Hosted Server

A publicly hosted instance is available at **`https://mcp.orderly.network`**.

**Health check:**

```bash
curl https://mcp.orderly.network/health
```

**Use in MCP client config (Streamable HTTP):**

```json
{
  "mcpServers": {
    "orderly": {
      "url": "https://mcp.orderly.network/"
    }
  }
}
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

#### 2. HTTP Mode (for self-hosted deployments)

Run as an HTTP server for remote access:

```bash
yarn start:http
```

The server will start on port 3000 (or `PORT` env var):

- MCP endpoint: `http://localhost:3000/`
- Health check: `http://localhost:3000/health`

> **Note:** A public instance is already deployed at `https://mcp.orderly.network` - see [Hosted Server](#hosted-server) above.

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

> **SDK symbols** (hooks, types, components, functions) are now surfaced inline by
> `search_orderly_docs` — see [SDK symbol search](#sdk-symbol-search) below.

### 2. `get_contract_addresses`

Get smart contract addresses for Orderly on specific chains.

**Parameters**:

- `chain` (string, required): Chain name (e.g., 'arbitrum', 'optimism', 'base')
- `contractType` (string, optional): Contract type or 'all' (default: 'all')
- `network` (string, optional): 'mainnet' or 'testnet' (default: 'mainnet')

**Supported chains**:

- EVM: ethereum, arbitrum, optimism, base, mantle, solana
- Orderly L2: orderlyL2

### 3. `explain_workflow`

Get step-by-step explanation of common development workflows.

**Parameters**:

- `workflow` (string, required): Workflow name

**Available workflows**:

- `wallet-connection`: Connect wallet and create Orderly key
- `place-first-order`: Complete flow for placing first trade
- `deposit-funds`: Deposit USDC/tokens to Orderly
- `set-tp-sl`: Set Take Profit and Stop Loss
- `subaccount-management`: Create and manage subaccounts

### 4. `get_api_info`

Get information about Orderly REST API or WebSocket streams.

**Parameters**:

- `type` (string, required): 'rest', 'websocket', or 'auth'
- `endpoint` (string, optional): Specific endpoint or stream name

### 5. `get_indexer_api_info`

Get information about Orderly Indexer API for trading metrics, account events, trades, and volume statistics (rankings endpoints available via endpoint search).

**Parameters**:

- `endpoint` (string, optional): Specific endpoint path or name (e.g., '/events_v2', 'daily_volume', 'ranking/positions')
- `category` (string, optional): Filter by category (e.g., 'trading_metrics', 'events::events_api', 'trades::trades_api')

**Available categories**:

- **Trading Metrics**: Daily volume, fees, perp trading data (`/daily_volume`, `/daily_trading_fee`, `/daily_orderly_perp`)
- **Events**: Account events with pagination (`/events_v2`) - trades, settlements, liquidations, transactions
- **Volume Statistics**: Account and broker volume stats (`/get_account_volume_statistic`, `/get_broker_volume_statistic`)
- **Trades**: Trade data with filters (`/trades`)

**Rankings** (no category; search by endpoint):

- Positions, PnL, trading volume, deposits/withdrawals (`/ranking/positions`, `/ranking/realized_pnl`, `/ranking/trading_volume`, `/ranking/deposit`, `/ranking/withdraw`)

**Example**:

```
# Get all indexer API endpoints
get_indexer_api_info

# Get specific endpoint details
get_indexer_api_info endpoint="/events_v2"

# Get all endpoints in a category
get_indexer_api_info category="trading_metrics"
```

### 6. `get_component_guide`

Get guidance on building React UI components using Orderly SDK.

**Parameters**:

- `component` (string, required): Component type
- `complexity` (string, optional): 'minimal', 'standard', or 'advanced' (default: 'standard')

**Available guides**: `TradingPage`, `OrderBook`, `OrderEntryWidget`, `OrderEntry`, `PositionsWidget`, `WalletConnectorWidget`.

Other components return a pointer to `search_orderly_docs` (scope `sdk`).

### 7. `get_orderly_one_api_info`

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

### Searching SDK Symbols

```
User: "Show me how to use useOrderEntry"

AI uses search_orderly_docs with query "useOrderEntry"
→ Returns inline SDK hook record: signature, params, returns, source path
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
6. **Indexer API**: Trading metrics, account events, trades, and volume statistics
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
│   │   ├── searchDocs.ts        # Unified doc + SDK symbol search
│   │   ├── contracts.ts         # Contract address lookup
│   │   ├── workflows.ts         # Workflow explanations
│   │   ├── apiInfo.ts           # API documentation
│   │   ├── indexerApi.ts        # Indexer API documentation
│   │   ├── componentGuides.ts   # Component building guides
│   │   ├── orderlyOneApi.ts     # Orderly One API documentation
│   │   ├── svApi.ts             # Strategy Vault API documentation
│   │   └── publicInfoApi.ts     # Public Info API documentation
│   ├── resources/
│   │   └── index.ts             # Resource handlers
│   └── data/
│       ├── documentation.json   # Searchable documentation chunks
│       ├── sdk-symbols.json     # Type-accurate SDK symbols (hooks/types/components/functions)
│       ├── contracts.json       # Contract addresses
│       ├── workflows.json       # Workflow explanations
│       ├── api.json             # API specifications
│       ├── indexer-api.json     # Indexer API documentation
│       ├── orderly-one-api.json # Orderly One API documentation
│       ├── sv-api.json          # Strategy Vault API documentation
│       ├── public-info-api.json # Public Info API documentation
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

### Quick Free Refresh

Refresh all OpenAPI-sourced data (no AI calls, no API keys, internet only):

```bash
yarn update:free
```

This runs: `generate_api_from_openapi`, `generate_indexer_api`, `generate_sv_api`, `generate_contracts`, and `generate_orderly_one_api`, then builds and tests.

### Prerequisites

1. NEAR AI API key in `.env` file: `NEAR_AI_API_KEY=your_key`
2. Get API key at: https://cloud.near.ai/api-keys

### Complete Regeneration (Recommended)

Generate everything from scratch:

```bash
# 1. (Optional) Process Telegram export — 2 steps with manual review between
node scripts/clean_telegram_export.js    # 🆓 free, filter → telegram_chats_filtered/
# ...review + delete unwanted files manually...
node scripts/analyze_telegram_chats.js      # 💰 costs money → tg_analysis.json

# 2. Analyze docs → docs_analysis.json                                 💰 costs money
#    (clones OrderlyNetwork/documentation-public automatically)
node scripts/analyze_docs.js

# 3. Get type-accurate SDK symbols from npm                            🆓 free
node scripts/generate_sdk_symbols.js

# 4. Get component-building guides from SDK source                      🆓 free
node scripts/analyze_sdk.js

# 5. Generate documentation and workflows                              💰 costs money
node scripts/generate_mcp_data.js

# 6. Generate API docs from OpenAPI spec                               🆓 free
node scripts/generate_api_from_openapi.js

# 7. Generate Indexer API docs from OpenAPI spec                       🆓 free
node scripts/generate_indexer_api.js

# 8. Generate Orderly One API docs from OpenAPI spec                   🆓 free
node scripts/generate_orderly_one_api.js

# 9. Generate contract addresses                                       🆓 free
node scripts/generate_contracts.js

# 10. Build and test
yarn build && yarn test:run
```

### Update Only Documentation

Refresh from official docs (uses git-cloned repo as source):

```bash
# 1. Analyze docs only (clones repo automatically)                     💰 costs money
node scripts/analyze_docs.js

# 2. Generate                                                           💰 costs money
node scripts/generate_mcp_data.js

# 3. Build
yarn build
```

### Data Files

| File                      | Source                         | Generation Script                                                                                 |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **documentation.json**    | Official docs (git: documentation-public) | `generate_mcp_data.js`                                                                            |
| **sdk-symbols.json**      | `@orderly.network/sdk-docs` npm package | `generate_sdk_symbols.js`                                                                         |
| **component-guides.json** | Hand-written, checked against `@orderly.network/*` 3.3.1 | —                                                                                                     |
| **workflows.json**        | Official docs (git: documentation-public) | `generate_mcp_data.js`                                                                            |
| **api.json**              | OpenAPI spec                   | `generate_api_from_openapi.js`                                                                    |
| **indexer-api.json**      | Indexer API OpenAPI spec       | `generate_indexer_api.js`                                                                         |
| **orderly-one-api.json**  | Orderly One OpenAPI spec       | `generate_orderly_one_api.js`                                                                     |
| **sv-api.json**           | Strategy Vault OpenAPI spec    | `generate_sv_api.js`                                                                              |
| **public-info-api.json**  | Public Info API MDX docs       | `generate_public_info_api.js`                                                                     |
| **contracts.json**        | Official docs (Git: documentation-public) | `generate_contracts.js`                                                                           |

## Contributing

To add new content, you need to update the source data and regenerate:

1. **New Documentation**: Update `documentation-public` repo (or Telegram exports), then run generation scripts
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
