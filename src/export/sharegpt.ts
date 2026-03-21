import type { ExportOptions } from '../types';

/**
 * Export examples in ShareGPT format.
 * Each line: {"conversations": [{"from": "human", "value": "..."}, {"from": "gpt", "value": "..."}]}
 */
export function exportShareGPT(
  examples: Record<string, unknown>[],
  options?: ExportOptions,
): string {
  const lines: string[] = [];

  for (const example of examples) {
    const conversations: Array<{ from: string; value: string }> = [];

    // System message
    const systemContent = resolveField(example, options?.fieldMap, 'system', [
      'system', 'system_prompt',
    ]);
    if (systemContent || options?.systemPrompt) {
      conversations.push({
        from: 'system',
        value: systemContent || options?.systemPrompt || '',
      });
    }

    // Human message
    const humanContent = resolveField(example, options?.fieldMap, 'human', [
      'instruction', 'question', 'prompt', 'input',
    ]);
    conversations.push({ from: 'human', value: humanContent });

    // GPT message
    const gptContent = resolveField(example, options?.fieldMap, 'gpt', [
      'output', 'response', 'answer', 'completion',
    ]);
    conversations.push({ from: 'gpt', value: gptContent });

    lines.push(JSON.stringify({ conversations }));
  }

  return lines.join('\n');
}

function resolveField(
  example: Record<string, unknown>,
  fieldMap: Record<string, string> | undefined,
  role: string,
  fallbacks: string[],
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

  const stringFields = Object.entries(example)
    .filter(([k, v]) => typeof v === 'string' && k !== '_meta')
    .map(([k]) => k);

  if (role === 'human' && stringFields.length > 0) {
    return example[stringFields[0]] as string;
  }
  if (role === 'gpt' && stringFields.length > 1) {
    return example[stringFields[stringFields.length - 1]] as string;
  }

  return '';
}
