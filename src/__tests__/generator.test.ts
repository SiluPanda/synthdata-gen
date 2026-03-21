import { describe, it, expect } from 'vitest';
import {
  generateExample,
  generateExamples,
  buildSchemaPrompt,
  buildSystemPrompt,
  parseJsonResponse,
} from '../generator';
import type { ExampleSchema } from '../types';

// ── Test schemas ──

const simpleSchema: ExampleSchema = {
  fields: {
    instruction: { type: 'string', min: 10, max: 200, description: 'A clear instruction' },
    output: { type: 'string', min: 20, max: 500 },
    category: { type: 'enum', enum: ['coding', 'writing', 'reasoning'] },
  },
};

const numericSchema: ExampleSchema = {
  fields: {
    name: { type: 'string', min: 3, max: 50 },
    age: { type: 'integer', min: 18, max: 65 },
    score: { type: 'number', min: 0, max: 100 },
    active: { type: 'boolean' },
  },
};

const arraySchema: ExampleSchema = {
  fields: {
    title: { type: 'string', min: 5, max: 100 },
    tags: { type: 'array', items: { type: 'string' }, min: 1, max: 3 },
  },
};

const optionalSchema: ExampleSchema = {
  fields: {
    name: { type: 'string', min: 3 },
    nickname: { type: 'string', required: false, default: '' },
  },
  required: ['name'],
};

// ── generateExample tests ──

describe('generateExample', () => {
  it('should generate an example matching the schema', () => {
    const example = generateExample(simpleSchema, 42);
    expect(typeof example.instruction).toBe('string');
    expect(typeof example.output).toBe('string');
    expect(typeof example.category).toBe('string');
    expect(['coding', 'writing', 'reasoning']).toContain(example.category);
  });

  it('should respect string length constraints', () => {
    for (let seed = 0; seed < 20; seed++) {
      const example = generateExample(simpleSchema, seed);
      const instruction = example.instruction as string;
      const output = example.output as string;
      expect(instruction.length).toBeGreaterThanOrEqual(10);
      expect(instruction.length).toBeLessThanOrEqual(200);
      expect(output.length).toBeGreaterThanOrEqual(20);
      expect(output.length).toBeLessThanOrEqual(500);
    }
  });

  it('should generate valid enum values', () => {
    for (let seed = 0; seed < 50; seed++) {
      const example = generateExample(simpleSchema, seed);
      expect(['coding', 'writing', 'reasoning']).toContain(example.category);
    }
  });

  it('should generate integers within range', () => {
    for (let seed = 0; seed < 20; seed++) {
      const example = generateExample(numericSchema, seed);
      const age = example.age as number;
      expect(Number.isInteger(age)).toBe(true);
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(65);
    }
  });

  it('should generate numbers within range', () => {
    for (let seed = 0; seed < 20; seed++) {
      const example = generateExample(numericSchema, seed);
      const score = example.score as number;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('should generate boolean values', () => {
    const values = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const example = generateExample(numericSchema, seed);
      expect(typeof example.active).toBe('boolean');
      values.add(example.active as boolean);
    }
    // Over 50 tries, we should see both true and false
    expect(values.size).toBe(2);
  });

  it('should generate arrays within size constraints', () => {
    for (let seed = 0; seed < 20; seed++) {
      const example = generateExample(arraySchema, seed);
      const tags = example.tags as unknown[];
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(1);
      expect(tags.length).toBeLessThanOrEqual(3);
      for (const tag of tags) {
        expect(typeof tag).toBe('string');
      }
    }
  });

  it('should be deterministic with the same seed', () => {
    const a = generateExample(simpleSchema, 42);
    const b = generateExample(simpleSchema, 42);
    expect(a).toEqual(b);
  });

  it('should produce different examples with different seeds', () => {
    const a = generateExample(simpleSchema, 1);
    const b = generateExample(simpleSchema, 2);
    // At least one field should differ
    const isDifferent =
      a.instruction !== b.instruction ||
      a.output !== b.output ||
      a.category !== b.category;
    expect(isDifferent).toBe(true);
  });

  it('should handle optional fields', () => {
    const example = generateExample(optionalSchema, 42);
    expect(typeof example.name).toBe('string');
    // nickname may or may not be present
  });
});

// ── generateExamples tests ──

describe('generateExamples', () => {
  it('should generate the requested count', () => {
    const examples = generateExamples(simpleSchema, 10, 42);
    expect(examples).toHaveLength(10);
  });

  it('should produce unique examples', () => {
    const examples = generateExamples(simpleSchema, 20, 42);
    const instructions = examples.map(e => e.instruction);
    const uniqueInstructions = new Set(instructions);
    // Most should be unique (seeded differently)
    expect(uniqueInstructions.size).toBeGreaterThan(10);
  });

  it('should be deterministic with the same seed', () => {
    const a = generateExamples(simpleSchema, 5, 42);
    const b = generateExamples(simpleSchema, 5, 42);
    expect(a).toEqual(b);
  });

  it('should generate zero examples when count is 0', () => {
    const examples = generateExamples(simpleSchema, 0);
    expect(examples).toHaveLength(0);
  });
});

// ── buildSchemaPrompt tests ──

describe('buildSchemaPrompt', () => {
  it('should include all field names', () => {
    const prompt = buildSchemaPrompt(simpleSchema);
    expect(prompt).toContain('instruction');
    expect(prompt).toContain('output');
    expect(prompt).toContain('category');
  });

  it('should include type descriptions', () => {
    const prompt = buildSchemaPrompt(simpleSchema);
    expect(prompt).toContain('string');
  });

  it('should include string length constraints', () => {
    const prompt = buildSchemaPrompt(simpleSchema);
    expect(prompt).toContain('10');
    expect(prompt).toContain('200');
  });

  it('should include enum values', () => {
    const prompt = buildSchemaPrompt(simpleSchema);
    expect(prompt).toContain('one of');
    expect(prompt).toContain('coding');
    expect(prompt).toContain('writing');
    expect(prompt).toContain('reasoning');
  });

  it('should include field descriptions', () => {
    const prompt = buildSchemaPrompt(simpleSchema);
    expect(prompt).toContain('A clear instruction');
  });

  it('should describe number constraints', () => {
    const prompt = buildSchemaPrompt(numericSchema);
    expect(prompt).toContain('integer');
    expect(prompt).toContain('min 18');
    expect(prompt).toContain('max 65');
  });

  it('should describe array fields', () => {
    const prompt = buildSchemaPrompt(arraySchema);
    expect(prompt).toContain('array');
    expect(prompt).toContain('min 1');
    expect(prompt).toContain('max 3');
  });

  it('should mark optional fields', () => {
    const prompt = buildSchemaPrompt(optionalSchema);
    expect(prompt).toContain('optional');
  });

  it('should include JSON structure markers', () => {
    const prompt = buildSchemaPrompt(simpleSchema);
    expect(prompt).toContain('{');
    expect(prompt).toContain('}');
  });

  it('should describe boolean fields', () => {
    const prompt = buildSchemaPrompt(numericSchema);
    expect(prompt).toContain('boolean');
  });
});

// ── buildSystemPrompt tests ──

describe('buildSystemPrompt', () => {
  it('should include default instructions', () => {
    const prompt = buildSystemPrompt(simpleSchema);
    expect(prompt).toContain('synthetic training data generator');
    expect(prompt).toContain('valid JSON');
  });

  it('should include schema description', () => {
    const prompt = buildSystemPrompt(simpleSchema);
    expect(prompt).toContain('instruction');
    expect(prompt).toContain('coding');
  });

  it('should use custom system prompt', () => {
    const custom = 'You are a medical expert. {schema_description}';
    const prompt = buildSystemPrompt(simpleSchema, custom);
    expect(prompt).toContain('medical expert');
    expect(prompt).toContain('instruction');
    expect(prompt).not.toContain('synthetic training data generator');
  });

  it('should append additional instructions', () => {
    const prompt = buildSystemPrompt(simpleSchema, undefined, 'All examples must be about science.');
    expect(prompt).toContain('All examples must be about science.');
    expect(prompt).toContain('synthetic training data generator');
  });
});

// ── parseJsonResponse tests ──

describe('parseJsonResponse', () => {
  it('should parse a bare JSON object', () => {
    const result = parseJsonResponse('{"key": "value"}');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'value' });
  });

  it('should parse a bare JSON array', () => {
    const result = parseJsonResponse('[{"a": 1}, {"b": 2}]');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ a: 1 });
    expect(result[1]).toEqual({ b: 2 });
  });

  it('should extract JSON from markdown code fences', () => {
    const text = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone!';
    const result = parseJsonResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'value' });
  });

  it('should extract JSON array from markdown code fences', () => {
    const text = '```json\n[{"a": 1}, {"b": 2}]\n```';
    const result = parseJsonResponse(text);
    expect(result).toHaveLength(2);
  });

  it('should handle code fences without json label', () => {
    const text = '```\n{"key": "value"}\n```';
    const result = parseJsonResponse(text);
    expect(result).toHaveLength(1);
  });

  it('should extract JSON from mixed text', () => {
    const text = 'Here is the example: {"instruction": "test", "output": "result"}';
    const result = parseJsonResponse(text);
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).instruction).toBe('test');
  });

  it('should return empty array for non-JSON text', () => {
    const result = parseJsonResponse('This is just plain text with no JSON.');
    expect(result).toHaveLength(0);
  });

  it('should handle whitespace around JSON', () => {
    const result = parseJsonResponse('  \n  {"key": "value"}  \n  ');
    expect(result).toHaveLength(1);
  });

  it('should handle nested JSON objects', () => {
    const result = parseJsonResponse('{"outer": {"inner": "value"}}');
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).outer).toEqual({ inner: 'value' });
  });

  it('should handle JSON with special characters in strings', () => {
    const result = parseJsonResponse('{"text": "hello \\"world\\""}');
    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).text).toBe('hello "world"');
  });
});
