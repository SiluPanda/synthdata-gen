import { describe, it, expect } from 'vitest';
import {
  deduplicate,
  normalizeText,
  getNgrams,
  jaccardSimilarity,
  cosineSimilarity,
  hash,
  canonicalize,
} from '../dedup';

// ── Utility function tests ──

describe('normalizeText', () => {
  it('should lowercase text', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('should collapse whitespace', () => {
    expect(normalizeText('hello   world\t\nfoo')).toBe('hello world foo');
  });

  it('should trim leading/trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('getNgrams', () => {
  it('should compute bigrams', () => {
    const ngrams = getNgrams('the quick brown fox', 2);
    expect(ngrams.has('the quick')).toBe(true);
    expect(ngrams.has('quick brown')).toBe(true);
    expect(ngrams.has('brown fox')).toBe(true);
    expect(ngrams.size).toBe(3);
  });

  it('should compute trigrams', () => {
    const ngrams = getNgrams('the quick brown fox', 3);
    expect(ngrams.has('the quick brown')).toBe(true);
    expect(ngrams.has('quick brown fox')).toBe(true);
    expect(ngrams.size).toBe(2);
  });

  it('should handle text shorter than n', () => {
    const ngrams = getNgrams('hello', 2);
    expect(ngrams.size).toBe(1);
    expect(ngrams.has('hello')).toBe(true);
  });

  it('should normalize text before computing ngrams', () => {
    const ngrams = getNgrams('The  Quick  Brown', 2);
    expect(ngrams.has('the quick')).toBe(true);
  });
});

describe('jaccardSimilarity', () => {
  it('should return 1 for identical sets', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['a', 'b', 'c']);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it('should return 0 for disjoint sets', () => {
    const a = new Set(['a', 'b']);
    const b = new Set(['c', 'd']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it('should compute correct similarity', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd']);
    // intersection: {b, c} = 2, union: {a, b, c, d} = 4
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });

  it('should handle empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
    expect(jaccardSimilarity(new Set(), new Set(['a']))).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('should return -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('should handle zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('should return 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});

describe('hash', () => {
  it('should produce consistent hashes', () => {
    expect(hash('hello')).toBe(hash('hello'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(hash('hello')).not.toBe(hash('world'));
  });
});

describe('canonicalize', () => {
  it('should normalize string fields', () => {
    const result = canonicalize({ text: 'Hello  World' });
    expect(result).toContain('hello world');
  });

  it('should serialize non-string fields', () => {
    const result = canonicalize({ count: 42, active: true });
    expect(result).toContain('42');
    expect(result).toContain('true');
  });

  it('should use specified fields only', () => {
    const result = canonicalize({ a: 'one', b: 'two', c: 'three' }, ['a', 'c']);
    expect(result).toContain('one');
    expect(result).toContain('three');
    expect(result).not.toContain('two');
  });

  it('should exclude _meta field by default', () => {
    const result = canonicalize({ text: 'hello', _meta: { id: '1' } });
    expect(result).not.toContain('_meta');
  });
});

// ── Exact dedup tests ──

describe('deduplicate - exact', () => {
  it('should remove exact duplicates', async () => {
    const examples = [
      { text: 'hello world', label: 'greeting' },
      { text: 'hello world', label: 'greeting' },
      { text: 'goodbye world', label: 'farewell' },
    ];
    const result = await deduplicate(examples, { strategy: 'exact' });
    expect(result.data).toHaveLength(2);
    expect(result.removed).toBe(1);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0][2]).toBe(1.0);
  });

  it('should normalize before comparison', async () => {
    const examples = [
      { text: 'Hello  World', label: 'greeting' },
      { text: 'hello world', label: 'greeting' },
    ];
    const result = await deduplicate(examples, { strategy: 'exact' });
    expect(result.data).toHaveLength(1);
    expect(result.removed).toBe(1);
  });

  it('should keep first occurrence', async () => {
    const examples = [
      { text: 'first', id: 1 },
      { text: 'first', id: 2 },
    ];
    const result = await deduplicate(examples, { strategy: 'exact', fields: ['text'] });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
  });

  it('should handle no duplicates', async () => {
    const examples = [
      { text: 'one' },
      { text: 'two' },
      { text: 'three' },
    ];
    const result = await deduplicate(examples, { strategy: 'exact' });
    expect(result.data).toHaveLength(3);
    expect(result.removed).toBe(0);
  });

  it('should handle empty array', async () => {
    const result = await deduplicate([], { strategy: 'exact' });
    expect(result.data).toHaveLength(0);
    expect(result.removed).toBe(0);
  });

  it('should handle single element', async () => {
    const result = await deduplicate([{ text: 'solo' }], { strategy: 'exact' });
    expect(result.data).toHaveLength(1);
    expect(result.removed).toBe(0);
  });

  it('should dedup by specific fields', async () => {
    const examples = [
      { text: 'hello', label: 'a' },
      { text: 'hello', label: 'b' },
    ];
    // Dedup only on text field
    const result = await deduplicate(examples, { strategy: 'exact', fields: ['text'] });
    expect(result.data).toHaveLength(1);

    // Dedup on all fields - different labels mean not duplicates
    const result2 = await deduplicate(examples, { strategy: 'exact' });
    expect(result2.data).toHaveLength(2);
  });
});

// ── Near-duplicate tests ──

describe('deduplicate - near', () => {
  it('should detect near-duplicates with high similarity', async () => {
    const examples = [
      { text: 'The quick brown fox jumps over the lazy dog' },
      { text: 'The quick brown fox jumps over the lazy cat' }, // very similar
      { text: 'Something completely different about programming languages' },
    ];
    const result = await deduplicate(examples, { strategy: 'near', threshold: 0.7 });
    expect(result.data).toHaveLength(2);
    expect(result.removed).toBe(1);
  });

  it('should keep dissimilar examples', async () => {
    const examples = [
      { text: 'Machine learning is a subset of artificial intelligence' },
      { text: 'React is a JavaScript library for building user interfaces' },
      { text: 'Python is a versatile programming language for data science' },
    ];
    const result = await deduplicate(examples, { strategy: 'near', threshold: 0.85 });
    expect(result.data).toHaveLength(3);
  });

  it('should respect threshold parameter', async () => {
    const examples = [
      { text: 'apple banana cherry date elderberry' },
      { text: 'apple banana cherry date fig' },
    ];
    // Low threshold: these are similar enough
    const low = await deduplicate(examples, { strategy: 'near', threshold: 0.5 });
    expect(low.data).toHaveLength(1);

    // High threshold: not similar enough
    const high = await deduplicate(examples, { strategy: 'near', threshold: 0.95 });
    expect(high.data).toHaveLength(2);
  });

  it('should also remove exact duplicates', async () => {
    const examples = [
      { text: 'exact same' },
      { text: 'exact same' },
      { text: 'different text' },
    ];
    const result = await deduplicate(examples, { strategy: 'near', threshold: 0.85 });
    expect(result.data).toHaveLength(2);
  });

  it('should use specified ngramSize', async () => {
    const examples = [
      { text: 'one two three four five six seven eight' },
      { text: 'one two three four five six seven nine' },
    ];
    // With larger ngrams, similarity decreases
    const bigrams = await deduplicate(examples, { strategy: 'near', threshold: 0.7, ngramSize: 2 });
    const trigrams = await deduplicate(examples, { strategy: 'near', threshold: 0.7, ngramSize: 3 });

    // Both should work, but trigrams detect less similarity
    expect(bigrams.data.length).toBeLessThanOrEqual(trigrams.data.length);
  });
});

// ── Semantic dedup tests ──

describe('deduplicate - semantic', () => {
  it('should require embedder function', async () => {
    await expect(
      deduplicate([{ text: 'hello' }, { text: 'world' }], { strategy: 'semantic' }),
    ).rejects.toThrow('embedder');
  });

  it('should use embedder for semantic comparison', async () => {
    const examples = [
      { text: 'Hello world' },
      { text: 'Hi world' },
      { text: 'Completely different' },
    ];

    // Mock embedder: similar texts get similar vectors
    const embedder = async (text: string) => {
      if (text.includes('world')) return [1, 0, 0];
      return [0, 1, 0];
    };

    const result = await deduplicate(examples, {
      strategy: 'semantic',
      threshold: 0.9,
      embedder,
    });
    expect(result.data).toHaveLength(2);
  });
});

// ── Strategy 'none' ──

describe('deduplicate - none', () => {
  it('should not remove anything', async () => {
    const examples = [
      { text: 'hello' },
      { text: 'hello' },
      { text: 'hello' },
    ];
    const result = await deduplicate(examples, { strategy: 'none' });
    expect(result.data).toHaveLength(3);
    expect(result.removed).toBe(0);
  });
});

// ── Cross-set dedup ──

describe('cross-set deduplication', () => {
  it('should remove examples matching existing data', async () => {
    const existing = [
      { text: 'existing example one' },
      { text: 'existing example two' },
    ];
    const generated = [
      { text: 'existing example one' }, // duplicate of existing
      { text: 'brand new example' },
    ];
    const result = await deduplicate(generated, {
      strategy: 'exact',
      existingData: existing,
    });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as Record<string, string>).text).toBe('brand new example');
  });

  it('should handle empty existing data', async () => {
    const result = await deduplicate(
      [{ text: 'hello' }],
      { strategy: 'exact', existingData: [] },
    );
    expect(result.data).toHaveLength(1);
  });
});

// ── Default options ──

describe('deduplicate - default options', () => {
  it('should default to exact strategy', async () => {
    const examples = [
      { text: 'hello' },
      { text: 'hello' },
    ];
    const result = await deduplicate(examples);
    expect(result.data).toHaveLength(1);
    expect(result.removed).toBe(1);
  });
});
