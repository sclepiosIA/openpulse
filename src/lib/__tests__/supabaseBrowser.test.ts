import { describe, it, expect } from 'vitest';
import { supabase, getSupabaseClient } from '@/lib/supabaseBrowser';

describe('supabaseBrowser', () => {
  it('exports a singleton supabase client with auth methods', () => {
    expect(supabase).toBeTruthy();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth.getSession).toBe('function');
  });

  it('getSupabaseClient returns the same instance', () => {
    expect(getSupabaseClient()).toBe(supabase);
  });
});
