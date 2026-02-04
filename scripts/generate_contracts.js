#!/usr/bin/env node

/**
 * generate_contracts.js
 *
 * Parses llms-full.txt to extract smart contract addresses
 * and generates src/data/contracts.json
 *
 * Usage:
 *   node scripts/generate_contracts.js
 *
 * Prerequisites:
 *   - llms-full.txt in project root (download from https://orderly.network/docs/llms-full.txt)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const INPUT_FILE = path.join(projectRoot, 'llms-full.txt');
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'contracts.json');

// Chain ID mapping
const CHAIN_IDS = {
  arbitrum: { mainnet: 42161, testnet: 421614 },
  optimism: { mainnet: 10, testnet: 11155420 },
  base: { mainnet: 8453, testnet: 84532 },
  mantle: { mainnet: 5000, testnet: 5003 },
  ethereum: { mainnet: 1, testnet: 11155111 },
  sei: { mainnet: 1329, testnet: null },
  avalanche: { mainnet: 43114, testnet: 43113 },
  morph: { mainnet: 2818, testnet: 2810 },
  sonic: { mainnet: 146, testnet: 57054 },
  monad: { mainnet: 143, testnet: 10143 },
  bera: { mainnet: 80094, testnet: null },
  story: { mainnet: 1514, testnet: null },
  mode: { mainnet: 34443, testnet: null },
  plume: { mainnet: 98865, testnet: null },
  abstract: { mainnet: 2741, testnet: 11124 },
  bsc: { mainnet: 56, testnet: 97 },
  solana: { mainnet: null, testnet: null },
  orderlyL2: { mainnet: 291, testnet: 4460 },
};

// Chain name normalization
function normalizeChainName(name) {
  const lower = name.toLowerCase().trim();
  if (lower.includes('bnb')) return 'bsc';
  if (lower.includes('orderly l2')) return 'orderlyL2';

  // Try to match directly
  for (const chain of Object.keys(CHAIN_IDS)) {
    if (lower === chain.toLowerCase() || lower.includes(chain.toLowerCase())) {
      return chain;
    }
  }

  return lower.replace(/\s+/g, '');
}

// Contract descriptions
const CONTRACT_DESCRIPTIONS = {
  USDC: 'USDC token contract',
  USDT: 'USDT token contract',
  'USDC.e': 'Bridged USDC token contract',
  YUSD: 'YUSD stablecoin contract',
  WBTC: 'Wrapped Bitcoin contract',
  USD1: 'USD1 stablecoin contract',
  Vault: 'Orderly Vault contract for deposits and withdrawals',
  VaultProxyAdmin: 'Proxy admin for vault upgrades',
  VaultCrossChainManager: 'Manages cross-chain vault operations',
  CrossChainRelay: 'Cross-chain message relay',
  'SolConnector(PeerAddress)': 'Solana connector contract (PeerAddress)',
  'Solana-Vault': 'Orderly Vault on Solana',
  'Vault Authority': 'Authority for Solana vault operations',
  'OAPP Config': 'OAPP configuration contract',
  Nonce: 'Nonce management contract',
  Peer: 'Peer contract for cross-chain communication',
  'Vault USDC Account': 'USDC account for Solana vault',
  'Lookup Table': 'Address lookup table',
  'Orderly Vault': 'Orderly Vault contract on Orderly L2',
  'Orderly Vault Proxy Admin': 'Proxy admin for Orderly L2 vault',
  'Orderly Vault Implementation': 'Implementation contract for Orderly L2 vault',
  'Orderly USDC': 'USDC token on Orderly L2',
  'Orderly WETH': 'WETH token on Orderly L2',
  'Orderly WBTC': 'WBTC token on Orderly L2',
  'Orderly USDT': 'USDT token on Orderly L2',
  'Orderly Vault Cross Chain Manager': 'Cross-chain manager for Orderly L2',
  'Orderly Cross Chain Relay': 'Cross-chain relay for Orderly L2',
};

function parseContracts(content) {
  const contracts = {};

  // Find the Smart Contract Addresses section
  const startIdx = content.indexOf('# Smart Contract Addresses');
  const endIdx = content.indexOf('# System Overview');

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not find Smart Contract Addresses section in llms-full.txt');
  }

  const section = content.substring(startIdx, endIdx);

  // Split by chain headers (## ChainName)
  const chainSections = section.split(/\n## /).slice(1);

  for (const chainSection of chainSections) {
    const lines = chainSection.split('\n');
    const chainHeader = lines[0].trim();

    // Normalize chain name
    const normalizedChain = normalizeChainName(chainHeader);

    if (!CHAIN_IDS[normalizedChain]) {
      console.warn(
        `⚠️ Unknown chain: ${chainHeader} (normalized: ${normalizedChain}), skipping...`
      );
      continue;
    }

    console.log(`📋 Processing ${chainHeader}...`);

    // Find the table in this section
    const tableStart = chainSection.indexOf('| Contract Name');
    if (tableStart === -1) {
      console.warn(`⚠️ No contract table found for ${chainHeader}, skipping...`);
      continue;
    }

    // Extract table rows
    const tableSection = chainSection.substring(tableStart);
    const rows = tableSection
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.includes('---'));

    // Skip header row
    const dataRows = rows.slice(1);

    const chainContracts = {};

    for (const row of dataRows) {
      // Parse table cells
      const cells = row
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell);
      if (cells.length < 2) continue;

      const [contractName, mainnetAddr, testnetAddr] = cells;

      // Clean up addresses (remove empty or placeholder values)
      const cleanMainnet = mainnetAddr && mainnetAddr !== '' ? mainnetAddr : null;
      const cleanTestnet = testnetAddr && testnetAddr !== '' ? testnetAddr : null;

      if (!cleanMainnet && !cleanTestnet) continue;

      // Normalize contract name for key
      const contractKey = contractName.replace(/\s+/g, '').replace(/[()]/g, '');

      chainContracts[contractKey] = {
        mainnet: cleanMainnet,
        testnet: cleanTestnet,
        description: CONTRACT_DESCRIPTIONS[contractName] || `${contractName} contract`,
      };
    }

    if (Object.keys(chainContracts).length > 0) {
      contracts[normalizedChain] = {
        chainId: CHAIN_IDS[normalizedChain].mainnet,
        testnetChainId: CHAIN_IDS[normalizedChain].testnet,
        contracts: chainContracts,
      };

      console.log(`   ✅ Found ${Object.keys(chainContracts).length} contracts`);
    }
  }

  return contracts;
}

function main() {
  console.log('🏗️ Generating contracts.json from llms-full.txt\n');

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error(
      '   Download it with: curl -o llms-full.txt https://orderly.network/docs/llms-full.txt'
    );
    process.exit(1);
  }

  // Read input file
  console.log('📖 Reading llms-full.txt...');
  const content = fs.readFileSync(INPUT_FILE, 'utf-8');

  // Parse contracts
  console.log('\n🔍 Parsing contract addresses...\n');
  const contracts = parseContracts(content);

  // Create output
  const output = {
    ...contracts,
    _metadata: {
      generatedAt: new Date().toISOString(),
      source: 'llms-full.txt',
      totalChains: Object.keys(contracts).length,
    },
  };

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\n✅ Successfully generated contracts.json`);
  console.log(`   📄 Output: ${OUTPUT_FILE}`);
  console.log(`   📊 Chains: ${Object.keys(contracts).length}`);
  console.log(
    `   🔗 Total contracts: ${Object.values(contracts).reduce(
      (sum, chain) => sum + Object.keys(chain.contracts).length,
      0
    )}`
  );
  console.log('\n🎉 Done! Run `yarn build` to compile the changes.');
}

main();
