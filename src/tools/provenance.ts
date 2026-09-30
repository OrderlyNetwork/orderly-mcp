import documentationData from '../data/documentation.json' with { type: 'json' };
import sdkSymbolsData from '../data/sdk-symbols.json' with { type: 'json' };

interface SdkSymbolsMetadata {
  sourcePackage: string;
  sourceVersion: string;
  gitSha?: string;
  generatedAt: string;
}

interface DocumentationMetadata {
  lastUpdated?: string;
}

/**
 * One-line provenance appended to tool responses so calling agents can reason
 * about data freshness. Kept deliberately compact.
 */
export function provenanceFooter(corpus: 'sdk' | 'docs'): string {
  const meta = (sdkSymbolsData as { metadata: SdkSymbolsMetadata }).metadata;

  let line =
    `\n\n---\n*provenance: symbols=${meta.sourcePackage}@${meta.sourceVersion}` +
    ` · git ${String(meta.gitSha ?? 'unknown').slice(0, 10)}` +
    ` · generated ${String(meta.generatedAt).slice(0, 10)}*`;

  if (corpus === 'docs') {
    const docsMeta = (documentationData as { metadata?: DocumentationMetadata }).metadata;
    if (docsMeta?.lastUpdated) {
      line += ` · docs corpus updated ${docsMeta.lastUpdated}`;
    }
  }

  return line;
}
