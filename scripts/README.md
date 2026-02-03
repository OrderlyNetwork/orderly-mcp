# MCP Data Generation Scripts

## Overview

These scripts automate the generation of all MCP server data files using **NEAR AI Cloud** with structured output (Zod schemas).

**Model:** `zai-org/GLM-4.7` (via NEAR AI Cloud API)

## Workflow

### Step 1: Analyze Sources

**A. Process Telegram Chat Export**

```bash
# Split the export (run once)
node scripts/split_telegram_chats.js

# Analyze with NEAR AI
node scripts/analyze_chat_openai.js
# Output: tg_analysis.json (root level)
```

**B. Process Official Documentation**

```bash
# Download latest docs
curl -o llms-full.txt https://orderly.network/docs/llms-full.txt

# Analyze with NEAR AI
node scripts/analyze_llms_full.js
# Output: docs_analysis.json
```

### Step 2: Generate All Data Files

```bash
# This one command generates everything:
node scripts/generate_mcp_data.js
```

This creates:

- `src/data/documentation.json` - Searchable documentation
- `src/data/sdk-patterns.json` - SDK hook patterns
- `src/data/workflows.json` - Step-by-step workflows
- `src/data/api.json` - API endpoint docs
- `src/data/component-guides.json` - Component building guides

### Step 3: Build and Test

```bash
yarn build && yarn test:run
```

## Scripts Reference

### `analyze_chat_openai.js`

**Input:** `telegram_chat_exports/*.json` (from split_telegram_chats.js)  
**Output:** `tg_analysis.json` (root level)  
**Cost:** ~$0.50-1.00 per run (depends on chat size)

Processes Telegram group chats to extract Q&A pairs from real developer conversations.

### `analyze_llms_full.js`

**Input:** `llms-full.txt` (download from Orderly docs)  
**Output:** `docs_analysis.json`  
**Cost:** ~$1.00-2.00 per run (depends on doc size)

Processes official Orderly documentation to extract structured Q&A.

### `generate_mcp_data.js`

**Input:**

- `telegram_chat_exports/tg_analysis.json`
- `docs_analysis.json`

**Output:** All files in `src/data/` directory  
**Cost:** ~$2.00-4.00 per run (generates 5 complete data files)

Uses OpenAI with Zod schemas for structured output to generate production-ready data files.

### `split_telegram_chats.js`

**Input:** `result.json` (Telegram export)  
**Output:** `telegram_chat_exports/*.json` (individual chat files)

Splits large Telegram export into separate chat files with filtering.

## Cost Management

Each analysis costs NEAR AI API credits:

- **Telegram analysis:** ~$0.50-1.00
- **Docs analysis:** ~$1.00-2.00
- **Data generation:** ~$2.00-4.00
- **Total per complete run:** ~$3.50-7.00

\*\*Tips to save money:

1. Only re-run what's changed
2. Use `MAX_FILES_TO_PROCESS` in scripts for testing
3. Keep analysis files (tg_analysis.json, docs_analysis.json) - don't delete them
4. Only run `generate_mcp_data.js` when analysis files are updated

## File Structure

```
orderly-mcp/
├── llms-full.txt                    # Downloaded docs
├── telegram_chat_exports/
│   ├── chat_Orderly_SDK.json
│   └── chat_Orderly_Support.json
├── tg_analysis.json                  # Generated (root level)
├── docs_analysis.json                # Generated (root level)
├── qa_analysis.json                  # ⚠️ DEPRECATED - do not use
└── src/data/
    ├── documentation.json            # Generated
    ├── sdk-patterns.json             # Generated
    ├── workflows.json                # Generated
    ├── api.json                      # Generated
    └── component-guides.json         # Generated
```

## Environment Setup

Create `.env` file:

```
NEAR_AI_API_KEY=your-near-ai-api-key-here
```

**Get your API key:** [NEAR AI Cloud Dashboard](https://cloud.near.ai/api-keys)

**Note:** Scripts also support legacy `OPENAI_API_KEY` for backwards compatibility.

## Troubleshooting

**"Missing tg_analysis.json"**
→ Run: `node scripts/analyze_chat_openai.js`

**"Missing docs_analysis.json"**
→ Run: `node scripts/analyze_llms_full.js`

**"Low quality output"**
→ Check input analysis files have content
→ Re-run analysis scripts if needed

**"Want to start over"**
→ Run: `node scripts/reset_documentation.js`
