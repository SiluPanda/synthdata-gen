import type { ExampleSchema, SchemaField } from './types';

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Provides deterministic randomness for reproducible generation.
 */
export class SeededRandom {
  private state: number;

  constructor(seed?: number) {
    this.state = seed ?? Math.floor(Math.random() * 2147483647);
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random float in [min, max). */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick a random element from an array. */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Pick n random unique elements from an array. */
  sample<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = this.int(0, copy.length - 1);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }
}

// Word pools for generating realistic-looking text
const WORDS = [
  'the', 'a', 'an', 'this', 'that', 'these', 'with', 'from', 'into',
  'during', 'including', 'until', 'against', 'among', 'throughout', 'despite',
  'towards', 'upon', 'about', 'of', 'at', 'by', 'for', 'in', 'to',
  'data', 'system', 'process', 'model', 'algorithm', 'function', 'method',
  'approach', 'technique', 'framework', 'structure', 'pattern', 'design',
  'implementation', 'analysis', 'solution', 'result', 'performance', 'quality',
  'can', 'may', 'will', 'should', 'would', 'could', 'provide', 'create',
  'develop', 'build', 'implement', 'analyze', 'evaluate', 'optimize',
  'improve', 'enhance', 'support', 'enable', 'manage', 'handle', 'generate',
  'transform', 'convert', 'validate', 'process', 'compute', 'calculate',
  'efficient', 'effective', 'robust', 'scalable', 'flexible', 'reliable',
  'secure', 'accurate', 'consistent', 'comprehensive', 'automated', 'dynamic',
  'advanced', 'integrated', 'distributed', 'modular', 'configurable', 'custom',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'not', 'and', 'or', 'but', 'if', 'when', 'while',
  'how', 'what', 'which', 'where', 'who', 'why', 'each', 'every', 'all',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'same',
  'application', 'service', 'component', 'module', 'interface', 'layer',
  'pipeline', 'workflow', 'configuration', 'parameter', 'variable', 'value',
  'input', 'output', 'request', 'response', 'error', 'exception', 'state',
  'event', 'action', 'task', 'operation', 'resource', 'network', 'database',
  'user', 'client', 'server', 'platform', 'environment', 'deployment',
  'testing', 'monitoring', 'logging', 'security', 'authentication', 'access',
];

const SENTENCE_TEMPLATES = [
  'The {noun} {verb} the {adj} {noun} using {noun}.',
  'A {adj} {noun} can {verb} multiple {noun} efficiently.',
  'This {noun} {verb} {adj} {noun} through {noun}.',
  'When {verb}ing {noun}, the {noun} must handle {adj} {noun}.',
  'The {adj} {noun} provides {adj} {noun} for {noun}.',
  'To {verb} {noun}, use the {adj} {noun} {noun}.',
  'Each {noun} {verb} a {adj} set of {noun}.',
  'The {noun} {verb} {adj} {noun} from the {noun}.',
];

const NOUNS = [
  'system', 'data', 'model', 'process', 'algorithm', 'function', 'method',
  'approach', 'structure', 'pattern', 'framework', 'component', 'service',
  'module', 'pipeline', 'workflow', 'configuration', 'parameter', 'interface',
  'application', 'resource', 'network', 'database', 'user', 'platform',
  'operation', 'request', 'response', 'result', 'performance', 'solution',
];

const VERBS = [
  'processes', 'generates', 'validates', 'transforms', 'analyzes',
  'evaluates', 'optimizes', 'creates', 'manages', 'handles',
  'supports', 'enables', 'implements', 'provides', 'computes',
];

const ADJECTIVES = [
  'efficient', 'robust', 'scalable', 'flexible', 'reliable', 'accurate',
  'advanced', 'dynamic', 'integrated', 'modular', 'automated', 'custom',
  'comprehensive', 'distributed', 'configurable', 'secure', 'consistent',
];

/**
 * Generate a random sentence from templates.
 */
function generateSentence(rng: SeededRandom): string {
  const template = rng.pick(SENTENCE_TEMPLATES);
  return template
    .replace(/\{noun\}/g, () => rng.pick(NOUNS))
    .replace(/\{verb\}/g, () => rng.pick(VERBS))
    .replace(/\{adj\}/g, () => rng.pick(ADJECTIVES));
}

/**
 * Generate a random string of approximately the given length.
 */
function generateString(rng: SeededRandom, minLen: number, maxLen: number): string {
  const targetLen = rng.int(minLen, maxLen);
  const sentences: string[] = [];
  let totalLen = 0;

  while (totalLen < targetLen) {
    const sentence = generateSentence(rng);
    sentences.push(sentence);
    totalLen += sentence.length + 1;
  }

  const result = sentences.join(' ');

  // Trim to max length at a word boundary
  if (result.length > maxLen) {
    const trimmed = result.slice(0, maxLen);
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace > minLen) {
      return trimmed.slice(0, lastSpace);
    }
    return trimmed.slice(0, maxLen);
  }

  // Pad if too short
  if (result.length < minLen) {
    const padding: string[] = [];
    let padLen = result.length;
    while (padLen < minLen) {
      const word = rng.pick(WORDS);
      padding.push(word);
      padLen += word.length + 1;
    }
    return (result + ' ' + padding.join(' ')).slice(0, maxLen);
  }

  return result;
}

/**
 * Generate a random value for a single schema field.
 */
function generateFieldValue(
  field: SchemaField,
  rng: SeededRandom,
): unknown {
  // If a default is specified and RNG decides to use it (10% chance)
  if (field.default !== undefined && rng.next() < 0.1) {
    return field.default;
  }

  switch (field.type) {
    case 'string': {
      const minLen = field.min ?? 5;
      const maxLen = field.max ?? Math.max(minLen + 50, 100);
      return generateString(rng, minLen, maxLen);
    }
    case 'number': {
      const min = field.min ?? 0;
      const max = field.max ?? 1000;
      return Math.round(rng.float(min, max) * 100) / 100;
    }
    case 'integer': {
      const min = field.min ?? 0;
      const max = field.max ?? 1000;
      return rng.int(min, max);
    }
    case 'boolean': {
      return rng.next() > 0.5;
    }
    case 'enum': {
      if (field.enum && field.enum.length > 0) {
        return rng.pick(field.enum);
      }
      return 'unknown';
    }
    case 'array': {
      const minItems = field.min ?? 1;
      const maxItems = field.max ?? 5;
      const count = rng.int(minItems, maxItems);
      const items: unknown[] = [];
      if (field.items) {
        for (let i = 0; i < count; i++) {
          items.push(generateFieldValue(field.items, rng));
        }
      }
      return items;
    }
    case 'object': {
      if (field.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propField] of Object.entries(field.properties)) {
          if (propField.required === false && rng.next() < 0.3) {
            continue; // Skip optional field 30% of the time
          }
          obj[key] = generateFieldValue(propField, rng);
        }
        return obj;
      }
      return {};
    }
    default:
      return null;
  }
}

/**
 * Generate a single example from a schema using template-based generation.
 */
export function generateExample(
  schema: ExampleSchema,
  seed?: number,
): Record<string, unknown> {
  const rng = new SeededRandom(seed);
  const example: Record<string, unknown> = {};
  const requiredFields = schema.required || Object.keys(schema.fields);

  for (const [key, field] of Object.entries(schema.fields)) {
    const isRequired = requiredFields.includes(key);

    // Skip optional fields 20% of the time
    if (!isRequired && field.required === false && rng.next() < 0.2) {
      if (field.default !== undefined) {
        example[key] = field.default;
      }
      continue;
    }

    example[key] = generateFieldValue(field, rng);
  }

  return example;
}

/**
 * Generate multiple examples from a schema.
 */
export function generateExamples(
  schema: ExampleSchema,
  count: number,
  baseSeed?: number,
): Record<string, unknown>[] {
  const examples: Record<string, unknown>[] = [];
  const base = baseSeed ?? Math.floor(Math.random() * 2147483647);

  for (let i = 0; i < count; i++) {
    examples.push(generateExample(schema, base + i));
  }

  return examples;
}

/**
 * Build a prompt describing the schema for LLM generation.
 */
export function buildSchemaPrompt(schema: ExampleSchema): string {
  const lines: string[] = ['Generate a JSON object with the following structure:', '{'];
  const requiredFields = schema.required || Object.keys(schema.fields);

  const fieldEntries = Object.entries(schema.fields);
  for (let i = 0; i < fieldEntries.length; i++) {
    const [key, field] = fieldEntries[i];
    const isRequired = requiredFields.includes(key);
    const line = buildFieldDescription(key, field, isRequired, '  ');
    const comma = i < fieldEntries.length - 1 ? ',' : '';
    lines.push(`${line}${comma}`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Build a description of a single field for prompt inclusion.
 */
function buildFieldDescription(
  name: string,
  field: SchemaField,
  isRequired: boolean,
  indent: string,
): string {
  const parts: string[] = [];

  switch (field.type) {
    case 'string': {
      let typeDesc = 'string';
      const constraints: string[] = [];
      if (!isRequired) constraints.push('optional');
      if (field.min !== undefined && field.max !== undefined) {
        constraints.push(`${field.min}-${field.max} characters`);
      } else if (field.min !== undefined) {
        constraints.push(`min ${field.min} characters`);
      } else if (field.max !== undefined) {
        constraints.push(`max ${field.max} characters`);
      }
      if (field.pattern) constraints.push(`pattern: ${field.pattern}`);
      if (constraints.length > 0) typeDesc += ` (${constraints.join(', ')})`;
      if (field.description) typeDesc += ` - ${field.description}`;
      parts.push(`${indent}"${name}": ${typeDesc}`);
      break;
    }
    case 'number':
    case 'integer': {
      let typeDesc = field.type;
      const constraints: string[] = [];
      if (!isRequired) constraints.push('optional');
      if (field.min !== undefined) constraints.push(`min ${field.min}`);
      if (field.max !== undefined) constraints.push(`max ${field.max}`);
      if (constraints.length > 0) typeDesc += ` (${constraints.join(', ')})`;
      if (field.description) typeDesc += ` - ${field.description}`;
      parts.push(`${indent}"${name}": ${typeDesc}`);
      break;
    }
    case 'boolean': {
      let typeDesc = 'boolean';
      if (!isRequired) typeDesc += ' (optional)';
      if (field.description) typeDesc += ` - ${field.description}`;
      parts.push(`${indent}"${name}": ${typeDesc}`);
      break;
    }
    case 'enum': {
      const values = (field.enum || []).map(v => `"${v}"`).join(', ');
      let typeDesc = `one of [${values}]`;
      if (!isRequired) typeDesc += ' (optional)';
      if (field.description) typeDesc += ` - ${field.description}`;
      parts.push(`${indent}"${name}": ${typeDesc}`);
      break;
    }
    case 'array': {
      let typeDesc = 'array';
      if (field.items) {
        typeDesc = `array of ${field.items.type}`;
      }
      const constraints: string[] = [];
      if (!isRequired) constraints.push('optional');
      if (field.min !== undefined) constraints.push(`min ${field.min} items`);
      if (field.max !== undefined) constraints.push(`max ${field.max} items`);
      if (constraints.length > 0) typeDesc += ` (${constraints.join(', ')})`;
      if (field.description) typeDesc += ` - ${field.description}`;
      parts.push(`${indent}"${name}": ${typeDesc}`);
      break;
    }
    case 'object': {
      let typeDesc = 'object';
      if (!isRequired) typeDesc += ' (optional)';
      if (field.description) typeDesc += ` - ${field.description}`;
      parts.push(`${indent}"${name}": ${typeDesc}`);
      break;
    }
  }

  return parts.join('');
}

/**
 * Build the system prompt for LLM-based generation.
 */
export function buildSystemPrompt(
  schema: ExampleSchema,
  customPrompt?: string,
  additionalInstructions?: string,
): string {
  const schemaDescription = buildSchemaPrompt(schema);

  if (customPrompt) {
    return customPrompt.replace('{schema_description}', schemaDescription);
  }

  let prompt = `You are a synthetic training data generator. Your task is to generate high-quality training examples that match the specified schema exactly.

Rules:
1. Output ONLY a valid JSON object (or JSON array if multiple examples are requested).
2. Do not include any explanation, commentary, or markdown formatting.
3. Every field must conform to the specified type and constraints.
4. Generate diverse, realistic, and substantive content -- not placeholder text.
5. Each example should be independent and self-contained.

${schemaDescription}`;

  if (additionalInstructions) {
    prompt += `\n\n${additionalInstructions}`;
  }

  return prompt;
}

/**
 * Parse JSON from an LLM response, handling markdown fences and explanatory text.
 */
export function parseJsonResponse(text: string): unknown[] {
  const results: unknown[] = [];

  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) {
      results.push(...parsed);
    } else {
      results.push(parsed);
    }
    return results;
  } catch {
    // Continue with extraction
  }

  // Try extracting from markdown code fences
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // Skip unparseable blocks
    }
  }
  if (results.length > 0) return results;

  // Try extracting JSON objects/arrays from the text
  const jsonRegex = /[\[{][\s\S]*?[}\]]/g;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
      // Only accept the first successful parse from regex matching
      break;
    } catch {
      // Continue searching
    }
  }

  return results;
}
