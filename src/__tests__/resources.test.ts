import { describe, it, expect } from 'vitest';
import { getResource } from '../resources/index.js';

describe('getResource', () => {
  describe('overview', () => {
    it('should return overview content without search', async () => {
      const result = await getResource('orderly://overview');
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe('text/markdown');
      expect(result.contents[0].text).toContain('Orderly Network');
    });

    it('should indicate search is not supported for overview', async () => {
      const result = await getResource('orderly://overview?search=test');
      expect(result.contents[0].text).toContain('Search is not supported');
    });
  });

  describe('sdk/hooks', () => {
    it('should return overview without search query', async () => {
      const result = await getResource('orderly://sdk/hooks');
      expect(result.contents[0].text).toContain('SDK Hooks Reference');
      expect(result.contents[0].text).toContain('How to Search');
    });

    it('should search hooks by name', async () => {
      const result = await getResource('orderly://sdk/hooks?search=useOrderEntry');
      expect(result.contents[0].text).toContain('SDK Hooks Search Results');
      expect(result.contents[0].text).toContain('useOrderEntry');
    });

    it('should support pagination', async () => {
      const result = await getResource('orderly://sdk/hooks?search=use&page=1&limit=5');
      expect(result.contents[0].text).toContain('Page 1');
    });
  });

  describe('sdk/components', () => {
    it('should return overview without search query', async () => {
      const result = await getResource('orderly://sdk/components');
      expect(result.contents[0].text).toContain('Component Building Guides');
      expect(result.contents[0].text).toContain('How to Search');
    });

    it('should search components', async () => {
      const result = await getResource('orderly://sdk/components?search=Checkbox');
      expect(result.contents[0].text).toContain('Component Guides Search Results');
    });
  });

  describe('contracts', () => {
    it('should return all contracts as JSON', async () => {
      const result = await getResource('orderly://contracts');
      expect(result.contents[0].mimeType).toBe('application/json');
      const data = JSON.parse(result.contents[0].text);
      expect(data).toHaveProperty('arbitrum');
      expect(data).toHaveProperty('ethereum');
    });

    it('should ignore search query and return all contracts', async () => {
      const result = await getResource('orderly://contracts?search=arbitrum');
      expect(result.contents[0].mimeType).toBe('application/json');
      const data = JSON.parse(result.contents[0].text);
      expect(data).toHaveProperty('arbitrum');
    });
  });

  describe('workflows', () => {
    it('should return overview without search query', async () => {
      const result = await getResource('orderly://workflows');
      expect(result.contents[0].text).toContain('Common Workflows');
      expect(result.contents[0].text).toContain('How to Search');
    });

    it('should search workflows', async () => {
      const result = await getResource('orderly://workflows?search=wallet');
      expect(result.contents[0].text).toContain('Workflows Search Results');
    });
  });

  describe('api/rest', () => {
    it('should return overview without search query', async () => {
      const result = await getResource('orderly://api/rest');
      expect(result.contents[0].text).toContain('REST API Reference');
      expect(result.contents[0].text).toContain('How to Search');
    });

    it('should search endpoints', async () => {
      const result = await getResource('orderly://api/rest?search=order');
      expect(result.contents[0].text).toContain('REST API Endpoints Search Results');
    });
  });

  describe('api/websocket', () => {
    it('should return overview without search query', async () => {
      const result = await getResource('orderly://api/websocket');
      expect(result.contents[0].text).toContain('WebSocket API Reference');
      expect(result.contents[0].text).toContain('How to Search');
    });

    it('should search streams', async () => {
      const result = await getResource('orderly://api/websocket?search=orderbook');
      expect(result.contents[0].text).toContain('WebSocket Streams Search Results');
    });
  });

  describe('unknown resource', () => {
    it('should return not found for unknown URI', async () => {
      const result = await getResource('orderly://unknown');
      expect(result.contents[0].text).toContain('Resource not found');
    });
  });
});
