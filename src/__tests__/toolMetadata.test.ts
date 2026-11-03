import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server.js';

describe('tool metadata', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'tool-metadata-test', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('marks every tool as read-only, idempotent, and closed-world', async () => {
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.annotations, tool.name).toMatchObject({
        title: expect.any(String),
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it('gives every tool a description covering more than a one-line purpose', async () => {
    const { tools } = await client.listTools();

    for (const tool of tools) {
      const description = tool.description ?? '';
      expect(description, tool.name).toBeTruthy();
      expect(description.split(/\s+/).length, tool.name).toBeGreaterThanOrEqual(40);
    }
  });

  it('exposes exactly the expected tool surface', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'explain_workflow',
      'get_api_info',
      'get_component_guide',
      'get_contract_addresses',
      'get_indexer_api_info',
      'get_orderly_one_api_info',
      'get_public_info_api_info',
      'get_strategy_vault_api_info',
      'search_orderly_docs',
    ]);
  });

  it('exposes exactly the expected resource surface', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri).sort()).toEqual([
      'orderly://api/indexer',
      'orderly://api/public-info',
      'orderly://api/rest',
      'orderly://api/websocket',
      'orderly://contracts',
      'orderly://overview',
      'orderly://sdk/components',
      'orderly://sdk/hooks',
      'orderly://workflows',
    ]);
  });
});
