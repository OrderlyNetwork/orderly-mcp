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
  });
});
