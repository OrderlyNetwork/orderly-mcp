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

Access comprehensive documentation via resource URIs:

- `orderly://overview` - High-level protocol architecture
- `orderly://sdk/hooks` - Complete hooks reference
- `orderly://sdk/components` - Component building guides
- `orderly://contracts` - Contract addresses (JSON)
- `orderly://workflows` - Common workflows
- `orderly://api/rest` - REST API documentation
- `orderly://api/websocket` - WebSocket documentation

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

To update the embedded documentation or add new patterns:

1. Edit the relevant JSON file in `src/data/`
2. Rebuild: `yarn build`
3. Restart the MCP server

### Data Files

- **documentation.json**: Searchable documentation chunks with keywords
- **sdk-patterns.json**: SDK v2 hooks with examples and notes
- **contracts.json**: Contract addresses per chain
- **workflows.json**: Step-by-step workflow explanations
- **api.json**: REST and WebSocket API specs
- **component-guides.json**: Component building patterns

## Contributing

To add new content:

1. **New Documentation**: Add chunk to `documentation.json`
2. **New SDK Pattern**: Add pattern to `sdk-patterns.json`
3. **New Chain**: Add contracts to `contracts.json`
4. **New Workflow**: Add workflow to `workflows.json`

## License

MIT

## Support

- Orderly Documentation: https://orderly.network/docs
- SDK Repository: https://github.com/OrderlyNetwork/js-sdk
- Orderly Discord: https://discord.gg/OrderlyNetwork
