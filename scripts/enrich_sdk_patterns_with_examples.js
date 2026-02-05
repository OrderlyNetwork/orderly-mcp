#!/usr/bin/env node

/**
 * enrich_sdk_patterns_with_examples.js
 *
 * This script merges the example-dex analysis into the SDK patterns data,
 * adding real-world code examples for charts, components, and DEX patterns.
 *
 * Usage:
 *   node scripts/enrich_sdk_patterns_with_examples.js
 *   USE_AI=true node scripts/enrich_sdk_patterns_with_examples.js  # AI-enhanced mode
 *
 * Prerequisites:
 *   - example_dex_analysis.json from analyze_example_dex.js
 *   - src/data/sdk-patterns.json exists
 *   - (AI mode) NEAR_AI_API_KEY in .env
 *
 * Output:
 *   - Updates src/data/sdk-patterns.json with example-dex patterns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

dotenv.config();

const EXAMPLE_DEX_ANALYSIS = path.join(projectRoot, 'example_dex_analysis.json');
const SDK_PATTERNS_FILE = path.join(projectRoot, 'src/data/sdk-patterns.json');

const USE_AI = process.env.USE_AI === 'true';

console.log('🚀 Enriching SDK patterns with example-dex code...\n');

if (USE_AI) {
  console.log('🤖 AI-Enhanced Mode Enabled\n');
  console.log('This will use AI to analyze code and generate comprehensive,');
  console.log('educational SDK patterns with intelligent analysis.\n');
}

// Check input files exist
if (!fs.existsSync(EXAMPLE_DEX_ANALYSIS)) {
  console.error(`❌ Missing: ${EXAMPLE_DEX_ANALYSIS}`);
  console.error('   Run: node scripts/analyze_example_dex.js');
  process.exit(1);
}

if (!fs.existsSync(SDK_PATTERNS_FILE)) {
  console.error(`❌ Missing: ${SDK_PATTERNS_FILE}`);
  console.error('   Run: node scripts/analyze_sdk.js first');
  process.exit(1);
}

// Check AI prerequisites if in AI mode
let openai = null;
let NEAR_AI_MODEL = null;

if (USE_AI) {
  if (!process.env.NEAR_AI_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing API key for AI mode');
    console.error('   Set NEAR_AI_API_KEY in .env file');
    process.exit(1);
  }

  const { default: OpenAI } = await import('openai');
  openai = new OpenAI({
    baseURL: 'https://cloud-api.near.ai/v1',
    apiKey: process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY,
  });
  NEAR_AI_MODEL = 'zai-org/GLM-4.7';
}

// Read input data
console.log('📖 Reading analysis files...');
const exampleDexData = JSON.parse(fs.readFileSync(EXAMPLE_DEX_ANALYSIS, 'utf-8'));
const sdkPatterns = JSON.parse(fs.readFileSync(SDK_PATTERNS_FILE, 'utf-8'));
console.log(`   Example DEX patterns: ${exampleDexData.patterns.length}`);
console.log(`   Current SDK categories: ${sdkPatterns.categories.length}\n`);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Find or create category
function findOrCreateCategory(categories, name) {
  let category = categories.find((c) => c.name === name);
  if (!category) {
    category = { name, patterns: [] };
    categories.push(category);
  }
  return category;
}

// AI prompt for analyzing a component
function createComponentAnalysisPrompt(component, category) {
  return `Analyze this React/TypeScript component from the Orderly Network example-dex repository and create a comprehensive SDK pattern.

Component: ${component.filename}
Category: ${category}
Description: ${component.description}

Source Code:
\`\`\`typescript
${component.content}
\`\`\`

Generate a comprehensive pattern object with the following structure:

{
  "name": "PascalCase component name without extension",
  "description": "Clear, concise description of what this component does and when to use it",
  "installation": "npm install packages needed (only Orderly packages, not React/etc)",
  "usage": "Detailed explanation of how to use this component, including:",
    - Required props and their types
    - Optional props and defaults
    - Context/providers needed
    - Integration steps",
  "example": "Complete, focused code example showing the key implementation patterns. Include:",
    - Imports
    - Component usage
    - Key logic (not boilerplate)
    - Comments explaining important parts",
  "notes": [
    "Implementation tips and best practices",
    "Common gotchas",
    "Performance considerations",
    "Accessibility notes",
    "TypeScript tips"
  ],
  "difficulty": "beginner|intermediate|advanced",
  "prerequisites": ["List of knowledge/components needed before using this"],
  "related": ["Related Orderly hooks or components"]
}

Guidelines:
1. Extract the ESSENTIAL patterns, not the full file
2. Focus on Orderly-specific integration
3. Include realistic prop examples
4. Add practical troubleshooting tips
5. Identify difficulty level honestly
6. List actual prerequisites for using this
7. Cross-reference related Orderly SDK features

Return ONLY valid JSON, no markdown formatting.`;
}

// AI prompt for analyzing implementation patterns
function createPatternAnalysisPrompt(pattern) {
  return `Analyze this implementation pattern from the Orderly Network example-dex repository.

Pattern: ${pattern.name}
Description: ${pattern.description}
Category: ${pattern.category}
Difficulty: ${pattern.difficulty}

Key Code:
\`\`\`typescript
${pattern.keyCode || '// No key code provided'}
\`\`\`

Steps:
${pattern.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'No steps provided'}

Generate an enhanced pattern object:

{
  "name": "PascalCase pattern name",
  "description": "Comprehensive description of what this pattern accomplishes",
  "installation": "npm install packages needed",
  "usage": "Detailed usage guide with:",
    - When to use this pattern
    - Prerequisites
    - Integration steps
    - Configuration options",
  "example": "Complete, production-ready code example with:",
    - Full implementation
    - Error handling
    - Best practices
    - Comments",
  "notes": [
    "Common issues and solutions",
    "Performance tips",
    "Security considerations",
    "Testing approaches",
    "Alternative approaches"
  ],
  "difficulty": "beginner|intermediate|advanced",
  "prerequisites": ["Required knowledge/components"],
  "related": ["Related patterns or hooks"]
}

Make this educational and practical. Return ONLY valid JSON.`;
}

// Process a single component with AI
async function processComponentWithAI(component, category) {
  const prompt = createComponentAnalysisPrompt(component, category);

  try {
    const completion = await openai.chat.completions.create({
      model: NEAR_AI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert React/TypeScript developer specializing in Orderly Network SDK. Analyze code and generate comprehensive, educational SDK patterns. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 12_000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Empty response from AI');
    }

    // Clean up markdown code blocks if present
    let jsonContent = responseContent.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    return JSON.parse(jsonContent);
  } catch (error) {
    console.error(`   ❌ AI processing failed for ${component.filename}:`, error.message);
    // Log the actual response for debugging
    console.error('   Response preview:', responseContent?.substring(0, 200));
    return null;
  }
}

// Process implementation pattern with AI
async function processPatternWithAI(pattern) {
  const prompt = createPatternAnalysisPrompt(pattern);

  try {
    const completion = await openai.chat.completions.create({
      model: NEAR_AI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert in Orderly Network SDK patterns. Create comprehensive implementation guides. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 12_000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Empty response from AI');
    }

    // Clean up markdown code blocks if present
    let jsonContent = responseContent.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    return JSON.parse(jsonContent);
  } catch (error) {
    console.error(`   ❌ AI processing failed for ${pattern.name}:`, error.message);
    // Log the actual response for debugging
    console.error('   Response preview:', responseContent?.substring(0, 200));
    return null;
  }
}

// Basic pattern creation (no AI)
function createPatternFromExample(patternData) {
  return {
    name: patternData.name.replace(/\s+/g, ''),
    description: patternData.description,
    installation: patternData.dependencies
      ? `npm install ${patternData.dependencies.join(' ')}`
      : undefined,
    usage: patternData.description,
    example: patternData.keyCode || `// See ${patternData.files?.join(', ') || 'example files'}`,
    notes: [
      `Difficulty: ${patternData.difficulty}`,
      `Category: ${patternData.category}`,
      `Source files: ${patternData.files?.join(', ')}`,
    ],
    related: patternData.dependencies?.filter((d) => d.includes('@orderly')) || [],
  };
}

// Basic component creation (no AI)
function createComponentPattern(component, categoryName) {
  const maxContentLength = 3000;
  let content = component.content;
  if (content.length > maxContentLength) {
    content =
      content.substring(0, maxContentLength) +
      '\n// ... (truncated, see full example in repository)';
  }

  return {
    name: component.filename.replace('.tsx', '').replace('.ts', ''),
    description: component.description,
    usage: `Complete ${categoryName.toLowerCase().replace(' components', '')} component implementation`,
    example: content,
    notes: [
      'Full working example from Orderly example-dex repository',
      `Source: https://github.com/orderlynetwork/example-dex/blob/master/app/components/${component.filename}`,
      'Copy and adapt for your own DEX implementation',
    ],
    related: ['@orderly.network/hooks', '@orderly.network/types'],
  };
}

// Main processing function
async function main() {
  let addedCount = 0;
  let errorCount = 0;
  const processedFiles = [];
  const RATE_LIMIT_DELAY = 500;

  // Process implementation patterns
  console.log('📋 Processing implementation patterns...\n');
  for (const pattern of exampleDexData.patterns || []) {
    console.log(`   Processing: ${pattern.name}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processPatternWithAI(pattern);
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createPatternFromExample(pattern);
    }

    if (enhancedPattern) {
      // Map category
      let categoryName;
      switch (pattern.category) {
        case 'charts':
          categoryName = 'Charts & Visualization';
          break;
        case 'trading':
          categoryName = 'Trading Interface';
          break;
        case 'positions':
          categoryName = 'Position Management';
          break;
        case 'wallet':
          categoryName = 'Wallet Connection';
          break;
        case 'orderManagement':
          categoryName = 'Order Management';
          break;
        default:
          categoryName = 'DEX Components';
      }

      const category = findOrCreateCategory(sdkPatterns.categories, categoryName);

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(pattern.name);
    } else {
      errorCount++;
    }
  }

  // Process chart components
  console.log('\n📊 Processing chart components...\n');
  const chartComponents = [
    ...(exampleDexData.charts?.lightweightCharts || []),
    ...(exampleDexData.charts?.tradingView || []),
  ];

  for (const component of chartComponents) {
    console.log(`   Processing: ${component.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(component, 'Chart Components');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createComponentPattern(component, 'Chart Components');
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'Chart Components');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(component.filename);
    } else {
      errorCount++;
    }
  }

  // Process WebSocket services
  console.log('\n📡 Processing WebSocket services...\n');
  for (const service of exampleDexData.charts?.websocketServices || []) {
    console.log(`   Processing: ${service.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(service, 'WebSocket Services');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = {
        name: service.filename.replace('.ts', ''),
        description: service.description,
        usage: 'Real-time WebSocket data subscription service',
        example: service.content,
        notes: [
          ...service.keyFeatures,
          `Supports resolutions: ${service.resolutions?.join(', ')}`,
          `Source: https://github.com/orderlynetwork/example-dex/blob/master/app/services/${service.filename}`,
        ],
        related: ['@orderly.network/net', '@orderly.network/hooks'],
      };
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'WebSocket Services');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(service.filename);
    } else {
      errorCount++;
    }
  }

  // Process trading components
  console.log('\n🔄 Processing trading components...\n');
  for (const component of exampleDexData.components?.trading || []) {
    console.log(`   Processing: ${component.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(component, 'Trading Components');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createComponentPattern(component, 'Trading Components');
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'Trading Components');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(component.filename);
    } else {
      errorCount++;
    }
  }

  // Process position components
  console.log('\n📈 Processing position components...\n');
  for (const component of exampleDexData.components?.positionManagement || []) {
    console.log(`   Processing: ${component.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(component, 'Position Components');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createComponentPattern(component, 'Position Components');
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'Position Components');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(component.filename);
    } else {
      errorCount++;
    }
  }

  // Process order components
  console.log('\n📋 Processing order components...\n');
  for (const component of exampleDexData.components?.orderManagement || []) {
    console.log(`   Processing: ${component.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(component, 'Order Components');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createComponentPattern(component, 'Order Components');
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'Order Components');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(component.filename);
    } else {
      errorCount++;
    }
  }

  // Process wallet components
  console.log('\n👛 Processing wallet components...\n');
  for (const component of exampleDexData.components?.wallet || []) {
    console.log(`   Processing: ${component.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(component, 'Wallet Components');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createComponentPattern(component, 'Wallet Components');
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'Wallet Components');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(component.filename);
    } else {
      errorCount++;
    }
  }

  // Process account components
  console.log('\n💰 Processing account components...\n');
  for (const component of exampleDexData.components?.account || []) {
    console.log(`   Processing: ${component.filename}`);

    let enhancedPattern;
    if (USE_AI) {
      enhancedPattern = await processComponentWithAI(component, 'Account Components');
      await delay(RATE_LIMIT_DELAY);
    } else {
      enhancedPattern = createComponentPattern(component, 'Account Components');
    }

    if (enhancedPattern) {
      const category = findOrCreateCategory(sdkPatterns.categories, 'Account Components');

      const existingIndex = category.patterns.findIndex(
        (p) => p.name.toLowerCase() === enhancedPattern.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        category.patterns[existingIndex] = enhancedPattern;
        console.log(`   📝 Updated: ${enhancedPattern.name}`);
      } else {
        category.patterns.push(enhancedPattern);
        console.log(`   ✅ Added: ${enhancedPattern.name}`);
      }

      addedCount++;
      processedFiles.push(component.filename);
    } else {
      errorCount++;
    }
  }

  // Update metadata
  sdkPatterns.metadata = sdkPatterns.metadata || {};
  sdkPatterns.metadata.enrichedWithExamples = {
    timestamp: new Date().toISOString(),
    source: 'https://github.com/orderlynetwork/example-dex',
    mode: USE_AI ? 'ai-enhanced' : 'basic',
    patternsAdded: addedCount,
    errors: errorCount,
    processedFiles,
  };

  if (USE_AI) {
    sdkPatterns.metadata.enrichedWithExamples.model = NEAR_AI_MODEL;
  }

  // Write updated SDK patterns
  fs.writeFileSync(SDK_PATTERNS_FILE, JSON.stringify(sdkPatterns, null, 2));

  console.log(`\n✅ Enrichment complete!`);
  console.log(`📄 Updated: ${SDK_PATTERNS_FILE}`);
  console.log(`\nSummary:`);
  console.log(`   - Mode: ${USE_AI ? 'AI-Enhanced' : 'Basic'}`);
  console.log(`   - Total categories: ${sdkPatterns.categories.length}`);
  console.log(`   - Patterns processed: ${addedCount}`);
  if (errorCount > 0) {
    console.log(`   - Errors: ${errorCount}`);
  }
  if (USE_AI) {
    console.log(`   - Model: ${NEAR_AI_MODEL}`);
  }
  console.log(`\nNext: yarn build && yarn test:run`);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
