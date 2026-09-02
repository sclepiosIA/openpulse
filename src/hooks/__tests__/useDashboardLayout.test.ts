import { describe, it, expect, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// We test the WIDGET_REGISTRY export (pure data) without needing supabase/auth mocks
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: vi.fn(),
}));
vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('WIDGET_REGISTRY', () => {
  it('has all expected widget IDs', async () => {
    const { WIDGET_REGISTRY } = await import('../dashboard/useDashboardLayout');
    const ids = Object.keys(WIDGET_REGISTRY);
    expect(ids.length).toBeGreaterThanOrEqual(25);
    
    // Core widgets
    expect(WIDGET_REGISTRY.etablissements_overview).toBeDefined();
    expect(WIDGET_REGISTRY.pipeline_stats).toBeDefined();
    expect(WIDGET_REGISTRY.email_summary).toBeDefined();
    expect(WIDGET_REGISTRY.treasury_summary).toBeDefined();
    expect(WIDGET_REGISTRY.ai_insights).toBeDefined();
    expect(WIDGET_REGISTRY.notes).toBeDefined();
  });

  it('all widgets have required fields', async () => {
    const { WIDGET_REGISTRY } = await import('../dashboard/useDashboardLayout');
    Object.values(WIDGET_REGISTRY).forEach(widget => {
      expect(widget.id).toBeTruthy();
      expect(widget.name).toBeTruthy();
      expect(widget.label).toBeTruthy();
      expect(widget.description).toBeTruthy();
      expect(widget.icon).toBeDefined();
      expect(widget.defaultSize).toBeTruthy();
      expect(widget.availableSizes.length).toBeGreaterThan(0);
      expect(widget.allowedSizes.length).toBeGreaterThan(0);
      expect(['overview', 'crm', 'operations', 'finance', 'team', 'ai']).toContain(widget.category);
    });
  });

  it('widget IDs match their keys', async () => {
    const { WIDGET_REGISTRY } = await import('../dashboard/useDashboardLayout');
    Object.entries(WIDGET_REGISTRY).forEach(([key, widget]) => {
      expect(widget.id).toBe(key);
    });
  });

  it('defaultSize is in availableSizes', async () => {
    const { WIDGET_REGISTRY } = await import('../dashboard/useDashboardLayout');
    Object.values(WIDGET_REGISTRY).forEach(widget => {
      expect(widget.availableSizes).toContain(widget.defaultSize);
    });
  });
});
