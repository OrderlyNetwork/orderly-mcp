#!/usr/bin/env node

/**
 * analyze_example_dex.js
 *
 * This script analyzes the OrderlyNetwork/example-dex repository to extract
 * chart implementations, DEX components, and UI patterns for building perpetual DEXes.
 *
 * It creates an intermediate JSON file (example_dex_analysis.json) that contains
 * structured data about chart implementations, component patterns, and real-world
 * code examples.
 *
 * Usage:
 *   node scripts/analyze_example_dex.js
 *
 * Prerequisites:
 *   git clone --depth 1 https://github.com/orderlynetwork/example-dex.git /tmp/example-dex
 *
 * Output:
 *   - example_dex_analysis.json (in project root)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Path to cloned example-dex repo
const EXAMPLE_DEX_REPO = process.env.EXAMPLE_DEX_REPO_PATH || '/tmp/example-dex';

console.log('🔍 Analyzing Orderly example-dex repository...\n');

// Check if repo exists
if (!fs.existsSync(EXAMPLE_DEX_REPO)) {
  console.error(`❌ Example DEX repo not found at: ${EXAMPLE_DEX_REPO}`);
  console.error(
    '   Clone it: git clone --depth 1 https://github.com/orderlynetwork/example-dex.git /tmp/example-dex'
  );
  process.exit(1);
}

// Structure to hold extracted data
const analysis = {
  extractedAt: new Date().toISOString(),
  repository: 'https://github.com/orderlynetwork/example-dex',
  description: 'Example DEX built with Orderly Hooks SDK using Remix and React',
  charts: {
    lightweightCharts: [],
    tradingView: [],
    websocketServices: [],
  },
  components: {
    trading: [],
    wallet: [],
    orderManagement: [],
    positionManagement: [],
    account: [],
  },
  hooks: {
    custom: [],
    sdkUsage: [],
  },
  providers: [],
  utils: [],
  patterns: [],
};

// Helper to read file content
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

// Helper to get all TSX/TS files recursively
function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Extract chart components
function extractChartComponents() {
  console.log('📊 Extracting chart implementations...\n');

  const componentsDir = path.join(EXAMPLE_DEX_REPO, 'app/components');

  // Lightweight Chart
  const lightweightChartPath = path.join(componentsDir, 'LightweightChart.tsx');
  const lightweightContent = readFile(lightweightChartPath);
  if (lightweightContent) {
    analysis.charts.lightweightCharts.push({
      filename: 'LightweightChart.tsx',
      description:
        'Custom candlestick chart using lightweight-charts library with Orderly kline data',
      content: lightweightContent,
      keyFeatures: [
        'Fetches historical kline data from Orderly API',
        'Uses lightweight-charts for rendering',
        'Responsive with useResizeObserver',
        'Custom styling and localization',
        'Kline to candlestick data transformation',
      ],
      dependencies: ['lightweight-charts', 'use-resize-observer', '@orderly.network/hooks'],
      imports: [
        'useConfig from @orderly.network/hooks',
        'createChart, IChartApi, ISeriesApi from lightweight-charts',
        'useResizeObserver from use-resize-observer',
      ],
    });
    console.log('   ✅ Extracted: LightweightChart.tsx');
  }

  // TradingView Widget
  const advancedChartPath = path.join(componentsDir, 'AdvancedChart.tsx');
  const advancedContent = readFile(advancedChartPath);
  if (advancedContent) {
    analysis.charts.tradingView.push({
      filename: 'AdvancedChart.tsx',
      description: 'TradingView chart widget integration using @orderly.network/ui-tradingview',
      content: advancedContent,
      keyFeatures: [
        'Uses Orderly TradingviewWidget component',
        'Custom CSS overrides for candle colors',
        'Configurable library path for self-hosted TradingView',
        'Dark theme styling',
      ],
      dependencies: ['@orderly.network/ui-tradingview', '@orderly.network/ui'],
      imports: ['TradingviewWidget from @orderly.network/ui-tradingview'],
    });
    console.log('   ✅ Extracted: AdvancedChart.tsx');
  }

  // WebSocket Service
  const wsServicePath = path.join(EXAMPLE_DEX_REPO, 'app/services/websocket.service.ts');
  const wsContent = readFile(wsServicePath);
  if (wsContent) {
    analysis.charts.websocketServices.push({
      filename: 'websocket.service.ts',
      description: 'WebSocket service for real-time kline and trade data subscriptions',
      content: wsContent,
      keyFeatures: [
        'Singleton pattern for WebSocket management',
        'Kline subscription with multiple timeframes',
        'Trade data subscription',
        'Resolution mapping (1m, 5m, 1h, etc.)',
        'Callback-based data updates',
      ],
      dependencies: ['@orderly.network/net'],
      imports: ['WS from @orderly.network/net'],
      resolutions: [
        '1m',
        '3m',
        '5m',
        '15m',
        '30m',
        '1h',
        '2h',
        '4h',
        '8h',
        '12h',
        '1d',
        '3d',
        '1w',
        '1M',
      ],
    });
    console.log('   ✅ Extracted: websocket.service.ts');
  }
}

// Extract trading components
function extractTradingComponents() {
  console.log('\n🔄 Extracting trading components...\n');

  const componentsDir = path.join(EXAMPLE_DEX_REPO, 'app/components');

  const tradingFiles = [
    {
      file: 'CreateOrder.tsx',
      description: 'Complete order entry form with market/limit/stop/bracket orders',
      category: 'trading',
    },
    {
      file: 'Orderbook.tsx',
      description: 'Real-time orderbook display with depth visualization',
      category: 'trading',
    },
    {
      file: 'SymbolHeader.tsx',
      description: 'Trading pair header with price and 24h stats',
      category: 'trading',
    },
    {
      file: 'SymbolSelection.tsx',
      description: 'Symbol selector dropdown for trading pairs',
      category: 'trading',
    },
  ];

  for (const { file, description, category } of tradingFiles) {
    const filePath = path.join(componentsDir, file);
    const content = readFile(filePath);

    if (content) {
      analysis.components[category].push({
        filename: file,
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

// Extract position and order management components
function extractPositionComponents() {
  console.log('\n📈 Extracting position and order components...\n');

  const componentsDir = path.join(EXAMPLE_DEX_REPO, 'app/components');

  const positionFiles = [
    {
      file: 'Positions.tsx',
      description: 'Open positions table with PnL and liquidation price',
      category: 'positionManagement',
    },
    {
      file: 'UpdatePosition.tsx',
      description: 'Position update modal for adjusting margin/leverage',
      category: 'positionManagement',
    },
    {
      file: 'ClosePosition.tsx',
      description: 'Position close button and confirmation',
      category: 'positionManagement',
    },
    {
      file: 'PendingOrders.tsx',
      description: 'Pending/open orders list',
      category: 'orderManagement',
    },
    {
      file: 'PendingOrder.tsx',
      description: 'Individual pending order item',
      category: 'orderManagement',
    },
    {
      file: 'OrderTabs.tsx',
      description: 'Tab navigation for orders/positions/history',
      category: 'orderManagement',
    },
    {
      file: 'TpSlOrder.tsx',
      description: 'Take Profit / Stop Loss order component',
      category: 'orderManagement',
    },
    {
      file: 'StopOrder.tsx',
      description: 'Stop order component',
      category: 'orderManagement',
    },
  ];

  for (const { file, description, category } of positionFiles) {
    const filePath = path.join(componentsDir, file);
    const content = readFile(filePath);

    if (content) {
      analysis.components[category].push({
        filename: file,
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

// Extract wallet components
function extractWalletComponents() {
  console.log('\n👛 Extracting wallet components...\n');

  const walletDir = path.join(EXAMPLE_DEX_REPO, 'app/components/wallet');

  if (fs.existsSync(walletDir)) {
    const walletFiles = fs.readdirSync(walletDir).filter((f) => f.endsWith('.tsx'));

    for (const file of walletFiles) {
      const filePath = path.join(walletDir, file);
      const content = readFile(filePath);

      if (content) {
        let description = '';
        if (file.includes('Connect')) description = 'Wallet connection button and modal';
        else if (file.includes('Dropdown')) description = 'Chain/account dropdown menu';
        else if (file.includes('Connection')) description = 'Wallet connection state manager';
        else description = `Wallet component: ${file}`;

        analysis.components.wallet.push({
          filename: `wallet/${file}`,
          description,
          content,
          language: 'typescript',
        });
        console.log(`   ✅ Extracted: wallet/${file}`);
      }
    }
  } else {
    console.log('   ⚠️  Wallet components directory not found');
  }
}

// Extract account components
function extractAccountComponents() {
  console.log('\n💰 Extracting account components...\n');

  const componentsDir = path.join(EXAMPLE_DEX_REPO, 'app/components');

  const accountFiles = [
    {
      file: 'Assets.tsx',
      description: 'Account assets and balance display',
    },
    {
      file: 'OrderlyDeposit.tsx',
      description: 'Deposit UI component',
    },
    {
      file: 'OrderlyConnect.tsx',
      description: 'Orderly account connection component',
    },
    {
      file: 'Leverage.tsx',
      description: 'Leverage display component',
    },
    {
      file: 'LeverageEditor.tsx',
      description: 'Leverage adjustment modal',
    },
  ];

  for (const { file, description } of accountFiles) {
    const filePath = path.join(componentsDir, file);
    const content = readFile(filePath);

    if (content) {
      analysis.components.account.push({
        filename: file,
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

// Extract custom hooks
function extractCustomHooks() {
  console.log('\n🪝 Extracting custom hooks...\n');

  const hooksDir = path.join(EXAMPLE_DEX_REPO, 'app/hooks');

  if (fs.existsSync(hooksDir)) {
    const hookFiles = fs.readdirSync(hooksDir).filter((f) => f.endsWith('.ts'));

    for (const file of hookFiles) {
      const filePath = path.join(hooksDir, file);
      const content = readFile(filePath);

      if (content) {
        analysis.hooks.custom.push({
          filename: file,
          description: `Custom hook: ${file.replace('.ts', '')}`,
          content,
          language: 'typescript',
        });
        console.log(`   ✅ Extracted: ${file}`);
      }
    }
  } else {
    console.log('   ⚠️  Hooks directory not found');
  }
}

// Extract providers
function extractProviders() {
  console.log('\n🏗️  Extracting providers...\n');

  const providersDir = path.join(EXAMPLE_DEX_REPO, 'app/providers');

  if (fs.existsSync(providersDir)) {
    const providerFiles = fs.readdirSync(providersDir).filter((f) => f.endsWith('.tsx'));

    for (const file of providerFiles) {
      const filePath = path.join(providersDir, file);
      const content = readFile(filePath);

      if (content) {
        let description = '';
        if (file.includes('Orderly')) description = 'Orderly SDK configuration provider';
        else if (file.includes('Evm')) description = 'EVM wallet provider setup';
        else if (file.includes('Solana')) description = 'Solana wallet provider setup';
        else description = `Provider: ${file}`;

        analysis.providers.push({
          filename: file,
          description,
          content,
          language: 'typescript',
        });
        console.log(`   ✅ Extracted: ${file}`);
      }
    }
  } else {
    console.log('   ⚠️  Providers directory not found');
  }
}

// Extract utility functions
function extractUtils() {
  console.log('\n🛠️  Extracting utilities...\n');

  const utilsDir = path.join(EXAMPLE_DEX_REPO, 'app/utils');

  if (fs.existsSync(utilsDir)) {
    const utilFiles = fs.readdirSync(utilsDir).filter((f) => f.endsWith('.ts'));

    for (const file of utilFiles) {
      const filePath = path.join(utilsDir, file);
      const content = readFile(filePath);

      if (content) {
        analysis.utils.push({
          filename: file,
          description: `Utility functions: ${file.replace('.ts', '')}`,
          content,
          language: 'typescript',
        });
        console.log(`   ✅ Extracted: ${file}`);
      }
    }
  } else {
    console.log('   ⚠️  Utils directory not found');
  }
}

// Extract implementation patterns
function extractPatterns() {
  console.log('\n🔧 Extracting implementation patterns...\n');

  // Pattern 1: Chart Implementation with Lightweight Charts
  analysis.patterns.push({
    name: 'Lightweight Charts Integration',
    description:
      'Implement custom candlestick charts using lightweight-charts library with Orderly data',
    difficulty: 'intermediate',
    category: 'charts',
    steps: [
      'Install lightweight-charts and use-resize-observer',
      'Fetch historical kline data from /tv/history endpoint',
      'Transform Orderly kline format to lightweight-charts format',
      'Create chart instance with custom styling',
      'Handle window resize for responsive charts',
      'Update data when symbol changes',
    ],
    keyCode: `// Transform Orderly klines to candlestick data
const klineToCandlestick = (kline) => ({
  time: kline.t as UTCTimestamp,
  open: kline.o,
  high: kline.h,
  low: kline.l,
  close: kline.c
});

// Create chart
const chart = createChart(container, {
  layout: { background: { color: '#26272a' }, textColor: '#fff' },
  timeScale: { timeVisible: true }
});
const candleStickSeries = chart.addCandlestickSeries();`,
    files: ['LightweightChart.tsx'],
    dependencies: ['lightweight-charts', 'use-resize-observer'],
  });

  // Pattern 2: TradingView Widget Integration
  analysis.patterns.push({
    name: 'TradingView Widget Setup',
    description: 'Integrate professional TradingView charts using Orderly UI components',
    difficulty: 'beginner',
    category: 'charts',
    steps: [
      'Install @orderly.network/ui-tradingview',
      'Import TradingviewWidget component',
      'Configure library path for self-hosted or CDN',
      'Apply custom CSS overrides for theming',
      'Pass symbol prop for dynamic pair switching',
    ],
    keyCode: `import { TradingviewWidget } from '@orderly.network/ui-tradingview';

<TradingviewWidget
  symbol={symbol}
  libraryPath="/tradingview/charting_library/bundles"
  overrides={{
    'mainSeriesProperties.candleStyle.upColor': '#1F8040',
    'mainSeriesProperties.candleStyle.downColor': '#DC2140',
    'paneProperties.background': '#101418'
  }}
/>`,
    files: ['AdvancedChart.tsx'],
    dependencies: ['@orderly.network/ui-tradingview'],
  });

  // Pattern 3: Real-time Orderbook
  analysis.patterns.push({
    name: 'Real-time Orderbook Display',
    description: 'Display live orderbook with depth visualization using useOrderbookStream',
    difficulty: 'intermediate',
    category: 'trading',
    steps: [
      'Use useOrderbookStream hook with symbol and level parameters',
      'Get symbol info for decimal precision',
      'Format prices and quantities with proper decimals',
      'Render asks (sell) in descending order',
      'Render bids (buy) in ascending order',
      'Add depth visualization with gradient backgrounds',
    ],
    keyCode: `const [data, { isLoading }] = useOrderbookStream(symbol, undefined, { level: 10 });
const symbolsInfo = useSymbolsInfo();
const symbolInfo = symbolsInfo[symbol]();
const [baseDecimals, quoteDecimals] = getDecimalsFromTick(symbolInfo);

// Render with depth visualization
<div style={{
  background: \`linear-gradient(to left, rgba(161, 6, 6, 0.3) \${gradient}%, transparent \${gradient}%)\`
}}>
  {baseFormatter.format(aggregated)}
</div>`,
    files: ['Orderbook.tsx'],
    dependencies: ['@orderly.network/hooks'],
  });

  // Pattern 4: Order Entry Form
  analysis.patterns.push({
    name: 'Complete Order Entry Form',
    description: 'Build a comprehensive order entry form with validation and order types',
    difficulty: 'advanced',
    category: 'trading',
    steps: [
      'Use useOrderEntry hook for form state management',
      'Support multiple order types (Market, Limit, Stop, Bracket)',
      'Implement Long/Short side toggle',
      'Add price and quantity inputs with validation',
      'Display estimated leverage and liquidation price',
      'Handle form submission with error handling',
    ],
    keyCode: `const {
  submit,
  setValue,
  maxQty,
  estLeverage,
  estLiqPrice,
  formattedOrder,
  metaState: { errors, dirty, submitted },
  reset
} = useOrderEntry(symbol, {
  initialOrder: {
    side: OrderSide.BUY,
    order_type: OrderType.LIMIT,
    order_price: '',
    order_quantity: ''
  }
});`,
    files: ['CreateOrder.tsx'],
    dependencies: ['@orderly.network/hooks', '@orderly.network/types'],
  });

  // Pattern 5: Position Management
  analysis.patterns.push({
    name: 'Position Display and Management',
    description: 'Display open positions with real-time PnL updates',
    difficulty: 'intermediate',
    category: 'positions',
    steps: [
      'Use usePositionStream for real-time position data',
      'Display position direction (Long/Short)',
      'Show quantity, average open price, mark price',
      'Calculate and display unrealized PnL and ROI',
      'Add position update and close functionality',
    ],
    keyCode: `const [positions, _info, { isLoading }] = usePositionStream(showAll ? undefined : symbol);

// Display position
<Table.Row key={position.symbol}>
  <Table.Cell>
    {position.position_qty > 0 ? <Badge color="green">Long</Badge> : <Badge color="red">Short</Badge>}
  </Table.Cell>
  <Table.Cell>{usdFormatter.format(position.unrealized_pnl)}</Table.Cell>
  <Table.Cell>{usdFormatter.format(position.unrealized_pnl_ROI * 100)}%</Table.Cell>
</Table.Row>`,
    files: ['Positions.tsx', 'UpdatePosition.tsx', 'ClosePosition.tsx'],
    dependencies: ['@orderly.network/hooks'],
  });

  // Pattern 6: Wallet Connection
  analysis.patterns.push({
    name: 'Multi-Chain Wallet Connection',
    description: 'Support both EVM and Solana wallets with Orderly SDK',
    difficulty: 'intermediate',
    category: 'wallet',
    steps: [
      'Setup OrderlyConfigProvider with wallet adapters',
      'Configure DefaultEVMWalletAdapter and DefaultSolanaWalletAdapter',
      'Use useAccount hook for connection state',
      'Implement connect/disconnect functionality',
      'Handle network switching between testnet/mainnet',
    ],
    keyCode: `<OrderlyConfigProvider
  networkId={isTestnet ? 'testnet' : 'mainnet'}
  brokerId={import.meta.env.VITE_BROKER_ID}
  walletAdapters={[
    new DefaultEVMWalletAdapter(new EthersProvider()),
    new DefaultSolanaWalletAdapter()
  ]}
>
  {children}
</OrderlyConfigProvider>`,
    files: ['OrderlyProvider.tsx', 'EvmProvider.tsx', 'SolanaProvider.tsx'],
    dependencies: [
      '@orderly.network/hooks',
      '@orderly.network/default-evm-adapter',
      '@orderly.network/default-solana-adapter',
    ],
  });

  // Pattern 7: WebSocket Kline Subscription
  analysis.patterns.push({
    name: 'Real-time Kline Data via WebSocket',
    description: 'Subscribe to real-time candlestick updates using Orderly WebSocket',
    difficulty: 'advanced',
    category: 'charts',
    steps: [
      'Create WebSocket service using @orderly.network/net',
      'Implement singleton pattern for connection management',
      'Subscribe to kline topics with different resolutions',
      'Handle incoming data with callback pattern',
      'Map TradingView resolutions to Orderly timeframes',
      'Unsubscribe on component unmount',
    ],
    keyCode: `const unsub = wsInstance?.subscribe(
  {
    event: 'subscribe',
    topic: \`\${symbol}@kline_\${time}\`,
    id: \`\${symbol}@kline_\${time}\`,
    ts: new Date().getTime()
  },
  {
    onMessage: (data) => {
      const { open, close, high, low, volume, startTime } = data;
      updateKline(key, { time: startTime, close, open, high, low, volume });
    }
  }
);`,
    files: ['websocket.service.ts'],
    dependencies: ['@orderly.network/net'],
  });

  console.log('   ✅ Extracted 7 implementation patterns');
}

// Main execution
function main() {
  console.log(`📂 Using repo: ${EXAMPLE_DEX_REPO}\n`);

  // Extract all data
  extractChartComponents();
  extractTradingComponents();
  extractPositionComponents();
  extractWalletComponents();
  extractAccountComponents();
  extractCustomHooks();
  extractProviders();
  extractUtils();
  extractPatterns();

  // Write analysis file
  const outputPath = path.join(projectRoot, 'example_dex_analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

  console.log(`\n✅ Analysis complete!`);
  console.log(`📄 Output: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(
    `   - Chart components: ${analysis.charts.lightweightCharts.length + analysis.charts.tradingView.length}`
  );
  console.log(`   - WebSocket services: ${analysis.charts.websocketServices.length}`);
  console.log(`   - Trading components: ${analysis.components.trading.length}`);
  console.log(`   - Position components: ${analysis.components.positionManagement.length}`);
  console.log(`   - Order components: ${analysis.components.orderManagement.length}`);
  console.log(`   - Wallet components: ${analysis.components.wallet.length}`);
  console.log(`   - Account components: ${analysis.components.account.length}`);
  console.log(`   - Custom hooks: ${analysis.hooks.custom.length}`);
  console.log(`   - Providers: ${analysis.providers.length}`);
  console.log(`   - Utilities: ${analysis.utils.length}`);
  console.log(`   - Implementation patterns: ${analysis.patterns.length}`);
  console.log(`\nNext: Run generate_mcp_data.js to incorporate this into the MCP server data`);
}

main();
