import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getResource(uri: string) {
  const normalizedUri = uri.toLowerCase().trim();

  try {
    // Load resource files dynamically
    const dataDir = path.join(__dirname, '..', 'data');

    switch (normalizedUri) {
      case 'orderly://overview': {
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
        const patterns = JSON.parse(
          fs.readFileSync(path.join(dataDir, 'sdk-patterns.json'), 'utf-8')
        );

        let text = '# SDK Hooks Reference (v2)\n\n';
        text += 'Complete reference of all available hooks in Orderly SDK v2.\n\n';

        for (const category of patterns.categories) {
          text += `## ${category.name}\n\n`;
          for (const pattern of category.patterns) {
            text += `- **${pattern.name}**: ${pattern.description}\n`;
          }
          text += '\n';
        }

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

        let text = '# Component Building Guides\n\n';
        text += 'Guides for building UI components using Orderly SDK.\n\n';

        for (const component of guides.components) {
          text += `## ${component.name}\n\n`;
          text += `${component.description}\n\n`;
          text += `**Key Hooks:** ${component.keyHooks.join(', ')}\n\n`;
        }

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

        let text = '# Common Workflows\n\n';
        text += 'Step-by-step workflows for Orderly development.\n\n';

        for (const workflow of workflows.workflows) {
          text += `## ${workflow.name}\n\n`;
          text += `${workflow.description}\n\n`;
          text += `**Steps:**\n`;
          workflow.steps.forEach((step: { title: string }) => {
            text += `- ${step.title}\n`;
          });
          text += '\n';
        }

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

        let text = '# REST API Reference\n\n';
        text += `**Mainnet:** ${api.rest.baseUrl.mainnet}\n`;
        text += `**Testnet:** ${api.rest.baseUrl.testnet}\n\n`;
        text += `**Authentication:** ${api.rest.authentication.type}\n\n`;

        text += '## Endpoints\n\n';
        for (const endpoint of api.rest.endpoints) {
          text += `### ${endpoint.method} ${endpoint.path}\n\n`;
          text += `${endpoint.description}\n\n`;
          if (endpoint.auth) {
            text += '🔒 Requires authentication\n\n';
          }
        }

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

        let text = '# WebSocket API Reference\n\n';
        text += `**Mainnet:** ${api.websocket.baseUrl.mainnet}\n`;
        text += `**Testnet:** ${api.websocket.baseUrl.testnet}\n\n`;

        text += '## Streams\n\n';
        for (const stream of api.websocket.streams) {
          text += `### ${stream.name}\n\n`;
          text += `**Topic:** ${stream.topic}\n\n`;
          text += `${stream.description}\n\n`;
          if (stream.auth) {
            text += '🔒 Requires authentication\n\n';
          }
        }

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
