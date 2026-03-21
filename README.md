# synthdata-gen

Generate and validate synthetic training data for LLM fine-tuning. Define a schema, generate examples matching that schema, validate, deduplicate, and export in training-ready formats.

## Install

```bash
npm install synthdata-gen
```

## Quick Start

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

// Template-based generation (no LLM required)
const result = await generate(schema, { count: 100 });
console.log(result.data);   // GeneratedExample[]
console.log(result.stats);  // { total, valid, invalid, deduped, final, ... }
```

## Using an LLM

Plug in any LLM via the `llm` callback or a custom `generateFn`:

```typescript
import { generate } from 'synthdata-gen';
import type { LlmFunction } from 'synthdata-gen';

const myLlm: LlmFunction = async (messages, options) => {
  const response = await callMyApi(messages, options);
  return { content: response.text };
};

const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  format: 'openai',  // export in OpenAI fine-tuning JSONL
});

console.log(result.exported); // JSONL string
```

## API

### `generate(schema, options)`

Main pipeline function. Generates examples, validates, deduplicates, and optionally exports.

**Options:**
- `count` -- Number of examples to generate
- `llm` -- LLM function `(messages, options) => Promise<LlmResponse>`
- `generateFn` -- Custom generation callback (overrides template generator)
- `batchSize` -- Examples per LLM call (default: 1)
- `format` -- Export format: `'openai'`, `'alpaca'`, `'sharegpt'`, `'csv'`, `'jsonl'`
- `dedup` -- Dedup config: `{ strategy: 'exact' | 'near' | 'semantic' | 'none', threshold?, fields? }`
- `validation` -- Validation config with heuristics and custom validators
- `retry` -- Retry config: `{ maxRetries, includeFeedback, backoff }`
- `seeds` -- Few-shot seed examples
- `invalidHandling` -- `'discard'` (default), `'log'`, or `'repair'`
- `costTracking` -- Track token costs

### `validate(examples, schema, config?)`

Validate an array of examples against a schema. Returns `ValidationResult[]`.

### `deduplicate(examples, options?)`

Deduplicate examples using exact, near-duplicate (Jaccard similarity), or semantic strategies.

### `exportAs(examples, format, options?)`

Export examples to a training-ready format string.

## Schema Definition

```typescript
const schema: ExampleSchema = {
  fields: {
    question: { type: 'string', min: 10, max: 500, description: 'A question' },
    answer: { type: 'string', min: 20, max: 2000 },
    category: { type: 'enum', enum: ['science', 'history', 'tech'] },
    difficulty: { type: 'integer', min: 1, max: 5 },
    tags: { type: 'array', items: { type: 'string' }, min: 1, max: 5 },
    active: { type: 'boolean' },
  },
  required: ['question', 'answer', 'category'],
};
```

**Supported field types:** `string`, `number`, `integer`, `boolean`, `enum`, `array`, `object`

## Export Formats

| Format | Description |
|--------|-------------|
| `openai` | OpenAI fine-tuning JSONL (`{"messages": [...]}`) |
| `alpaca` | Alpaca format (`{"instruction", "input", "output"}`) |
| `sharegpt` | ShareGPT format (`{"conversations": [...]}`) |
| `jsonl` | Plain JSONL (one JSON object per line) |
| `csv` | CSV with header row |

## Validation

Built-in heuristics: `nonEmpty`, `noPlaceholder`, `noDuplicateFields`, `minWordCount`. Custom validators supported.

```typescript
const result = await generate(schema, {
  count: 100,
  validation: {
    heuristics: { nonEmpty: true, noPlaceholder: true },
    custom: [{
      name: 'no-questions-in-output',
      validate: (ex) => ({
        valid: !String(ex.output).endsWith('?'),
        message: 'Output should not end with a question mark',
      }),
    }],
  },
});
```

## Deduplication

```typescript
import { deduplicate } from 'synthdata-gen';

// Exact dedup
const result = await deduplicate(examples, { strategy: 'exact' });

// Near-duplicate (Jaccard similarity)
const result2 = await deduplicate(examples, {
  strategy: 'near',
  threshold: 0.85,
  ngramSize: 2,
  fields: ['instruction'],
});

// Cross-set dedup against existing data
const result3 = await deduplicate(newExamples, {
  strategy: 'exact',
  existingData: existingExamples,
});
```

## License

MIT
