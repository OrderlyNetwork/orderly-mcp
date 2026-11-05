import { describe, it, expect, beforeEach } from 'vitest';
import { explainWorkflow, clearWorkflowCache } from '../tools/workflows.js';

describe('explainWorkflow', () => {
  beforeEach(() => {
    clearWorkflowCache();
  });

  it('should find workflow by kebab-case query', async () => {
    // "wallet-connection" → tokens: wallet, connection
    const result = await explainWorkflow('wallet-connection');
    const text = result.content[0].text;
    expect(text).not.toContain('not found');
    // Should match a wallet-related workflow
    expect(text.toLowerCase()).toContain('wallet');
  });

  it('should find workflow by natural language query', async () => {
    const result = await explainWorkflow('how to set up react sdk');
    const text = result.content[0].text;
    expect(text).not.toContain('not found');
  });

  it('should find workflow by deposit query', async () => {
    const result = await explainWorkflow('deposit-withdraw');
    const text = result.content[0].text;
    expect(text).not.toContain('not found');
  });

  it('should find workflow by single keyword', async () => {
    const result = await explainWorkflow('websocket');
    const text = result.content[0].text;
    expect(text).not.toContain('not found');
    expect(text.toLowerCase()).toContain('websocket');
  });

  it('should find workflow by exact full name', async () => {
    const result = await explainWorkflow('Setting Up the Orderly React SDK with Wallet Connection');
    const text = result.content[0].text;
    expect(text).not.toContain('not found');
    expect(text).toContain('Setting Up the Orderly React SDK with Wallet Connection');
  });

  it('should return available list for truly unmatched queries', async () => {
    const result = await explainWorkflow('zzzqqqxxx12345nonexistent');
    expect(result.content[0].text).toContain('not found');
    expect(result.content[0].text).toContain('Available workflows');
  });

  it('should handle empty query', async () => {
    const result = await explainWorkflow('');
    expect(result.content[0].text).toBe('Please provide a workflow name to search for.');
  });

  it('should reject queries with only stopwords', async () => {
    const result = await explainWorkflow('the and of');
    expect(result.content[0].text).toContain('contained only common words');
  });

  // --- Ranking regressions -------------------------------------------------
  it('should route "set tp sl" to the TP/SL workflow', async () => {
    const result = await explainWorkflow('set tp sl');
    const text = result.content[0].text;
    expect(text).toContain('Take Profit');
    expect(text).toContain('Stop Loss');
  });

  it('should not answer "place first order" with the builders-page listing', async () => {
    const result = await explainWorkflow('place first order');
    const text = result.content[0].text;
    expect(text.split('\n')[0]).not.toContain('Getting Listed');
    expect(text.toLowerCase()).toContain('order');
  });

  it('should prioritize an exact workflow name token over fuzzy matches', async () => {
    const result = await explainWorkflow('wallet connection');
    expect(result.content[0].text.split('\n')[0]).toContain('Wallet Connection');
  });

  it('should route "deposit" to the deposit workflow, not the vault workflow', async () => {
    const result = await explainWorkflow('deposit');
    const title = result.content[0].text.split('\n')[0];
    expect(title).toContain('Deposit Funds into an Orderly Account');
    expect(title).not.toContain('Vault');
  });

  it('should route "withdraw" to the withdrawal workflow', async () => {
    const result = await explainWorkflow('withdraw');
    expect(result.content[0].text.split('\n')[0]).toContain('Withdraw Funds from Orderly');
  });

  it('should route "place first order" to the limit-order workflow', async () => {
    const result = await explainWorkflow('place first order');
    expect(result.content[0].text.split('\n')[0]).toContain('Place and Manage a Limit Order');
  });

  it('should document the testnet faucet on the operator domain', async () => {
    const result = await explainWorkflow('Testing with USDC Faucet on Arbitrum Sepolia Testnet');
    const text = result.content[0].text;
    expect(text).toContain('https://testnet-operator-evm.orderly.org/v1/faucet/usdc');
    expect(text).toContain("method: 'POST'");
    expect(text).not.toContain('GET /v1/public/faucet');
  });
});
