import { describe, it, expect } from 'vitest';
import { REPORT_SOURCES, WIDGET_DEFAULT_SIZE, MAX_WIDGETS_PER_DASHBOARD, MAX_DASHBOARDS_PER_USER, WidgetType } from './report';

describe('report.ts exports', () => {
  describe('REPORT_SOURCES', () => {
    it('should be a non-empty array with valid structure and unique keys', () => {
      expect(Array.isArray(REPORT_SOURCES)).toBe(true);
      expect(REPORT_SOURCES.length).toBeGreaterThan(0);

      const seen = new Set<string>();
      for (const src of REPORT_SOURCES) {
        // Basic shape checks
        expect(src).toBeDefined();
        expect(typeof (src as any).key).toBe('string');
        expect(typeof (src as any).label).toBe('string');
        expect(typeof (src as any).description).toBe('string');
        expect(typeof (src as any).category).toBe('string');
        expect(typeof (src as any).defaultWidget).toBe('string');
        expect(Array.isArray((src as any).dimensions)).toBe(true);
        expect(Array.isArray((src as any).measures)).toBe(true);

        // Unique keys
        const key = (src as any).key as string;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }

      // Ensure all keys are unique
      expect(seen.size).toBe(REPORT_SOURCES.length);

      // Validate categories and defaults
      const validCategories = ['commercial', 'finance', 'production', 'support', 'rh'];
      const validWidgets = ['kpi', 'bar_chart', 'line_chart', 'donut_chart', 'table', 'funnel', 'markdown'];
      for (const src of REPORT_SOURCES) {
        const s = src as any;
        expect(validCategories).toContain(s.category);
        expect(validWidgets).toContain(s.defaultWidget);
        expect(Array.isArray(s.dimensions)).toBe(true);
        expect(s.dimensions.length).toBeGreaterThan(0);
        expect(Array.isArray(s.measures)).toBe(true);
        expect(s.measures.length).toBeGreaterThan(0);
      }
    });
  });

  describe('WIDGET_DEFAULT_SIZE', () => {
    it('should define size config for all widget types and contain numeric dimensions', () => {
      // Ensure all widget types present
      const entries = Object.entries(WIDGET_DEFAULT_SIZE) as Array<[string, { w: number; h: number; minW: number; minH: number }]>;

      // There should be at least one entry for each WidgetType
      for (const type of Object.keys(WIDGET_DEFAULT_SIZE) as WidgetType[]) {
        const size = (WIDGET_DEFAULT_SIZE as any)[type];
        expect(size).toBeDefined();
        expect(typeof size.w).toBe('number');
        expect(typeof size.h).toBe('number');
        expect(typeof size.minW).toBe('number');
        expect(typeof size.minH).toBe('number');
        expect(size.w).toBeGreaterThan(0);
        expect(size.h).toBeGreaterThan(0);
        expect(size.minW).toBeGreaterThan(0);
        expect(size.minH).toBeGreaterThan(0);
      }

      // Validate that all defined keys correspond to valid WidgetType
      for (const [key] of entries) {
        expect((Object.keys(WIDGET_DEFAULT_SIZE) as WidgetType[]).includes(key as WidgetType)).toBe(true);
      }
    });
  });

  it('constants should be positive numbers', () => {
    expect(typeof MAX_WIDGETS_PER_DASHBOARD).toBe('number');
    expect(typeof MAX_DASHBOARDS_PER_USER).toBe('number');
    expect(MAX_WIDGETS_PER_DASHBOARD).toBeGreaterThan(0);
    expect(MAX_DASHBOARDS_PER_USER).toBeGreaterThan(0);
  });
});