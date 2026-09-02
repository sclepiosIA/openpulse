import { describe, it, expect } from 'vitest';
import {
  AI_FUNCTIONS_REGISTRY, CATEGORY_CONFIG, MODEL_CONFIG,
  type AIFunctionConfig, type AICategory,
} from '../aiRegistry';

describe('aiRegistry', () => {
  it('has functions registered', () => {
    expect(AI_FUNCTIONS_REGISTRY.length).toBeGreaterThan(10);
  });

  it('all functions have required fields', () => {
    AI_FUNCTIONS_REGISTRY.forEach((fn: AIFunctionConfig) => {
      expect(fn.id).toBeTruthy();
      expect(fn.label).toBeTruthy();
      expect(fn.category).toBeTruthy();
      expect(fn.model).toBeTruthy();
      expect(fn.parameters.max_completion_tokens).toBeGreaterThanOrEqual(0);
      expect(fn.parameters.timeout_ms).toBeGreaterThanOrEqual(0);
    });
  });

  it('all categories have config', () => {
    const categories = new Set(AI_FUNCTIONS_REGISTRY.map(f => f.category));
    categories.forEach(cat => {
      expect(CATEGORY_CONFIG[cat]).toBeDefined();
      expect(CATEGORY_CONFIG[cat].label).toBeTruthy();
    });
  });

  it('all models have config', () => {
    const models = new Set(AI_FUNCTIONS_REGISTRY.map(f => f.model));
    models.forEach(model => {
      expect(MODEL_CONFIG[model]).toBeDefined();
    });
  });

  it('email category has multiple functions', () => {
    const emailFns = AI_FUNCTIONS_REGISTRY.filter(f => f.category === 'email');
    expect(emailFns.length).toBeGreaterThanOrEqual(5);
  });

  it('each function has unique id', () => {
    const ids = AI_FUNCTIONS_REGISTRY.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fallbackChain is non-empty', () => {
    AI_FUNCTIONS_REGISTRY.forEach(fn => {
      expect(fn.fallbackChain.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('gpt-5.4 is the primary model', () => {
    expect(MODEL_CONFIG['gpt-5.4']).toBeDefined();
    const gpt54Fns = AI_FUNCTIONS_REGISTRY.filter(f => f.model === 'gpt-5.4');
    expect(gpt54Fns.length).toBeGreaterThan(10);
  });

  it('no function uses deprecated reasoning_effort "minimal"', () => {
    AI_FUNCTIONS_REGISTRY.forEach(fn => {
      expect(fn.parameters.reasoning_effort).not.toBe('minimal');
    });
  });
});
