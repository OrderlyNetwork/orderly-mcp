import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SearchableItem {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

interface SearchOptions {
  query: string;
  page: number;
  limit: number;
}

interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;

function createFuseSearch<T extends SearchableItem>(
  items: T[],
  keys: Array<string | { name: string; weight?: number }>
): Fuse<T> {
  const fuseOptions = {
    keys,
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    includeMatches: false,
    minMatchCharLength: 2,
    shouldSort: true,
    findAllMatches: true,
    useExtendedSearch: true,
  };

  return new Fuse(items, fuseOptions);
}

function searchWithPagination<T extends SearchableItem>(
  fuse: Fuse<T>,
  options: SearchOptions
): SearchResult<T> {
  const { query, page = 1, limit = DEFAULT_LIMIT } = options;
  const effectiveLimit = Math.min(limit, MAX_LIMIT);

  if (!query || query.trim().length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
      hasMore: false,
    };
  }

  const searchResults = fuse.search(query.trim(), {
    limit: effectiveLimit * page,
  });

  const qualityResults = searchResults.filter((result) => (result.score ?? 1) < 0.7);

  const total = qualityResults.length;
  const totalPages = Math.ceil(total / effectiveLimit);
  const startIndex = (page - 1) * effectiveLimit;
  const endIndex = startIndex + effectiveLimit;

  const items = qualityResults.slice(startIndex, endIndex).map((result) => result.item);

  return {
    items,
    total,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}

function parseResourceUri(uri: string): {
  baseUri: string;
  searchQuery: string | null;
  page: number;
  limit: number;
} {
  try {
    const url = new URL(uri);
    const baseUri = `${url.protocol}//${url.host}${url.pathname}`.toLowerCase().trim();
    const searchQuery = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, MAX_LIMIT);

    return { baseUri, searchQuery, page, limit };
  } catch {
    return { baseUri: uri.toLowerCase().trim(), searchQuery: null, page: 1, limit: DEFAULT_LIMIT };
  }
}

function formatSearchResults<T extends SearchableItem>(
  result: SearchResult<T>,
  resourceName: string,
  formatItem: (item: T) => string,
  query?: string
): string {
  if (result.items.length === 0) {
    const queryClause = query ? ` for query "${query}"` : '';
    return `# ${resourceName} Search Results\n\nNo results found${queryClause}. Try a different search query, or access the full resource without ?search=.`;
  }

  let text = `# ${resourceName} Search Results\n\n`;
  text += `Found ${result.total} result${result.total !== 1 ? 's' : ''} `;
  text += `(Page ${result.page} of ${result.totalPages})\n\n`;

  for (const item of result.items) {
    text += formatItem(item);
    text += '\n';
  }

  if (result.hasMore) {
    text += `\n---\n\n*Use ?page=${result.page + 1} to see more results*`;
  }

  return text;
}

export async function getResource(uri: string) {
  const { baseUri, searchQuery, page, limit } = parseResourceUri(uri);
  // When bundled by esbuild into dist/index.js, __dirname is dist/.
  // When running source via vitest, __dirname is src/resources/.
  // In both cases the data dir is a sibling of the running file's parent's
  // 'data' folder — i.e. either dist/data/ or ../data/ (src/data/).
  // The dist/ case is what production uses; ../data covers the source case.
  const dataDir = fs.existsSync(path.join(__dirname, 'data'))
    ? path.join(__dirname, 'data')
    : path.join(__dirname, '..', 'data');

  try {
    switch (baseUri) {
      case 'orderly://overview': {
        if (searchQuery) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: 'Search is not supported for overview. Access the full resource without search parameter.',
              },
            ],
          };
        }

        const content = fs.readFileSync(path.join(dataDir, 'resources', 'overview.md'), 'utf-8');
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: content,
            },
          ],
        };
      }

      case 'orderly://sdk/hooks': {
        // Backed by the type-accurate SDK symbol bundle (see
        // scripts/generate_sdk_symbols.js) rather than the legacy curated
        // sdk-patterns.json. Exposes only hooks here; the search_orderly_docs
        // tool returns full inline records for hooks/types/components/functions.
        const bundle = JSON.parse(fs.readFileSync(path.join(dataDir, 'sdk-symbols.json'), 'utf-8'));
        const meta = bundle.metadata || {};

        const allHooks: Array<{
          id: string;
          name: string;
          package: string;
          sourcePath: string;
          description: string;
          returns?: string;
        }> = (bundle.symbols || [])
          .filter((s: { kind: string }) => s.kind === 'hook')
          .map(
            (s: {
              id: string;
              name: string;
              package: string;
              sourcePath: string;
              record: { jsDoc?: string; returns?: string };
            }) => ({
              id: s.id,
              name: s.name,
              package: s.package,
              sourcePath: s.sourcePath,
              description: s.record?.jsDoc || '',
              returns: s.record?.returns,
            })
          );

        if (!searchQuery) {
          const byPackage = new Map<string, number>();
          for (const h of allHooks) byPackage.set(h.package, (byPackage.get(h.package) || 0) + 1);

          let text = '# SDK Hooks Reference\n\n';
          text += `Type-accurate hooks extracted from the Orderly JS SDK `;
          text += `(\`${meta.sourcePackage || '@orderly.network/sdk-docs'}\`@${
            meta.sourceVersion || 'n/a'
          }, git \`${String(meta.gitSha || '').slice(0, 10)}\`).\n\n`;
          text += `**${allHooks.length} hooks** across ${byPackage.size} packages.\n\n`;
          text += '## Hooks by Package\n\n';
          for (const [pkg, count] of [...byPackage.entries()].sort((a, b) => b[1] - a[1])) {
            text += `- **${pkg}**: ${count} hooks\n`;
          }

          text += '\n## How to Search\n\n';
          text += 'To search for specific hooks, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://sdk/hooks?search=useOrderEntry\n';
          text += 'orderly://sdk/hooks?search=position\n';
          text += 'orderly://sdk/hooks?search=wallet\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- Hook names (e.g., `useOrderEntry`)\n';
          text += '- Partial matches (e.g., `order` matches `useOrderEntry`)\n';
          text += '- Package names and docblocks\n\n';
          text +=
            '**Tip:** For full signatures, params, returns, and source provenance, call the\n' +
            '`search_orderly_docs` tool with a hook name — it returns the complete record inline.\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)\n';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const fuse = createFuseSearch(allHooks, [
          { name: 'name', weight: 0.5 },
          { name: 'description', weight: 0.3 },
          { name: 'package', weight: 0.2 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'SDK Hooks',
          (item) => {
            let itemText = `## ${item.name}\n\n`;
            itemText += `**Package:** ${item.package}`;
            if (item.sourcePath) itemText += ` · **Source:** \`${item.sourcePath}\``;
            itemText += '\n\n';
            if (item.description) {
              itemText += `${item.description.split('\n')[0]}\n\n`;
            }
            if (item.returns) {
              itemText += `**Returns:** \`${item.returns}\`\n\n`;
            }
            itemText += '---\n';
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      case 'orderly://sdk/components': {
        const guides = JSON.parse(
          fs.readFileSync(path.join(dataDir, 'component-guides.json'), 'utf-8')
        );
        const bundle = JSON.parse(fs.readFileSync(path.join(dataDir, 'sdk-symbols.json'), 'utf-8'));
        const meta = bundle.metadata || {};

        const guideNames = new Set<string>(guides.components.map((c: { name: string }) => c.name));

        const allComponents: Array<{
          id: string;
          name: string;
          description: string;
          keyHooks: string[];
          package?: string;
          sourcePath?: string;
        }> = [];

        for (const component of guides.components) {
          allComponents.push({
            id: component.name,
            name: component.name,
            description: component.description,
            keyHooks: component.keyHooks,
          });
        }

        for (const s of bundle.symbols || []) {
          if (s.kind !== 'component') continue;
          if (guideNames.has(s.name)) continue;
          allComponents.push({
            id: s.id,
            name: s.name,
            description: s.record?.jsDoc || s.record?.displayName || '',
            keyHooks: [],
            package: s.package,
            sourcePath: s.sourcePath,
          });
        }

        if (!searchQuery) {
          const withGuides = guides.components.length;
          const symbolOnly = allComponents.length - withGuides;

          let text = '# SDK Components Reference\n\n';
          text += 'Type-accurate components extracted from the Orderly JS SDK ';
          text += `(\`${meta.sourcePackage || '@orderly.network/sdk-docs'}\`@${
            meta.sourceVersion || 'n/a'
          }, git \`${String(meta.gitSha || '').slice(0, 10)}\`).\n\n`;
          text += `**${allComponents.length} components**: ${withGuides} with curated building guides, ${symbolOnly} type-accurate symbol-only.\n\n`;
          text += '## Sample Components\n\n';

          const sampleComponents = allComponents.slice(0, 15);
          for (const component of sampleComponents) {
            const pkg = component.package ? ` (\`${component.package}\`)` : '';
            text += `- **${component.name}**: ${component.description.substring(0, 80)}...${pkg}\n`;
          }

          if (allComponents.length > 15) {
            text += `- ... and ${allComponents.length - 15} more components\n`;
          }

          text += '\n## How to Search\n\n';
          text += 'To search for specific components, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://sdk/components?search=Checkbox\n';
          text += 'orderly://sdk/components?search=order%20entry\n';
          text += 'orderly://sdk/components?search=OrderlyAppProvider\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- Component names (e.g., `OrderEntry`)\n';
          text += '- Partial matches (e.g., `check` matches `Checkbox`)\n';
          text += '- Related hooks (e.g., `useOrderEntry`)\n';
          text += '- Package names, source paths, and docblocks\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)\n';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const fuse = createFuseSearch(allComponents, [
          { name: 'name', weight: 0.4 },
          { name: 'description', weight: 0.3 },
          { name: 'keyHooks', weight: 0.2 },
          { name: 'package', weight: 0.1 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'SDK Components',
          (item) => {
            let itemText = `## ${item.name}\n\n`;
            if (item.package) {
              itemText += `**Package:** ${item.package}`;
              if (item.sourcePath) itemText += ` · **Source:** \`${item.sourcePath}\``;
              itemText += '\n\n';
            }
            itemText += `${item.description}\n\n`;
            if (item.keyHooks.length > 0) {
              itemText += `**Key Hooks:** ${item.keyHooks.join(', ')}\n\n`;
            }
            itemText += '---\n';
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      case 'orderly://contracts': {
        const contracts = JSON.parse(
          fs.readFileSync(path.join(dataDir, 'contracts.json'), 'utf-8')
        );

        // Contracts resource returns all data as JSON (no search needed - manageable size)
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(contracts, null, 2),
            },
          ],
        };
      }

      case 'orderly://workflows': {
        const workflows = JSON.parse(
          fs.readFileSync(path.join(dataDir, 'workflows.json'), 'utf-8')
        );

        if (!searchQuery) {
          let text = '# Common Workflows\n\n';
          text += `Step-by-step guides for ${workflows.workflows.length} common Orderly development tasks.\n\n`;
          text += '## Available Workflows\n\n';

          for (const workflow of workflows.workflows.slice(0, 10)) {
            text += `### ${workflow.name}\n`;
            text += `${workflow.description.substring(0, 100)}...\n`;
            text += `*${workflow.steps.length} steps*\n\n`;
          }

          if (workflows.workflows.length > 10) {
            text += `*... and ${workflows.workflows.length - 10} more workflows*\n\n`;
          }

          text += '## How to Search\n\n';
          text += 'To search for specific workflows, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://workflows?search=wallet\n';
          text += 'orderly://workflows?search=fee%20configuration\n';
          text += 'orderly://workflows?search=API%20credentials\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- Workflow names (e.g., `wallet connection`)\n';
          text += '- Step titles and descriptions\n';
          text += '- Keywords in descriptions\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)\n';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const allWorkflows: Array<{
          id: string;
          name: string;
          description: string;
          steps: Array<{ title: string; description: string }>;
        }> = [];

        for (const workflow of workflows.workflows) {
          allWorkflows.push({
            id: workflow.name,
            name: workflow.name,
            description: workflow.description,
            steps: workflow.steps,
          });
        }

        const fuse = createFuseSearch(allWorkflows, [
          { name: 'name', weight: 0.4 },
          { name: 'description', weight: 0.3 },
          { name: 'steps.title', weight: 0.2 },
          { name: 'steps.description', weight: 0.1 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'Workflows',
          (item) => {
            let itemText = `## ${item.name}\n\n`;
            itemText += `${item.description}\n\n`;
            if (item.steps.length > 0) {
              itemText += '**Steps:**\n';
              for (const step of item.steps.slice(0, 3)) {
                itemText += `- ${step.title}\n`;
              }
              if (item.steps.length > 3) {
                itemText += `- ... and ${item.steps.length - 3} more\n`;
              }
              itemText += '\n';
            }
            itemText += '---\n';
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      case 'orderly://api/rest': {
        const api = JSON.parse(fs.readFileSync(path.join(dataDir, 'api.json'), 'utf-8'));

        if (!searchQuery) {
          let text = '# REST API Reference\n\n';
          text += `Complete REST API documentation with ${api.rest.endpoints.length} endpoints.\n\n`;
          text += `**Base URLs:**\n`;
          text += `- Mainnet: ${api.rest.baseUrl.mainnet}\n`;
          text += `- Testnet: ${api.rest.baseUrl.testnet}\n\n`;
          text += '## Endpoint Categories\n\n';

          const endpointsByTag = new Map<string, number>();
          for (const endpoint of api.rest.endpoints) {
            const tag = endpoint.tags?.[0] || 'general';
            endpointsByTag.set(tag, (endpointsByTag.get(tag) || 0) + 1);
          }

          for (const [tag, count] of endpointsByTag) {
            text += `- **${tag}**: ${count} endpoints\n`;
          }

          text += '\n## Sample Endpoints\n\n';
          const sampleEndpoints = api.rest.endpoints.slice(0, 10);
          for (const endpoint of sampleEndpoints) {
            text += `- ${endpoint.method} ${endpoint.path}\n`;
          }
          if (api.rest.endpoints.length > 10) {
            text += `- ... and ${api.rest.endpoints.length - 10} more endpoints\n`;
          }

          text += '\n## How to Search\n\n';
          text += 'To search for specific endpoints, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://api/rest?search=order\n';
          text += 'orderly://api/rest?search=POST%20position\n';
          text += 'orderly://api/rest?search=balance\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- HTTP methods (e.g., `GET`, `POST`)\n';
          text += '- Endpoint paths (e.g., `/v1/order`)\n';
          text += '- Descriptions and summaries\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)\n';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const allEndpoints: Array<{
          id: string;
          name: string;
          description: string;
          method: string;
          path: string;
          auth: boolean;
        }> = [];

        for (const endpoint of api.rest.endpoints) {
          allEndpoints.push({
            id: `${endpoint.method} ${endpoint.path}`,
            name: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
            description: endpoint.description,
            method: endpoint.method,
            path: endpoint.path,
            auth: endpoint.auth,
          });
        }

        const fuse = createFuseSearch(allEndpoints, [
          { name: 'name', weight: 0.3 },
          { name: 'path', weight: 0.3 },
          { name: 'description', weight: 0.3 },
          { name: 'method', weight: 0.1 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'REST API Endpoints',
          (item) => {
            let itemText = `### ${item.method} ${item.path}\n\n`;
            itemText += `${item.description}\n\n`;
            if (item.auth) {
              itemText += '🔒 Requires authentication\n\n';
            }
            itemText += '---\n';
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      case 'orderly://api/websocket': {
        const api = JSON.parse(fs.readFileSync(path.join(dataDir, 'api.json'), 'utf-8'));

        if (!searchQuery) {
          let text = '# WebSocket API Reference\n\n';
          text += `Real-time WebSocket streams documentation with ${api.websocket.streams.length} available streams.\n\n`;
          text += `**Base URLs:**\n`;
          text += `- Mainnet: ${api.websocket.baseUrl.mainnet}\n`;
          text += `- Testnet: ${api.websocket.baseUrl.testnet}\n\n`;
          text += '## Available Streams\n\n';

          const sampleStreams = api.websocket.streams.slice(0, 15);
          for (const stream of sampleStreams) {
            const authIndicator = stream.auth ? '🔒 ' : '';
            text += `- ${authIndicator}**${stream.name}** (${stream.topic})\n`;
          }
          if (api.websocket.streams.length > 15) {
            text += `- ... and ${api.websocket.streams.length - 15} more streams\n`;
          }

          text += '\n## How to Search\n\n';
          text += 'To search for specific streams, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://api/websocket?search=orderbook\n';
          text += 'orderly://api/websocket?search=position%20stream\n';
          text += 'orderly://api/websocket?search=ticker\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- Stream names (e.g., `orderbook`, `ticker`)\n';
          text += '- Topics (e.g., `@orderbook`, `@position`)\n';
          text += '- Descriptions\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const allStreams: Array<{
          id: string;
          name: string;
          description: string;
          topic: string;
          auth: boolean;
        }> = [];

        for (const stream of api.websocket.streams) {
          allStreams.push({
            id: stream.topic,
            name: stream.name,
            description: stream.description,
            topic: stream.topic,
            auth: stream.auth,
          });
        }

        const fuse = createFuseSearch(allStreams, [
          { name: 'name', weight: 0.4 },
          { name: 'topic', weight: 0.3 },
          { name: 'description', weight: 0.3 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'WebSocket Streams',
          (item) => {
            let itemText = `### ${item.name}\n\n`;
            itemText += `**Topic:** ${item.topic}\n\n`;
            itemText += `${item.description}\n\n`;
            if (item.auth) {
              itemText += '🔒 Requires authentication\n\n';
            }
            itemText += '---\n';
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      case 'orderly://api/indexer': {
        const indexerApi = JSON.parse(
          fs.readFileSync(path.join(dataDir, 'indexer-api.json'), 'utf-8')
        );

        if (!searchQuery) {
          let text = '# Indexer API Reference\n\n';
          text += `${indexerApi.description}\n\n`;
          text += `**Version:** ${indexerApi.version}\n\n`;
          text += `**Base URLs:**\n`;
          text += `- Mainnet: ${indexerApi.baseUrl.mainnet}\n`;
          text += `- Testnet: ${indexerApi.baseUrl.testnet}\n\n`;
          text += '## Categories\n\n';

          for (const category of indexerApi.categories) {
            text += `### ${category.name}\n\n`;
            text += `${category.description}\n\n`;
            text += `**${category.endpoints.length} endpoints:**\n`;
            for (const endpoint of category.endpoints.slice(0, 5)) {
              text += `- ${endpoint.method} ${endpoint.path} - ${endpoint.summary}\n`;
            }
            if (category.endpoints.length > 5) {
              text += `- ... and ${category.endpoints.length - 5} more\n`;
            }
            text += '\n';
          }

          text += '## How to Search\n\n';
          text += 'To search for specific endpoints, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://api/indexer?search=daily_volume\n';
          text += 'orderly://api/indexer?search=events\n';
          text += 'orderly://api/indexer?search=ranking\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- Endpoint paths (e.g., `/daily_volume`, `/events_v2`)\n';
          text += '- Operation IDs (e.g., `daily_volume`, `list_events`)\n';
          text += '- Summaries and descriptions\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const allEndpoints: Array<{
          id: string;
          name: string;
          description: string;
          method: string;
          path: string;
          summary: string;
          operationId: string;
        }> = [];

        for (const endpoint of indexerApi.endpoints) {
          allEndpoints.push({
            id: endpoint.operationId || `${endpoint.method} ${endpoint.path}`,
            name: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
            description: endpoint.description,
            method: endpoint.method,
            path: endpoint.path,
            summary: endpoint.summary,
            operationId: endpoint.operationId,
          });
        }

        const fuse = createFuseSearch(allEndpoints, [
          { name: 'name', weight: 0.3 },
          { name: 'path', weight: 0.3 },
          { name: 'description', weight: 0.3 },
          { name: 'operationId', weight: 0.1 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'Indexer API Endpoints',
          (item) => {
            let itemText = `### ${item.method} ${item.path}\n\n`;
            itemText += `**${item.summary}**\n\n`;
            if (item.description) {
              itemText += `${item.description}\n\n`;
            }
            itemText += '---\n';
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      case 'orderly://api/public-info': {
        const publicInfoApi = JSON.parse(
          fs.readFileSync(path.join(dataDir, 'public-info-api.json'), 'utf-8')
        );

        if (!searchQuery) {
          let text = '# Public Info API Reference\n\n';
          text += `${publicInfoApi.description}\n\n`;
          text += `**Endpoint:** ${publicInfoApi.endpoint.method} ${publicInfoApi.endpoint.url}\n`;
          text += `**Auth:** none\n\n`;
          text += '## Categories\n\n';

          for (const category of publicInfoApi.categories) {
            text += `### ${category.title} (\`${category.name}\`) — ${category.queryTypes.length} types\n\n`;
            for (const typeName of category.queryTypes) {
              const qt = publicInfoApi.queryTypes.find(
                (q: { type: string; description: string; weight?: number | null }) =>
                  q.type === typeName
              );
              if (qt) {
                text += `- \`${qt.type}\` (weight ${qt.weight ?? '?'}) — ${qt.description}\n`;
              }
            }
            text += '\n';
          }

          text += '## How to Search\n\n';
          text += 'To search for specific query types, add a `?search=` query parameter:\n\n';
          text += '```\n';
          text += 'orderly://api/public-info?search=accountState\n';
          text += 'orderly://api/public-info?search=orderbook\n';
          text += 'orderly://api/public-info?search=whale\n';
          text += '```\n\n';
          text += '**Search supports:**\n';
          text += '- Query type names (e.g., `marketSummary`, `accountState`)\n';
          text += '- Titles (e.g., `Market summary`)\n';
          text += '- Descriptions and notes\n\n';
          text += '**Pagination:**\n';
          text += '- Use `?page=2` to see more results\n';
          text += '- Use `?limit=5` to change results per page (max 10)';

          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text,
              },
            ],
          };
        }

        const allTypes: Array<{
          id: string;
          name: string;
          description: string;
          category: string;
          weight: number | null;
        }> = [];

        for (const qt of publicInfoApi.queryTypes) {
          allTypes.push({
            id: qt.type,
            name: qt.title,
            description: qt.description,
            category: qt.category,
            weight: qt.weight,
          });
        }

        const fuse = createFuseSearch(allTypes, [
          { name: 'id', weight: 0.4 },
          { name: 'name', weight: 0.3 },
          { name: 'description', weight: 0.3 },
        ]);

        const result = searchWithPagination(fuse, { query: searchQuery, page, limit });

        const text = formatSearchResults(
          result,
          'Public Info API Query Types',
          (item) => {
            let itemText = `## ${item.id}\n\n`;
            itemText += `**${item.name}** · category: ${item.category} · weight: ${item.weight ?? '?'}\n\n`;
            itemText += `${item.description}\n\n---\n`;
            return itemText;
          },
          searchQuery
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text,
            },
          ],
        };
      }

      default:
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Resource not found: ${uri}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error loading resource: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
