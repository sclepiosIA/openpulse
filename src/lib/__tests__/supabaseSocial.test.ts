import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn() })) },
}));

describe('supabaseSocial', () => {
  it('exports socialClient as the supabase client', async () => {
    const { socialClient } = await import('../supabaseSocial');
    expect(socialClient).toBeDefined();
    expect(typeof socialClient.from).toBe('function');
  });
});
