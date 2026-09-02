import { describe, it, expect } from 'vitest';
import { WIDGET_REGISTRY } from '../dashboard/useDashboardLayout';

describe('WIDGET_REGISTRY', () => {
  it('has at least 20 widgets', () => {
    expect(Object.keys(WIDGET_REGISTRY).length).toBeGreaterThanOrEqual(20);
  });

  it('each widget has required fields', () => {
    Object.values(WIDGET_REGISTRY).forEach(widget => {
      expect(widget.id).toBeTruthy();
      expect(widget.name).toBeTruthy();
      expect(widget.label).toBeTruthy();
      expect(widget.description).toBeTruthy();
      expect(widget.icon).toBeDefined();
      expect(widget.defaultSize).toBeTruthy();
      expect(widget.availableSizes.length).toBeGreaterThan(0);
      expect(widget.allowedSizes.length).toBeGreaterThan(0);
      expect(widget.category).toBeTruthy();
    });
  });

  it('widget categories are valid', () => {
    const validCategories = ['overview', 'crm', 'operations', 'finance', 'team', 'ai'];
    Object.values(WIDGET_REGISTRY).forEach(widget => {
      expect(validCategories).toContain(widget.category);
    });
  });

  it('etablissements_overview widget exists', () => {
    const w = WIDGET_REGISTRY.etablissements_overview;
    expect(w.name).toBe('Établissements');
    expect(w.category).toBe('overview');
  });

  it('pipeline_stats widget exists', () => {
    const w = WIDGET_REGISTRY.pipeline_stats;
    expect(w.category).toBe('crm');
  });

  it('ai_insights widget exists', () => {
    const w = WIDGET_REGISTRY.ai_insights;
    expect(w.category).toBe('ai');
  });

  it('treasury_summary widget exists', () => {
    const w = WIDGET_REGISTRY.treasury_summary;
    expect(w.category).toBe('finance');
  });

  it('jarvis_assistant is configurable', () => {
    expect(WIDGET_REGISTRY.jarvis_assistant.configurable).toBe(true);
  });

  it('defaultSize is in allowedSizes', () => {
    Object.values(WIDGET_REGISTRY).forEach(widget => {
      expect(widget.allowedSizes).toContain(widget.defaultSize);
    });
  });
});
