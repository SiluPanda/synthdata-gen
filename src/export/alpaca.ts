import type { ExportOptions } from '../types';

/**
 * Export examples in Alpaca format.
 * Each line: {"instruction": "...", "input": "...", "output": "..."}
 */
export function exportAlpaca(
  examples: Record<string, unknown>[],
  options?: ExportOptions,
): string {
  const lines: string[] = [];

  for (const example of examples) {
    const stringFields = Object.entries(example)
      .filter(([k, v]) => typeof v === 'string' && k !== '_meta')
      .map(([k]) => k);

    const instruction = resolveAlpacaField(example, options?.fieldMap, 'instruction', [
      'instruction', 'question', 'prompt',
    ], stringFields, 0);

    const input = resolveAlpacaField(example, options?.fieldMap, 'input', [
      'input', 'context',
    ], stringFields, -1);

    const output = resolveAlpacaField(example, options?.fieldMap, 'output', [
      'output', 'response', 'answer', 'completion',
    ], stringFields, stringFields.length - 1);

    lines.push(JSON.stringify({ instruction, input, output }));
  }

  return lines.join('\n');
}

function resolveAlpacaField(
  example: Record<string, unknown>,
  fieldMap: Record<string, string> | undefined,
  role: string,
  fallbacks: string[],
  stringFields: string[],
  defaultIdx: number,
): string {
  if (fieldMap && fieldMap[role]) {
    const val = example[fieldMap[role]];
    return typeof val === 'string' ? val : '';
  }

  for (const key of fallbacks) {
    if (key in example && typeof example[key] === 'string') {
      return example[key] as string;
    }
  }

  if (defaultIdx >= 0 && defaultIdx < stringFields.length) {
    return (example[stringFields[defaultIdx]] as string) || '';
  }

  return '';
}
