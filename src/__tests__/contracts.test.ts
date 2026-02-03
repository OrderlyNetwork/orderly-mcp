import { describe, it, expect } from 'vitest';
import { getContractAddresses } from '../tools/contracts.js';

describe('getContractAddresses', () => {
  it('should return all contracts for a chain', async () => {
    const result = await getContractAddresses('arbitrum', 'all', 'mainnet');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Arbitrum Contract Addresses');
    expect(result.content[0].text).toContain('0x816f722424B49Cf1275cc86DA9840Fbd5a6167e9'); // Vault
  });

  it('should return specific contract address', async () => {
    const result = await getContractAddresses('arbitrum', 'USDC', 'mainnet');
    expect(result.content[0].text).toContain('USDC');
    expect(result.content[0].text).toContain('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
  });

  it('should handle invalid chain', async () => {
    const result = await getContractAddresses('invalidchain', 'all', 'mainnet');
    expect(result.content[0].text).toContain('not found');
  });

  it('should handle testnet requests', async () => {
    const result = await getContractAddresses('ethereum', 'USDC', 'testnet');
    expect(result.content[0].text).toContain('testnet');
    expect(result.content[0].text).toContain('11155111'); // Sepolia chain ID
  });
});
