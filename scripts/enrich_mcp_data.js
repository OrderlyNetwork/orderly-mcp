#!/usr/bin/env node

/**
 * enrich_mcp_data.js
 *
 * Master orchestration script that runs the complete enrichment pipeline:
 * 1. Analyzes example repositories (analyze_example_repos.js)
 * 2. Generates enriched documentation (generate_enriched_docs.js)
 * 3. Enhances workflows (generate_enriched_workflows.js)
 *
 * This script coordinates all enrichment steps and provides a single entry point
 * for enriching MCP data with real code examples from Orderly repositories.
 *
 * Prerequisites:
 *   - Node.js installed
 *   - Example repos cloned (or will be cloned automatically)
 *   - Existing MCP data in src/data/
 *
 * Usage:
 *   node scripts/enrich_mcp_data.js [options]
 *   USE_AI=true node scripts/enrich_mcp_data.js        # With AI enhancement
 *
 * Options:
 *   --skip-clone      Skip cloning repos (use existing)
 *   --skip-analysis   Skip analysis step (use existing repo_analysis.json)
 *   --docs-only       Only enrich documentation
 *   --workflows-only  Only enrich workflows
 *   --dry-run         Show what would be done without making changes
 *
 * Environment Variables:
 *   USE_AI=true       Enable AI enhancement (requires NEAR_AI_API_KEY)
 *
 * Examples:
 *   node scripts/enrich_mcp_data.js                    # Full enrichment
 *   node scripts/enrich_mcp_data.js --skip-clone       # Use existing repos
 *   node scripts/enrich_mcp_data.js --docs-only        # Only documentation
 *   node scripts/enrich_mcp_data.js --dry-run          # Preview changes
 *   USE_AI=true node scripts/enrich_mcp_data.js        # With AI enhancement
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipClone: args.includes('--skip-clone'),
  skipAnalysis: args.includes('--skip-analysis'),
  docsOnly: args.includes('--docs-only'),
  workflowsOnly: args.includes('--workflows-only'),
  dryRun: args.includes('--dry-run'),
  useAI: process.env.USE_AI === 'true',
};

console.log('🚀 MCP Data Enrichment Pipeline\n');
console.log('This script enriches MCP data with real code examples from Orderly repos.\n');

if (options.useAI) {
  console.log('🤖 AI ENHANCEMENT ENABLED\n');
}

if (options.dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

// Configuration
const REPOS = {
  examples: {
    url: 'https://github.com/OrderlyNetwork/examples.git',
    path: '/tmp/orderly-examples',
    description: 'API examples in TypeScript, Python, and Java',
  },
  brokerReg: {
    url: 'https://github.com/OrderlyNetwork/broker-registration.git',
    path: '/tmp/orderly-broker-reg',
    description: 'Broker registration UI with helper functions',
  },
};

// Helper to run commands
function runCommand(command, description) {
  console.log(`\n📦 ${description}...`);
  if (options.dryRun) {
    console.log(`   [DRY RUN] Would execute: ${command}`);
    return;
  }

  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    console.log('   ✅ Success');
  } catch (error) {
    console.error('   ❌ Failed:', error.message);
    throw error;
  }
}

// Step 1: Clone repositories
async function cloneRepos() {
  if (options.skipClone) {
    console.log('⏭️  Skipping repo cloning (--skip-clone)');
    return;
  }

  console.log('\n📥 Step 1: Cloning repositories\n');

  for (const [name, repo] of Object.entries(REPOS)) {
    if (fs.existsSync(repo.path)) {
      console.log(`   ℹ️  ${name} already exists at ${repo.path}`);
      console.log(`      Pulling latest changes...`);
      if (!options.dryRun) {
        try {
          execSync('git pull', { cwd: repo.path, stdio: 'ignore' });
          console.log('      ✅ Updated');
        } catch (e) {
          console.log('      ⚠️  Could not pull, using existing');
        }
      }
    } else {
      console.log(`   📦 Cloning ${name}...`);
      console.log(`      URL: ${repo.url}`);
      console.log(`      Path: ${repo.path}`);

      if (!options.dryRun) {
        try {
          execSync(`git clone --depth 1 ${repo.url} ${repo.path}`, {
            stdio: 'ignore',
          });
          console.log('      ✅ Cloned successfully');
        } catch (error) {
          console.error('      ❌ Failed to clone');
          throw error;
        }
      } else {
        console.log('      [DRY RUN] Would clone repo');
      }
    }
  }
}

// Step 2: Analyze repositories
async function analyzeRepos() {
  if (options.skipAnalysis) {
    console.log('\n⏭️  Skipping analysis (--skip-analysis)');
    const analysisPath = path.join(projectRoot, 'repo_analysis.json');
    if (!fs.existsSync(analysisPath)) {
      console.error('❌ repo_analysis.json not found. Cannot skip analysis.');
      process.exit(1);
    }
    return;
  }

  console.log('\n🔍 Step 2: Analyzing repositories\n');
  runCommand('node scripts/analyze_example_repos.js', 'Analyzing example repos');
}

// Step 3: Generate enriched documentation
async function enrichDocumentation() {
  if (options.workflowsOnly) {
    console.log('\n⏭️  Skipping documentation enrichment (--workflows-only)');
    return;
  }

  console.log('\n📝 Step 3: Enriching documentation\n');
  const docsCommand = options.useAI
    ? 'USE_AI=true node scripts/generate_enriched_docs.js'
    : 'node scripts/generate_enriched_docs.js';
  runCommand(docsCommand, 'Generating enriched documentation');
}

// Step 4: Enhance workflows
async function enrichWorkflows() {
  if (options.docsOnly) {
    console.log('\n⏭️  Skipping workflow enrichment (--docs-only)');
    return;
  }

  console.log('\n🔄 Step 4: Enhancing workflows\n');
  const workflowsCommand = options.useAI
    ? 'USE_AI=true node scripts/generate_enriched_workflows.js'
    : 'node scripts/generate_enriched_workflows.js';
  runCommand(workflowsCommand, 'Enhancing workflows');
}

// Step 5: Validation and summary
async function validateAndSummarize() {
  console.log('\n✅ Step 5: Validation and summary\n');

  if (options.dryRun) {
    console.log('📊 DRY RUN SUMMARY');
    console.log('   The following would be done:');
    console.log('   1. Clone/update example repositories');
    if (!options.skipAnalysis) {
      console.log('   2. Analyze repos and create repo_analysis.json');
    }
    if (!options.workflowsOnly) {
      console.log('   3. Generate 5-7 new documentation chunks with code examples');
      console.log('      - Direct API Authentication (TypeScript)');
      console.log('      - Account Registration with EIP-712');
      console.log('      - Creating Orderly Keys');
      console.log('      - EIP-712 Message Types Reference');
      console.log('      - Common Implementation Patterns');
      console.log('      - Python and Java examples');
    }
    if (!options.docsOnly) {
      console.log('   4. Enhance 5 existing workflows with implementation code');
      console.log('   5. Add 1 new workflow (Delegate Signer Setup)');
    }
    console.log('\n   Run without --dry-run to execute these changes.');
    return;
  }

  // Check output files
  const docsPath = path.join(projectRoot, 'src/data/documentation.json');
  const workflowsPath = path.join(projectRoot, 'src/data/workflows.json');

  let docsStats = null;
  let workflowStats = null;

  if (fs.existsSync(docsPath) && !options.workflowsOnly) {
    const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    docsStats = {
      totalChunks: docs.chunks.length,
      enrichedAt: docs.metadata?.enrichedAt,
      newChunks: docs.metadata?.enrichmentStats?.newChunks || 0,
    };
  }

  if (fs.existsSync(workflowsPath) && !options.docsOnly) {
    const workflows = JSON.parse(fs.readFileSync(workflowsPath, 'utf-8'));
    workflowStats = {
      totalWorkflows: workflows.workflows.length,
      enrichedAt: workflows.metadata?.enrichedAt,
    };
  }

  // Print summary
  console.log('📊 ENRICHMENT COMPLETE\n');

  if (docsStats) {
    console.log('Documentation:');
    console.log(`   Total chunks: ${docsStats.totalChunks}`);
    console.log(`   New chunks: ${docsStats.newChunks}`);
    console.log(`   Enriched at: ${docsStats.enrichedAt}`);
    if (options.useAI) {
      console.log(`   AI enhanced: Yes`);
    }
    console.log();
  }

  if (workflowStats) {
    console.log('Workflows:');
    console.log(`   Total workflows: ${workflowStats.totalWorkflows}`);
    console.log(`   Enriched at: ${workflowStats.enrichedAt}`);
    console.log();
  }

  console.log('Files modified:');
  if (!options.workflowsOnly) {
    console.log(`   - src/data/documentation.json`);
  }
  if (!options.docsOnly) {
    console.log(`   - src/data/workflows.json`);
  }

  console.log('\nNext steps:');
  console.log('   1. Review the enriched data');
  console.log('   2. Run tests: yarn test:run');
  console.log('   3. Build project: yarn build');
  console.log('   4. Commit changes with git');
}

// Main execution
async function main() {
  const startTime = Date.now();

  try {
    // Run all steps
    await cloneRepos();
    await analyzeRepos();
    await enrichDocumentation();
    await enrichWorkflows();
    await validateAndSummarize();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Total time: ${duration}s`);

    if (!options.dryRun) {
      console.log('\n✨ Enrichment complete!');
    }
  } catch (error) {
    console.error('\n❌ Enrichment failed:', error.message);
    console.error('\nTo restore your data, use git:');
    console.error('   git checkout src/data/documentation.json');
    console.error('   git checkout src/data/workflows.json');
    process.exit(1);
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
MCP Data Enrichment Pipeline

This script enriches MCP data with real code examples from Orderly repositories.

USAGE:
  node scripts/enrich_mcp_data.js [options]

OPTIONS:
  --skip-clone      Skip cloning repos (use existing in /tmp)
  --skip-analysis   Skip analysis step (use existing repo_analysis.json)
  --docs-only       Only enrich documentation
  --workflows-only  Only enrich workflows
  --dry-run         Show what would be done without making changes
  --help, -h        Show this help message

ENVIRONMENT VARIABLES:
  USE_AI=true       Enable AI enhancement (requires NEAR_AI_API_KEY)

EXAMPLES:
  # Full enrichment (clone repos, analyze, enrich everything)
  node scripts/enrich_mcp_data.js

  # Use existing repos, skip cloning
  node scripts/enrich_mcp_data.js --skip-clone

  # Preview what would be done
  node scripts/enrich_mcp_data.js --dry-run

  # Only enrich documentation
  node scripts/enrich_mcp_data.js --docs-only --skip-clone

  # With AI enhancement
  USE_AI=true node scripts/enrich_mcp_data.js

REPOSITORIES:
  The script uses two repositories:
  1. https://github.com/OrderlyNetwork/examples
     - TypeScript, Python, and Java API examples
  2. https://github.com/OrderlyNetwork/broker-registration
     - Helper functions and UI components

OUTPUT:
  - Enriched src/data/documentation.json (with code examples)
  - Enriched src/data/workflows.json (with implementation details)
  - AI-enhanced narrative content (if USE_AI=true)
`);
  process.exit(0);
}

main();
