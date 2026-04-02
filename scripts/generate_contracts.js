#!/usr/bin/env node

/**
 * generate_contracts.js
 *
 * Parses the addresses.mdx file from Orderly Network's documentation repo
 * to extract smart contract addresses and generates src/data/contracts.json
 *
 * Usage:
 *   node scripts/generate_contracts.js
 *
 * Source:
 *   https://raw.githubusercontent.com/OrderlyNetwork/documentation-public/refs/heads/main/build-on-omnichain/addresses.mdx
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const MDX_URL =
  'https://raw.githubusercontent.com/OrderlyNetwork/documentation-public/refs/heads/main/build-on-omnichain/addresses.mdx';
const LOCAL_FALLBACK = path.join(projectRoot, 'addresses.mdx');
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'contracts.json');

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
  'USDC Mint': 'USDC Mint contract',
  Ledger:
    'Ledger contract (verifyingContract) for EIP-712 on-chain domain. Used for withdrawals, internal transfers, and settle PnL.',
  LedgerProxyAdmin: 'LedgerProxyAdmin contract',
  OperatorManager: 'OperatorManager contract',
  VaultManager: 'VaultManager contract',
  LedgerCrossChainManager: 'LedgerCrossChainManager contract',
  LedgerCrossChainRelay: 'LedgerCrossChainRelay contract',
};

function normalizeChainName(name) {
  const lower = name.toLowerCase().trim();
  if (lower.includes('bnb')) return 'bsc';
  if (lower.includes('orderly l2') || lower.includes('orderly l2')) return 'orderlyL2';

  for (const chain of Object.keys(CHAIN_IDS)) {
    if (lower === chain.toLowerCase() || lower.includes(chain.toLowerCase())) {
      return chain;
    }
  }

  return lower.replace(/\s+/g, '');
}

function stripYamlFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function parseContracts(content) {
  const contracts = {};

  const cleaned = stripYamlFrontmatter(content);

  const chainSections = cleaned.split(/\n## /).slice(1);

  for (const chainSection of chainSections) {
    const headerLine = chainSection.split('\n')[0].trim();
    if (!headerLine) continue;

    const normalizedChain = normalizeChainName(headerLine);

    if (!CHAIN_IDS[normalizedChain]) {
      console.warn(`⚠️ Unknown chain: ${headerLine} (normalized: ${normalizedChain}), skipping...`);
      continue;
    }

    console.log(`📋 Processing ${headerLine}...`);

    const tableStart = chainSection.indexOf('| Contract Name');
    if (tableStart === -1) {
      console.warn(`⚠️ No contract table found for ${headerLine}, skipping...`);
      continue;
    }

    const tableSection = chainSection.substring(tableStart);
    const rows = tableSection
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.includes('---'));

    const dataRows = rows.slice(1);
    const chainContracts = {};

    for (const row of dataRows) {
      const cells = row
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell);
      if (cells.length < 2) continue;

      const rawName = cells[0];
      const mainnetAddr = cells[1] || null;
      const testnetAddr = cells[2] || null;

      const cleanMainnet = mainnetAddr && mainnetAddr !== '' ? mainnetAddr : null;
      const cleanTestnet = testnetAddr && testnetAddr !== '' ? testnetAddr : null;

      if (!cleanMainnet && !cleanTestnet) continue;

      const contractKey = rawName.replace(/\s+/g, '').replace(/[()]/g, '');

      chainContracts[contractKey] = {
        mainnet: cleanMainnet,
        testnet: cleanTestnet,
        description: CONTRACT_DESCRIPTIONS[rawName] || `${rawName} contract`,
      };
    }

    if (Object.keys(chainContracts).length > 0) {
      const entry = {
        chainId: CHAIN_IDS[normalizedChain].mainnet,
        testnetChainId: CHAIN_IDS[normalizedChain].testnet,
        contracts: chainContracts,
      };

      if (normalizedChain === 'orderlyL2') {
        entry.description =
          'Orderly L2 is the internal chain where the Ledger contract lives. The Ledger contract (verifyingContract) is used for EIP-712 signatures for on-chain operations: withdrawals, internal transfers, and settle PnL. There is only ONE Ledger contract per network (mainnet/testnet). Vault contracts are on each supported EVM chain.';
      }

      contracts[normalizedChain] = entry;
      console.log(`   ✅ Found ${Object.keys(chainContracts).length} contracts`);
    }
  }

  return contracts;
}

async function main() {
  console.log('🏗️ Generating contracts.json from addresses.mdx\n');

  let content;

  try {
    console.log('🌐 Fetching addresses.mdx from GitHub...');
    content = await fetchUrl(MDX_URL);
    console.log('   ✅ Downloaded successfully\n');
  } catch (err) {
    console.warn(`⚠️ Failed to fetch from GitHub: ${err.message}`);
    if (fs.existsSync(LOCAL_FALLBACK)) {
      console.log('📖 Falling back to local addresses.mdx...');
      content = fs.readFileSync(LOCAL_FALLBACK, 'utf-8');
    } else {
      console.error(`❌ No local fallback found at ${LOCAL_FALLBACK}`);
      console.error('   Download manually:');
      console.error(`   curl -o addresses.mdx "${MDX_URL}"`);
      process.exit(1);
    }
  }

  console.log('🔍 Parsing contract addresses...\n');
  const contracts = parseContracts(content);

  const output = {
    ...contracts,
    _metadata: {
      generatedAt: new Date().toISOString(),
      source: MDX_URL,
      totalChains: Object.keys(contracts).length,
    },
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

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
