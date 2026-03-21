import type {
  ExampleSchema,
  SchemaField,
  ValidationResult,
  ValidationError,
  ValidationConfig,
  HeuristicsConfig,
} from './types';

const PLACEHOLDER_PATTERNS = [
  /^lorem ipsum/i,
  /^example text/i,
  /^todo$/i,
  /^\[insert here\]$/i,
  /^placeholder/i,
  /^sample text/i,
  /^test\s*$/i,
  /^xxx+$/i,
  /^\.{3,}$/,
  /^n\/a$/i,
  /^tbd$/i,
];

/**
 * Validate a single field value against its schema definition.
 */
function validateField(
  value: unknown,
  field: SchemaField,
  path: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    if (field.required !== false && field.default === undefined) {
      errors.push({
        path,
        message: `Required field is missing`,
        code: 'required',
      });
    }
    return errors;
  }

  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') {
        errors.push({
          path,
          message: `Expected string, received ${typeof value}`,
          code: 'invalid_type',
        });
        break;
      }
      if (field.min !== undefined && value.length < field.min) {
        errors.push({
          path,
          message: `String must contain at least ${field.min} character(s), received ${value.length}`,
          code: 'too_small',
        });
      }
      if (field.max !== undefined && value.length > field.max) {
        errors.push({
          path,
          message: `String must contain at most ${field.max} character(s), received ${value.length}`,
          code: 'too_big',
        });
      }
      if (field.pattern !== undefined) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(value)) {
          errors.push({
            path,
            message: `String does not match pattern: ${field.pattern}`,
            code: 'invalid_string',
          });
        }
      }
      break;
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number') {
        errors.push({
          path,
          message: `Expected number, received ${typeof value}`,
          code: 'invalid_type',
        });
        break;
      }
      if (field.type === 'integer' && !Number.isInteger(value)) {
        errors.push({
          path,
          message: `Expected integer, received float`,
          code: 'invalid_type',
        });
      }
      if (field.min !== undefined && value < field.min) {
        errors.push({
          path,
          message: `Number must be >= ${field.min}, received ${value}`,
          code: 'too_small',
        });
      }
      if (field.max !== undefined && value > field.max) {
        errors.push({
          path,
          message: `Number must be <= ${field.max}, received ${value}`,
          code: 'too_big',
        });
      }
      break;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        errors.push({
          path,
          message: `Expected boolean, received ${typeof value}`,
          code: 'invalid_type',
        });
      }
      break;
    }
    case 'enum': {
      if (!field.enum || !field.enum.includes(String(value))) {
        errors.push({
          path,
          message: `Invalid enum value. Expected one of [${(field.enum || []).map(v => `"${v}"`).join(', ')}], received "${value}"`,
          code: 'invalid_enum_value',
        });
      }
      break;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push({
          path,
          message: `Expected array, received ${typeof value}`,
          code: 'invalid_type',
        });
        break;
      }
      if (field.min !== undefined && value.length < field.min) {
        errors.push({
          path,
          message: `Array must contain at least ${field.min} item(s), received ${value.length}`,
          code: 'too_small',
        });
      }
      if (field.max !== undefined && value.length > field.max) {
        errors.push({
          path,
          message: `Array must contain at most ${field.max} item(s), received ${value.length}`,
          code: 'too_big',
        });
      }
      if (field.items) {
        for (let i = 0; i < value.length; i++) {
          errors.push(...validateField(value[i], field.items, [...path, String(i)]));
        }
      }
      break;
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({
          path,
          message: `Expected object, received ${Array.isArray(value) ? 'array' : typeof value}`,
          code: 'invalid_type',
        });
        break;
      }
      if (field.properties) {
        const obj = value as Record<string, unknown>;
        const requiredFields = field.requiredFields || Object.keys(field.properties);
        for (const [key, propField] of Object.entries(field.properties)) {
          const isRequired = requiredFields.includes(key);
          const effectiveField = { ...propField, required: isRequired ? (propField.required !== false) : false };
          errors.push(...validateField(obj[key], effectiveField, [...path, key]));
        }
      }
      break;
    }
  }

  return errors;
}

/**
 * Run heuristic quality checks on an example.
 */
function runHeuristics(
  example: Record<string, unknown>,
  schema: ExampleSchema,
  heuristics: HeuristicsConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (heuristics.nonEmpty !== false) {
    for (const [key, field] of Object.entries(schema.fields)) {
      if (field.type === 'string' && field.required !== false) {
        const val = example[key];
        if (typeof val === 'string' && val.trim().length === 0) {
          errors.push({
            path: [key],
            message: `Field must not be empty or whitespace-only`,
            code: 'heuristic_non_empty',
          });
        }
      }
    }
  }

  if (heuristics.noPlaceholder) {
    for (const [key, field] of Object.entries(schema.fields)) {
      if (field.type === 'string') {
        const val = example[key];
        if (typeof val === 'string') {
          for (const pattern of PLACEHOLDER_PATTERNS) {
            if (pattern.test(val.trim())) {
              errors.push({
                path: [key],
                message: `Field contains placeholder text`,
                code: 'heuristic_placeholder',
              });
              break;
            }
          }
        }
      }
    }
  }

  if (heuristics.noDuplicateFields) {
    const config = heuristics.noDuplicateFields;
    const pairs: [string, string][] =
      typeof config === 'object' && 'pairs' in config
        ? config.pairs
        : inferFieldPairs(schema);

    for (const [fieldA, fieldB] of pairs) {
      const valA = example[fieldA];
      const valB = example[fieldB];
      if (
        typeof valA === 'string' &&
        typeof valB === 'string' &&
        valA.trim().length > 0 &&
        valA.trim().toLowerCase() === valB.trim().toLowerCase()
      ) {
        errors.push({
          path: [fieldA, fieldB],
          message: `Fields "${fieldA}" and "${fieldB}" should not be identical`,
          code: 'heuristic_duplicate_fields',
        });
      }
    }
  }

  if (heuristics.minWordCount) {
    const config = heuristics.minWordCount;
    const fields: string[] =
      typeof config === 'object' && 'fields' in config
        ? config.fields
        : Object.entries(schema.fields)
            .filter(([_, f]) => f.type === 'string')
            .map(([k]) => k);
    const minWords =
      typeof config === 'object' && 'min' in config ? config.min : 3;

    for (const key of fields) {
      const val = example[key];
      if (typeof val === 'string') {
        const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount < minWords) {
          errors.push({
            path: [key],
            message: `Field must contain at least ${minWords} word(s), received ${wordCount}`,
            code: 'heuristic_min_words',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Infer field pairs for duplicate field checking.
 * Pairs up string fields that seem like input/output pairs.
 */
function inferFieldPairs(schema: ExampleSchema): [string, string][] {
  const stringFields = Object.entries(schema.fields)
    .filter(([_, f]) => f.type === 'string')
    .map(([k]) => k);

  if (stringFields.length < 2) return [];

  const knownPairs: [string, string][] = [
    ['question', 'answer'],
    ['instruction', 'output'],
    ['input', 'output'],
    ['prompt', 'response'],
    ['query', 'response'],
  ];

  const result: [string, string][] = [];
  for (const [a, b] of knownPairs) {
    if (stringFields.includes(a) && stringFields.includes(b)) {
      result.push([a, b]);
    }
  }
  return result;
}

/**
 * Run global field-length validation.
 */
function validateFieldLengths(
  example: Record<string, unknown>,
  schema: ExampleSchema,
  config: ValidationConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [key, field] of Object.entries(schema.fields)) {
    if (field.type === 'string') {
      const val = example[key];
      if (typeof val === 'string') {
        if (config.minFieldLength !== undefined && val.length < config.minFieldLength) {
          errors.push({
            path: [key],
            message: `String field must be at least ${config.minFieldLength} character(s), received ${val.length}`,
            code: 'global_min_length',
          });
        }
        if (config.maxFieldLength !== undefined && val.length > config.maxFieldLength) {
          errors.push({
            path: [key],
            message: `String field must be at most ${config.maxFieldLength} character(s), received ${val.length}`,
            code: 'global_max_length',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a single example against a schema.
 */
export function validateExample(
  example: Record<string, unknown>,
  schema: ExampleSchema,
  config?: ValidationConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const requiredFields = schema.required || Object.keys(schema.fields);

  // Schema field validation
  for (const [key, field] of Object.entries(schema.fields)) {
    const isRequired = requiredFields.includes(key);
    const effectiveField = { ...field, required: isRequired ? (field.required !== false) : false };
    errors.push(...validateField(example[key], effectiveField, [key]));
  }

  // Global field-length constraints
  if (config && (config.minFieldLength !== undefined || config.maxFieldLength !== undefined)) {
    errors.push(...validateFieldLengths(example, schema, config));
  }

  // Quality heuristics
  if (config?.heuristics) {
    errors.push(...runHeuristics(example, schema, config.heuristics));
  }

  // Custom validators
  if (config?.custom) {
    for (const validator of config.custom) {
      const result = validator.validate(example);
      if (!result.valid) {
        errors.push({
          path: [],
          message: result.message || `Custom validator "${validator.name}" failed`,
          code: `custom_${validator.name}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate an array of examples against a schema.
 * Returns a ValidationResult for each example.
 */
export function validate(
  examples: Record<string, unknown>[],
  schema: ExampleSchema,
  config?: ValidationConfig,
): ValidationResult[] {
  return examples.map((example, index) => {
    const errors = validateExample(example, schema, config);
    return {
      valid: errors.length === 0,
      index,
      errors,
    };
  });
}
