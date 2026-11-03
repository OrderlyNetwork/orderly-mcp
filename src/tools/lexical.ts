/**
 * Small lexical helpers shared by the documentation and workflow search
 * indexes. Exact word matching is what keeps fuzzy matches on common words
 * ("order" → "Orderly", "positon" → "deposit") from outranking the real hits.
 */

/** Lowercase, strip punctuation, and fold simple plurals ("orders" → "order"). */
export function normalizeWord(word: string): string {
  let normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length > 3 && normalized.endsWith('s') && !/(ss|us|is)$/.test(normalized)) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/** Build the set of raw and normalized words in a piece of text. */
export function makeWordSet(text: string): Set<string> {
  const words = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2) continue;
    words.add(raw);
    words.add(normalizeWord(raw));
  }
  return words;
}

/** Add common domain abbreviations that the source text spells out. */
export function addDomainAliases(words: Set<string>, text: string): void {
  const lower = text.toLowerCase();
  if (/take[\s-]?profit/.test(lower)) words.add('tp');
  if (/stop[\s-]?loss/.test(lower)) words.add('sl');
  if (/know your customer/.test(lower)) words.add('kyc');
  if (/perpetual/.test(lower)) words.add('perp');
  if (/real[\s-]?world assets?/.test(lower)) words.add('rwa');
  if (/cross[\s-]?chain/.test(lower)) words.add('crosschain');
}

/** True when two words differ by at most one insertion/deletion/substitution. */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** True when any word in the set is within one edit of the token. */
export function hasNearWord(words: Set<string>, token: string): boolean {
  for (const word of words) {
    if (withinOneEdit(token, word)) return true;
  }
  return false;
}
