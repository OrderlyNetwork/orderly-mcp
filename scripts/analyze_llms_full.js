#!/usr/bin/env node

/**
 * analyze_llms_full.js
 *
 * This script processes the llms-full.txt from Orderly documentation
 * and generates clean Q&A pairs using NEAR AI Cloud API.
 *
 * Prerequisites:
 *   1. Node.js installed
 *   2. NEAR AI API key in .env file (NEAR_AI_API_KEY=your_key)
 *   3. llms-full.txt downloaded from https://orderly.network/docs/llms-full.txt
 *   4. npm install openai dotenv
 *
 * Usage:
 *   node scripts/analyze_llms_full.js
 *
 * The script reads llms-full.txt and creates docs_analysis.json with
 * clean, high-quality Q&A pairs derived from official documentation.
 */

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

dotenv.config();

const openai = new OpenAI({
  baseURL: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY,
});

const NEAR_AI_MODEL = 'zai-org/GLM-4.7';
const LLMS_FILE = path.join(projectRoot, 'llms-full.txt');
const OUTPUT_FILE = path.join(projectRoot, 'docs_analysis.json');
const MAX_CHARS_PER_CHUNK = 12000;

// Read llms-full.txt
function readLLMsFile() {
  if (!fs.existsSync(LLMS_FILE)) {
    console.error(`❌ Error: ${LLMS_FILE} not found`);
    console.error('   Download it from: https://orderly.network/docs/llms-full.txt');
    process.exit(1);
  }

  const content = fs.readFileSync(LLMS_FILE, 'utf-8');
  console.log(`📄 Read ${content.length} characters from llms-full.txt\n`);
  return content;
}

// Split into manageable chunks
function splitIntoChunks(text, maxChunkSize) {
  const chunks = [];
  let currentChunk = '';

  // Split by sections (headers)
  const sections = text.split(/\n(?=#+\s)/);

  for (const section of sections) {
    if ((currentChunk + section).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk += '\n' + section;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Analyze chunk with OpenAI
async function analyzeChunk(chunk, chunkIndex, totalChunks) {
  console.log(`\n🔍 Analyzing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} chars)...`);

  const systemPrompt = `You are an expert technical documentation analyst. Your task is to read the provided Orderly Network documentation and extract developer-focused questions and answers.

CRITICAL INSTRUCTIONS:
1. EXTRACT REAL Q&A: Identify questions developers would actually ask and provide complete, accurate answers from the documentation.
2. BE SPECIFIC: Include concrete details like endpoint URLs, function names, parameter names, code examples where available.
3. NO FLUFF: Avoid vague answers. Every answer should be actionable and technically precise.
4. COVERAGE: Extract Q&A about:
   - SDK usage (hooks, components, configuration)
   - API endpoints and authentication
   - Trading mechanics (orders, positions, margin, leverage)
   - Deposits/withdrawals
   - Broker setup
   - Technical integration details
5. FORMAT: Return ONLY valid JSON in this exact format:
   {
     "qa_pairs": [
       {
         "question": "How do I...?",
         "answer": "Complete technical answer with specifics...",
         "last_referenced_date": "2024-01-01T00:00:00"
       }
     ]
   }
6. QUALITY: Generate 5-15 high-quality Q&A pairs per chunk. Focus on the most important technical details.
7. NO META-REFERENCES: Don't use phrases like "The documentation states" or "According to the docs". Just provide the answer directly.
8. NO DATES IN ANSWERS: Don't include specific dates, timelines, or version numbers unless they're part of API specifications.

Think like a developer reading this documentation for the first time. What would they need to know?`;

  const userPrompt = `Extract developer Q&A from this Orderly Network documentation section:

--- DOCUMENTATION SECTION ---
${chunk}
--- END SECTION ---

Generate specific, technical Q&A pairs that would help developers integrate with Orderly Network. Return as JSON with "qa_pairs" array.`;

  try {
    const completion = await openai.chat.completions.create({
      model: NEAR_AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      console.error(`   ⚠️ Empty response for chunk ${chunkIndex + 1}`);
      return [];
    }

    const parsed = JSON.parse(response);
    const pairs = parsed.qa_pairs || [];

    console.log(`   ✅ Extracted ${pairs.length} Q&A pairs`);
    return pairs;
  } catch (error) {
    console.error(`   ❌ Error analyzing chunk ${chunkIndex + 1}:`, error.message);
    return [];
  }
}

// Main processing
async function main() {
  console.log('🚀 Starting llms-full.txt analysis...\n');

  // Read file
  const content = readLLMsFile();

  // Split into chunks
  const chunks = splitIntoChunks(content, MAX_CHARS_PER_CHUNK);
  console.log(`📦 Split into ${chunks.length} chunks for processing\n`);

  // Process each chunk
  let allQAPairs = [];

  for (let i = 0; i < chunks.length; i++) {
    const pairs = await analyzeChunk(chunks[i], i, chunks.length);
    allQAPairs = allQAPairs.concat(pairs);

    // Progress update
    if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
      console.log(
        `\n📊 Progress: ${i + 1}/${chunks.length} chunks, ${allQAPairs.length} total Q&A pairs`
      );
    }

    // Small delay to avoid rate limits
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Save results
  console.log(`\n💾 Saving ${allQAPairs.length} Q&A pairs to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQAPairs, null, 2));

  console.log('\n✅ Analysis complete!');
  console.log(`   Total Q&A pairs: ${allQAPairs.length}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  console.log('\nNext step: Run process_qa_analysis.js to merge into documentation');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
