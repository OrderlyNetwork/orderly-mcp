#!/usr/bin/env node

/**
 * generate_api_from_openapi.js
 *
 * This script downloads the Orderly Network OpenAPI spec and parses it directly
 * to generate a comprehensive src/data/api.json file.
 *
 * Unlike other scripts that use AI, this parses the YAML directly for speed and accuracy.
 *
 * Prerequisites:
 *   1. Node.js installed
 *   2. npm install yaml
 *
 * Usage:
 *   node scripts/generate_api_from_openapi.js
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const OPENAPI_URL =
  'https://raw.githubusercontent.com/OrderlyNetwork/documentation-public/refs/heads/main/evm.openapi.yaml';
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'api.json');

// Download OpenAPI spec
async function downloadOpenAPISpec() {
  console.log(`📥 Downloading OpenAPI spec from ${OPENAPI_URL}...\n`);

  try {
    const response = await fetch(OPENAPI_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    console.log(`   ✅ Downloaded ${content.length} characters\n`);
    return content;
  } catch (error) {
    console.error(`❌ Failed to download OpenAPI spec:`, error.message);
    process.exit(1);
  }
}

// Parse OpenAPI spec
function parseOpenAPISpec(yamlContent) {
  console.log('🔍 Parsing OpenAPI specification...\n');

  try {
    const spec = YAML.parse(yamlContent);
    console.log(`   ✅ Parsed spec with ${Object.keys(spec.paths || {}).length} paths\n`);
    return spec;
  } catch (error) {
    console.error(`❌ Failed to parse YAML:`, error.message);
    process.exit(1);
  }
}

// Extract endpoints from spec
function extractEndpoints(spec) {
  const endpoints = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods)) {
      if (typeof details !== 'object' || !details.summary) continue;

      const endpoint = {
        path,
        method: method.toUpperCase(),
        summary: details.summary || '',
        description: extractDescription(details.description),
        auth: isPrivateEndpoint(details),
        tags: details.tags || [],
        rateLimit: extractRateLimit(details.description),
        parameters: extractParameters(details, spec),
        requestBody: extractRequestBody(details, spec),
        responses: extractResponses(details, spec),
        example: generateExample(path, method.toUpperCase(), details),
        errors: [],
      };

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

// Extract clean description
function extractDescription(desc) {
  if (!desc) return '';
  // Remove rate limit line and format
  return desc
    .replace(/\*\*Limit:.*?\*\*/g, '')
    .replace(/`.*?`/g, (match) => match.replace(/`/g, ''))
    .trim();
}

// Check if endpoint is private
function isPrivateEndpoint(details) {
  return (details.tags || []).includes('private');
}

// Extract rate limit from description
function extractRateLimit(desc) {
  if (!desc) return null;
  const match = desc.match(/\*\*Limit:\s*(.*?)\*\*/);
  return match ? match[1] : null;
}

// Resolve a $ref to its actual definition
function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) return ref;

  const path = ref.replace('#/', '').split('/');
  let current = spec;

  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return ref; // Can't resolve, return as-is
    }
  }

  return current;
}

// Deep resolve all $refs in an object
function deepResolveRefs(spec, obj, visited = new Set()) {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle circular references
  if (obj.$ref) {
    if (visited.has(obj.$ref)) {
      return { $ref: obj.$ref }; // Already visited, keep as ref
    }
    visited.add(obj.$ref);
    const resolved = resolveRef(spec, obj.$ref);
    if (resolved !== obj.$ref) {
      // Merge resolved properties with any additional properties in the original
      const { $ref, ...rest } = obj;
      return { ...deepResolveRefs(spec, resolved, visited), ...rest };
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepResolveRefs(spec, item, visited));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepResolveRefs(spec, value, visited);
  }
  return result;
}

// Extract parameters
function extractParameters(details, spec) {
  const params = [];
  const paramNames = new Set(); // Track parameter names to avoid duplicates

  // Path/query parameters
  if (details.parameters) {
    for (const param of details.parameters) {
      let resolvedParam = param;

      // Resolve $ref if present
      if (param.$ref) {
        resolvedParam = resolveRef(spec, param.$ref);
        if (!resolvedParam || resolvedParam === param.$ref) {
          // Couldn't resolve, skip this parameter
          continue;
        }
      }

      // Skip if already added
      if (paramNames.has(resolvedParam.name)) {
        continue;
      }
      paramNames.add(resolvedParam.name);

      params.push({
        name: resolvedParam.name,
        in: resolvedParam.in,
        type: resolvedParam.schema?.type || 'string',
        required: resolvedParam.required || false,
        description: resolvedParam.description || '',
        example: resolvedParam.schema?.example || resolvedParam.example || null,
      });
    }
  }

  // Add auth headers for private endpoints (only if not already present)
  if (isPrivateEndpoint(details)) {
    const authHeaders = [
      {
        name: 'orderly-timestamp',
        in: 'header',
        type: 'string',
        required: true,
        description: 'Request timestamp in milliseconds',
      },
      {
        name: 'orderly-account-id',
        in: 'header',
        type: 'string',
        required: true,
        description: 'Account ID',
      },
      {
        name: 'orderly-key',
        in: 'header',
        type: 'string',
        required: true,
        description: 'Orderly API key',
      },
      {
        name: 'orderly-signature',
        in: 'header',
        type: 'string',
        required: true,
        description: 'Ed25519 signature',
      },
    ];

    // Only add auth headers that aren't already present
    for (const header of authHeaders) {
      if (!paramNames.has(header.name)) {
        params.push(header);
      }
    }
  }

  return params;
}

// Extract request body
function extractRequestBody(details, spec) {
  if (!details.requestBody) return null;

  const content = details.requestBody.content?.['application/json'];
  if (!content) return null;

  // Resolve all $refs in the schema
  const resolvedSchema = deepResolveRefs(spec, content.schema || {});

  return {
    description: details.requestBody.description || '',
    contentType: 'application/json',
    schema: JSON.stringify(resolvedSchema, null, 2),
    required: details.requestBody.required || false,
  };
}

// Extract responses
function extractResponses(details, spec) {
  if (!details.responses) return [];

  return Object.entries(details.responses).map(([code, resp]) => {
    let schema = resp.content?.['application/json']?.schema;

    // Resolve $refs in the schema
    if (schema) {
      schema = deepResolveRefs(spec, schema);
    }

    return {
      code: parseInt(code),
      description: resp.description || '',
      schema: schema ? JSON.stringify(schema, null, 2) : null,
    };
  });
}

// Generate code example
function generateExample(path, method, details) {
  const isPrivate = isPrivateEndpoint(details);
  const baseUrl = 'https://api.orderly.org';

  let example = '';

  if (isPrivate) {
    example = `const url = '${baseUrl}${path}';
const timestamp = Date.now().toString();
const signature = signMessage(timestamp + '${method}' + '${path}'${details.requestBody ? ' + JSON.stringify(body)' : ''});

fetch(url, {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    'orderly-account-id': 'YOUR_ACCOUNT_ID',
    'orderly-key': 'YOUR_PUBLIC_KEY',
    'orderly-signature': signature,
    'orderly-timestamp': timestamp
  }${details.requestBody ? ',\n  body: JSON.stringify(body)' : ''}
}).then(res => res.json()).then(console.log);`;
  } else {
    example = `const url = '${baseUrl}${path}';
fetch(url).then(res => res.json()).then(console.log);`;
  }

  return example;
}

// Extract schemas from components with full resolution
function extractSchemas(spec) {
  const schemas = [];
  const components = spec.components?.schemas || {};

  for (const [name, schema] of Object.entries(components)) {
    // Resolve any $refs within the schema
    const resolvedSchema = deepResolveRefs(spec, schema);

    if (resolvedSchema.type === 'object' && resolvedSchema.properties) {
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: 'object',
        properties: Object.entries(resolvedSchema.properties).map(([propName, prop]) => ({
          name: propName,
          type: prop.type || prop.$ref ? 'object' : 'unknown',
          description: prop.description || '',
          required: (resolvedSchema.required || []).includes(propName),
          example: prop.example || null,
          enum: prop.enum || null,
          format: prop.format || null,
        })),
        required: resolvedSchema.required || [],
      });
    } else if (resolvedSchema.type === 'array' && resolvedSchema.items) {
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: 'array',
        items: resolvedSchema.items,
      });
    } else {
      // Include other schema types as well
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: resolvedSchema.type || 'unknown',
        properties: resolvedSchema.properties
          ? Object.entries(resolvedSchema.properties).map(([propName, prop]) => ({
              name: propName,
              type: prop.type || 'unknown',
              description: prop.description || '',
              required: (resolvedSchema.required || []).includes(propName),
              example: prop.example || null,
              enum: prop.enum || null,
              format: prop.format || null,
            }))
          : null,
      });
    }
  }

  return schemas;
}

// Main processing
function processOpenAPISpec(spec) {
  console.log('📝 Extracting API documentation...\n');

  const endpoints = extractEndpoints(spec);
  console.log(`   ✅ Extracted ${endpoints.length} endpoints`);

  const schemas = extractSchemas(spec);
  console.log(`   ✅ Extracted ${schemas.length} schemas\n`);

  return {
    version: spec.info?.version || '1.0.0',
    description: spec.info?.description || '',
    auth: {
      description:
        'Orderly uses Ed25519 elliptic curve signatures for request authentication. Each request must include a signature generated with your private key.',
      steps: [
        'Generate Ed25519 key pair or add existing public key to your account',
        'Create message to sign: timestamp + method + path + body (if any)',
        'Sign message with Ed25519 private key',
        'Encode signature as base64url',
        'Include headers: orderly-account-id, orderly-key, orderly-signature, orderly-timestamp',
      ],
      example: `import { signAsync } from '@noble/ed25519';

const timestamp = Date.now();
const message = \`\${timestamp}POST/v1/order\${JSON.stringify(body)}\`;
const signature = await signAsync(Buffer.from(message), privateKey);
const orderlySignature = Buffer.from(signature).toString('base64url');

// Headers
{
  'orderly-timestamp': String(timestamp),
  'orderly-account-id': accountId,
  'orderly-key': \`ed25519:\${publicKey}\`,
  'orderly-signature': orderlySignature
}`,
    },
    rest: {
      baseUrl: {
        mainnet: 'https://api.orderly.org',
        testnet: 'https://testnet-api.orderly.org',
      },
      authentication: {
        type: 'Ed25519 signature',
        description:
          'Private endpoints require Ed25519 signatures. Include timestamp, account-id, key, and signature headers.',
        headers: [
          { name: 'orderly-account-id', type: 'string', description: 'Your account ID' },
          { name: 'orderly-key', type: 'string', description: 'Your public key' },
          { name: 'orderly-signature', type: 'string', description: 'Request signature' },
          {
            name: 'orderly-timestamp',
            type: 'string',
            description: 'Request timestamp in milliseconds',
          },
        ],
      },
      endpoints,
      commonErrors: [
        { code: 400, message: 'Bad Request', description: 'Invalid request parameters' },
        { code: 401, message: 'Unauthorized', description: 'Invalid or missing signature' },
        { code: 403, message: 'Forbidden', description: 'Access denied' },
        { code: 404, message: 'Not Found', description: 'Resource does not exist' },
        { code: 429, message: 'Too Many Requests', description: 'Rate limit exceeded' },
        { code: 500, message: 'Internal Server Error', description: 'Server error' },
      ],
    },
    websocket: {
      baseUrl: {
        mainnet: 'wss://ws.orderly.org/ws/stream',
        testnet: 'wss://testnet-ws.orderly.org/ws/stream',
      },
      streams: [
        {
          name: 'Orderbook',
          topic: 'orderbook',
          description:
            'Real-time orderbook updates with configurable depth. Provides bid/ask price levels and quantities.',
          auth: false,
          parameters: [
            {
              name: 'symbol',
              type: 'string',
              required: true,
              description: 'Trading pair symbol (e.g., PERP_ETH_USDC)',
            },
          ],
          example: `ws.send(JSON.stringify({
  id: '1',
  event: 'subscribe',
  topic: 'orderbook:PERP_ETH_USDC',
  params: {
    binary: false
  }
}));`,
        },
        {
          name: 'Order Updates',
          topic: 'executionreport',
          description:
            'Real-time updates for order status changes, fills, and cancellations. Requires authentication.',
          auth: true,
          example: `ws.send(JSON.stringify({
  id: '1',
  event: 'subscribe',
  topic: 'executionreport'
}));`,
        },
        {
          name: 'Position Updates',
          topic: 'position',
          description: 'Real-time position changes and PnL updates. Requires authentication.',
          auth: true,
          example: `ws.send(JSON.stringify({
  id: '1',
  event: 'subscribe',
  topic: 'position'
}));`,
        },
        {
          name: 'Mark Price',
          topic: 'markprice',
          description: 'Real-time mark price updates for all symbols.',
          auth: false,
          example: `ws.send(JSON.stringify({
  id: '1',
  event: 'subscribe',
  topic: 'markprice'
}));`,
        },
        {
          name: 'Index Price',
          topic: 'indexprice',
          description: 'Real-time index price updates.',
          auth: false,
          example: `ws.send(JSON.stringify({
  id: '1',
  event: 'subscribe',
  topic: 'indexprice'
}));`,
        },
        {
          name: '24h Ticker',
          topic: '24hrTicker',
          description: '24-hour rolling statistics for all symbols.',
          auth: false,
          parameters: [
            {
              name: 'symbol',
              type: 'string',
              required: false,
              description: 'Symbol to subscribe to (omit for all)',
            },
          ],
        },
        {
          name: 'Account Balance',
          topic: 'balance',
          description: 'Real-time account balance updates. Requires authentication.',
          auth: true,
        },
        {
          name: 'Liquidation',
          topic: 'liquidation',
          description: 'Liquidation warnings and execution notifications. Requires authentication.',
          auth: true,
        },
      ],
    },
    schemas,
  };
}

// Main execution
async function main() {
  console.log('🚀 Orderly API Documentation Generator\n');
  console.log('This script downloads the OpenAPI spec and generates comprehensive API docs.\n');
  console.log('Mode: Direct YAML parsing (no AI) - FAST ⚡\n');

  try {
    // Download the spec
    const yamlContent = await downloadOpenAPISpec();

    // Parse the spec
    const spec = parseOpenAPISpec(yamlContent);

    // Extract API documentation
    const apiData = processOpenAPISpec(spec);

    // Add metadata
    const output = {
      ...apiData,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: OPENAPI_URL,
        version: apiData.version,
        totalEndpoints: apiData.rest?.endpoints?.length || 0,
        totalStreams: apiData.websocket?.streams?.length || 0,
        totalSchemas: apiData.schemas?.length || 0,
        mode: 'direct-parsing',
      },
    };

    // Save to file
    console.log(`💾 Saving API documentation to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    // Summary
    console.log('\n✅ API documentation generated successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - REST Endpoints: ${output.rest?.endpoints?.length || 0}`);
    console.log(`   - WebSocket Streams: ${output.websocket?.streams?.length || 0}`);
    console.log(`   - Schemas: ${output.schemas?.length || 0}`);
    console.log(`   - File: ${OUTPUT_FILE}\n`);
    console.log('Next steps:');
    console.log('   1. Review the generated api.json');
    console.log('   2. Run: yarn build && yarn test:run\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
