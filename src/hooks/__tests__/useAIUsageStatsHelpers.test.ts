import { describe, it, expect } from 'vitest';
import { formatTokens, formatCost, formatDuration, getProcessingTypeLabel } from '../ai/useAIUsageStats';

describe('useAIUsageStats helpers', () => {
  describe('formatTokens', () => {
    it('formats small', () => expect(formatTokens(500)).toBe('500'));
    it('formats thousands', () => expect(formatTokens(1500)).toBe('1.5K'));
    it('formats millions', () => expect(formatTokens(2500000)).toBe('2.5M'));
  });

  describe('formatCost', () => {
    it('formats >= $1', () => expect(formatCost(1.5)).toBe('$1.50'));
    it('formats >= $0.01', () => expect(formatCost(0.05)).toBe('$0.050'));
    it('formats tiny', () => expect(formatCost(0.001)).toBe('$0.0010'));
  });

  describe('formatDuration', () => {
    it('formats ms', () => expect(formatDuration(500)).toBe('500ms'));
    it('formats seconds', () => expect(formatDuration(1500)).toBe('1.5s'));
  });

  describe('getProcessingTypeLabel', () => {
    it('maps extraction', () => expect(getProcessingTypeLabel('extraction')).toBe('Classification Email'));
    it('maps email_spelling', () => expect(getProcessingTypeLabel('email_spelling')).toBe('Correction ortho.'));
    it('maps pulse_chat', () => expect(getProcessingTypeLabel('pulse_chat')).toBe('Pulse Chat'));
    it('maps rd_assist', () => expect(getProcessingTypeLabel('rd_assist')).toBe('R&D Assistance'));
    it('maps rh_bulletin_parsing', () => expect(getProcessingTypeLabel('rh_bulletin_parsing')).toBe('Parsing bulletin'));
    it('maps jarvis-chat', () => expect(getProcessingTypeLabel('jarvis-chat')).toBe('Jarvis Chat'));
    it('returns raw for unknown', () => expect(getProcessingTypeLabel('custom_type')).toBe('custom_type'));
  });
});
