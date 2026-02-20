export const ORDERLY_MCP_VERSION = 'latest';

export interface ClientConfig {
  name: string;
  label: string;
  configPath: string;
  config: Record<string, unknown> | string;
  isToml?: boolean;
}

export const CLIENTS: ClientConfig[] = [
  {
    name: 'claude',
    label: 'Claude Code',
    configPath: '.mcp.json',
    config: {
      mcpServers: {
        orderly: {
          command: 'npx',
          args: [`@orderly.network/mcp-server@${ORDERLY_MCP_VERSION}`],
        },
      },
    },
  },
  {
    name: 'cursor',
    label: 'Cursor',
    configPath: '.cursor/mcp.json',
    config: {
      mcpServers: {
        orderly: {
          command: 'npx',
          args: [`@orderly.network/mcp-server@${ORDERLY_MCP_VERSION}`],
        },
      },
    },
  },
  {
    name: 'vscode',
    label: 'VS Code',
    configPath: '.vscode/mcp.json',
    config: {
      servers: {
        orderly: {
          command: 'npx',
          args: [`@orderly.network/mcp-server@${ORDERLY_MCP_VERSION}`],
        },
      },
    },
  },
  {
    name: 'codex',
    label: 'Codex',
    configPath: '.codex/config.toml',
    isToml: true,
    config: `[mcp_servers.orderly]
command = "npx"
args = ["@orderly.network/mcp-server@${ORDERLY_MCP_VERSION}"]
`,
  },
  {
    name: 'opencode',
    label: 'OpenCode',
    configPath: '.opencode/mcp.json',
    config: {
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        orderly: {
          type: 'local',
          command: ['npx', `@orderly.network/mcp-server@${ORDERLY_MCP_VERSION}`],
          enabled: true,
        },
      },
    },
  },
] as const;

export const DEPENDENCIES = [`@orderly.network/mcp-server@${ORDERLY_MCP_VERSION}`];

export function getClientConfig(clientName: string): ClientConfig | undefined {
  return CLIENTS.find((c) => c.name === clientName);
}
