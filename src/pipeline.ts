import type {
  ExampleSchema,
  GenerateOptions,
  GenerateResult,
  GeneratedExample,
  GenerationStats,
  ValidationError,
} from './types';
import { validateExample } from './validator';
import { deduplicate } from './dedup';
import { generateExamples, buildSystemPrompt, parseJsonResponse } from './generator';
import { exportAs } from './export/index';

/**
 * Create initial empty stats object.
 */
function createEmptyStats(): GenerationStats {
  return {
    total: 0,
    valid: 0,
    invalid: 0,
    deduped: 0,
    final: 0,
    llmCalls: 0,
    tokens: { prompt: 0, completion: 0, total: 0 },
    cost: { promptTokens: 0, completionTokens: 0, totalCost: 0, currency: 'USD' },
    validationErrors: [],
    invalidExamples: [],
    durationMs: 0,
  };
}

/**
 * Track a validation error in the stats accumulator.
 */
function trackValidationError(
  stats: GenerationStats,
  errors: ValidationError[],
): void {
  for (const err of errors) {
    const existing = stats.validationErrors.find(
      e => e.path.join('.') === err.path.join('.') && e.message === err.message,
    );
    if (existing) {
      existing.count++;
    } else {
      stats.validationErrors.push({
        path: err.path,
        message: err.message,
        count: 1,
      });
    }
  }
}

/**
 * Generate examples using the LLM function.
 */
async function generateWithLlm(
  schema: ExampleSchema,
  options: GenerateOptions,
  batchIndex: number,
  batchSize: number,
): Promise<{ examples: Record<string, unknown>[]; stats: Partial<GenerationStats> }> {
  if (!options.llm) {
    throw new Error('LLM function is required for LLM-based generation');
  }

  const systemPrompt = buildSystemPrompt(
    schema,
    options.systemPrompt,
    options.additionalInstructions,
  );

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add seed examples as few-shot
  if (options.seeds) {
    for (const seed of options.seeds) {
      messages.push({ role: 'user', content: 'Generate a training example.' });
      messages.push({ role: 'assistant', content: JSON.stringify(seed) });
    }
  }

  // User message
  const userMsg = batchSize > 1
    ? `Generate ${batchSize} different training examples as a JSON array.`
    : 'Generate a training example.';
  messages.push({ role: 'user', content: userMsg });

  const response = await options.llm(messages, {
    temperature: options.diversity?.temperature
      ? getTemperature(options.diversity.temperature, batchIndex)
      : undefined,
    jsonMode: options.structuredOutput,
  });

  const parsed = parseJsonResponse(response.content);
  const examples = parsed.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );

  const partialStats: Partial<GenerationStats> = {
    llmCalls: 1,
  };

  if (response.usage) {
    partialStats.tokens = {
      prompt: response.usage.promptTokens,
      completion: response.usage.completionTokens,
      total: response.usage.totalTokens,
    };
  }

  return { examples, stats: partialStats };
}

/**
 * Get temperature for a batch based on diversity config.
 */
function getTemperature(
  config: { min: number; max: number; strategy: string },
  batchIndex: number,
): number {
  switch (config.strategy) {
    case 'random':
      return config.min + Math.random() * (config.max - config.min);
    case 'cycle': {
      const mid = (config.min + config.max) / 2;
      const positions = [config.min, mid, config.max, mid];
      return positions[batchIndex % positions.length];
    }
    case 'linear':
    default:
      return config.min + (config.max - config.min) * Math.min(batchIndex / 10, 1);
  }
}

/**
 * Main generate function. Orchestrates schema validation, generation,
 * validation, dedup, and export.
 */
export async function generate(
  schema: ExampleSchema,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const startTime = Date.now();
  const stats = createEmptyStats();

  if (options.costTracking?.currency) {
    stats.cost.currency = options.costTracking.currency;
  }

  const count = options.count;
  const batchSize = options.batchSize || 1;
  const maxRetries = options.retry?.maxRetries ?? 3;

  // Calculate number of batches needed (generate extra to account for dedup/validation losses)
  const oversampleFactor = 1.3;
  const targetRaw = Math.ceil(count * oversampleFactor);
  const numBatches = Math.ceil(targetRaw / batchSize);

  const allExamples: GeneratedExample[] = [];
  let exampleIndex = 0;

  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    let rawExamples: Record<string, unknown>[];

    if (options.generateFn) {
      // Custom generation function
      rawExamples = options.generateFn(schema, batchIdx);
    } else if (options.llm) {
      // LLM-based generation
      let retries = 0;
      rawExamples = [];

      while (retries <= maxRetries) {
        try {
          const result = await generateWithLlm(schema, options, batchIdx, batchSize);
          rawExamples = result.examples;

          // Accumulate LLM stats
          stats.llmCalls += result.stats.llmCalls || 0;
          if (result.stats.tokens) {
            stats.tokens.prompt += result.stats.tokens.prompt;
            stats.tokens.completion += result.stats.tokens.completion;
            stats.tokens.total += result.stats.tokens.total;
          }
          break;
        } catch {
          retries++;
          if (retries > maxRetries) {
            rawExamples = [];
          }
        }
      }
    } else {
      // Template-based generation (fallback)
      rawExamples = generateExamples(schema, batchSize, batchIdx * 1000);
    }

    stats.total += rawExamples.length;

    // Validate each example
    for (const raw of rawExamples) {
      const errors = validateExample(raw, schema, options.validation);

      if (errors.length === 0) {
        stats.valid++;
        const example: GeneratedExample = {
          ...raw,
          _meta: {
            id: `sdg-${String(exampleIndex).padStart(4, '0')}`,
            index: exampleIndex,
            batchIndex: batchIdx,
          },
        };
        allExamples.push(example);
        exampleIndex++;
      } else {
        stats.invalid++;
        trackValidationError(stats, errors);

        if (options.invalidHandling === 'log') {
          stats.invalidExamples.push({
            example: raw,
            errors: errors.map(e => ({ path: e.path, message: e.message })),
            retries: 0,
          });
        } else if (options.invalidHandling === 'repair') {
          const repaired: GeneratedExample = {
            ...raw,
            _meta: {
              id: `sdg-${String(exampleIndex).padStart(4, '0')}`,
              index: exampleIndex,
              batchIndex: batchIdx,
              repaired: true,
            },
          };
          allExamples.push(repaired);
          exampleIndex++;
        }
        // Default: discard
      }
    }

    // Stop early if we have enough
    if (allExamples.length >= count * oversampleFactor) {
      break;
    }
  }

  // Dedup
  const dedupOptions = options.dedup || { strategy: 'exact' as const };
  const dedupResult = await deduplicate(
    allExamples as Record<string, unknown>[],
    dedupOptions,
  );

  stats.deduped = dedupResult.removed;

  // Limit to requested count
  const finalData = dedupResult.data.slice(0, count) as GeneratedExample[];
  stats.final = finalData.length;

  // Calculate cost
  if (options.costTracking) {
    stats.cost.promptTokens = stats.tokens.prompt;
    stats.cost.completionTokens = stats.tokens.completion;
    stats.cost.totalCost =
      stats.tokens.prompt * (options.costTracking.promptTokenCost || 0) +
      stats.tokens.completion * (options.costTracking.completionTokenCost || 0);
  }

  stats.durationMs = Date.now() - startTime;

  // Export if format specified
  let exported: string | undefined;
  if (options.format) {
    exported = exportAs(finalData as Record<string, unknown>[], options.format);
  }

  return {
    data: finalData,
    stats,
    exported,
  };
}
