import type { ExportOptions } from '../types';

/**
 * Export examples in plain JSONL format.
 * One JSON object per line, preserving original field names.
 */
export function exportJSONL(
  examples: Record<string, unknown>[],
  options?: ExportOptions,
): string {
  const lines: string[] = [];

  for (const example of examples) {
    let obj: Record<string, unknown>;

    if (options?.fields) {
      obj = {};
      for (const field of options.fields) {
        if (field in example) {
          obj[field] = example[field];
        }
      }
    } else {
      // Exclude _meta by default
      obj = {};
      for (const [key, value] of Object.entries(example)) {
        if (key !== '_meta') {
          obj[key] = value;
        }
      }
    }

    lines.push(JSON.stringify(obj));
  }

  return lines.join('\n');
}
