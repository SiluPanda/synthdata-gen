import { describe, it, expect } from 'vitest';
import { validate, validateExample } from '../validator';
import type { ExampleSchema, ValidationConfig } from '../types';

// ── Test schemas ──

const simpleSchema: ExampleSchema = {
  fields: {
    instruction: { type: 'string', min: 10, max: 200, description: 'A clear instruction' },
    output: { type: 'string', min: 20, max: 1000, description: 'The expected response' },
    category: { type: 'enum', enum: ['coding', 'writing', 'reasoning', 'math', 'general'] },
  },
};

const numericSchema: ExampleSchema = {
  fields: {
    name: { type: 'string' },
    age: { type: 'integer', min: 0, max: 150 },
    score: { type: 'number', min: 0, max: 100 },
    active: { type: 'boolean' },
  },
};

const optionalSchema: ExampleSchema = {
  fields: {
    title: { type: 'string', min: 5 },
    subtitle: { type: 'string', required: false },
    tags: { type: 'array', items: { type: 'string' }, min: 1, max: 5 },
  },
  required: ['title', 'tags'],
};

const nestedSchema: ExampleSchema = {
  fields: {
    name: { type: 'string' },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        zip: { type: 'string', pattern: '^\\d{5}$' },
      },
      requiredFields: ['street', 'city'],
    },
  },
};

// ── validateExample tests ──

describe('validateExample', () => {
  describe('type checking', () => {
    it('should pass for valid string fields', () => {
      const errors = validateExample(
        { instruction: 'Tell me about algorithms', output: 'Algorithms are step-by-step procedures', category: 'coding' },
        simpleSchema,
      );
      expect(errors).toHaveLength(0);
    });

    it('should fail for wrong type (number instead of string)', () => {
      const errors = validateExample(
        { instruction: 123, output: 'Valid output text here long enough', category: 'coding' },
        simpleSchema,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('invalid_type');
    });

    it('should fail for wrong type (string instead of number)', () => {
      const errors = validateExample(
        { name: 'Alice', age: 'twenty', score: 85, active: true },
        numericSchema,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.path[0] === 'age' && e.code === 'invalid_type')).toBe(true);
    });

    it('should fail for wrong type (number instead of boolean)', () => {
      const errors = validateExample(
        { name: 'Alice', age: 25, score: 85, active: 1 },
        numericSchema,
      );
      expect(errors.some(e => e.path[0] === 'active' && e.code === 'invalid_type')).toBe(true);
    });

    it('should validate integers (reject floats)', () => {
      const errors = validateExample(
        { name: 'Alice', age: 25.5, score: 85, active: true },
        numericSchema,
      );
      expect(errors.some(e => e.path[0] === 'age' && e.code === 'invalid_type')).toBe(true);
    });

    it('should pass for valid integer', () => {
      const errors = validateExample(
        { name: 'Alice', age: 25, score: 85.5, active: true },
        numericSchema,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('required fields', () => {
    it('should fail when required field is missing', () => {
      const errors = validateExample(
        { output: 'Valid output text here long enough', category: 'coding' },
        simpleSchema,
      );
      expect(errors.some(e => e.path[0] === 'instruction' && e.code === 'required')).toBe(true);
    });

    it('should pass when optional field is missing', () => {
      const errors = validateExample(
        { title: 'A valid title', tags: ['tag1'] },
        optionalSchema,
      );
      expect(errors).toHaveLength(0);
    });

    it('should fail when required field from required array is missing', () => {
      const errors = validateExample(
        { subtitle: 'something' },
        optionalSchema,
      );
      expect(errors.some(e => e.path[0] === 'title' && e.code === 'required')).toBe(true);
      expect(errors.some(e => e.path[0] === 'tags' && e.code === 'required')).toBe(true);
    });
  });

  describe('string constraints', () => {
    it('should fail when string is too short', () => {
      const errors = validateExample(
        { instruction: 'Hi', output: 'Valid output text here long enough', category: 'coding' },
        simpleSchema,
      );
      expect(errors.some(e => e.path[0] === 'instruction' && e.code === 'too_small')).toBe(true);
    });

    it('should fail when string is too long', () => {
      const longStr = 'x'.repeat(201);
      const errors = validateExample(
        { instruction: longStr, output: 'Valid output text here long enough', category: 'coding' },
        simpleSchema,
      );
      expect(errors.some(e => e.path[0] === 'instruction' && e.code === 'too_big')).toBe(true);
    });

    it('should validate regex patterns', () => {
      const errors = validateExample(
        { name: 'Alice', address: { street: '123 Main St', city: 'Springfield', zip: 'ABCDE' } },
        nestedSchema,
      );
      expect(errors.some(e => e.path.includes('zip') && e.code === 'invalid_string')).toBe(true);
    });

    it('should pass valid regex patterns', () => {
      const errors = validateExample(
        { name: 'Alice', address: { street: '123 Main St', city: 'Springfield', zip: '12345' } },
        nestedSchema,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('number constraints', () => {
    it('should fail when number is below minimum', () => {
      const errors = validateExample(
        { name: 'Alice', age: -1, score: 85, active: true },
        numericSchema,
      );
      expect(errors.some(e => e.path[0] === 'age' && e.code === 'too_small')).toBe(true);
    });

    it('should fail when number exceeds maximum', () => {
      const errors = validateExample(
        { name: 'Alice', age: 25, score: 101, active: true },
        numericSchema,
      );
      expect(errors.some(e => e.path[0] === 'score' && e.code === 'too_big')).toBe(true);
    });

    it('should pass for valid numeric values', () => {
      const errors = validateExample(
        { name: 'Alice', age: 0, score: 100, active: false },
        numericSchema,
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('enum validation', () => {
    it('should pass for valid enum value', () => {
      const errors = validateExample(
        { instruction: 'Tell me about algorithms', output: 'Algorithms are step-by-step procedures', category: 'coding' },
        simpleSchema,
      );
      expect(errors).toHaveLength(0);
    });

    it('should fail for invalid enum value', () => {
      const errors = validateExample(
        { instruction: 'Tell me about algorithms', output: 'Algorithms are step-by-step procedures', category: 'science' },
        simpleSchema,
      );
      expect(errors.some(e => e.path[0] === 'category' && e.code === 'invalid_enum_value')).toBe(true);
    });

    it('should include valid values in error message', () => {
      const errors = validateExample(
        { instruction: 'Tell me about algorithms', output: 'Algorithms are step-by-step procedures', category: 'invalid' },
        simpleSchema,
      );
      const enumError = errors.find(e => e.code === 'invalid_enum_value');
      expect(enumError?.message).toContain('coding');
      expect(enumError?.message).toContain('writing');
    });
  });

  describe('array validation', () => {
    it('should pass for valid arrays', () => {
      const errors = validateExample(
        { title: 'A valid title', tags: ['tag1', 'tag2'] },
        optionalSchema,
      );
      expect(errors).toHaveLength(0);
    });

    it('should fail when array has too few items', () => {
      const errors = validateExample(
        { title: 'A valid title', tags: [] },
        optionalSchema,
      );
      expect(errors.some(e => e.path[0] === 'tags' && e.code === 'too_small')).toBe(true);
    });

    it('should fail when array has too many items', () => {
      const errors = validateExample(
        { title: 'A valid title', tags: ['a', 'b', 'c', 'd', 'e', 'f'] },
        optionalSchema,
      );
      expect(errors.some(e => e.path[0] === 'tags' && e.code === 'too_big')).toBe(true);
    });

    it('should fail for non-array value', () => {
      const errors = validateExample(
        { title: 'A valid title', tags: 'not-an-array' },
        optionalSchema,
      );
      expect(errors.some(e => e.path[0] === 'tags' && e.code === 'invalid_type')).toBe(true);
    });

    it('should validate array element types', () => {
      const errors = validateExample(
        { title: 'A valid title', tags: [123] },
        optionalSchema,
      );
      expect(errors.some(e => e.path[0] === 'tags' && e.path[1] === '0' && e.code === 'invalid_type')).toBe(true);
    });
  });

  describe('nested object validation', () => {
    it('should validate nested objects', () => {
      const errors = validateExample(
        { name: 'Alice', address: { street: '123 Main', city: 'Springfield', zip: '12345' } },
        nestedSchema,
      );
      expect(errors).toHaveLength(0);
    });

    it('should fail when nested required field is missing', () => {
      const errors = validateExample(
        { name: 'Alice', address: { zip: '12345' } },
        nestedSchema,
      );
      expect(errors.some(e => e.path.includes('street') && e.code === 'required')).toBe(true);
      expect(errors.some(e => e.path.includes('city') && e.code === 'required')).toBe(true);
    });

    it('should fail when nested object is not an object', () => {
      const errors = validateExample(
        { name: 'Alice', address: 'not-an-object' },
        nestedSchema,
      );
      expect(errors.some(e => e.path[0] === 'address' && e.code === 'invalid_type')).toBe(true);
    });
  });
});

// ── Heuristics tests ──

describe('heuristics', () => {
  const qaSchema: ExampleSchema = {
    fields: {
      question: { type: 'string', min: 5 },
      answer: { type: 'string', min: 5 },
    },
  };

  it('should detect empty/whitespace-only strings', () => {
    const config: ValidationConfig = {
      heuristics: { nonEmpty: true },
    };
    const errors = validateExample(
      { question: '   ', answer: 'A valid answer here' },
      qaSchema,
      config,
    );
    expect(errors.some(e => e.code === 'heuristic_non_empty')).toBe(true);
  });

  it('should detect placeholder text', () => {
    const config: ValidationConfig = {
      heuristics: { noPlaceholder: true },
    };
    const errors = validateExample(
      { question: 'Lorem ipsum dolor sit amet', answer: 'A valid answer here' },
      qaSchema,
      config,
    );
    expect(errors.some(e => e.code === 'heuristic_placeholder')).toBe(true);
  });

  it('should detect TODO placeholder', () => {
    const config: ValidationConfig = {
      heuristics: { noPlaceholder: true },
    };
    const errors = validateExample(
      { question: 'TODO', answer: 'A valid answer here' },
      qaSchema,
      config,
    );
    expect(errors.some(e => e.code === 'heuristic_placeholder')).toBe(true);
  });

  it('should detect duplicate fields', () => {
    const config: ValidationConfig = {
      heuristics: { noDuplicateFields: { pairs: [['question', 'answer']] } },
    };
    const errors = validateExample(
      { question: 'Same text here', answer: 'Same text here' },
      qaSchema,
      config,
    );
    expect(errors.some(e => e.code === 'heuristic_duplicate_fields')).toBe(true);
  });

  it('should pass when fields are different', () => {
    const config: ValidationConfig = {
      heuristics: { noDuplicateFields: { pairs: [['question', 'answer']] } },
    };
    const errors = validateExample(
      { question: 'What is the capital of France?', answer: 'Paris is the capital of France.' },
      qaSchema,
      config,
    );
    expect(errors.filter(e => e.code === 'heuristic_duplicate_fields')).toHaveLength(0);
  });

  it('should enforce minimum word count', () => {
    const config: ValidationConfig = {
      heuristics: { minWordCount: { fields: ['answer'], min: 5 } },
    };
    const errors = validateExample(
      { question: 'What is it?', answer: 'Just two' },
      qaSchema,
      config,
    );
    expect(errors.some(e => e.code === 'heuristic_min_words')).toBe(true);
  });

  it('should pass when word count meets minimum', () => {
    const config: ValidationConfig = {
      heuristics: { minWordCount: { fields: ['answer'], min: 3 } },
    };
    const errors = validateExample(
      { question: 'What is life?', answer: 'Life is complex and beautiful' },
      qaSchema,
      config,
    );
    expect(errors.filter(e => e.code === 'heuristic_min_words')).toHaveLength(0);
  });
});

// ── Global field length tests ──

describe('global field length constraints', () => {
  const schema: ExampleSchema = {
    fields: {
      text: { type: 'string' },
      label: { type: 'string' },
    },
  };

  it('should enforce minFieldLength', () => {
    const config: ValidationConfig = { minFieldLength: 10 };
    const errors = validateExample({ text: 'hi', label: 'short' }, schema, config);
    expect(errors.filter(e => e.code === 'global_min_length').length).toBe(2);
  });

  it('should enforce maxFieldLength', () => {
    const config: ValidationConfig = { maxFieldLength: 5 };
    const errors = validateExample({ text: 'this is too long', label: 'ok' }, schema, config);
    expect(errors.some(e => e.path[0] === 'text' && e.code === 'global_max_length')).toBe(true);
  });
});

// ── Custom validators ──

describe('custom validators', () => {
  const schema: ExampleSchema = {
    fields: {
      instruction: { type: 'string', min: 5 },
      output: { type: 'string', min: 5 },
    },
  };

  it('should run custom validators', () => {
    const config: ValidationConfig = {
      custom: [
        {
          name: 'no-questions',
          validate: (ex) => {
            if (typeof ex.output === 'string' && ex.output.endsWith('?')) {
              return { valid: false, message: 'Output should not end with a question mark' };
            }
            return { valid: true };
          },
        },
      ],
    };
    const errors = validateExample(
      { instruction: 'Tell me something', output: 'Is this a question?' },
      schema,
      config,
    );
    expect(errors.some(e => e.code === 'custom_no-questions')).toBe(true);
  });

  it('should pass when custom validator succeeds', () => {
    const config: ValidationConfig = {
      custom: [
        {
          name: 'always-pass',
          validate: () => ({ valid: true }),
        },
      ],
    };
    const errors = validateExample(
      { instruction: 'A valid instruction here', output: 'A valid output here.' },
      schema,
      config,
    );
    expect(errors.filter(e => e.code.startsWith('custom_'))).toHaveLength(0);
  });
});

// ── validate() array function tests ──

describe('validate() array function', () => {
  const schema: ExampleSchema = {
    fields: {
      text: { type: 'string', min: 5 },
      category: { type: 'enum', enum: ['a', 'b'] },
    },
  };

  it('should return results for each example', () => {
    const results = validate(
      [
        { text: 'Valid text here', category: 'a' },
        { text: 'Hi', category: 'c' },
        { text: 'Another valid text', category: 'b' },
      ],
      schema,
    );
    expect(results).toHaveLength(3);
    expect(results[0].valid).toBe(true);
    expect(results[0].index).toBe(0);
    expect(results[1].valid).toBe(false);
    expect(results[1].index).toBe(1);
    expect(results[2].valid).toBe(true);
    expect(results[2].index).toBe(2);
  });

  it('should include error details for invalid examples', () => {
    const results = validate([{ text: 'Hi', category: 'invalid' }], schema);
    expect(results[0].errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty errors for valid examples', () => {
    const results = validate([{ text: 'A perfectly valid text', category: 'a' }], schema);
    expect(results[0].errors).toHaveLength(0);
  });

  it('should handle empty array', () => {
    const results = validate([], schema);
    expect(results).toHaveLength(0);
  });
});
