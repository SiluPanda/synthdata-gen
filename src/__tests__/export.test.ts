import { describe, it, expect } from 'vitest';
import { exportAs } from '../export/index';
import { exportOpenAI } from '../export/openai';
import { exportAlpaca } from '../export/alpaca';
import { exportShareGPT } from '../export/sharegpt';
import { exportCSV } from '../export/csv';
import { exportJSONL } from '../export/jsonl';

const examples = [
  { instruction: 'Explain TCP vs UDP', input: '', output: 'TCP is connection-oriented, UDP is connectionless.', category: 'coding' },
  { instruction: 'Write a haiku about nature', input: '', output: 'Crimson leaves descend, whispering through the cool breeze, natures last encore', category: 'writing' },
];

const qaExamples = [
  { question: 'What is the capital of France?', answer: 'Paris is the capital of France.' },
  { question: 'What is 2+2?', answer: 'The answer is 4.' },
];

// ── OpenAI format tests ──

describe('exportOpenAI', () => {
  it('should export in OpenAI fine-tuning JSONL format', () => {
    const result = exportOpenAI(examples);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.messages).toBeDefined();
    expect(parsed.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('should map instruction to user role', () => {
    const result = exportOpenAI(examples);
    const parsed = JSON.parse(result.split('\n')[0]);
    const userMsg = parsed.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('Explain TCP vs UDP');
  });

  it('should map output to assistant role', () => {
    const result = exportOpenAI(examples);
    const parsed = JSON.parse(result.split('\n')[0]);
    const assistantMsg = parsed.messages.find((m: { role: string }) => m.role === 'assistant');
    expect(assistantMsg.content).toContain('TCP is connection-oriented');
  });

  it('should include system prompt when provided', () => {
    const result = exportOpenAI(examples, { systemPrompt: 'You are a helpful teacher.' });
    const parsed = JSON.parse(result.split('\n')[0]);
    const systemMsg = parsed.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg).toBeDefined();
    expect(systemMsg.content).toBe('You are a helpful teacher.');
  });

  it('should support custom field mapping', () => {
    const result = exportOpenAI(qaExamples, {
      fieldMap: { user: 'question', assistant: 'answer' },
    });
    const parsed = JSON.parse(result.split('\n')[0]);
    const userMsg = parsed.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('capital of France');
  });

  it('should handle empty examples array', () => {
    const result = exportOpenAI([]);
    expect(result).toBe('');
  });
});

// ── Alpaca format tests ──

describe('exportAlpaca', () => {
  it('should export in Alpaca format', () => {
    const result = exportAlpaca(examples);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.instruction).toBe('Explain TCP vs UDP');
    expect(parsed.input).toBe('');
    expect(parsed.output).toContain('TCP is connection-oriented');
  });

  it('should include all three fields', () => {
    const result = exportAlpaca(examples);
    const parsed = JSON.parse(result.split('\n')[0]);
    expect('instruction' in parsed).toBe(true);
    expect('input' in parsed).toBe(true);
    expect('output' in parsed).toBe(true);
  });

  it('should support custom field mapping', () => {
    const result = exportAlpaca(qaExamples, {
      fieldMap: { instruction: 'question', output: 'answer' },
    });
    const parsed = JSON.parse(result.split('\n')[0]);
    expect(parsed.instruction).toContain('capital of France');
    expect(parsed.output).toContain('Paris');
  });

  it('should handle empty examples array', () => {
    const result = exportAlpaca([]);
    expect(result).toBe('');
  });
});

// ── ShareGPT format tests ──

describe('exportShareGPT', () => {
  it('should export in ShareGPT format', () => {
    const result = exportShareGPT(examples);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.conversations).toBeDefined();
    expect(Array.isArray(parsed.conversations)).toBe(true);
  });

  it('should include human and gpt messages', () => {
    const result = exportShareGPT(examples);
    const parsed = JSON.parse(result.split('\n')[0]);
    const human = parsed.conversations.find((c: { from: string }) => c.from === 'human');
    const gpt = parsed.conversations.find((c: { from: string }) => c.from === 'gpt');
    expect(human).toBeDefined();
    expect(gpt).toBeDefined();
    expect(human.value).toContain('Explain TCP vs UDP');
    expect(gpt.value).toContain('TCP is connection-oriented');
  });

  it('should include system message when provided', () => {
    const result = exportShareGPT(examples, { systemPrompt: 'You are a teacher.' });
    const parsed = JSON.parse(result.split('\n')[0]);
    const system = parsed.conversations.find((c: { from: string }) => c.from === 'system');
    expect(system).toBeDefined();
    expect(system.value).toBe('You are a teacher.');
  });

  it('should not include system message by default', () => {
    const result = exportShareGPT(examples);
    const parsed = JSON.parse(result.split('\n')[0]);
    const system = parsed.conversations.find((c: { from: string }) => c.from === 'system');
    expect(system).toBeUndefined();
  });

  it('should handle empty examples array', () => {
    const result = exportShareGPT([]);
    expect(result).toBe('');
  });
});

// ── CSV format tests ──

describe('exportCSV', () => {
  it('should export in CSV format with header', () => {
    const result = exportCSV(examples);
    const lines = result.split('\n');
    expect(lines.length).toBe(3); // header + 2 rows
    expect(lines[0]).toContain('instruction');
    expect(lines[0]).toContain('output');
    expect(lines[0]).toContain('category');
  });

  it('should exclude _meta from columns', () => {
    const withMeta = [{ text: 'hello', _meta: { id: '1' } }];
    const result = exportCSV(withMeta);
    expect(result).not.toContain('_meta');
  });

  it('should escape values containing commas', () => {
    const data = [{ text: 'hello, world', label: 'test' }];
    const result = exportCSV(data);
    expect(result).toContain('"hello, world"');
  });

  it('should escape values containing quotes', () => {
    const data = [{ text: 'say "hello"', label: 'test' }];
    const result = exportCSV(data);
    expect(result).toContain('"say ""hello"""');
  });

  it('should escape values containing newlines', () => {
    const data = [{ text: 'line1\nline2', label: 'test' }];
    const result = exportCSV(data);
    expect(result).toContain('"line1\nline2"');
  });

  it('should support custom delimiter', () => {
    const result = exportCSV(examples, { delimiter: '\t' });
    const header = result.split('\n')[0];
    expect(header).toContain('\t');
  });

  it('should escape values containing custom delimiter', () => {
    const data = [{ text: 'hello\tworld', label: 'test' }];
    const result = exportCSV(data, { delimiter: '\t' });
    // Value containing tab delimiter should be quoted
    expect(result).toContain('"hello\tworld"');
  });

  it('should not quote values with commas when using tab delimiter', () => {
    const data = [{ text: 'hello, world', label: 'test' }];
    const result = exportCSV(data, { delimiter: '\t' });
    // Comma is not the delimiter, so no quoting needed
    expect(result).not.toContain('"hello, world"');
    expect(result).toContain('hello, world');
  });

  it('should support suppressing header', () => {
    const result = exportCSV(examples, { header: false });
    const lines = result.split('\n');
    expect(lines).toHaveLength(2); // no header
  });

  it('should support field subset', () => {
    const result = exportCSV(examples, { fields: ['instruction', 'category'] });
    const header = result.split('\n')[0];
    expect(header).toBe('instruction,category');
  });

  it('should handle empty examples array', () => {
    const result = exportCSV([]);
    expect(result).toBe('');
  });

  it('should serialize non-string values', () => {
    const data = [{ text: 'hello', count: 42, active: true }];
    const result = exportCSV(data);
    expect(result).toContain('42');
    expect(result).toContain('true');
  });
});

// ── JSONL format tests ──

describe('exportJSONL', () => {
  it('should export one JSON object per line', () => {
    const result = exportJSONL(examples);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.instruction).toBe('Explain TCP vs UDP');
  });

  it('should exclude _meta by default', () => {
    const withMeta = [{ text: 'hello', _meta: { id: '1' } }];
    const result = exportJSONL(withMeta);
    const parsed = JSON.parse(result);
    expect(parsed._meta).toBeUndefined();
  });

  it('should support field subset', () => {
    const result = exportJSONL(examples, { fields: ['instruction', 'category'] });
    const parsed = JSON.parse(result.split('\n')[0]);
    expect(Object.keys(parsed)).toEqual(['instruction', 'category']);
  });

  it('should handle empty examples array', () => {
    const result = exportJSONL([]);
    expect(result).toBe('');
  });

  it('should preserve all field types', () => {
    const data = [{ text: 'hello', count: 42, active: true, tags: ['a', 'b'] }];
    const result = exportJSONL(data);
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(42);
    expect(parsed.active).toBe(true);
    expect(parsed.tags).toEqual(['a', 'b']);
  });
});

// ── exportAs dispatcher tests ──

describe('exportAs', () => {
  it('should dispatch to openai format', () => {
    const result = exportAs(examples, 'openai');
    const parsed = JSON.parse(result.split('\n')[0]);
    expect(parsed.messages).toBeDefined();
  });

  it('should dispatch to alpaca format', () => {
    const result = exportAs(examples, 'alpaca');
    const parsed = JSON.parse(result.split('\n')[0]);
    expect(parsed.instruction).toBeDefined();
  });

  it('should dispatch to sharegpt format', () => {
    const result = exportAs(examples, 'sharegpt');
    const parsed = JSON.parse(result.split('\n')[0]);
    expect(parsed.conversations).toBeDefined();
  });

  it('should dispatch to csv format', () => {
    const result = exportAs(examples, 'csv');
    expect(result.split('\n')[0]).toContain('instruction');
  });

  it('should dispatch to jsonl format', () => {
    const result = exportAs(examples, 'jsonl');
    const parsed = JSON.parse(result.split('\n')[0]);
    expect(parsed.instruction).toBeDefined();
  });

  it('should throw for unsupported format', () => {
    expect(() => exportAs(examples, 'unknown' as never)).toThrow('Unsupported');
  });

  it('should pass options through', () => {
    const result = exportAs(examples, 'openai', { systemPrompt: 'Test system' });
    const parsed = JSON.parse(result.split('\n')[0]);
    const system = parsed.messages.find((m: { role: string }) => m.role === 'system');
    expect(system.content).toBe('Test system');
  });
});
