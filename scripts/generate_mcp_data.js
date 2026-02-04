#!/usr/bin/env node

/**
 * generate_mcp_data.js
 *
 * This script processes tg_analysis.json and docs_analysis.json
 * using NEAR AI Cloud to generate comprehensive MCP server data files.
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
 *   - src/data/workflows.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

dotenv.config();

const openai = new OpenAI({
  baseURL: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY,
});

const NEAR_AI_MODEL = 'zai-org/GLM-4.7';
const BATCH_SIZE = 200; // Process 200 Q&A pairs per API call
const RATE_LIMIT_DELAY = 1000; // 1 second between calls

// Input files
const TG_ANALYSIS = path.join(projectRoot, 'tg_analysis.json');
const DOCS_ANALYSIS = path.join(projectRoot, 'docs_analysis.json');

// Output directory
const DATA_DIR = path.join(projectRoot, 'src', 'data');

console.log('🚀 MCP Data Generation Pipeline\n');
console.log('This script will generate comprehensive data files from analysis results.\n');

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

// Helper function to chunk array
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper function to delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Categorize Q&A pairs by topic
function categorizeQA(qaPairs) {
  const categories = {
    SDK: [],
    API: [],
    Trading: [],
    Authentication: [],
    Wallet: [],
    Orders: [],
    Positions: [],
    Deposits: [],
    Withdrawals: [],
    Subaccounts: [],
    Errors: [],
    Configuration: [],
    Other: [],
  };

  const keywords = {
    SDK: ['sdk', 'hook', 'component', 'react', 'install', 'npm', 'package'],
    API: ['api', 'endpoint', 'rest', 'websocket', 'ws', 'request', 'response'],
    Trading: ['trade', 'trading', 'market', 'limit', 'orderbook', 'price'],
    Authentication: ['auth', 'login', 'sign', 'signature', 'authenticate', 'key'],
    Wallet: ['wallet', 'connect', 'metamask', 'rainbow', 'walletconnect'],
    Orders: ['order', 'place order', 'cancel order', 'order status'],
    Positions: ['position', 'leverage', 'margin', 'liquidation', 'pnl'],
    Deposits: ['deposit', 'fund', 'add funds'],
    Withdrawals: ['withdraw', 'withdrawal', 'remove funds'],
    Subaccounts: ['subaccount', 'sub-account', 'delegate'],
    Errors: ['error', 'fail', 'bug', 'issue', 'problem', 'troubleshoot'],
    Configuration: ['config', 'setup', 'initialize', 'init', 'setting'],
  };

  for (const qa of qaPairs) {
    const text = (qa.question + ' ' + qa.answer).toLowerCase();
    let matched = false;

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some((word) => text.includes(word))) {
        categories[category].push(qa);
        matched = true;
        break;
      }
    }

    if (!matched) {
      categories['Other'].push(qa);
    }
  }

  return categories;
}

// Generate documentation from categorized Q&A
async function generateDocumentation() {
  console.log('📝 Generating documentation.json...');
  console.log('   Categorizing Q&A pairs...');

  const allQA = [...tgData, ...docsData];
  const categorized = categorizeQA(allQA);

  console.log('   Categories found:');
  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length > 0) {
      console.log(`     - ${cat}: ${items.length} entries`);
    }
  }

  const allChunks = [];
  let chunkId = 0;

  // Process each category
  for (const [category, qaPairs] of Object.entries(categorized)) {
    if (qaPairs.length === 0) continue;

    console.log(`\n   Processing ${category} (${qaPairs.length} entries)...`);

    // Chunk the Q&A pairs for this category
    const batches = chunkArray(qaPairs, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`     Batch ${i + 1}/${batches.length} (${batch.length} entries)`);

      const prompt = `Generate comprehensive documentation chunks for the "${category}" category based on these Q&A pairs from Orderly Network developers.

Q&A Pairs:
${JSON.stringify(batch, null, 2)}

Instructions:
1. Create 3-8 documentation chunks that cover the key topics in these Q&A pairs
2. Each chunk should be a complete, self-contained guide or explanation
3. Include practical code examples where relevant
4. Address common issues and solutions
5. Make content actionable for developers

Return a JSON object with a "chunks" array. Each chunk should have:
- id: unique kebab-case identifier (e.g., "${category.toLowerCase()}-overview-${i}-${chunkId}")
- title: descriptive title
- category: one of [Overview, SDK, API, Trading, Operations, Infrastructure, Security, Troubleshooting, FAQ]
- content: full markdown content with examples
- keywords: array of 5-8 search terms`;

      try {
        const completion = await openai.chat.completions.create({
          model: NEAR_AI_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert technical documentation writer. Generate comprehensive, practical documentation for Orderly Network developers. Return only valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
          console.warn(`     ⚠️ Empty response for ${category} batch ${i + 1}`);
          continue;
        }

        const parsedResponse = JSON.parse(responseContent);
        if (parsedResponse.chunks && Array.isArray(parsedResponse.chunks)) {
          for (const chunk of parsedResponse.chunks) {
            chunk.id = `${category.toLowerCase()}-${chunkId++}`;
            allChunks.push(chunk);
          }
          console.log(`     ✅ Generated ${parsedResponse.chunks.length} chunks`);
        }

        // Rate limiting
        if (i < batches.length - 1) {
          await delay(RATE_LIMIT_DELAY);
        }
      } catch (error) {
        console.error(`     ❌ Error processing ${category} batch ${i + 1}:`, error.message);
        if (error.message.includes('rate limit')) {
          console.log('     ⏳ Rate limited, waiting 20s...');
          await delay(20000);
          i--; // Retry this batch
        }
      }
    }
  }

  const output = {
    chunks: allChunks,
    metadata: {
      version: '3.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      totalChunks: allChunks.length,
      source: `Generated from ${tgData.length} Telegram + ${docsData.length} Docs Q&A entries`,
      categories: Object.entries(categorized)
        .filter(([_, items]) => items.length > 0)
        .map(([cat, items]) => ({ name: cat, count: items.length })),
    },
  };

  fs.writeFileSync(path.join(DATA_DIR, 'documentation.json'), JSON.stringify(output, null, 2));
  console.log(`\n   ✅ Generated ${allChunks.length} total documentation chunks\n`);
}

// Generate workflows from how-to questions
async function generateWorkflows() {
  console.log('🔄 Generating workflows.json...');

  // Find all how-to questions
  const howToQuestions = [...tgData, ...docsData].filter(
    (qa) =>
      qa.question.toLowerCase().includes('how do') ||
      qa.question.toLowerCase().includes('how to') ||
      qa.question.toLowerCase().includes('how can') ||
      qa.question.toLowerCase().includes('steps') ||
      qa.question.toLowerCase().includes('process') ||
      qa.question.toLowerCase().includes('guide') ||
      qa.question.toLowerCase().includes('tutorial')
  );

  console.log(`   Found ${howToQuestions.length} how-to questions`);

  const batches = chunkArray(howToQuestions, BATCH_SIZE);
  const allWorkflows = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`   Processing batch ${i + 1}/${batches.length} (${batch.length} questions)`);

    const prompt = `Create step-by-step workflows from these how-to questions about Orderly Network.

Questions and Answers:
${JSON.stringify(batch, null, 2)}

Instructions:
1. Extract 2-5 distinct workflows from these questions
2. Each workflow should have clear, actionable steps
3. Include code examples where relevant
4. Add common issues and troubleshooting tips
5. Group related workflows together

Return a JSON object with a "workflows" array. Each workflow should have:
- name: workflow name
- description: what it accomplishes
- prerequisites: array of what you need
- steps: array of objects with title, description, code (optional), important (optional)
- commonIssues: array of common problems and solutions
- relatedWorkflows: array of related workflow names`;

    try {
      const completion = await openai.chat.completions.create({
        model: NEAR_AI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at creating step-by-step technical workflows. Generate practical workflows for Orderly Network developers. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        console.warn(`   ⚠️ Empty response for batch ${i + 1}`);
        continue;
      }

      const parsedResponse = JSON.parse(responseContent);
      if (parsedResponse.workflows && Array.isArray(parsedResponse.workflows)) {
        allWorkflows.push(...parsedResponse.workflows);
        console.log(`   ✅ Generated ${parsedResponse.workflows.length} workflows`);
      }

      if (i < batches.length - 1) {
        await delay(RATE_LIMIT_DELAY);
      }
    } catch (error) {
      console.error(`   ❌ Error processing batch ${i + 1}:`, error.message);
      if (error.message.includes('rate limit')) {
        console.log('   ⏳ Rate limited, waiting 20s...');
        await delay(20000);
        i--; // Retry this batch
      }
    }
  }

  // Deduplicate workflows by name
  const seen = new Set();
  const uniqueWorkflows = allWorkflows.filter((wf) => {
    if (seen.has(wf.name)) return false;
    seen.add(wf.name);
    return true;
  });

  const output = {
    workflows: uniqueWorkflows,
    metadata: {
      totalWorkflows: uniqueWorkflows.length,
      generatedFrom: howToQuestions.length,
      lastUpdated: new Date().toISOString().split('T')[0],
    },
  };

  fs.writeFileSync(path.join(DATA_DIR, 'workflows.json'), JSON.stringify(output, null, 2));
  console.log(`   ✅ Generated ${uniqueWorkflows.length} unique workflows\n`);
}

// Main execution
async function main() {
  console.log('⏳ Starting generation (this will take several minutes)...\n');

  try {
    await generateDocumentation();
    await generateWorkflows();

    console.log('✅ All data files generated successfully!');
    console.log('\nGenerated files:');
    console.log('  - src/data/documentation.json');
    console.log('  - src/data/workflows.json');
    console.log('\nNext step: yarn build && yarn test:run');
  } catch (error) {
    console.error('\n❌ Error during generation:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
