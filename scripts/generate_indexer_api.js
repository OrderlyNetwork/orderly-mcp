#!/usr/bin/env node

/**
 * generate_indexer_api.js
 *
 * This script downloads the Orderly Network Indexer API OpenAPI spec and parses it directly
 * to generate a comprehensive src/data/indexer-api.json file.
 *
 * The Indexer API provides:
 * - Trading metrics (daily volume, fees, perp data)
 * - Account events (trades, settlements, liquidations, transactions)
 * - Volume statistics (account and broker level)
 * - Rankings (positions, PnL, trading volume, deposits/withdrawals)
 *
 * Unlike other scripts that use AI, this parses the JSON directly for speed and accuracy.
 *
 * Prerequisites:
 *   1. Node.js installed
 *
 * Usage:
 *   node scripts/generate_indexer_api.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const OPENAPI_URL = 'https://orderly-dashboard-query-service.orderly.network/api-docs/openapi.json';
const OUTPUT_FILE = path.join(projectRoot, 'src', 'data', 'indexer-api.json');

// Download OpenAPI spec
async function downloadOpenAPISpec() {
  console.log(`📥 Downloading Indexer API OpenAPI spec from ${OPENAPI_URL}...\n`);

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
        operationId: details.operationId || '',
        tags: details.tags || [],
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

// Extract clean description
function extractDescription(desc) {
  if (!desc) return '';
  // Clean up markdown formatting
  return desc
    .replace(/```json\n/g, '')
    .replace(/```\n/g, '')
    .replace(/```shell\n/g, '')
    .replace(/```/g, '')
    .trim();
}

// Extract parameters
function extractParameters(details, spec) {
  const params = [];
  const paramNames = new Set();

  // Path/query parameters
  if (details.parameters) {
    for (const param of details.parameters) {
      let resolvedParam = param;

      // Resolve $ref if present
      if (param.$ref) {
        resolvedParam = resolveRef(spec, param.$ref);
        if (!resolvedParam || resolvedParam === param.$ref) {
          continue;
        }
      }

      // Resolve schema if it's a ref
      let schema = resolvedParam.schema;
      if (schema?.$ref) {
        schema = resolveRef(spec, schema.$ref);
      }

      // Skip if already added
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
      code: code === '1000' ? 1000 : parseInt(code),
      description: resp.description || '',
      schema: schema ? JSON.stringify(schema, null, 2) : null,
    };
  });
}

// Generate code example
function generateExample(path, method, details) {
  const baseUrl = 'https://orderly-dashboard-query-service.orderly.network';

  if (method === 'GET') {
    return `const url = '${baseUrl}${path}?param=<encoded_json_param>';
fetch(url).then(res => res.json()).then(console.log);`;
  } else {
    return `const url = '${baseUrl}${path}';
const body = ${JSON.stringify(generateExampleBody(details), null, 2)};

fetch(url, {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body)
}).then(res => res.json()).then(console.log);`;
  }
}

// Generate example request body based on schema
function generateExampleBody(details) {
  // Return a minimal example based on the operation
  const operationId = details.operationId || '';

  if (operationId.includes('events_v2')) {
    return {
      account_id: '0x23fe190da12f7bf0f910416b9c1a9723859f3823bb5a19fbc22cd52ff7a9b30d',
      event_type: 'PERPTRADE',
      from_time: 1720604240,
      to_time: 1721468240,
    };
  }

  return {};
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
        properties: Object.entries(resolvedSchema.properties).map(([propName, prop]) => {
          let propType = prop.type || 'unknown';
          let propFormat = prop.format || null;

          // Handle oneOf for union types
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
            format: propFormat,
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

// Main processing
function processOpenAPISpec(spec) {
  console.log('📝 Extracting Indexer API documentation...\n');

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
    version: spec.info?.version || '0.1.0',
    description:
      spec.info?.description ||
      'Orderly Network Indexer API for querying trading metrics, account events, volume statistics, and rankings.',
    baseUrl: {
      mainnet: 'https://orderly-dashboard-query-service.orderly.network',
      testnet: 'https://dev-orderly-dashboard-query-service.orderly.network',
    },
    categories: Object.entries(categories).map(([name, endpoints]) => ({
      name: name.replace('crate::', '').replace(/_/g, ' '),
      description: getCategoryDescription(name),
      endpoints,
    })),
    endpoints,
    schemas,
    commonErrors: [
      { code: 200, message: 'Success', description: 'Request successful' },
      { code: 409, message: 'Invalid Request', description: 'Invalid request parameters' },
      { code: 1000, message: 'Invalid Request', description: 'Invalid request parameters' },
    ],
  };
}

// Get category description
function getCategoryDescription(category) {
  const descriptions = {
    trading_metrics: 'Trading metrics including daily volume, fees, and perpetual trading data',
    'trading_metrics::volume_statistic': 'Volume statistics for accounts and brokers',
    'events::events_api':
      'Account events including trades, settlements, liquidations, and transactions',
  };
  return descriptions[category] || 'API endpoints';
}

// Main execution
async function main() {
  console.log('🚀 Orderly Indexer API Documentation Generator\n');
  console.log(
    'This script downloads the Indexer API OpenAPI spec and generates comprehensive API docs.\n'
  );
  console.log('Mode: Direct JSON parsing (no AI) - FAST ⚡\n');

  try {
    // Download the spec
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
        mode: 'direct-parsing',
      },
    };

    // Save to file
    console.log(`💾 Saving Indexer API documentation to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    // Summary
    console.log('\n✅ Indexer API documentation generated successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - REST Endpoints: ${output.endpoints?.length || 0}`);
    console.log(`   - Categories: ${output.categories?.length || 0}`);
    console.log(`   - Schemas: ${output.schemas?.length || 0}`);
    console.log(`   - File: ${OUTPUT_FILE}\n`);
    console.log('Next steps:');
    console.log('   1. Review the generated indexer-api.json');
    console.log('   2. Run: yarn build && yarn test:run\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
