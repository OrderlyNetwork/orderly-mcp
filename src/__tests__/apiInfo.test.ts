import { describe, it, expect, beforeEach } from 'vitest';
import { clearApiInfoCache, getApiInfo } from '../tools/apiInfo.js';

function textOf(result: Awaited<ReturnType<typeof getApiInfo>>): string {
  return result.content.map((part) => part.text).join('\n');
}

describe('getApiInfo REST endpoint resolution', () => {
  beforeEach(() => {
    clearApiInfoCache();
  });

  it('returns every method registered on an exact path', async () => {
    const text = textOf(await getApiInfo('rest', '/v1/order'));
    expect(text).toContain('# POST /v1/order');
    expect(text).toContain('# DELETE /v1/order');
    expect(text).toContain('# PUT /v1/order');
  });

  it('documents the testnet faucet on the operator domain', async () => {
    const text = textOf(await getApiInfo('rest', '/v1/faucet/usdc'));
    expect(text).toContain('# POST /v1/faucet/usdc');
    expect(text).toContain('**Base URL:** https://testnet-operator-evm.orderly.org');
    expect(text).toContain('**Summary:** Request testnet faucet USDC');
    expect(text).toContain('https://testnet-operator-evm.orderly.org/v1/faucet/usdc');
    expect(text).toContain('https://testnet-operator-sol.orderly.org/v1/faucet/usdc');
    expect(text).toContain('Required for EVM; omit for Solana');
    expect(text).toContain('## Request Body');
    expect(text).not.toContain('## Request Body (optional)');
    expect(text).toContain("method: 'POST'");
    expect(text).not.toContain("const url = 'https://api.orderly.org/v1/faucet/usdc'");
  });

  it('shows per-endpoint base URL overrides in the endpoint index', async () => {
    const text = textOf(await getApiInfo('rest'));
    expect(text).toContain(
      '**POST /v1/faucet/usdc** — Request testnet faucet USDC [base: https://testnet-operator-evm.orderly.org]'
    );
  });

  it('filters by an explicit method prefix', async () => {
    const text = textOf(await getApiInfo('rest', 'POST /v1/order'));
    expect(text).toContain('# POST /v1/order');
    expect(text).toContain('Create order');
    expect(text).not.toContain('# DELETE /v1/order');
    expect(text).not.toContain('/v1/orderly_key');
  });

  it('resolves natural-language endpoint intent through summaries', async () => {
    const text = textOf(await getApiInfo('rest', 'create order'));
    expect(text).toContain('# POST /v1/order');
    expect(text).not.toContain('# DELETE /v1/order');
  });

  it('does not fuzzy-match a symbol path when an exact path exists', async () => {
    const text = textOf(await getApiInfo('rest', '/v1/positions'));
    expect(text).toContain('# GET /v1/positions');
    expect(text).not.toContain('/v1/position/{symbol}');
  });

  it('reports available methods when the requested method is absent', async () => {
    const text = textOf(await getApiInfo('rest', 'GET /v1/order'));
    expect(text).toContain('Available methods');
    expect(text).toContain('POST');
  });

  it('keeps the endpoint index compact by using summaries', async () => {
    const text = textOf(await getApiInfo('rest'));
    expect(text).toContain('# REST API Endpoints');
    expect(text).toContain('POST /v1/order');
    expect(text.length).toBeLessThan(30000);
  });

  it('still reports unknown endpoint paths', async () => {
    const text = textOf(await getApiInfo('rest', '/v1/not-a-real-endpoint'));
    expect(text).toContain('not found');
  });
});

describe('getApiInfo WebSocket resolution', () => {
  beforeEach(() => {
    clearApiInfoCache();
  });

  it('returns a stream by topic name', async () => {
    const text = textOf(await getApiInfo('websocket', 'executionreport'));
    expect(text).toContain('executionreport');
    expect(text).toContain('Authentication');
  });

  it('lists streams with base URLs', async () => {
    const text = textOf(await getApiInfo('websocket'));
    expect(text).toContain('wss://ws.orderly.org');
    expect(text).toContain('orderbook');
    expect(text).toContain('bbos');
    expect(text).toContain('{symbol}@bbo');
    expect(text).toContain('{symbol}@orderbookupdate');
  });

  it('returns public market-data streams by topic', async () => {
    const bbos = textOf(await getApiInfo('websocket', 'bbos'));
    expect(bbos).toContain('bbos');
    expect(bbos).toContain('every live symbol');

    const obu = textOf(await getApiInfo('websocket', 'orderbookupdate'));
    expect(obu).toContain('orderbookupdate');
    expect(obu).toContain('down_asks');
  });

  it('lists every public market-data topic', async () => {
    const text = textOf(await getApiInfo('websocket'));
    const topics = [
      '{symbol}@bbo',
      'bbos',
      '{symbol}@orderbookupdate',
      '{symbol}@trade',
      'price_changes',
      'markprices',
      'indexprices',
      '{symbol}@kline_{time}',
      '{symbol}@openinterest',
      '{symbol}@estfundingrate',
    ];
    for (const topic of topics) {
      expect(text, topic).toContain(topic);
    }
  });

  it('accepts a lowercase method prefix', async () => {
    const text = textOf(await getApiInfo('rest', 'post /v1/order'));
    expect(text).toContain('# POST /v1/order');
    expect(text).not.toContain('# DELETE /v1/order');
  });

  it('applies a method filter to fuzzy path queries', async () => {
    const text = textOf(await getApiInfo('rest', 'POST create order'));
    expect(text).toContain('# POST /v1/order');
    expect(text).not.toContain('# DELETE /v1/order');
  });
});
