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
import crypto from 'crypto';
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
const FORCE = process.env.FORCE === 'true';
const SDK_REPO = 'https://github.com/OrderlyNetwork/js-sdk.git';
const TEMP_DIR = path.join(projectRoot, '.temp-sdk');
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'sdk-patterns.json');
const COMPONENT_GUIDES_FILE = path.join(projectRoot, 'src', 'data', 'component-guides.json');

console.log('🔍 Orderly SDK Pattern Extractor\n');
console.log(`Mode: ${USE_AI ? 'AI Enrichment (PAID ~$5-15)' : 'Source Extraction (FREE)'}`);
console.log(
  `Incremental: ${FORCE ? 'OFF (FORCE=true, full regeneration)' : 'ON (only enrich new items)'}`
);
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

const MODEL = 'Qwen/Qwen3.5-122B-A10B';

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

// ==================== PASS 4.5: LOAD EXISTING DATA & CLASSIFY ====================

const existingData = FORCE
  ? {
      hookMap: {},
      componentMap: {},
      guideMap: {},
      categories: [],
      guides: [],
      fingerprints: {},
      guideFingerprints: {},
      loaded: false,
    }
  : loadExistingData();

const extractedHookNames = new Set(rawHooks.map((h) => h.name));
const extractedComponentNames = new Set(rawComponents.map((c) => c.name));

// Compute fingerprints for all extracted items
const hookFingerprints = {};
for (const hook of rawHooks) {
  hookFingerprints[hook.name] = computeHookFingerprint(hook);
}
const componentFingerprints = {};
for (const comp of rawComponents) {
  componentFingerprints[comp.name] = computeComponentFingerprint(comp);
}

// 3-way classification for hooks
const newHooks = [];
const changedHooks = [];
const unchangedHooks = [];

for (const hook of rawHooks) {
  const existing = existingData.hookMap[hook.name];
  if (!existing) {
    newHooks.push(hook);
  } else {
    const storedFp = existingData.fingerprints[hook.name];
    if (!storedFp || storedFp !== hookFingerprints[hook.name]) {
      changedHooks.push(hook);
    } else {
      unchangedHooks.push(hook);
    }
  }
}

// 3-way classification for components
const newComponents = [];
const changedComponents = [];
const unchangedComponents = [];

for (const comp of rawComponents) {
  const existing = existingData.componentMap[comp.name];
  if (!existing) {
    newComponents.push(comp);
  } else {
    const storedFp = existingData.fingerprints[comp.name];
    if (!storedFp || storedFp !== componentFingerprints[comp.name]) {
      changedComponents.push(comp);
    } else {
      unchangedComponents.push(comp);
    }
  }
}

const removedHookCount = Object.keys(existingData.hookMap).filter(
  (n) => !extractedHookNames.has(n)
).length;
const removedComponentCount = Object.keys(existingData.componentMap).filter(
  (n) => !extractedComponentNames.has(n)
).length;

// Items that need AI enrichment (new + changed)
const hooksToEnrich = [...newHooks, ...changedHooks];
const componentsToEnrich = [...newComponents, ...changedComponents];

if (existingData.loaded) {
  console.log(`📊 Incremental Analysis:`);
  console.log(
    `   Hooks — ${unchangedHooks.length} unchanged, ${changedHooks.length} changed, ${newHooks.length} new, ${removedHookCount} removed`
  );
  console.log(
    `   Components — ${unchangedComponents.length} unchanged, ${changedComponents.length} changed, ${newComponents.length} new, ${removedComponentCount} removed`
  );
  console.log(
    `   Need enrichment: ${hooksToEnrich.length} hooks, ${componentsToEnrich.length} components\n`
  );
}

const allExistingPatternNames = [
  ...Object.keys(existingData.hookMap),
  ...Object.keys(existingData.componentMap),
];

// ==================== PASS 5: AI ENRICHMENT (Optional) ====================

let enrichedHooks = [];
let enrichedComponents = [];

if (USE_AI) {
  console.log('🤖 Phase 5: AI Enrichment\n');

  if (!existingData.loaded || FORCE) {
    console.log('⚠️  Full generation mode. Estimated cost: ~$10-15\n');
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
    await new Promise((r) => setTimeout(r, 3000));
  } else if (hooksToEnrich.length + componentsToEnrich.length > 0) {
    const estCost = (((hooksToEnrich.length + componentsToEnrich.length) / 20) * 3).toFixed(2);
    console.log(
      `⚠️  Estimated cost: ~$${estCost} (${hooksToEnrich.length} hooks + ${componentsToEnrich.length} components to enrich)\n`
    );
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    console.log('ℹ️  No new or changed items — skipping AI calls\n');
  }

  if (hooksToEnrich.length > 0) {
    console.log(
      `📝 Enriching ${hooksToEnrich.length} hooks (${newHooks.length} new + ${changedHooks.length} changed)...`
    );
    enrichedHooks = await enrichHooksWithAI(hooksToEnrich, allExistingPatternNames);
    console.log(`   ✅ Enriched ${enrichedHooks.length} hooks\n`);
  } else {
    console.log('📝 No hooks to enrich\n');
  }

  if (componentsToEnrich.length > 0) {
    console.log(
      `🧩 Enriching ${componentsToEnrich.length} components (${newComponents.length} new + ${changedComponents.length} changed)...`
    );
    enrichedComponents = await enrichComponentsWithAI(componentsToEnrich, allExistingPatternNames);
    console.log(`   ✅ Enriched ${enrichedComponents.length} components\n`);
  } else {
    console.log('🧩 No components to enrich\n');
  }

  console.log(`📘 Generating component guides...`);
  await generateComponentGuides(
    componentsToEnrich,
    enrichedComponents,
    [...enrichedHooks, ...unchangedHooks],
    existingData
  );
  console.log(`   ✅ Component guides generated\n`);
} else {
  console.log('📄 Skipping AI enrichment (USE_AI not set)\n');
  const hooksToProcess = existingData.loaded ? hooksToEnrich : rawHooks;
  const componentsToProcess = existingData.loaded ? componentsToEnrich : rawComponents;
  enrichedHooks = hooksToProcess.map((h) => ({
    ...h,
    example: generateHookExample(h),
  }));
  enrichedComponents = componentsToProcess.map((c) => ({
    ...c,
    example: generateComponentExample(c),
  }));
}

// ==================== GENERATE OUTPUT ====================

console.log('💾 Saving sdk-patterns.json...');

const categoryMap = {};

if (existingData.loaded) {
  for (const [name, data] of Object.entries(existingData.hookMap)) {
    // Keep only unchanged hooks still in SDK source
    if (unchangedHooks.some((h) => h.name === name)) {
      const catName = data.category;
      if (!categoryMap[catName]) categoryMap[catName] = [];
      categoryMap[catName].push(data.pattern);
    }
  }
}

// Add newly enriched hooks (new + changed)
for (const hook of enrichedHooks) {
  const catName = hook.category || 'General';
  if (!categoryMap[catName]) categoryMap[catName] = [];

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
    related:
      hook.aiExample?.related || findRelatedHooks(hook.name, [...enrichedHooks, ...unchangedHooks]),
  });
}

const categories = Object.entries(categoryMap).map(([name, patterns]) => ({
  name,
  patterns,
}));

// Build UI Components: unchanged existing + newly enriched (new + changed)
const uiPatterns = [];

if (existingData.loaded) {
  for (const [name, pattern] of Object.entries(existingData.componentMap)) {
    if (unchangedComponents.some((c) => c.name === name)) {
      uiPatterns.push(pattern);
    }
  }
}

for (const c of enrichedComponents) {
  uiPatterns.push({
    name: c.name,
    description: c.aiExample?.description || `UI component from ${c.package}`,
    installation: `npm install ${c.package}`,
    usage: c.aiExample?.usage || `Import and use ${c.name} in your React components`,
    example: c.aiExample?.code || c.example,
    notes: c.aiExample?.notes || [],
    related: c.aiExample?.related || [],
  });
}

if (uiPatterns.length > 0) {
  categories.push({ name: 'UI Components', patterns: uiPatterns });
}

const totalHooks = unchangedHooks.length + enrichedHooks.length;
const totalComponents = unchangedComponents.length + enrichedComponents.length;

// Build merged fingerprint map
const mergedFingerprints = {};
for (const h of unchangedHooks) {
  mergedFingerprints[h.name] = hookFingerprints[h.name];
}
for (const c of unchangedComponents) {
  mergedFingerprints[c.name] = componentFingerprints[c.name];
}
for (const h of enrichedHooks) {
  mergedFingerprints[h.name] = hookFingerprints[h.name];
}
for (const c of enrichedComponents) {
  mergedFingerprints[c.name] = componentFingerprints[c.name];
}

const output = {
  version: '3.0.0',
  generatedAt: new Date().toISOString(),
  mode: USE_AI ? 'ai-enriched' : 'source-extracted',
  stats: {
    totalHooks,
    totalComponents,
    componentsWithContext,
    totalCategories: categories.length,
  },
  _fingerprints: mergedFingerprints,
  categories,
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

console.log(`   ✅ Saved to ${OUTPUT_FILE}\n`);
console.log(`   📊 Summary:`);
console.log(
  `      - ${totalHooks} hooks (${unchangedHooks.length} unchanged + ${enrichedHooks.length} enriched [${newHooks.length} new, ${changedHooks.length} changed])`
);
console.log(
  `      - ${totalComponents} components (${unchangedComponents.length} unchanged + ${enrichedComponents.length} enriched [${newComponents.length} new, ${changedComponents.length} changed])`
);
console.log(`      - ${removedHookCount} hooks removed from SDK`);
console.log(`      - ${removedComponentCount} components removed from SDK`);
console.log(`      - ${categories.length} categories\n`);

// Cleanup
console.log('🧹 Cleaning up...');
try {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('   ✅ Done\n');
} catch (e) {}

console.log('✨ Complete!');

// ==================== EXISTING DATA LOADING ====================

function loadExistingData() {
  const result = {
    hookMap: {},
    componentMap: {},
    guideMap: {},
    categories: [],
    guides: [],
    fingerprints: {},
    guideFingerprints: {},
    loaded: false,
  };

  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      result.categories = existing.categories || [];
      result.fingerprints = existing._fingerprints || {};

      for (const category of result.categories) {
        if (category.name === 'UI Components') continue;
        for (const pattern of category.patterns) {
          result.hookMap[pattern.name] = { category: category.name, pattern };
        }
      }

      const uiCategory = result.categories.find((c) => c.name === 'UI Components');
      if (uiCategory) {
        for (const pattern of uiCategory.patterns) {
          result.componentMap[pattern.name] = pattern;
        }
      }

      result.loaded = true;
    }
  } catch (e) {
    console.log(`   ⚠️  Could not load existing sdk-patterns.json: ${e.message}`);
  }

  try {
    if (fs.existsSync(COMPONENT_GUIDES_FILE)) {
      const existing = JSON.parse(fs.readFileSync(COMPONENT_GUIDES_FILE, 'utf-8'));
      result.guides = existing.components || [];
      result.guideFingerprints = existing._fingerprints || {};
      for (const guide of result.guides) {
        result.guideMap[guide.name] = guide;
      }
    }
  } catch (e) {
    console.log(`   ⚠️  Could not load existing component-guides.json: ${e.message}`);
  }

  return result;
}

function computeHookFingerprint(hook) {
  const fingerprintData = {
    name: hook.name,
    returnProperties: hook.returnInfo?.properties?.slice().sort() || [],
    description: hook.description,
    sourceFile: hook.sourceFile,
  };
  return crypto
    .createHash('md5')
    .update(JSON.stringify(fingerprintData))
    .digest('hex')
    .substring(0, 8);
}

function computeComponentFingerprint(component) {
  const fingerprintData = {
    name: component.name,
    package: component.package,
    file: component.file,
    storyProps: component.stories?.flatMap((s) => s.props?.map((p) => p.name) || []).sort() || [],
    internalProps: component.internalUsages?.flatMap((u) => u.props?.sort() || []).sort() || [],
  };
  return crypto
    .createHash('md5')
    .update(JSON.stringify(fingerprintData))
    .digest('hex')
    .substring(0, 8);
}

// ==================== AI ENRICHMENT FUNCTIONS ====================

async function enrichHooksWithAI(hooks, existingPatternNames = []) {
  const enriched = [];
  const batchSize = 10;

  const existingContext =
    existingPatternNames.length > 0
      ? `\nAlready documented (use these in "related" fields): ${existingPatternNames.join(', ')}\n`
      : '';

  for (let i = 0; i < hooks.length; i += batchSize) {
    const batch = hooks.slice(i, i + batchSize);
    const endIdx = Math.min(i + batchSize, hooks.length);

    console.log(`   Processing hooks ${i + 1}-${endIdx} of ${hooks.length}...`);

    const prompt = `Generate clean, practical code examples for these Orderly SDK hooks.
${existingContext}
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

async function enrichComponentsWithAI(components, existingPatternNames = []) {
  const enriched = [];
  const batchSize = 8;

  const existingContext =
    existingPatternNames.length > 0
      ? `\nAlready documented (use these in "related" fields): ${existingPatternNames.join(', ')}\n`
      : '';

  for (let i = 0; i < components.length; i += batchSize) {
    const batch = components.slice(i, i + batchSize);
    const endIdx = Math.min(i + batchSize, components.length);

    console.log(`   Processing components ${i + 1}-${endIdx} of ${components.length}...`);

    const prompt = `Generate clean, practical code examples for these Orderly UI components.
${existingContext}
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

// ==================== PASS 6: GENERATE COMPONENT GUIDES ====================

async function generateComponentGuides(
  componentsToEnrich,
  enrichedComponents,
  allHooks,
  existingData
) {
  console.log(`   Generating component guides...`);

  const hookMap = {};
  allHooks.forEach((h) => {
    hookMap[h.name] = {
      name: h.name,
      category: h.category,
      description: h.description || `Hook for ${h.name}`,
    };
  });

  const topHooks = Object.values(hookMap)
    .slice(0, 20)
    .map((h) => `- ${h.name} (${h.category}): ${h.description.substring(0, 80)}`)
    .join('\n');

  // Only generate guides for components that are new or whose fingerprint changed
  const componentsNeedingGuides = componentsToEnrich.filter((c) => {
    const existingFp = existingData.guideFingerprints[c.name];
    const currentFp = componentFingerprints[c.name];
    return !existingFp || existingFp !== currentFp;
  });

  const enrichedNames = new Set(enrichedComponents.map((c) => c.name));

  console.log(
    `   ${componentsNeedingGuides.length} components need new/updated guides (${Object.keys(existingData.guideMap).length} existing guides to check)`
  );

  const batchSize = 2;
  const newGuides = [];
  const failedBatches = [];

  for (let i = 0; i < componentsNeedingGuides.length; i += batchSize) {
    const batch = componentsNeedingGuides.slice(i, i + batchSize);
    const endIdx = Math.min(i + batchSize, componentsNeedingGuides.length);

    console.log(`      Processing batch ${i + 1}-${endIdx}...`);

    const prompt = `Generate component building guides for these Orderly Network UI components.

Components:
${batch
  .map(
    (c) => `
Name: ${c.name}
Package: ${c.package}
Description: ${c.aiExample?.description || 'UI component'}
Related: ${c.aiExample?.related?.join(', ') || 'N/A'}
`
  )
  .join('\n---\n')}

Available hooks:
${topHooks}

For EACH component, return:
{
  "name": "ComponentName",
  "description": "What it does (1-2 sentences)",
  "requiredPackages": ["@orderly.network/ui"],
  "keyHooks": ["useHook1", "useHook2"],
  "variants": [
    {
      "complexity": "minimal",
      "description": "Basic usage",
      "code": "import...\n\nfunction Component() {\n  // 30-50 lines\n}",
      "additionalImports": [],
      "tips": ["Tip 1", "Tip 2"]
    },
    {
      "complexity": "standard", 
      "description": "Full features",
      "code": "import...\n\nfunction Component() {\n  // 50-80 lines\n}",
      "additionalImports": [],
      "tips": ["Tip 1", "Tip 2"]
    },
    {
      "complexity": "advanced",
      "description": "Complete implementation",
      "code": "import...\n\nfunction Component() {\n  // 80-120 lines\n}",
      "additionalImports": [],
      "tips": ["Tip 1", "Tip 2"]
    }
  ],
  "stylingNotes": "CSS tips",
  "commonMistakes": ["Mistake 1", "Mistake 2"],
  "relatedComponents": ["Component1", "Component2"]
}

Return: {"guides": [guide1, guide2]}`;

    let retries = 0;
    const maxRetries = 3;
    let success = false;
    let currentMaxTokens = 10_000;

    while (retries < maxRetries && !success) {
      try {
        if (retries > 0) {
          currentMaxTokens = 10_000 + retries * 3000;
          console.log(`      📝 Increasing max_tokens to ${currentMaxTokens} for retry ${retries}`);
        }

        const response = await client.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content:
                'Expert Orderly SDK developer. Generate concise, working React component examples. Keep code examples focused and under 120 lines per variant to ensure complete JSON output.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: currentMaxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          let parsed;
          try {
            parsed = JSON.parse(content);
          } catch (parseError) {
            console.error(
              `      ⚠️ JSON parse error on attempt ${retries + 1}: ${parseError.message}`
            );
            throw parseError;
          }

          const batchGuides = parsed.guides || [];

          for (const guide of batchGuides) {
            if (guide.name && guide.variants && guide.variants.length === 3) {
              guide.variants.forEach((v) => {
                if (!v.additionalImports) v.additionalImports = [];
                if (!v.tips) v.tips = [];
              });
              newGuides.push(guide);
            }
          }

          console.log(`      ✅ Generated ${batchGuides.length} guides`);
          success = true;
        }
      } catch (error) {
        retries++;
        console.error(`      ❌ Error (attempt ${retries}/${maxRetries}): ${error.message}`);

        if (retries < maxRetries) {
          console.log(`      🔄 Retrying in ${retries * 2}s...`);
          await new Promise((r) => setTimeout(r, retries * 2000));
        } else {
          console.error(`      💥 Failed after ${maxRetries} attempts, skipping batch`);
          failedBatches.push({ start: i + 1, end: endIdx, components: batch.map((c) => c.name) });
        }
      }
    }

    if (i + batchSize < componentsNeedingGuides.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (failedBatches.length > 0) {
    console.log(`\n   ⚠️  Failed batches:`);
    failedBatches.forEach((b) => {
      console.log(`      - Components ${b.start}-${b.end}: ${b.components.join(', ')}`);
    });
  }

  // Merge: keep existing guides for unchanged components, add new guides
  const enrichedComponentNames = new Set(enrichedComponents.map((c) => c.name));
  const allExtractedNames = new Set(rawComponents.map((c) => c.name));
  const keptExistingGuides = existingData.guides.filter(
    (g) => !enrichedComponentNames.has(g.name) && allExtractedNames.has(g.name)
  );
  const allGuides = [...keptExistingGuides, ...newGuides];

  // Build merged guide fingerprints
  const mergedGuideFingerprints = { ...existingData.guideFingerprints };
  for (const g of newGuides) {
    if (componentFingerprints[g.name]) {
      mergedGuideFingerprints[g.name] = componentFingerprints[g.name];
    }
  }

  const output = {
    components: allGuides,
    metadata: {
      version: '3.0.0',
      generatedAt: new Date().toISOString(),
      totalComponents: allGuides.length,
      totalNew: newGuides.length,
      totalKept: keptExistingGuides.length,
      totalFailed: failedBatches.length * batchSize,
      source: 'Generated from SDK source code analysis',
      mode: 'ai-enriched',
    },
    _fingerprints: mergedGuideFingerprints,
  };

  fs.writeFileSync(COMPONENT_GUIDES_FILE, JSON.stringify(output, null, 2));
  console.log(
    `   ✅ Saved ${allGuides.length} component guides (${keptExistingGuides.length} kept + ${newGuides.length} new) to ${COMPONENT_GUIDES_FILE}`
  );

  if (failedBatches.length > 0) {
    console.log(`   ⚠️  ${failedBatches.length * batchSize} components failed to generate`);
  }
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
