import type { ExportOptions } from '../types';

/**
 * Resolve which schema field maps to a given role.
 */
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

  // Fall back to first/last string field
  const stringFields = Object.entries(example)
    .filter(([k, v]) => typeof v === 'string' && k !== '_meta')
    .map(([k]) => k);

  if (role === 'user' && stringFields.length > 0) {
    return example[stringFields[0]] as string;
  }
  if (role === 'assistant' && stringFields.length > 1) {
    return example[stringFields[stringFields.length - 1]] as string;
  }
  if (role === 'assistant' && stringFields.length === 1) {
    return example[stringFields[0]] as string;
  }

  return '';
}

/**
 * Export examples in OpenAI fine-tuning JSONL format.
 * Each line: {"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}
 */
export function exportOpenAI(
  examples: Record<string, unknown>[],
  options?: ExportOptions,
): string {
  const lines: string[] = [];

  for (const example of examples) {
    const messages: Array<{ role: string; content: string }> = [];

    // System message
    const systemContent = resolveField(example, options?.fieldMap, 'system', [
      'system', 'system_prompt',
    ]);
    if (systemContent || options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: systemContent || options?.systemPrompt || '',
      });
    }

    // User message
    let userContent = resolveField(example, options?.fieldMap, 'user', [
      'instruction', 'question', 'prompt', 'input',
    ]);

    // Append input field to user message if it exists and is separate
    const inputField = options?.fieldMap?.input || 'input';
    if (
      inputField in example &&
      typeof example[inputField] === 'string' &&
      (example[inputField] as string).trim().length > 0 &&
      inputField !== (options?.fieldMap?.user || 'instruction')
    ) {
      userContent += '\n\n' + (example[inputField] as string);
    }

    messages.push({ role: 'user', content: userContent });

    // Assistant message
    const assistantContent = resolveField(example, options?.fieldMap, 'assistant', [
      'output', 'response', 'answer', 'completion',
    ]);
    messages.push({ role: 'assistant', content: assistantContent });

    lines.push(JSON.stringify({ messages }));
  }

  return lines.join('\n');
}
