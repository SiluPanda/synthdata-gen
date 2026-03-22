# synthdata-gen — Task Breakdown

This file tracks all implementation tasks derived from `SPEC.md`. Tasks are organized into phases matching the implementation roadmap (Section 22) and expanded to cover every feature, configuration option, error handling case, and edge case from the spec.

---

## Phase 0: Project Setup and Scaffolding

- [ ] **Install runtime dependencies** — Add `zod` as an optional peer dependency in `package.json` (`"peerDependencies": { "zod": "^3.22.0" }` with `"peerDependenciesMeta": { "zod": { "optional": true } }`). | Status: not_done
- [x] **Install dev dependencies** — Add `typescript`, `vitest`, and `eslint` as dev dependencies. Configure ESLint for the project. | Status: done
- [ ] **Add optional peer dependencies for LLM SDKs** — Add `openai` and `@anthropic-ai/sdk` as optional peer dependencies in `package.json`. | Status: not_done
- [ ] **Configure package.json bin entry** — Add `"bin": { "synthdata-gen": "dist/cli.js" }` to `package.json` for CLI support. | Status: not_done
- [ ] **Create source file structure** — Create the directory structure specified in Section 21: `src/schema/`, `src/prompt/`, `src/parse/`, `src/dedup/`, `src/export/`, `src/llm/`, `src/__tests__/`. Create empty placeholder files for each module. | Status: not_done
- [x] **Set up vitest configuration** — Create `vitest.config.ts` (or configure in `package.json`) for the test runner. Ensure it finds tests in `src/__tests__/`. | Status: done

---

## Phase 1: Core Types and Interfaces

- [x] **Define `Message` interface** — Define the `Message` type with `role: 'system' | 'user' | 'assistant'` and `content: string` in `src/llm/interface.ts`. | Status: done
- [x] **Define `LlmCallOptions` interface** — Define `temperature?: number`, `maxTokens?: number`, `jsonMode?: boolean` in `src/llm/interface.ts`. | Status: done
- [x] **Define `LlmResponse` interface** — Define `content: string` and optional `usage: { promptTokens, completionTokens, totalTokens }` in `src/llm/interface.ts`. | Status: done
- [x] **Define `LlmFunction` type** — Define as `(messages: Message[], options?: LlmCallOptions) => Promise<LlmResponse>` in `src/llm/interface.ts`. | Status: done
- [x] **Define `GeneratedExample<T>` type** — Define the generic type with `_meta?` containing `id`, `index`, `isNegative`, `repaired`, `batchIndex`, and `diversityContext` in `src/types.ts`. | Status: done
- [x] **Define `GenerationResult<T>` interface** — Define with `data: GeneratedExample<T>[]` and `stats: GenerationStats` in `src/types.ts`. | Status: done
- [ ] **Define `GenerationStats` interface** — Define all fields: `total`, `valid`, `invalid`, `deduped`, `final`, `llmCalls`, `tokens` (prompt/completion/total), `cost` (promptTokens/completionTokens/totalCost/currency), `validationErrors`, `invalidExamples`, `categoryDistribution`, `diversityScore`, `durationMs` in `src/types.ts`. | Status: not_done
- [x] **Define `ValidationResult` and `ValidationError` interfaces** — Define `valid`, `index`, `errors[]` with `path`, `message`, `code` in `src/types.ts`. | Status: done
- [x] **Define `DedupResult<T>` interface** — Define `data`, `removed`, `pairs` (as `[number, number, number][]`) in `src/types.ts`. | Status: done
- [ ] **Define `ExportFormat` type** — Define as union `'openai' | 'alpaca' | 'sharegpt' | 'jsonl' | 'csv' | 'eval-dataset' | 'custom'` in `src/types.ts`. | Status: not_done
- [ ] **Define `GenerateOptions<T>` interface** — Define all generation options: `llm`, `count`, `batchSize`, `systemPrompt`, `additionalInstructions`, `promptTemplate`, `templateVars`, `seeds`, `diversity`, `validation`, `retry`, `dedup`, `invalidHandling`, `structuredOutput`, `costTracking`, `onProgress`, `signal` in `src/types.ts`. | Status: not_done
- [ ] **Define `DiversityConfig` interface** — Define `temperature` (min/max/strategy), `topics`, `balanceField`, `seedRotation`, `seedsPerBatch`, `personas`, `negativeExampleRatio`, `negativeInstructions`, `constraintVariation` in `src/types.ts`. | Status: not_done
- [ ] **Define `ValidationConfig` interface** — Define `minFieldLength`, `maxFieldLength`, `heuristics` (nonEmpty, noPlaceholder, noDuplicateFields, minWordCount, noRepetition, languageCheck), `custom` validators in `src/types.ts`. | Status: not_done
- [x] **Define `RetryConfig` interface** — Define `maxRetries`, `includeFeedback`, `backoff` (none/linear/exponential), `backoffMs` in `src/types.ts`. | Status: done
- [x] **Define `DedupOptions` interface** — Define `strategy`, `threshold`, `ngramSize`, `fields`, `embedder`, `existingData`, `minhash` (numHashes/numBands) in `src/types.ts`. | Status: done
- [x] **Define `CostConfig` interface** — Define `promptTokenCost`, `completionTokenCost`, `currency` in `src/types.ts`. | Status: done
- [ ] **Define `ProgressInfo` interface** — Define `generated`, `valid`, `target`, `batchIndex`, `percentComplete`, `elapsedMs` in `src/types.ts`. | Status: not_done
- [ ] **Define `GeneratorConfig<T>` interface** — Extend `Omit<GenerateOptions<T>, 'count'>` with `schema` field in `src/types.ts`. | Status: not_done
- [ ] **Define `DataGenerator<T>` interface** — Define `generate()`, `validate()`, `deduplicate()`, `export()`, and readonly `config` in `src/types.ts`. | Status: not_done
- [x] **Export all public types from `src/index.ts`** — Re-export all type definitions from `src/types.ts` and `src/llm/interface.ts`. | Status: done

---

## Phase 2: Schema Compiler

- [ ] **Implement Zod schema introspection** — In `src/schema/introspect.ts`, implement functions to walk a Zod schema and extract field names, types, constraints (min/max/regex), enum values, descriptions, optionality, and default values. | Status: not_done
- [ ] **Handle `z.string()` introspection** — Extract min/max length, regex patterns, and `.describe()` text from Zod string schemas. | Status: not_done
- [ ] **Handle `z.number()` and `z.number().int()` introspection** — Extract min/max values and integer constraint. | Status: not_done
- [ ] **Handle `z.boolean()` introspection** — Recognize boolean type for prompt description. | Status: not_done
- [ ] **Handle `z.enum([...])` introspection** — Extract the list of valid enum values. | Status: not_done
- [ ] **Handle `z.array(t)` introspection** — Extract element type and min/max items constraints. | Status: not_done
- [ ] **Handle nested `z.object({...})` introspection** — Recursively introspect nested object schemas. | Status: not_done
- [ ] **Handle `z.optional(t)` and `.default(v)` introspection** — Detect optional fields and default values. | Status: not_done
- [x] **Implement schema-to-prompt compiler** — In `src/schema/compiler.ts`, implement the conversion algorithm that produces a natural language JSON template from the introspected schema. Each field becomes `"fieldName": <type> (<constraints>) - <description>`. | Status: done
- [x] **Handle enum fields in prompt output** — Render enum fields as `one of ["val1", "val2", ...]` in the prompt. | Status: done
- [ ] **Handle nested objects in prompt output** — Indent and recurse for nested object fields in the prompt template. | Status: not_done
- [x] **Handle arrays in prompt output** — Describe arrays as `array of <element type> (min N items, max M items)`. | Status: done
- [x] **Mark optional fields in prompt output** — Annotate optional fields with `(optional)` in the prompt template. | Status: done
- [ ] **Implement JSON Schema to Zod conversion** — In `src/schema/json-schema.ts`, convert JSON Schema objects to equivalent Zod schemas. Support: `type: "string"/"number"/"integer"/"boolean"/"array"/"object"`, `enum`, `minLength`/`maxLength`, `minimum`/`maximum`, `minItems`/`maxItems`, `pattern`, `required`, `description`, `default`. | Status: not_done
- [ ] **Handle `required` fields in JSON Schema conversion** — Non-required fields should be wrapped in `z.optional()`. | Status: not_done
- [ ] **Handle nested objects in JSON Schema conversion** — Recursively convert nested `type: "object"` properties. | Status: not_done
- [ ] **Handle array items in JSON Schema conversion** — Convert `items` schema for array types. | Status: not_done

### Schema Tests

- [x] **Test schema-to-prompt for string fields with constraints** — Verify prompt output includes min/max length and description for string fields. | Status: done
- [x] **Test schema-to-prompt for enum fields** — Verify prompt output lists all enum values. | Status: done
- [ ] **Test schema-to-prompt for nested objects** — Verify prompt output correctly indents and describes nested structures. | Status: not_done
- [x] **Test schema-to-prompt for arrays** — Verify prompt output describes element type and item count constraints. | Status: done
- [x] **Test schema-to-prompt for optional and default fields** — Verify prompt output annotates optional fields and shows defaults. | Status: done
- [ ] **Test JSON Schema to Zod conversion** — Verify all supported JSON Schema features convert to equivalent Zod schemas. Validate that the converted schema produces the same parse results as a hand-written Zod equivalent. | Status: not_done
- [ ] **Test JSON Schema `required` handling** — Verify that non-required fields become `z.optional()`. | Status: not_done
- [ ] **Write tests in `src/__tests__/schema.test.ts`** — Cover all schema compiler and JSON Schema conversion tests. | Status: not_done

---

## Phase 3: Prompt Builder

- [x] **Implement default system prompt template** — In `src/prompt/templates.ts`, define the default system prompt string with the `{schema_description}` placeholder as specified in Section 7. | Status: done
- [ ] **Implement prompt builder** — In `src/prompt/builder.ts`, assemble the full messages array: `[system, ...seedExamples, user]`. Substitute template placeholders (`{schema_description}`, `{additional_instructions}`, `{diversity_instructions}`, `{batch_size}`, `{topic}`, `{category}`, `{seed_examples}`, `{example_number}`, and custom `templateVars`). | Status: not_done
- [x] **Handle custom system prompt override** — When `systemPrompt` is provided, use it instead of the default. When `additionalInstructions` is provided, append it to the default. | Status: done
- [ ] **Handle custom prompt template** — When `promptTemplate.system` and/or `promptTemplate.user` are provided, use them with variable substitution. | Status: not_done
- [x] **Format seed examples as message pairs** — Convert each seed example into a `user: "Generate a training example."` / `assistant: <JSON>` message pair. | Status: done
- [x] **Handle batch generation prompts** — When `batchSize > 1`, modify the user message to request a JSON array of N examples. | Status: done
- [ ] **Implement diversity instruction generation** — In `src/prompt/diversity.ts`, generate dynamic diversity instructions based on the active `DiversityConfig` (topic, category, persona, constraint, negative example). Append these to the user message. | Status: not_done

### Prompt Tests

- [ ] **Test prompt builder includes all components** — Verify system prompt, schema description, seed examples, and diversity instructions are all present in the built prompt. | Status: not_done
- [x] **Test custom system prompt replaces default** — Verify that setting `systemPrompt` fully replaces the default template. | Status: done
- [x] **Test additional instructions are appended** — Verify `additionalInstructions` are appended after the default system prompt. | Status: done
- [ ] **Test template variable substitution** — Verify all placeholder variables are correctly replaced in custom templates. | Status: not_done
- [ ] **Test seed example formatting** — Verify seeds are converted to user/assistant message pairs correctly. | Status: not_done
- [ ] **Test batch prompt requests JSON array** — Verify the user message changes for `batchSize > 1`. | Status: not_done
- [ ] **Write tests in `src/__tests__/prompt.test.ts`** — Cover all prompt builder and template tests. | Status: not_done

---

## Phase 4: JSON Parser and Extractor

- [x] **Implement JSON extraction from bare JSON** — In `src/parse/extractor.ts`, parse responses that are bare JSON objects or arrays. | Status: done
- [x] **Implement JSON extraction from markdown fences** — Handle JSON wrapped in `` ```json ... ``` `` or `` ``` ... ``` `` code fences. | Status: done
- [x] **Implement JSON extraction from mixed text** — Handle JSON embedded in explanatory text (find JSON objects/arrays within prose). | Status: done
- [ ] **Implement multi-object extraction** — Handle multiple JSON objects separated by newlines in a single response. | Status: not_done
- [x] **Handle malformed JSON gracefully** — Return parse errors for partial objects, trailing commas, and other malformed JSON. Do not throw. | Status: done
- [x] **Handle empty responses** — Return an appropriate error when the LLM response is empty or contains no JSON. | Status: done
- [x] **Handle structured output mode** — When `structuredOutput` is true, skip JSON extraction and parse the entire response as JSON directly. | Status: done

### Parser Tests

- [x] **Test extraction of bare JSON object** — Verify a plain `{ ... }` response is correctly parsed. | Status: done
- [x] **Test extraction of bare JSON array** — Verify a plain `[ ... ]` response is correctly parsed into individual objects. | Status: done
- [x] **Test extraction from markdown code fences** — Verify JSON inside `` ```json ... ``` `` is correctly extracted. | Status: done
- [x] **Test extraction from mixed text** — Verify JSON is found within surrounding prose text. | Status: done
- [ ] **Test multi-object extraction** — Verify multiple JSON objects separated by newlines are all extracted. | Status: not_done
- [x] **Test malformed JSON returns parse error** — Verify partial/broken JSON returns structured error, not exception. | Status: done
- [x] **Test empty response handling** — Verify empty string or whitespace-only returns appropriate error. | Status: done
- [ ] **Write tests in `src/__tests__/parse.test.ts`** — Cover all JSON extraction and parsing tests. | Status: not_done

---

## Phase 5: Schema Validation and Quality Heuristics

- [x] **Implement schema validation using Zod `safeParse`** — In `src/parse/validator.ts`, validate each parsed example against the Zod schema. Return structured `ValidationResult` with field paths, messages, and codes. | Status: done
- [x] **Implement global string length constraints** — Apply `validation.minFieldLength` and `validation.maxFieldLength` to all string fields in the example, independent of per-field schema constraints. | Status: done
- [x] **Implement `nonEmpty` heuristic** — Check that all required string fields contain non-whitespace content. Enabled by default. | Status: done
- [x] **Implement `noPlaceholder` heuristic** — Check that fields do not contain placeholder text ("Lorem ipsum", "Example text", "TODO", "[insert here]", etc.). Enabled by default. | Status: done
- [x] **Implement `noDuplicateFields` heuristic** — Check that specified field pairs (e.g., question vs answer) have different content. | Status: done
- [x] **Implement `minWordCount` heuristic** — Check that specified string fields have at least N words. Disabled by default. | Status: done
- [ ] **Implement `noRepetition` heuristic** — Check that fields do not contain excessive repeated phrases or sentences. Disabled by default. | Status: not_done
- [ ] **Implement `languageCheck` heuristic** — Check that fields are in the expected language using a user-provided language detection function. Disabled by default. | Status: not_done
- [x] **Implement custom validator support** — Run user-provided custom validation functions after schema and heuristic validation. Each custom validator returns `{ valid, message? }`. | Status: done
- [x] **Classify parsed examples** — Classify each example as `valid`, `invalid`, or `unparseable` based on parse and validation results. | Status: done

### Validation Tests

- [x] **Test valid example passes validation** — Verify a correctly shaped example returns `valid: true`. | Status: done
- [x] **Test invalid type fails validation** — Verify wrong field types produce appropriate error messages with paths. | Status: done
- [x] **Test min/max string length enforcement** — Verify strings below min or above max length fail with correct error. | Status: done
- [x] **Test enum validation** — Verify invalid enum values fail with the list of allowed values in the error. | Status: done
- [x] **Test optional field handling** — Verify that missing optional fields pass validation. | Status: done
- [ ] **Test default value application** — Verify that fields with defaults are populated when missing. | Status: not_done
- [x] **Test global min/max field length** — Verify `validation.minFieldLength` and `maxFieldLength` apply to all string fields. | Status: done
- [x] **Test `nonEmpty` heuristic** — Verify whitespace-only strings are rejected. | Status: done
- [x] **Test `noPlaceholder` heuristic** — Verify placeholder text like "Lorem ipsum" is rejected. | Status: done
- [x] **Test `noDuplicateFields` heuristic** — Verify identical question/answer pairs are rejected. | Status: done
- [x] **Test `minWordCount` heuristic** — Verify fields with fewer than N words are rejected. | Status: done
- [x] **Test custom validator integration** — Verify custom validators are called and their failures are included in the result. | Status: done
- [x] **Write tests in `src/__tests__/validate.test.ts`** — Cover all validation and heuristic tests. | Status: done

---

## Phase 6: Retry Logic

- [ ] **Implement retry loop for invalid examples** — When an example fails validation, re-call the LLM with retry feedback up to `maxRetries` times (default: 3). Track retry count per example. | Status: not_done
- [ ] **Construct retry prompt with validation feedback** — When `includeFeedback` is true, include validation error details in the retry prompt (field path, expected constraint, actual value). | Status: not_done
- [ ] **Construct retry prompt for parse failures** — When the response is not valid JSON, tell the LLM: "The previous response was not valid JSON. Output ONLY a valid JSON object." | Status: not_done
- [ ] **Implement backoff strategies** — Support `'none'` (immediate retry), `'linear'` (backoffMs * attempt), and `'exponential'` (backoffMs * 2^attempt) delays between retries. | Status: not_done
- [x] **Implement invalid example handling modes** — Support `'discard'` (drop from output), `'log'` (drop but record in `stats.invalidExamples`), and `'repair'` (include with `_meta.repaired: true` flag). | Status: done
- [ ] **Track retry statistics** — Record total retries, per-example retry counts, and validation failure reasons with counts in `GenerationStats`. | Status: not_done

---

## Phase 7: Core Generate Pipeline

- [x] **Implement `generate()` function** — In `src/pipeline.ts`, wire up the full single-pass pipeline: build prompt (Stage 2), call LLM (Stage 3), parse and extract JSON (Stage 4), validate (Stage 4), retry on failure (Stage 5). Accumulate valid examples until target count is reached. | Status: done
- [x] **Track LLM call count** — Increment `stats.llmCalls` for every LLM function invocation (including retries). | Status: done
- [x] **Track token usage** — Accumulate `usage.promptTokens` and `usage.completionTokens` from each `LlmResponse` into `stats.tokens`. | Status: done
- [x] **Track wall-clock duration** — Record `Date.now()` at start and end of pipeline, store in `stats.durationMs`. | Status: done
- [ ] **Implement progress callback** — Call `onProgress` after each batch with current `generated`, `valid`, `target`, `batchIndex`, `percentComplete`, `elapsedMs`. | Status: not_done
- [ ] **Implement AbortSignal support** — Check `signal.aborted` before each LLM call. If aborted, return partial results collected so far. | Status: not_done
- [x] **Assign `_meta` to each generated example** — Populate `id` (UUID or sequential), `index`, `batchIndex`, and `diversityContext` on each valid example. | Status: done
- [x] **Handle batch generation (batchSize > 1)** — When `batchSize > 1`, modify the prompt to request an array and parse each element of the returned array individually. | Status: done
- [x] **Wire deduplication into the pipeline** — After accumulating all valid examples, run deduplication before returning results. | Status: done
- [ ] **Compute category distribution** — Count examples per category for enum fields and store in `stats.categoryDistribution`. | Status: not_done
- [x] **Export `generate` from `src/index.ts`** — Add the `generate` function to the public API. | Status: done

### Pipeline Tests

- [x] **Test full pipeline with mock LLM returning valid JSON** — Verify `generate()` returns the correct number of validated examples with correct stats. | Status: done
- [x] **Test pipeline with mock LLM returning invalid JSON on first call** — Verify retry logic kicks in and valid examples are eventually produced. | Status: done
- [ ] **Test pipeline with mock LLM returning unparseable text** — Verify parse failure triggers retry with appropriate feedback prompt. | Status: not_done
- [x] **Test pipeline with batchSize > 1** — Verify JSON arrays are parsed into individual examples, each validated separately. | Status: done
- [x] **Test pipeline tracks token usage correctly** — Verify `stats.tokens` accumulates from multiple LLM calls. | Status: done
- [x] **Test pipeline tracks LLM call count** — Verify `stats.llmCalls` includes retries. | Status: done
- [ ] **Test progress callback is called** — Verify `onProgress` fires after each batch with increasing progress values. | Status: not_done
- [ ] **Test AbortSignal cancellation** — Verify pipeline stops and returns partial results when signal is aborted. | Status: not_done
- [x] **Test invalid handling modes** — Verify `'discard'` drops invalid examples, `'log'` records them in stats, `'repair'` includes them with meta flag. | Status: done
- [x] **Write tests in `src/__tests__/generate.test.ts`** — Cover all pipeline integration tests using mock LLM. | Status: done

---

## Phase 8: Exact Deduplication

- [x] **Implement text normalization** — In `src/dedup/exact.ts`, normalize string fields: lowercase, collapse whitespace, trim. Serialize non-string fields to canonical JSON (sorted keys). | Status: done
- [x] **Implement hash computation** — Concatenate normalized field values with a delimiter and compute SHA-256 truncated to 16 bytes. | Status: done
- [x] **Implement exact dedup** — Use a hash set to detect identical examples. Keep the first occurrence, discard duplicates. O(n) time and space. | Status: done
- [x] **Support per-field dedup** — When `fields` is specified, only normalize and hash the specified fields. | Status: done

---

## Phase 9: Near-Duplicate Detection

- [x] **Implement word n-gram extraction** — In `src/dedup/near.ts`, tokenize text fields and extract word n-grams (default: bigrams). | Status: done
- [x] **Implement Jaccard similarity computation** — Compute `|A intersect B| / |A union B|` for two n-gram sets. | Status: done
- [ ] **Implement MinHash signature generation** — In `src/dedup/minhash.ts`, generate MinHash signatures using configurable number of hash functions (default: 128). | Status: not_done
- [ ] **Implement LSH banding** — Divide MinHash signatures into bands (default: 16 bands of 8 hashes) and identify candidate pairs that share at least one identical band. | Status: not_done
- [ ] **Implement near-duplicate dedup with LSH** — Use LSH to generate candidate pairs, then compute exact Jaccard similarity only for candidates. Remove examples exceeding the threshold (default: 0.85). | Status: not_done
- [x] **Support per-field near dedup** — When `fields` is specified, extract n-grams only from specified fields. | Status: done
- [x] **Keep first-generated instance on duplicate** — When two examples are duplicates, keep the one that was generated first (lower index). | Status: done

---

## Phase 10: Semantic Deduplication

- [x] **Implement semantic dedup with pluggable embedder** — In `src/dedup/semantic.ts`, accept an `embedder` function, embed configured fields, and compute pairwise cosine similarity. Remove pairs exceeding threshold (default: 0.92). | Status: done
- [x] **Implement cosine similarity** — Compute `dot(a, b) / (||a|| * ||b||)` for two embedding vectors. | Status: done
- [ ] **Support field concatenation vs per-field averaging** — Configurable: either concatenate field values before embedding or embed per-field and average vectors. | Status: not_done
- [x] **Brute-force for small datasets** — Use brute-force pairwise comparison for datasets under 5,000 examples. | Status: done
- [ ] **Support pluggable ANN index** — Accept an optional approximate nearest neighbor index for larger datasets. | Status: not_done

---

## Phase 11: Cross-Set Deduplication

- [x] **Implement cross-set dedup** — When `dedup.existingData` is provided, compare each generated example against the existing set and remove generated examples that are too similar to any existing example. | Status: done
- [ ] **Support all dedup strategies for cross-set** — Cross-set dedup should work with exact, near, and semantic strategies. | Status: not_done

---

## Phase 12: Standalone Deduplication API

- [x] **Implement `deduplicate()` standalone function** — Expose dedup as a standalone function in `src/index.ts`. Accept data array and `DedupOptions`, return `DedupResult` with `data`, `removed`, and `pairs`. | Status: done
- [x] **Wire exact, near, and semantic strategies** — Route to the appropriate dedup implementation based on `strategy` option. | Status: done
- [x] **Support `strategy: 'none'`** — When strategy is `'none'`, return data unchanged. | Status: done

### Deduplication Tests

- [x] **Test exact dedup removes identical entries** — Verify exact duplicates are removed and unique entries are kept. | Status: done
- [x] **Test exact dedup with normalization** — Verify case differences and extra whitespace are treated as identical. | Status: done
- [x] **Test near-dedup with Jaccard similarity** — Verify examples above threshold are removed and below threshold are kept. | Status: done
- [x] **Test near-dedup with different thresholds** — Verify threshold configuration changes which pairs are considered duplicates. | Status: done
- [x] **Test near-dedup with custom n-gram size** — Verify unigrams, bigrams, and trigrams produce different similarity results. | Status: done
- [ ] **Test MinHash LSH matches brute-force** — Verify MinHash LSH produces the same results as brute-force Jaccard for a small dataset. | Status: not_done
- [x] **Test per-field dedup** — Verify dedup on specific fields ignores other fields for similarity comparison. | Status: done
- [x] **Test cross-set dedup** — Verify generated examples duplicating existing data are removed. | Status: done
- [ ] **Test dedup idempotence** — Verify `deduplicate(deduplicate(data))` equals `deduplicate(data)`. | Status: not_done
- [x] **Test semantic dedup with mock embedder** — Verify cosine similarity dedup works with a mock embedding function. | Status: done
- [x] **Test `strategy: 'none'` returns data unchanged** — Verify no examples are removed. | Status: done
- [x] **Write tests in `src/__tests__/dedup.test.ts`** — Cover all dedup strategy tests. | Status: done
- [ ] **Write tests in `src/__tests__/minhash.test.ts`** — Cover MinHash signature generation and LSH banding tests. | Status: not_done

---

## Phase 13: Export Formats

### OpenAI Fine-Tuning JSONL

- [x] **Implement OpenAI JSONL formatter** — In `src/export/openai.ts`, format each example as `{"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}` with one object per line. | Status: done
- [x] **Implement default field mapping for OpenAI** — Map `instruction`/first string field to user message, `output`/`response`/`answer`/last string field to assistant message, optional `system`/`system_prompt` to system message, `input` appended to user message if non-empty. | Status: done
- [x] **Support custom field mapping for OpenAI** — Accept `fieldMap` with `user`, `assistant`, `system` keys pointing to schema field names. | Status: done
- [x] **Support static system prompt for OpenAI** — Accept `systemPrompt` option to set the same system message for all examples. | Status: done

### Alpaca Format

- [x] **Implement Alpaca formatter** — In `src/export/alpaca.ts`, format each example as `{"instruction": ..., "input": ..., "output": ...}` JSONL. | Status: done
- [x] **Implement default field mapping for Alpaca** — Map `instruction`/first string field, `input`/second string field, `output`/`response`/`answer`/last string field. | Status: done

### ShareGPT Format

- [x] **Implement ShareGPT formatter** — In `src/export/sharegpt.ts`, format each example as `{"conversations": [{"from": "human", "value": ...}, {"from": "gpt", "value": ...}]}` JSONL. | Status: done
- [x] **Implement default field mapping for ShareGPT** — Map instruction to `human`, output to `gpt`, optional system to `system` role. | Status: done

### Plain JSONL

- [x] **Implement plain JSONL formatter** — In `src/export/jsonl.ts`, serialize each example as one JSON object per line, preserving original schema field names. | Status: done

### CSV

- [x] **Implement CSV formatter** — In `src/export/csv.ts`, output header row and data rows. Handle comma, quote, and newline escaping in field values. | Status: done
- [x] **Support CSV options** — Accept `delimiter` (default: `,`), `quote` (default: `"`), `header` (default: true), `fields` (subset of fields to include). | Status: done
- [ ] **Handle nested objects and arrays in CSV** — Flatten nested objects with dot notation. JSON-serialize arrays within cells. | Status: not_done

### eval-dataset Format

- [ ] **Implement eval-dataset formatter** — In `src/export/eval-dataset.ts`, map to `{"id": ..., "input": ..., "expected": ..., "category": ..., "tags": [...], "metadata": {...}}` format. | Status: not_done
- [ ] **Implement default field mapping for eval-dataset** — Map `instruction`/`question`/first string to `input`, `output`/`answer`/`expected`/last string to `expected`, `category` to `category`, merge tags with `["generated", "synthdata-gen"]`, store remaining fields in `metadata`. | Status: not_done
- [ ] **Generate sequential IDs** — Generate `sdg-001`, `sdg-002`, etc. for the `id` field. | Status: not_done

### Custom Format

- [ ] **Implement custom format via template function** — Accept a `template: (example, index) => string` function and `separator` option (default: `\n`). | Status: not_done

### Standalone Export API

- [x] **Implement `exportData()` standalone function** — Expose export as a standalone function in `src/index.ts`. Accept data array, format, and format-specific options. Return formatted string. | Status: done

### Export Tests

- [x] **Test OpenAI JSONL output** — Verify correct message structure, field mapping, and system prompt injection. | Status: done
- [x] **Test OpenAI custom field mapping** — Verify custom `fieldMap` correctly maps schema fields to message roles. | Status: done
- [x] **Test Alpaca output** — Verify correct field structure and mapping. | Status: done
- [x] **Test ShareGPT output** — Verify correct conversation structure with human/gpt roles. | Status: done
- [x] **Test plain JSONL output** — Verify schema fields are preserved as-is, one object per line. | Status: done
- [x] **Test CSV output with escaping** — Verify commas, quotes, and newlines in field values are correctly escaped. | Status: done
- [x] **Test CSV field subset** — Verify `fields` option limits which columns appear. | Status: done
- [x] **Test CSV header toggle** — Verify `header: false` omits the header row. | Status: done
- [ ] **Test eval-dataset output** — Verify correct field mapping, tag merging, metadata population, and sequential IDs. | Status: not_done
- [ ] **Test custom format template** — Verify template function is called for each example with correct index. | Status: not_done
- [ ] **Test export-parse round-trip for JSONL** — Verify `JSON.parse(line)` on each JSONL line matches expected structure. | Status: not_done
- [ ] **Test export-parse round-trip for Alpaca** — Verify round-trip fidelity for Alpaca format. | Status: not_done
- [x] **Write tests in `src/__tests__/export.test.ts`** — Cover all export format tests. | Status: done

---

## Phase 14: Diversity Strategies

### Temperature Variation

- [x] **Implement `linear` temperature strategy** — Linearly interpolate from `min` to `max` across all batches. Batch 1 uses `min`, last batch uses `max`. | Status: done
- [x] **Implement `cycle` temperature strategy** — Cycle through `[min, mid, max, mid, min, ...]` across batches. | Status: done
- [x] **Implement `random` temperature strategy** — Random temperature between `min` and `max` per batch. | Status: done
- [x] **Pass temperature to LLM function** — Set `options.temperature` in the `LlmCallOptions` for each batch based on the active temperature strategy. | Status: done

### Topic Rotation

- [ ] **Implement topic rotation** — Cycle through the `topics` array sequentially across batches. Inject `"Generate an example about the topic: {topic}."` into the prompt. | Status: not_done
- [ ] **Handle topic wrap-around** — When target count exceeds number of topics, cycle repeats. | Status: not_done

### Category Balancing

- [ ] **Implement category balancing** — Track count of valid examples per category value for the `balanceField` enum. Before each batch, identify the underrepresented category and inject `"Generate an example with category: '{category}'."` into the prompt. | Status: not_done

### Seed Rotation

- [ ] **Implement `sequential` seed rotation** — Cycle through seeds in order: batch 1 uses seeds [0, 1], batch 2 uses [1, 2], etc. | Status: not_done
- [ ] **Implement `random` seed rotation** — Select a random subset of `seedsPerBatch` seeds per batch. | Status: not_done
- [ ] **Implement `window` seed rotation** — Use a sliding window of `seedsPerBatch` consecutive seeds. | Status: not_done
- [ ] **Support `seedsPerBatch` configuration** — Control how many seeds are included in each batch's prompt (default: all). | Status: not_done

### Persona-Driven Generation

- [ ] **Implement persona rotation** — Cycle through the `personas` array across batches. For each batch, inject persona characteristics into the prompt (occupation, formality level, technical expertise). | Status: not_done
- [ ] **Format persona prompt injection** — Generate text like `"Generate an example as if written by a {occupation} with {formality} communication style and {expertise} technical expertise."` | Status: not_done

### Negative Example Generation

- [ ] **Implement negative example ratio** — For the configured fraction of batches (`negativeExampleRatio`), replace the standard prompt with `negativeInstructions`. | Status: not_done
- [ ] **Tag negative examples** — Set `_meta.isNegative: true` on examples generated with negative prompts. | Status: not_done

### Constraint Variation

- [ ] **Implement constraint cycling** — Cycle through `constraintVariation` array across batches. Append each variation's `instruction` to the user message. | Status: not_done

### Combined Strategies

- [ ] **Support combining multiple diversity strategies** — Apply temperature, topic, category, seed, persona, negative, and constraint strategies independently within the same generation run. | Status: not_done

### Diversity Tests

- [ ] **Test linear temperature produces correct sequence** — Verify temperature values linearly increase from min to max across batches. | Status: not_done
- [ ] **Test cycle temperature produces correct pattern** — Verify the cycle pattern repeats correctly. | Status: not_done
- [ ] **Test random temperature stays within bounds** — Verify all random temperatures are between min and max. | Status: not_done
- [ ] **Test topic rotation cycles through topics** — Verify each batch gets the next topic in sequence. | Status: not_done
- [ ] **Test category balancing prioritizes underrepresented** — Verify the category with fewest examples is requested next. | Status: not_done
- [ ] **Test sequential seed rotation** — Verify seeds cycle in order across batches. | Status: not_done
- [ ] **Test random seed rotation** — Verify correct number of seeds per batch, randomly selected. | Status: not_done
- [ ] **Test window seed rotation** — Verify sliding window behavior. | Status: not_done
- [ ] **Test persona rotation injects persona characteristics** — Verify prompt includes persona description. | Status: not_done
- [ ] **Test negative example ratio** — Verify approximately the configured fraction of batches use negative prompts. | Status: not_done
- [ ] **Test constraint variation cycling** — Verify constraint instructions cycle through the array. | Status: not_done
- [ ] **Test combined strategies** — Verify multiple strategies operate independently within the same run. | Status: not_done
- [ ] **Write tests in `src/__tests__/diversity.test.ts`** — Cover all diversity strategy tests. | Status: not_done

---

## Phase 15: generateBatch and Diversity Score

- [ ] **Implement `generateBatch()` function** — Wrapper around `generate()` that ensures exactly `count` valid, unique examples. Run `generate()` in a loop, checking final count after each round. If below target, generate `(target - current) * oversamplingFactor` more (default oversampling: 1.3x). | Status: not_done
- [ ] **Implement maximum iteration limit** — Default: 10 iterations to prevent infinite loops when LLM consistently fails. | Status: not_done
- [ ] **Merge stats across iterations** — Accumulate `total`, `valid`, `invalid`, `deduped`, `llmCalls`, `tokens`, `cost` across all iterations. | Status: not_done
- [ ] **Implement diversity score calculation** — Compute mean pairwise Jaccard distance on word bigrams of all string fields, normalized to [0, 1]. Store in `stats.diversityScore`. | Status: not_done
- [ ] **Export `generateBatch` from `src/index.ts`** — Add to public API. | Status: not_done

---

## Phase 16: Standalone Validate API

- [x] **Implement `validate()` standalone function** — Accept an array of data objects and a schema (Zod or JSON Schema). Return `ValidationResult[]` with per-example results. | Status: done
- [ ] **Support both Zod and JSON Schema input** — Auto-detect schema type and convert JSON Schema to Zod if needed. | Status: not_done
- [x] **Export `validate` from `src/index.ts`** — Add to public API. | Status: done

---

## Phase 17: LLM Adapters

### OpenAI Adapter

- [ ] **Implement `createOpenAIAdapter()`** — In `src/llm/openai-adapter.ts`, wrap the OpenAI client's `chat.completions.create()`. Accept defaults for `model` (default: `gpt-4o`), `temperature`, `maxTokens`. | Status: not_done
- [ ] **Extract token usage from OpenAI response** — Map `response.usage.prompt_tokens`, `completion_tokens`, `total_tokens` to `LlmResponse.usage`. | Status: not_done
- [ ] **Support JSON mode for OpenAI** — When `jsonMode: true`, set `response_format: { type: 'json_object' }`. | Status: not_done
- [ ] **Support temperature override per call** — `options.temperature` overrides the default for that specific call. | Status: not_done

### Anthropic Adapter

- [ ] **Implement `createAnthropicAdapter()`** — In `src/llm/anthropic-adapter.ts`, wrap the Anthropic client's `messages.create()`. Accept defaults for `model`, `temperature`, `maxTokens`. | Status: not_done
- [ ] **Extract token usage from Anthropic response** — Map Anthropic's usage fields to `LlmResponse.usage`. | Status: not_done
- [ ] **Handle Anthropic message format** — Convert the `Message[]` format (system/user/assistant) to Anthropic's expected format (system as top-level param, alternating user/assistant messages). | Status: not_done

### Cost Tracking

- [ ] **Implement cost accumulator** — In `src/llm/cost.ts`, track cumulative token usage and compute cost based on `CostConfig` rates. | Status: not_done
- [x] **Calculate total cost** — `totalCost = promptTokens * promptTokenCost + completionTokens * completionTokenCost`. | Status: done
- [x] **Default currency** — Default to `'USD'` when currency is not specified. | Status: done

### Adapter Tests

- [ ] **Test OpenAI adapter constructs correct API call** — Verify model, temperature, maxTokens, and response_format are passed correctly. (Mock the OpenAI client.) | Status: not_done
- [ ] **Test OpenAI adapter extracts usage** — Verify token counts are correctly mapped from the API response. | Status: not_done
- [ ] **Test Anthropic adapter constructs correct API call** — Verify system prompt extraction, message format conversion, and parameter passing. (Mock the Anthropic client.) | Status: not_done
- [ ] **Test cost tracker accumulation** — Verify costs accumulate correctly across multiple calls. | Status: not_done
- [ ] **Write tests in `src/__tests__/adapters.test.ts`** — Cover OpenAI and Anthropic adapter tests. | Status: not_done
- [ ] **Write tests in `src/__tests__/cost.test.ts`** — Cover cost calculation and accumulation tests. | Status: not_done

---

## Phase 18: createGenerator Factory

- [ ] **Implement `createGenerator()` factory** — In `src/generator.ts`, accept `GeneratorConfig` and return a `DataGenerator` instance with `generate()`, `validate()`, `deduplicate()`, `export()`, and `config` properties. | Status: not_done
- [ ] **Support per-call overrides** — `generator.generate(count, overrides)` merges overrides with the stored config. | Status: not_done
- [ ] **Expose readonly config** — The `config` property returns a frozen copy of the generator's configuration. | Status: not_done
- [ ] **Export `createGenerator` from `src/index.ts`** — Add to public API. | Status: not_done

---

## Phase 19: CLI Implementation

### CLI Entry Point

- [ ] **Create CLI entry point** — In `src/cli.ts`, implement argument parsing using a lightweight arg parser (or `process.argv` manual parsing). Add `#!/usr/bin/env node` shebang. | Status: not_done
- [ ] **Implement `--version` flag** — Read version from `package.json` and print it. | Status: not_done
- [ ] **Implement `--help` flag** — Print usage information for all commands and options. | Status: not_done
- [ ] **Implement command routing** — Route to `generate`, `validate`, `dedup`, or `export` handler based on the first positional argument. | Status: not_done

### Config File Loading

- [ ] **Implement config file resolution** — Check: (1) `--config` flag path, (2) `.synthdata-gen.json` in cwd, (3) `synthdata-gen` key in `package.json`. | Status: not_done
- [ ] **Implement `SYNTHDATA_GEN_CONFIG` environment variable** — Read config path from env var as fallback. | Status: not_done
- [ ] **Implement configuration precedence** — Merge: built-in defaults < config file < CLI flags. | Status: not_done
- [ ] **Support `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` env vars** — Use for adapter initialization when CLI specifies `--provider openai` or `--provider anthropic`. | Status: not_done
- [ ] **Support `SYNTHDATA_GEN_MODEL` env var** — Override the model name. | Status: not_done

### `generate` Command

- [ ] **Implement `generate` command** — Parse all generation flags (`--count`, `--batch-size`, `--provider`, `--model`, `--temperature`, `--structured-output`, `--topics`, `--balance-field`, `--negative-ratio`, `--max-retries`, `--invalid-handling`, `--dedup`, `--dedup-threshold`, `--dedup-fields`, `--output`, `--format`, `--system-prompt`, `--stats`, `--progress`). | Status: not_done
- [ ] **Initialize LLM adapter from `--provider`** — Create OpenAI or Anthropic adapter based on provider flag and API key env var. | Status: not_done
- [ ] **Read schema from `--schema` flag** — Load JSON Schema from the specified file path. | Status: not_done
- [ ] **Write output to `--output` or stdout** — Write formatted data to file or stdout. | Status: not_done
- [ ] **Print statistics with `--stats`** — Print pipeline statistics table after generation. | Status: not_done
- [ ] **Show progress bar with `--progress`** — Display a text-based progress bar during generation. | Status: not_done
- [ ] **Implement CLI output format** — Match the output examples from Section 16 (schema info, progress bar, statistics table, output confirmation). | Status: not_done

### `validate` Command

- [ ] **Implement `validate` command** — Accept input file (JSON or JSONL), `--schema` path, `--format` (human/json), `--output`. Load data, validate against schema, print results. | Status: not_done
- [ ] **Implement human-readable validation output** — Display valid/invalid counts and per-line error details. | Status: not_done
- [ ] **Implement JSON validation output** — Output `ValidationResult[]` as JSON. | Status: not_done

### `dedup` Command

- [ ] **Implement `dedup` command** — Accept input file, `--strategy`, `--threshold`, `--fields`, `--ngram-size`, `--output`, `--format`, `--report`. Load data, deduplicate, write output. | Status: not_done
- [ ] **Print dedup report with `--report`** — Display input/removed/output counts and top duplicate pairs with similarity scores. | Status: not_done

### `export` Command

- [ ] **Implement `export` command** — Accept input file, `--format`, `--system-prompt`, `--field-map`, `--fields`, `--output`. Load data, export to format, write output. | Status: not_done
- [ ] **Parse `--field-map` as JSON string** — Parse the JSON string into a field mapping object. | Status: not_done

### Exit Codes

- [ ] **Implement exit code 0 for success** — Exit with 0 when command completes successfully. | Status: not_done
- [ ] **Implement exit code 1 for errors** — Exit with 1 for generation failures, validation errors, file not found, or LLM errors. | Status: not_done
- [ ] **Implement exit code 2 for usage errors** — Exit with 2 for invalid flags, missing required arguments, or invalid config. | Status: not_done

### CLI Tests

- [ ] **Test `generate` command end-to-end** — Run CLI with mock config and verify output file and stats. | Status: not_done
- [ ] **Test `validate` command end-to-end** — Run CLI with sample data and schema, verify validation output. | Status: not_done
- [ ] **Test `dedup` command end-to-end** — Run CLI with sample data, verify dedup output and report. | Status: not_done
- [ ] **Test `export` command end-to-end** — Run CLI with sample data, verify format conversion. | Status: not_done
- [ ] **Test config file loading** — Verify config is loaded from `.synthdata-gen.json` and `--config` flag. | Status: not_done
- [ ] **Test CLI flag overrides config file** — Verify CLI flags take precedence over config file values. | Status: not_done
- [ ] **Test exit codes** — Verify correct exit codes for success, errors, and usage errors. | Status: not_done
- [ ] **Test `--help` and `--version` flags** — Verify help text and version output. | Status: not_done
- [ ] **Write tests in `src/__tests__/cli.test.ts`** — Cover all CLI integration tests. | Status: not_done

---

## Phase 20: Structured Output Mode

- [x] **Implement structured output flag passthrough** — When `structuredOutput: true`, set `jsonMode: true` in `LlmCallOptions`. | Status: done
- [ ] **Skip JSON extraction in structured mode** — When structured output is enabled, parse the entire response as JSON without scanning for JSON fragments. | Status: not_done

---

## Phase 21: Integration with Ecosystem Packages

- [ ] **Document `eval-dataset` integration** — Ensure `exportData(data, 'eval-dataset')` produces output compatible with `eval-dataset`'s `TestCase` schema. Test with realistic field mapping. | Status: not_done
- [ ] **Document `synth-personas` integration** — Ensure `diversity.personas` accepts objects from `synth-personas` and formats them into effective prompt instructions. | Status: not_done
- [ ] **Document `llm-retry` integration** — Ensure an `llm-retry`-wrapped function works as the `llm` parameter for `generate()`. | Status: not_done
- [ ] **Document `prompt-snap` integration** — Ensure `createGenerator().buildPrompt()` (if exposed) returns a snapshot-testable prompt. | Status: not_done

---

## Phase 22: Property-Based and Edge Case Tests

- [ ] **Property test: schema conformance** — For any valid mock LLM output matching the schema, `generate()` never returns data that fails schema validation. | Status: not_done
- [ ] **Property test: dedup idempotence** — `deduplicate(deduplicate(data))` always equals `deduplicate(data)`. | Status: not_done
- [ ] **Property test: export-parse round-trip** — For JSONL and Alpaca formats, `parse(export(data))` equals `data`. | Status: not_done
- [ ] **Property test: count guarantee** — `generateBatch(schema, n).data.length <= n`. Never more than requested. | Status: not_done
- [ ] **Edge case: empty seed array** — Verify `generate()` works with no seeds provided. | Status: not_done
- [x] **Edge case: single example generation (count: 1)** — Verify pipeline works for generating a single example. | Status: done
- [ ] **Edge case: LLM returns empty string** — Verify pipeline handles empty LLM response gracefully. | Status: not_done
- [ ] **Edge case: LLM returns only markdown text** — Verify pipeline detects no JSON and retries. | Status: not_done
- [ ] **Edge case: all generated examples are duplicates** — Verify pipeline continues generating until unique examples are found or max iterations reached. | Status: not_done
- [ ] **Edge case: all generated examples fail validation** — Verify pipeline exhausts retry budget and returns empty result with correct stats. | Status: not_done
- [ ] **Edge case: schema with no required fields** — Verify prompt generation and validation work for fully optional schemas. | Status: not_done
- [ ] **Edge case: schema with deeply nested objects** — Verify prompt generation and validation handle 3+ levels of nesting. | Status: not_done
- [ ] **Edge case: CSV export with fields containing delimiters** — Verify correct escaping for commas, quotes, and newlines. | Status: not_done
- [ ] **Edge case: very large batchSize** — Verify pipeline handles requesting many examples per call (e.g., 50). | Status: not_done

---

## Phase 23: Performance Verification

- [ ] **Benchmark validation speed** — Verify < 0.1ms per example for Zod `.safeParse()`. | Status: not_done
- [ ] **Benchmark exact dedup speed (1,000 examples)** — Verify < 10ms. | Status: not_done
- [ ] **Benchmark near-dedup speed with MinHash LSH (1,000 examples)** — Verify < 500ms. | Status: not_done
- [ ] **Benchmark near-dedup speed with MinHash LSH (10,000 examples)** — Verify < 5 seconds. | Status: not_done
- [ ] **Benchmark export formatting speed (1,000 examples)** — Verify < 50ms for all formats. | Status: not_done
- [ ] **Verify pipeline overhead per example** — Confirm < 5ms overhead per example for parsing, validation, and dedup tracking (excluding LLM latency). | Status: not_done

---

## Phase 24: Documentation

- [ ] **Write README.md** — Include: package overview, installation (`npm install synthdata-gen`), quick start with code example, API reference for `generate`, `generateBatch`, `validate`, `deduplicate`, `exportData`, `createGenerator`, `createOpenAIAdapter`, `createAnthropicAdapter`. | Status: not_done
- [ ] **Document CLI usage in README** — Cover all four commands (`generate`, `validate`, `dedup`, `export`) with flag descriptions and usage examples. | Status: not_done
- [ ] **Document schema definition** — Explain both Zod schema and JSON Schema approaches with examples. | Status: not_done
- [ ] **Document diversity strategies** — Explain each strategy (temperature, topic, category, seed, persona, negative, constraint) with configuration examples. | Status: not_done
- [ ] **Document export formats** — Explain each format (OpenAI, Alpaca, ShareGPT, JSONL, CSV, eval-dataset, custom) with output examples. | Status: not_done
- [ ] **Document configuration file format** — Show a complete `.synthdata-gen.json` example with all options. | Status: not_done
- [ ] **Document environment variables** — List `SYNTHDATA_GEN_CONFIG`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SYNTHDATA_GEN_MODEL`. | Status: not_done
- [ ] **Document integration patterns** — Show integration with `eval-dataset`, `synth-personas`, `llm-retry`, and `prompt-snap`. | Status: not_done
- [ ] **Add JSDoc comments to all public functions and types** — Ensure every exported function and type has comprehensive JSDoc documentation. | Status: not_done

---

## Phase 25: Final Polish and Publishing

- [ ] **Verify all tests pass** — Run `npm run test` and confirm 100% pass rate. | Status: not_done
- [ ] **Verify lint passes** — Run `npm run lint` with no errors or warnings. | Status: not_done
- [ ] **Verify build succeeds** — Run `npm run build` and confirm `dist/` output is correct. | Status: not_done
- [ ] **Verify TypeScript declarations** — Confirm `.d.ts` files are generated and export all public types. | Status: not_done
- [ ] **Verify CLI binary works** — Run `npx synthdata-gen --version` and `npx synthdata-gen --help` from the built package. | Status: not_done
- [ ] **Bump version in `package.json`** — Set appropriate version for initial release. | Status: not_done
- [ ] **Verify `package.json` metadata** — Confirm `name`, `description`, `main`, `types`, `bin`, `files`, `keywords`, `license`, `engines`, `peerDependencies`, and `publishConfig` are all correct. | Status: not_done
- [ ] **Publish to npm** — Run `npm publish` from master after PR merge. | Status: not_done
