import { describe, it, expect } from 'vitest';
import { getOrderlyOneApiInfo } from '../tools/orderlyOneApi.js';

// Agents must be steered away from DEX creation/deployment and towards the
// broker-ID + dex-template path.
describe('get_orderly_one_api_info agent policy', () => {
  it('lists blocked and conditional operations with their reasons in the dex category', async () => {
    const result = await getOrderlyOneApiInfo(undefined, 'dex');
    const text = result.content[0].text;

    expect(text).toContain('## Agent Policy');
    expect(text).toContain('Agents may create and manage broker IDs');
    expect(text).toContain('Frontend creation deploys a public site.');
    expect(text).toContain('Upgrading rewrites a deployed frontend.');
    expect(text).toContain('Deleting a DEX is irreversible.');
    expect(text).toContain('Conditional for agents');
  });

  it('surfaces the block, reason and sanctioned path for a blocked endpoint', async () => {
    const result = await getOrderlyOneApiInfo('upgrade');
    const text = result.content[0].text;

    expect(text).toContain('Blocked for Agents');
    expect(text).toContain('Sanctioned DEX launch path');
    expect(text).toContain('https://github.com/OrderlyNetwork/dex-template');
  });

  it('marks POST /api/dex as conditional, not blocked, for broker ID creation', async () => {
    const result = await getOrderlyOneApiInfo('create a new dex');
    const text = result.content[0].text;

    expect(text).toContain('Conditional');
    expect(text).not.toContain('Blocked for Agents');
    expect(text).toContain('integrationType: "custom"');
    expect(text).toContain('Broker ID creation (allowed)');
  });

  it('does not flag allowed endpoints as blocked', async () => {
    const result = await getOrderlyOneApiInfo('graduation-status');
    const text = result.content[0].text;

    expect(text).not.toContain('Blocked for Agents');
    expect(text).toContain('Agent policy');
  });
});
