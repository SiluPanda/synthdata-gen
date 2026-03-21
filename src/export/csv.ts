import type { ExportOptions } from '../types';

/**
 * Escape a value for CSV output.
 */
function escapeCSV(value: unknown, quote: string): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  // If the value contains the quote character, delimiter, or newlines, wrap it
  if (str.includes(quote) || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    const escaped = str.replace(new RegExp(escapeRegex(quote), 'g'), quote + quote);
    return `${quote}${escaped}${quote}`;
  }
  return str;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Export examples in CSV format.
 */
export function exportCSV(
  examples: Record<string, unknown>[],
  options?: ExportOptions,
): string {
  if (examples.length === 0) return '';

  const delimiter = options?.delimiter || ',';
  const quote = options?.quote || '"';
  const includeHeader = options?.header !== false;

  // Determine columns
  const columns = options?.fields ||
    Object.keys(examples[0]).filter(k => k !== '_meta');

  const lines: string[] = [];

  if (includeHeader) {
    lines.push(columns.join(delimiter));
  }

  for (const example of examples) {
    const values = columns.map(col => escapeCSV(example[col], quote));
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}
