# AGENTS.md - Orderly MCP Server

## Project Overview

This is a Model Context Protocol (MCP) server that provides Orderly Network documentation and SDK patterns to AI assistants. It enables developers to query documentation, get code examples, and receive guidance on building trading UIs.

**Key Technologies:**

- TypeScript (ES modules)
- MCP SDK for tool/resource definitions
- Vitest for testing
- Yarn for package management
- ESLint + Prettier for code quality

## Architecture

**Entry Points:**

- `src/index.ts` - Stdio transport (for local MCP clients like Claude Desktop)
- `src/http-server.ts` - HTTP transport (for hosted deployments, Docker)
- `src/server.ts` - Shared MCP server logic (tools, resources, handlers)

**Transports:**

- **Stdio**: Default for local AI assistants, communicates via stdin/stdout
- **HTTP**: Stateless Streamable HTTP transport for remote access, runs on port 3000
- **Docker**: Runs HTTP mode by default with health checks

**Tools** (`src/tools/*.ts`):

- `searchDocs.ts` - Search documentation chunks
- `sdkPatterns.ts` - Get SDK hook patterns
- `contracts.ts` - Contract address lookup
- `workflows.ts` - Workflow explanations
- `apiInfo.ts` - API documentation
- `componentGuides.ts` - Component building guides

**Data** (`src/data/*.json`):

- Static JSON files with documentation, patterns, addresses
- Imported with `with { type: "json" }` syntax
- Read at runtime by tools

**Resources** (`src/resources/index.ts`):

- Handles URI-based resource requests
- Returns markdown or JSON content

## Common Tasks

### Build Project

```bash
yarn build
```

### Run Tests

```bash
yarn test:run          # Run all tests once
yarn test              # Watch mode
yarn test:coverage     # With coverage report
```

### Code Quality

```bash
yarn lint              # Check for issues
yarn lint:fix          # Fix auto-fixable issues
yarn format            # Format all files
yarn format:check      # Check formatting
yarn typecheck         # TypeScript check
```

### Development

```bash
yarn dev               # Watch mode build
yarn start             # Run built server (stdio mode)
yarn start:http        # Run HTTP server (port 3000)
```

### Docker

```bash
# Build Docker image
docker build -t orderly-mcp .

# Run container
docker run -p 3000:3000 orderly-mcp
```

## Project Structure

```
src/
├── index.ts                    # Stdio transport (for local MCP clients)
├── http-server.ts              # HTTP transport (for hosted deployments)
├── server.ts                   # Shared MCP server logic (tools, resources, handlers)
├── tools/                      # Tool implementations
│   ├── searchDocs.ts          # Doc search
│   ├── sdkPatterns.ts         # SDK patterns
│   ├── contracts.ts           # Contract lookup
│   ├── workflows.ts           # Workflows
│   ├── apiInfo.ts             # API info
│   └── componentGuides.ts     # Component guides
├── resources/
│   └── index.ts               # Resource handlers
├── data/                       # Static data
│   ├── documentation.json     # Searchable docs
│   ├── sdk-patterns.json      # SDK patterns
│   ├── contracts.json         # Contract addresses
│   ├── workflows.json         # Workflows
│   ├── api.json               # API docs
│   ├── component-guides.json   # Component guides
│   └── resources/
│       └── overview.md
└── __tests__/                  # Test files
    ├── contracts.test.ts
    └── searchDocs.test.ts
```

## Updating Documentation

The documentation is auto-generated using NEAR AI Cloud. All data files in `src/data/` are created by scripts, not manually edited.

### Data Generation Workflow

**Prerequisites:**

1. NEAR AI API key in `.env` file: `NEAR_AI_API_KEY=your_key`
2. Get API key at: https://cloud.near.ai/api-keys

**Option A: Complete Regeneration (Recommended)**

Generate everything from scratch using both Telegram chats and official docs:

```bash
# 1. Download latest official docs
curl -o llms-full.txt https://orderly.network/docs/llms-full.txt

# 2. Split Telegram export (if you have one)
node scripts/split_telegram_chats.js

# 3. Analyze Telegram chats → tg_analysis.json
node scripts/analyze_chat_openai.js

# 4. Analyze docs → docs_analysis.json
node scripts/analyze_llms_full.js

# 5. Generate all data files at once
node scripts/generate_mcp_data.js

# 6. Build and test
yarn build && yarn test:run
```

**Option B: Update Only Documentation**

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

**Option C: Manual Editing (Not Recommended)**

For emergency fixes, you can edit `src/data/*.json` directly, but these will be overwritten next time you run the generation scripts.

```bash
# Edit files, then validate:
yarn build && yarn test:run
```

### Scripts Reference

#### `scripts/analyze_chat_openai.js`

**Purpose:** Extract Q&A from Telegram group chats  
**Input:** `telegram_chat_exports/*.json` (from split_telegram_chats.js)  
**Output:** `tg_analysis.json` (root level)  
**API:** NEAR AI Cloud, Model: `zai-org/GLM-4.7`  
**Cost:** ~$0.50-1.00

Processes real developer conversations to extract technical Q&A.

#### `scripts/analyze_llms_full.js`

**Purpose:** Extract Q&A from official Orderly docs  
**Input:** `llms-full.txt`  
**Output:** `docs_analysis.json` (root level)  
**API:** NEAR AI Cloud, Model: `zai-org/GLM-4.7`  
**Cost:** ~$1.00-2.00

Processes official documentation to extract structured Q&A.

#### `scripts/generate_mcp_data.js`

**Purpose:** Master generation script - creates all data files  
**Input:**

- `tg_analysis.json` (from Telegram analysis)
- `docs_analysis.json` (from docs analysis)

**Output:** All files in `src/data/`:

- `documentation.json`
- `sdk-patterns.json`
- `workflows.json`
- `api.json`
- `component-guides.json`

**API:** NEAR AI Cloud with structured output (Zod schemas)  
**Cost:** ~$2.00-4.00

#### `scripts/analyze_sdk.js` ⭐ **NEW & RECOMMENDED**

**Purpose:** Extract SDK patterns directly from source code  
**Input:** Clones from `https://github.com/OrderlyNetwork/js-sdk`  
**Output:** `src/data/sdk-patterns.json` (enhanced with real types)  
**Cost:** **FREE** (no AI calls, pure code analysis)

**What it extracts:**

- Hook implementations (useOrderEntry, usePositionStream, etc.)
- Component props and interfaces
- Type definitions (enums, interfaces)
- Real working code patterns
- Return types and parameters

**Why this is better:**

- Always type-accurate (parses actual TypeScript)
- No hallucination (real code, not AI guesses)
- Always up-to-date (clones latest SDK)
- FREE (no API costs)

**Usage:**

```bash
# This enhances sdk-patterns.json with real SDK data
node scripts/analyze_sdk.js
```

#### `scripts/analyze_example_dex.js` ⭐ **NEW - DEX Examples**

**Purpose:** Extract chart and DEX component examples from example-dex repo  
**Input:** Clones from `https://github.com/OrderlyNetwork/example-dex`  
**Output:** `example_dex_analysis.json` (root level)  
**Cost:** **FREE** (no AI calls, pure code analysis)

**What it extracts:**

- **Chart implementations:**
  - Lightweight Charts integration (custom candlestick charts)
  - TradingView widget setup
  - WebSocket kline data service
- **Trading components:**
  - Order entry forms (market/limit/stop/bracket)
  - Orderbook display with depth visualization
  - Symbol selection and headers
- **Position components:**
  - Position table with PnL
  - Position update/close modals
- **Order components:**
  - Pending orders list
  - Take Profit / Stop Loss orders
- **Wallet components:**
  - Multi-chain wallet connection (EVM + Solana)
  - Connection dropdowns
- **Account components:**
  - Assets/balance display
  - Deposit/withdraw UI
  - Leverage management

**Why this is useful:**

- Real working DEX code examples
- Complete component implementations
- Chart integration patterns
- WebSocket data handling
- FREE (no API costs)

**Usage:**

```bash
# 1. Clone the example-dex repo
 git clone --depth 1 https://github.com/orderlynetwork/example-dex.git /tmp/example-dex

# 2. Analyze and extract patterns
node scripts/analyze_example_dex.js

# 3. Merge into SDK patterns
node scripts/enrich_sdk_patterns_with_examples.js
```

#### `scripts/enrich_sdk_patterns_with_examples.js`

**Purpose:** Merge example-dex analysis into sdk-patterns.json  
**Input:** `example_dex_analysis.json`  
**Output:** Updated `src/data/sdk-patterns.json`  
**Cost:** **FREE** (or ~$1.00-3.00 with AI mode)

Adds real-world code examples from the example-dex repository to the SDK patterns data, making them available via the MCP server.

**Two modes:**

1. **Basic Mode** (default): Direct code copying with truncation
2. **AI-Enhanced Mode**: Intelligent code analysis and documentation generation

**What AI adds:**

- **Intelligent code analysis** - Extracts key patterns from full files
- **Enhanced documentation** - Clear explanations and usage guides
- **Educational code snippets** - Focused examples (not truncated)
- **Troubleshooting tips** - Common issues and solutions
- **Cross-referencing** - Links related patterns together
- **Difficulty assessment** - Tags beginner/intermediate/advanced
- **Prerequisites** - Lists what you need to know first

**Usage:**

```bash
# Basic mode (FREE)
node scripts/enrich_sdk_patterns_with_examples.js

# AI-enhanced mode (~$1-3)
USE_AI=true node scripts/enrich_sdk_patterns_with_examples.js
```

**Recommended workflow:**

```bash
# 1. Get SDK patterns (FREE and accurate)
node scripts/analyze_sdk.js

# 2. Get DEX examples (choose mode)
node scripts/analyze_example_dex.js
node scripts/enrich_sdk_patterns_with_examples.js  # Basic
# USE_AI=true node scripts/enrich_sdk_patterns_with_examples.js  # AI-enhanced

# 3. Analyze Telegram for real Q&A (paid)
node scripts/analyze_chat_openai.js

# 4. Analyze docs for API details (paid)
node scripts/analyze_llms_full.js

# 5. Generate everything
node scripts/generate_mcp_data.js

# 6. Build and test
yarn build && yarn test:run
```

#### `scripts/split_telegram_chats.js`

**Purpose:** Split large Telegram export into individual chats  
**Input:** `result.json` (Telegram export)  
**Output:** `telegram_chat_exports/*.json`

Filters out non-group chats and applies blacklist.

### Cost Management

**Total cost per complete run:** ~$3.50-7.00

- SDK analysis: **FREE** (parses source code directly)
- Telegram analysis: ~$0.50-1.00
- Docs analysis: ~$1.00-2.00
- Data generation: ~$2.00-4.00

**Money-saving tips:**

1. Use `analyze_sdk.js` first for SDK patterns - it's FREE and provides type-accurate results
2. Keep `tg_analysis.json` and `docs_analysis.json` - don't delete them
3. Only re-run analysis if source data changes
4. Use `MAX_FILES_TO_PROCESS` in scripts for testing
5. Re-use existing analysis files with `generate_mcp_data.js`

## Testing Guidelines

- Test files: `src/__tests__/*.test.ts`
- Use Vitest (`describe`, `it`, `expect`)
- Test tool functions directly (they're exported)
- Add tests for new contract chains
- Documentation/SDK tests usually covered by existing search tests

## Code Style

- TypeScript with strict mode
- ES modules (`"type": "module"`)
- Single quotes, 100 char line width (Prettier)
- Import assertions: use `with { type: "json" }` not `assert`
- Export interfaces for tool results

## MCP Protocol

**Tools:** Functions that take parameters and return content

```typescript
// Tool definition in index.ts
{
  name: "tool_name",
  description: "What it does",
  inputSchema: { /* JSON schema */ }
}

// Tool execution
case "tool_name":
  return await toolFunction(args);
```

**Resources:** URI-addressable content

```typescript
// Resource list in index.ts
{ uri: "orderly://resource", name: "Name", description: "..." }

// Resource handler in resources/index.ts
switch (uri) { case "orderly://resource": ... }
```

## Debugging

**Build Errors:**

- Check TypeScript version compatibility
- Ensure `with { type: "json" }` not `assert`
- Run `yarn typecheck` for detailed errors

**MCP Connection Issues:**

- Verify server starts: `node dist/index.js`
- Check stdio transport (no console.log in production)
- Validate JSON tool/resource definitions

**Test Failures:**

- Check data file paths
- Verify JSON imports have correct syntax
- Ensure test expectations match current data

## External Resources

- Orderly Docs: https://orderly.network/docs
- SDK Repo: https://github.com/OrderlyNetwork/js-sdk
- MCP Spec: https://modelcontextprotocol.io
- Contract ABIs: https://github.com/OrderlyNetwork/contract-evm-abi
- NEAR AI Cloud: https://cloud.near.ai
