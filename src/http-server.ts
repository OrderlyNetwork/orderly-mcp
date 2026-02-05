#!/usr/bin/env node

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Enable CORS for public access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'orderly-network-mcp', version: '0.1.0' });
});

// Create MCP server and transport
const server = createMcpServer();
const transport = new StreamableHTTPServerTransport({
  // Stateless mode - no sessionIdGenerator
  sessionIdGenerator: undefined,
});

// Connect server to transport
await server.connect(transport);

// MCP endpoint - handles both GET and POST
app.all('/mcp', async (req, res) => {
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

// Start HTTP server
app.listen(PORT, () => {
  console.error(`Orderly Network MCP Server running on HTTP`);
  console.error(`Endpoint: http://localhost:${PORT}/mcp`);
  console.error(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.error('SIGTERM received, shutting down gracefully...');
  await transport.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.error('SIGINT received, shutting down gracefully...');
  await transport.close();
  process.exit(0);
});
