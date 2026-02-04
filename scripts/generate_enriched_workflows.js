#!/usr/bin/env node

/**
 * generate_enriched_workflows.js
 *
 * This script reads repo_analysis.json and enhances existing workflows.json
 * with detailed implementation code from the example repositories.
 *
 * It adds code examples, detailed steps, and implementation notes to existing
 * workflows without changing their structure or removing existing content.
 *
 * Usage:
 *   node scripts/generate_enriched_workflows.js
 *
 * Input:
 *   - repo_analysis.json (from analyze_example_repos.js)
 *   - src/data/workflows.json (existing)
 *
 * Output:
 *   - src/data/workflows.json (enriched with implementation details)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// File paths
const REPO_ANALYSIS = path.join(projectRoot, 'repo_analysis.json');
const WORKFLOWS_FILE = path.join(projectRoot, 'src/data/workflows.json');

console.log('🔄 Enriching workflows with implementation details...\n');

// Check prerequisites
if (!fs.existsSync(REPO_ANALYSIS)) {
  console.error(`❌ Missing: ${REPO_ANALYSIS}`);
  console.error('   Run: node scripts/analyze_example_repos.js');
  process.exit(1);
}

if (!fs.existsSync(WORKFLOWS_FILE)) {
  console.error(`❌ Missing: ${WORKFLOWS_FILE}`);
  process.exit(1);
}

// Load data
const repoAnalysis = JSON.parse(fs.readFileSync(REPO_ANALYSIS, 'utf-8'));
const existingWorkflows = JSON.parse(fs.readFileSync(WORKFLOWS_FILE, 'utf-8'));

console.log(`📊 Loaded:`);
console.log(`   - Existing workflows: ${existingWorkflows.workflows.length}`);
console.log(`   - Helper functions: ${repoAnalysis.helperFunctions.length}`);
console.log(`   - Code examples: ${repoAnalysis.authentication.typescript.length}\n`);

// Find code examples
const signerCode =
  repoAnalysis.authentication.typescript.find((ex) => ex.filename === 'signer.ts')?.content || '';

const registerCode =
  repoAnalysis.authentication.typescript.find((ex) => ex.filename === 'registerExample.ts')
    ?.content || '';

const keyCode =
  repoAnalysis.authentication.typescript.find((ex) => ex.filename === 'orderlyKeyExample.ts')
    ?.content || '';

const authCode =
  repoAnalysis.authentication.typescript.find((ex) => ex.filename === 'authenticationExample.ts')
    ?.content || '';

// Helper to find workflow by name
function findWorkflow(name) {
  return existingWorkflows.workflows.find((wf) =>
    wf.name.toLowerCase().includes(name.toLowerCase())
  );
}

// Helper to enhance a workflow step with code
function enhanceStep(step, code, description = null) {
  return {
    ...step,
    code: code || step.code,
    description: description || step.description,
    implementation: code ? 'See code example above' : undefined,
  };
}

// 1. Enhance "Register New Account" workflow
function enhanceRegisterWorkflow() {
  console.log('🔄 Enhancing: Register New Account');

  const workflow = findWorkflow('register');
  if (!workflow) {
    console.log('   ⚠️  Workflow not found, skipping');
    return;
  }

  // Find or create the EIP-712 signing step
  const signingStepIndex = workflow.steps.findIndex(
    (s) => s.title.toLowerCase().includes('sign') || s.description.toLowerCase().includes('eip-712')
  );

  if (signingStepIndex >= 0) {
    workflow.steps[signingStepIndex] = enhanceStep(
      workflow.steps[signingStepIndex],
      `// EIP-712 Domain Configuration
const OFF_CHAIN_DOMAIN = {
  name: 'Orderly',
  version: '1',
  chainId: 421614, // Arbitrum Sepolia testnet
  verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
};

// Registration Message Type
const MESSAGE_TYPES = {
  Registration: [
    { name: 'brokerId', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'registrationNonce', type: 'uint256' }
  ]
};

// Create and sign message
const registerMessage = {
  brokerId: 'your_broker_id',
  chainId: 421614,
  timestamp: Date.now(),
  registrationNonce: nonceFromStep2
};

const signature = await wallet.signTypedData(
  OFF_CHAIN_DOMAIN,
  { Registration: MESSAGE_TYPES.Registration },
  registerMessage
);`,
      'Create EIP-712 Registration message and sign with your wallet'
    );
  }

  // Add complete example to the workflow
  workflow.completeExample = registerCode;

  // Add implementation notes
  if (!workflow.implementationNotes) {
    workflow.implementationNotes = [];
  }
  workflow.implementationNotes.push(
    'Nonces expire after 2 minutes - fetch immediately before signing',
    'Use the exact domain configuration shown in the code',
    'Registration creates your Orderly Account ID which is needed for all subsequent operations'
  );

  console.log('   ✅ Enhanced');
}

// 2. Enhance "Generate and Access Orderly Key" workflow
function enhanceOrderlyKeyWorkflow() {
  console.log('🔄 Enhancing: Generate and Access Orderly Key');

  const workflow = findWorkflow('orderly key');
  if (!workflow) {
    console.log('   ⚠️  Workflow not found, skipping');
    return;
  }

  // Enhance key generation step
  const genStepIndex = workflow.steps.findIndex(
    (s) =>
      s.title.toLowerCase().includes('generate') || s.description.toLowerCase().includes('ed25519')
  );

  if (genStepIndex >= 0) {
    workflow.steps[genStepIndex] = enhanceStep(
      workflow.steps[genStepIndex],
      `import { getPublicKeyAsync, utils } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';

// Generate Ed25519 keypair
const privateKey = utils.randomPrivateKey();
const publicKeyBytes = await getPublicKeyAsync(privateKey);
const orderlyKey = \`ed25519:\${encodeBase58(publicKeyBytes)}\`;

// Store private key securely (e.g., environment variable)
const orderlySecret = encodeBase58(privateKey);`,
      'Generate Ed25519 keypair for API authentication'
    );
  }

  // Enhance registration step
  const regStepIndex = workflow.steps.findIndex(
    (s) =>
      s.title.toLowerCase().includes('register') || s.description.toLowerCase().includes('eip-712')
  );

  if (regStepIndex >= 0) {
    workflow.steps[regStepIndex] = enhanceStep(
      workflow.steps[regStepIndex],
      `// AddOrderlyKey message type
const addKeyMessage = {
  brokerId: 'your_broker_id',
  chainId: 421614,
  orderlyKey: 'ed25519:xxx...', // Your public key
  scope: 'read,trading',        // Permissions
  timestamp: Date.now(),
  expiration: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
};

// Sign with wallet
const signature = await wallet.signTypedData(
  OFF_CHAIN_DOMAIN,
  { AddOrderlyKey: MESSAGE_TYPES.AddOrderlyKey },
  addKeyMessage
);

// Register key
const res = await fetch('/v1/orderly_key', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: addKeyMessage,
    signature,
    userAddress: await wallet.getAddress()
  })
});`,
      'Register the Orderly key with Orderly Network using EIP-712 signing'
    );
  }

  // Add complete example
  workflow.completeExample = keyCode;

  // Add scope explanation
  workflow.scopeExplanation = {
    read: 'Read account data only',
    'read,trading': 'Read + place/cancel orders',
    'read,asset': 'Read + deposits/withdrawals',
    'read,trading,asset': 'Full access to all operations',
  };

  console.log('   ✅ Enhanced');
}

// 3. Enhance "Place Order via REST API" workflow
function enhancePlaceOrderWorkflow() {
  console.log('🔄 Enhancing: Place Order via REST API');

  const workflow = findWorkflow('place order');
  if (!workflow) {
    console.log('   ⚠️  Workflow not found, skipping');
    return;
  }

  // Enhance authentication step
  const authStepIndex = workflow.steps.findIndex(
    (s) => s.title.toLowerCase().includes('sign') || s.description.toLowerCase().includes('ed25519')
  );

  if (authStepIndex >= 0) {
    workflow.steps[authStepIndex] = enhanceStep(
      workflow.steps[authStepIndex],
      `import { signAsync } from '@noble/ed25519';
import { encodeBase58 } from 'ethers';

// Create message string: timestamp + method + path + body
const timestamp = Date.now();
const message = \`\${timestamp}POST/v1/order\${JSON.stringify(orderBody)}\`;

// Sign with Ed25519 private key
const signatureBytes = await signAsync(
  new TextEncoder().encode(message),
  privateKey
);
const signature = Buffer.from(signatureBytes).toString('base64url');

// Add headers
const headers = {
  'Content-Type': 'application/json',
  'orderly-key': \`ed25519:\${encodeBase58(await getPublicKeyAsync(privateKey))}\`,
  'orderly-signature': signature,
  'orderly-timestamp': timestamp.toString(),
  'orderly-account-id': orderlyAccountId
};`,
      'Sign the request using Ed25519 key for authentication'
    );
  }

  // Add complete signer utility
  workflow.signerUtility = signerCode;

  // Add complete example
  workflow.completeExample = authCode;

  // Add troubleshooting
  if (!workflow.troubleshooting) {
    workflow.troubleshooting = [];
  }
  workflow.troubleshooting.push(
    {
      issue: '401 Unauthorized / Invalid Signature',
      solution:
        'Ensure message format is exactly: {timestamp}{method}{path}{body}. No extra whitespace. Timestamp must be in milliseconds and recent.',
    },
    {
      issue: 'Timestamp too old',
      solution:
        'Generate a fresh timestamp immediately before signing. Timestamps are valid for approximately 1 minute.',
    }
  );

  console.log('   ✅ Enhanced');
}

// 4. Enhance "Withdraw Funds" workflow
function enhanceWithdrawWorkflow() {
  console.log('🔄 Enhancing: Withdraw Funds');

  const workflow = findWorkflow('withdraw');
  if (!workflow) {
    console.log('   ⚠️  Workflow not found, skipping');
    return;
  }

  // Find helper functions for withdraw
  const helpersContent =
    repoAnalysis.helperFunctions.find((h) => h.filename === 'helpers/index.ts')?.content || '';

  // Extract withdraw function if possible
  const withdrawMatch = helpersContent.match(/export async function withdraw\([\s\S]*?^\}/m);
  if (withdrawMatch) {
    workflow.implementationCode = withdrawMatch[0];
  }

  // Enhance signing step
  const signStepIndex = workflow.steps.findIndex(
    (s) => s.title.toLowerCase().includes('sign') || s.description.toLowerCase().includes('eip-712')
  );

  if (signStepIndex >= 0) {
    workflow.steps[signStepIndex] = enhanceStep(
      workflow.steps[signStepIndex],
      `// Withdraw message type
const withdrawMessage = {
  brokerId: 'your_broker_id',
  chainId: 421614,
  receiver: '0x...',        // Destination address
  token: 'USDC',
  amount: 1000000,          // 1 USDC (6 decimals)
  withdrawNonce: nonce,     // From /v1/withdraw_nonce
  timestamp: Date.now()
};

// Sign with wallet (on-chain domain)
const signature = await wallet.signTypedData(
  ON_CHAIN_DOMAIN,         // Different from off-chain domain!
  { Withdraw: MESSAGE_TYPES.Withdraw },
  withdrawMessage
);`,
      'Sign withdrawal request with wallet using EIP-712'
    );
  }

  // Add note about cross-chain withdrawals
  workflow.crossChainNote = `If the vault doesn't have enough USDC on your chain, Orderly will route the withdrawal through a cross-chain bridge. Set allowCrossChainWithdraw: true to enable this.`;

  console.log('   ✅ Enhanced');
}

// 5. Enhance "WebSocket Connection" workflow
function enhanceWebsocketWorkflow() {
  console.log('🔄 Enhancing: WebSocket Connection and Authentication');

  const workflow = findWorkflow('websocket');
  if (!workflow) {
    console.log('   ⚠️  Workflow not found, skipping');
    return;
  }

  // Enhance auth step
  const authStepIndex = workflow.steps.findIndex(
    (s) =>
      s.title.toLowerCase().includes('auth') || s.description.toLowerCase().includes('authenticate')
  );

  if (authStepIndex >= 0) {
    workflow.steps[authStepIndex] = enhanceStep(
      workflow.steps[authStepIndex],
      `// Connect to private WebSocket
const ws = new WebSocket(
  'wss://ws-private-evm.orderly.org/v2/ws/private/stream/{account_id}'
);

// Authenticate
const timestamp = Date.now();
const message = timestamp.toString();
const signatureBytes = await signAsync(
  new TextEncoder().encode(message),
  privateKey
);
const signature = Buffer.from(signatureBytes).toString('base64url');

ws.send(JSON.stringify({
  id: 'auth_1',
  event: 'auth',
  params: {
    orderly_key: 'ed25519:xxx...',
    sign: signature,
    timestamp: timestamp
  }
}));`,
      'Authenticate WebSocket connection using Orderly key'
    );
  }

  // Add subscription example
  workflow.subscriptionExample = `// Subscribe to orderbook
ws.send(JSON.stringify({
  id: 'sub_1',
  event: 'subscribe',
  topic: 'PERP_ETH_USDC@orderbook'
}));

// Subscribe to private execution reports
ws.send(JSON.stringify({
  id: 'sub_2',
  event: 'subscribe',
  topic: 'executionreport'
}));`;

  console.log('   ✅ Enhanced');
}

// 6. Add new workflow for Delegate Signer (Safe/multisig)
function addDelegateSignerWorkflow() {
  console.log('🔄 Adding: Delegate Signer Setup (Safe/Multisig)');

  // Check if it already exists
  const existing = findWorkflow('delegate');
  if (existing) {
    console.log('   ℹ️  Workflow already exists, skipping');
    return;
  }

  const helpersContent =
    repoAnalysis.helperFunctions.find((h) => h.filename === 'helpers/index.ts')?.content || '';

  const newWorkflow = {
    name: 'Delegate Signer Setup (Safe/Multisig)',
    description:
      'Set up a delegate signer for Orderly operations using a Safe multisig or other smart contract wallet',
    prerequisites: [
      'Safe multisig or smart contract wallet deployed',
      'Orderly account registered',
      'Understanding of delegate signer pattern',
    ],
    steps: [
      {
        title: 'Deploy Delegate Contract',
        description: 'Deploy the Orderly delegate signer contract (or use existing Safe)',
        important: ['Contract must support EIP-712 signing'],
      },
      {
        title: 'Announce Delegate Signer',
        description: 'Register the delegate contract with Orderly',
        code:
          helpersContent.match(/export async function announceDelegateSigner\([\s\S]*?^\}/m)?.[0] ||
          'See broker-registration repo for implementation',
      },
      {
        title: 'Create Orderly Key via Delegate',
        description: 'Add an Orderly key using the delegate signer',
        code:
          helpersContent.match(/export async function delegateAddOrderlyKey\([\s\S]*?^\}/m)?.[0] ||
          'See broker-registration repo for implementation',
      },
      {
        title: 'Perform Operations',
        description: 'Use delegate functions for deposits, withdrawals, and settlements',
        code: `// All operations follow similar pattern:
// 1. Get nonce
// 2. Create message
// 3. Sign with delegate
// 4. Send to /v1/delegate_* endpoint`,
      },
    ],
    commonIssues: [
      'Delegate contract must be properly configured with the right signers',
      'All operations require multisig approval before execution',
    ],
    relatedWorkflows: ['Register New Account', 'Generate and Access Orderly Key'],
    source: 'Generated from broker-registration repo',
    isNew: true,
  };

  existingWorkflows.workflows.push(newWorkflow);
  console.log('   ✅ Added new workflow');
}

// Main execution
function main() {
  // Enhance existing workflows
  enhanceRegisterWorkflow();
  enhanceOrderlyKeyWorkflow();
  enhancePlaceOrderWorkflow();
  enhanceWithdrawWorkflow();
  enhanceWebsocketWorkflow();

  // Add new workflows
  addDelegateSignerWorkflow();

  // Update metadata
  const enrichedWorkflows = {
    ...existingWorkflows,
    metadata: {
      ...existingWorkflows.metadata,
      enrichedAt: new Date().toISOString(),
      enrichedFrom: 'OrderlyNetwork/examples and OrderlyNetwork/broker-registration repos',
      totalWorkflows: existingWorkflows.workflows.length,
      enrichmentStats: {
        enhancedWorkflows: 5,
        newWorkflows: 1,
      },
    },
  };

  // Write enriched workflows
  fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(enrichedWorkflows, null, 2));

  console.log('\n✅ Workflows enriched successfully!');
  console.log(`📄 Output: ${WORKFLOWS_FILE}`);
  console.log(`\nSummary:`);
  console.log(`   - Total workflows: ${enrichedWorkflows.metadata.totalWorkflows}`);
  console.log(`   - Enhanced: 5 workflows with implementation code`);
  console.log(`   - New: 1 workflow (Delegate Signer Setup)`);
}

main();
