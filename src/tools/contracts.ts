import contractData from '../data/contracts.json' with { type: 'json' };

export interface ContractResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface ContractInfo {
  mainnet?: string;
  testnet?: string;
  description?: string;
}

interface ChainContracts {
  chainId: number;
  testnetChainId?: number;
  contracts: Record<string, ContractInfo>;
}

export async function getContractAddresses(
  chain: string,
  contractType: string = 'all',
  network: string = 'mainnet'
): Promise<ContractResult> {
  const normalizedChain = chain.toLowerCase().trim();
  const normalizedContractType = contractType.toLowerCase().trim();
  const normalizedNetwork = network.toLowerCase().trim();

  // Validate network
  if (!['mainnet', 'testnet'].includes(normalizedNetwork)) {
    return {
      content: [
        {
          type: 'text',
          text: `Invalid network: ${network}. Must be 'mainnet' or 'testnet'.`,
        },
      ],
    };
  }

  // Find chain data
  const chainData = (contractData as Record<string, ChainContracts>)[normalizedChain];

  if (!chainData) {
    const availableChains = Object.keys(contractData).join(', ');
    return {
      content: [
        {
          type: 'text',
          text: `Chain "${chain}" not found. Available chains: ${availableChains}`,
        },
      ],
    };
  }

  // Build response
  let text = `# ${chain.charAt(0).toUpperCase() + chain.slice(1)} Contract Addresses\n\n`;
  text += `**Chain ID:** ${normalizedNetwork === 'mainnet' ? chainData.chainId : chainData.testnetChainId || 'N/A'}\n\n`;

  const contracts = chainData.contracts;

  if (normalizedContractType === 'all') {
    text += `## All Contracts (${network})\n\n`;

    for (const [name, info] of Object.entries(contracts)) {
      const address = normalizedNetwork === 'mainnet' ? info.mainnet : info.testnet;

      if (address) {
        text += `### ${name}\n`;
        if (info.description) {
          text += `${info.description}\n\n`;
        }
        text += `**Address:** \`${address}\`\n\n`;
      }
    }
  } else {
    // Find specific contract
    const contract =
      contracts[contractType.toUpperCase()] ||
      contracts[contractType] ||
      contracts[
        Object.keys(contracts).find((k) => k.toLowerCase() === normalizedContractType) || ''
      ];

    if (!contract) {
      const availableContracts = Object.keys(contracts).join(', ');
      return {
        content: [
          {
            type: 'text',
            text: `Contract type "${contractType}" not found on ${chain}. Available types: ${availableContracts}`,
          },
        ],
      };
    }

    const address = normalizedNetwork === 'mainnet' ? contract.mainnet : contract.testnet;

    text += `## ${contractType.toUpperCase()}\n\n`;
    if (contract.description) {
      text += `${contract.description}\n\n`;
    }

    if (address) {
      text += `**${network} Address:** \`${address}\`\n\n`;
    } else {
      text += `**${network} Address:** Not available\n\n`;
    }

    // Show both networks if available
    if (contract.mainnet && contract.testnet) {
      text += `### Other Networks\n`;
      if (normalizedNetwork === 'mainnet' && contract.testnet) {
        text += `- **Testnet:** \`${contract.testnet}\`\n`;
      } else if (normalizedNetwork === 'testnet' && contract.mainnet) {
        text += `- **Mainnet:** \`${contract.mainnet}\`\n`;
      }
    }
  }

  return {
    content: [{ type: 'text', text }],
  };
}
