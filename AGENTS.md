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

- `searchDocs.ts` - Unified fuzzy search over `documentation.json` **and** type-accurate SDK symbols (`sdk-symbols.json`). A single `search_orderly_docs` tool surfaces doc chunks and inline hook/type/component/function records (signature, params, returns, props, source) from the js-sdk symbol bundle.
- `contracts.ts` - Contract address lookup
- `workflows.ts` - Workflow explanations
- `apiInfo.ts` - API documentation
- `indexerApi.ts` - Indexer API documentation
- `componentGuides.ts` - Component building guides
- `orderlyOneApi.ts` - Orderly One API documentation
- `svApi.ts` - Strategy Vault API documentation
- `publicInfoApi.ts` - Public Info API documentation

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

### Refresh API Data (Free)

Regenerate all OpenAPI-sourced data files with no AI calls or API keys:

```bash
yarn update:free
```

Runs: `generate_api_from_openapi`, `generate_indexer_api`, `generate_sv_api`,
`generate_contracts`, and `generate_orderly_one_api` — then builds and tests.

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

> `.prettierignore` excludes generated artifacts (`src/data/**/*.json`, root
> `*_analysis.json`, `dist/`, lockfiles, etc.), so `format:check` reflects real
> source code only. Never format the generated JSON in `src/data/` by hand.

### Verification (run after EVERY change)

After any source change, run the full gate and ensure **all** pass before
reporting a task complete:

```bash
yarn typecheck && yarn lint && yarn format:check && yarn test:run && yarn build
```

- **`typecheck`** — `tsc --noEmit`; must be error-free.
- **`lint`** — ESLint with `--max-warnings 0`; fix *all* errors (including stale
  `eslint-disable` directives) before finishing.
- **`format:check`** — Prettier. If it fails on a file you touched, run
  `npx prettier --write <file>`. Do not "fix" failures by adding ignores.
- **`test:run`** — Vitest one-shot; every suite must pass.
- **`build`** — esbuild bundle + type declarations; the data dir is copied to
  `dist/`, so re-run after changing anything under `src/data/`.

Only report a task as complete once the full gate is green. If a check cannot
pass for a legitimate reason, state that explicitly rather than claiming success.

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
│   ├── searchDocs.ts          # Unified doc + SDK symbol search
│   ├── contracts.ts           # Contract lookup
│   ├── workflows.ts           # Workflows
│   ├── apiInfo.ts             # API info
│   ├── indexerApi.ts          # Indexer API info
│   ├── componentGuides.ts     # Component guides
│   ├── orderlyOneApi.ts       # Orderly One API documentation
│   ├── svApi.ts               # Strategy Vault API documentation
│   └── publicInfoApi.ts       # Public Info API documentation
├── resources/
│   └── index.ts               # Resource handlers
├── data/                       # Static data
│   ├── documentation.json     # Searchable docs
│   ├── sdk-symbols.json       # Type-accurate SDK symbols (hooks/types/components/functions)
│   ├── contracts.json         # Contract addresses
│   ├── workflows.json         # Workflows
│   ├── api.json               # API docs
│   ├── indexer-api.json       # Indexer API docs
│   ├── orderly-one-api.json   # Orderly One API documentation
│   ├── sv-api.json             # Strategy Vault API documentation
│   ├── public-info-api.json    # Public Info API documentation
│   ├── component-guides.json   # Component guides
│   └── resources/
│       └── overview.md
└── __tests__/                  # Test files
    ├── contracts.test.ts
    └── searchDocs.test.ts
```

## Updating Documentation

The documentation is auto-generated using NEAR AI Cloud. All data files in `src/data/` are created by scripts, not manually edited.

**Exception:** the hand-curated chunks in `documentation.json` — `predict-*` (including the live fee schedule), `basics-*`, `perp-anything-*`, and `faucet-testnet` — are not produced by the generators. Preserve them when improving or regenerating the corpus, and keep `src/__tests__/predictDocs.test.ts`, `src/__tests__/marketBasicsDocs.test.ts`, `src/__tests__/perpAnythingDocs.test.ts`, and `src/__tests__/faucetDocs.test.ts` green.

### Data Generation Workflow

**Prerequisites:**

1. NEAR AI API key in `.env` file: `NEAR_AI_API_KEY=your_key`
2. Get API key at: https://cloud.near.ai/api-keys

**Option A: Complete Regeneration (Recommended)**

Generate everything from scratch from the official docs repo + (optionally) Telegram chats:

```bash
# 1. (Optional) Process Telegram export — 2 steps with manual review between
node scripts/clean_telegram_export.js                  # 🆓 free, filter → telegram_chats_filtered/
# ...review + delete unwanted files manually...
node scripts/analyze_telegram_chats.js                    # 💰 costs money → tg_analysis.json

# 2. Analyze docs → docs_analysis.json                            💰 costs money
#    (clones OrderlyNetwork/documentation-public automatically)
node scripts/analyze_docs.js

# 3. Generate all data files at once                              💰 costs money
node scripts/generate_mcp_data.js

# 4. Build and test
yarn build && yarn test:run
```

**Option B: Update Only Documentation**

Refresh from official docs (uses git-cloned repo as source):

```bash
# 1. Analyze docs only (clones repo automatically)               💰 costs money
node scripts/analyze_docs.js

# 2. Generate                                                     💰 costs money
node scripts/generate_mcp_data.js

# 3. Build
yarn build
```

**Option C: Manual Editing (Not Recommended)**

For emergency fixes, you can edit `src/data/*.json` directly, but these will be overwritten next time you run the generation scripts.

```bash
# Edit files, then validate:
yarn build && yarn test:run
```

### Scripts Reference

#### `scripts/clean_telegram_export.js`

**Purpose:** Filter raw Telegram Desktop export down to relevant Orderly group chats and write each as a clean plain-text chat log  
**Input:** `result.json` (set `INPUT=path` env to override)  
**Output:** `telegram_chats_filtered/` directory — one `.txt` per kept chat (header + transcript body)  
**Cost:** 🆓 free (pure JSON streaming, no AI)

**Chat-level filters** (keep chat if ALL of):
- Type contains "group"
- Name contains "Orderly" (case-insensitive)
- Name contains `<>` (literal pair) OR `&` OR ` x ` (with spaces) OR `|`
- Name does NOT contain any of: `Orderly One`, `Configuration`, `Orderly Team` (final override)

**Message-level preprocessing** (applied after chat-level filters, before writing the .txt):

Filters in order: service messages → blocked senders (`BLOCKED_SENDERS` env) → empty text → URL-only messages → too-short (`MIN_MESSAGE_LENGTH` env, default 10 chars) → reply-quote stripping. Text extraction properly handles all 3 Telegram forms (string / array-of-entities / single-object) — fixes a prior bug where array-form `text_entities` got `JSON.stringify`'d into garbage.

**Output format** (per file):
```
# Chat: Orderly | DeFi
# Source: result.json (filtered on 2026-07-14)
# Stats: 4500 raw messages → 1850 kept
#   Dropped: 2100 service, 400 too-short, 100 url-only, 50 blocked-sender, 0 empty

[2024-01-15 10:30] John Doe: Hey, how do I use the orderbook API?
[2024-01-15 10:32] Alice: Subscribe to the WS topic orderbook.BTC-PERP first.
```

Idempotent — clears output dir at start. Output is human-reviewable plain text so you can quickly read and delete unwanted chats before AI analysis.

**Env vars:**
- `INPUT=/path/to/result.json` — override input location
- `BLOCKED_SENDERS=bot1,bot2` — comma-separated sender names to drop (case-insensitive substring)
- `MIN_MESSAGE_LENGTH=10` — messages shorter than this after trim get dropped (set `0` to disable)

#### `scripts/analyze_telegram_chats.js`

**Purpose:** Extract Q&A from Telegram group chat logs (after manual review)  
**Input:** `telegram_chats_filtered/*.txt` (from `clean_telegram_export.js`). Legacy `.json` files (pre-migration raw exports) are still accepted as a backward-compat fallback and preprocessed on the fly.  
**Output:** `tg_analysis.json` (root level) — v2.0.0 shape: `{ version, generatedAt, mode, model, promptVersion, qa_pairs, _sources, _stats }`. The flat `qa_pairs` array is preserved for backward compatibility.  
**API:** NEAR AI Cloud, Model: `qwen/qwen3.7-max`
**Cost:** 💰 costs money (incremental: only new/changed chat files are re-sent to AI)

**Incremental mode (default):** Each chat file is fingerprinted (md5 of `PROMPT_VERSION` + filename + content). Bumping `PROMPT_VERSION` invalidates the whole cache on the next run, guaranteeing the corpus reflects the current prompt. Unchanged files are skipped on subsequent runs. Checkpoint written after every file (crash-safe — writes are serialized via a mutex so concurrent workers don't clobber each other). Transient AI failures preserve the previous result.

**Concurrency:** Up to `CONCURRENCY` (default 5, override with env var) chat files are processed in parallel via a worker pool. Each worker pulls the next file from a shared index, so fast files don't wait for slow ones. Checkpoint writes are serialized via a promise-chain mutex to prevent concurrent file-write corruption. Log lines are prefixed with `[i/N filename]` so interleaved output stays traceable. Set `CONCURRENCY=1` for sequential (debug-friendly).

**Call config:** Client `timeout: 30min`, `maxRetries: 0`. Each AI call is wrapped in a 4-attempt retry loop with `[0, 30s, 60s, 120s]` backoff (mirrors `analyze_docs.js`); any error — not just rate-limit — triggers the next attempt. Returns `null` after all attempts fail so the caller preserves the cached entry instead of overwriting it with garbage.

**Cache invalidation:** Switching from `.json` (raw) to `.txt` (clean chat log) changes every file's content hash, so the first run after migration re-processes every file (one-time cost). Subsequent runs are cached as normal. Bumping `PROMPT_VERSION` does the same — use it when the system prompt changes meaningfully.

**Loading + metadata injection:** `.txt` files have their `# Chat:` / `# Stats:` header block parsed (chat name, kept-message count) and the transcript body scanned for `[YYYY-MM-DD HH:MM]` stamps to derive a date range. All three are passed to the AI in the user prompt as `Chat:` / `Date range:` / `Messages:` lines, so the model can ground extraction in which chat it's reading. The header itself is stripped from the transcript body. Legacy `.json` files derive the same metadata from raw Telegram fields (`chatData.name`, min/max `compactDate`, kept length).

**Cross-file context (mirrors `analyze_docs.js`):** On every cache miss, up to `MAX_CONTEXT_PAIRS` (30) relevant prior Q&A pairs from the WHOLE corpus are passed to the AI as `PREVIOUSLY EXTRACTED Q&A PAIRS`. Selection: tokenize the current chat's display name (drop stopwords like "Orderly", "Network", "Chat"), score every existing pair by keyword hit in `question+answer`, take top-N. Same-file cached pairs (for refinement) are merged in, deduped by `question` text, capped at 30. The system prompt explicitly tells the model NOT to echo back unchanged existing pairs — only NEW pairs or REFINED/UPDATED versions.

**Inference prompt structure:** Role → OUTPUT SCHEMA (concrete JSON example) → CORRECTNESS RULES (accuracy / no personal info / no dates / no meta-refs / actionability / link handling / incomplete-info) → CONTEXT PAIR HANDLING → existing pairs JSON block → user prompt with `Chat:` / `Date range:` / `Messages:` metadata + transcript body. `temperature: 0.2` (extraction task).

Per-chat log shows transcript size + token estimate + context-pair count + retry attempts on failure. Transcripts over `MAX_TRANSCRIPT_TOKENS` (50k tokens, ~200k chars) are truncated to the **latest** messages at message boundaries (tail kept, head dropped) — keeps cost predictable and avoids the model dropping the tail under context pressure.

**Env vars:**
- `BLOCKED_SENDERS=bot1,bot2` — only used by the legacy-`.json` fallback path (for `.txt` files, preprocessing already ran at cleanup time)
- `MIN_MESSAGE_LENGTH=10` — same, legacy-`.json` fallback only
- `CONCURRENCY=5` — number of chat files to process in parallel (set `1` for sequential, debug-friendly)
- `NEAR_AI_TIMEOUT_MS=1800000` — per-request timeout in ms (default 30 min)

**Existing-data-aware:** Up to 30 relevant prior Q&A pairs are passed as refinement context on each AI call.

**Force mode:** `FORCE=true node scripts/analyze_telegram_chats.js` re-analyzes every file.

#### `scripts/analyze_docs.js`

**Purpose:** Extract Q&A from official Orderly docs (per-file from git repo)  
**Input:** Clones `https://github.com/OrderlyNetwork/documentation-public` automatically, processes the 49 canonical pages listed in `llms.config.json`  
**Output:** `docs_analysis.json` (root level) — v3.0.0 shape: `{ version, source, generatedAt, mode, model, qa_pairs, _files, _stats }`. The flat `qa_pairs` array is preserved for backward compatibility.  
**API:** NEAR AI Cloud, Model: `qwen/qwen3.7-max`
**Cost:** 💰 costs money (incremental: only new/changed MDX pages are re-sent to AI)

**Incremental mode (default):** Each canonical MDX page is fingerprinted by content hash (md5 of route + file content). Editing one doc only invalidates that one page's cache. Checkpoint after every page (crash-safe).

**Existing-data-aware:** On any AI call, up to 20 relevant prior Q&A pairs (filtered by keyword overlap with the page's title/description/section) are passed as context. The AI is instructed to UPDATE existing pairs where the page content improves the answer, preserving good content from prior model versions.

**Force mode:** `FORCE=true node scripts/analyze_docs.js` re-clones the repo and reprocesses every page.

**Smoke-test:** `MAX_FILES_TO_PROCESS=2 node scripts/analyze_docs.js` processes only the first 2 canonical pages.

**Skip clone:** `SKIP_CLONE=true` reuses existing `.temp-docs/` directory (faster prompt iteration).

Processes official documentation to extract structured Q&A.

#### `scripts/generate_mcp_data.js`

**Purpose:** Generates `documentation.json` and `workflows.json` from upstream Q&A analyses  
**Input:**

- `docs_analysis.json` (required; legacy flat-array OR v3.0.0 object — both auto-detected)
- `tg_analysis.json` (optional — read opportunistically if produced by `analyze_telegram_chats.js`)

**Output:** `src/data/documentation.json` and `src/data/workflows.json` only.  
(Other data files have dedicated generators: `generate_sdk_symbols.js` → `sdk-symbols.json`, `analyze_sdk.js` → `component-guides.json`, `generate_api_from_openapi.js` → `api.json`, etc.)

**API:** NEAR AI Cloud, Model: `qwen/qwen3.7-max`
**Cost:** 💰 costs money (incremental: each Q&A batch is content-fingerprinted; cache hits skip AI calls)

**Incremental mode (default):** Each category batch (≤200 Q&A pairs) and each how-to batch is content-addressable by md5 fingerprint. Cache is stored inline in the output file under `_batchCache`. Orphaned entries are pruned at end of run. Checkpoint written after every batch (crash-safe).

**Chunk ID format (v4.0.0):** Documentation chunks use stable batch-indexed IDs (`<category>-b<batchIdx>-c<k>`) so cached batches don't create gaps. Replaces the previous sequential `<category>-<n>` format.

**Force mode:** `FORCE=true node scripts/generate_mcp_data.js` re-processes every batch.

#### `scripts/generate_sdk_symbols.js` ⭐ **RECOMMENDED — SDK symbols**

**Purpose:** Pull the type-accurate SDK symbol bundle (hooks/types/components/functions) from the published `@orderly.network/sdk-docs` npm package and flatten it into a Fuse-friendly `src/data/sdk-symbols.json`. These symbols are indexed by the unified `search_orderly_docs` tool and surfaced inline (signature, params, returns, props, source path).
**Input:** npm registry — `@orderly.network/sdk-docs` tarball `bundled/json/*.json` (produced upstream by js-sdk's `apps/ai-docs` TS-Compiler pipeline).
**Output:** `src/data/sdk-symbols.json` (deduped by id; hooks always kept; types/components/functions kept when documented).
**Cost:** 🆓 free (no AI calls, no native builds; downloads the ~720 KB tarball and parses JSON).

**Why this is the SDK symbol source:**

- Always type-accurate (parses actual TypeScript upstream via the official ai-docs pipeline)
- No hallucination (real code, not AI guesses)
- Always up-to-date (`npm pack` pulls the latest published bundle)
- FREE (no API costs, no `better-sqlite3`/`node-llama-cpp` native deps)
- Zero new runtime deps — consumed as data, not as a package

**Usage:**

```bash
node scripts/generate_sdk_symbols.js
# Pin a specific version:
SDK_DOCS_VERSION=1.1.7 node scripts/generate_sdk_symbols.js
```

Wired into `yarn update:free`.

#### `scripts/analyze_sdk.js`

**Purpose:** Extract component-building guides directly from SDK source code
**Input:** Clones from `https://github.com/OrderlyNetwork/js-sdk`
**Output:** `src/data/component-guides.json` (consumed by `get_component_guide`; also feeds `orderly://sdk/components`, which merges these guides with type-accurate symbols from `sdk-symbols.json`). Also historically wrote `src/data/sdk-patterns.json`; that file is **superseded and unused** — SDK symbol lookup now flows through `sdk-symbols.json` (see `generate_sdk_symbols.js` above). Do not rely on the `sdk-patterns.json` byproduct.
**Cost:** 🆓 free (no AI calls, pure code analysis)

**Usage:**

```bash
node scripts/analyze_sdk.js
```

#### `scripts/generate_api_from_openapi.js`

**Purpose:** Generate REST and WebSocket API documentation from OpenAPI spec  
**Input:** OpenAPI YAML spec from GitHub (`https://raw.githubusercontent.com/OrderlyNetwork/documentation-public/refs/heads/main/orderly.openapi.yaml`)  
**Output:** `src/data/api.json`  
**Cost:** 🆓 free (no AI calls, direct YAML parsing)

Extracts endpoints, parameters, request/response schemas, and generates code examples.

#### `scripts/generate_indexer_api.js`

**Purpose:** Generate Indexer API documentation from OpenAPI spec  
**Input:** Indexer API OpenAPI JSON spec (`https://orderly-dashboard-query-service.orderly.network/api-docs/openapi.json`)  
**Output:** `src/data/indexer-api.json`  
**Cost:** 🆓 free (no AI calls, direct JSON parsing)

Extracts 12 endpoints across 3 categories:

- **Trading Metrics**: Daily volume, fees, perp data
- **Events**: Account events (trades, settlements, liquidations, transactions) with pagination
- **Rankings**: Positions, PnL, trading volume, deposits/withdrawals

Also extracts 43 schemas for request/response types.

#### `scripts/generate_sv_api.js`

**Purpose:** Generate Strategy Vault API documentation from OpenAPI spec  
**Input:** OpenAPI YAML spec from GitHub (`https://raw.githubusercontent.com/OrderlyNetwork/documentation-public/refs/heads/main/sv.openapi.yaml`)  
**Output:** `src/data/sv-api.json`  
**Cost:** 🆓 free (no AI calls, direct YAML parsing)

Extracts 23 endpoints across 5 categories:

- **Strategy Vault Info**: Vault info, performance, positions, orders, trade history
- **Strategy Provider**: Provider info, fees, claimable amounts, transaction history
- **Fund Management**: Fund info, period history, pending transactions
- **Liquidity Provider**: LP info, fees, performance, claim info
- **User**: User-level overview statistics across all strategy vaults

Also extracts 24 schemas for response types.

**Usage:**

```bash
node scripts/generate_sv_api.js
```

#### `scripts/generate_orderly_one_api.js`

**Purpose:** Generate Orderly One API documentation from local OpenAPI spec  
**Input:** Local OpenAPI JSON spec (`http://localhost:3001/openapi.json`)  
**Output:** `src/data/orderly-one-api.json`  
**Cost:** 🆓 free (no AI calls, direct JSON parsing)

Extracts 32 endpoints across 7 categories:

- **Authentication**: Wallet signature-based auth (nonce, verify, validate)
- **DEX**: DEX management - create, update, deploy, and manage exchanges
- **Graduation**: Upgrade from demo to full broker with fee splits
- **Theme**: AI-powered theme generation and customization
- **Stats**: Platform-wide statistics and analytics
- **Leaderboard**: DEX rankings and performance metrics
- **Admin**: Administrative operations

Also extracts 38 schemas for request/response types and includes complete JWT authentication flow documentation.

**Prerequisites:** Orderly One API server must be running on `http://localhost:3001`

**Usage:**

```bash
# Make sure Orderly One API is running
cd ../dex-creator/api && yarn dev

# Generate documentation
node scripts/generate_orderly_one_api.js
```

#### `scripts/generate_public_info_api.js`

**Purpose:** Generate Public Info API documentation from the sibling MDX docs repo  
**Input:** `../documentation/build-on-omnichain/public-info-api/` (23 query-type `.mdx` files + `overview.mdx`; override with `ORDERLY_DOCS_DIR`)  
**Output:** `src/data/public-info-api.json`  
**Cost:** 🆓 free (no AI, no network — pure local MDX parsing)

The Public Info API is a **single POST endpoint** (`POST /v1/public/query`) whose behaviour is selected by a `type` field. This generator parses the structured MDX files (frontmatter + weight line + request/response markdown tables + JSON example blocks) rather than an OpenAPI spec, because no OpenAPI spec exists for it.

Extracts **24 query types** across 4 categories:

- **Market data** (no address): `marketSummary`, `marketDetail`, `orderbook`, `candles`, `marketTrades`, `liquidations`, `fundingRateHistory`, `fundingComparison`
- **Account data** (require `address`): `accounts`, `accountState`, `agentContext`, `feeRate`, `fundingPayments`, `historicalOrders`, `openOrders`, `orderStatus`, `portfolio`, `positionContext`, `trades`, `userDepositsWithdrawals`, `whaleContext`
- **Platform data**: `topAddresses`, `platformPositions`
- **System**: `rateLimitStatus` (extracted from `overview.mdx`, weight 0)

Per query type it captures: `type`, title, description, weight, request params (structured), response field tables (raw markdown for fidelity), labelled response examples, notes, pagination flag, and freshness. The overview block carries the endpoint URL, error codes, address-resolution rules, pagination cursor shapes, rate-limit weight tiers, and a freshness table.

**Usage:**

```bash
node scripts/generate_public_info_api.js
# Override docs location:
ORDERLY_DOCS_DIR=/path/to/docs node scripts/generate_public_info_api.js
```

### Cost Management

**Paid scripts** (require `NEAR_AI_API_KEY` in `.env`):

- `analyze_telegram_chats.js` — 💰 costs money
- `analyze_docs.js` — 💰 costs money
- `generate_mcp_data.js` — 💰 costs money

**Free scripts** (no API keys, no AI calls):

- `clean_telegram_export.js` — 🆓 free (pure JSON streaming)
- `generate_sdk_symbols.js` — 🆓 free (npm tarball pull + JSON parse; SDK symbol source)
- `analyze_sdk.js` — 🆓 free (clones SDK from GitHub; produces `component-guides.json`)
- `generate_api_from_openapi.js` — 🆓 free
- `generate_indexer_api.js` — 🆓 free
- `generate_sv_api.js` — 🆓 free
- `generate_contracts.js` — 🆓 free
- `generate_orderly_one_api.js` — 🆓 free
- `generate_public_info_api.js` — 🆓 free (requires local docs dir)

**Money-saving tips:**

1. Use `generate_sdk_symbols.js` for type-accurate SDK symbols — it's 🆓 free and pulls real TypeScript-extracted data
2. Keep `tg_analysis.json` and `docs_analysis.json` — don't delete them (they contain the cache)
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

## Using the Indexer API Tool

The `get_indexer_api_info` tool helps AI assistants query the Orderly Indexer API. Here's how to navigate it:

### Understanding the Indexer API

The Indexer API is a **read-only** API for historical and aggregated trading data. Key characteristics:

- **No authentication required** (unlike the trading API)
- **Historical data** (not real-time trading)
- **Aggregated metrics** (volume, fees, rankings)
- **Account events** (trades, settlements, liquidations with pagination)

### Navigation Patterns

**1. Start with the overview (no parameters):**

```
get_indexer_api_info
→ Returns complete guide with categories and use cases
```

**2. Browse by category:**

```
get_indexer_api_info category="trading_metrics"
get_indexer_api_info category="events"
get_indexer_api_info category="trades::trades_api"
```

**3. Get specific endpoint details:**

```
get_indexer_api_info endpoint="/daily_volume"
get_indexer_api_info endpoint="/events_v2"
get_indexer_api_info endpoint="ranking/positions"
```

### Common Use Cases

**For Trading Dashboards:**

- Daily volume, fees, perp metrics → `category="trading_metrics"`

**For User History:**

- Account trades, settlements, liquidations → `endpoint="/events_v2"`

**For Leaderboards:**

- Top traders by PnL, volume, positions → `endpoint="ranking/positions"`, `endpoint="ranking/realized_pnl"`, `endpoint="ranking/trading_volume"` (no category — search ranking endpoints directly)

**For Volume Stats:**

- Account or broker volume statistics → `endpoint="/get_account_volume_statistic"`

### Key Differences from Main API

| Aspect    | Main API           | Indexer API    |
| --------- | ------------------ | -------------- |
| Auth      | Required (Ed25519) | Not required   |
| Purpose   | Trading operations | Data querying  |
| Data      | Real-time          | Historical     |
| Write ops | Yes                | No (read-only) |

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
