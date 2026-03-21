import type { ExportFormat, ExportOptions } from '../types';
import { exportOpenAI } from './openai';
import { exportAlpaca } from './alpaca';
import { exportShareGPT } from './sharegpt';
import { exportCSV } from './csv';
import { exportJSONL } from './jsonl';

/**
 * Export examples in the specified format.
 */
export function exportAs(
  examples: Record<string, unknown>[],
  format: ExportFormat,
  options?: ExportOptions,
): string {
  switch (format) {
    case 'openai':
      return exportOpenAI(examples, options);
    case 'alpaca':
      return exportAlpaca(examples, options);
    case 'sharegpt':
      return exportShareGPT(examples, options);
    case 'csv':
      return exportCSV(examples, options);
    case 'jsonl':
      return exportJSONL(examples, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export { exportOpenAI } from './openai';
export { exportAlpaca } from './alpaca';
export { exportShareGPT } from './sharegpt';
export { exportCSV } from './csv';
export { exportJSONL } from './jsonl';
