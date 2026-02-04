#!/usr/bin/env node

/**
 * analyze_example_repos.js
 *
 * This script analyzes the OrderlyNetwork/examples and OrderlyNetwork/broker-registration
 * repositories to extract authentication patterns, code examples, and implementation details.
 *
 * It creates an intermediate JSON file (repo_analysis.json) that contains structured
 * data about auth patterns, code examples, and implementation details found in the repos.
 *
 * Usage:
 *   node scripts/analyze_example_repos.js
 *
 * Output:
 *   - repo_analysis.json (in project root)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Paths to cloned repos (assumes they're cloned in /tmp or you can configure)
const EXAMPLES_REPO = process.env.EXAMPLES_REPO_PATH || '/tmp/orderly-examples';
const BROKER_REG_REPO = process.env.BROKER_REG_REPO_PATH || '/tmp/orderly-broker-reg';

console.log('🔍 Analyzing Orderly example repositories...\n');

// Check if repos exist
if (!fs.existsSync(EXAMPLES_REPO)) {
  console.error(`❌ Examples repo not found at: ${EXAMPLES_REPO}`);
  console.error(
    '   Clone it: git clone https://github.com/OrderlyNetwork/examples.git /tmp/orderly-examples'
  );
  process.exit(1);
}

if (!fs.existsSync(BROKER_REG_REPO)) {
  console.error(`❌ Broker registration repo not found at: ${BROKER_REG_REPO}`);
  console.error(
    '   Clone it: git clone https://github.com/OrderlyNetwork/broker-registration.git /tmp/orderly-broker-reg'
  );
  process.exit(1);
}

// Structure to hold extracted data
const analysis = {
  extractedAt: new Date().toISOString(),
  authentication: {
    typescript: [],
    python: [],
    java: [],
  },
  codeExamples: [],
  messageTypes: {},
  implementationPatterns: [],
  helperFunctions: [],
};

// Helper to read file content
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

// Extract TypeScript/JavaScript auth examples
function extractTSAuthExamples() {
  console.log('📁 Extracting TypeScript authentication examples...');

  const tsApiPath = path.join(EXAMPLES_REPO, 'api/ts/src');

  // Key files to extract
  const authFiles = [
    {
      file: 'authenticationExample.ts',
      type: 'api_usage',
      description: 'Using Orderly keys to sign API requests',
    },
    {
      file: 'orderlyKeyExample.ts',
      type: 'key_creation',
      description: 'Creating and registering Orderly keys with EIP-712',
    },
    {
      file: 'registerExample.ts',
      type: 'account_registration',
      description: 'Registering a new account with EIP-712',
    },
    {
      file: 'signer.ts',
      type: 'signing_utility',
      description: 'Core signing utility for API requests',
    },
    { file: 'eip712.ts', type: 'eip712_types', description: 'EIP-712 message type definitions' },
    { file: 'depositExample.ts', type: 'deposit', description: 'Depositing funds example' },
    { file: 'order.ts', type: 'order_placement', description: 'Placing orders via API' },
  ];

  for (const { file, type, description } of authFiles) {
    const filePath = path.join(tsApiPath, file);
    const content = readFile(filePath);

    if (content) {
      analysis.authentication.typescript.push({
        filename: file,
        type,
        description,
        content,
        language: 'typescript',
      });
      console.log(`   ✅ Extracted: ${file}`);
    } else {
      console.log(`   ⚠️  Not found: ${file}`);
    }
  }
}

// Extract Python auth examples
function extractPythonAuthExamples() {
  console.log('\n📁 Extracting Python authentication examples...');

  const pyPath = path.join(EXAMPLES_REPO, 'api/py/src');

  // Find Python files
  if (fs.existsSync(pyPath)) {
    const pyFiles = fs.readdirSync(pyPath).filter((f) => f.endsWith('.py'));

    for (const file of pyFiles) {
      const content = readFile(path.join(pyPath, file));
      if (content) {
        analysis.authentication.python.push({
          filename: file,
          type: 'python_example',
          description: `Python example: ${file}`,
          content,
          language: 'python',
        });
        console.log(`   ✅ Extracted: ${file}`);
      }
    }
  } else {
    console.log('   ⚠️  Python examples directory not found');
  }
}

// Extract Java auth examples
function extractJavaAuthExamples() {
  console.log('\n📁 Extracting Java authentication examples...');

  const javaPath = path.join(EXAMPLES_REPO, 'api/java');

  if (fs.existsSync(javaPath)) {
    // Recursively find Java files
    function findJavaFiles(dir, files = []) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findJavaFiles(fullPath, files);
        } else if (item.endsWith('.java')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const javaFiles = findJavaFiles(javaPath);

    for (const filePath of javaFiles) {
      const content = readFile(filePath);
      const relativePath = path.relative(javaPath, filePath);

      if (content) {
        analysis.authentication.java.push({
          filename: relativePath,
          type: 'java_example',
          description: `Java example: ${relativePath}`,
          content,
          language: 'java',
        });
        console.log(`   ✅ Extracted: ${relativePath}`);
      }
    }
  } else {
    console.log('   ⚠️  Java examples directory not found');
  }
}

// Extract helper functions from broker-registration repo
function extractHelperFunctions() {
  console.log('\n📁 Extracting helper functions from broker-registration...');

  const helpersPath = path.join(BROKER_REG_REPO, 'src/helpers/index.ts');
  const constantsPath = path.join(BROKER_REG_REPO, 'src/helpers/constants.ts');

  // Extract main helpers file
  const helpersContent = readFile(helpersPath);
  if (helpersContent) {
    analysis.helperFunctions.push({
      filename: 'helpers/index.ts',
      description: 'Main helper functions for authentication, deposits, withdrawals',
      content: helpersContent,
      keyFunctions: [
        'registerAccount',
        'addOrderlyKey',
        'signAndSendRequest',
        'deposit',
        'withdraw',
        'getAccountId',
      ],
    });
    console.log('   ✅ Extracted: helpers/index.ts');

    // Extract EIP-712 message types
    extractMessageTypes(helpersContent);
  }

  // Extract constants
  const constantsContent = readFile(constantsPath);
  if (constantsContent) {
    analysis.helperFunctions.push({
      filename: 'helpers/constants.ts',
      description: 'Network constants, contract addresses, and domain configs',
      content: constantsContent,
      keyFunctions: ['getBaseUrl', 'getOffChainDomain', 'getOnChainDomain', 'getVaultAddress'],
    });
    console.log('   ✅ Extracted: helpers/constants.ts');
  }
}

// Extract EIP-712 message type definitions
function extractMessageTypes(content) {
  console.log('\n📋 Extracting EIP-712 message types...');

  // Parse MESSAGE_TYPES object from the content
  const messageTypesMatch = content.match(/const MESSAGE_TYPES = \{([\s\S]*?)\};/);
  if (messageTypesMatch) {
    try {
      // Extract individual message types
      const types = [
        'Registration',
        'AddOrderlyKey',
        'Withdraw',
        'SettlePnl',
        'DelegateSigner',
        'DelegateAddOrderlyKey',
        'DelegateWithdraw',
        'DelegateSettlePnl',
        'InternalTransfer',
        'DelegateInternalTransfer',
      ];

      for (const type of types) {
        const typeMatch = content.match(new RegExp(`${type}:\\s*\\[([\\s\\S]*?)\\]`, 's'));
        if (typeMatch) {
          analysis.messageTypes[type] = {
            description: getMessageTypeDescription(type),
            fields: typeMatch[0],
          };
          console.log(`   ✅ Extracted: ${type}`);
        }
      }
    } catch (e) {
      console.log('   ⚠️  Could not parse all message types');
    }
  }
}

function getMessageTypeDescription(type) {
  const descriptions = {
    Registration: 'Register a new account with Orderly',
    AddOrderlyKey: 'Add an Orderly key for API authentication',
    Withdraw: 'Withdraw funds from Orderly',
    SettlePnl: 'Settle unrealized PnL',
    DelegateSigner: 'Register a delegate signer (e.g., Safe multisig)',
    DelegateAddOrderlyKey: 'Add Orderly key via delegate',
    DelegateWithdraw: 'Withdraw via delegate signer',
    DelegateSettlePnl: 'Settle PnL via delegate',
    InternalTransfer: 'Transfer between Orderly accounts',
    DelegateInternalTransfer: 'Internal transfer via delegate',
  };
  return descriptions[type] || `${type} operation`;
}

// Extract implementation patterns
function extractImplementationPatterns() {
  console.log('\n🔧 Extracting implementation patterns...');

  // Pattern 1: Account Registration Flow
  analysis.implementationPatterns.push({
    name: 'Account Registration Flow',
    description: 'Complete flow from wallet connection to account registration',
    steps: [
      'Get registration nonce from /v1/registration_nonce',
      'Create EIP-712 Registration message',
      'Sign with wallet (signTypedData)',
      'POST to /v1/register_account',
      'Receive account_id in response',
    ],
    codeReference: 'registerExample.ts, helpers/index.ts:registerAccount',
  });

  // Pattern 2: Orderly Key Creation
  analysis.implementationPatterns.push({
    name: 'Orderly Key Creation Flow',
    description: 'Generate Ed25519 keypair and register with Orderly',
    steps: [
      'Generate Ed25519 keypair using @noble/ed25519',
      'Get public key from private key',
      'Create EIP-712 AddOrderlyKey message',
      'Sign with wallet',
      'POST to /v1/orderly_key',
      'Store private key securely (localStorage/secure storage)',
    ],
    codeReference: 'orderlyKeyExample.ts, helpers/index.ts:addOrderlyKey',
  });

  // Pattern 3: API Request Signing
  analysis.implementationPatterns.push({
    name: 'API Request Signing',
    description: 'Sign API requests with Orderly key for authentication',
    steps: [
      'Create message string: timestamp + method + path + body',
      'Sign with Ed25519 private key using @noble/ed25519',
      'Encode signature as base64url',
      'Add headers: orderly-key, orderly-signature, orderly-timestamp, orderly-account-id',
      'Send request',
    ],
    codeReference: 'signer.ts, helpers/index.ts:signAndSendRequest',
  });

  // Pattern 4: Deposit Flow
  analysis.implementationPatterns.push({
    name: 'Deposit Flow',
    description: 'Deposit USDC into Orderly vault',
    steps: [
      'Connect to Vault contract',
      'Calculate deposit fee',
      'Call deposit() with USDC amount and broker hash',
      'Pay fee in native token (ETH/MATIC/etc)',
    ],
    codeReference: 'helpers/index.ts:deposit',
  });

  // Pattern 5: Withdrawal Flow
  analysis.implementationPatterns.push({
    name: 'Withdrawal Flow',
    description: 'Withdraw USDC from Orderly',
    steps: [
      'Get withdrawal nonce via authenticated request',
      'Create EIP-712 Withdraw message',
      'Sign with wallet',
      'POST to /v1/withdraw_request with signature',
      'Wait for on-chain confirmation',
    ],
    codeReference: 'helpers/index.ts:withdraw',
  });

  console.log('   ✅ Extracted 5 implementation patterns');
}

// Main execution
function main() {
  console.log(`\n📂 Using repos:
   - Examples: ${EXAMPLES_REPO}
   - Broker Registration: ${BROKER_REG_REPO}\n`);

  // Extract all data
  extractTSAuthExamples();
  extractPythonAuthExamples();
  extractJavaAuthExamples();
  extractHelperFunctions();
  extractImplementationPatterns();

  // Write analysis file
  const outputPath = path.join(projectRoot, 'repo_analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

  console.log(`\n✅ Analysis complete!`);
  console.log(`📄 Output: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(`   - TypeScript examples: ${analysis.authentication.typescript.length}`);
  console.log(`   - Python examples: ${analysis.authentication.python.length}`);
  console.log(`   - Java examples: ${analysis.authentication.java.length}`);
  console.log(`   - Helper functions: ${analysis.helperFunctions.length}`);
  console.log(`   - Message types: ${Object.keys(analysis.messageTypes).length}`);
  console.log(`   - Implementation patterns: ${analysis.implementationPatterns.length}`);
  console.log(`\nNext: Run generate_enriched_docs.js to create documentation from this analysis`);
}

main();
