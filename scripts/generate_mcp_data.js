#!/usr/bin/env node

/**
 * generate_mcp_data.js
 *
 * This script processes tg_analysis.json and docs_analysis.json
 * using NEAR AI Cloud with structured output (Zod schemas) to generate
 * all MCP server data files.
 *
 * Prerequisites:
 *   1. Node.js installed
 *   2. NEAR AI API key in .env file
 *   3. tg_analysis.json from Telegram analysis
 *   4. docs_analysis.json from llms-full.txt analysis
 *
 * Usage:
 *   node scripts/generate_mcp_data.js
 *
 * This generates:
 *   - src/data/documentation.json
 *   - src/data/sdk-patterns.json
 *   - src/data/workflows.json
 *   - src/data/api.json
 *   - src/data/component-guides.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

dotenv.config();

const openai = new OpenAI({
  baseURL: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY,
});

const NEAR_AI_MODEL = 'zai-org/GLM-4.7';

// Input files
const TG_ANALYSIS = path.join(projectRoot, 'tg_analysis.json');
const DOCS_ANALYSIS = path.join(projectRoot, 'docs_analysis.json');

// Output directory
const DATA_DIR = path.join(projectRoot, 'src', 'data');

console.log('🚀 MCP Data Generation Pipeline\n');
console.log('This script will generate all data files from analysis results.\n');

// Check input files exist
if (!fs.existsSync(TG_ANALYSIS)) {
  console.error(`❌ Missing: ${TG_ANALYSIS}`);
  console.error('   Run: node scripts/analyze_chat_openai.js');
  process.exit(1);
}

if (!fs.existsSync(DOCS_ANALYSIS)) {
  console.error(`❌ Missing: ${DOCS_ANALYSIS}`);
  console.error('   Run: node scripts/analyze_llms_full.js');
  process.exit(1);
}

// Read input data
console.log('📖 Reading analysis files...');
const tgData = JSON.parse(fs.readFileSync(TG_ANALYSIS, 'utf-8'));
const docsData = JSON.parse(fs.readFileSync(DOCS_ANALYSIS, 'utf-8'));
console.log(`   Telegram Q&A: ${tgData.length} entries`);
console.log(`   Docs Q&A: ${docsData.length} entries\n`);

// Zod schemas for structured output
const DocChunkSchema = z.object({
  id: z.string().describe('Unique kebab-case identifier'),
  title: z.string().describe('Short descriptive title'),
  category: z
    .enum([
      'Overview',
      'SDK',
      'API',
      'Trading',
      'Operations',
      'Infrastructure',
      'Security',
      'Troubleshooting',
      'FAQ',
    ])
    .describe('Content category'),
  content: z.string().describe('Full content in markdown format'),
  keywords: z.array(z.string()).describe('Search keywords (5-8 terms)'),
});

const SdkPatternSchema = z.object({
  name: z.string().describe('Hook or function name'),
  category: z.string().describe('Category like Account, Orders, Positions, Market Data'),
  description: z.string().describe('What this pattern does'),
  installation: z.string().optional().describe('npm install command if needed'),
  usage: z.string().describe('How to use it'),
  example: z.string().describe('Complete working code example'),
  notes: z.array(z.string()).optional().describe('Important notes or gotchas'),
  related: z.array(z.string()).optional().describe('Related hooks or patterns'),
});

const WorkflowSchema = z.object({
  name: z.string().describe('Workflow name'),
  description: z.string().describe('What this workflow accomplishes'),
  prerequisites: z.array(z.string()).optional().describe('What you need before starting'),
  steps: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      code: z.string().optional(),
      important: z.array(z.string()).optional(),
    })
  ),
  commonIssues: z.array(z.string()).optional(),
  relatedWorkflows: z.array(z.string()).optional(),
});

const ApiEndpointSchema = z.object({
  path: z.string(),
  method: z.string(),
  description: z.string(),
  auth: z.boolean(),
  rateLimit: z.string().optional(),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean(),
        description: z.string(),
      })
    )
    .optional(),
  response: z.string().optional(),
  example: z.string().optional(),
});

const ApiInfoSchema = z.object({
  rest: z.object({
    baseUrl: z.object({ mainnet: z.string(), testnet: z.string() }),
    authentication: z.object({ type: z.string(), description: z.string() }),
    endpoints: z.array(ApiEndpointSchema),
  }),
  websocket: z.object({
    baseUrl: z.object({ mainnet: z.string(), testnet: z.string() }),
    streams: z.array(
      z.object({
        name: z.string(),
        topic: z.string(),
        description: z.string(),
        auth: z.boolean(),
        parameters: z.array(z.string()).optional(),
        example: z.string().optional(),
      })
    ),
  }),
  auth: z.object({
    description: z.string(),
    steps: z.array(z.string()),
    example: z.string(),
  }),
});

const ComponentGuideSchema = z.object({
  name: z.string(),
  description: z.string(),
  requiredPackages: z.array(z.string()),
  keyHooks: z.array(z.string()),
  variants: z.array(
    z.object({
      complexity: z.enum(['minimal', 'standard', 'advanced']),
      description: z.string(),
      code: z.string(),
      additionalImports: z.array(z.string()).optional(),
      tips: z.array(z.string()).optional(),
    })
  ),
  stylingNotes: z.string().optional(),
  commonMistakes: z.array(z.string()).optional(),
  relatedComponents: z.array(z.string()).optional(),
});

// Generation functions
async function generateDocumentation() {
  console.log('📝 Generating documentation.json...');

  const prompt = `Generate comprehensive documentation chunks for Orderly Network based on these Q&A pairs.

Telegram Q&A (real developer questions):
${JSON.stringify(tgData.slice(0, 50), null, 2)}

Documentation Q&A (official docs):
${JSON.stringify(docsData.slice(0, 50), null, 2)}

Create documentation chunks covering:
1. Architecture and overview
2. SDK usage and hooks
3. API authentication and endpoints
4. Trading mechanics (orders, positions, margin)
5. Common developer issues and solutions
6. Step-by-step guides

Focus on practical, actionable content that developers need. Include code examples where relevant.`;

  const completion = await openai.beta.chat.completions.parse({
    model: NEAR_AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert technical documentation writer. Generate clean, well-structured documentation chunks for the Orderly Network MCP server. Focus on developer needs and practical implementation details.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(
      z.object({ chunks: z.array(DocChunkSchema) }),
      'documentation'
    ),
    temperature: 0.3,
  });

  const chunks = completion.choices[0].message.parsed.chunks;

  const output = {
    chunks,
    metadata: {
      version: '3.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      totalChunks: chunks.length,
      source: 'Generated from Telegram + Docs analysis',
    },
  };

  fs.writeFileSync(path.join(DATA_DIR, 'documentation.json'), JSON.stringify(output, null, 2));
  console.log(`   ✅ Generated ${chunks.length} documentation chunks\n`);
}

async function generateSdkPatterns() {
  console.log('📚 Generating sdk-patterns.json...');

  const prompt = `Extract SDK hook patterns and usage examples from these Q&A pairs.

Data:
${JSON.stringify(
  [...tgData, ...docsData]
    .filter(
      (qa) =>
        qa.question.toLowerCase().includes('hook') ||
        qa.question.toLowerCase().includes('sdk') ||
        qa.answer.toLowerCase().includes('useorder') ||
        qa.answer.toLowerCase().includes('useposition')
    )
    .slice(0, 30),
  null,
  2
)}

Generate SDK patterns for:
- useAccount, useOrderEntry, usePositionStream
- useOrderbookStream, useMarkPrice, useCollateral
- Wallet connection patterns
- Order placement patterns
- Data fetching patterns`;

  const completion = await openai.beta.chat.completions.parse({
    model: NEAR_AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Generate SDK hook patterns with complete working code examples for Orderly Network v2 SDK.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(
      z.object({
        categories: z.array(
          z.object({
            name: z.string(),
            patterns: z.array(SdkPatternSchema),
          })
        ),
      }),
      'sdk_patterns'
    ),
    temperature: 0.2,
  });

  const patterns = completion.choices[0].message.parsed;

  fs.writeFileSync(path.join(DATA_DIR, 'sdk-patterns.json'), JSON.stringify(patterns, null, 2));
  console.log(`   ✅ Generated SDK patterns\n`);
}

async function generateWorkflows() {
  console.log('🔄 Generating workflows.json...');

  const prompt = `Create step-by-step workflows from these Q&A pairs.

Data:
${JSON.stringify(
  [...tgData, ...docsData]
    .filter(
      (qa) =>
        qa.question.toLowerCase().includes('how do') ||
        qa.question.toLowerCase().includes('how to') ||
        qa.question.toLowerCase().includes('steps') ||
        qa.question.toLowerCase().includes('process')
    )
    .slice(0, 30),
  null,
  2
)}

Generate workflows for:
1. Wallet connection
2. First order placement
3. Deposit and withdrawal
4. Setting TP/SL
5. Subaccount management
6. Troubleshooting common issues`;

  const completion = await openai.beta.chat.completions.parse({
    model: NEAR_AI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Generate practical step-by-step workflows for common Orderly development tasks.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(
      z.object({ workflows: z.array(WorkflowSchema) }),
      'workflows'
    ),
    temperature: 0.2,
  });

  const workflows = completion.choices[0].message.parsed;

  fs.writeFileSync(path.join(DATA_DIR, 'workflows.json'), JSON.stringify(workflows, null, 2));
  console.log(`   ✅ Generated ${workflows.workflows.length} workflows\n`);
}

async function generateApiInfo() {
  console.log('🔌 Generating api.json...');

  const prompt = `Extract API endpoint documentation from these Q&A pairs.

Data:
${JSON.stringify(
  [...tgData, ...docsData]
    .filter(
      (qa) =>
        qa.question.toLowerCase().includes('api') ||
        qa.question.toLowerCase().includes('endpoint') ||
        qa.question.toLowerCase().includes('/v1/') ||
        qa.answer.includes('https://api.orderly')
    )
    .slice(0, 30),
  null,
  2
)}

Document:
1. Authentication process
2. REST API endpoints (private and public)
3. WebSocket streams
4. Rate limits
5. Error codes`;

  const completion = await openai.beta.chat.completions.parse({
    model: NEAR_AI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Generate comprehensive API documentation for Orderly REST and WebSocket APIs.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(ApiInfoSchema, 'api_info'),
    temperature: 0.2,
  });

  const apiInfo = completion.choices[0].message.parsed;

  fs.writeFileSync(path.join(DATA_DIR, 'api.json'), JSON.stringify(apiInfo, null, 2));
  console.log(`   ✅ Generated API documentation\n`);
}

async function generateComponentGuides() {
  console.log('🧩 Generating component-guides.json...');

  const prompt = `Create React component building guides from these Q&A pairs.

Data:
${JSON.stringify(
  [...tgData, ...docsData]
    .filter(
      (qa) =>
        qa.question.toLowerCase().includes('component') ||
        qa.question.toLowerCase().includes('build') ||
        qa.question.toLowerCase().includes('react') ||
        qa.question.toLowerCase().includes('ui')
    )
    .slice(0, 30),
  null,
  2
)}

Create guides for:
1. Order entry form
2. Orderbook display
3. Positions table
4. Wallet connector
5. Trading panel`;

  const completion = await openai.beta.chat.completions.parse({
    model: NEAR_AI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Generate component building guides with complete code examples for trading UI components.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(
      z.object({ components: z.array(ComponentGuideSchema) }),
      'component_guides'
    ),
    temperature: 0.2,
  });

  const guides = completion.choices[0].message.parsed;

  fs.writeFileSync(path.join(DATA_DIR, 'component-guides.json'), JSON.stringify(guides, null, 2));
  console.log(`   ✅ Generated ${guides.components.length} component guides\n`);
}

// Main execution
async function main() {
  console.log('⏳ Starting generation (this may take a few minutes)...\n');

  try {
    await generateDocumentation();
    await generateSdkPatterns();
    await generateWorkflows();
    await generateApiInfo();
    await generateComponentGuides();

    console.log('✅ All data files generated successfully!');
    console.log('\nGenerated files:');
    console.log('  - src/data/documentation.json');
    console.log('  - src/data/sdk-patterns.json');
    console.log('  - src/data/workflows.json');
    console.log('  - src/data/api.json');
    console.log('  - src/data/component-guides.json');
    console.log('\nNext step: yarn build && yarn test:run');
  } catch (error) {
    console.error('\n❌ Error during generation:', error.message);
    process.exit(1);
  }
}

main();
