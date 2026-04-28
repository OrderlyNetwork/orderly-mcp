#!/usr/bin/env node

import { randomUUID } from 'crypto';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '1000', 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || String(30 * 60 * 1000), 10);

app.use(express.json({ limit: '1mb' }));

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'orderly-network-mcp', version: '0.1.0' });
});

// Session management - map to store transports by session ID
const transports = new Map<string, { transport: StreamableHTTPServerTransport; createdAt: number }>();

const evictExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, entry] of transports.entries()) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      console.log(`Evicting expired session: ${sessionId}`);
      try {
        void entry.transport.close().catch(() => {});
      } catch {
        // transport may already be closed
      }
      transports.delete(sessionId);
    }
  }
};

setInterval(evictExpiredSessions, 60_000);

const evictOldestSession = () => {
  let oldestId: string | null = null;
  let oldestTime = Infinity;
  for (const [sessionId, entry] of transports.entries()) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestId = sessionId;
    }
  }
  if (oldestId) {
    console.log(`Evicting oldest session to make room: ${oldestId}`);
    try {
      void transports.get(oldestId)!.transport.close().catch(() => {});
    } catch {
      // transport may already be closed
    }
    transports.delete(oldestId);
  }
};

// Factory function to create a new server+transport pair per session
const createSession = () => {
  const sessionId = randomUUID();
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    onsessioninitialized: (id) => {
      console.log(`Session initialized with ID: ${id}`);
      transports.set(id, { transport, createdAt: Date.now() });
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      console.log(`Session closed: ${sid}`);
      transports.delete(sid);
    }
  };

  return { server, transport };
};

// POST handler - for JSON-RPC requests
app.post('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId) {
    console.log(`Received MCP request for session: ${sessionId}`);
  }

  try {
    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!.transport;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      console.log('Creating new session for initialize request');
      if (transports.size >= MAX_SESSIONS) {
        evictOldestSession();
      }
      const { server, transport: newTransport } = createSession();
      transport = newTransport;
      await server.connect(transport);
    } else {
      // Invalid request - no session and not an initialize request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    if (!transport) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error: Failed to get transport',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP POST request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : String(error),
        },
        id: null,
      });
    }
  }
});

// GET handler - for SSE streams
app.get('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`Establishing SSE stream for session: ${sessionId}`);
  const transport = transports.get(sessionId)!.transport;
  await transport.handleRequest(req, res);
});

// DELETE handler - for session termination
app.delete('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`Received session termination request for session: ${sessionId}`);

  try {
    const transport = transports.get(sessionId)!.transport;
    await transport!.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`Orderly Network MCP Server running on HTTP`);
  console.log(`Endpoint: http://localhost:${PORT}/`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Config: max_sessions=${MAX_SESSIONS}, session_ttl=${SESSION_TTL_MS / 1000}s`);
});

// Graceful shutdown - close all active sessions
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  for (const [sessionId, entry] of transports.entries()) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await entry.transport.close();
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  transports.clear();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  for (const [sessionId, entry] of transports.entries()) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await entry.transport.close();
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  transports.clear();
  process.exit(0);
});
