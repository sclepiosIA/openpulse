import { describe, it, expect } from 'vitest';
import {
  AI_FUNCTIONS_REGISTRY,
  CATEGORY_CONFIG,
  MODEL_CONFIG,
  getAIFunctionsByCategory,
  getAIFunctionsByModel,
  getAIFunctionById,
  getAIFunctionByProcessingType,
  type AIFunctionConfig,
} from '../aiRegistry';

describe('aiRegistry (extended2)', () => {
  describe('AI_FUNCTIONS_REGISTRY', () => {
    it('has 20+ functions', () => expect(AI_FUNCTIONS_REGISTRY.length).toBeGreaterThan(20));
    it('each has id, label, category, model', () => {
      AI_FUNCTIONS_REGISTRY.forEach((fn: AIFunctionConfig) => {
        expect(fn.id).toBeTruthy();
        expect(fn.label).toBeTruthy();
        expect(fn.category).toBeTruthy();
        expect(fn.model).toBeTruthy();
      });
    });
    it('each has parameters with required fields', () => {
      AI_FUNCTIONS_REGISTRY.forEach((fn: AIFunctionConfig) => {
        expect(fn.parameters.max_completion_tokens).toBeGreaterThanOrEqual(0);
        expect(fn.parameters.timeout_ms).toBeGreaterThanOrEqual(0);
      });
    });
    it('no function uses deprecated reasoning_effort "minimal"', () => {
      AI_FUNCTIONS_REGISTRY.forEach((fn: AIFunctionConfig) => {
        expect(fn.parameters.reasoning_effort).not.toBe('minimal');
      });
    });
  });

  describe('CATEGORY_CONFIG', () => {
    it('has email category', () => expect(CATEGORY_CONFIG.email.label).toBe('Email'));
    it('has crm category', () => expect(CATEGORY_CONFIG.crm.label).toBe('CRM'));
    it('has rh category', () => expect(CATEGORY_CONFIG.rh.label).toBe('RH'));
    it('has jarvis category', () => expect(CATEGORY_CONFIG.jarvis.label).toBe('Jarvis'));
    it('each has color and bgColor', () => {
      Object.values(CATEGORY_CONFIG).forEach(cat => {
        expect(cat.color).toContain('text-');
        expect(cat.bgColor).toContain('bg-');
      });
    });
  });

  describe('MODEL_CONFIG', () => {
    it('has gpt-5.4', () => expect(MODEL_CONFIG['gpt-5.4'].label).toBe('GPT-5.4'));
    it('has gpt-5.2', () => expect(MODEL_CONFIG['gpt-5.2'].label).toBe('GPT-5.2'));
    it('has gpt-5-mini', () => expect(MODEL_CONFIG['gpt-5-mini'].label).toBe('GPT-5 Mini'));
    it('has whisper-1', () => expect(MODEL_CONFIG['whisper-1'].label).toBe('Whisper'));
  });

  describe('getAIFunctionsByCategory', () => {
    it('email has multiple functions', () => {
      const emailFns = getAIFunctionsByCategory('email');
      expect(emailFns.length).toBeGreaterThan(3);
      emailFns.forEach((fn: AIFunctionConfig) => expect(fn.category).toBe('email'));
    });
    it('rh has functions', () => {
      expect(getAIFunctionsByCategory('rh').length).toBeGreaterThan(0);
    });
  });

  describe('getAIFunctionsByModel', () => {
    it('gpt-5.4 has functions', () => {
      const fns = getAIFunctionsByModel('gpt-5.4');
      expect(fns.length).toBeGreaterThan(0);
      fns.forEach((fn: AIFunctionConfig) => expect(fn.model).toBe('gpt-5.4'));
    });
  });

  describe('getAIFunctionById', () => {
    it('finds process-email-with-ai', () => {
      const fn = getAIFunctionById('process-email-with-ai');
      expect(fn).toBeDefined();
      expect(fn?.category).toBe('email');
    });
    it('returns undefined for unknown', () => {
      expect(getAIFunctionById('nonexistent')).toBeUndefined();
    });
  });

  describe('getAIFunctionByProcessingType', () => {
    it('finds extraction', () => {
      const fn = getAIFunctionByProcessingType('extraction');
      expect(fn).toBeDefined();
      expect(fn?.id).toBe('process-email-with-ai');
    });
    it('returns undefined for unknown', () => {
      expect(getAIFunctionByProcessingType('nonexistent')).toBeUndefined();
    });
  });
});
