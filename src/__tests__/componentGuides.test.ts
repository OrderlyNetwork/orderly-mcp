import { beforeEach, describe, expect, it } from 'vitest';
import { clearComponentGuideCache, getComponentGuide } from '../tools/componentGuides.js';

async function guide(component: string, complexity = 'standard'): Promise<string> {
  const result = await getComponentGuide(component, complexity);
  return result.content[0].text;
}

function codeOf(text: string): string {
  const match = text.match(/```tsx\n([\s\S]*?)```/);
  return match?.[1] ?? '';
}

describe('getComponentGuide curated guides', () => {
  beforeEach(() => {
    clearComponentGuideCache();
  });

  it('returns the TradingPage guide', async () => {
    const text = await guide('trading page');
    expect(text).toContain('# Building a TradingPage');
    expect(text).toContain('tradingViewConfig');
    expect(text).toContain('PERP_ETH_USDC');
  });

  it('returns the OrderBook guide', async () => {
    const text = await guide('orderbook');
    expect(text).toContain('# Building a OrderBook');
    expect(text).toContain('OrderBookWidget');
    expect(text).toContain('PERP_ETH_USDC');
  });

  it('uses the real useOrderEntry return shape', async () => {
    const text = await guide('order entry', 'advanced');
    const code = codeOf(text);
    expect(code).toContain('useOrderEntry');
    expect(code).toContain('setValue');
    expect(code).toContain('metaState');
    expect(code).not.toContain('submitOrder');
    expect(code).not.toContain('orderState');
  });

  it('returns PositionsWidget with real props', async () => {
    const text = await guide('positions');
    expect(text).toContain('PositionsWidget');
    expect(text).toContain('onSymbolChange');
    expect(text).not.toContain('import { Positions }');
    expect(text).not.toContain('closePosition');
  });

  it('returns a WalletConnectorWidget guide without legacy packages', async () => {
    const text = await guide('wallet connector');
    const code = codeOf(text);
    expect(text).toContain('WalletConnectorWidget');
    expect(code).toContain('useWalletConnector');
    expect(code).not.toContain('useAccountInfo');
    expect(code).not.toContain("from '@orderly.network/react'");
  });

  it('never emits legacy packages or invalid symbols in curated code', async () => {
    for (const component of [
      'trading page',
      'orderbook',
      'order entry',
      'positions',
      'wallet connector',
    ]) {
      const text = await guide(component);
      expect(text).not.toContain("from '@orderly.network/react'");
      expect(text).not.toContain("from '@orderly.network/sdk'");
      expect(text).not.toContain("from '@orderly.network/react-hooks'");
      expect(text).not.toMatch(/symbol="(?:BTC|ETH)-PERP"/);
    }
  });

  it('returns no guide for components outside the curated set', async () => {
    const text = await guide('tpsl widget');
    expect(text).toContain('No component guide for');
    expect(text).toContain('search_orderly_docs');
    expect(text).not.toContain('Pattern sketch');
  });
});
