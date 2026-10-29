# MCP Data Generation Scripts

## Overview

These scripts automate the generation of all MCP server data files using **NEAR AI Cloud** with structured output (Zod schemas).

**Model:** `qwen/qwen3.7-max` (via NEAR AI Cloud API)

## Workflow

### Step 1: Analyze Sources

**A. Process Official Documentation**

```bash
# Clone OrderlyNetwork/documentation-public automatically and process
# the canonical pages listed in llms.config.json (incremental — only
# new/changed pages are re-sent to the AI)
node scripts/analyze_docs.js
# Output: docs_analysis.json
```

**B. Process Telegram Chat Export (Optional)**

Two-step pipeline with manual review between:

```bash
# Step 1: Clean & filter raw Telegram export → one .txt chat log per kept chat
node scripts/clean_telegram_export.js
# Output: telegram_chats_filtered/*.txt (review + delete unwanted files manually)

# Step 2: After review, run AI analysis on what you kept
node scripts/analyze_telegram_chats.js
# Output: tg_analysis.json
```

The cleanup script keeps only group chats that:

- Are of type "group" (skips DMs, channels, bots)
- Contain "Orderly" in the name (case-insensitive)
- Contain `<>`, `&`, ` x ` (with spaces), or `|` in the name
- Do NOT contain `Orderly One`, `Configuration`, or `Orderly Team` in the name

Each kept chat is preprocessed (service messages, blocked senders, URL-only,
too-short messages dropped) and written as a plain-text chat log with a header
(chat name, filter date, drop stats) + transcript body — so manual review is
fast and the analyzer just sends the .txt to the AI as-is.

**C. Get SDK Symbols + Component Guides (Optional but Recommended)**

```bash
# Type-accurate SDK symbols (hooks/types/components/functions) from npm — 🆓 free
node scripts/generate_sdk_symbols.js
# Output: src/data/sdk-symbols.json

# Component-building guides from SDK source — 🆓 free
node scripts/analyze_sdk.js
# Output: src/data/component-guides.json
```

`generate_sdk_symbols.js` pulls the type-accurate symbol bundle published by the js-sdk
`apps/ai-docs` pipeline and flattens it for fuzzy search. `analyze_sdk.js` extracts
component-building guides directly from the SDK source tree.

### Step 2: Generate All Data Files

```bash
# This one command generates everything:
node scripts/generate_mcp_data.js
```

This creates:

- `src/data/documentation.json` - Searchable documentation
- `src/data/sdk-symbols.json` - Type-accurate SDK symbols (hooks/types/components/functions)
- `src/data/workflows.json` - Step-by-step workflows
- `src/data/api.json` - API endpoint docs
- `src/data/component-guides.json` - Component building guides

### Step 3: Build and Test

```bash
yarn build && yarn test:run
```

## Scripts Reference

### `clean_telegram_export.js`

**Input:** `result.json` (raw Telegram Desktop export) — set `INPUT=path` env to override  
**Output:** `telegram_chats_filtered/*.txt` — one plain-text chat log per kept chat (header + transcript body)  
**Cost:** 🆓 free (pure JSON streaming, no AI)

Filters the raw Telegram export down to relevant Orderly group chats, then preprocesses each kept chat (drops service messages, blocked senders, URL-only, too-short messages) and writes a clean plain-text chat log:

```
# Chat: Orderly | DeFi
# Source: result.json (filtered on 2026-07-14)
# Stats: 4500 raw messages → 1850 kept
#   Dropped: 2100 service, 400 too-short, 100 url-only, 50 blocked-sender, 0 empty

[2024-01-15 10:30] John Doe: Hey, how do I use the orderbook API?
[2024-01-15 10:32] Alice: Subscribe to the WS topic orderbook.BTC-PERP first.
```

Chat-level filters (keep chat if ALL of): type contains `group`; name contains `Orderly`; name contains `<>` OR `&` OR ` x ` OR `|`; name does NOT contain any of: `Orderly One`, `Configuration`, `Orderly Team` (final override).

Idempotent — clears output dir at start. Output is human-reviewable plain text so you can quickly delete unwanted chats before AI analysis.

**Env vars:** `INPUT`, `BLOCKED_SENDERS`, `MIN_MESSAGE_LENGTH`.

### `analyze_telegram_chats.js`

**Input:** `telegram_chats_filtered/*.txt` (from `clean_telegram_export.js`). Legacy `.json` files are accepted as a backward-compat fallback and preprocessed on the fly.  
**Output:** `tg_analysis.json` (root level) — v2.0.0 shape with per-file cache  
**Cost:** 💰 paid (incremental: only new/changed chat files are re-sent to AI)

Extracts developer Q&A from each kept Telegram chat log. Per-file fingerprint cache (md5 of `PROMPT_VERSION` + filename + content); checkpoint after every file (crash-safe — writes serialized via mutex). **Concurrency:** up to `CONCURRENCY` (default 5) files processed in parallel via worker pool. Force mode: `FORCE=true node scripts/analyze_telegram_chats.js`.

**Call config:** Client `timeout: 30min`, `maxRetries: 0`. Each AI call is wrapped in a 4-attempt retry loop with `[0, 30s, 60s, 120s]` backoff (mirrors `analyze_docs.js`). `temperature: 0.2` (extraction task).

**Loading + metadata injection:** `.txt` files have their `# Chat:` / `# Stats:` header parsed for chat name + kept-message count, and the transcript body scanned for `[YYYY-MM-DD HH:MM]` stamps to derive a date range. All three are passed to the AI in the user prompt as `Chat:` / `Date range:` / `Messages:` lines. The header itself is stripped from the transcript body. Legacy `.json` files derive the same metadata from raw Telegram fields.

**Cross-file context (mirrors `analyze_docs.js`):** On every cache miss, up to 30 relevant prior Q&A pairs from the whole corpus (keyword-filtered by the current chat's name) + same-file cached pairs (for refinement) are passed to the AI, deduped by question text, capped at 30. The system prompt explicitly tells the model NOT to echo back unchanged pairs — only NEW or REFINED/UPDATED versions.

**Cache invalidation:** Switching from `.json` (raw) to `.txt` (clean chat log) changes every file's content hash, so the first run after migration re-processes every file. Subsequent runs are cached as normal. Bumping `PROMPT_VERSION` (in the script) does the same — use it when the system prompt changes meaningfully.

Per-chat log shows transcript size + token estimate + context-pair count + retry attempts on failure (prefixed with `[i/N filename]` for traceable interleaved output):

```
Read .txt transcript.
Chat: "Orderly | Solana", 2024-01-15..2024-03-22
Transcript: 42KB (~11K tokens)
Context: 5 same-file + 12 cross-file → 17 merged (cap 30)
```

Transcripts over `MAX_TRANSCRIPT_TOKENS` (50k tokens, ~200k chars) are truncated to the **latest** messages at message boundaries (tail kept, head dropped). Keeps cost predictable and avoids the model dropping the tail under context pressure.

**Env vars:**

- `BLOCKED_SENDERS=bot1,bot2` — comma-separated sender names to drop (case-insensitive substring)
- `MIN_MESSAGE_LENGTH=10` — messages shorter than this after trim get dropped (set `0` to disable)
- `NEAR_AI_TIMEOUT_MS=1800000` — per-request timeout in ms (default 30 min)
- `CONCURRENCY=5` — number of chat files to process in parallel (set `1` for sequential)

### `analyze_docs.js`

**Input:** Clones `https://github.com/OrderlyNetwork/documentation-public` automatically, processes the 49 canonical pages listed in `llms.config.json`  
**Output:** `docs_analysis.json` (v3.0.0 shape with per-file cache)  
**Cost:** ~$1-3 first run; near $0 on subsequent runs (only changed pages reprocessed)

Processes official Orderly documentation to extract structured Q&A. Per-file fingerprinting means editing one doc only invalidates that one page's cache.

### `generate_mcp_data.js`

**Input:**

- `docs_analysis.json` (required)
- `tg_analysis.json` (optional — read opportunistically if produced by `analyze_telegram_chats.js`)

**Output:** `src/data/documentation.json` and `src/data/workflows.json`  
**Cost:** ~$1-2 first run; near $0 on subsequent runs (per-batch fingerprint cache)

Uses NEAR AI to generate comprehensive documentation chunks and step-by-step workflows from the Q&A pairs.

### `generate_sdk_symbols.js` ⭐ RECOMMENDED (SDK symbols)

**Input:** `@orderly.network/sdk-docs` npm tarball (`bundled/json/*.json`)
**Output:** `src/data/sdk-symbols.json`
**Cost:** 🆓 FREE (npm pull + JSON parse, no AI, no native builds)

Pulls the type-accurate SDK symbol bundle (hooks, types, components, functions) produced
upstream by the js-sdk `apps/ai-docs` TS-Compiler pipeline, and flattens it into a
Fuse-friendly index consumed by `search_orderly_docs`. Hooks are always kept; types,
components, and functions are kept when documented.

### `analyze_sdk.js`

**Input:** Clones from `https://github.com/OrderlyNetwork/js-sdk`
**Output:** `src/data/component-guides.json`
**Cost:** 🆓 FREE (pure code analysis)

Parses the SDK source tree to extract component-building guides (required packages, key
hooks, variants). Note: the checked-in `component-guides.json` is now hand-written and
checked against `@orderly.network/*` 3.3.1; this script is legacy and its output should
not be published as-is. It also historically wrote `src/data/sdk-patterns.json`, which is
now **superseded** — SDK symbol lookup flows through `sdk-symbols.json` (see
`generate_sdk_symbols.js` above).

### `audit_component_guides.js`

**Input:** `src/data/component-guides.json`, `src/data/sdk-symbols.json`
**Output:** `component-guides-audit.json`
**Cost:** 🆓 FREE

Checks package names, named imports, and symbol formats against the local SDK package
index. Page-level exports omitted by that index (`TradingPage`, `OrderBookWidget`,
`OrderBookAndTradesWidget`) are allowlisted explicitly.

## Cost Management

Each analysis costs NEAR AI API credits:

- **Docs analysis:** ~$1-3 first run, ~$0 incremental
- **Data generation:** ~$1-2 first run, ~$0 incremental
- **Total per complete run:** ~$2-5 first time; near $0 on subsequent runs with no source changes

**Tips to save money:**

1. Only re-run what's changed
2. Use `MAX_FILES_TO_PROCESS` in scripts for testing
3. Keep `docs_analysis.json` — don't delete it (contains the cache)
4. Only run `generate_mcp_data.js` when `docs_analysis.json` is updated
5. Use `FORCE=true` only when you explicitly want full regeneration

## File Structure

```
orderly-mcp/
├── .temp-docs/                       # Auto-cloned documentation-public repo
├── result.json                       # Telegram export input (provide manually)
├── telegram_chats_filtered/          # Output of clean_telegram_export.js
├── tg_analysis.json                  # Output of analyze_telegram_chats.js (optional)
├── docs_analysis.json                # Output of analyze_docs.js (required)
├── repo_analysis.json                # From analyze_example_repos.js (optional)
└── src/data/
    ├── documentation.json            # Generated
    ├── sdk-symbols.json              # Generated (generate_sdk_symbols.js)
    ├── workflows.json                # Generated
    ├── api.json                      # Generated
    └── component-guides.json         # Generated (analyze_sdk.js)
```

## Environment Setup

Create `.env` file:

```
NEAR_AI_API_KEY=your-near-ai-api-key-here
```

**Get your API key:** [NEAR AI Cloud Dashboard](https://cloud.near.ai/api-keys)

**Note:** Scripts also support legacy `OPENAI_API_KEY` for backwards compatibility.

## Troubleshooting

**"Input file not found: result.json"** (clean_telegram_export.js)
→ Place your Telegram Desktop export as `result.json` in project root, or set `INPUT=/path/to/export.json`

**"Missing telegram_chats_filtered/"** (analyze_telegram_chats.js)
→ Run: `node scripts/clean_telegram_export.js` first, then review + delete unwanted files

**"Missing docs_analysis.json"**
→ Run: `node scripts/analyze_docs.js`

**"Low quality output"**
→ Check input analysis files have content
→ Re-run analysis scripts if needed
