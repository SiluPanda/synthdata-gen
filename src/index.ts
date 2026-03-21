// synthdata-gen - Generate and validate synthetic training data using any LLM

// Core pipeline
export { generate } from './pipeline';

// Standalone utilities
export { validate, validateExample } from './validator';
export { deduplicate } from './dedup';
export { exportAs } from './export/index';

// Generator utilities
export {
  generateExample,
  generateExamples,
  buildSchemaPrompt,
  buildSystemPrompt,
  parseJsonResponse,
} from './generator';

// Individual exporters
export { exportOpenAI } from './export/openai';
export { exportAlpaca } from './export/alpaca';
export { exportShareGPT } from './export/sharegpt';
export { exportCSV } from './export/csv';
export { exportJSONL } from './export/jsonl';

// Types
export type {
  // LLM types
  Message,
  LlmCallOptions,
  LlmResponse,
  LlmFunction,
  // Schema types
  FieldType,
  SchemaField,
  ExampleSchema,
  // Generation types
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
  // Result types
  GenerateResult,
  GenerationStats,
  ValidationResult,
  ValidationError,
  DedupResult,
} from './types';
