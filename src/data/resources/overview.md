# Orderly Network Overview

Orderly Network is an omnichain perpetual futures infrastructure that enables developers to build DeFi trading applications with shared liquidity across multiple blockchains.

## Core Value Proposition

- **Shared Liquidity**: Traders on any chain trade against a unified orderbook
- **No Bridging Required**: Users stay on their preferred chain for deposits/withdrawals
- **Low Latency CLOB**: Centralized matching engine with decentralized custody
- **Multi-Chain Support**: 15+ supported chains including EVM and Solana

## Architecture

### Three-Layer Architecture

1. **Asset Layer**
   - Resides on each supported chain
   - Manages deposits, withdrawals, and token custody
   - Vault contracts hold user funds
   - Cross-chain messaging synchronizes state

2. **Settlement Layer**
   - Orderly L2 (Chain ID: 291)
   - Acts as transaction ledger
   - Users don't interact directly
   - Handles trade settlement and position tracking

3. **Engine Layer**
   - High-performance matching engine
   - CLOB (Central Limit Orderbook) with price-time priority
   - Sub-100ms latency
   - Supports advanced order types

## Key Concepts

### Vault System

The Orderly Vault is a cross-chain custody system:

- Users deposit into vault on their chain
- Balance becomes available for trading immediately
- Withdrawals processed back to any supported chain
- Uses LayerZero for cross-chain messaging

### Order Types

- **Market Orders**: Immediate execution at best available price
- **Limit Orders**: Execution at specified price or better
- **Stop Orders**: Triggered when price reaches threshold
- **Scaled Orders**: Multiple limit orders at different price levels
- **Trailing Stop**: Dynamic stop that follows price movement
- **Bracket Orders**: Entry with attached TP/SL

### Margin & Leverage

- **IMR (Initial Margin Requirement)**: Required to open position
- **MMR (Maintenance Margin Requirement)**: Minimum to maintain position
- **Leverage**: Up to 50x depending on symbol
- **Position Limits**: Based on leverage and IMR factors

### Funding Rates

- 8-hour funding intervals
- Calculated from premium + interest rate
- Longs pay shorts when positive, vice versa when negative
- Keeps perpetual prices aligned with spot

## Supported Chains

### EVM Chains

- Ethereum (1)
- Arbitrum (42161)
- Optimism (10)
- Base (8453)
- Mantle (5000)
- Polygon, Avalanche, Scroll, Linea, and more

### Non-EVM

- Solana (900900900)

## Developer Resources

### SDK Packages

Core packages for building:

- `@orderly.network/hooks` - React hooks (useOrderEntry, usePositionStream, etc.)
- `@orderly.network/core` - Account and transaction management
- `@orderly.network/types` - TypeScript definitions
- `@orderly.network/ui-*` - Pre-built components (optional)

### API Endpoints

**Mainnet**: https://api.orderly.org
**Testnet**: https://testnet-api.orderly.org

**WebSocket Mainnet**: wss://ws.orderly.org/ws/stream
**WebSocket Testnet**: wss://testnet-ws.orderly.org/ws/stream

### Authentication

All private endpoints use Ed25519 signature authentication:

1. Generate or add Ed25519 key pair
2. Sign requests with private key
3. Include signature in headers

## Getting Started

1. **Get Broker ID**: Contact Orderly team for integration
2. **Install SDK**: `npm install @orderly.network/hooks`
3. **Configure Provider**: Wrap app with OrderlyConfigProvider
4. **Connect Wallet**: Use useWalletConnector and useAccount
5. **Start Trading**: Use useOrderEntry for orders

## Important Links

- **Documentation**: https://orderly.network/docs
- **SDK Repository**: https://github.com/OrderlyNetwork/js-sdk
- **Contract ABIs**: https://github.com/OrderlyNetwork/contract-evm-abi
- **Explorer**: https://explorer.orderly.network
