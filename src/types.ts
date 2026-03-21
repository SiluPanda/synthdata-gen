// ── LLM Interface Types ────────────────────────────────────────────

/** A message in an LLM conversation. */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Options passed to an LLM call. */
export interface LlmCallOptions {
  /** Temperature for this call. Overrides default. */
  temperature?: number;
  /** Maximum completion tokens. */
  maxTokens?: number;
  /** Request structured JSON output (if provider supports it). */
  jsonMode?: boolean;
}

/** Response from an LLM call. */
export interface LlmResponse {
  /** The generated text. */
  content: string;
  /** Token usage, if available. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** An async function that calls an LLM. */
export type LlmFunction = (
  messages: Message[],
  options?: LlmCallOptions,
) => Promise<LlmResponse>;

// ── Schema Types ───────────────────────────────────────────────────

/** Field type in an ExampleSchema. */
export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'array' | 'object';

/** A single field definition in the schema. */
export interface SchemaField {
  /** The type of this field. */
  type: FieldType;
  /** Human-readable description. */
  description?: string;
  /** Whether this field is required. Default: true. */
  required?: boolean;
  /** Minimum string length or numeric value. */
  min?: number;
  /** Maximum string length or numeric value. */
  max?: number;
  /** Valid enum values (for enum type). */
  enum?: string[];
  /** Default value. */
  default?: unknown;
  /** Regex pattern (for string type). */
  pattern?: string;
  /** For arrays: the element field definition. */
  items?: SchemaField;
  /** For objects: nested properties. */
  properties?: Record<string, SchemaField>;
  /** For objects: list of required property names. */
  requiredFields?: string[];
}

/** Schema defining the shape of generated examples. */
export interface ExampleSchema {
  /** The fields of each example. */
  fields: Record<string, SchemaField>;
  /** Top-level required field names. Defaults to all fields. */
  required?: string[];
}

// ── Generation Types ───────────────────────────────────────────────

/** A generated example. The shape matches the user-defined schema, plus optional metadata. */
export type GeneratedExample<T = Record<string, unknown>> = T & {
  _meta?: {
    id: string;
    index: number;
    isNegative?: boolean;
    repaired?: boolean;
    batchIndex: number;
    diversityContext?: {
      topic?: string;
      temperature?: number;
      persona?: string;
      constraint?: string;
    };
  };
};

/** Diversity strategy configuration. */
export interface DiversityConfig {
  temperature?: {
    min: number;
    max: number;
    strategy: 'linear' | 'cycle' | 'random';
  };
  topics?: string[];
  balanceField?: string;
  seedRotation?: 'sequential' | 'random' | 'all';
  seedsPerBatch?: number;
  negativeExampleRatio?: number;
  negativeInstructions?: string;
  constraintVariation?: Array<{ instruction: string }>;
}

/** Validation heuristics configuration. */
export interface HeuristicsConfig {
  nonEmpty?: boolean;
  noPlaceholder?: boolean;
  noDuplicateFields?: { pairs: [string, string][] } | boolean;
  minWordCount?: { fields: string[]; min: number } | boolean;
}

/** Custom validator function. */
export interface CustomValidator {
  name: string;
  validate: (example: Record<string, unknown>) => { valid: boolean; message?: string };
}

/** Validation configuration. */
export interface ValidationConfig {
  minFieldLength?: number;
  maxFieldLength?: number;
  heuristics?: HeuristicsConfig;
  custom?: CustomValidator[];
}

/** Retry configuration. */
export interface RetryConfig {
  maxRetries?: number;
  includeFeedback?: boolean;
  backoff?: 'none' | 'linear' | 'exponential';
  backoffMs?: number;
}

/** Cost tracking configuration. */
export interface CostConfig {
  promptTokenCost?: number;
  completionTokenCost?: number;
  currency?: string;
}

/** Deduplication configuration. */
export interface DedupOptions {
  strategy: 'exact' | 'near' | 'semantic' | 'none';
  threshold?: number;
  ngramSize?: number;
  fields?: string[];
  embedder?: (text: string) => Promise<number[]>;
  existingData?: Record<string, unknown>[];
  minhash?: {
    numHashes: number;
    numBands: number;
  };
}

/** Options for generate(). */
export interface GenerateOptions {
  /** The LLM function to call. If not provided, the template-based generator is used. */
  llm?: LlmFunction;
  /** Number of examples to generate. */
  count: number;
  /** Number of examples per LLM call. Default: 1. */
  batchSize?: number;
  /** Custom system prompt. */
  systemPrompt?: string;
  /** Additional instructions appended to the system prompt. */
  additionalInstructions?: string;
  /** Seed examples for few-shot prompting. */
  seeds?: Record<string, unknown>[];
  /** Diversity strategy configuration. */
  diversity?: DiversityConfig;
  /** Validation configuration. */
  validation?: ValidationConfig;
  /** Retry configuration. */
  retry?: RetryConfig;
  /** Deduplication configuration. */
  dedup?: DedupOptions;
  /** How to handle invalid examples. */
  invalidHandling?: 'discard' | 'log' | 'repair';
  /** Whether to request structured JSON output from the LLM. */
  structuredOutput?: boolean;
  /** Cost tracking configuration. */
  costTracking?: CostConfig;
  /** Export format. */
  format?: ExportFormat;
  /** Callback for generation function (overrides default template generator). */
  generateFn?: (schema: ExampleSchema, batchIndex: number) => Record<string, unknown>[];
}

/** Supported export formats. */
export type ExportFormat = 'openai' | 'alpaca' | 'sharegpt' | 'csv' | 'jsonl';

/** Export options. */
export interface ExportOptions {
  /** Field mapping overrides. */
  fieldMap?: Record<string, string>;
  /** Static system prompt (for openai/sharegpt formats). */
  systemPrompt?: string;
  /** CSV delimiter. */
  delimiter?: string;
  /** CSV quote character. */
  quote?: string;
  /** Include CSV header row. */
  header?: boolean;
  /** Subset of fields to include. */
  fields?: string[];
}

// ── Result Types ───────────────────────────────────────────────────

/** Result of a generation run. */
export interface GenerateResult {
  /** The final clean, validated, deduplicated examples. */
  data: GeneratedExample[];
  /** Pipeline statistics. */
  stats: GenerationStats;
  /** Exported string, if format was specified. */
  exported?: string;
}

/** Pipeline statistics. */
export interface GenerationStats {
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
  /** Wall-clock time in milliseconds. */
  durationMs: number;
}

/** Result of validating a single example. */
export interface ValidationResult {
  valid: boolean;
  index: number;
  errors: ValidationError[];
}

/** A single validation error. */
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

/** Result of deduplication. */
export interface DedupResult {
  data: Record<string, unknown>[];
  removed: number;
  pairs: Array<[number, number, number]>;
}
