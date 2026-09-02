import { describe, it, expect } from 'vitest';
import { WIDGET_REGISTRY, type WidgetId, type WidgetDefinition } from '../dashboard/useDashboardLayout';

describe('useDashboardLayout WIDGET_REGISTRY', () => {
  const allWidgetIds = Object.keys(WIDGET_REGISTRY) as WidgetId[];

  it('has at least 20 widgets', () => {
    expect(allWidgetIds.length).toBeGreaterThanOrEqual(20);
  });

  allWidgetIds.forEach(id => {
    describe(`widget "${id}"`, () => {
      const widget = WIDGET_REGISTRY[id];

      it('id matches key', () => expect(widget.id).toBe(id));
      it('has name', () => expect(widget.name).toBeTruthy());
      it('has label', () => expect(widget.label).toBeTruthy());
      it('has description', () => expect(widget.description).toBeTruthy());
      it('has icon', () => expect(widget.icon).toBeDefined());
      it('has valid defaultSize', () => expect(['S', 'L', 'small', 'medium', 'large', 'full']).toContain(widget.defaultSize));
      it('has availableSizes', () => expect(widget.availableSizes.length).toBeGreaterThan(0));
      it('has allowedSizes', () => expect(widget.allowedSizes.length).toBeGreaterThan(0));
      it('defaultSize is in allowedSizes', () => expect(widget.allowedSizes).toContain(widget.defaultSize));
      it('has valid category', () => {
        expect(['overview', 'crm', 'operations', 'finance', 'team', 'ai']).toContain(widget.category);
      });
    });
  });

  describe('categories', () => {
    const categories = new Set(allWidgetIds.map(id => WIDGET_REGISTRY[id].category));
    it('has overview widgets', () => expect(categories.has('overview')).toBe(true));
    it('has crm widgets', () => expect(categories.has('crm')).toBe(true));
    it('has operations widgets', () => expect(categories.has('operations')).toBe(true));
    it('has finance widgets', () => expect(categories.has('finance')).toBe(true));
    it('has team widgets', () => expect(categories.has('team')).toBe(true));
    it('has ai widgets', () => expect(categories.has('ai')).toBe(true));
  });

  describe('specific widgets', () => {
    it('etablissements_overview is overview', () => expect(WIDGET_REGISTRY.etablissements_overview.category).toBe('overview'));
    it('pipeline_stats is crm', () => expect(WIDGET_REGISTRY.pipeline_stats.category).toBe('crm'));
    it('treasury_summary is finance', () => expect(WIDGET_REGISTRY.treasury_summary.category).toBe('finance'));
    it('ai_insights is ai', () => expect(WIDGET_REGISTRY.ai_insights.category).toBe('ai'));
    it('jarvis_assistant is configurable', () => expect(WIDGET_REGISTRY.jarvis_assistant.configurable).toBe(true));
    it('agenda_widget is configurable', () => expect(WIDGET_REGISTRY.agenda_widget.configurable).toBe(true));
  });
});
