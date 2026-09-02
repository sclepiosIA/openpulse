import { describe, it, expect } from 'vitest';
import { formatTokens, formatCost, formatDuration, getProcessingTypeLabel } from '../ai/useAIUsageStats';

describe('useAIUsageStats helpers extended', () => {
  describe('formatTokens', () => {
    it('< 1000 → raw number', () => expect(formatTokens(500)).toBe('500'));
    it('1000 → 1.0K', () => expect(formatTokens(1000)).toBe('1.0K'));
    it('1500 → 1.5K', () => expect(formatTokens(1500)).toBe('1.5K'));
    it('999999 → 1000.0K', () => expect(formatTokens(999999)).toBe('1000.0K'));
    it('1000000 → 1.0M', () => expect(formatTokens(1000000)).toBe('1.0M'));
    it('2500000 → 2.5M', () => expect(formatTokens(2500000)).toBe('2.5M'));
    it('0 → 0', () => expect(formatTokens(0)).toBe('0'));
  });

  describe('formatCost', () => {
    it('>= 1 → 2 decimals', () => expect(formatCost(1.5)).toBe('$1.50'));
    it('>= 0.01 → 3 decimals', () => expect(formatCost(0.05)).toBe('$0.050'));
    it('< 0.01 → 4 decimals', () => expect(formatCost(0.001)).toBe('$0.0010'));
    it('0 → $0.0000', () => expect(formatCost(0)).toBe('$0.0000'));
    it('large amount', () => expect(formatCost(100)).toBe('$100.00'));
  });

  describe('formatDuration', () => {
    it('>= 1000ms → seconds', () => expect(formatDuration(1500)).toBe('1.5s'));
    it('< 1000ms → ms', () => expect(formatDuration(250)).toBe('250ms'));
    it('0ms → 0ms', () => expect(formatDuration(0)).toBe('0ms'));
    it('exactly 1000ms → 1.0s', () => expect(formatDuration(1000)).toBe('1.0s'));
    it('rounds ms', () => expect(formatDuration(99.7)).toBe('100ms'));
  });

  describe('getProcessingTypeLabel', () => {
    it('extraction → Classification Email', () => expect(getProcessingTypeLabel('extraction')).toBe('Classification Email'));
    it('email_spelling → Correction ortho.', () => expect(getProcessingTypeLabel('email_spelling')).toBe('Correction ortho.'));
    it('rd_assist → R&D Assistance', () => expect(getProcessingTypeLabel('rd_assist')).toBe('R&D Assistance'));
    it('rh_bulletin_parsing → Parsing bulletin', () => expect(getProcessingTypeLabel('rh_bulletin_parsing')).toBe('Parsing bulletin'));
    it('jarvis-chat → Jarvis Chat', () => expect(getProcessingTypeLabel('jarvis-chat')).toBe('Jarvis Chat'));
    it('unknown type → returns type as-is', () => expect(getProcessingTypeLabel('unknown_type')).toBe('unknown_type'));
    it('pulse_chat → Pulse Chat', () => expect(getProcessingTypeLabel('pulse_chat')).toBe('Pulse Chat'));
    it('visio_summary → Résumé visio', () => expect(getProcessingTypeLabel('visio_summary')).toBe('Résumé visio'));
    it('suggestion_generation → Suggestions IA', () => expect(getProcessingTypeLabel('suggestion_generation')).toBe('Suggestions IA'));
    it('medical_economic_study_analysis → Étude médico-éco', () => expect(getProcessingTypeLabel('medical_economic_study_analysis')).toBe('Étude médico-éco'));
  });
});
