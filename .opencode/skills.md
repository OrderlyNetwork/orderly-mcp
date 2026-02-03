# Skill: Update MCP Server Data

This skill guides you through updating the Orderly Network MCP server with new documentation, SDK patterns, contract addresses, or workflows.

## Overview

The MCP server stores data as JSON files in `src/data/`:

- `documentation.json` - Searchable documentation chunks
- `sdk-patterns.json` - SDK v2 hook examples
- `contracts.json` - Smart contract addresses
- `workflows.json` - Step-by-step guides
- `api.json` - API endpoints and WebSocket streams
- `component-guides.json` - Component building patterns

## When to Update Data

Update data when:

- Orderly releases new SDK features or hooks
- New chains are supported
- Documentation needs corrections
- API endpoints change
- New workflows need to be documented

## Quick Reference: Data File Locations

| Data Type     | File                             | Schema                                                                              | Test File                          |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| Documentation | `src/data/documentation.json`    | `chunks[] { id, title, content, category, keywords[] }`                             | `src/__tests__/searchDocs.test.ts` |
| SDK Patterns  | `src/data/sdk-patterns.json`     | `categories[] { name, patterns[] }`                                                 | Test via searchDocs                |
| Contracts     | `src/data/contracts.json`        | `{ chain: { chainId, contracts: { name: { mainnet?, testnet?, description? } } } }` | `src/__tests__/contracts.test.ts`  |
| Workflows     | `src/data/workflows.json`        | `workflows[] { name, description, steps[], prerequisites? }`                        | Manual verification                |
| API           | `src/data/api.json`              | `{ rest: { endpoints[] }, websocket: { streams[] }, auth: {} }`                     | Manual verification                |
| Components    | `src/data/component-guides.json` | `components[] { name, requiredPackages[], keyHooks[], variants[] }`                 | Manual verification                |

## Workflow: Adding New Data

### Step 1: Identify What to Update

**If adding SDK documentation:**

- Check if it fits existing category in `sdk-patterns.json`
- Determine if it's a new hook or an update to existing

**If adding contract addresses:**

- Verify chain is supported by Orderly
- Get addresses from official source (docs or GitHub)
- Note if mainnet, testnet, or both

**If adding documentation:**

- Choose appropriate category (Overview, SDK, Trading, API, etc.)
- Write searchable keywords
- Keep content concise but complete

### Step 2: Edit the JSON File

**Pattern for SDK hooks** (`sdk-patterns.json`):

```json
{
  "name": "useHookName",
  "description": "What this hook does",
  "installation": "npm install @orderly.network/hooks",
  "usage": "Brief usage explanation",
  "example": "import { useHookName } from '@orderly.network/hooks';\n\nfunction Component() {\n  const data = useHookName();\n  return <div>{data}</div>;\n}",
  "notes": ["Important note 1", "Important note 2"],
  "related": ["otherHook", "anotherHook"]
}
```

**Pattern for contracts** (`contracts.json`):

```json
"chainName": {
  "chainId": 42161,
  "testnetChainId": 421614,
  "contracts": {
    "CONTRACT_NAME": {
      "mainnet": "0x...",
      "testnet": "0x...",
      "description": "What this contract does"
    }
  }
}
```

**Pattern for documentation** (`documentation.json`):

```json
{
  "id": "unique-identifier",
  "title": "Descriptive Title",
  "category": "SDK | Overview | Trading | API | Chains | Risk | Account",
  "content": "Detailed content...",
  "keywords": ["search", "terms", "related"]
}
```

### Step 3: Validate JSON Syntax

Always validate after editing:

```bash
# Check JSON is valid
node -e "JSON.parse(require('fs').readFileSync('src/data/YOUR_FILE.json'))"

# Or use jq if available
jq '.' src/data/YOUR_FILE.json > /dev/null && echo "Valid JSON"
```

### Step 4: Add Tests (if needed)

For contract changes, add tests to `src/__tests__/contracts.test.ts`:

```typescript
it('should return new chain contracts', async () => {
  const result = await getContractAddresses('newchain', 'all', 'mainnet');
  expect(result.content[0].text).toContain('NewChain');
});
```

For documentation/SDK changes, tests are usually covered by existing search tests.

### Step 5: Test Your Changes

```bash
# Build the project
yarn build

# Run tests
yarn test:run

# If you added specific tests
yarn test src/__tests__/contracts.test.ts
```

### Step 6: Code Quality Checks

```bash
# Format code
yarn format

# Check types
yarn typecheck

# Run linter
yarn lint

# Run all tests
yarn test:run
```

## Common Patterns

### Adding a New SDK Hook

1. Open `src/data/sdk-patterns.json`
2. Find appropriate category (Account, Order Management, etc.)
3. Add pattern object to `patterns` array:
   - `name`: Exact hook name (e.g., "useNewHook")
   - `description`: One-line summary
   - `installation`: Package install command
   - `usage`: When to use it
   - `example`: Complete working example
   - `notes`: Gotchas or important details
   - `related`: Related hooks
4. Save and validate JSON
5. Test with `yarn build && yarn test:run`

### Adding a New Chain

1. Open `src/data/contracts.json`
2. Add chain key (lowercase, e.g., "scroll")
3. Add chain metadata:
   - `chainId`: Mainnet chain ID
   - `testnetChainId`: Testnet chain ID (if applicable)
   - `contracts`: Object with contract addresses
4. Add at minimum: Vault, VaultProxyAdmin, USDC
5. Add test in `src/__tests__/contracts.test.ts`
6. Run tests to verify

### Adding Documentation

1. Open `src/data/documentation.json`
2. Add new chunk to `chunks` array:
   - `id`: kebab-case-identifier
   - `title`: Clear, searchable title
   - `category`: One of existing categories
   - `content`: Detailed explanation (200-500 words)
   - `keywords`: 3-7 relevant search terms
3. Save and validate
4. Test search functionality

## Testing Commands

```bash
# Build TypeScript
yarn build

# Run all tests
yarn test:run

# Run specific test file
yarn test src/__tests__/contracts.test.ts

# Watch mode for development
yarn test

# Type checking
yarn typecheck

# Full quality check
yarn lint && yarn format:check && yarn typecheck && yarn test:run
```

## Validation Checklist

Before committing changes:

- [ ] JSON is valid (no syntax errors)
- [ ] `yarn build` succeeds
- [ ] `yarn test:run` passes
- [ ] `yarn typecheck` passes
- [ ] `yarn lint` passes
- [ ] Data follows existing schema patterns
- [ ] Examples are complete and copy-paste ready
- [ ] Contract addresses are verified from official source

## Troubleshooting

**JSON parse error:**

- Use `jq` or online JSON validator
- Check for trailing commas (not allowed in JSON)
- Verify quotes are straight, not curly

**TypeScript errors:**

- Run `yarn typecheck` to see specific errors
- Ensure imported JSON files use `with { type: "json" }`
- Check interface definitions match data structure

**Test failures:**

- Check test expectations match actual data
- Verify file paths in imports
- Ensure data files are in `src/data/`

## Data Quality Guidelines

**Documentation:**

- Write for developers who don't know Orderly
- Include concrete examples
- Keep paragraphs short and scannable
- Use keywords that match likely searches

**Code Examples:**

- Must be complete, runnable code
- Include all necessary imports
- Show realistic usage, not just syntax
- Include TypeScript types where helpful

**Contract Addresses:**

- Always verify from official source
- Include both mainnet and testnet when available
- Add description explaining contract purpose
- Use checksummed addresses
