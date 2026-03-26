import { describe, it, expect } from 'vitest';
import { generate } from '../pipeline';
import type { ExampleSchema, LlmFunction } from '../types';

const simpleSchema: ExampleSchema = {
  fields: {
    instruction: { type: 'string', min: 10, max: 200, description: 'A clear instruction' },
    output: { type: 'string', min: 20, max: 500, description: 'The expected response' },
    category: { type: 'enum', enum: ['coding', 'writing', 'reasoning'] },
  },
};

const numericSchema: ExampleSchema = {
  fields: {
    name: { type: 'string', min: 3, max: 50 },
    score: { type: 'number', min: 0, max: 100 },
  },
};

// ── Template-based generation (no LLM) ──

describe('generate - template-based (no LLM)', () => {
  it('should generate requested number of examples', async () => {
    const result = await generate(simpleSchema, { count: 10 });
    expect(result.data.length).toBeLessThanOrEqual(10);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should produce valid examples', async () => {
    const result = await generate(simpleSchema, { count: 5 });
    for (const example of result.data) {
      expect(typeof example.instruction).toBe('string');
      expect(typeof example.output).toBe('string');
      expect(['coding', 'writing', 'reasoning']).toContain(example.category);
    }
  });

  it('should include _meta on each example', async () => {
    const result = await generate(simpleSchema, { count: 3 });
    for (const example of result.data) {
      expect(example._meta).toBeDefined();
      expect(example._meta!.id).toBeDefined();
      expect(typeof example._meta!.index).toBe('number');
      expect(typeof example._meta!.batchIndex).toBe('number');
    }
  });

  it('should populate stats', async () => {
    const result = await generate(simpleSchema, { count: 5 });
    expect(result.stats.total).toBeGreaterThan(0);
    expect(result.stats.valid).toBeGreaterThan(0);
    expect(result.stats.final).toBeGreaterThan(0);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should deduplicate by default (exact)', async () => {
    const result = await generate(simpleSchema, { count: 20 });
    expect(result.stats.deduped).toBeGreaterThanOrEqual(0);
    expect(result.stats.final).toBeLessThanOrEqual(result.stats.valid);
  });

  it('should support dedup strategy none', async () => {
    const result = await generate(simpleSchema, {
      count: 5,
      dedup: { strategy: 'none' },
    });
    expect(result.stats.deduped).toBe(0);
  });

  it('should respect count limit', async () => {
    const result = await generate(simpleSchema, { count: 3 });
    expect(result.data.length).toBeLessThanOrEqual(3);
  });

  it('should track validation stats', async () => {
    const result = await generate(simpleSchema, { count: 10 });
    expect(result.stats.total).toBe(result.stats.valid + result.stats.invalid);
  });
});

// ── Custom generateFn ──

describe('generate - custom generateFn', () => {
  it('should use provided generateFn', async () => {
    const generateFn = (_schema: ExampleSchema, _batchIdx: number) => [
      {
        instruction: 'Custom generated instruction for testing',
        output: 'Custom generated output for testing that is long enough',
        category: 'coding',
      },
    ];

    const result = await generate(simpleSchema, {
      count: 3,
      generateFn,
    });

    expect(result.data.length).toBeGreaterThan(0);
    expect((result.data[0] as Record<string, unknown>).instruction).toContain('Custom generated');
  });

  it('should validate generateFn output', async () => {
    const generateFn = () => [
      {
        instruction: 'ok', // too short, will fail validation
        output: 'x', // too short
        category: 'invalid', // not in enum
      },
    ];

    const result = await generate(simpleSchema, {
      count: 1,
      generateFn,
    });

    expect(result.stats.invalid).toBeGreaterThan(0);
  });
});

// ── LLM-based generation ──

describe('generate - LLM-based', () => {
  it('should call the LLM function', async () => {
    let called = false;
    const mockLlm: LlmFunction = async (_messages) => {
      called = true;
      return {
        content: JSON.stringify({
          instruction: 'Explain the concept of recursion in programming',
          output: 'Recursion is a technique where a function calls itself to solve smaller instances of the same problem.',
          category: 'coding',
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };
    };

    const result = await generate(simpleSchema, { count: 1, llm: mockLlm });
    expect(called).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.stats.llmCalls).toBeGreaterThan(0);
  });

  it('should track token usage', async () => {
    const mockLlm: LlmFunction = async () => ({
      content: JSON.stringify({
        instruction: 'Describe what an API is in software development',
        output: 'An API (Application Programming Interface) is a set of rules that allows different software applications to communicate.',
        category: 'coding',
      }),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const result = await generate(simpleSchema, { count: 1, llm: mockLlm });
    expect(result.stats.tokens.prompt).toBeGreaterThan(0);
    expect(result.stats.tokens.completion).toBeGreaterThan(0);
  });

  it('should handle JSON in markdown fences', async () => {
    const mockLlm: LlmFunction = async () => ({
      content: '```json\n{"instruction": "Learn about design patterns in software", "output": "Design patterns are reusable solutions to common software design problems.", "category": "coding"}\n```',
    });

    const result = await generate(simpleSchema, { count: 1, llm: mockLlm });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should handle batch generation', async () => {
    const mockLlm: LlmFunction = async () => ({
      content: JSON.stringify([
        { instruction: 'Explain what is a database index and why it matters', output: 'A database index is a data structure that improves the speed of data retrieval.', category: 'coding' },
        { instruction: 'Write a short poem about the autumn season', output: 'Leaves fall gently down\nColored in gold and crimson\nAutumn whispers soft', category: 'writing' },
      ]),
    });

    const result = await generate(simpleSchema, { count: 2, llm: mockLlm, batchSize: 2 });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should calculate cost when configured', async () => {
    const mockLlm: LlmFunction = async () => ({
      content: JSON.stringify({
        instruction: 'Explain cloud computing and its major benefits',
        output: 'Cloud computing is the delivery of computing services over the internet, including storage and processing.',
        category: 'coding',
      }),
      usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    });

    const result = await generate(simpleSchema, {
      count: 1,
      llm: mockLlm,
      costTracking: {
        promptTokenCost: 0.000003,
        completionTokenCost: 0.000015,
        currency: 'USD',
      },
    });

    expect(result.stats.cost.totalCost).toBeGreaterThan(0);
    expect(result.stats.cost.currency).toBe('USD');
  });

  it('should retry on LLM failure', async () => {
    let failCount = 0;
    const mockLlm: LlmFunction = async () => {
      failCount++;
      if (failCount === 1) {
        throw new Error('API error');
      }
      return {
        content: JSON.stringify({
          instruction: 'What is machine learning and how does it work',
          output: 'Machine learning is a subset of AI that enables systems to learn from data.',
          category: 'reasoning',
        }),
      };
    };

    const result = await generate(simpleSchema, {
      count: 1,
      llm: mockLlm,
      retry: { maxRetries: 3 },
    });

    // First call fails, subsequent calls succeed. The pipeline may make
    // multiple batches due to oversampling, so we just check that:
    // 1. At least one retry happened
    expect(failCount).toBeGreaterThanOrEqual(2);
    // 2. We got data out
    expect(result.data.length).toBeGreaterThan(0);
  });
});

// ── Export integration ──

describe('generate - export', () => {
  it('should export in specified format', async () => {
    const result = await generate(simpleSchema, {
      count: 3,
      format: 'jsonl',
    });

    expect(result.exported).toBeDefined();
    const lines = result.exported!.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('should export in openai format', async () => {
    const result = await generate(simpleSchema, {
      count: 2,
      format: 'openai',
    });

    expect(result.exported).toBeDefined();
    const parsed = JSON.parse(result.exported!.split('\n')[0]);
    expect(parsed.messages).toBeDefined();
  });

  it('should not include exported when no format specified', async () => {
    const result = await generate(simpleSchema, { count: 2 });
    expect(result.exported).toBeUndefined();
  });
});

// ── Invalid handling modes ──

describe('generate - invalidHandling', () => {
  it('should discard invalid examples by default', async () => {
    const generateFn = () => [
      { instruction: 'x', output: 'y', category: 'invalid' }, // all invalid
    ];

    const result = await generate(simpleSchema, {
      count: 1,
      generateFn,
    });

    expect(result.stats.invalid).toBeGreaterThan(0);
    // Data might be empty since all generated are invalid
  });

  it('should log invalid examples when invalidHandling is log', async () => {
    const generateFn = () => [
      { instruction: 'x', output: 'y', category: 'invalid' },
    ];

    const result = await generate(simpleSchema, {
      count: 1,
      generateFn,
      invalidHandling: 'log',
    });

    expect(result.stats.invalidExamples.length).toBeGreaterThan(0);
    expect(result.stats.invalidExamples[0].errors.length).toBeGreaterThan(0);
  });

  it('should include repaired examples when invalidHandling is repair', async () => {
    const generateFn = () => [
      { instruction: 'x', output: 'y', category: 'invalid' },
    ];

    const result = await generate(simpleSchema, {
      count: 1,
      generateFn,
      invalidHandling: 'repair',
      dedup: { strategy: 'none' },
    });

    const repaired = result.data.filter(e => e._meta?.repaired);
    expect(repaired.length).toBeGreaterThan(0);
  });
});

// ── Validation errors tracking ──

describe('generate - validation error tracking', () => {
  it('should track validation errors with counts', async () => {
    const generateFn = () => [
      { instruction: 'x', output: 'y', category: 'invalid' },
    ];

    const result = await generate(simpleSchema, {
      count: 1,
      generateFn,
    });

    expect(result.stats.validationErrors.length).toBeGreaterThan(0);
    for (const err of result.stats.validationErrors) {
      expect(err.count).toBeGreaterThan(0);
      expect(err.message).toBeDefined();
    }
  });
});

// ── Dedup configuration ──

describe('generate - dedup options', () => {
  it('should support near dedup strategy', async () => {
    const result = await generate(simpleSchema, {
      count: 10,
      dedup: { strategy: 'near', threshold: 0.85 },
    });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should support dedup on specific fields', async () => {
    const result = await generate(simpleSchema, {
      count: 5,
      dedup: { strategy: 'exact', fields: ['category'] },
    });
    // With only 3 enum values, dedup on category should reduce significantly
    expect(result.data.length).toBeLessThanOrEqual(5);
  });
});

// ── Numeric schema ──

describe('generate - numeric schema', () => {
  it('should generate valid numeric examples', async () => {
    const result = await generate(numericSchema, { count: 5 });
    for (const example of result.data) {
      expect(typeof example.name).toBe('string');
      expect(typeof example.score).toBe('number');
      const score = example.score as number;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ── Edge cases ──

describe('generate - edge cases', () => {
  it('should handle count of 0', async () => {
    const result = await generate(simpleSchema, { count: 0 });
    expect(result.data).toHaveLength(0);
    expect(result.stats.final).toBe(0);
  });

  it('should handle count of 1', async () => {
    const result = await generate(simpleSchema, { count: 1 });
    expect(result.data.length).toBeLessThanOrEqual(1);
  });

  it('should handle large batch size', async () => {
    const result = await generate(simpleSchema, { count: 5, batchSize: 10 });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should include duration in stats', async () => {
    const result = await generate(simpleSchema, { count: 1 });
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should generate unique _meta ids', async () => {
    const result = await generate(simpleSchema, {
      count: 10,
      dedup: { strategy: 'none' },
    });
    const ids = result.data.map(e => e._meta!.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── Reproducibility with random diversity strategy ──

describe('generate - getTemperature reproducibility', () => {
  it('should produce identical temperatures across runs with random strategy', async () => {
    const temperatures: number[][] = [[], []];

    for (let run = 0; run < 2; run++) {
      const mockLlm: LlmFunction = async (_messages, options) => {
        temperatures[run].push(options?.temperature ?? -1);
        return {
          content: JSON.stringify({
            instruction: 'Explain the concept of recursion in programming',
            output: 'Recursion is a technique where a function calls itself to solve smaller instances of the same problem.',
            category: 'coding',
          }),
        };
      };

      await generate(simpleSchema, {
        count: 5,
        llm: mockLlm,
        diversity: {
          temperature: { min: 0.3, max: 1.2, strategy: 'random' },
        },
        dedup: { strategy: 'none' },
      });
    }

    expect(temperatures[0].length).toBeGreaterThan(0);
    expect(temperatures[0]).toEqual(temperatures[1]);
  });
});
