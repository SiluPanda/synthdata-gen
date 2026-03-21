import { createHash } from 'node:crypto';
import type { DedupOptions, DedupResult } from './types';

/**
 * Normalize a string for comparison: lowercase, collapse whitespace, trim.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build a canonical string from an example for hashing.
 */
function canonicalize(
  example: Record<string, unknown>,
  fields?: string[],
): string {
  const keys = fields || Object.keys(example).filter(k => k !== '_meta').sort();
  const parts: string[] = [];

  for (const key of keys) {
    const val = example[key];
    if (val === undefined) continue;
    if (typeof val === 'string') {
      parts.push(`${key}:${normalizeText(val)}`);
    } else {
      parts.push(`${key}:${JSON.stringify(val)}`);
    }
  }

  return parts.join('|');
}

/**
 * Compute a hash of a string.
 */
function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

/**
 * Extract word n-grams from a string.
 */
function getNgrams(text: string, n: number): Set<string> {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const ngrams = new Set<string>();

  if (words.length < n) {
    ngrams.add(words.join(' '));
    return ngrams;
  }

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }

  return ngrams;
}

/**
 * Compute Jaccard similarity between two sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;

  for (const item of smaller) {
    if (larger.has(item)) {
      intersection++;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Get the text content of an example for n-gram comparison.
 */
function getExampleText(
  example: Record<string, unknown>,
  fields?: string[],
): string {
  const keys = fields || Object.keys(example).filter(k => k !== '_meta').sort();
  const parts: string[] = [];

  for (const key of keys) {
    const val = example[key];
    if (typeof val === 'string') {
      parts.push(val);
    }
  }

  return parts.join(' ');
}

/**
 * Exact deduplication: remove examples with identical normalized content.
 */
function exactDedup(
  examples: Record<string, unknown>[],
  fields?: string[],
): DedupResult {
  const seen = new Map<string, number>();
  const kept: Record<string, unknown>[] = [];
  const pairs: Array<[number, number, number]> = [];

  for (let i = 0; i < examples.length; i++) {
    const h = hash(canonicalize(examples[i], fields));
    const existing = seen.get(h);

    if (existing !== undefined) {
      pairs.push([existing, i, 1.0]);
    } else {
      seen.set(h, kept.length);
      kept.push(examples[i]);
    }
  }

  return {
    data: kept,
    removed: examples.length - kept.length,
    pairs,
  };
}

/**
 * Near-duplicate deduplication using Jaccard similarity on n-grams.
 */
function nearDedup(
  examples: Record<string, unknown>[],
  threshold: number,
  ngramSize: number,
  fields?: string[],
): DedupResult {
  // First do exact dedup
  const exactResult = exactDedup(examples, fields);
  const remaining = exactResult.data;
  const allPairs = [...exactResult.pairs];

  // Compute n-grams for all remaining examples
  const ngramSets: Set<string>[] = remaining.map(ex =>
    getNgrams(getExampleText(ex, fields), ngramSize),
  );

  // Mark which indices to remove (from remaining)
  const toRemove = new Set<number>();

  // Pairwise Jaccard comparison
  for (let i = 0; i < remaining.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < remaining.length; j++) {
      if (toRemove.has(j)) continue;
      const sim = jaccardSimilarity(ngramSets[i], ngramSets[j]);
      if (sim >= threshold) {
        toRemove.add(j);
        allPairs.push([i, j, sim]);
      }
    }
  }

  const kept = remaining.filter((_, i) => !toRemove.has(i));

  return {
    data: kept,
    removed: examples.length - kept.length,
    pairs: allPairs,
  };
}

/**
 * Semantic deduplication using cosine similarity on embeddings.
 */
async function semanticDedup(
  examples: Record<string, unknown>[],
  threshold: number,
  embedder: (text: string) => Promise<number[]>,
  fields?: string[],
): Promise<DedupResult> {
  // First do exact dedup
  const exactResult = exactDedup(examples, fields);
  const remaining = exactResult.data;
  const allPairs = [...exactResult.pairs];

  // Compute embeddings
  const texts = remaining.map(ex => getExampleText(ex, fields));
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedder(text));
  }

  // Mark which indices to remove
  const toRemove = new Set<number>();

  // Pairwise cosine similarity
  for (let i = 0; i < remaining.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < remaining.length; j++) {
      if (toRemove.has(j)) continue;
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= threshold) {
        toRemove.add(j);
        allPairs.push([i, j, sim]);
      }
    }
  }

  const kept = remaining.filter((_, i) => !toRemove.has(i));

  return {
    data: kept,
    removed: examples.length - kept.length,
    pairs: allPairs,
  };
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Deduplicate an array of examples.
 */
export async function deduplicate(
  examples: Record<string, unknown>[],
  options?: Partial<DedupOptions>,
): Promise<DedupResult> {
  const strategy = options?.strategy || 'exact';
  const fields = options?.fields;

  if (strategy === 'none' || examples.length <= 1) {
    return { data: [...examples], removed: 0, pairs: [] };
  }

  // Handle cross-set dedup: remove any generated example that matches existing data
  let input = [...examples];
  const crossPairs: Array<[number, number, number]> = [];

  if (options?.existingData && options.existingData.length > 0) {
    const existingHashes = new Set(
      options.existingData.map(ex => hash(canonicalize(ex, fields))),
    );

    const filtered: Record<string, unknown>[] = [];
    for (let i = 0; i < input.length; i++) {
      const h = hash(canonicalize(input[i], fields));
      if (existingHashes.has(h)) {
        crossPairs.push([-1, i, 1.0]);
      } else {
        filtered.push(input[i]);
      }
    }
    input = filtered;
  }

  let result: DedupResult;

  switch (strategy) {
    case 'exact':
      result = exactDedup(input, fields);
      break;
    case 'near':
      result = nearDedup(
        input,
        options?.threshold ?? 0.85,
        options?.ngramSize ?? 2,
        fields,
      );
      break;
    case 'semantic': {
      if (!options?.embedder) {
        throw new Error('Semantic dedup requires an embedder function');
      }
      result = await semanticDedup(
        input,
        options?.threshold ?? 0.92,
        options.embedder,
        fields,
      );
      break;
    }
    default:
      result = exactDedup(input, fields);
  }

  // Add cross-dedup removals to the count
  result.removed += crossPairs.length;
  result.pairs = [...crossPairs, ...result.pairs];

  return result;
}

// Export utilities for testing
export { normalizeText, getNgrams, jaccardSimilarity, cosineSimilarity, hash, canonicalize };
