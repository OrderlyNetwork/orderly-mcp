#!/usr/bin/env node

/**
 * generate_orderly_one_api.js
 *
 * This script fetches the Orderly One API OpenAPI spec from the local dev server
 * and parses it directly to generate a comprehensive src/data/orderly-one-api.json file.
 *
 * Orderly One is a DEX creation platform that allows users to create and manage
 * their own perpetual decentralized exchanges using Orderly Network infrastructure.
 *
 * API Categories:
 * - auth: Wallet signature-based authentication
 * - dex: DEX CRUD operations, deployment, upgrades
 * - theme: AI-powered theme generation and customization
 * - graduation: Broker ID creation and fee management
 * - stats: Platform-wide statistics
 * - leaderboard: DEX rankings and performance metrics
 * - admin: Administrative operations
 *
 * Unlike other scripts that use AI, this parses the JSON directly for speed and accuracy.
 *
 * Prerequisites:
 *   1. Node.js installed
 *   2. Orderly One API server running on http://localhost:3001
 *
 * Usage:
 *   node scripts/generate_orderly_one_api.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const OPENAPI_URL = 'http://localhost:3001/openapi.json';
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'orderly-one-api.json');

// Download OpenAPI spec
async function downloadOpenAPISpec() {
  console.log(`📥 Fetching Orderly One OpenAPI spec from ${OPENAPI_URL}...\n`);

  try {
    const response = await fetch(OPENAPI_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    console.log(`   ✅ Fetched ${content.length} characters\n`);
    return content;
  } catch (error) {
    console.error(`❌ Failed to fetch OpenAPI spec:`, error.message);
    console.error(`   Make sure the Orderly One API server is running on port 3001`);
    process.exit(1);
  }
}

// Parse OpenAPI spec
function parseOpenAPISpec(jsonContent) {
  console.log('🔍 Parsing OpenAPI specification...\n');

  try {
    const spec = JSON.parse(jsonContent);
    console.log(`   ✅ Parsed spec with ${Object.keys(spec.paths || {}).length} paths\n`);
    return spec;
  } catch (error) {
    console.error(`❌ Failed to parse JSON:`, error.message);
    process.exit(1);
  }
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
      return { $ref: obj.$ref };
    }
    visited.add(obj.$ref);
    const resolved = resolveRef(spec, obj.$ref);
    if (resolved !== obj.$ref) {
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

// Extract description
function extractDescription(desc) {
  if (!desc) return '';
  return desc.trim();
}

// Extract parameters
function extractParameters(details, spec) {
  const params = [];
  const paramNames = new Set();

  if (details.parameters) {
    for (const param of details.parameters) {
      let resolvedParam = param;

      if (param.$ref) {
        resolvedParam = resolveRef(spec, param.$ref);
        if (!resolvedParam || resolvedParam === param.$ref) {
          continue;
        }
      }

      let schema = resolvedParam.schema;
      if (schema?.$ref) {
        schema = resolveRef(spec, schema.$ref);
      }

      if (paramNames.has(resolvedParam.name)) {
        continue;
      }
      paramNames.add(resolvedParam.name);

      params.push({
        name: resolvedParam.name,
        in: resolvedParam.in,
        type: schema?.type || 'string',
        required: resolvedParam.required || false,
        description: resolvedParam.description || '',
        example: schema?.example || resolvedParam.example || null,
      });
    }
  }

  return params;
}

// Extract request body
function extractRequestBody(details, spec) {
  if (!details.requestBody) return null;

  const contentTypes = Object.keys(details.requestBody.content || {});
  const contentType = contentTypes[0] || 'application/json';
  const content = details.requestBody.content?.[contentType];

  if (!content) return null;

  const resolvedSchema = deepResolveRefs(spec, content.schema || {});

  return {
    description: details.requestBody.description || '',
    contentType,
    schema: JSON.stringify(resolvedSchema, null, 2),
    required: details.requestBody.required || false,
  };
}

// Extract responses
function extractResponses(details, spec) {
  if (!details.responses) return [];

  return Object.entries(details.responses).map(([code, resp]) => {
    let schema = null;

    // Try to find schema in different content types
    const content = resp.content || {};
    for (const [contentType, contentDetails] of Object.entries(content)) {
      if (contentDetails.schema) {
        schema = deepResolveRefs(spec, contentDetails.schema);
        break;
      }
    }

    return {
      code: parseInt(code) || code,
      description: resp.description || '',
      schema: schema ? JSON.stringify(schema, null, 2) : null,
    };
  });
}

// Generate code example
function generateExample(path, method, details) {
  const baseUrl = 'https://api.dex.orderly.network';

  if (method === 'GET') {
    return `const url = '${baseUrl}${path}';
const token = 'YOUR_JWT_TOKEN';

fetch(url, {
  headers: {
    'Authorization': \`Bearer \${token}\`,
  }
}).then(res => res.json()).then(console.log);`;
  } else {
    return `const url = '${baseUrl}${path}';
const token = 'YOUR_JWT_TOKEN';

fetch(url, {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${token}\`,
  },
  body: JSON.stringify({
    // Request body here
  })
}).then(res => res.json()).then(console.log);`;
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
        operationId:
          details.operationId || `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        tags: details.tags || ['general'],
        parameters: extractParameters(details, spec),
        requestBody: extractRequestBody(details, spec),
        responses: extractResponses(details, spec),
        example: generateExample(path, method.toUpperCase(), details),
      };

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

// Extract schemas from components
function extractSchemas(spec) {
  const schemas = [];
  const components = spec.components?.schemas || {};

  for (const [name, schema] of Object.entries(components)) {
    const resolvedSchema = deepResolveRefs(spec, schema);

    if (resolvedSchema.type === 'object' && resolvedSchema.properties) {
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: 'object',
        properties: Object.entries(resolvedSchema.properties).map(([propName, prop]) => {
          let propType = prop.type || 'unknown';

          if (prop.oneOf) {
            propType = prop.oneOf.map((p) => p.type || (p.$ref ? 'object' : 'unknown')).join(' | ');
          }

          return {
            name: propName,
            type: propType,
            description: prop.description || '',
            required: (resolvedSchema.required || []).includes(propName),
            example: prop.example || null,
            enum: prop.enum || null,
          };
        }),
        required: resolvedSchema.required || [],
      });
    } else if (resolvedSchema.type === 'array' && resolvedSchema.items) {
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: 'array',
        items: resolvedSchema.items,
      });
    } else if (resolvedSchema.enum) {
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: 'enum',
        enum: resolvedSchema.enum,
      });
    } else {
      schemas.push({
        name,
        description: resolvedSchema.description || '',
        type: resolvedSchema.type || 'unknown',
        properties: null,
      });
    }
  }

  return schemas;
}

// Get category description
function getCategoryDescription(category) {
  const descriptions = {
    auth: 'Authentication endpoints for wallet signature-based login',
    dex: 'DEX management - create, update, delete, and manage your exchange',
    theme: 'AI-powered theme generation and CSS customization',
    graduation: 'Graduation system - upgrade from demo to full broker with fee splits',
    stats: 'Platform-wide statistics and analytics',
    leaderboard: 'DEX rankings, performance metrics, and leaderboards',
    admin: 'Administrative operations for platform management',
  };
  return descriptions[category] || 'API endpoints';
}

// Main processing
function processOpenAPISpec(spec) {
  console.log('📝 Extracting Orderly One API documentation...\n');

  const endpoints = extractEndpoints(spec);
  console.log(`   ✅ Extracted ${endpoints.length} endpoints`);

  const schemas = extractSchemas(spec);
  console.log(`   ✅ Extracted ${schemas.length} schemas\n`);

  // Group endpoints by category
  const categories = {};
  for (const endpoint of endpoints) {
    const category = endpoint.tags[0] || 'general';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(endpoint);
  }

  return {
    version: spec.info?.version || '1.0.0',
    title: spec.info?.title || 'Orderly One API',
    description:
      spec.info?.description ||
      'Orderly One API - Create and manage your own perpetual DEX using Orderly Network infrastructure',
    baseUrl: {
      production: 'https://api.dex.orderly.network',
      development: 'http://localhost:3001',
    },
    authentication: {
      type: 'JWT',
      description:
        'Orderly One uses wallet signature-based authentication. Users sign a message with their EVM wallet to obtain a JWT token.',
      flow: [
        {
          step: 1,
          title: 'Request Nonce',
          description: 'POST /auth/nonce with wallet address to get a unique nonce',
          endpoint: '/auth/nonce',
        },
        {
          step: 2,
          title: 'Sign Message',
          description:
            'Sign the message "Sign this message to authenticate with Orderly One: {nonce}" with your wallet',
          example: 'ethers.signMessage(message)',
        },
        {
          step: 3,
          title: 'Verify Signature',
          description: 'POST /auth/verify with address and signature to get JWT token',
          endpoint: '/auth/verify',
        },
        {
          step: 4,
          title: 'Use Token',
          description: 'Include the JWT token in Authorization header for all subsequent requests',
          header: 'Authorization: Bearer <token>',
        },
      ],
      example: `// 1. Get nonce
const nonceRes = await fetch('https://api.dex.orderly.network/auth/nonce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: '0x...' })
});
const { message, nonce } = await nonceRes.json();

// 2. Sign message
const signature = await wallet.signMessage(message);

// 3. Verify and get token
const verifyRes = await fetch('https://api.dex.orderly.network/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: '0x...', signature })
});
const { token } = await verifyRes.json();

// 4. Use token for authenticated requests
const dexRes = await fetch('https://api.dex.orderly.network/dex', {
  headers: { 'Authorization': \`Bearer \${token}\` }
});`,
    },
    categories: Object.entries(categories).map(([name, categoryEndpoints]) => ({
      name,
      description: getCategoryDescription(name),
      endpoints: categoryEndpoints,
    })),
    endpoints,
    schemas,
    commonErrors: [
      { code: 200, message: 'Success', description: 'Request successful' },
      { code: 400, message: 'Bad Request', description: 'Invalid request parameters' },
      { code: 401, message: 'Unauthorized', description: 'Invalid or missing JWT token' },
      { code: 403, message: 'Forbidden', description: 'Access denied or insufficient permissions' },
      { code: 404, message: 'Not Found', description: 'Resource does not exist' },
      {
        code: 409,
        message: 'Conflict',
        description: 'Resource already exists (e.g., duplicate broker ID)',
      },
      { code: 429, message: 'Too Many Requests', description: 'Rate limit exceeded' },
      { code: 500, message: 'Internal Server Error', description: 'Server error' },
    ],
  };
}

// Main execution
async function main() {
  console.log('🚀 Orderly One API Documentation Generator\n');
  console.log('This script fetches the OpenAPI spec and generates comprehensive API docs.\n');
  console.log('Mode: Direct JSON parsing (no AI) - FAST ⚡\n');

  try {
    // Fetch the spec
    const jsonContent = await downloadOpenAPISpec();

    // Parse the spec
    const spec = parseOpenAPISpec(jsonContent);

    // Extract API documentation
    const apiData = processOpenAPISpec(spec);

    // Add metadata
    const output = {
      ...apiData,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: OPENAPI_URL,
        version: apiData.version,
        totalEndpoints: apiData.endpoints?.length || 0,
        totalSchemas: apiData.schemas?.length || 0,
        totalCategories: apiData.categories?.length || 0,
        mode: 'direct-parsing',
      },
    };

    // Save to file
    console.log(`💾 Saving Orderly One API documentation to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    // Summary
    console.log('\n✅ Orderly One API documentation generated successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Total Endpoints: ${output.endpoints?.length || 0}`);
    console.log(`   - Categories: ${output.categories?.length || 0}`);
    console.log(`   - Schemas: ${output.schemas?.length || 0}`);
    console.log(`   - File: ${OUTPUT_FILE}\n`);
    console.log('Categories:');
    for (const cat of output.categories || []) {
      console.log(`   - ${cat.name}: ${cat.endpoints.length} endpoints`);
    }
    console.log('\nNext steps:');
    console.log('   1. Review the generated orderly-one-api.json');
    console.log('   2. Create src/tools/orderlyOneApi.ts tool');
    console.log('   3. Update src/server.ts to register the tool');
    console.log('   4. Run: yarn build && yarn test:run\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
