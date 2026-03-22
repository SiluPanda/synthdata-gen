# synthdata-gen

Generate, validate, deduplicate, and export synthetic training data for LLM fine-tuning and evaluation.

[![npm version](https://img.shields.io/npm/v/synthdata-gen.svg)](https://www.npmjs.com/package/synthdata-gen)
[![npm downloads](https://img.shields.io/npm/dt/synthdata-gen.svg)](https://www.npmjs.com/package/synthdata-gen)
[![license](https://img.shields.io/npm/l/synthdata-gen.svg)](https://github.com/SiluPanda/synthdata-gen/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/synthdata-gen.svg)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/synthdata-gen.svg)](https://www.npmjs.com/package/synthdata-gen)

---

## Description

`synthdata-gen` is a complete pipeline for producing synthetic training data. Define a schema describing the shape of each example, optionally plug in any LLM, and the library handles generation, output parsing, schema validation, quality heuristics, deduplication, and export to training-ready formats (OpenAI fine-tuning JSONL, Alpaca, ShareGPT, CSV, plain JSONL).

The library works in three modes:

- **Template-based generation** -- no LLM required. A built-in deterministic generator produces examples matching your schema using seeded pseudo-random values. Useful for testing pipelines, prototyping schemas, and generating placeholder data.
- **LLM-based generation** -- provide any async function that calls an LLM. The pipeline builds prompts from your schema, parses structured output from LLM responses (including JSON embedded in markdown fences), retries on failure, and tracks token usage and cost.
- **Custom generation** -- provide your own `generateFn` callback for full control over how examples are produced, while still benefiting from the validation, dedup, and export stages.

Each pipeline stage (generation, validation, deduplication, export) is independently usable as a standalone function.

---

## Installation

```bash
npm install synthdata-gen
```

Requires Node.js >= 18.

---

## Quick Start

### Template-based generation (no LLM required)

```typescript
import { generate } from 'synthdata-gen';
import type { ExampleSchema } from 'synthdata-gen';

const schema: ExampleSchema = {
  fields: {
    instruction: { type: 'string', min: 10, max: 200, description: 'A clear instruction' },
    output: { type: 'string', min: 20, max: 1000, description: 'The expected response' },
    category: { type: 'enum', enum: ['coding', 'writing', 'reasoning'] },
  },
};

const result = await generate(schema, { count: 100 });

console.log(result.data);   // GeneratedExample[]
console.log(result.stats);  // GenerationStats
```

### LLM-based generation

```typescript
import { generate } from 'synthdata-gen';
import type { LlmFunction } from 'synthdata-gen';

const myLlm: LlmFunction = async (messages, options) => {
  const response = await callMyProvider(messages, options);
  return {
    content: response.text,
    usage: {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    },
  };
};

const result = await generate(schema, {
  llm: myLlm,
  count: 500,
  batchSize: 5,
  format: 'openai',
  seeds: [
    { instruction: 'Explain recursion', output: 'Recursion is when a function calls itself...', category: 'coding' },
  ],
  costTracking: {
    promptTokenCost: 0.000003,
    completionTokenCost: 0.000015,
    currency: 'USD',
  },
});

console.log(result.exported);          // OpenAI fine-tuning JSONL string
console.log(result.stats.cost);        // { promptTokens, completionTokens, totalCost, currency }
console.log(result.stats.durationMs);  // wall-clock time
```

---

## Features

- **Schema-driven generation** -- define field types, constraints, descriptions, and required fields; the library compiles schemas into LLM prompts and validates output against them.
- **Three generation modes** -- template-based (no LLM), LLM-based (any provider), or custom callback.
- **Robust LLM output parsing** -- extracts JSON from bare responses, markdown code fences, and mixed text.
- **Schema validation** -- type checking, string length constraints, numeric ranges, regex patterns, enum membership, array bounds, and nested object validation.
- **Quality heuristics** -- detect empty fields, placeholder text (lorem ipsum, TODO, N/A), duplicate field values, and enforce minimum word counts.
- **Custom validators** -- plug in arbitrary validation functions alongside built-in checks.
- **Three deduplication strategies** -- exact match (normalized hash), near-duplicate (Jaccard similarity on n-grams), and semantic (cosine similarity on embeddings via a pluggable embedder).
- **Cross-set deduplication** -- remove generated examples that overlap with an existing dataset.
- **Five export formats** -- OpenAI fine-tuning JSONL, Alpaca, ShareGPT, CSV, and plain JSONL, with configurable field mappings.
- **Diversity controls** -- temperature variation (linear, cycle, random), topic rotation, seed example rotation, negative example generation, and constraint variation.
- **Cost tracking** -- track prompt and completion tokens, compute estimated cost per run.
- **Deterministic generation** -- seeded PRNG for reproducible template-based output.
- **Full TypeScript support** -- all types exported, strict mode compatible.

---

## API Reference

### `generate(schema, options)`

Main pipeline function. Generates examples, validates, deduplicates, and optionally exports.

```typescript
function generate(schema: ExampleSchema, options: GenerateOptions): Promise<GenerateResult>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `ExampleSchema` | Schema defining the shape of each example |
| `options` | `GenerateOptions` | Pipeline configuration (see below) |

**`GenerateOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `count` | `number` | *required* | Number of examples to generate |
| `llm` | `LlmFunction` | `undefined` | Async function that calls an LLM |
| `generateFn` | `(schema, batchIndex) => Record[]` | `undefined` | Custom generation callback |
| `batchSize` | `number` | `1` | Examples per LLM call |
| `systemPrompt` | `string` | `undefined` | Custom system prompt (use `{schema_description}` placeholder) |
| `additionalInstructions` | `string` | `undefined` | Extra instructions appended to the system prompt |
| `seeds` | `Record<string, unknown>[]` | `undefined` | Few-shot seed examples |
| `diversity` | `DiversityConfig` | `undefined` | Diversity strategy configuration |
| `validation` | `ValidationConfig` | `undefined` | Validation and heuristics configuration |
| `retry` | `RetryConfig` | `{ maxRetries: 3 }` | Retry configuration for LLM failures |
| `dedup` | `DedupOptions` | `{ strategy: 'exact' }` | Deduplication configuration |
| `invalidHandling` | `'discard' \| 'log' \| 'repair'` | `'discard'` | How to handle invalid examples |
| `structuredOutput` | `boolean` | `undefined` | Request JSON mode from the LLM provider |
| `costTracking` | `CostConfig` | `undefined` | Token cost tracking configuration |
| `format` | `ExportFormat` | `undefined` | Export format for the `exported` field in the result |

**Returns `GenerateResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `data` | `GeneratedExample[]` | Final validated, deduplicated examples |
| `stats` | `GenerationStats` | Pipeline statistics |
| `exported` | `string \| undefined` | Formatted output string (if `format` was specified) |

---

### `validate(examples, schema, config?)`

Validate an array of examples against a schema. Returns a `ValidationResult` for each example.

```typescript
function validate(
  examples: Record<string, unknown>[],
  schema: ExampleSchema,
  config?: ValidationConfig,
): ValidationResult[]
```

**Returns an array of:**

```typescript
interface ValidationResult {
  valid: boolean;
  index: number;
  errors: ValidationError[];
}

interface ValidationError {
  path: string[];
  message: string;
  code: string;
}
```

**Validation error codes:** `required`, `invalid_type`, `too_small`, `too_big`, `invalid_string`, `invalid_enum_value`, `heuristic_non_empty`, `heuristic_placeholder`, `heuristic_duplicate_fields`, `heuristic_min_words`, `global_min_length`, `global_max_length`, `custom_<name>`.

---

### `validateExample(example, schema, config?)`

Validate a single example. Returns an array of `ValidationError` objects (empty array means valid).

```typescript
function validateExample(
  example: Record<string, unknown>,
  schema: ExampleSchema,
  config?: ValidationConfig,
): ValidationError[]
```

---

### `deduplicate(examples, options?)`

Deduplicate an array of examples. Supports exact, near-duplicate, and semantic strategies.

```typescript
function deduplicate(
  examples: Record<string, unknown>[],
  options?: Partial<DedupOptions>,
): Promise<DedupResult>
```

**`DedupOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `'exact' \| 'near' \| 'semantic' \| 'none'` | `'exact'` | Deduplication strategy |
| `threshold` | `number` | `0.85` (near) / `0.92` (semantic) | Similarity threshold for near/semantic dedup |
| `ngramSize` | `number` | `2` | N-gram size for near-duplicate detection |
| `fields` | `string[]` | all fields | Subset of fields to compare |
| `embedder` | `(text: string) => Promise<number[]>` | `undefined` | Embedding function (required for semantic strategy) |
| `existingData` | `Record<string, unknown>[]` | `undefined` | Existing dataset for cross-set deduplication |

**Returns `DedupResult`:**

```typescript
interface DedupResult {
  data: Record<string, unknown>[];   // Deduplicated examples
  removed: number;                    // Number of duplicates removed
  pairs: Array<[number, number, number]>;  // [indexA, indexB, similarity]
}
```

---

### `exportAs(examples, format, options?)`

Export examples to a training-ready format string.

```typescript
function exportAs(
  examples: Record<string, unknown>[],
  format: ExportFormat,
  options?: ExportOptions,
): string
```

**`ExportFormat`:** `'openai' | 'alpaca' | 'sharegpt' | 'csv' | 'jsonl'`

**`ExportOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fieldMap` | `Record<string, string>` | `undefined` | Map format roles to your field names |
| `systemPrompt` | `string` | `undefined` | Static system prompt (OpenAI/ShareGPT formats) |
| `delimiter` | `string` | `','` | CSV column delimiter |
| `quote` | `string` | `'"'` | CSV quote character |
| `header` | `boolean` | `true` | Include CSV header row |
| `fields` | `string[]` | all fields | Subset of fields to include |

---

### Individual Exporters

Each export format is available as a standalone function:

```typescript
import { exportOpenAI, exportAlpaca, exportShareGPT, exportCSV, exportJSONL } from 'synthdata-gen';
```

| Function | Output format |
|----------|--------------|
| `exportOpenAI(examples, options?)` | `{"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}` per line |
| `exportAlpaca(examples, options?)` | `{"instruction": "...", "input": "...", "output": "..."}` per line |
| `exportShareGPT(examples, options?)` | `{"conversations": [{"from": "human", "value": "..."}, {"from": "gpt", "value": "..."}]}` per line |
| `exportCSV(examples, options?)` | Comma-separated values with header row |
| `exportJSONL(examples, options?)` | One JSON object per line |

All exporters automatically exclude `_meta` fields from output.

---

### Generator Utilities

Low-level functions for template-based generation and prompt construction:

```typescript
import {
  generateExample,
  generateExamples,
  buildSchemaPrompt,
  buildSystemPrompt,
  parseJsonResponse,
} from 'synthdata-gen';
```

| Function | Description |
|----------|-------------|
| `generateExample(schema, seed?)` | Generate a single example from a schema using the built-in template generator. Deterministic when a seed is provided. |
| `generateExamples(schema, count, baseSeed?)` | Generate multiple examples. Each example uses `baseSeed + index` for its seed. |
| `buildSchemaPrompt(schema)` | Compile a schema into a natural-language prompt describing the expected JSON structure. |
| `buildSystemPrompt(schema, customPrompt?, additionalInstructions?)` | Build the full system prompt for LLM-based generation. Supports a custom prompt template with `{schema_description}` placeholder. |
| `parseJsonResponse(text)` | Extract JSON objects/arrays from an LLM response. Handles bare JSON, markdown code fences, and JSON embedded in explanatory text. |

---

## Configuration

### Schema Definition

A schema defines the structure of each generated example using `ExampleSchema`:

```typescript
const schema: ExampleSchema = {
  fields: {
    question: { type: 'string', min: 10, max: 500, description: 'A natural language question' },
    answer: { type: 'string', min: 20, max: 2000, pattern: '^[A-Z]' },
    category: { type: 'enum', enum: ['science', 'history', 'technology'] },
    difficulty: { type: 'integer', min: 1, max: 5 },
    score: { type: 'number', min: 0, max: 100 },
    active: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' }, min: 1, max: 5 },
    metadata: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        verified: { type: 'boolean' },
      },
      requiredFields: ['source'],
    },
  },
  required: ['question', 'answer', 'category'],
};
```

**Supported field types:**

| Type | `SchemaField` properties |
|------|-------------------------|
| `string` | `min` (min length), `max` (max length), `pattern` (regex), `description` |
| `number` | `min`, `max`, `description` |
| `integer` | `min`, `max`, `description` |
| `boolean` | `description` |
| `enum` | `enum` (valid values array), `description` |
| `array` | `items` (element schema), `min` (min items), `max` (max items), `description` |
| `object` | `properties` (nested fields), `requiredFields` (required property names), `description` |

All fields support `required` (default: `true`) and `default` (default value when field is omitted).

---

### Validation Configuration

```typescript
const config: ValidationConfig = {
  // Global string field length constraints
  minFieldLength: 10,
  maxFieldLength: 5000,

  // Quality heuristics
  heuristics: {
    nonEmpty: true,           // Reject empty/whitespace-only required string fields
    noPlaceholder: true,      // Reject placeholder text (lorem ipsum, TODO, TBD, N/A, etc.)
    noDuplicateFields: {      // Reject examples where specified field pairs are identical
      pairs: [['question', 'answer']],
    },
    minWordCount: {           // Enforce minimum word count on specified fields
      fields: ['answer'],
      min: 5,
    },
  },

  // Custom validators
  custom: [
    {
      name: 'no-question-in-output',
      validate: (example) => ({
        valid: !String(example.answer).endsWith('?'),
        message: 'Answer should not end with a question mark',
      }),
    },
  ],
};
```

The `noDuplicateFields` and `minWordCount` heuristics also accept `true` to use automatic inference: `noDuplicateFields: true` pairs common field name patterns (question/answer, instruction/output, input/output, prompt/response, query/response), and `minWordCount: true` applies a default minimum of 3 words to all string fields.

---

### Diversity Configuration

```typescript
const diversity: DiversityConfig = {
  temperature: {
    min: 0.3,
    max: 1.2,
    strategy: 'cycle',  // 'linear' | 'cycle' | 'random'
  },
  topics: ['algorithms', 'databases', 'networking', 'security'],
  negativeExampleRatio: 0.1,
  negativeInstructions: 'Generate an example with a subtle factual error.',
  constraintVariation: [
    { instruction: 'Write in a formal academic tone.' },
    { instruction: 'Write in a casual conversational tone.' },
  ],
};
```

---

### Retry Configuration

```typescript
const retry: RetryConfig = {
  maxRetries: 3,            // Maximum retry attempts per batch
  includeFeedback: true,    // Include validation error feedback in retry prompt
  backoff: 'exponential',   // 'none' | 'linear' | 'exponential'
  backoffMs: 1000,          // Base backoff delay in milliseconds
};
```

---

### Cost Tracking

```typescript
const costTracking: CostConfig = {
  promptTokenCost: 0.000003,      // Cost per prompt token
  completionTokenCost: 0.000015,  // Cost per completion token
  currency: 'USD',
};
```

The `GenerationStats.cost` field in the result contains `promptTokens`, `completionTokens`, `totalCost`, and `currency`.

---

## Error Handling

### Validation Errors

The `validate` and `validateExample` functions return structured error objects rather than throwing. Each `ValidationError` includes:

- `path` -- array of field names locating the error (e.g., `['address', 'zip']` for nested fields, `['tags', '0']` for array elements)
- `message` -- human-readable description of the failure
- `code` -- machine-readable error code for programmatic handling

```typescript
import { validateExample } from 'synthdata-gen';

const errors = validateExample(
  { instruction: 'Hi', output: 123, category: 'invalid' },
  schema,
);

for (const err of errors) {
  console.log(`[${err.code}] ${err.path.join('.')}: ${err.message}`);
}
// [too_small] instruction: String must contain at least 10 character(s), received 2
// [invalid_type] output: Expected string, received number
// [invalid_enum_value] category: Invalid enum value. Expected one of ["coding", ...], received "invalid"
```

### Pipeline Error Handling

The `generate` function handles LLM failures internally using the retry configuration. Invalid examples are handled according to the `invalidHandling` option:

- `'discard'` (default) -- silently drops invalid examples
- `'log'` -- discards but records invalid examples and their errors in `stats.invalidExamples`
- `'repair'` -- includes invalid examples in the output with `_meta.repaired: true`

Validation error counts are always available in `stats.validationErrors` regardless of the handling mode.

### Deduplication Errors

The `deduplicate` function throws an `Error` if the `semantic` strategy is used without providing an `embedder` function:

```typescript
// Throws: "Semantic dedup requires an embedder function"
await deduplicate(examples, { strategy: 'semantic' });
```

### Export Errors

The `exportAs` function throws an `Error` for unsupported format strings:

```typescript
// Throws: "Unsupported export format: xml"
exportAs(examples, 'xml' as ExportFormat);
```

---

## Advanced Usage

### Custom System Prompt

Override the default system prompt using the `{schema_description}` placeholder:

```typescript
const result = await generate(schema, {
  count: 100,
  llm: myLlm,
  systemPrompt: 'You are a medical expert generating training data.\n\n{schema_description}',
  additionalInstructions: 'All examples must be about cardiology.',
});
```

### Cross-Set Deduplication

Remove generated examples that duplicate entries in an existing dataset:

```typescript
import { deduplicate } from 'synthdata-gen';

const result = await deduplicate(newExamples, {
  strategy: 'exact',
  existingData: existingDataset,
});

console.log(`Removed ${result.removed} duplicates of existing data`);
```

### Semantic Deduplication

Provide an embedding function for meaning-level deduplication:

```typescript
const result = await deduplicate(examples, {
  strategy: 'semantic',
  threshold: 0.92,
  embedder: async (text) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
});
```

### Field-Specific Deduplication

Deduplicate based on a subset of fields:

```typescript
const result = await deduplicate(examples, {
  strategy: 'near',
  threshold: 0.85,
  ngramSize: 2,
  fields: ['instruction'],  // Only compare instruction fields
});
```

### Custom Field Mapping for Export

Map your schema fields to the roles expected by each export format:

```typescript
import { exportOpenAI, exportAlpaca } from 'synthdata-gen';

const qaData = [
  { question: 'What is TCP?', answer: 'TCP is a connection-oriented protocol.' },
];

// Map question -> user, answer -> assistant
const openai = exportOpenAI(qaData, {
  fieldMap: { user: 'question', assistant: 'answer' },
  systemPrompt: 'You are a networking expert.',
});

// Map question -> instruction, answer -> output
const alpaca = exportAlpaca(qaData, {
  fieldMap: { instruction: 'question', output: 'answer' },
});
```

### Batch Generation with LLM

Request multiple examples per LLM call to reduce API costs:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 1000,
  batchSize: 10,            // 10 examples per LLM call
  structuredOutput: true,   // Request JSON mode if provider supports it
});
```

### Standalone Template Generation

Use the template generator directly without the full pipeline:

```typescript
import { generateExample, generateExamples } from 'synthdata-gen';

// Single example, deterministic with seed
const example = generateExample(schema, 42);

// Multiple examples, deterministic with base seed
const examples = generateExamples(schema, 100, 42);
```

### Building Prompts for External Use

Generate the prompt that would be sent to an LLM, without calling one:

```typescript
import { buildSchemaPrompt, buildSystemPrompt } from 'synthdata-gen';

const schemaPrompt = buildSchemaPrompt(schema);
// "Generate a JSON object with the following structure:\n{ ... }"

const systemPrompt = buildSystemPrompt(schema, undefined, 'Focus on edge cases.');
// Full system prompt with schema description and additional instructions
```

### Parsing LLM Responses

Extract JSON from messy LLM output:

```typescript
import { parseJsonResponse } from 'synthdata-gen';

const objects = parseJsonResponse('Here is the result:\n```json\n{"key": "value"}\n```\nDone!');
// [{ key: "value" }]

const array = parseJsonResponse('[{"a": 1}, {"b": 2}]');
// [{ a: 1 }, { b: 2 }]
```

---

## TypeScript

All types are exported from the package entry point:

```typescript
import type {
  // LLM interface
  Message,
  LlmCallOptions,
  LlmResponse,
  LlmFunction,

  // Schema
  FieldType,
  SchemaField,
  ExampleSchema,

  // Generation
  GeneratedExample,
  DiversityConfig,
  HeuristicsConfig,
  CustomValidator,
  ValidationConfig,
  RetryConfig,
  CostConfig,
  DedupOptions,
  GenerateOptions,
  ExportFormat,
  ExportOptions,

  // Results
  GenerateResult,
  GenerationStats,
  ValidationResult,
  ValidationError,
  DedupResult,
} from 'synthdata-gen';
```

The `GeneratedExample<T>` type is generic. By default it is `Record<string, unknown> & { _meta?: ... }`. You can narrow it with your own type:

```typescript
interface QAPair {
  question: string;
  answer: string;
  category: string;
}

const result = await generate(schema, { count: 10 });
const data = result.data as GeneratedExample<QAPair>[];
```

---

## License

MIT
