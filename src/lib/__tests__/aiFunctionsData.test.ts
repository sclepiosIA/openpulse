import { describe, it, expect } from 'vitest';
import { AI_FUNCTIONS_REGISTRY } from '../aiFunctionsData';

describe('AI_FUNCTIONS_REGISTRY', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(AI_FUNCTIONS_REGISTRY)).toBe(true);
    expect(AI_FUNCTIONS_REGISTRY.length).toBeGreaterThan(10);
  });

  it('every function has required identifying fields', () => {
    for (const fn of AI_FUNCTIONS_REGISTRY) {
      expect(typeof fn.id).toBe('string');
      expect(fn.id.length).toBeGreaterThan(0);
      expect(typeof fn.label).toBe('string');
      expect(typeof fn.description).toBe('string');
      expect(typeof fn.category).toBe('string');
      expect(typeof fn.model).toBe('string');
    }
  });

  it('every function has unique id', () => {
    const ids = AI_FUNCTIONS_REGISTRY.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fallbackChain is a non-empty array starting with primary model', () => {
    for (const fn of AI_FUNCTIONS_REGISTRY) {
      expect(Array.isArray(fn.fallbackChain)).toBe(true);
      expect(fn.fallbackChain.length).toBeGreaterThan(0);
      expect(fn.fallbackChain[0]).toBe(fn.model);
    }
  });

  it('parameters use valid GPT-5 fields', () => {
    const validReasoning = ['minimal', 'low', 'medium', 'high', 'N/A'];
    const validVerbosity = ['low', 'medium', 'high', 'N/A'];
    const validFormats = ['text', 'json_object'];
    for (const fn of AI_FUNCTIONS_REGISTRY) {
      const p = fn.parameters;
      expect(validReasoning).toContain(p.reasoning_effort);
      expect(validVerbosity).toContain(p.verbosity);
      if (p.response_format !== undefined) expect(validFormats).toContain(p.response_format);
      expect(p.max_completion_tokens).toBeGreaterThanOrEqual(0);
      expect(p.timeout_ms).toBeGreaterThanOrEqual(0);
    }
  });

  it('categories are within the expected enum set', () => {
    const allowed = new Set(['email', 'rh', 'crm', 'rd', 'tresorerie', 'support', 'autre', 'calendrier', 'jarvis', 'pulse']);
    for (const fn of AI_FUNCTIONS_REGISTRY) {
      expect(allowed.has(fn.category)).toBe(true);
    }
  });

  it('contains canonical email functions', () => {
    const ids = AI_FUNCTIONS_REGISTRY.map((f) => f.id);
    expect(ids).toContain('process-email-with-ai');
    expect(ids).toContain('correct-spelling-email');
    expect(ids).toContain('reformulate-email');
    expect(ids).toContain('translate-email');
  });
});
