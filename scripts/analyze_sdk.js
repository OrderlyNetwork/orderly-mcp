#!/usr/bin/env node

/**
 * analyze_sdk.js - Extract rich context from Orderly SDK and use AI to generate clean examples
 *
 * Sources:
 * 1. Storybook files (real component usage examples)
 * 2. Internal SDK usage (how components are actually used in the SDK itself)
 * 3. Hook source code (return values)
 *
 * Then sends all context to AI for generating clean, practical examples
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Config
const USE_AI = process.env.USE_AI === 'true';
const SDK_REPO = 'https://github.com/OrderlyNetwork/js-sdk.git';
const TEMP_DIR = path.join(projectRoot, '.temp-sdk');
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'sdk-patterns.json');

console.log('🔍 Orderly SDK Pattern Extractor\n');
console.log(`Mode: ${USE_AI ? 'AI Enrichment (PAID ~$5-15)' : 'Source Extraction (FREE)'}`);
console.log(`⚠️  Set USE_AI=true to enable AI enrichment\n`);

if (USE_AI && !process.env.NEAR_AI_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error('❌ Error: USE_AI=true but no API key found');
  process.exit(1);
}

const client = USE_AI
  ? new OpenAI({
      baseURL: 'https://cloud-api.near.ai/v1',
      apiKey: process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY,
    })
  : null;

const MODEL = 'zai-org/GLM-4.7';

// ==================== PASS 1: EXTRACT HOOKS ====================

console.log('📦 Cloning SDK repository...');
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

try {
  execSync(`git clone --depth 1 ${SDK_REPO} ${TEMP_DIR}`, {
    stdio: 'pipe',
    timeout: 120000,
  });
  console.log('   ✅ SDK cloned\n');
} catch (e) {
  console.error('❌ Failed to clone:', e.message);
  process.exit(1);
}

console.log('🔍 Phase 1: Extracting hooks from source...');

const hooksDir = path.join(TEMP_DIR, 'packages', 'hooks', 'src');
const hookFiles = [];

function findTsFiles(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findTsFiles(fullPath);
    } else if (
      item.name.endsWith('.ts') &&
      !item.name.includes('.test.') &&
      !item.name.includes('.d.ts')
    ) {
      hookFiles.push(fullPath);
    }
  }
}

if (fs.existsSync(hooksDir)) {
  findTsFiles(hooksDir);
}

console.log(`   📁 Found ${hookFiles.length} hook files`);

const rawHooks = [];
const processedHooks = new Set();

for (const file of hookFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(TEMP_DIR, file);

    // Find hook definitions
    const functionMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(use\w+)\s*\(/g);
    const constMatches = content.matchAll(
      /export\s+const\s+(use\w+)\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>|\(\s*\)\s*=>)/g
    );

    const allMatches = [...functionMatches, ...constMatches];

    for (const match of allMatches) {
      const hookName = match[1];
      if (processedHooks.has(hookName)) continue;
      processedHooks.add(hookName);

      // Extract JSDoc
      const jsdocMatch = content.match(
        new RegExp(
          `/\\*\\*([\\s\\S]*?)\\*/[\\s\\S]*?export\s+(?:async\s+)?(?:function|const)\s+${hookName}`
        )
      );
      const description = jsdocMatch
        ? jsdocMatch[1]
            .replace(/\s*\*\s?/g, ' ')
            .trim()
            .substring(0, 500)
        : '';

      const returnInfo = extractReturnInfo(content, hookName);

      rawHooks.push({
        name: hookName,
        description,
        category: inferCategory(hookName, relativePath),
        sourceFile: relativePath,
        returnInfo,
      });
    }
  } catch (e) {}
}

console.log(`   🎣 Extracted ${rawHooks.length} hooks\n`);

// ==================== PASS 2: EXTRACT STORYBOOK EXAMPLES ====================

console.log('📖 Phase 2: Extracting storybook examples...');
const storybookDir = path.join(TEMP_DIR, 'apps', 'storybook', 'src', 'stories');
const storybookExamples = {};

if (fs.existsSync(storybookDir)) {
  const storyFiles = [];

  const findStories = (dir) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        findStories(fullPath);
      } else if (item.name.endsWith('.stories.tsx') || item.name.endsWith('.stories.ts')) {
        storyFiles.push(fullPath);
      }
    }
  };

  findStories(storybookDir);
  console.log(`   📚 Found ${storyFiles.length} storybook files`);

  for (const storyFile of storyFiles) {
    try {
      const content = fs.readFileSync(storyFile, 'utf-8');
      const examples = extractStorybookExamples(content);

      for (const [componentName, data] of Object.entries(examples)) {
        if (!storybookExamples[componentName]) {
          storybookExamples[componentName] = [];
        }
        storybookExamples[componentName].push(data);
      }
    } catch (e) {}
  }

  console.log(`   ✅ Extracted examples for ${Object.keys(storybookExamples).length} components\n`);
} else {
  console.log('   ⚠️  Storybook directory not found\n');
}

// ==================== PASS 3: EXTRACT INTERNAL SDK USAGE ====================

console.log('🔍 Phase 3: Extracting internal SDK usage...');
const internalUsages = {};

// Scan packages for component usage
const packagesDir = path.join(TEMP_DIR, 'packages');
const packageDirs = fs
  .readdirSync(packagesDir)
  .filter((p) => p.startsWith('ui') || p === 'app' || p === 'trading');

for (const pkg of packageDirs) {
  const pkgSrc = path.join(packagesDir, pkg, 'src');
  if (!fs.existsSync(pkgSrc)) continue;

  const findUsages = (dir) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        findUsages(fullPath);
      } else if (item.name.endsWith('.tsx')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const usages = extractComponentUsages(content);

          for (const [componentName, usageData] of Object.entries(usages)) {
            if (!internalUsages[componentName]) {
              internalUsages[componentName] = [];
            }
            internalUsages[componentName].push({
              ...usageData,
              sourceFile: path.relative(TEMP_DIR, fullPath),
            });
          }
        } catch (e) {}
      }
    }
  };

  findUsages(pkgSrc);
}

console.log(`   ✅ Found internal usage for ${Object.keys(internalUsages).length} components\n`);

// ==================== PASS 4: EXTRACT COMPONENTS ====================

console.log('🧩 Phase 4: Scanning UI packages...');
const uiDir = path.join(TEMP_DIR, 'packages');
const rawComponents = [];

const uiPackages = fs.readdirSync(uiDir).filter((p) => p.startsWith('ui'));

for (const pkg of uiPackages) {
  const pkgSrc = path.join(uiDir, pkg, 'src');
  if (!fs.existsSync(pkgSrc)) continue;

  const findComponents = (dir) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        findComponents(fullPath);
      } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');

          // Find exported components
          const matches = content.matchAll(
            /export\s+(?:const|function)\s+(\w+)(?:\s*:\s*React\.FC)?\s*[<(]/g
          );

          for (const match of matches) {
            const componentName = match[1];
            if (
              !componentName.startsWith('use') &&
              componentName[0] === componentName[0].toUpperCase()
            ) {
              const stories = storybookExamples[componentName] || [];
              const internal = internalUsages[componentName] || [];

              rawComponents.push({
                name: componentName,
                package: `@orderly.network/${pkg}`,
                file: path.relative(TEMP_DIR, fullPath),
                hasExamples: stories.length > 0 || internal.length > 0,
                stories,
                internalUsages: internal,
              });
            }
          }
        } catch (e) {}
      }
    }
  };

  findComponents(pkgSrc);
}

const componentsWithContext = rawComponents.filter((c) => c.hasExamples).length;
console.log(
  `   ✅ Found ${rawComponents.length} components (${componentsWithContext} with context)\n`
);

// ==================== PASS 5: AI ENRICHMENT (Optional) ====================

let enrichedHooks = [];
let enrichedComponents = [];

if (USE_AI) {
  console.log('🤖 Phase 5: AI Enrichment\n');
  console.log('⚠️  This will cost money. Estimated: ~$10-15\n');
  console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
  await new Promise((r) => setTimeout(r, 3000));

  // Enrich hooks
  console.log(`📝 Enriching ${rawHooks.length} hooks...`);
  enrichedHooks = await enrichHooksWithAI(rawHooks);
  console.log(`   ✅ Enriched ${enrichedHooks.length} hooks\n`);

  // Enrich components
  console.log(`🧩 Enriching ${rawComponents.length} components...`);
  enrichedComponents = await enrichComponentsWithAI(rawComponents);
  console.log(`   ✅ Enriched ${enrichedComponents.length} components\n`);
} else {
  console.log('📄 Skipping AI enrichment (USE_AI not set)\n');
  enrichedHooks = rawHooks.map((h) => ({
    ...h,
    example: generateHookExample(h),
  }));
  enrichedComponents = rawComponents.map((c) => ({
    ...c,
    example: generateComponentExample(c),
  }));
}

// ==================== GENERATE OUTPUT ====================

console.log('💾 Saving sdk-patterns.json...');

// Build hook categories
const categoryMap = {};
for (const hook of enrichedHooks) {
  const catName = hook.category || 'General';
  if (!categoryMap[catName]) {
    categoryMap[catName] = [];
  }

  categoryMap[catName].push({
    name: hook.name,
    description: hook.description || `Hook for ${hook.name}`,
    installation: 'npm install @orderly.network/hooks',
    usage:
      hook.aiExample?.description ||
      hook.returnInfo?.description ||
      `Provides ${hook.description || 'SDK functionality'}`,
    example: hook.aiExample?.code || hook.example,
    notes: hook.aiExample?.notes || hook.returnInfo?.notes || [],
    related: hook.aiExample?.related || findRelatedHooks(hook.name, enrichedHooks),
  });
}

const categories = Object.entries(categoryMap).map(([name, patterns]) => ({
  name,
  patterns,
}));

// Add component category
if (enrichedComponents.length > 0) {
  categories.push({
    name: 'UI Components',
    patterns: enrichedComponents.map((c) => ({
      name: c.name,
      description: c.aiExample?.description || `UI component from ${c.package}`,
      installation: `npm install ${c.package}`,
      usage: c.aiExample?.usage || `Import and use ${c.name} in your React components`,
      example: c.aiExample?.code || c.example,
      notes: c.aiExample?.notes || [],
      related: c.aiExample?.related || [],
    })),
  });
}

const output = {
  version: '3.0.0',
  generatedAt: new Date().toISOString(),
  mode: USE_AI ? 'ai-enriched' : 'source-extracted',
  stats: {
    totalHooks: enrichedHooks.length,
    totalComponents: enrichedComponents.length,
    componentsWithContext,
    totalCategories: categories.length,
  },
  categories,
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

console.log(`   ✅ Saved to ${OUTPUT_FILE}\n`);
console.log(`   📊 Summary:`);
console.log(`      - ${enrichedHooks.length} hooks`);
console.log(`      - ${enrichedComponents.length} components`);
console.log(`      - ${categories.length} categories\n`);

// Cleanup
console.log('🧹 Cleaning up...');
try {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('   ✅ Done\n');
} catch (e) {}

console.log('✨ Complete!');

// ==================== AI ENRICHMENT FUNCTIONS ====================

async function enrichHooksWithAI(hooks) {
  const enriched = [];
  const batchSize = 10;

  for (let i = 0; i < hooks.length; i += batchSize) {
    const batch = hooks.slice(i, i + batchSize);
    const endIdx = Math.min(i + batchSize, hooks.length);

    console.log(`   Processing hooks ${i + 1}-${endIdx} of ${hooks.length}...`);

    const prompt = `Generate clean, practical code examples for these Orderly SDK hooks.

Context for each hook:
${batch
  .map(
    (h) => `
Hook: ${h.name}
Description: ${h.description || 'N/A'}
Returns: ${h.returnInfo?.properties?.join(', ') || 'unknown'}
Source: ${h.sourceFile}
`
  )
  .join('\n')}

For each hook, generate:
1. A clear, practical description
2. Complete working code example (import, usage, comments)
3. List of 3 key points developers should know
4. 2-3 related hooks that work well together

Return JSON:
{
  "hooks": [
    {
      "name": "hookName",
      "aiExample": {
        "code": "import...",
        "description": "...",
        "notes": ["..."],
        "related": ["..."]
      }
    }
  ]
}`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Expert Orderly SDK developer. Generate practical, clean code examples that work in real applications.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const results = parsed.hooks || [];

        // Merge AI examples with original data
        for (const hook of batch) {
          const aiResult = results.find((r) => r.name === hook.name);
          enriched.push({
            ...hook,
            aiExample: aiResult?.aiExample || null,
          });
        }
        console.log(`      ✅ Got ${results.length} AI examples`);
      }
    } catch (error) {
      console.error(`      ❌ Error: ${error.message}`);
      // Add originals without AI
      enriched.push(...batch.map((h) => ({ ...h, aiExample: null })));
    }

    if (i + batchSize < hooks.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return enriched;
}

async function enrichComponentsWithAI(components) {
  const enriched = [];
  const batchSize = 8;

  for (let i = 0; i < components.length; i += batchSize) {
    const batch = components.slice(i, i + batchSize);
    const endIdx = Math.min(i + batchSize, components.length);

    console.log(`   Processing components ${i + 1}-${endIdx} of ${components.length}...`);

    const prompt = `Generate clean, practical code examples for these Orderly UI components.

Context from SDK:
${batch
  .map(
    (c) => `
Component: ${c.name}
Package: ${c.package}
File: ${c.file}
Storybook examples: ${c.stories?.length || 0}
${
  c.stories?.length
    ? 'Storybook usage:\n' +
      c.stories
        .slice(0, 2)
        .map((s) => `- ${s.codeSnippet?.substring(0, 200)}...`)
        .join('\n')
    : ''
}
Internal usages: ${c.internalUsages?.length || 0}
${
  c.internalUsages?.length
    ? 'Internal usage:\n' +
      c.internalUsages
        .slice(0, 2)
        .map((u) => `- ${u.codeSnippet?.substring(0, 200)}...`)
        .join('\n')
    : ''
}
`
  )
  .join('\n---\n')}

For each component, generate:
1. Clear description of what the component does
2. Installation command
3. Complete working code example (imports, props, usage)
4. Common props with examples
5. 2-3 related components or hooks

Return JSON:
{
  "components": [
    {
      "name": "ComponentName",
      "aiExample": {
        "code": "import...",
        "description": "...",
        "usage": "...",
        "notes": ["..."],
        "related": ["..."]
      }
    }
  ]
}`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Expert Orderly UI developer. Generate clean, practical component examples based on real SDK usage patterns.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const results = parsed.components || [];

        for (const comp of batch) {
          const aiResult = results.find((r) => r.name === comp.name);
          enriched.push({
            ...comp,
            aiExample: aiResult?.aiExample || null,
          });
        }
        console.log(`      ✅ Got ${results.length} AI examples`);
      }
    } catch (error) {
      console.error(`      ❌ Error: ${error.message}`);
      enriched.push(...batch.map((c) => ({ ...c, aiExample: null })));
    }

    if (i + batchSize < components.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return enriched;
}

// ==================== EXTRACTION HELPER FUNCTIONS ====================

function extractStorybookExamples(content) {
  const examples = {};

  // Extract imports
  const importMatches = content.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g);
  const imports = {};
  for (const match of importMatches) {
    const items = match[1].split(',').map((s) => s.trim());
    const source = match[2];
    for (const item of items) {
      imports[item] = source;
    }
  }

  // Find render functions with JSX
  const renderMatches = content.matchAll(/render\s*[:\(][^{]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs);

  for (const match of renderMatches) {
    const renderBody = match[1];

    // Find component JSX
    const jsxMatches = renderBody.matchAll(/<([A-Z][A-Za-z0-9]*)\s*([^>]*)\/?>/g);

    for (const jsxMatch of jsxMatches) {
      const componentName = jsxMatch[1];
      const propsString = jsxMatch[2];
      const packageName = imports[componentName];

      if (!packageName) continue;

      // Parse props
      const props = [];
      const propMatches = propsString.matchAll(/(\w+)\s*=\s*(\{[^}]+\}|"[^"]+"|\w+)/g);
      for (const propMatch of propMatches) {
        props.push({
          name: propMatch[1],
          value: propMatch[2].substring(0, 50),
        });
      }

      examples[componentName] = {
        codeSnippet: `<${componentName}${propsString ? ' ' + propsString : ''} />`,
        props,
        package: packageName,
      };
    }
  }

  return examples;
}

function extractComponentUsages(content) {
  const usages = {};

  // Find JSX component usage
  const jsxMatches = content.matchAll(/<([A-Z][A-Za-z0-9]*)\s*([^>]*)\/?>/g);

  for (const match of jsxMatches) {
    const componentName = match[1];
    const propsString = match[2];

    // Skip if no props (not interesting)
    if (!propsString.trim()) continue;

    // Extract prop names
    const props = [];
    const propMatches = propsString.matchAll(/(\w+)\s*=/g);
    for (const propMatch of propMatches) {
      props.push(propMatch[1]);
    }

    if (props.length > 0) {
      usages[componentName] = {
        codeSnippet: `<${componentName}${propsString.substring(0, 100)}... />`,
        props,
      };
    }
  }

  return usages;
}

function extractReturnInfo(content, hookName) {
  const returnMatch = content.match(/return\s*\{([^}]+)\}/s);
  if (!returnMatch) return null;

  const returnBlock = returnMatch[1];
  const properties = [];

  const propMatches = returnBlock.matchAll(/(\w+)\s*:/g);
  for (const match of propMatches) {
    properties.push(match[1]);
  }

  if (properties.length === 0) return null;

  return {
    properties,
    description: `Returns object with: ${properties.join(', ')}`,
    notes: [`Available: ${properties.slice(0, 5).join(', ')}${properties.length > 5 ? '...' : ''}`],
  };
}

function generateHookExample(hook) {
  const name = hook.name;
  const returnProps = hook.returnInfo?.properties || [];
  const destructuredProps = returnProps.slice(0, 6).join(', ');

  return `import { ${name} } from '@orderly.network/hooks';

function MyComponent() {
  const { ${destructuredProps || '...values'} } = ${name}();
  
  return (
    <div>
      {/* Use the returned values */}
    </div>
  );
}`;
}

function generateComponentExample(comp) {
  return `import { ${comp.name} } from '${comp.package}';

function MyComponent() {
  return <${comp.name} />;
}`;
}

function inferCategory(hookName, filePath) {
  const name = hookName.toLowerCase();
  const fp = (filePath || '').toLowerCase();

  if (name.includes('account') || name.includes('wallet') || name.includes('auth'))
    return 'Account & Wallet';
  if (name.includes('order') || name.includes('trade') || name.includes('entry'))
    return 'Order Management';
  if (name.includes('position')) return 'Positions';
  if (name.includes('deposit') || name.includes('withdraw') || name.includes('vault'))
    return 'Assets & Vault';
  if (name.includes('market') || name.includes('symbol') || name.includes('price'))
    return 'Market Data';
  if (name.includes('leverage') || name.includes('margin') || name.includes('collateral'))
    return 'Risk Management';
  if (name.includes('ws') || name.includes('stream') || name.includes('observer'))
    return 'WebSocket & Streaming';
  if (name.includes('query') || name.includes('fetch')) return 'Data Fetching';
  if (name.includes('history') || name.includes('stats')) return 'Analytics';
  if (name.includes('referral') || name.includes('reward')) return 'Referral & Rewards';
  if (fp.includes('orderly/')) return 'Orderly Network';
  return 'General';
}

function findRelatedHooks(hookName, allHooks) {
  const related = [];
  const category = inferCategory(hookName, '');
  for (const h of allHooks) {
    if (h.name !== hookName && inferCategory(h.name, '') === category) {
      related.push(h.name);
    }
    if (related.length >= 3) break;
  }
  return related;
}
