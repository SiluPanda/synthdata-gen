# synthdata-gen -- Specification

## 1. Overview

`synthdata-gen` is a synthetic training data generation pipeline for LLM fine-tuning and evaluation. It takes a schema definition (the shape of each training example), calls an LLM to generate examples matching that schema, validates each example against the schema, deduplicates the valid set, and exports the results in training-ready formats (OpenAI fine-tuning JSONL, Alpaca, ShareGPT, CSV, plain JSONL). It provides both a TypeScript/JavaScript API for programmatic use and a CLI for terminal-based generation workflows.

The gap this package fills is specific and well-defined. Generating synthetic training data for LLM fine-tuning requires a multi-step pipeline: define the desired data shape, prompt an LLM to produce examples matching that shape, parse and validate the LLM output (which frequently deviates from the requested structure), discard or retry invalid examples, remove duplicate and near-duplicate entries (LLMs are prone to generating repetitive examples), and export the clean data in the specific format required by the training framework. Today, this pipeline does not exist as a reusable package in the JavaScript/TypeScript ecosystem. Every team that needs synthetic training data writes ad-hoc scripts: a one-off Node.js script that calls GPT-4 in a loop, parses JSON from markdown fences, retries on parse failures, manually eyeballs for duplicates, and reformats for upload to the fine-tuning API. These scripts are brittle, non-reusable, and lack systematic validation and deduplication.

In the Python ecosystem, tools exist for synthetic data generation. Distilabel (HuggingFace) provides configurable pipelines for generating and labeling datasets using LLMs, but it is Python-only and deeply tied to the HuggingFace ecosystem. Argilla provides annotation and generation workflows, but it requires a running server and is designed for team collaboration rather than single-developer pipeline execution. Bonito generates instruction-following datasets from raw text, but it is research-oriented and Python-only. In practice, most teams generate synthetic data with ad-hoc scripts calling the OpenAI or Anthropic API directly. No JavaScript/TypeScript package provides the schema-to-export pipeline as a library.

`synthdata-gen` fills this gap by providing the complete pipeline as a composable library. The user defines the data schema (using Zod or JSON Schema), configures the generation prompt (system instructions, seed examples, diversity strategies), and calls `generate()` with a target count. The library handles LLM interaction, output parsing, schema validation, retry logic, deduplication, and export formatting. Each pipeline stage is independently usable -- a user who already has generated data can use just the validation and dedup stages, or just the export stage. The LLM interface is pluggable: any function matching `(messages: Message[]) => Promise<string>` works, with built-in adapters for OpenAI and Anthropic APIs. Cost tracking is built in, so users know how many tokens and dollars their generation run consumed.

`synthdata-gen` provides both a TypeScript/JavaScript API for programmatic use and a CLI for terminal-based generation. The API returns typed `GenerationResult` objects with per-example validation status, dedup statistics, and cost breakdowns. The CLI reads configuration from a JSON or YAML file, generates data, and writes output to a file in the specified format. Both interfaces support all pipeline stages, diversity strategies, and export formats.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `generate(schema, options)` function that calls an LLM to produce synthetic examples matching a user-defined schema, validates each example, deduplicates the valid set, and returns a `GenerationResult` with the clean examples and pipeline statistics.
- Provide a `generateBatch(schema, count, options)` function that orchestrates large-scale generation by batching LLM calls, tracking progress, and accumulating results until the target count of valid, unique examples is reached.
- Accept schema definitions in two forms: Zod schemas (programmatic, with runtime validation) and JSON Schema (declarative, for CLI and config file use). Automatically convert the schema into prompt instructions that tell the LLM what structure to produce.
- Validate every LLM-generated example against the schema before accepting it. Parse structured output from LLM responses (handling JSON in markdown fences, multiple examples per response, and malformed output). Retry or discard invalid examples with configurable retry limits.
- Deduplicate the valid example set using three strategies: exact match (identical text after normalization), near-duplicate detection (Jaccard similarity on token sets), and optional semantic deduplication (embedding cosine similarity via a pluggable embedder). Support per-field deduplication (e.g., unique instructions only, allowing duplicate categories).
- Export the final dataset in training-ready formats: OpenAI fine-tuning JSONL (`{"messages": [...]}`), Alpaca format (`{"instruction": ..., "input": ..., "output": ...}`), ShareGPT format (`{"conversations": [...]}`), plain JSONL (one JSON object per line), CSV (columnar), and eval-dataset format (compatible with the `eval-dataset` package from this monorepo).
- Support diversity strategies to prevent the repetitive, homogeneous output that naive LLM generation produces: temperature variation across batches, topic/category rotation through predefined lists, seed example rotation, persona-driven generation (using `synth-personas`), negative/adversarial example generation, and constraint variation per batch.
- Provide a pluggable LLM interface: any async function matching `(messages: Message[]) => Promise<string>` works. Ship built-in adapters for the OpenAI API (`openai` npm package) and Anthropic API (`@anthropic-ai/sdk`). Support structured output mode when the provider offers it (OpenAI JSON mode, Anthropic tool use).
- Track generation statistics: total generated, valid count, invalid count, deduplicated count, final count, LLM calls made, tokens used (prompt + completion), estimated cost, validation failure reasons (with counts), and a diversity score for the final set.
- Provide a `validate(data, schema)` function for standalone validation of existing data against a schema, independent of the generation pipeline.
- Provide a `deduplicate(data, options)` function for standalone deduplication of existing data, independent of the generation pipeline.
- Provide an `exportData(data, format, options)` function for standalone format conversion of existing data, independent of the generation pipeline.
- Provide a `createGenerator(config)` factory that returns a `DataGenerator` instance with reusable configuration for repeated generation runs.
- Provide a CLI (`synthdata-gen`) that reads a configuration file, runs the generation pipeline, and writes output to a file. Support all pipeline stages, formats, and diversity strategies via CLI flags and config file.
- Ship complete TypeScript type definitions. All public types are exported. All configuration objects are fully typed.

### Non-Goals

- **Not an LLM fine-tuning framework.** This package generates the training data. It does not train, fine-tune, or evaluate models. For fine-tuning, use the OpenAI fine-tuning API, Hugging Face `transformers`, or Axolotl. For evaluation, use `eval-dataset` and `output-grade` from this monorepo.
- **Not a prompt engineering tool.** This package uses prompts to instruct an LLM to generate data, but it does not optimize, version, or A/B test prompts. For prompt versioning, use `prompt-version` from this monorepo. For prompt linting, use `prompt-lint`.
- **Not a data labeling or annotation platform.** This package generates synthetic examples from a schema. It does not provide a UI for human annotators to review, correct, or label generated data. For annotation workflows, use Argilla, Label Studio, or a custom review pipeline.
- **Not a semantic deduplication engine.** Near-duplicate detection uses Jaccard similarity on token sets. Semantic deduplication (embedding cosine similarity) is supported via a pluggable embedder function, but the package does not ship an embedding model or API client. Users provide their own embedder if they want semantic dedup.
- **Not a persona generator.** This package generates structured data (training examples, Q&A pairs, classification data). For generating synthetic user personas, use `synth-personas` from this monorepo. The two packages are complementary: `synth-personas` generates the "who" (user profiles), `synthdata-gen` generates the "what" (training examples), and they integrate for persona-driven data generation.
- **Not a streaming data processor.** The pipeline operates on batch data that fits in memory. For datasets larger than available memory (millions of examples), generate in chunks and concatenate the output files.

---

## 3. Target Users and Use Cases

### ML Engineers Creating Fine-Tuning Data

Engineers who need to fine-tune an LLM on domain-specific data but lack sufficient real examples. They define the schema of their training examples (e.g., `{"instruction": string, "response": string, "category": enum}`), provide 3-5 seed examples as few-shot context, and use `synthdata-gen` to generate 1,000 validated, deduplicated training examples in OpenAI fine-tuning format. Without this package, they would write a script that calls the API in a loop, manually parse JSON from responses, eyeball for duplicates, and reformat for upload -- spending days on pipeline code instead of on the training task itself.

### Eval Engineers Building Evaluation Datasets

Engineers who maintain evaluation datasets and need to expand coverage. Their current dataset has 200 manually written test cases, but they need 2,000 to cover edge cases. They define the test case schema (matching `eval-dataset`'s `TestCase` format), configure diversity strategies to ensure the generated examples cover different categories and difficulty levels, and export directly to eval-dataset format. The generated data augments their hand-written examples without duplicating them (cross-set deduplication against existing data).

### NLP Researchers Generating Classification Training Sets

Researchers who need labeled training data for text classification. They define a schema with `text` and `label` fields, specify the label taxonomy (e.g., `["positive", "negative", "neutral"]`), and use category rotation to ensure balanced label distribution. The pipeline generates 500 examples per label, validates that every example has a valid label and non-trivial text, and deduplicates across the full set. The output is a CSV ready for model training.

### Product Teams Generating Few-Shot Examples

Teams building LLM-powered features that use few-shot prompting. They need 20-50 high-quality examples for in-context learning, not thousands for fine-tuning. They use `synthdata-gen` with a small target count, high temperature for diversity, and strict validation to produce a curated set of examples. The schema enforces the exact structure their application expects, and deduplication ensures no two examples are too similar.

### Data Engineers Building Instruction-Following Datasets

Engineers creating instruction-following datasets in Alpaca or ShareGPT format for open-source model training. They define a schema for instruction-input-output triples, configure topic rotation to cover diverse instruction types (coding, writing, reasoning, summarization), and generate thousands of examples. The pipeline exports directly in the target format with no manual conversion step.

### Teams Integrating with the npm-master Ecosystem

Developers using `eval-dataset` for dataset management, `synth-personas` for persona generation, `prompt-snap` for prompt snapshot testing, and `llm-retry` for resilient LLM calls. `synthdata-gen` sits upstream of `eval-dataset`: it generates the data that `eval-dataset` manages. It consumes `synth-personas` for persona-driven diversity. It uses `llm-retry` internally for retry logic on LLM calls. Generated data can be snapshot-tested with `prompt-snap`.

---

## 4. Core Concepts

### Schema

A schema defines the structure of each generated training example. It specifies the fields, their types, constraints (minimum/maximum length, enum values, regex patterns), and which fields are required. The schema serves two purposes: it is compiled into prompt instructions that tell the LLM what structure to produce, and it is used as the validation target for parsing and checking generated output.

Schemas can be defined in two ways:

- **Zod schema**: A Zod object schema constructed programmatically. Provides runtime validation, type inference, and rich constraint expressions. Preferred for TypeScript API use.
- **JSON Schema**: A standard JSON Schema object. Provides a portable, language-agnostic schema definition. Preferred for CLI and config file use. Automatically converted to Zod internally for validation.

Example schema for a Q&A training example:

```typescript
const schema = z.object({
  question: z.string().min(10).max(500).describe('A natural language question'),
  answer: z.string().min(20).max(2000).describe('A detailed, accurate answer'),
  category: z.enum(['science', 'history', 'technology', 'literature', 'geography']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
```

### Generation Prompt

The generation prompt is the set of messages sent to the LLM to elicit training examples. It consists of a system prompt (instructions for the generation task), optional seed examples (few-shot demonstrations of desired output), diversity instructions (explicit guidance for variety), and the schema description (what fields to produce and their constraints). The generation prompt is constructed automatically from the schema and configuration, but users can override or extend any component.

### Validation

Validation is the process of checking whether a generated example conforms to the schema. Each generated example is parsed from the LLM's text output and validated against the schema definition. Validation checks include: structural conformance (required fields present, correct types), constraint satisfaction (string lengths within bounds, enum values valid, patterns matched), and quality heuristics (fields are non-empty, not repetitive, contain substantive content). Invalid examples are either retried (the LLM is called again with feedback about the validation error) or discarded, depending on configuration.

### Deduplication

Deduplication removes duplicate and near-duplicate examples from the generated set. LLMs are prone to generating repetitive output, especially when asked for many examples on a narrow topic. Without deduplication, a generated dataset of 1,000 examples might contain 200 near-identical entries, which wastes training compute and biases the model toward the duplicated patterns. Deduplication operates at three levels:

- **Exact**: Identical text after normalization (lowercasing, whitespace collapsing, punctuation stripping).
- **Near-duplicate**: High token-level similarity measured by Jaccard index on word n-gram sets. Configurable threshold (default: 0.85).
- **Semantic**: High meaning-level similarity measured by cosine similarity on embedding vectors. Requires a user-provided embedder function. Configurable threshold (default: 0.92).

### Export Format

An export format is a specific serialization structure expected by a training or evaluation framework. Each format has its own field names, nesting conventions, and file structure. `synthdata-gen` maps from the generated data (which matches the user-defined schema) to the target format using configurable field mappings. Built-in formats include OpenAI fine-tuning JSONL, Alpaca, ShareGPT, plain JSONL, CSV, and eval-dataset.

### Diversity Strategy

A diversity strategy is a configuration that varies the generation parameters across batches to produce a broader range of examples. Without diversity strategies, an LLM given the same prompt repeatedly tends to converge on a narrow set of patterns: similar topics, similar phrasing, similar structure. Diversity strategies counteract this convergence by systematically varying the prompt context, temperature, topic focus, or authorial perspective across generation batches.

### LLM Function

The LLM function is the user-provided async function that calls a language model. It takes an array of messages (system, user, assistant) and returns the model's text response. This abstraction decouples the generation pipeline from any specific LLM provider. The same pipeline works with OpenAI, Anthropic, local models, or any other provider that can be wrapped in this interface.

---

## 5. Generation Pipeline

### End-to-End Flow

The generation pipeline transforms a schema definition and configuration into a validated, deduplicated dataset in a training-ready format. The pipeline operates in seven stages, each independently usable:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Generation Pipeline                            │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │ 1. Schema │──>│ 2. Prompt│──>│ 3. LLM   │──>│ 4. Parse │        │
│  │  Define   │   │  Build   │   │  Call     │   │ & Validate│       │
│  └──────────┘   └──────────┘   └──────────┘   └─────┬────┘        │
│                                                      │              │
│                                          ┌───────────┴──────────┐  │
│                                          │  Valid?               │  │
│                                          │  Yes ──> accumulate  │  │
│                                          │  No  ──> retry or    │  │
│                                          │          discard     │  │
│                                          └───────────┬──────────┘  │
│                                                      │              │
│                               ┌──────────┐   ┌──────┴─────┐       │
│                               │ 7. Export │<──│ 6. Dedup   │       │
│                               │  Format  │   │            │       │
│                               └──────────┘   └──────┬─────┘       │
│                                                      │              │
│                                              ┌───────┴──────┐      │
│                                              │ 5. Retry     │      │
│                                              │ (if needed)  │      │
│                                              └──────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### Stage 1: Schema Definition

The user defines the output schema -- the structure each generated example must match. The schema is provided as a Zod schema object or a JSON Schema object. Zod schemas are used directly for validation. JSON Schema objects are converted to Zod schemas internally using a schema compiler.

The schema definition drives two things: prompt construction (the LLM needs to know what structure to produce) and validation (each generated example is checked against this schema).

**Schema-to-prompt conversion**: The schema is introspected to produce a natural language description of the expected output structure. Each field becomes a line in the prompt: the field name, its type, any constraints (min/max length, enum values), and its `.describe()` description if provided. For Zod schemas, the introspection uses Zod's internal metadata. For JSON Schema, the introspection reads the `properties`, `required`, `enum`, `minLength`, `maxLength`, and `description` fields.

Example prompt fragment generated from the Q&A schema:

```
Generate a JSON object with the following structure:
{
  "question": string (10-500 characters) - A natural language question,
  "answer": string (20-2000 characters) - A detailed, accurate answer,
  "category": one of ["science", "history", "technology", "literature", "geography"],
  "difficulty": one of ["easy", "medium", "hard"]
}
```

### Stage 2: Prompt Construction

The pipeline builds the full prompt from several components:

1. **System prompt**: Instructions for the generation task. Default: "You are a training data generator. Generate a single training example matching the schema below. Output ONLY a valid JSON object, with no additional text, markdown, or explanation." The system prompt is configurable.
2. **Schema description**: The auto-generated schema description from Stage 1.
3. **Seed examples**: Optional few-shot examples provided by the user. Each seed example is formatted as a user message ("Generate an example") followed by an assistant message (the example JSON). Seed examples teach the LLM the desired style, quality, and level of detail.
4. **Diversity instructions**: Dynamic instructions injected to promote variety. Depends on the active diversity strategy (see Section 8). Examples: "Generate an example about {topic}" (topic rotation), "Generate an example from the perspective of {persona}" (persona-driven), "Generate an example that is DIFFERENT from the previous examples" (explicit diversity).
5. **Batch instructions**: When generating multiple examples per LLM call, the prompt asks for a JSON array of N examples. This reduces per-example API cost at the expense of slightly lower quality and diversity within each batch.

The prompt components are assembled into a messages array: `[system, ...seedExamples, user]`. The final user message requests generation with any active diversity instructions.

### Stage 3: LLM Call

The constructed prompt is sent to the LLM via the user-provided LLM function. The pipeline tracks:

- **Call count**: Total number of LLM API calls made.
- **Token usage**: Prompt tokens and completion tokens per call (if the LLM function returns usage data).
- **Cost**: Estimated cost based on configurable per-token pricing.
- **Latency**: Time per call for performance monitoring.

For batch generation (multiple examples per call), the LLM is instructed to return a JSON array. For single-example generation, the LLM returns a single JSON object.

When `structuredOutput` mode is enabled and the provider supports it (OpenAI's `response_format: { type: "json_object" }`, Anthropic's tool use), the pipeline uses the provider's structured output feature to increase the likelihood of valid JSON output.

### Stage 4: Parse and Validate

The LLM's text response is parsed and validated:

1. **JSON extraction**: The response is searched for JSON content. The parser handles: bare JSON objects/arrays, JSON wrapped in markdown code fences (`` ```json ... ``` ``), JSON embedded in explanatory text, and multiple JSON objects separated by newlines.
2. **Schema validation**: Each extracted JSON object is validated against the schema using Zod's `.safeParse()`. The validation result includes a success flag and, on failure, a structured list of validation errors (field path, expected type, received value).
3. **Quality heuristics**: Beyond schema conformance, optional quality checks verify that generated content is substantive: strings are not just whitespace or placeholder text ("Lorem ipsum", "Example text here"), fields that should be unique within an example are not identical to each other (the question is not the same as the answer), and numeric values are within reasonable ranges.
4. **Result classification**: Each parsed example is classified as `valid` (passes schema and quality checks), `invalid` (fails schema or quality checks), or `unparseable` (not valid JSON).

### Stage 5: Retry Logic

Invalid and unparseable examples trigger retry logic:

- **Retry budget**: Each generation attempt has a configurable maximum retry count (default: 3). Once exhausted, the invalid example is discarded.
- **Retry prompt**: On retry, the LLM receives feedback about what went wrong. For schema validation failures: "The previous example was invalid: field 'category' must be one of ['science', 'history', ...] but received 'math'. Generate a corrected example." For parse failures: "The previous response was not valid JSON. Output ONLY a valid JSON object."
- **Backoff**: Retries use a configurable delay (default: no delay for fast generation, optional exponential backoff for rate-limited APIs).

The retry loop continues until either a valid example is produced or the retry budget is exhausted. Discarded examples are logged in the generation statistics with their failure reasons.

### Stage 6: Deduplication

After accumulating valid examples, the pipeline deduplicates the set:

1. **Normalization**: Each example is normalized for comparison. Text fields are lowercased, whitespace is collapsed, and leading/trailing whitespace is trimmed. Non-text fields are serialized to canonical JSON strings.
2. **Exact dedup**: Examples with identical normalized representations are reduced to one instance.
3. **Near-duplicate dedup**: For each pair of remaining examples, Jaccard similarity is computed on the word n-gram sets of configurable fields (default: all string fields). Pairs exceeding the similarity threshold (default: 0.85) are reduced to one instance. The implementation uses an inverted index for efficient candidate pair generation, avoiding O(n^2) full comparisons for large datasets.
4. **Semantic dedup** (optional): If a user-provided embedder function is configured, each example's key fields are embedded and cosine similarity is computed between all pairs. Pairs exceeding the semantic similarity threshold (default: 0.92) are reduced to one instance.
5. **Per-field dedup**: Optionally, deduplication can target specific fields. For example, `dedupFields: ['instruction']` deduplicates based only on the instruction field, allowing examples with the same category but different instructions.

When two examples are duplicates, the pipeline keeps the first-generated instance (preserving the order of generation).

### Stage 7: Export

The deduplicated, valid examples are exported in the specified format:

- Each format has a defined field mapping from the user's schema fields to the format's expected field names.
- The user can override the default field mapping with custom mappings.
- The output is a string (for programmatic use) or written to a file (for CLI use).

Export formats are detailed in Section 10.

---

## 6. Schema Definition

### Zod Schema

The primary schema definition method for TypeScript users. Zod provides runtime validation, type inference, and rich constraint expressions. Any Zod object schema is accepted.

```typescript
import { z } from 'zod';
import { generate } from 'synthdata-gen';

const schema = z.object({
  instruction: z.string().min(10).max(200).describe('A clear instruction for the model'),
  input: z.string().max(500).describe('Optional context or input data').default(''),
  output: z.string().min(20).max(1000).describe('The expected model response'),
  category: z.enum(['coding', 'writing', 'reasoning', 'math', 'general']),
});

const result = await generate(schema, {
  llm: myLlmFunction,
  count: 100,
});
```

**Supported Zod types**:

| Zod Type | JSON Prompt Description | Validation |
|---|---|---|
| `z.string()` | `string` | Type check |
| `z.string().min(n)` | `string (min n characters)` | Min length |
| `z.string().max(n)` | `string (max n characters)` | Max length |
| `z.string().regex(r)` | `string (pattern: r)` | Regex match |
| `z.number()` | `number` | Type check |
| `z.number().int()` | `integer` | Integer check |
| `z.number().min(n)` | `number (min n)` | Min value |
| `z.number().max(n)` | `number (max n)` | Max value |
| `z.boolean()` | `boolean` | Type check |
| `z.enum([...])` | `one of [...]` | Enum membership |
| `z.array(t)` | `array of <t>` | Array type check |
| `z.array(t).min(n)` | `array of <t> (min n items)` | Min length |
| `z.array(t).max(n)` | `array of <t> (max n items)` | Max length |
| `z.object({...})` | Nested object description | Recursive validation |
| `z.optional(t)` | `<t> (optional)` | Presence not required |
| `.describe(s)` | Appended as `- s` | N/A (documentation only) |
| `.default(v)` | `(default: v)` | Applied if missing |

### JSON Schema

For CLI and config file use, schemas can be defined as standard JSON Schema objects. JSON Schema is converted to Zod internally for validation.

```json
{
  "type": "object",
  "properties": {
    "instruction": {
      "type": "string",
      "minLength": 10,
      "maxLength": 200,
      "description": "A clear instruction for the model"
    },
    "input": {
      "type": "string",
      "maxLength": 500,
      "description": "Optional context or input data",
      "default": ""
    },
    "output": {
      "type": "string",
      "minLength": 20,
      "maxLength": 1000,
      "description": "The expected model response"
    },
    "category": {
      "type": "string",
      "enum": ["coding", "writing", "reasoning", "math", "general"]
    }
  },
  "required": ["instruction", "output", "category"]
}
```

**Supported JSON Schema features**:

| JSON Schema Feature | Conversion |
|---|---|
| `type: "string"` | `z.string()` |
| `type: "number"` | `z.number()` |
| `type: "integer"` | `z.number().int()` |
| `type: "boolean"` | `z.boolean()` |
| `type: "array"` | `z.array()` |
| `type: "object"` | `z.object()` |
| `enum` | `z.enum()` |
| `minLength` / `maxLength` | `.min()` / `.max()` |
| `minimum` / `maximum` | `.min()` / `.max()` |
| `minItems` / `maxItems` | `.min()` / `.max()` |
| `pattern` | `.regex()` |
| `required` | Non-required fields wrapped in `z.optional()` |
| `description` | `.describe()` |
| `default` | `.default()` |

### Schema-to-Prompt Conversion

The schema is compiled into a prompt fragment that describes the expected output structure to the LLM. The conversion walks the schema tree and produces a formatted JSON template with type annotations and constraints inline.

**Conversion algorithm**:

1. For each field in the schema, produce a line: `"fieldName": <type> (<constraints>) - <description>`.
2. For enum fields, list all valid values: `"category": one of ["science", "history", "technology"]`.
3. For nested objects, indent and recurse.
4. For arrays, describe the element type: `"tags": array of string (min 1 item, max 5 items)`.
5. Mark optional fields: `"input": string (optional, max 500 characters)`.
6. Wrap in a JSON-like template block for clarity.

**Example output**:

```
Generate a JSON object with the following structure:
{
  "instruction": string (10-200 characters) - A clear instruction for the model,
  "input": string (optional, max 500 characters) - Optional context or input data,
  "output": string (20-1000 characters) - The expected model response,
  "category": one of ["coding", "writing", "reasoning", "math", "general"]
}
```

This prompt fragment is inserted into the system message after the task instructions and before any seed examples.

---

## 7. Generation Prompts

### System Prompt Template

The default system prompt instructs the LLM to act as a training data generator:

```
You are a synthetic training data generator. Your task is to generate high-quality
training examples that match the specified schema exactly.

Rules:
1. Output ONLY a valid JSON object (or JSON array if multiple examples are requested).
2. Do not include any explanation, commentary, or markdown formatting.
3. Every field must conform to the specified type and constraints.
4. Generate diverse, realistic, and substantive content -- not placeholder text.
5. Each example should be independent and self-contained.

{schema_description}
```

The `{schema_description}` placeholder is replaced with the compiled schema prompt from Section 6.

Users can override the entire system prompt or provide additional instructions that are appended:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 50,
  systemPrompt: 'You are an expert in medical terminology. Generate training examples for a medical Q&A system.',
  // Or append to the default:
  additionalInstructions: 'All examples must be medically accurate and use proper clinical terminology.',
});
```

### Seed Examples

Seed examples are few-shot demonstrations included in the prompt to show the LLM the desired output style, quality, and level of detail. Each seed is an object matching the schema. Seeds are formatted as user-assistant message pairs in the prompt.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  seeds: [
    {
      instruction: 'Explain the difference between TCP and UDP.',
      input: '',
      output: 'TCP (Transmission Control Protocol) is a connection-oriented protocol that ensures reliable data delivery through acknowledgments and retransmission. UDP (User Datagram Protocol) is connectionless and does not guarantee delivery, but offers lower latency. TCP is used for web browsing, email, and file transfer. UDP is used for video streaming, gaming, and DNS lookups.',
      category: 'coding',
    },
    {
      instruction: 'Write a haiku about autumn.',
      input: '',
      output: 'Crimson leaves descend\nWhispering through the cool breeze\nNature\'s last encore',
      category: 'writing',
    },
  ],
});
```

The seeds are included in the prompt as:

```
User: Generate a training example.
Assistant: {"instruction": "Explain the difference between TCP and UDP.", "input": "", "output": "TCP (Transmission Control Protocol) is...", "category": "coding"}

User: Generate a training example.
Assistant: {"instruction": "Write a haiku about autumn.", "input": "", "output": "Crimson leaves descend...", "category": "writing"}
```

**Seed rotation**: When multiple seeds are provided, the pipeline rotates through them across generation batches. Batch 1 uses seeds [0, 1], batch 2 uses seeds [1, 2], batch 3 uses seeds [2, 0], and so on. This prevents the LLM from fixating on a single example's style. The rotation strategy is configurable: `sequential` (cycle in order), `random` (random subset per batch), or `all` (include all seeds every time).

### Diversity Instructions

Diversity instructions are dynamic prompt additions that vary across generation batches to encourage variety. They are generated automatically based on the active diversity strategy (see Section 8) and appended to the user message in each generation call.

Examples of generated diversity instructions:

- **Topic rotation**: `"Generate an example about the topic: machine learning algorithms."`
- **Category balancing**: `"Generate an example with category: 'history'. The dataset currently has too few history examples."`
- **Explicit differentiation**: `"Generate an example that is distinctly different from these previously generated examples: [summary of recent examples]."`
- **Persona-driven**: `"Generate an example as if written by a graduate student in biology."`
- **Constraint variation**: `"Generate an example with a short, concise output (under 100 characters)."`

### Batch Generation

For cost efficiency, the pipeline can request multiple examples per LLM call. Instead of making 100 API calls for 100 examples, it makes 10 calls requesting 10 examples each. The prompt changes from "Generate a training example" to "Generate 10 different training examples as a JSON array."

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  batchSize: 10,  // Request 10 examples per LLM call
});
```

**Trade-offs of batch generation**:

- **Pro**: Reduces API calls and total cost (fewer prompt tokens repeated).
- **Pro**: Faster wall-clock time for large generation runs.
- **Con**: Within-batch diversity is lower (the LLM sees all examples in one context window and tends to make them similar).
- **Con**: A single malformed response can lose multiple examples.
- **Con**: Token limits constrain maximum batch size for schemas with large outputs.

Default batch size is 1 (one example per call) for maximum quality and diversity. Users can increase it for cost-sensitive large-scale generation.

### Custom Prompt Templates

For full control, users can provide a custom prompt template with placeholders:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 50,
  promptTemplate: {
    system: `You are a {domain} expert. Generate training data for a {task} system.

{schema_description}

{additional_instructions}`,
    user: `Generate {batch_size} example(s) about {topic}.

{diversity_instructions}`,
  },
  templateVars: {
    domain: 'medical',
    task: 'diagnostic Q&A',
  },
});
```

Available template placeholders:

| Placeholder | Replaced With |
|---|---|
| `{schema_description}` | Compiled schema prompt |
| `{additional_instructions}` | User-provided additional instructions |
| `{diversity_instructions}` | Auto-generated diversity instructions for this batch |
| `{batch_size}` | Number of examples requested in this call |
| `{topic}` | Current topic from topic rotation |
| `{category}` | Current category from category rotation |
| `{seed_examples}` | Formatted seed examples |
| `{example_number}` | Sequential example number |
| Custom variables | User-provided `templateVars` values |

---

## 8. Diversity Strategies

### Overview

Diversity strategies are configurations that systematically vary generation parameters to produce a broader range of examples. Multiple strategies can be combined. Each strategy operates independently, injecting its variation into the generation prompt or LLM call parameters.

### Temperature Variation

Vary the LLM's temperature parameter across generation batches. Lower temperatures (0.3-0.7) produce more focused, predictable output. Higher temperatures (0.8-1.2) produce more creative, varied output. By cycling through temperatures, the dataset contains both conventional and unusual examples.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  diversity: {
    temperature: {
      min: 0.5,
      max: 1.2,
      strategy: 'linear',  // Linearly increase from min to max across batches
    },
  },
});
```

**Strategies**:

- `linear`: Linearly interpolate from `min` to `max` across all batches. Batch 1 uses `min`, last batch uses `max`.
- `cycle`: Cycle through `[min, mid, max, mid, min, ...]`.
- `random`: Random temperature between `min` and `max` per batch.

The temperature is passed to the LLM function as a parameter. The LLM adapter is responsible for applying it. Built-in adapters (OpenAI, Anthropic) support temperature configuration.

### Topic Rotation

Cycle through a predefined list of topics or subtopics. Each generation batch is instructed to produce examples about the current topic. This ensures broad topic coverage instead of the LLM fixating on a single subject.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  diversity: {
    topics: [
      'machine learning',
      'web development',
      'data structures',
      'operating systems',
      'networking',
      'databases',
      'security',
      'cloud computing',
    ],
  },
});
```

The pipeline cycles through topics sequentially. If the target count exceeds the number of topics, the cycle repeats. The topic is injected into the prompt as: "Generate an example about the topic: {topic}."

### Category Rotation

When the schema includes a categorical field (an enum), category rotation ensures balanced representation across all enum values. The pipeline tracks the count of generated examples per category and prioritizes underrepresented categories.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  diversity: {
    balanceField: 'category',  // Balance across this enum field
  },
});
```

**Algorithm**: Before each generation batch, compute the category with the fewest valid examples. Instruct the LLM: "Generate an example with category: '{underrepresented_category}'." This produces approximately uniform distribution across categories. For a schema with 5 categories and a target of 100, each category gets approximately 20 examples.

### Seed Variation

Rotate through different seed examples across batches. Different seeds steer the LLM toward different styles and content patterns.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  seeds: [seedA, seedB, seedC, seedD, seedE],
  diversity: {
    seedRotation: 'sequential',  // sequential | random | window
    seedsPerBatch: 2,  // Number of seeds to include in each batch's prompt
  },
});
```

**Rotation modes**:

- `sequential`: Cycle through seeds in order. Batch 1 uses seeds [0, 1], batch 2 uses seeds [1, 2], etc.
- `random`: Random subset of `seedsPerBatch` seeds per batch.
- `window`: Sliding window of `seedsPerBatch` consecutive seeds.

### Persona-Driven Generation

Use `synth-personas` to generate diverse "author" perspectives. Each batch is instructed to generate examples as if written by a different persona. This produces variation in vocabulary, formality, complexity, and domain focus.

```typescript
import { generateBatch as generatePersonas } from 'synth-personas';

const personas = generatePersonas(10, { seed: 42 });

const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  diversity: {
    personas: personas,  // Rotate through these personas
  },
});
```

The pipeline cycles through personas. For each batch, the current persona's characteristics are injected into the prompt: "Generate an example as if written by a {persona.demographics.occupation} with {persona.communication.formality === 5 ? 'very formal' : 'casual'} communication style and {persona.technical.literacy >= 4 ? 'high' : 'low'} technical expertise."

### Negative Examples

Explicitly generate edge cases, adversarial examples, or examples that test boundary conditions. The prompt is modified to request challenging or unusual examples.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  diversity: {
    negativeExampleRatio: 0.2,  // 20% of examples should be edge cases
    negativeInstructions: 'Generate an edge case: an unusually difficult, ambiguous, or tricky example that tests the limits of the schema.',
  },
});
```

For 20% of batches, the standard prompt is replaced with the negative prompt. The generated examples are tagged with `_meta.isNegative: true` in the output so users can identify them.

### Constraint Variation

Vary specific schema constraints across batches to produce examples of different lengths, complexities, or styles.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  diversity: {
    constraintVariation: [
      { instruction: 'Generate an example with a SHORT output (under 50 words).' },
      { instruction: 'Generate an example with a DETAILED output (over 200 words).' },
      { instruction: 'Generate an example that requires multi-step reasoning.' },
      { instruction: 'Generate a simple, straightforward example.' },
    ],
  },
});
```

The constraint variations are cycled through like topics. Each variation is appended to the user message for its batch.

### Combined Strategies

Multiple diversity strategies can be used simultaneously. They are applied independently: temperature varies per batch, topics rotate per batch, and seed examples rotate per batch. The combined effect produces maximum variety.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 500,
  diversity: {
    temperature: { min: 0.5, max: 1.1, strategy: 'cycle' },
    topics: ['topic1', 'topic2', 'topic3'],
    balanceField: 'category',
    seedRotation: 'random',
    negativeExampleRatio: 0.1,
  },
});
```

---

## 9. Validation

### Schema Validation

Every generated example is validated against the schema using Zod's `.safeParse()` method. Zod provides detailed, structured error reporting: each validation failure includes the field path (e.g., `answer`), the expected type or constraint, and the actual value received.

```typescript
import { validate } from 'synthdata-gen';

const result = validate(
  { instruction: 'Hi', output: '', category: 'math' },
  schema,
);

// result:
// {
//   valid: false,
//   errors: [
//     { path: ['instruction'], message: 'String must contain at least 10 character(s)', code: 'too_small' },
//     { path: ['output'], message: 'String must contain at least 20 character(s)', code: 'too_small' },
//     { path: ['category'], message: "Invalid enum value. Expected 'coding' | 'writing' | 'reasoning' | 'math' | 'general', received 'math'" ... }
//   ]
// }
```

Note: in the example above, `'math'` is a valid enum value, so that field would actually pass. The illustration shows the error format for when values fail validation.

### Length Constraints

String length constraints defined in the schema (`.min()`, `.max()`) are enforced during validation. Additionally, the pipeline supports global length constraints that apply to all string fields:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  validation: {
    minFieldLength: 5,    // All string fields must have at least 5 characters
    maxFieldLength: 5000, // No string field may exceed 5000 characters
  },
});
```

### Quality Heuristics

Beyond schema conformance, optional quality heuristics catch low-quality generated content:

| Heuristic | What It Checks | Default |
|---|---|---|
| `nonEmpty` | All required string fields contain non-whitespace content | Enabled |
| `noPlaceholder` | Fields do not contain placeholder text ("Lorem ipsum", "Example text", "TODO", "[insert here]") | Enabled |
| `noDuplicateFields` | Distinct fields that should differ actually differ (e.g., question != answer) | Enabled |
| `minWordCount` | String fields have a minimum word count (configurable, default: 3) | Disabled |
| `noRepetition` | Fields do not contain excessive repeated phrases or sentences | Disabled |
| `languageCheck` | Fields are in the expected language (requires a language detection function) | Disabled |

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  validation: {
    heuristics: {
      nonEmpty: true,
      noPlaceholder: true,
      noDuplicateFields: { pairs: [['question', 'answer']] },
      minWordCount: { fields: ['output'], min: 10 },
    },
  },
});
```

### Custom Validators

Users can define custom validation functions that run after schema and heuristic validation:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  validation: {
    custom: [
      {
        name: 'answer-not-question',
        validate: (example) => {
          if (example.output.endsWith('?')) {
            return { valid: false, message: 'Output should be an answer, not a question' };
          }
          return { valid: true };
        },
      },
      {
        name: 'category-matches-content',
        validate: (example) => {
          // Domain-specific validation
          if (example.category === 'coding' && !example.instruction.match(/code|program|function|algorithm/i)) {
            return { valid: false, message: 'Coding category but instruction does not mention coding' };
          }
          return { valid: true };
        },
      },
    ],
  },
});
```

### Retry Strategy

When validation fails, the pipeline retries generation with feedback:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  retry: {
    maxRetries: 3,          // Maximum retry attempts per example
    includeFeedback: true,  // Include validation error in retry prompt
    backoff: 'none',        // 'none' | 'linear' | 'exponential'
    backoffMs: 1000,        // Base delay for backoff
  },
});
```

**Retry prompt construction**: On retry, the pipeline sends the original prompt plus an additional message describing the failure:

```
User: The previous example was invalid:
- Field "output": String must contain at least 20 characters (received 8 characters).
- Field "category": Invalid value "math" -- not in the allowed values.
Please generate a corrected example that fixes these issues.
```

### Invalid Example Handling

Invalid examples that exhaust their retry budget can be handled in three ways:

- **`discard`** (default): The example is dropped and not included in the output. The generation loop continues until the target count of valid examples is reached.
- **`log`**: The example is dropped from the output but logged in `result.stats.invalidExamples` with its validation errors for post-hoc analysis.
- **`repair`**: The example is included in the output with a `_meta.repaired: true` flag and the original validation errors. Fields that failed validation are set to their default values or left as-is. This mode is for users who want to manually review and fix near-valid examples.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  invalidHandling: 'log',  // 'discard' | 'log' | 'repair'
});

console.log(result.stats.invalidExamples);
// [{ example: {...}, errors: [...], retries: 3 }, ...]
```

---

## 10. Deduplication

### Overview

Deduplication removes identical and near-identical examples from the generated set. It operates after validation, on the set of valid examples. Deduplication is critical for training data quality: duplicate examples waste training compute, bias the model toward duplicated patterns, and inflate dataset size without adding information.

### Exact Deduplication

Exact deduplication removes examples with identical content after normalization.

**Normalization pipeline**:

1. For each string field: lowercase, collapse whitespace (multiple spaces/tabs/newlines to single space), trim leading/trailing whitespace.
2. For non-string fields: serialize to canonical JSON (sorted keys, no whitespace).
3. Concatenate all normalized field values with a delimiter.
4. Compute a hash (SHA-256 truncated to 16 bytes) of the concatenated string.
5. Examples with identical hashes are duplicates. Keep the first, discard the rest.

**Performance**: O(n) time and space. Each example is hashed once, and duplicates are detected via hash table lookup.

### Near-Duplicate Detection

Near-duplicate detection identifies examples that are not identical but are highly similar -- for example, the same question with minor rephrasing, or the same answer with a few words changed.

**Algorithm**: Jaccard similarity on word n-gram sets.

1. For each example, compute the set of word n-grams (default: bigrams) from the configured dedup fields.
2. For each pair of examples, compute the Jaccard index: `|A intersection B| / |A union B|`.
3. Pairs with Jaccard index above the threshold (default: 0.85) are near-duplicates. Keep the first, discard the second.

**Efficient implementation**: Computing all pairwise Jaccard similarities is O(n^2), which is slow for large datasets. The implementation uses MinHash locality-sensitive hashing (LSH) to reduce the candidate set:

1. Compute MinHash signatures (default: 128 hash functions) for each example.
2. Divide signatures into bands (default: 16 bands of 8 hashes each).
3. Examples that share at least one identical band are candidate pairs.
4. Compute exact Jaccard similarity only for candidate pairs.

This reduces the comparison count from O(n^2) to approximately O(n * k) where k is the average number of candidates per example. For datasets of 1,000-10,000 examples with typical LLM-generated similarity patterns, this is 10-100x faster than brute force.

```typescript
import { deduplicate } from 'synthdata-gen';

const deduped = deduplicate(examples, {
  strategy: 'near',
  threshold: 0.85,
  ngramSize: 2,
  fields: ['instruction', 'output'],  // Dedup based on these fields
});
```

### Semantic Deduplication

Semantic deduplication identifies examples with similar meaning even when the surface text differs. It requires a user-provided embedder function that maps text to a numeric vector.

**Algorithm**:

1. For each example, embed the configured fields using the embedder function. Concatenate field values before embedding, or embed per-field and average the vectors (configurable).
2. For each pair of examples, compute cosine similarity: `dot(a, b) / (||a|| * ||b||)`.
3. Pairs with cosine similarity above the threshold (default: 0.92) are semantic duplicates. Keep the first, discard the second.

**Efficient implementation**: Uses approximate nearest neighbor search (brute force for datasets under 5,000 examples, optional pluggable ANN index for larger datasets).

```typescript
import { deduplicate } from 'synthdata-gen';

const deduped = deduplicate(examples, {
  strategy: 'semantic',
  threshold: 0.92,
  embedder: async (text: string) => {
    // Call embedding API (e.g., OpenAI text-embedding-3-small)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
  fields: ['instruction'],
});
```

### Per-Field Deduplication

By default, deduplication considers all fields. Per-field dedup restricts comparison to specific fields, useful when some fields should be unique but others are expected to repeat (e.g., unique instructions but categories will naturally repeat).

```typescript
const deduped = deduplicate(examples, {
  strategy: 'near',
  threshold: 0.85,
  fields: ['instruction'],  // Only dedup on the instruction field
});
```

### Cross-Set Deduplication

When generating data to augment an existing dataset, cross-set deduplication ensures no generated example duplicates an existing example. The user provides the existing dataset, and the pipeline removes any generated example that is too similar to any existing example.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  dedup: {
    strategy: 'near',
    threshold: 0.85,
    existingData: existingExamples,  // Array of existing examples to check against
  },
});
```

### Deduplication Configuration

```typescript
interface DedupOptions {
  /** Deduplication strategy. Default: 'exact'. */
  strategy: 'exact' | 'near' | 'semantic' | 'none';

  /** Similarity threshold for near-duplicate and semantic dedup. Default: 0.85 for near, 0.92 for semantic. */
  threshold?: number;

  /** N-gram size for near-duplicate detection. Default: 2 (bigrams). */
  ngramSize?: number;

  /** Fields to compare for deduplication. Default: all string fields. */
  fields?: string[];

  /** Embedder function for semantic deduplication. Required when strategy is 'semantic'. */
  embedder?: (text: string) => Promise<number[]>;

  /** Existing examples to cross-deduplicate against. */
  existingData?: Record<string, unknown>[];

  /** MinHash configuration for near-duplicate detection. */
  minhash?: {
    numHashes: number;  // Default: 128
    numBands: number;   // Default: 16
  };
}
```

---

## 11. Export Formats

### OpenAI Fine-Tuning JSONL

The standard format for OpenAI fine-tuning. Each line is a JSON object with a `messages` array containing system, user, and assistant messages.

```jsonl
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Explain the difference between TCP and UDP."}, {"role": "assistant", "content": "TCP is a connection-oriented protocol..."}]}
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Write a haiku about autumn."}, {"role": "assistant", "content": "Crimson leaves descend..."}]}
```

**Field mapping** (default):

| Schema Field | OpenAI Field | Notes |
|---|---|---|
| `instruction` or first string field | `messages[1].content` (user) | The user message |
| `output` or `response` or `answer` or last string field | `messages[2].content` (assistant) | The assistant response |
| `system` or `system_prompt` | `messages[0].content` (system) | Optional system message |
| `input` | Appended to user message if non-empty | Context for the instruction |

**Custom field mapping**:

```typescript
const output = exportData(examples, 'openai', {
  fieldMap: {
    user: 'question',      // Map schema field 'question' to user message
    assistant: 'answer',   // Map schema field 'answer' to assistant message
    system: 'context',     // Map schema field 'context' to system message
  },
  systemPrompt: 'You are a helpful medical assistant.',  // Static system prompt for all examples
});
```

### Alpaca Format

The format popularized by the Stanford Alpaca project. Each example has `instruction`, `input`, and `output` fields.

```jsonl
{"instruction": "Explain the difference between TCP and UDP.", "input": "", "output": "TCP is a connection-oriented protocol..."}
{"instruction": "Summarize the following text.", "input": "The Industrial Revolution was a period of...", "output": "The Industrial Revolution transformed..."}
```

**Field mapping** (default):

| Schema Field | Alpaca Field |
|---|---|
| `instruction` or first string field | `instruction` |
| `input` or second string field (if 3+ string fields) | `input` |
| `output` or `response` or `answer` or last string field | `output` |

### ShareGPT Format

A multi-turn conversation format used by many open-source fine-tuning projects. Each example has a `conversations` array with alternating human and GPT messages.

```jsonl
{"conversations": [{"from": "human", "value": "Explain the difference between TCP and UDP."}, {"from": "gpt", "value": "TCP is a connection-oriented protocol..."}]}
{"conversations": [{"from": "system", "value": "You are a helpful assistant."}, {"from": "human", "value": "Write a haiku about autumn."}, {"from": "gpt", "value": "Crimson leaves descend..."}]}
```

**Field mapping** (default):

| Schema Field | ShareGPT Field |
|---|---|
| `instruction` or first string field | `conversations[n].value` where `from: "human"` |
| `output` or last string field | `conversations[n].value` where `from: "gpt"` |
| `system` or `system_prompt` | `conversations[0].value` where `from: "system"` |

### Plain JSONL

One JSON object per line, preserving the original schema field names. No field remapping.

```jsonl
{"instruction": "Explain...", "input": "", "output": "TCP is...", "category": "coding", "difficulty": "medium"}
{"instruction": "Write...", "input": "", "output": "Crimson...", "category": "writing", "difficulty": "easy"}
```

### CSV

Columnar format with a header row. All fields are included as columns. Nested objects are flattened with dot notation. Arrays are JSON-serialized within cells.

```csv
instruction,input,output,category,difficulty
"Explain the difference between TCP and UDP.","","TCP is a connection-oriented protocol...","coding","medium"
"Write a haiku about autumn.","","Crimson leaves descend...","writing","easy"
```

**CSV options**:

```typescript
const output = exportData(examples, 'csv', {
  delimiter: ',',       // Default: ','
  quote: '"',           // Default: '"'
  header: true,         // Default: true (include header row)
  fields: ['instruction', 'output', 'category'],  // Subset of fields to include
});
```

### eval-dataset Format

Compatible with the `eval-dataset` package from this monorepo. Maps generated examples to `eval-dataset`'s `TestCase` schema.

```jsonl
{"id": "sdg-001", "input": "Explain the difference between TCP and UDP.", "expected": "TCP is a connection-oriented protocol...", "category": "coding", "tags": ["generated", "synthdata-gen"], "metadata": {"source": "synthdata-gen", "generatedAt": "2026-03-19T10:00:00Z"}}
```

**Field mapping** (default):

| Schema Field | eval-dataset Field |
|---|---|
| `instruction` or `question` or first string field | `input` |
| `output` or `answer` or `expected` or last string field | `expected` |
| `category` | `category` |
| `tags` | `tags` (merged with `["generated", "synthdata-gen"]`) |
| All other fields | Stored in `metadata` |

### Custom Format via Template

For formats not covered by the built-ins, users can provide a template function:

```typescript
const output = exportData(examples, 'custom', {
  template: (example, index) => {
    return JSON.stringify({
      id: `train-${index}`,
      prompt: `### Instruction:\n${example.instruction}\n\n### Response:`,
      completion: example.output,
    });
  },
  separator: '\n',  // Line separator between examples
});
```

### Export Function

```typescript
import { exportData } from 'synthdata-gen';

const jsonl = exportData(examples, 'openai', {
  systemPrompt: 'You are a helpful assistant.',
});

const alpaca = exportData(examples, 'alpaca');

const csv = exportData(examples, 'csv', {
  fields: ['instruction', 'output', 'category'],
});

// Write to file
import fs from 'node:fs';
fs.writeFileSync('training-data.jsonl', jsonl);
```

---

## 12. LLM Interface

### LLM Function Signature

The core LLM interface is a single async function:

```typescript
type LlmFunction = (
  messages: Message[],
  options?: LlmCallOptions,
) => Promise<LlmResponse>;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LlmCallOptions {
  /** Temperature for this call. Overrides default. */
  temperature?: number;

  /** Maximum completion tokens. */
  maxTokens?: number;

  /** Request structured JSON output (if provider supports it). */
  jsonMode?: boolean;
}

interface LlmResponse {
  /** The generated text. */
  content: string;

  /** Token usage, if available. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

The simplest LLM function ignores options and returns just the text:

```typescript
const simpleLlm: LlmFunction = async (messages) => {
  const response = await callMyApi(messages);
  return { content: response.text };
};
```

### OpenAI Adapter

Built-in adapter for the OpenAI API (`openai` npm package). The adapter wraps the OpenAI client and returns responses in the expected format, including token usage.

```typescript
import { createOpenAIAdapter } from 'synthdata-gen';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const llm = createOpenAIAdapter(openai, {
  model: 'gpt-4o',
  temperature: 0.8,
  maxTokens: 2000,
});

const result = await generate(schema, { llm, count: 100 });
```

**Adapter implementation**:

```typescript
function createOpenAIAdapter(
  client: OpenAI,
  defaults?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): LlmFunction {
  return async (messages, options) => {
    const response = await client.chat.completions.create({
      model: defaults?.model ?? 'gpt-4o',
      messages: messages,
      temperature: options?.temperature ?? defaults?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? defaults?.maxTokens ?? 2000,
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
    });

    return {
      content: response.choices[0].message.content ?? '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  };
}
```

### Anthropic Adapter

Built-in adapter for the Anthropic API (`@anthropic-ai/sdk` npm package).

```typescript
import { createAnthropicAdapter } from 'synthdata-gen';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const llm = createAnthropicAdapter(anthropic, {
  model: 'claude-sonnet-4-20250514',
  temperature: 0.8,
  maxTokens: 2000,
});

const result = await generate(schema, { llm, count: 100 });
```

### Structured Output Mode

When the LLM provider supports structured output (OpenAI's JSON mode, Anthropic's tool use with JSON schema), the pipeline can request structured output directly instead of parsing free-text JSON. This reduces parse failures and retries.

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  structuredOutput: true,  // Request JSON mode from the LLM
});
```

When `structuredOutput` is `true`, the pipeline:

1. Sets `jsonMode: true` in the `LlmCallOptions` passed to the LLM function.
2. Expects the response to be valid JSON (no markdown fences, no explanatory text).
3. Skips the JSON extraction step in parsing (Stage 4) and parses the entire response as JSON.

### Cost Tracking

The pipeline tracks API costs based on token usage and configurable per-token pricing:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 100,
  costTracking: {
    promptTokenCost: 0.000003,      // $3 per million prompt tokens (GPT-4o)
    completionTokenCost: 0.000015,  // $15 per million completion tokens
    currency: 'USD',
  },
});

console.log(result.stats.cost);
// { promptTokens: 45000, completionTokens: 120000, totalCost: 1.935, currency: 'USD' }
```

---

## 13. API Surface

### Installation

```bash
npm install synthdata-gen
```

### Peer Dependencies

```json
{
  "peerDependencies": {
    "zod": "^3.22.0"
  },
  "peerDependenciesMeta": {
    "zod": { "optional": true }
  }
}
```

Zod is an optional peer dependency. Required only when using Zod schemas. JSON Schema mode works without Zod installed (the package includes a built-in JSON Schema validator).

### Top-Level Function: `generate`

The primary API. Takes a schema and options, runs the full pipeline (generate, validate, dedup), and returns a `GenerationResult`.

```typescript
import { generate } from 'synthdata-gen';
import { z } from 'zod';

const schema = z.object({
  instruction: z.string().min(10).max(200),
  output: z.string().min(20).max(1000),
  category: z.enum(['coding', 'writing', 'reasoning']),
});

const result = await generate(schema, {
  llm: myLlm,
  count: 100,
});

console.log(result.data);           // GeneratedExample[] -- the final clean data
console.log(result.data.length);    // 100 (or fewer if dedup removed some)
console.log(result.stats.total);    // Total examples generated (before dedup)
console.log(result.stats.valid);    // Examples that passed validation
console.log(result.stats.deduped);  // Examples removed by dedup
console.log(result.stats.final);   // Final count after dedup
```

### Batch Function: `generateBatch`

Convenience wrapper around `generate` that ensures exactly `count` valid, unique examples are produced. If the initial generation produces fewer than `count` after dedup, it generates more to fill the gap.

```typescript
import { generateBatch } from 'synthdata-gen';

const result = await generateBatch(schema, 500, {
  llm: myLlm,
  batchSize: 10,
  diversity: {
    topics: ['math', 'science', 'history'],
    temperature: { min: 0.5, max: 1.0, strategy: 'cycle' },
  },
});

// result.data.length === 500 (guaranteed, barring LLM total failure)
```

**Guarantee mechanism**: `generateBatch` runs `generate` in a loop. After each round, it checks the final count. If below the target, it generates `(target - current) * oversamplingFactor` more examples (default oversampling: 1.3x to account for expected dedup losses). The loop has a maximum iteration limit (default: 10) to prevent infinite loops when the LLM consistently produces invalid or duplicate output.

### Standalone Validation: `validate`

Validate existing data against a schema without generating anything.

```typescript
import { validate } from 'synthdata-gen';

const results = validate(
  [
    { instruction: 'Hi', output: 'Hello', category: 'general' },
    { instruction: 'Explain quantum computing in detail.', output: 'Quantum computing uses...', category: 'coding' },
  ],
  schema,
);

// results: ValidationResult[]
// [
//   { valid: false, index: 0, errors: [{ path: ['instruction'], message: '...' }] },
//   { valid: true, index: 1, errors: [] },
// ]
```

### Standalone Deduplication: `deduplicate`

Deduplicate existing data without generating anything.

```typescript
import { deduplicate } from 'synthdata-gen';

const deduped = deduplicate(examples, {
  strategy: 'near',
  threshold: 0.85,
  fields: ['instruction'],
});

console.log(deduped.data);       // Deduplicated examples
console.log(deduped.removed);    // Count of removed duplicates
console.log(deduped.pairs);      // Duplicate pairs found (for inspection)
```

### Standalone Export: `exportData`

Export existing data to a training format without generating anything.

```typescript
import { exportData } from 'synthdata-gen';

const jsonl = exportData(examples, 'openai', {
  systemPrompt: 'You are a helpful assistant.',
});

fs.writeFileSync('training.jsonl', jsonl);
```

### Factory: `createGenerator`

Create a reusable generator instance with fixed configuration. Useful when generating data in multiple runs with the same schema and LLM.

```typescript
import { createGenerator } from 'synthdata-gen';

const generator = createGenerator({
  schema,
  llm: myLlm,
  diversity: {
    temperature: { min: 0.5, max: 1.0, strategy: 'cycle' },
    balanceField: 'category',
  },
  dedup: { strategy: 'near', threshold: 0.85 },
  validation: { heuristics: { nonEmpty: true, noPlaceholder: true } },
});

const batch1 = await generator.generate(100);
const batch2 = await generator.generate(100);

// Both batches use the same configuration.
// Cross-batch dedup can be enabled:
const combined = generator.deduplicate([...batch1.data, ...batch2.data]);
```

### Type Definitions

```typescript
// ── Core Types ─────────────────────────────────────────────────────

/** A generated example. The shape matches the user-defined schema, plus optional metadata. */
type GeneratedExample<T = Record<string, unknown>> = T & {
  _meta?: {
    /** Unique ID for this example. */
    id: string;

    /** Index in the generation order. */
    index: number;

    /** Whether this example was generated as a negative/edge case. */
    isNegative?: boolean;

    /** Whether this example was repaired after validation failure. */
    repaired?: boolean;

    /** The generation batch this example came from. */
    batchIndex: number;

    /** The diversity strategy parameters active when this example was generated. */
    diversityContext?: {
      topic?: string;
      temperature?: number;
      persona?: string;
      constraint?: string;
    };
  };
};

/** Result of a generation run. */
interface GenerationResult<T = Record<string, unknown>> {
  /** The final clean, validated, deduplicated examples. */
  data: GeneratedExample<T>[];

  /** Pipeline statistics. */
  stats: GenerationStats;
}

/** Pipeline statistics. */
interface GenerationStats {
  /** Total examples generated (before validation and dedup). */
  total: number;

  /** Examples that passed validation. */
  valid: number;

  /** Examples that failed validation. */
  invalid: number;

  /** Examples removed by deduplication. */
  deduped: number;

  /** Final count after validation and dedup. */
  final: number;

  /** LLM call statistics. */
  llmCalls: number;

  /** Token usage. */
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Estimated cost. */
  cost: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
    currency: string;
  };

  /** Validation failure reasons with counts. */
  validationErrors: Array<{
    path: string[];
    message: string;
    count: number;
  }>;

  /** Invalid examples (when invalidHandling is 'log'). */
  invalidExamples: Array<{
    example: Record<string, unknown>;
    errors: Array<{ path: string[]; message: string }>;
    retries: number;
  }>;

  /** Category distribution of the final set. */
  categoryDistribution: Record<string, number>;

  /** Diversity score of the final set (0-1). */
  diversityScore: number;

  /** Wall-clock time for the full pipeline, in milliseconds. */
  durationMs: number;
}

// ── Validation Types ───────────────────────────────────────────────

/** Result of validating a single example. */
interface ValidationResult {
  /** Whether the example is valid. */
  valid: boolean;

  /** Index of the example in the input array. */
  index: number;

  /** Validation errors. Empty array if valid. */
  errors: ValidationError[];
}

/** A single validation error. */
interface ValidationError {
  /** Path to the invalid field (e.g., ['output'] or ['metadata', 'tags', '0']). */
  path: string[];

  /** Human-readable error message. */
  message: string;

  /** Error code from Zod or custom validator. */
  code: string;
}

// ── Deduplication Types ────────────────────────────────────────────

/** Result of deduplication. */
interface DedupResult<T = Record<string, unknown>> {
  /** Deduplicated examples. */
  data: T[];

  /** Number of duplicates removed. */
  removed: number;

  /** Duplicate pairs found. Each pair is [kept index, removed index, similarity]. */
  pairs: Array<[number, number, number]>;
}

// ── Export Types ────────────────────────────────────────────────────

/** Supported export formats. */
type ExportFormat = 'openai' | 'alpaca' | 'sharegpt' | 'jsonl' | 'csv' | 'eval-dataset' | 'custom';

// ── Generation Options ─────────────────────────────────────────────

/** Options for generate() and generateBatch(). */
interface GenerateOptions<T = Record<string, unknown>> {
  /** LLM function for generation. Required. */
  llm: LlmFunction;

  /** Target number of examples. Default: 10. */
  count?: number;

  /** Number of examples to request per LLM call. Default: 1. */
  batchSize?: number;

  /** Custom system prompt. Replaces the default system prompt. */
  systemPrompt?: string;

  /** Additional instructions appended to the default system prompt. */
  additionalInstructions?: string;

  /** Custom prompt template with placeholders. */
  promptTemplate?: {
    system?: string;
    user?: string;
  };

  /** Template variable values for custom prompt templates. */
  templateVars?: Record<string, string>;

  /** Seed examples for few-shot prompting. */
  seeds?: T[];

  /** Diversity strategy configuration. */
  diversity?: DiversityConfig;

  /** Validation configuration. */
  validation?: ValidationConfig;

  /** Retry configuration. */
  retry?: RetryConfig;

  /** Deduplication configuration. */
  dedup?: DedupOptions;

  /** How to handle invalid examples. Default: 'discard'. */
  invalidHandling?: 'discard' | 'log' | 'repair';

  /** Request structured JSON output from the LLM. Default: false. */
  structuredOutput?: boolean;

  /** Cost tracking configuration. */
  costTracking?: CostConfig;

  /** Progress callback, called after each batch. */
  onProgress?: (progress: ProgressInfo) => void;

  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/** Diversity strategy configuration. */
interface DiversityConfig {
  /** Temperature variation settings. */
  temperature?: {
    min: number;
    max: number;
    strategy: 'linear' | 'cycle' | 'random';
  };

  /** Topic list for topic rotation. */
  topics?: string[];

  /** Schema field to balance across (must be an enum field). */
  balanceField?: string;

  /** Seed example rotation mode. Default: 'sequential'. */
  seedRotation?: 'sequential' | 'random' | 'window';

  /** Number of seeds to include per batch. Default: all. */
  seedsPerBatch?: number;

  /** Personas for persona-driven generation. */
  personas?: Array<{ summary: string; [key: string]: unknown }>;

  /** Ratio of negative/edge case examples. Default: 0 (disabled). */
  negativeExampleRatio?: number;

  /** Prompt for negative example generation. */
  negativeInstructions?: string;

  /** Constraint variations to cycle through. */
  constraintVariation?: Array<{ instruction: string }>;
}

/** Validation configuration. */
interface ValidationConfig {
  /** Minimum length for all string fields. */
  minFieldLength?: number;

  /** Maximum length for all string fields. */
  maxFieldLength?: number;

  /** Quality heuristic settings. */
  heuristics?: {
    nonEmpty?: boolean;
    noPlaceholder?: boolean;
    noDuplicateFields?: { pairs: [string, string][] };
    minWordCount?: { fields: string[]; min: number };
    noRepetition?: boolean;
    languageCheck?: { language: string; detector: (text: string) => string };
  };

  /** Custom validator functions. */
  custom?: Array<{
    name: string;
    validate: (example: Record<string, unknown>) => { valid: boolean; message?: string };
  }>;
}

/** Retry configuration. */
interface RetryConfig {
  /** Maximum retries per example. Default: 3. */
  maxRetries?: number;

  /** Include validation error in retry prompt. Default: true. */
  includeFeedback?: boolean;

  /** Backoff strategy. Default: 'none'. */
  backoff?: 'none' | 'linear' | 'exponential';

  /** Base delay in ms for backoff. Default: 1000. */
  backoffMs?: number;
}

/** Cost tracking configuration. */
interface CostConfig {
  /** Cost per prompt token. */
  promptTokenCost: number;

  /** Cost per completion token. */
  completionTokenCost: number;

  /** Currency label. Default: 'USD'. */
  currency?: string;
}

/** Progress information passed to onProgress callback. */
interface ProgressInfo {
  /** Examples generated so far. */
  generated: number;

  /** Valid examples so far. */
  valid: number;

  /** Target count. */
  target: number;

  /** Current batch index. */
  batchIndex: number;

  /** Percentage complete (0-100). */
  percentComplete: number;

  /** Elapsed time in milliseconds. */
  elapsedMs: number;
}

// ── Generator Instance ─────────────────────────────────────────────

/** Configuration for createGenerator(). */
interface GeneratorConfig<T = Record<string, unknown>> extends Omit<GenerateOptions<T>, 'count'> {
  /** The schema for generated examples. */
  schema: ZodSchema<T> | JsonSchema;
}

/** A configured generator instance. */
interface DataGenerator<T = Record<string, unknown>> {
  /** Generate examples. */
  generate(count: number, overrides?: Partial<GenerateOptions<T>>): Promise<GenerationResult<T>>;

  /** Validate existing data against the schema. */
  validate(data: unknown[]): ValidationResult[];

  /** Deduplicate existing data. */
  deduplicate(data: T[], overrides?: Partial<DedupOptions>): DedupResult<T>;

  /** Export data to a format. */
  export(data: T[], format: ExportFormat, options?: ExportOptions): string;

  /** The generator's configuration. */
  readonly config: Readonly<GeneratorConfig<T>>;
}
```

---

## 14. Generation Statistics

### Overview

Every generation run produces detailed statistics about the pipeline execution. Statistics are returned in the `stats` field of the `GenerationResult` object and printed by the CLI after generation completes.

### Metrics Tracked

| Metric | Description |
|---|---|
| `total` | Total examples generated by the LLM (before validation) |
| `valid` | Examples that passed schema validation and quality heuristics |
| `invalid` | Examples that failed validation (including retried-and-failed) |
| `deduped` | Valid examples removed by deduplication |
| `final` | Final count after validation and dedup: `valid - deduped` |
| `llmCalls` | Total LLM API calls made (including retries) |
| `tokens.prompt` | Total prompt tokens across all calls |
| `tokens.completion` | Total completion tokens across all calls |
| `tokens.total` | `prompt + completion` |
| `cost.totalCost` | Estimated cost: `prompt * promptRate + completion * completionRate` |
| `validationErrors` | Top validation failure reasons with counts (e.g., "field 'output' too short: 45 occurrences") |
| `categoryDistribution` | Count per category value for the final set (for schemas with enum fields) |
| `diversityScore` | Token-level diversity score of the final set (0-1), computed as the normalized mean pairwise Jaccard distance across all examples |
| `durationMs` | Wall-clock time for the full pipeline |

### Diversity Score Calculation

The diversity score quantifies how varied the final dataset is. It is computed as:

1. For each pair of examples, compute the Jaccard distance (1 - Jaccard similarity) on word bigrams of all string fields.
2. Compute the mean pairwise Jaccard distance.
3. Normalize to [0, 1] where 0 means all examples are identical and 1 means no two examples share any bigrams.

A typical diversity score for well-diversified synthetic data is 0.6-0.8. Scores below 0.4 suggest the data is too homogeneous. Scores above 0.9 suggest the data may be noisy or incoherent.

### Progress Reporting

For long-running generation, the `onProgress` callback provides real-time updates:

```typescript
const result = await generate(schema, {
  llm: myLlm,
  count: 1000,
  onProgress: (progress) => {
    console.log(
      `[${progress.percentComplete.toFixed(0)}%] ` +
      `Generated: ${progress.generated}, Valid: ${progress.valid}, ` +
      `Target: ${progress.target}, Elapsed: ${(progress.elapsedMs / 1000).toFixed(1)}s`
    );
  },
});
```

---

## 15. Configuration

### Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `llm` | `LlmFunction` | Required | The LLM function for generation |
| `count` | `number` | `10` | Target number of examples |
| `batchSize` | `number` | `1` | Examples per LLM call |
| `systemPrompt` | `string` | Built-in default | Custom system prompt (replaces default) |
| `additionalInstructions` | `string` | `undefined` | Extra instructions (appended to default) |
| `seeds` | `T[]` | `[]` | Seed examples for few-shot prompting |
| `structuredOutput` | `boolean` | `false` | Request JSON mode from LLM |
| `invalidHandling` | `string` | `'discard'` | Handle invalid examples: discard, log, repair |
| `diversity.temperature` | `object` | `undefined` | Temperature variation: min, max, strategy |
| `diversity.topics` | `string[]` | `undefined` | Topic list for rotation |
| `diversity.balanceField` | `string` | `undefined` | Enum field to balance across |
| `diversity.seedRotation` | `string` | `'sequential'` | Seed rotation mode |
| `diversity.seedsPerBatch` | `number` | All seeds | Seeds to include per batch |
| `diversity.personas` | `object[]` | `undefined` | Personas for persona-driven generation |
| `diversity.negativeExampleRatio` | `number` | `0` | Fraction of negative/edge examples |
| `diversity.constraintVariation` | `object[]` | `undefined` | Constraint variations to cycle |
| `validation.minFieldLength` | `number` | `undefined` | Global min string length |
| `validation.maxFieldLength` | `number` | `undefined` | Global max string length |
| `validation.heuristics` | `object` | `{ nonEmpty: true, noPlaceholder: true }` | Quality heuristic settings |
| `validation.custom` | `array` | `[]` | Custom validator functions |
| `retry.maxRetries` | `number` | `3` | Max retries per invalid example |
| `retry.includeFeedback` | `boolean` | `true` | Include error in retry prompt |
| `retry.backoff` | `string` | `'none'` | Backoff strategy |
| `retry.backoffMs` | `number` | `1000` | Base delay for backoff |
| `dedup.strategy` | `string` | `'exact'` | Dedup strategy: exact, near, semantic, none |
| `dedup.threshold` | `number` | `0.85` / `0.92` | Similarity threshold for near/semantic |
| `dedup.ngramSize` | `number` | `2` | N-gram size for near-dedup |
| `dedup.fields` | `string[]` | All string fields | Fields to compare for dedup |
| `costTracking` | `object` | `undefined` | Per-token cost rates |

### Configuration File

The CLI reads configuration from a JSON file specified with `--config` or from default locations:

1. Path specified by `--config` flag.
2. `.synthdata-gen.json` in the current directory.
3. `synthdata-gen` key in `package.json`.

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "instruction": { "type": "string", "minLength": 10, "maxLength": 200 },
      "output": { "type": "string", "minLength": 20, "maxLength": 1000 },
      "category": { "type": "string", "enum": ["coding", "writing", "reasoning"] }
    },
    "required": ["instruction", "output", "category"]
  },
  "count": 100,
  "batchSize": 5,
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.8
  },
  "seeds": [
    {
      "instruction": "Explain recursion.",
      "output": "Recursion is a programming technique...",
      "category": "coding"
    }
  ],
  "diversity": {
    "topics": ["algorithms", "databases", "networking"],
    "balanceField": "category",
    "temperature": { "min": 0.5, "max": 1.0, "strategy": "cycle" }
  },
  "dedup": {
    "strategy": "near",
    "threshold": 0.85
  },
  "export": {
    "format": "openai",
    "systemPrompt": "You are a helpful coding assistant."
  }
}
```

### Configuration Precedence

1. Built-in defaults.
2. Configuration file (`.synthdata-gen.json`).
3. CLI flags.
4. Programmatic options in `GenerateOptions`.

Later sources override earlier sources for the same setting.

### Environment Variables

| Environment Variable | Equivalent |
|---|---|
| `SYNTHDATA_GEN_CONFIG` | `--config` flag |
| `OPENAI_API_KEY` | OpenAI adapter API key |
| `ANTHROPIC_API_KEY` | Anthropic adapter API key |
| `SYNTHDATA_GEN_MODEL` | `--model` flag |

---

## 16. CLI Design

### Installation and Invocation

```bash
# Global install
npm install -g synthdata-gen
synthdata-gen generate --config config.json --count 100

# npx (no install)
npx synthdata-gen generate --config config.json --count 100

# Package script
# package.json: { "scripts": { "generate-data": "synthdata-gen generate --config synthdata.json -o data.jsonl" } }
npm run generate-data
```

### CLI Binary Name

`synthdata-gen`

### Commands

The CLI has four commands: `generate`, `validate`, `dedup`, and `export`.

```
synthdata-gen <command> [options]

Commands:
  generate    Generate synthetic training data from a schema
  validate    Validate existing data against a schema
  dedup       Deduplicate existing data
  export      Export data to a training format

General:
  --version   Print version and exit.
  --help      Print help and exit.
```

### `generate` Command

```
synthdata-gen generate [options]

Configuration:
  --config, -c <path>         Path to config file (JSON). Default: .synthdata-gen.json
  --schema <path>             Path to JSON Schema file.

Generation:
  --count, -n <n>             Number of examples to generate. Default: 10.
  --batch-size <n>            Examples per LLM call. Default: 1.
  --provider <provider>       LLM provider: openai, anthropic. Default: openai.
  --model <model>             Model name. Default: gpt-4o.
  --temperature <n>           Base temperature. Default: 0.8.
  --structured-output         Request JSON mode from the LLM.

Diversity:
  --topics <topics>           Comma-separated topic list for rotation.
  --balance-field <field>     Enum field to balance across.
  --negative-ratio <n>        Fraction of negative examples (0-1). Default: 0.

Validation:
  --max-retries <n>           Max retries per invalid example. Default: 3.
  --invalid-handling <mode>   How to handle invalid examples: discard, log, repair.
                              Default: discard.

Deduplication:
  --dedup <strategy>          Dedup strategy: exact, near, semantic, none. Default: exact.
  --dedup-threshold <n>       Similarity threshold. Default: 0.85.
  --dedup-fields <fields>     Comma-separated fields for dedup.

Output:
  --output, -o <path>         Output file path. Default: stdout.
  --format, -f <format>       Export format: openai, alpaca, sharegpt, jsonl, csv,
                              eval-dataset. Default: jsonl.
  --system-prompt <text>      System prompt for OpenAI/ShareGPT export format.
  --stats                     Print generation statistics after completion.
  --progress                  Show progress bar during generation.
```

### `validate` Command

```
synthdata-gen validate [options]

Input:
  <file>                      Path to data file (JSON or JSONL).
  --schema <path>             Path to JSON Schema file.

Output:
  --format <format>           Output format: human, json. Default: human.
  --output, -o <path>         Output file path. Default: stdout.
```

### `dedup` Command

```
synthdata-gen dedup [options]

Input:
  <file>                      Path to data file (JSON or JSONL).

Options:
  --strategy <strategy>       Dedup strategy: exact, near. Default: exact.
  --threshold <n>             Similarity threshold. Default: 0.85.
  --fields <fields>           Comma-separated fields for dedup.
  --ngram-size <n>            N-gram size for near-dedup. Default: 2.

Output:
  --output, -o <path>         Output file path. Default: stdout.
  --format <format>           Output format: jsonl, json. Default: jsonl.
  --report                    Print dedup statistics.
```

### `export` Command

```
synthdata-gen export [options]

Input:
  <file>                      Path to data file (JSON or JSONL).

Options:
  --format, -f <format>       Export format: openai, alpaca, sharegpt, jsonl, csv,
                              eval-dataset. Default: jsonl.
  --system-prompt <text>      System prompt for OpenAI/ShareGPT format.
  --field-map <mappings>      Custom field mappings (JSON string).
  --fields <fields>           Comma-separated fields to include (CSV only).

Output:
  --output, -o <path>         Output file path. Default: stdout.
```

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | Error. Generation failure, validation error, file not found, or LLM error. |
| `2` | Usage error. Invalid flags, missing required arguments, invalid config. |

### CLI Output Examples

**Generate 50 examples with progress**:

```
$ synthdata-gen generate --config config.json -n 50 --progress --stats -o training.jsonl

  synthdata-gen v0.1.0

  Schema: 4 fields (instruction, output, category, difficulty)
  Provider: openai (gpt-4o)
  Target: 50 examples

  [████████████████████████████████████████] 100% | 50/50 valid

  Pipeline Statistics:
    Generated:        62
    Valid:             55   (88.7%)
    Invalid:           7   (11.3%)
    Deduplicated:      5
    Final:            50

    LLM calls:        62
    Tokens:           45,200 prompt + 31,400 completion = 76,600 total
    Cost:             $0.61 USD

    Top validation errors:
      output too short (<20 chars):       4
      category not in enum:               2
      unparseable JSON:                   1

    Category distribution:
      coding:       18  (36%)
      writing:      16  (32%)
      reasoning:    16  (32%)

    Diversity score: 0.72

    Duration: 34.2s

  Output written to training.jsonl (50 examples, 142 KB)
```

**Validate existing data**:

```
$ synthdata-gen validate data.jsonl --schema schema.json

  synthdata-gen v0.1.0

  Validating 200 examples against schema...

  Valid:     187  (93.5%)
  Invalid:   13  ( 6.5%)

  Invalid examples:
    Line 23:  field "output" - String must contain at least 20 characters (received 12)
    Line 45:  field "category" - Invalid enum value (received "other")
    Line 89:  field "instruction" - Required field missing
    ... (10 more)
```

**Deduplicate data**:

```
$ synthdata-gen dedup data.jsonl --strategy near --threshold 0.85 --report -o deduped.jsonl

  synthdata-gen v0.1.0

  Deduplicating 200 examples (strategy: near, threshold: 0.85)...

  Input:     200 examples
  Removed:    23 duplicates
  Output:    177 unique examples

  Duplicate pairs (top 5 by similarity):
    [12, 45]  similarity: 0.97  "How do I reset my..." / "How do I reset..."
    [33, 67]  similarity: 0.93  "Explain the concept..." / "Explain the idea..."
    [78, 112] similarity: 0.91  "Write a function..." / "Write a method..."
    ...

  Output written to deduped.jsonl (177 examples)
```

---

## 17. Integration

### With eval-dataset

`eval-dataset` manages evaluation datasets. `synthdata-gen` generates the data that populates those datasets. The integration is bidirectional: generated data can be exported directly in eval-dataset format, and existing eval datasets can be used as cross-dedup references.

```typescript
import { generate, exportData } from 'synthdata-gen';
import { loadDataset, createDataset } from 'eval-dataset';

// Generate data and export in eval-dataset format
const result = await generate(schema, { llm: myLlm, count: 200 });
const evalJson = exportData(result.data, 'eval-dataset');

// Or build an eval-dataset directly
const dataset = createDataset({
  name: 'generated-qa',
  description: 'Synthetically generated Q&A pairs',
});

for (const example of result.data) {
  dataset.add({
    input: example.instruction,
    expected: example.output,
    category: example.category,
    tags: ['generated', 'synthdata-gen'],
    metadata: { generatedAt: new Date().toISOString() },
  });
}

// Cross-dedup: ensure generated data doesn't duplicate existing eval data
const existing = await loadDataset('existing-qa.json');
const freshResult = await generate(schema, {
  llm: myLlm,
  count: 100,
  dedup: {
    strategy: 'near',
    existingData: existing.cases.map(c => ({ instruction: c.input, output: c.expected })),
  },
});
```

### With synth-personas

`synth-personas` generates diverse user personas. `synthdata-gen` uses those personas as a diversity strategy to generate training data from varied perspectives.

```typescript
import { generateBatch as generatePersonas } from 'synth-personas';
import { generate } from 'synthdata-gen';

const personas = generatePersonas(10, { seed: 42 });

const result = await generate(schema, {
  llm: myLlm,
  count: 200,
  diversity: {
    personas: personas.map(p => ({
      summary: p.summary,
      occupation: p.demographics.occupation,
      formality: p.communication.formality,
      literacy: p.technical.literacy,
    })),
  },
});
// Each batch is generated from a different persona's perspective,
// producing varied vocabulary, formality, and topic focus.
```

### With prompt-snap

`prompt-snap` captures snapshots of LLM prompts and outputs for regression testing. `synthdata-gen` can be snapshot-tested to verify that the generation pipeline produces consistent prompts and that schema-to-prompt conversion does not regress.

```typescript
import { generate } from 'synthdata-gen';
import { snap } from 'prompt-snap';

// Snapshot the generation prompt (without actually calling the LLM)
const generator = createGenerator({ schema, llm: myLlm });
const prompt = generator.buildPrompt({ topic: 'algorithms', batchSize: 1 });
snap('generation-prompt-algorithms', prompt);
```

### With llm-retry

`llm-retry` provides resilient LLM calls with retry logic, rate limiting, and fallback models. `synthdata-gen` can use an `llm-retry`-wrapped function as its LLM interface for production-grade reliability.

```typescript
import { withRetry } from 'llm-retry';
import { createOpenAIAdapter, generate } from 'synthdata-gen';

const baseLlm = createOpenAIAdapter(openai, { model: 'gpt-4o' });
const resilientLlm = withRetry(baseLlm, {
  maxRetries: 5,
  retryOn: [429, 500, 503],
  backoff: 'exponential',
});

const result = await generate(schema, {
  llm: resilientLlm,
  count: 1000,
});
// The llm-retry wrapper handles rate limits and transient errors,
// while synthdata-gen handles content-level retries (invalid output).
```

---

## 18. Testing Strategy

### Unit Tests

Unit tests cover each module in isolation:

- **Schema-to-prompt compiler**: Verify that Zod schemas and JSON Schemas produce the expected prompt fragments. Test all supported Zod types (string, number, enum, array, nested object) and constraint combinations (min, max, regex, describe). Verify JSON Schema conversion matches Zod schema behavior.
- **JSON parser**: Verify extraction of JSON from: bare JSON objects, markdown code fences, JSON mixed with explanatory text, multiple JSON objects per response, malformed JSON (partial objects, trailing commas), and empty responses. Verify each case returns the expected parsed objects or appropriate parse errors.
- **Schema validator**: Verify that valid examples pass and invalid examples fail with correct error paths and messages. Test all constraint types, optional fields, default values, and nested schemas. Verify quality heuristics (non-empty, no-placeholder) trigger correctly.
- **Deduplication**: Verify exact dedup removes identical entries. Verify near-dedup removes entries above the Jaccard threshold and keeps entries below it. Test with configurable fields, n-gram sizes, and thresholds. Verify MinHash LSH produces the same results as brute-force Jaccard for small datasets. Verify per-field dedup works correctly.
- **Export formatters**: Verify each export format produces the expected output for a fixed set of examples. Test OpenAI JSONL, Alpaca, ShareGPT, plain JSONL, CSV, and eval-dataset formats. Verify custom field mappings work. Verify CSV escaping handles commas, quotes, and newlines in field values.
- **Prompt builder**: Verify prompt construction includes system prompt, schema description, seed examples, and diversity instructions. Verify seed rotation modes (sequential, random, window) produce the expected seed subsets. Verify template variable substitution works.
- **Diversity strategies**: Verify temperature variation produces the expected temperature sequence for linear, cycle, and random modes. Verify topic rotation cycles through topics. Verify category balancing prioritizes underrepresented categories.
- **Cost tracker**: Verify cost calculation from token counts and per-token rates. Verify accumulation across multiple calls.

### Integration Tests

Integration tests verify end-to-end behavior with a mock LLM:

- **Full pipeline**: Define a schema, configure a mock LLM that returns valid examples, run `generate()`, and verify the output contains the expected number of validated, deduplicated examples. Verify statistics are correct.
- **Validation + retry**: Configure a mock LLM that returns invalid output for the first call and valid output on retry. Verify the pipeline retries and ultimately produces valid examples. Verify retry count is tracked in stats.
- **Dedup pipeline**: Configure a mock LLM that returns duplicate examples. Verify the pipeline deduplicates correctly and final count reflects removal.
- **Batch generation**: Configure `batchSize: 5` with a mock LLM that returns JSON arrays. Verify all examples in the array are parsed and validated individually.
- **Export round-trip**: Generate examples, export to OpenAI format, re-parse the JSONL, and verify the re-parsed data matches the original examples (accounting for field mapping).
- **Cross-set dedup**: Provide existing examples and generate new ones. Verify no generated example is a near-duplicate of any existing example.
- **Progress callback**: Run `generate()` with an `onProgress` callback. Verify the callback is called with increasing progress values and correct counts.
- **Abort signal**: Run `generate()` with an `AbortSignal` that aborts after 2 calls. Verify the pipeline stops and returns partial results.
- **CLI end-to-end**: Run CLI commands with a mock LLM config and verify exit codes, output files, and statistics output.

### Mock LLM for Testing

The test suite uses a deterministic mock LLM that returns predictable output:

```typescript
function createMockLlm(responses: string[]): LlmFunction {
  let callIndex = 0;
  return async (messages) => {
    const response = responses[callIndex % responses.length];
    callIndex++;
    return {
      content: response,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };
  };
}
```

Tests use `createMockLlm` with pre-defined responses to exercise the pipeline without making real API calls. The mock returns valid JSON, invalid JSON, partial JSON, and duplicate examples in controlled sequences to test all code paths.

### Property-Based Tests

- **Schema conformance**: For any schema and any valid mock LLM output that conforms to the schema, `generate()` never produces output that fails schema validation.
- **Dedup idempotence**: `deduplicate(deduplicate(data)) === deduplicate(data)`. Running dedup twice produces the same result as running it once.
- **Export-parse round-trip**: For all supported formats where round-trip is lossless (JSONL, Alpaca), `parse(export(data, format)) === data`.
- **Count guarantee**: `generateBatch(schema, n).data.length <= n`. The pipeline never produces more than the requested count.

---

## 19. Performance

### Generation Speed

- **Per-example generation**: Dominated by LLM latency (typically 1-5 seconds per call). The pipeline adds < 5ms of overhead per example for parsing, validation, and dedup tracking.
- **Batch generation (batchSize: 10)**: 10 examples per call reduces total wall-clock time by approximately 8x compared to single-example generation (prompt overhead is amortized).
- **Validation**: < 0.1ms per example. Zod's `.safeParse()` is fast for typical schemas.
- **Exact deduplication (1,000 examples)**: < 10ms. Hash computation and lookup.
- **Near-duplicate detection (1,000 examples)**: < 500ms with MinHash LSH (128 hashes, 16 bands). Without LSH (brute force): approximately 5 seconds.
- **Near-duplicate detection (10,000 examples)**: < 5 seconds with MinHash LSH. Without LSH: approximately 500 seconds (prohibitive).
- **Export formatting (1,000 examples)**: < 50ms for all formats. String concatenation and JSON serialization.

### Memory

- **Per-example in memory**: 1-5 KB depending on field count and content length.
- **Working set for 10,000 examples**: 10-50 MB. Easily fits in memory.
- **MinHash signatures (1,000 examples, 128 hashes)**: approximately 500 KB.
- **Embedding vectors (1,000 examples, 1536-dimensional)**: approximately 6 MB.

### Scalability

The package is designed for generating hundreds to low tens of thousands of examples per run. For larger volumes:

- **LLM rate limits**: Most APIs limit requests per minute. Use `batchSize` > 1 to reduce call count, or use `llm-retry` with rate limiting.
- **Deduplication**: MinHash LSH keeps near-dedup tractable up to approximately 50,000 examples. Beyond that, semantic dedup with an ANN index is needed (user-provided).
- **Memory**: The full dataset is held in memory. For datasets exceeding available memory, generate in chunks and concatenate output files.
- **Cost**: At $0.003 per 1K prompt tokens and $0.015 per 1K completion tokens (GPT-4o), generating 10,000 examples costs approximately $50-200 depending on schema complexity and batch size.

---

## 20. Dependencies

### Runtime Dependencies

| Dependency | Purpose | Bundled/Peer |
|---|---|---|
| `zod` | Schema definition and validation | Optional peer dependency |

Zod is the only runtime dependency and it is optional. When using JSON Schema mode, the package uses a built-in JSON Schema validator (a lightweight subset implementation) and does not require Zod.

All other functionality uses Node.js built-ins:

- `crypto` for SHA-256 hashing (dedup).
- `node:fs` for file I/O (CLI only).
- String manipulation for JSON parsing, prompt construction, and export formatting.

### Optional Peer Dependencies

| Dependency | Purpose | When Needed |
|---|---|---|
| `openai` | OpenAI API adapter | When using `createOpenAIAdapter` |
| `@anthropic-ai/sdk` | Anthropic API adapter | When using `createAnthropicAdapter` |

These are not installed by default. Users install the SDK for their chosen LLM provider.

### Development Dependencies

| Dependency | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linter |

### Node.js Version

Node.js >= 18. Uses ES2022 language features (`Array.prototype.at()`, `Object.hasOwn()`, `structuredClone()`).

---

## 21. File Structure

```
synthdata-gen/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── src/
│   ├── index.ts                  # Public API exports
│   ├── types.ts                  # All TypeScript interfaces and type definitions
│   ├── generator.ts              # DataGenerator class and createGenerator factory
│   ├── pipeline.ts               # Full generation pipeline orchestration
│   ├── schema/
│   │   ├── compiler.ts           # Schema-to-prompt conversion
│   │   ├── json-schema.ts        # JSON Schema to Zod conversion
│   │   └── introspect.ts         # Zod schema introspection utilities
│   ├── prompt/
│   │   ├── builder.ts            # Prompt construction from components
│   │   ├── templates.ts          # Default system prompt templates
│   │   └── diversity.ts          # Diversity instruction generation
│   ├── parse/
│   │   ├── extractor.ts          # JSON extraction from LLM text output
│   │   └── validator.ts          # Schema validation and quality heuristics
│   ├── dedup/
│   │   ├── exact.ts              # Exact deduplication (hash-based)
│   │   ├── near.ts               # Near-duplicate detection (Jaccard + MinHash LSH)
│   │   ├── semantic.ts           # Semantic deduplication (embedding cosine similarity)
│   │   └── minhash.ts            # MinHash locality-sensitive hashing implementation
│   ├── export/
│   │   ├── openai.ts             # OpenAI fine-tuning JSONL formatter
│   │   ├── alpaca.ts             # Alpaca format formatter
│   │   ├── sharegpt.ts           # ShareGPT format formatter
│   │   ├── jsonl.ts              # Plain JSONL formatter
│   │   ├── csv.ts                # CSV formatter
│   │   └── eval-dataset.ts       # eval-dataset format formatter
│   ├── llm/
│   │   ├── interface.ts          # LlmFunction type and Message types
│   │   ├── openai-adapter.ts     # OpenAI API adapter
│   │   ├── anthropic-adapter.ts  # Anthropic API adapter
│   │   └── cost.ts               # Cost tracking utilities
│   ├── cli.ts                    # CLI entry point and argument parsing
│   └── __tests__/
│       ├── generate.test.ts      # Full pipeline generation tests
│       ├── schema.test.ts        # Schema compilation and conversion tests
│       ├── parse.test.ts         # JSON extraction and parsing tests
│       ├── validate.test.ts      # Schema validation and heuristic tests
│       ├── dedup.test.ts         # Deduplication tests (exact, near, semantic)
│       ├── minhash.test.ts       # MinHash LSH implementation tests
│       ├── export.test.ts        # Export format tests (all formats)
│       ├── prompt.test.ts        # Prompt construction tests
│       ├── diversity.test.ts     # Diversity strategy tests
│       ├── adapters.test.ts      # LLM adapter tests
│       ├── cost.test.ts          # Cost tracking tests
│       └── cli.test.ts           # CLI integration tests
└── dist/                         # Compiled output (gitignored)
```

---

## 22. Implementation Roadmap

### Phase 1: Core Pipeline (MVP)

Deliver the foundational generation, validation, and export pipeline.

1. **Types**: Define all TypeScript interfaces (`GeneratedExample`, `GenerationResult`, `GenerateOptions`, `LlmFunction`, `Message`, `ExportFormat`, etc.).
2. **Schema compiler**: Implement Zod schema introspection and schema-to-prompt conversion. Support string, number, boolean, enum, array, and object types with constraints.
3. **JSON Schema converter**: Implement JSON Schema to Zod conversion for the supported subset.
4. **Prompt builder**: Implement system prompt construction with schema description and seed examples.
5. **JSON extractor**: Implement JSON extraction from LLM text output (bare JSON, markdown fences, multi-object).
6. **Validator**: Implement schema validation using Zod `.safeParse()`. Implement basic quality heuristics (nonEmpty, noPlaceholder).
7. **`generate()`**: Wire up the single-pass pipeline: build prompt, call LLM, parse, validate.
8. **Retry logic**: Implement retry with validation feedback.
9. **Export**: Implement plain JSONL and OpenAI fine-tuning format.
10. **Tests**: Unit tests for schema compiler, JSON extractor, validator, and pipeline with mock LLM.

### Phase 2: Deduplication and Export Formats

Add deduplication and remaining export formats.

1. **Exact dedup**: Implement hash-based exact deduplication.
2. **Near-duplicate dedup**: Implement Jaccard similarity with MinHash LSH for efficient candidate pair generation.
3. **Per-field dedup**: Implement field-selective deduplication.
4. **`deduplicate()` standalone function**: Expose dedup as a standalone API.
5. **Alpaca export**: Implement Alpaca format.
6. **ShareGPT export**: Implement ShareGPT format.
7. **CSV export**: Implement CSV format with proper escaping.
8. **eval-dataset export**: Implement eval-dataset format.
9. **Custom export**: Implement template-based custom export.
10. **Tests**: Unit tests for dedup strategies and all export formats.

### Phase 3: Diversity and Scale

Add diversity strategies and large-scale generation support.

1. **Temperature variation**: Implement linear, cycle, and random temperature strategies.
2. **Topic rotation**: Implement topic cycling and prompt injection.
3. **Category balancing**: Implement category tracking and underrepresented category prioritization.
4. **Seed rotation**: Implement sequential, random, and window rotation modes.
5. **Persona-driven generation**: Implement persona-to-prompt injection.
6. **Negative example generation**: Implement negative example ratio and prompt switching.
7. **Constraint variation**: Implement constraint cycling.
8. **`generateBatch()`**: Implement guaranteed-count generation with fill-up loop.
9. **Batch generation**: Implement multi-example-per-call prompting and array parsing.
10. **Progress callback**: Implement `onProgress` reporting.
11. **Diversity score**: Implement dataset diversity scoring.
12. **Tests**: Integration tests for all diversity strategies with mock LLM.

### Phase 4: LLM Adapters, CLI, and Polish

Add LLM adapters, CLI, and finalize for release.

1. **OpenAI adapter**: Implement `createOpenAIAdapter` with token usage extraction.
2. **Anthropic adapter**: Implement `createAnthropicAdapter` with token usage extraction.
3. **Cost tracking**: Implement cost accumulation and reporting.
4. **Structured output mode**: Implement JSON mode flag passthrough.
5. **Semantic dedup**: Implement embedding-based dedup with pluggable embedder.
6. **Cross-set dedup**: Implement dedup against existing data.
7. **Custom validators**: Implement custom validator function support.
8. **CLI**: Implement all four commands (`generate`, `validate`, `dedup`, `export`) with argument parsing and config file loading.
9. **`createGenerator()`**: Implement factory with reusable configuration.
10. **AbortSignal**: Implement cancellation support.
11. **README**: Write comprehensive README with installation, quick start, API reference, and examples.
12. **CLI tests**: Integration tests for all CLI commands.
13. **Performance benchmarks**: Verify pipeline overhead, dedup speed, and export speed meet targets.

---

## 23. Example Use Cases

### Fine-Tuning Data for a Customer Support Bot

Generate instruction-following training data for fine-tuning a customer support model. The schema defines the interaction structure, and topic rotation ensures coverage of different support categories.

```typescript
import { z } from 'zod';
import { generate, createOpenAIAdapter, exportData } from 'synthdata-gen';
import OpenAI from 'openai';

const schema = z.object({
  customerQuery: z.string().min(10).max(500).describe('A customer support question or issue'),
  agentResponse: z.string().min(50).max(2000).describe('A helpful, professional support agent response'),
  category: z.enum(['billing', 'technical', 'account', 'returns', 'general']),
  sentiment: z.enum(['frustrated', 'neutral', 'positive']),
});

const llm = createOpenAIAdapter(new OpenAI(), { model: 'gpt-4o' });

const result = await generate(schema, {
  llm,
  count: 1000,
  batchSize: 5,
  additionalInstructions: 'Generate realistic customer support interactions for an e-commerce platform. Customers have varying levels of frustration and technical knowledge.',
  seeds: [
    {
      customerQuery: 'I was charged twice for my last order #12345. Can you fix this?',
      agentResponse: 'I apologize for the inconvenience. I can see the duplicate charge on order #12345. I have initiated a refund for the extra charge of $49.99. It should appear in your account within 3-5 business days. Is there anything else I can help you with?',
      category: 'billing',
      sentiment: 'frustrated',
    },
  ],
  diversity: {
    balanceField: 'category',
    temperature: { min: 0.6, max: 1.0, strategy: 'cycle' },
    topics: ['order issues', 'payment problems', 'product defects', 'shipping delays', 'account access', 'subscription management'],
  },
  dedup: { strategy: 'near', threshold: 0.80, fields: ['customerQuery'] },
  costTracking: { promptTokenCost: 0.000003, completionTokenCost: 0.000015 },
});

// Export for OpenAI fine-tuning
const trainingData = exportData(result.data, 'openai', {
  fieldMap: { user: 'customerQuery', assistant: 'agentResponse' },
  systemPrompt: 'You are a helpful customer support agent for an e-commerce platform. Be professional, empathetic, and solution-oriented.',
});

fs.writeFileSync('support-training.jsonl', trainingData);
console.log(`Generated ${result.stats.final} examples. Cost: $${result.stats.cost.totalCost.toFixed(2)}`);
```

### Classification Training Set

Generate balanced training data for a text sentiment classifier. Category rotation ensures equal representation of all labels.

```typescript
import { z } from 'zod';
import { generate, exportData } from 'synthdata-gen';

const schema = z.object({
  text: z.string().min(20).max(500).describe('A product review or social media post'),
  label: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.enum(['clear', 'ambiguous']).describe('Whether the sentiment is clearly expressed or ambiguous'),
});

const result = await generate(schema, {
  llm: myLlm,
  count: 1500,  // 500 per label
  diversity: {
    balanceField: 'label',
    topics: ['electronics', 'clothing', 'restaurants', 'software', 'books', 'travel'],
    negativeExampleRatio: 0.15,  // 15% ambiguous/edge cases
    negativeInstructions: 'Generate a review where the sentiment is genuinely ambiguous -- could be positive or negative depending on interpretation.',
  },
  dedup: { strategy: 'near', threshold: 0.85, fields: ['text'] },
});

const csv = exportData(result.data, 'csv', { fields: ['text', 'label'] });
fs.writeFileSync('sentiment-training.csv', csv);
```

### Q&A Pair Generation for an Eval Dataset

Generate evaluation test cases and load them directly into `eval-dataset` for use with promptfoo.

```typescript
import { z } from 'zod';
import { generate, exportData } from 'synthdata-gen';
import { loadDataset } from 'eval-dataset';

const schema = z.object({
  question: z.string().min(15).max(300).describe('A factual question about world geography'),
  answer: z.string().min(30).max(500).describe('An accurate, concise answer'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  region: z.enum(['americas', 'europe', 'asia', 'africa', 'oceania']),
});

// Load existing eval dataset to cross-dedup against
const existing = await loadDataset('geo-qa-eval.json');

const result = await generate(schema, {
  llm: myLlm,
  count: 200,
  diversity: {
    balanceField: 'region',
    topics: ['capitals', 'rivers', 'mountains', 'population', 'borders', 'climate'],
  },
  dedup: {
    strategy: 'near',
    threshold: 0.80,
    fields: ['question'],
    existingData: existing.cases.map(c => ({ question: c.input })),
  },
});

const evalData = exportData(result.data, 'eval-dataset', {
  fieldMap: { input: 'question', expected: 'answer' },
});

fs.writeFileSync('generated-geo-qa.jsonl', evalData);
// Load into eval-dataset: eval-dataset load generated-geo-qa.jsonl --name geo-qa-eval
```

### Instruction-Following Data in Alpaca Format

Generate diverse instruction-following examples for open-source model training.

```typescript
import { z } from 'zod';
import { generateBatch, exportData } from 'synthdata-gen';
import { generateBatch as generatePersonas } from 'synth-personas';

const schema = z.object({
  instruction: z.string().min(10).max(300).describe('A clear task instruction'),
  input: z.string().max(500).describe('Optional input context for the task').default(''),
  output: z.string().min(50).max(2000).describe('A high-quality response completing the task'),
});

const personas = generatePersonas(8, { seed: 42 });

const result = await generateBatch(schema, 5000, {
  llm: myLlm,
  batchSize: 10,
  diversity: {
    temperature: { min: 0.5, max: 1.2, strategy: 'linear' },
    topics: [
      'creative writing', 'code generation', 'mathematical reasoning',
      'text summarization', 'question answering', 'translation',
      'data analysis', 'explanation', 'brainstorming', 'editing',
    ],
    personas: personas,
    constraintVariation: [
      { instruction: 'Generate an example requiring a step-by-step response.' },
      { instruction: 'Generate an example with a single-sentence instruction.' },
      { instruction: 'Generate an example that requires using the input context.' },
      { instruction: 'Generate an example with a creative or open-ended task.' },
    ],
    negativeExampleRatio: 0.1,
  },
  dedup: { strategy: 'near', threshold: 0.80, fields: ['instruction'] },
});

const alpaca = exportData(result.data, 'alpaca');
fs.writeFileSync('alpaca-training.jsonl', alpaca);
console.log(`Generated ${result.stats.final} Alpaca examples in ${(result.stats.durationMs / 1000).toFixed(0)}s`);
```
